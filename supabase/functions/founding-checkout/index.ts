// founding-checkout — creates a Stripe subscription Checkout Session with a discount pre-applied.
// Handles two cases, both gated server-side (leak-proof):
//   1. Founding member (orgs.founding_member = true) => fixed $9.99 forever coupon.
//   2. Admin-assigned percent discount (orgs.assigned_discount_percent) => percent coupon,
//      forever or repeating for assigned_discount_months, find-or-created on the fly.
// Card is collected now. A trial_end defers the first charge to Sept 1, 2026 only while that date
// is still in the future (legacy founding behavior); past it, billing starts normally.
// Called from core/billing.jsx.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRO_PRICE = "price_1TPSjgBRkceXoRsJLTvsknvy";  // Theatre4u Pro monthly ($15.00) => plan maps to pro
const FOUNDING_COUPON = "Wc5L1HD0";                 // $5.01 off, forever => $9.99/mo locked
const BILLING_START = 1788220800;                   // 2026-09-01T00:00:00Z — legacy founding deferral

async function stripe(path: string, key: string, body?: URLSearchParams, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : body,
  });
  return { ok: res.ok, status: res.status, json: await res.json() };
}

// Find-or-create a reusable percent-off coupon keyed by percent + duration, so we never pile up
// duplicate coupons. Deterministic id => the same rate always reuses the same coupon.
async function findOrCreatePercentCoupon(key: string, percent: number, duration: string, months: number | null, label: string) {
  const durTag = duration === "repeating" ? `${months}mo` : "forever";
  const id = `t4u_pct${percent}_${durTag}`;
  const got = await stripe(`coupons/${id}`, key, undefined, "GET");
  if (got.ok && got.json?.id) return id;
  const body = new URLSearchParams();
  body.append("id", id);
  body.append("percent_off", String(percent));
  body.append("duration", duration === "repeating" ? "repeating" : "forever");
  if (duration === "repeating") body.append("duration_in_months", String(months || 12));
  body.append("name", label || `${percent}% off`);
  const made = await stripe("coupons", key, body);
  if (!made.ok) throw new Error(`coupon create failed: ${made.json?.error?.message ?? JSON.stringify(made.json)}`);
  return id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });

  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const SB = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (!STRIPE_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const { org_id, origin } = await req.json();
    if (!org_id) throw new Error("org_id required");

    const { data: org, error: orgErr } = await SB.from("orgs")
      .select("name,email,founding_member,assigned_discount_percent,assigned_discount_duration,assigned_discount_months,assigned_discount_label,stripe_customer_id")
      .eq("id", org_id).single();
    if (orgErr || !org) throw new Error("Org not found");

    // Decide which discount applies. Founding wins if both are set.
    let coupon: string;
    let kind: string;
    let isFounding = false;
    if (org.founding_member === true) {
      coupon = FOUNDING_COUPON;
      kind = "founding_subscription";
      isFounding = true;
    } else if (Number(org.assigned_discount_percent) > 0) {
      const pct = Math.max(1, Math.min(100, Math.round(Number(org.assigned_discount_percent))));
      const dur = org.assigned_discount_duration === "repeating" ? "repeating" : "forever";
      coupon = await findOrCreatePercentCoupon(STRIPE_KEY, pct, dur, org.assigned_discount_months ?? 12, org.assigned_discount_label || `${pct}% off`);
      kind = "discount_subscription";
    } else {
      return new Response(JSON.stringify({ ok: false, error: "no_discount" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const base = (typeof origin === "string" && /^https:\/\//.test(origin))
      ? origin.replace(/\/$/, "")
      : "https://theatre4u.org";

    // Legacy Sept 1 deferral only for founding, only while still future.
    const now = Math.floor(Date.now() / 1000);
    const trialEnd = isFounding && BILLING_START > now + 172800 ? BILLING_START : undefined;

    const body = new URLSearchParams();
    body.append("mode", "subscription");
    body.append("line_items[0][price]", PRO_PRICE);
    body.append("line_items[0][quantity]", "1");
    body.append("discounts[0][coupon]", coupon);
    body.append("client_reference_id", org_id);
    body.append("payment_method_collection", "always");
    body.append("success_url", `${base}/?payment_success=1`);
    body.append("cancel_url", `${base}/?payment_cancelled=1`);
    body.append("metadata[org_id]", org_id);
    body.append("metadata[type]", kind);
    if (isFounding) {
      body.append("subscription_data[metadata][founding]", "true");
      body.append("subscription_data[metadata][rate_lock]", "perpetuity");
    } else {
      body.append("subscription_data[metadata][discount_label]", org.assigned_discount_label || "");
      body.append("subscription_data[metadata][discount_percent]", String(org.assigned_discount_percent));
    }
    if (trialEnd) body.append("subscription_data[trial_end]", String(trialEnd));
    if (org.stripe_customer_id) body.append("customer", org.stripe_customer_id);
    else if (org.email) body.append("customer_email", org.email);

    const { ok, json: session } = await stripe("checkout/sessions", STRIPE_KEY, body);
    if (!ok) throw new Error(`Stripe error: ${session.error?.message ?? JSON.stringify(session)}`);

    console.log(`founding-checkout: session ${session.id} for org ${org_id} (${org.name}) coupon=${coupon} kind=${kind} trial_end=${trialEnd ?? "none"}`);
    return new Response(JSON.stringify({ ok: true, checkout_url: session.url, session_id: session.id }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("founding-checkout error:", String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
