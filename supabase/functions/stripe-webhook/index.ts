import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const STRIPE_KEY     = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_EMAIL    = "theatre4u1@gmail.com";
const FROM_EMAIL     = "Theatre4u Alerts <hello@theatre4u.org>";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ArtsTracker (all-departments) tiers map to the same BEHAVIOR plan as the single-vertical
// tiers (so the app's plan gates keep working) PLUS allVerticals:true, which tells this
// webhook to unlock all five departments via verticals_enabled.
const ALL_VERTICALS = ["theatre", "music", "dance", "art", "booster"];

const PRICE_TO_PLAN: Record<string, { plan: string; interval: string; allVerticals?: boolean }> = {
  "price_1TPSjgBRkceXoRsJLTvsknvy": { plan: "pro",        interval: "monthly" },
  "price_1TPSk1BRkceXoRsJ3k27ZRuW": { plan: "pro",        interval: "annual"  },
  "price_1TADqIBRkceXoRsJ9ew0pIjX": { plan: "pro",        interval: "monthly" },
  "price_1TADqMBRkceXoRsJOGoCrUIf": { plan: "pro",        interval: "annual"  },
  "price_1TADqHBRkceXoRsJcnaHIRCr": { plan: "district",   interval: "monthly" },
  "price_1TADqKBRkceXoRsJidQakjJI": { plan: "district",   interval: "annual"  },
  "price_1TOMWnBRkceXoRsJJVq1ppb2": { plan: "district_m", interval: "monthly" },
  "price_1TOMXVBRkceXoRsJfWHNG6rE": { plan: "district_m", interval: "annual"  },
  "price_1TOMaWBRkceXoRsJSFOaZFMB": { plan: "district_l", interval: "monthly" },
  "price_1TOMaxBRkceXoRsJx5edoUkf": { plan: "district_l", interval: "annual"  },
  // ── ArtsTracker (all-departments) tiers — created 2026-06-07, livemode ──
  "price_1TfrzJBRkceXoRsJYNg2Qrsp": { plan: "pro",        interval: "monthly", allVerticals: true },
  "price_1TfrzKBRkceXoRsJs9TTkk4U": { plan: "pro",        interval: "annual",  allVerticals: true },
  "price_1TfrzLBRkceXoRsJrBa3eMDH": { plan: "district",   interval: "monthly", allVerticals: true },
  "price_1TfrzMBRkceXoRsJIHS8yBBw": { plan: "district",   interval: "annual",  allVerticals: true },
  "price_1TfrzNBRkceXoRsJVEbhqItx": { plan: "district_m", interval: "monthly", allVerticals: true },
  "price_1TfrzOBRkceXoRsJ4QjUC7gb": { plan: "district_m", interval: "annual",  allVerticals: true },
  "price_1TfrzOBRkceXoRsJ7ACTOIXx": { plan: "district_l", interval: "monthly", allVerticals: true },
  "price_1TfrzPBRkceXoRsJ3OXj3Kg7": { plan: "district_l", interval: "annual",  allVerticals: true },
};

// Stripe moved current_period_end/start onto the subscription ITEM in recent API versions.
// Read the subscription-level field first, then fall back to the first item.
function periodEndsFromSub(sub: Record<string, unknown>): { start: number | null; end: number | null } {
  const item = (((sub.items as Record<string, unknown>)?.data as Record<string, unknown>[] | undefined)?.[0]) ?? undefined;
  const end   = (sub.current_period_end   ?? item?.current_period_end   ?? null) as number | null;
  const start = (sub.current_period_start ?? item?.current_period_start ?? null) as number | null;
  return { start, end };
}

// Safe helper to extract price ID from subscription data
function extractPriceId(data: Record<string, unknown>): string | undefined {
  try {
    const items = data.items as Record<string, unknown> | undefined;
    const itemsData = items?.data as Record<string, unknown>[] | undefined;
    const firstItem = itemsData?.[0] as Record<string, unknown> | undefined;
    const price = firstItem?.price as Record<string, unknown> | undefined;
    return price?.id as string | undefined;
  } catch {
    return undefined;
  }
}

