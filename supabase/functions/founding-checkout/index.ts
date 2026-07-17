// founding-checkout — creates a Stripe subscription Checkout Session for a FOUNDING member
// with the $9.99 founding coupon pre-applied. Verifies founding_member server-side (leak-proof).
// Card is collected now, but the first charge is deferred to Sept 1, 2026 (billing start) via a
// trial_end — so founding members are NOT billed until Sept 1. Called from core/billing.jsx.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRO_PRICE = "price_1TPSjgBRkceXoRsJLTvsknvy";  // real Theatre4u Pro monthly ($15) => plan maps to pro
const FOUNDING_COUPON = "Wc5L1HD0";                 // $5.01 off, forever => $9.99/mo locked
const BILLING_START = 1788220800;                   // 2026-09-01T00:00:00Z — first charge deferred to here

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

    // Server-side gate: only a flagged founding member gets the founding checkout.
    const { data: org, error: orgErr } = await SB.from("orgs")
      .select("name,email,founding_member,founding_rate_plan,stripe_customer_id")
      .eq("id", org_id).single();
    if (orgErr || !org) throw new Error("Org not found");
    if (org.founding_member !== true) {
      return new Response(JSON.stringify({ ok: false, error: "not_founding" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const base = (typeof origin === "string" && /^https:\/\//.test(origin))
      ? origin.replace(/\/$/, "")
      : "https://theatre4u.org";

    // Defer first charge to Sept 1 (unless that date has already passed, then bill normally).
    const now = Math.floor(Date.now() / 1000);
    const trialEnd = BILLING_START > now + 172800 ? BILLING_START : undefined; // needs >48h future

    const body = new URLSearchParams();
    body.append("mode", "subscription");
    body.append("line_items[0][price]", PRO_PRICE);
    body.append("line_items[0][quantity]", "1");
    body.append("discounts[0][coupon]", FOUNDING_COUPON);
    body.append("client_reference_id", org_id); // webhook maps subscription -> org by this
    body.append("payment_method_collection", "always"); // collect card now even though $0 until Sept 1
    body.append("success_url", `${base}/?payment_success=1`);
    body.append("cancel_url", `${base}/?payment_cancelled=1`);
    body.append("metadata[org_id]", org_id);
    body.append("metadata[type]", "founding_subscription");
    body.append("subscription_data[metadata][founding]", "true");
    body.append("subscription_data[metadata][rate_lock]", "perpetuity");
    if (trialEnd) body.append("subscription_data[trial_end]", String(trialEnd));
    if (org.stripe_customer_id) body.append("customer", org.stripe_customer_id);
    else if (org.email) body.append("customer_email", org.email);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) throw new Error(`Stripe error: ${session.error?.message ?? JSON.stringify(session)}`);

    console.log(`founding-checkout: session ${session.id} for org ${org_id} (${org.name}) trial_end=${trialEnd ?? "none"}`);
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
