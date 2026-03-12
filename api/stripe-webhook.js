// api/stripe-webhook.js  —  Vercel serverless function
// Receives Stripe events and updates orgs.plan in Supabase
//
// ENV VARS needed in Vercel dashboard:
//   STRIPE_SECRET_KEY        = sk_test_... (or sk_live_... for production)
//   STRIPE_WEBHOOK_SECRET    = whsec_...  (from Stripe Dashboard → Webhooks)
//   SUPABASE_URL             = https://ldmmphwivnnboyhlxipl.supabase.co
//   SUPABASE_SERVICE_KEY     = (service_role key from Supabase → Settings → API)

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SB = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service role — bypasses RLS for server-side writes
);

// Map Stripe price IDs → plan names
const PRICE_TO_PLAN = {
  "price_1T9Y1xPjTjwyVPK63JPO1IUV": "pro",      // Pro monthly
  "price_1TAAuMPjTjwyVPK6rIcBGqQ0": "pro",      // Pro annual
  "price_1T9Y2pPjTjwyVPK69DGxiSTV": "district", // District monthly
  "price_1TAAw3PjTjwyVPK6LRjkYZIM": "district", // District annual
};

export const config = { api: { bodyParser: false } }; // Stripe needs raw body

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end",  ()    => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // Verify Stripe signature
  const rawBody = await getRawBody(req);
  const sig     = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Helper: update org plan by stripe customer ID
  async function setPlan(customerId, plan, subscriptionId = null, expiresAt = null) {
    const update = { plan, stripe_customer_id: customerId };
    if (subscriptionId) update.stripe_subscription_id = subscriptionId;
    if (expiresAt)      update.plan_expires_at = expiresAt;
    const { error } = await SB.from("orgs").update(update).eq("stripe_customer_id", customerId);
    if (error) {
      // Customer ID may not be stored yet — look up by subscription metadata
      console.error("setPlan error:", error);
    }
  }

  // Helper: get plan from subscription object
  function planFromSubscription(subscription) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    return PRICE_TO_PLAN[priceId] || "free";
  }

  try {
    switch (event.type) {

      // ── Checkout completed — first payment ───────────────────────────────────
      case "checkout.session.completed": {
        const session      = event.data.object;
        const customerId   = session.customer;
        const customerEmail= session.customer_details?.email;
        const subId        = session.subscription;

        // Fetch the subscription to get the price ID
        if (subId) {
          const sub  = await stripe.subscriptions.retrieve(subId);
          const plan = planFromSubscription(sub);
          const exp  = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;

          // Try update by customer ID first, fall back to email
          const { data, error } = await SB.from("orgs")
            .update({ plan, stripe_customer_id: customerId, stripe_subscription_id: subId, plan_expires_at: exp })
            .eq("stripe_customer_id", customerId)
            .select();

          if (error || !data?.length) {
            // First time — match by email
            await SB.from("orgs")
              .update({ plan, stripe_customer_id: customerId, stripe_subscription_id: subId, plan_expires_at: exp })
              .eq("email", customerEmail);
          }
        }
        break;
      }

      // ── Subscription updated (upgrade/downgrade) ──────────────────────────────
      case "customer.subscription.updated": {
        const sub  = event.data.object;
        const plan = planFromSubscription(sub);
        const exp  = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await setPlan(sub.customer, plan, sub.id, exp);
        break;
      }

      // ── Subscription cancelled / payment failed ───────────────────────────────
      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const obj = event.data.object;
        const customerId = obj.customer;
        await setPlan(customerId, "free", null, null);
        break;
      }

      // ── Invoice paid — renews subscription ────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const sub  = await stripe.subscriptions.retrieve(invoice.subscription);
          const plan = planFromSubscription(sub);
          const exp  = new Date(sub.current_period_end * 1000).toISOString();
          await setPlan(invoice.customer, plan, sub.id, exp);
        }
        break;
      }

      default:
        // Ignore other events
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: err.message });
  }
}
