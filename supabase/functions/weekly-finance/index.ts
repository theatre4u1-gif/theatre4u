// weekly-finance v1 — server-side weekly finance update for Artstracker LLC.
// Replaces the unreliable Claude scheduled task. Two steps, both server-side:
//   1) Auto-book each CLOSED month's net Stripe revenue into business_ledger (income), from Sep 2026.
//   2) Email a reminder digest to admin@theatre4u.org: income booked, this month's expenses so far,
//      and which recurring vendors have not been logged yet (expenses can't be read from email
//      server-side, so Bob adds those receipts in admin.artstracker).
// Triggered by pg_cron "theatre4u-weekly-finance" Mondays at 15:00 UTC (8am Pacific). Deployed live
// 2026-08-30 (verify_jwt false). SQL: public.import_stripe_income_to_ledger() + public.get_finance_digest()
// (migration weekly_finance_functions). Test without sending: GET .../functions/v1/weekly-finance?dry=1
// STYLE: no hyphens or dashes anywhere in the copy (Bob's preference).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const money = (c: number) => (c < 0 ? '-$' : '$') + (Math.abs(Math.round(c || 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (iso: string) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(iso + 'T00:00:00Z')); } catch { return iso; } };

const p = (t: string, extra = '') => `<p style="font-size:14px;color:#3a3a3a;line-height:1.6;margin:0 0 10px;${extra}">${t}</p>`;
const h = (t: string) => `<div style="font-size:12px;font-weight:800;color:#8a8272;text-transform:uppercase;letter-spacing:.5px;margin:22px 0 8px">${t}</div>`;

function compose(d: any, importedNow: number): { subject: string; html: string; text: string } {
  const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric' }).format(new Date());
  const exp = d.month_expenses || [];
  const missing = d.recurring_missing || [];
  const mtdNet = (d.mtd_income_cents || 0) - (d.mtd_expense_cents || 0);

  const headline = importedNow > 0
    ? `Booked Stripe revenue for ${importedNow} closed month${importedNow === 1 ? '' : 's'}. Month to date net is ${money(mtdNet)}.`
    : `Nothing new to book this week. Month to date net is ${money(mtdNet)}.`;

  let incHtml = p(`Income booked this month: <strong>${money(d.mtd_income_cents)}</strong>.`);
  incHtml += p(`Stripe revenue so far this month: <strong>${money(d.stripe_month_net_cents)}</strong>. This books to the ledger automatically once the month closes.`, 'color:#6b6459');

  let expHtml = p(`${exp.length} expense${exp.length === 1 ? '' : 's'} logged this month, totalling <strong>${money(d.mtd_expense_cents)}</strong>.`);
  if (exp.length) {
    expHtml += '<ul style="margin:0 0 10px;padding-left:18px">' + exp.map((e: any) => `<li style="font-size:13.5px;color:#3a3a3a;line-height:1.7">${fmtD(e.date)}, ${e.note || e.category || 'expense'}, <strong>${money(e.amount_cents)}</strong></li>`).join('') + '</ul>';
  }

  let remHtml: string;
  if (missing.length) {
    remHtml = p(`<strong style="color:#c07a00">Not logged yet this month:</strong> ${missing.join(', ')}. Add the receipts in admin.artstracker if they have been charged.`);
  } else {
    remHtml = p('All recurring vendors (Supabase, Vercel, Resend, Canva) are logged this month.');
  }
  remHtml += p('Anthropic and Claude usage is variable, so check that billing page if you expect a charge.', 'color:#9a9284;font-size:12.5px');

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;color:#2a2a2a">`
    + `<div style="font-size:12px;color:#8a8272;text-transform:uppercase;letter-spacing:.5px">Theatre4u weekly finance</div>`
    + `<div style="font-size:12px;color:#9a9284;margin-bottom:14px">${fmtDay}</div>`
    + `<div style="font-size:16px;font-weight:800;line-height:1.5;margin:0 0 6px">${headline}</div>`
    + h('Income') + incHtml
    + h('Expenses this month') + expHtml
    + h('Recurring to check') + remHtml
    + `<div style="text-align:center;margin:22px 0 8px"><a href="https://admin.artstracker.org" style="display:inline-block;background:#c4922a;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Open Money, then Bookkeeping</a></div>`
    + `<div style="font-size:11px;color:#b3ab9d;border-top:1px solid #eee;margin-top:16px;padding-top:10px">Income posts automatically once each month closes. Expenses are added by you from the receipts, since email cannot be read from the server. All time net so far: ${money((d.alltime_income_cents || 0) - (d.alltime_expense_cents || 0))}.</div>`
    + `</div>`;

  const text = [
    `Theatre4u weekly finance, ${fmtDay}`, '', headline, '',
    `Income booked this month: ${money(d.mtd_income_cents)}. Stripe so far this month (books at close): ${money(d.stripe_month_net_cents)}.`,
    `Expenses this month: ${exp.length}, total ${money(d.mtd_expense_cents)}.`,
    ...exp.map((e: any) => `  ${fmtD(e.date)}, ${e.note || e.category}, ${money(e.amount_cents)}`),
    '', missing.length ? `Not logged yet this month: ${missing.join(', ')}.` : 'All recurring vendors logged this month.',
    `All time net: ${money((d.alltime_income_cents || 0) - (d.alltime_expense_cents || 0))}.`,
  ].join('\n');

  return { subject: `Theatre4u weekly finance, ${fmtDay}`, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  const KEY = Deno.env.get('RESEND_API_KEY');
  const SB = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  try {
    let importedNow = 0;
    if (!dry) {
      const { data: imp, error: impErr } = await SB.rpc('import_stripe_income_to_ledger');
      if (impErr) throw impErr;
      importedNow = Number(imp) || 0;
    }
    const { data, error } = await SB.rpc('get_finance_digest');
    if (error) throw error;
    const { subject, html, text } = compose(data, importedNow);
    if (dry) return new Response(JSON.stringify({ ok: true, dry: true, subject, importedNow, data, html }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    if (!KEY) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Theatre4u <hello@theatre4u.org>', reply_to: 'hello@theatre4u.org', to: ['admin@theatre4u.org'], subject, html, text }),
    });
    const dd = await res.json();
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(dd)}`);
    console.log(`weekly-finance sent, imported ${importedNow}, resend id ${dd.id}`);
    return new Response(JSON.stringify({ ok: true, importedNow, resend_id: dd.id, subject }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
