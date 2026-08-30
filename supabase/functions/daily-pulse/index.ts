// daily-pulse v1 — server-side launch pulse for Theatre4u / ArtsTracker.
// Replaces the scheduled Claude run. Pulls all metrics from the DB via get_daily_pulse(),
// formats a short mobile friendly email, and sends it through Resend to admin@theatre4u.org.
// Triggered by pg_cron daily at 13:00 UTC (6am Pacific). Read only plus one email send.
// STYLE: no hyphens or dashes anywhere in the copy (Bob's preference).
//
// Deployed live 2026-08-30 (verify_jwt false). Scheduled by pg_cron job "theatre4u-daily-pulse"
// (0 13 * * *) which calls this function via net.http_post. The metric SQL lives in the
// public.get_daily_pulse() function (migration get_daily_pulse_function). Test without sending:
//   GET .../functions/v1/daily-pulse?dry=1
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const money = (c: number) => '$' + (Math.round((c || 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const p = (t: string, extra = '') => `<p style="font-size:14px;color:#3a3a3a;line-height:1.6;margin:0 0 10px;${extra}">${t}</p>`;
const h = (t: string) => `<div style="font-size:12px;font-weight:800;color:#8a8272;text-transform:uppercase;letter-spacing:.5px;margin:22px 0 8px">${t}</div>`;

function compose(d: any): { subject: string; html: string; text: string } {
  const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric' }).format(new Date());
  const sign = d.new_signups || [];
  const atRisk = d.at_risk || [];
  const pastDue = d.past_due || [];

  // Headline: single most important thing.
  let headline: string;
  if (pastDue.length) headline = `${pastDue.length} paying program${pastDue.length === 1 ? ' has' : 's have'} a failed payment to look at.`;
  else if (d.payments_24h_count > 0) headline = `${d.payments_24h_count} new payment${d.payments_24h_count === 1 ? '' : 's'} in the last 24 hours, ${money(d.payments_24h_cents)}.`;
  else if (d.new_signups_count > 0) headline = `${d.new_signups_count} new program${d.new_signups_count === 1 ? '' : 's'} joined in the last 24 hours.`;
  else if (atRisk.length) headline = `${atRisk.length} paying or founding program${atRisk.length === 1 ? ' has' : 's have'} gone quiet. Everything else is steady.`;
  else headline = 'A quiet 24 hours. No new signups, no new payments, nothing at risk.';

  // New signups section
  let signHtml: string, signText: string;
  if (sign.length) {
    signHtml = p(`${d.new_signups_count} new program${d.new_signups_count === 1 ? '' : 's'} in the last 24 hours:`);
    signHtml += '<ul style="margin:0 0 10px;padding-left:18px">' + sign.map((o: any) => {
      const where = o.state ? ` (${o.state})` : '';
      const items = (o.items > 0) ? `${o.items} item${o.items === 1 ? '' : 's'} added` : 'no items yet, may need a nudge';
      return `<li style="font-size:14px;color:#3a3a3a;line-height:1.7"><strong>${o.name || o.email || 'New program'}</strong>${where}, ${o.plan || 'free'}, ${items}.</li>`;
    }).join('') + '</ul>';
    signText = sign.map((o: any) => `  ${o.name || o.email}${o.state ? ' (' + o.state + ')' : ''}, ${o.plan || 'free'}, ${o.items > 0 ? o.items + ' items' : 'no items yet'}`).join('\n');
  } else {
    signHtml = p('No new signups in the last 24 hours.');
    signText = '  No new signups in the last 24 hours.';
  }

  // Subscriptions and revenue
  let revHtml = p(`Active subscriptions: <strong>${d.active_subs}</strong>. Founding programs: <strong>${d.founding_count}</strong>. Total active programs: <strong>${d.total_active_programs}</strong>.`);
  revHtml += p(`Revenue this month: <strong>${money(d.revenue_month_cents)}</strong>. New payments in the last 24 hours: <strong>${d.payments_24h_count}</strong> (${money(d.payments_24h_cents)}).`);
  if (pastDue.length) {
    revHtml += p('<strong style="color:#c0392b">Failed payments to help with:</strong>');
    revHtml += '<ul style="margin:0 0 10px;padding-left:18px">' + pastDue.map((o: any) => `<li style="font-size:14px;color:#c0392b;line-height:1.7">${o.name || o.email} (${o.email || ''})</li>`).join('') + '</ul>';
  }

  // At risk
  let riskHtml: string;
  if (atRisk.length) {
    riskHtml = p(`${atRisk.length} paying or founding program${atRisk.length === 1 ? '' : 's'} with no activity for over 14 days:`);
    riskHtml += '<ul style="margin:0 0 10px;padding-left:18px">' + atRisk.map((o: any) => `<li style="font-size:14px;color:#3a3a3a;line-height:1.7"><strong>${o.name || o.email}</strong>, ${o.plan}, quiet for ${o.days} days.</li>`).join('') + '</ul>';
  } else {
    riskHtml = p('No paying or founding programs are at risk right now.');
  }

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;color:#2a2a2a">`
    + `<div style="font-size:12px;color:#8a8272;text-transform:uppercase;letter-spacing:.5px">Theatre4u daily pulse</div>`
    + `<div style="font-size:12px;color:#9a9284;margin-bottom:14px">${fmtDay}</div>`
    + `<div style="font-size:16px;font-weight:800;line-height:1.5;margin:0 0 6px">${headline}</div>`
    + h('New signups') + signHtml
    + h('Subscriptions and revenue') + revHtml
    + h('At risk') + riskHtml
    + `<div style="font-size:11px;color:#b3ab9d;border-top:1px solid #eee;margin-top:22px;padding-top:10px">Sent automatically each morning from your database. Support emails are handled in your support triage.</div>`
    + `</div>`;

  const text = [
    `Theatre4u daily pulse, ${fmtDay}`, '', headline, '',
    'New signups:', signText, '',
    `Subscriptions: ${d.active_subs} active, ${d.founding_count} founding, ${d.total_active_programs} total programs.`,
    `Revenue this month: ${money(d.revenue_month_cents)}. Payments last 24h: ${d.payments_24h_count} (${money(d.payments_24h_cents)}).`,
    pastDue.length ? `Failed payments: ${pastDue.map((o: any) => o.name || o.email).join(', ')}` : '',
    '', atRisk.length ? `At risk: ${atRisk.map((o: any) => (o.name || o.email) + ' (' + o.days + 'd)').join(', ')}` : 'At risk: none.',
  ].filter(x => x !== '').join('\n');

  return { subject: `Theatre4u daily pulse, ${fmtDay}`, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  const KEY = Deno.env.get('RESEND_API_KEY');
  const SB = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  try {
    const { data, error } = await SB.rpc('get_daily_pulse');
    if (error) throw error;
    const { subject, html, text } = compose(data);
    if (dry) return new Response(JSON.stringify({ ok: true, dry: true, subject, data, html }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    if (!KEY) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Theatre4u <hello@theatre4u.org>', reply_to: 'hello@theatre4u.org', to: ['admin@theatre4u.org'], subject, html, text }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(d)}`);
    console.log(`daily-pulse sent, resend id ${d.id}`);
    return new Response(JSON.stringify({ ok: true, resend_id: d.id, subject }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
