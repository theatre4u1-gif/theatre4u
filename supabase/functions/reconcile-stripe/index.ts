// reconcile-stripe — daily safety net for revenue accuracy.
// Lists PAID Stripe invoices for a rolling window and compares them to stripe_payments.
// If an invoice is missing from our records:
//   * paid more than 4 days ago (past Stripe's own retry window) => auto-backfill it,
//   * paid within the last 4 days => flag only (Stripe may still redeliver the webhook).
// Idempotent: backfill rows key on stripe_event_id 'reconcile_<invoiceId>' and upsert.
// Emails the admin a summary only when there is something to report. Read-only against Stripe.
// Scheduled by pg_cron job 'theatre4u-reconcile-stripe' (daily 14:30 UTC).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY   = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const ADMIN_EMAIL  = "theatre4u1@gmail.com";
const FROM_EMAIL   = "Theatre4u Alerts <hello@theatre4u.org>";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const WINDOW_DAYS = 45;
const SETTLE_DAYS = 4; // only auto-backfill invoices older than this (past Stripe retry window)

async function stripeGet(path: string): Promise<Record<string, any>> {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    headers: { "Authorization": "Bearer " + STRIPE_KEY },
  });
  return await res.json();
}

async function findOrg(customerId?: string, email?: string) {
  if (customerId) {
    const { data } = await sb.from("orgs").select("id,name,is_internal").eq("stripe_customer_id", customerId).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await sb.from("orgs").select("id,name,is_internal").eq("email", email.toLowerCase().trim()).maybeSingle();
    if (data) return data;
  }
  return null;
}

// Does a stripe_payments row already represent this invoice's payment?
async function alreadyLogged(inv: Record<string, any>): Promise<boolean> {
  // 1) exact invoice id match (renewal rows carry it)
  const byInv = await sb.from("stripe_payments").select("id").eq("stripe_invoice_id", inv.id).limit(1);
  if ((byInv.data?.length ?? 0) > 0) return true;
  // 2) first-charge rows (from checkout.session.completed) do not store the invoice id,
  //    so match on same customer + same amount + same calendar day (bias toward skipping).
  const paidAt = (inv.status_transitions?.paid_at ?? inv.created) as number;
  const dayStart = new Date((paidAt - 86400) * 1000).toISOString();
  const dayEnd   = new Date((paidAt + 86400) * 1000).toISOString();
  const byMatch = await sb.from("stripe_payments").select("id")
    .eq("stripe_customer_id", inv.customer)
    .eq("amount_cents", inv.amount_paid)
    .eq("status", "succeeded")
    .gte("stripe_created_at", dayStart).lte("stripe_created_at", dayEnd).limit(1);
  return (byMatch.data?.length ?? 0) > 0;
}

async function sendSummary(backfilled: string[], pending: string[]) {
  if (!RESEND_KEY) return;
  const rows = (label: string, arr: string[]) => arr.length
    ? `<p style="margin:12px 0 4px;font-weight:700">${label} (${arr.length})</p><ul style="margin:0;padding-left:18px;font-size:13px;color:#444">${arr.map(a=>`<li>${a}</li>`).join("")}</ul>`
    : "";
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff">
  <div style="background:#1a1200;padding:18px 24px"><span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#d4a843">🧾 Revenue Reconcile</span></div>
  <div style="padding:22px 24px">
    <p style="font-size:14px;color:#333">The daily Stripe reconcile found payments that were not in our records.</p>
    ${rows("Auto backfilled (older than 4 days, now added to revenue)", backfilled)}
    ${rows("Flagged, still within Stripe's retry window (not added yet)", pending)}
    <p style="font-size:12px;color:#888;margin-top:16px">Backfilled rows are marked 'Reconciled from Stripe' in stripe_payments. Nothing was changed in Stripe.</p>
  </div>
  <div style="padding:10px 24px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">Theatre4u™ · Artstracker LLC</div>
</div></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL],
      subject: `🧾 Revenue reconcile: ${backfilled.length} backfilled, ${pending.length} flagged`, html }),
  }).catch(() => {});
}

Deno.serve(async (_req: Request) => {
  if (!STRIPE_KEY) return new Response(JSON.stringify({ ok:false, error:"no stripe key" }), { status: 500 });
  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOW_DAYS * 86400;
  const settleCutoff = now - SETTLE_DAYS * 86400;

  const backfilled: string[] = [];
  const pending: string[] = [];
  let scanned = 0;

  try {
    let startingAfter = "";
    for (let page = 0; page < 20; page++) { // up to 2000 invoices
      const q = `invoices?status=paid&limit=100&created[gte]=${since}` + (startingAfter ? `&starting_after=${startingAfter}` : "");
      const list = await stripeGet(q);
      const items = (list.data ?? []) as Record<string, any>[];
      if (items.length === 0) break;
      for (const inv of items) {
        scanned++;
        const amount = inv.amount_paid as number;
        if (!amount || amount <= 0) continue;              // skip $0 (trials / fully discounted)
        if (await alreadyLogged(inv)) continue;           // already captured
        const paidAt = (inv.status_transitions?.paid_at ?? inv.created) as number;
        const org = await findOrg(inv.customer as string, inv.customer_email as string | undefined);
        if (org?.is_internal) continue;                   // internal/test accounts never count
        const who = (org?.name ?? inv.customer_email ?? inv.customer) + " · $" + (amount/100).toFixed(2) + " · " + new Date(paidAt*1000).toISOString().slice(0,10);
        if (paidAt > settleCutoff) { pending.push(who); continue; } // too recent — let Stripe retry
        // Backfill (idempotent on the reconcile event id).
        await sb.from("stripe_payments").upsert({
          stripe_event_id: "reconcile_" + inv.id,
          stripe_event_type: "invoice.paid",
          stripe_customer_id: inv.customer,
          stripe_subscription_id: inv.subscription ?? null,
          stripe_invoice_id: inv.id,
          amount_cents: amount, currency: inv.currency ?? "usd", status: "succeeded",
          description: "Reconciled from Stripe (webhook missed this invoice)",
          customer_email: inv.customer_email ?? null,
          org_id: org?.id ?? null, org_name: org?.name ?? null,
          period_start: inv.period_start ? new Date(inv.period_start*1000).toISOString() : null,
          period_end: inv.period_end ? new Date(inv.period_end*1000).toISOString() : null,
          stripe_created_at: new Date(paidAt*1000).toISOString(),
        }, { onConflict: "stripe_event_id", ignoreDuplicates: false });
        backfilled.push(who);
      }
      if (!list.has_more) break;
      startingAfter = items[items.length - 1].id;
    }

    if (backfilled.length || pending.length) await sendSummary(backfilled, pending);
    console.log(`reconcile-stripe: scanned=${scanned} backfilled=${backfilled.length} pending=${pending.length}`);
    return new Response(JSON.stringify({ ok:true, scanned, backfilled, pending }), {
      headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("reconcile-stripe error:", String(e));
    return new Response(JSON.stringify({ ok:false, error:String(e), backfilled, pending }), { status: 500 });
  }
});