async function sendPaymentAlert(params: {
  eventType: string; orgName: string; orgEmail: string;
  plan: string; interval: string; amountCents: number;
  isRefund?: boolean; isFailed?: boolean;
}) {
  if (!RESEND_KEY) return;
  const amount = "$" + (params.amountCents / 100).toFixed(2);
  const emoji = params.isFailed ? "🔴" : params.isRefund ? "🔄" : "💳";
  const status = params.isFailed ? "PAYMENT FAILED" : params.isRefund ? "REFUND" : "NEW PAYMENT";
  const bgColor = params.isFailed ? "#fdf0f0" : params.isRefund ? "#fff9e6" : "#f0faf2";
  const borderColor = params.isFailed ? "#e8b4b4" : params.isRefund ? "#f0d090" : "#a8d8b4";
  const statusColor = params.isFailed ? "#8c1a2a" : params.isRefund ? "#8b6914" : "#2d6e3a";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff">
  <div style="background:#1a1200;padding:18px 24px"><span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#d4a843">${emoji} Theatre4u Payment Alert</span></div>
  <div style="padding:22px 24px">
    <div style="background:${bgColor};border:1.5px solid ${borderColor};border-radius:8px;padding:14px 18px;margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${statusColor};margin-bottom:4px">${status}</div>
      <div style="font-size:28px;font-weight:700;color:#1a1200">${amount}</div>
    </div>
    <table cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
      <tr style="background:#f5f0e8"><td style="color:#666;width:100px;padding:7px 10px">Program</td><td style="font-weight:700;padding:7px 10px">${params.orgName}</td></tr>
      <tr><td style="color:#666;padding:7px 10px">Email</td><td style="padding:7px 10px"><a href="mailto:${params.orgEmail}" style="color:#8b6914">${params.orgEmail}</a></td></tr>
      <tr style="background:#f5f0e8"><td style="color:#666;padding:7px 10px">Plan</td><td style="padding:7px 10px">${params.plan} · ${params.interval}</td></tr>
      <tr><td style="color:#666;padding:7px 10px">Event</td><td style="padding:7px 10px;font-size:12px;color:#888">${params.eventType}</td></tr>
    </table>
  </div>
  <div style="padding:10px 24px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">Theatre4u™ · Artstracker LLC</div>
</div></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL],
      subject: `${emoji} ${status}: ${params.orgName} — ${amount} (${params.plan} ${params.interval})`, html }),
  }).catch((e: Error) => console.error("sendPaymentAlert:", e.message));
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = sigHeader.split(",");
    const timestamp = parts.find(p => p.startsWith("t="))?.slice(2);
    const sig = parts.find(p => p.startsWith("v1="))?.slice(3);
    if (!timestamp || !sig) return false;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2,"0")).join("");
    return expected === sig;
  } catch {
    return false;
  }
}

async function findOrg(customerId?: string, email?: string, orgId?: string): Promise<{ id: string; name: string; email: string; vertical: string } | null> {
  try {
    if (orgId) {
      const { data } = await sb.from("orgs").select("id,name,email,vertical").eq("id", orgId).single();
      if (data) return data;
    }
    if (customerId) {
      const { data } = await sb.from("orgs").select("id,name,email,vertical").eq("stripe_customer_id", customerId).single();
      if (data) return data;
    }
    if (email) {
      const { data } = await sb.from("orgs").select("id,name,email,vertical").eq("email", email.toLowerCase().trim()).single();
      if (data) return data;
    }
    return null;
  } catch {
    return null;
  }
}

