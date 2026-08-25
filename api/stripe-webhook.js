// api/stripe-webhook.js — DEPRECATED / DISABLED.
//
// The live Stripe webhook is the Supabase edge function `stripe-webhook`
// (supabase/functions/stripe-webhook). This Vercel endpoint carried an OLD price->plan
// map and could mis-provision paying customers if Stripe were ever pointed at it, so it is
// disabled: it processes nothing and returns 410 Gone.
//
// TODO (Bob): delete this file entirely and confirm the Stripe Dashboard webhook points
// ONLY at https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/stripe-webhook.

export const config = { api: { bodyParser: false } };

export default function handler(_req, res) {
  res.status(410).json({ error: "Gone. This webhook endpoint is deprecated; use the Supabase edge function." });
}