async function logPayment(params: Record<string, unknown>) {
  try {
    await sb.from("stripe_payments").upsert(params, { onConflict: "stripe_event_id", ignoreDuplicates: false });
  } catch (e) {
    console.error("logPayment error:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload = "";
  try { payload = await req.text(); } catch { return new Response("Bad request", { status: 400 }); }

  const sigHeader = req.headers.get("stripe-signature") ?? "";
  if (!WEBHOOK_SECRET) return new Response("Webhook secret not configured", { status: 500 });

  const valid = await verifyStripeSignature(payload, sigHeader, WEBHOOK_SECRET);
  if (!valid) { console.error("Invalid Stripe signature"); return new Response("Invalid signature", { status: 400 }); }

  let event: Record<string, unknown>;
  try { event = JSON.parse(payload); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const eventType = event.type as string;
  const eventId   = event.id as string;
  const data      = ((event.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>;
  console.log("Stripe event:", eventType, eventId);

  // Wrap entire handler in try/catch so we always return 200
  // A non-200 response causes Stripe to retry endlessly
  try {
    switch (eventType) {

      case "checkout.session.completed": {
        const meta          = (data.metadata ?? {}) as Record<string, string>;
        const customerEmail = ((data.customer_details as Record<string,unknown>)?.email ?? data.customer_email ?? "") as string;
        const customerId    = (data.customer ?? "") as string;
        const clientRef     = (data.client_reference_id ?? null) as string | null;

        if (data.mode === "payment" && meta?.type === "label_order") {
          const org = await findOrg(undefined, undefined, meta?.org_id);
          await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
            stripe_customer_id: customerId, stripe_payment_intent: data.payment_intent,
            amount_cents: data.amount_total, currency: "usd", status: "succeeded",
            description: "Label order", customer_email: customerEmail,
            org_id: org?.id ?? null, org_name: org?.name ?? null,
            stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });
          break;
        }

        if (data.mode !== "subscription") {
          await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
            stripe_customer_id: customerId, status: "succeeded", customer_email: customerEmail,
            amount_cents: data.amount_total, description: "Checkout",
            stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });
          break;
        }

        const subscriptionId = (data.subscription ?? "") as string;
        let planInfo: { plan: string; interval: string; allVerticals?: boolean } | undefined;
        let priceId: string | undefined;
        let periodEnd: number | null = null;
        let periodStart: number | null = null;
        let subAmountCents = (data.amount_total as number) || 0;

        if (STRIPE_KEY && subscriptionId) {
          try {
            const subRes = await fetch("https://api.stripe.com/v1/subscriptions/" + subscriptionId,
              { headers: { "Authorization": "Bearer " + STRIPE_KEY } });
            if (subRes.ok) {
              const sub = await subRes.json();
              priceId = sub?.items?.data?.[0]?.price?.id;
              planInfo = priceId ? PRICE_TO_PLAN[priceId] : undefined;
              const pe = periodEndsFromSub(sub as Record<string, unknown>);
              periodEnd = pe.end;
              periodStart = pe.start;
              subAmountCents = subAmountCents || (sub?.items?.data?.[0]?.price?.unit_amount ?? 0);
            }
          } catch (e) { console.error("Failed to fetch subscription:", e); }
        }

        const org = await findOrg(customerId, customerEmail, clientRef || undefined);

        await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
          stripe_customer_id: customerId, stripe_subscription_id: subscriptionId,
          amount_cents: subAmountCents, currency: "usd", status: "succeeded",
          description: "Subscription created - " + (planInfo?.plan ?? "unknown") + (planInfo?.allVerticals ? " (ArtsTracker)" : ""),
          plan: planInfo?.plan, plan_interval: planInfo?.interval, price_id: priceId,
          customer_email: customerEmail, org_id: org?.id ?? null, org_name: org?.name ?? null,
          period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });

        if (org && planInfo) {
          const isAnnual = planInfo.interval === "annual";
          await sb.from("orgs").update({
            plan: planInfo.plan, plan_interval: planInfo.interval,
            subscription_status: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_expires_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            temp_pro: false,
            points_eligible_date: isAnnual ? new Date().toISOString() : new Date(Date.now() + 90*24*60*60*1000).toISOString(),
            // ArtsTracker tiers unlock all five departments; single-vertical tiers leave verticals_enabled untouched.
            ...(planInfo.allVerticals ? { verticals_enabled: ALL_VERTICALS } : {}),
          }).eq("id", org.id);
          if (isAnnual) await sb.rpc("award_milestone_points", { p_org_id: org.id, p_type: "annual_bonus", p_amount: 300, p_desc: "Annual plan bonus" }).catch(() => {});
          await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
            plan: planInfo.plan + (planInfo.allVerticals ? " (ArtsTracker)" : ""), interval: planInfo.interval, amountCents: subAmountCents });
        } else if (!planInfo) {
          console.warn("Unknown price ID:", priceId);
        } else if (!org) {
          console.error("No org found for customer:", customerId, customerEmail);
        }
        break;
      }

      case "customer.subscription.updated": {
        const customerId     = (data.customer ?? "") as string;
        const subscriptionId = (data.id ?? "") as string;
        const status         = (data.status ?? "unknown") as string;
        const cancelAt       = (data.cancel_at ?? null) as number | null;
        const periodEnd      = periodEndsFromSub(data).end ?? 0;
        const priceId        = extractPriceId(data);
        const planInfo       = priceId ? PRICE_TO_PLAN[priceId] : undefined;
        const org            = await findOrg(customerId);

        await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
          stripe_customer_id: customerId, stripe_subscription_id: subscriptionId,
          status, description: "Subscription updated: " + status,
          plan: planInfo?.plan, plan_interval: planInfo?.interval, price_id: priceId,
          org_id: org?.id ?? null, org_name: org?.name ?? null,
          period_end: cancelAt ? new Date(cancelAt * 1000).toISOString() : new Date(periodEnd * 1000).toISOString(),
          stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });

        if (org) {
          const updates: Record<string, unknown> = {
            subscription_status: status,
            stripe_subscription_id: subscriptionId,
            plan_expires_at: cancelAt ? new Date(cancelAt * 1000).toISOString() : new Date(periodEnd * 1000).toISOString(),
          };
          if (planInfo) { updates.plan = planInfo.plan; updates.plan_interval = planInfo.interval; }
          if (planInfo?.allVerticals) updates.verticals_enabled = ALL_VERTICALS;
          await sb.from("orgs").update(updates).eq("id", org.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = (data.customer ?? "") as string;
        const periodEnd  = periodEndsFromSub(data).end ?? 0;
        const org        = await findOrg(customerId);

        await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
          stripe_customer_id: customerId, stripe_subscription_id: data.id,
          status: "canceled", description: "Subscription canceled",
          org_id: org?.id ?? null, org_name: org?.name ?? null,
          period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });

        if (org) {
          await sb.from("orgs").update({
            plan: "free", plan_interval: "monthly", subscription_status: "canceled",
            stripe_subscription_id: null,
            plan_expires_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            // Revoke extra departments on cancellation — back to the home department only.
            verticals_enabled: [org.vertical || "theatre"],
          }).eq("id", org.id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const customerId = (data.customer ?? "") as string;
        const org        = await findOrg(customerId);
        const isRenewal  = data.billing_reason === "subscription_cycle";
        const total      = (data.total ?? 0) as number;

        await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
          stripe_customer_id: customerId, stripe_subscription_id: data.subscription,
          stripe_invoice_id: data.id, stripe_payment_intent: data.payment_intent,
          amount_cents: total, currency: "usd", status: "succeeded",
          description: isRenewal ? "Subscription renewal" : "Invoice paid",
          customer_email: data.customer_email, org_id: org?.id ?? null, org_name: org?.name ?? null,
          period_start: data.period_start ? new Date((data.period_start as number) * 1000).toISOString() : null,
          period_end: data.period_end ? new Date((data.period_end as number) * 1000).toISOString() : null,
          stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });

        if (org) {
          await sb.from("orgs").update({ subscription_status: "active" }).eq("id", org.id);
          if (isRenewal) {
            if (total >= 15000) await sb.rpc("award_milestone_points", { p_org_id: org.id, p_type: "annual_renewal_bonus", p_amount: 300, p_desc: "Annual renewal bonus" }).catch(() => {});
            await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
              plan: "renewal", interval: "", amountCents: total });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const customerId = (data.customer ?? "") as string;
        const org        = await findOrg(customerId);
        const amountDue  = (data.amount_due ?? 0) as number;

        await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
          stripe_customer_id: customerId, stripe_subscription_id: data.subscription,
          stripe_invoice_id: data.id, amount_cents: amountDue, currency: "usd",
          status: "failed", description: "Payment failed",
          customer_email: data.customer_email, org_id: org?.id ?? null, org_name: org?.name ?? null,
          stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });

        if (org) {
          await sb.from("orgs").update({ subscription_status: "past_due" }).eq("id", org.id);
          await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
            plan: "unknown", interval: "", amountCents: amountDue, isFailed: true });
        }
        break;
      }

      case "charge.refunded": {
        const customerId  = (data.customer ?? "") as string;
        const org         = await findOrg(customerId);
        const refundsData = ((data.refunds as Record<string,unknown>)?.data ?? []) as Record<string,unknown>[];
        const latest      = refundsData[0];
        const refundAmt   = latest ? (latest.amount as number) : (data.amount_refunded as number ?? 0);

        await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
          stripe_customer_id: customerId, stripe_payment_intent: data.payment_intent,
          amount_cents: data.amount, currency: "usd", status: "refunded",
          description: "Charge refunded", org_id: org?.id ?? null, org_name: org?.name ?? null,
          refunded: true,
          refunded_at: latest ? new Date((latest.created as number) * 1000).toISOString() : new Date().toISOString(),
          refund_amount_cents: refundAmt,
          stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });

        if (org) {
          await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
            plan: "refund", interval: "", amountCents: refundAmt, isRefund: true });
        }
        break;
      }

      default:
        console.log("Unhandled Stripe event:", eventType);
    }
  } catch (e) {
    // Log the error but return 200 so Stripe doesn't retry endlessly
    console.error("Webhook handler error:", String(e));
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
});
