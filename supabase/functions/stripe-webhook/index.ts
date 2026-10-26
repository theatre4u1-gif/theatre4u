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
  "price_1U4muQBRkceXoRsJLMWSwfZE": { plan: "pro",        interval: "monthly" }, // founding $9.99 locked
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

// BinTrove (home-inventory) annual prices → home_plan. Sets orgs.home_plan ONLY (never the school `plan`).
// Additive: these IDs are not in PRICE_TO_PLAN and school prices are not here, so school billing is untouched.
const PRICE_TO_HOME: Record<string, { home_plan: string; interval: string }> = {
  "price_1UPn5uBRkceXoRsJ1KDkvxb9": { home_plan: "starter",   interval: "annual" }, // $24/yr
  "price_1UPn6fBRkceXoRsJCKN8IGLT": { home_plan: "home",      interval: "annual" }, // $59/yr
  "price_1UPn6UBRkceXoRsJTZUcCOOg": { home_plan: "home_plus", interval: "annual" }, // $89/yr
};

// Which project is this webhook deployed in? BinTrove runs on its own Supabase project
// with its own Stripe webhook endpoint. Because one Stripe account fans every event out
// to BOTH endpoints, each webhook must act ONLY on its own brand's prices — otherwise a
// BinTrove payment whose email matches a schools org could mis-write that schools org.
// Set PROJECT_BRAND=bintrove as a secret on the BinTrove project; schools leaves it unset.
// Detect the BinTrove project ROBUSTLY from the auto-injected SUPABASE_URL (Supabase sets
// it; it can't be mistyped or forgotten), with an optional PROJECT_BRAND override. The
// earlier version relied solely on PROJECT_BRAND, which silently fails if that secret is
// unset or has stray whitespace — so a paid BinTrove upgrade would not provision.
const IS_BINTROVE_PROJECT =
  (Deno.env.get("SUPABASE_URL") || "").includes("mdwuholylehviwezmadf") ||
  (Deno.env.get("PROJECT_BRAND") || "").trim().toLowerCase() === "bintrove";
const PROJECT_BRAND = IS_BINTROVE_PROJECT ? "bintrove" : "schools";

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

// Net recurring amount after any subscription-level discount (e.g. the founding coupon),
// so admin payment alerts show what the member actually pays (e.g. $9.99) rather than the
// plan's list price. Falls back to baseCents on any uncertainty so the alert never breaks.
async function netOfDiscount(sub: Record<string, any>, baseCents: number): Promise<number> {
  try {
    const disc = Array.isArray(sub?.discounts) ? sub.discounts[0] : sub?.discount;
    if (!disc || typeof disc === "string") return baseCents;
    let coupon: Record<string, any> | null =
      (disc.coupon && typeof disc.coupon === "object") ? disc.coupon : null;
    const couponId = coupon ? null
      : (disc?.source?.coupon ?? (typeof disc?.coupon === "string" ? disc.coupon : null));
    if (!coupon && couponId && STRIPE_KEY) {
      const r = await fetch("https://api.stripe.com/v1/coupons/" + couponId,
        { headers: { "Authorization": "Bearer " + STRIPE_KEY } });
      if (r.ok) coupon = await r.json();
    }
    if (!coupon) return baseCents;
    if (typeof coupon.amount_off === "number") return Math.max(0, baseCents - coupon.amount_off);
    if (typeof coupon.percent_off === "number") return Math.round(baseCents * (1 - coupon.percent_off / 100));
    return baseCents;
  } catch { return baseCents; }
}

// Internal alert to the admin when the webhook itself errors or cannot provision a paying
// customer. These are silent failures otherwise (only console-logged), so they get an email.
async function sendErrorAlert(subject: string, detail: string) {
  if (!RESEND_KEY) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff">
  <div style="background:#1a1200;padding:18px 24px"><span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#d4a843">&#x26A0;&#xFE0F; Stripe Webhook Alert</span></div>
  <div style="padding:22px 24px">
    <div style="background:#fdf0f0;border:1.5px solid #e8b4b4;border-radius:8px;padding:14px 18px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8c1a2a;margin-bottom:6px">Needs attention</div>
      <div style="font-size:16px;font-weight:700;color:#1a1200">${subject}</div>
    </div>
    <div style="font-size:13px;color:#444;line-height:1.6;white-space:pre-wrap;word-break:break-word">${detail}</div>
    <div style="font-size:12px;color:#888;margin-top:16px">Check the Stripe dashboard (Developers, then Webhooks) and the admin Billing dashboard.</div>
  </div>
  <div style="padding:10px 24px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">Theatre4u&trade; &middot; Artstracker LLC</div>
</div></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject: `⚠️ Stripe webhook: ${subject}`, html }),
  }).catch((e: Error) => console.error("sendErrorAlert:", e.message));
}

// Brand resolver for customer-facing billing emails. Mirrors send-sequence-email's brandFor:
// home → BinTrove, non-theatre vertical → ArtsTracker, theatre → by signup domain.
// NOTE: `from` stays hello@theatre4u.org (the Resend-verified domain) for every brand until
// bintrove.com / artstracker.org verify in Resend; then flip each B.from to its own hello@ address.
type WBrand = { plain: string; display: string; host: string; site: string; from: string; reply: string; ink: string; accent: string; planLabel: string; manage: string; pick: string; freeNote: string };
const WBRANDS: Record<string, WBrand> = {
  theatre4u: { plain: "Theatre4u", display: "Theatre4u&#x2122;", host: "theatre4u.org", site: "https://theatre4u.org",
    from: "Bob Zick at Theatre4u <hello@theatre4u.org>", reply: "hello@theatre4u.org", ink: "#4C1035", accent: "#d4a843",
    planLabel: "Pro plan", manage: "Settings &rarr; Plans &rarr; Manage Billing", pick: "Settings &rarr; Plans, then choose <strong>Pro</strong>", freeNote: "You still have access to your first 25 items" },
  artstracker: { plain: "ArtsTracker", display: "ArtsTracker", host: "artstracker.org", site: "https://artstracker.org",
    from: "Bob Zick at ArtsTracker <hello@theatre4u.org>", reply: "hello@artstracker.org", ink: "#4C1035", accent: "#d4a843",
    planLabel: "Pro plan", manage: "Settings &rarr; Plans &rarr; Manage Billing", pick: "Settings &rarr; Plans, then choose <strong>Pro</strong>", freeNote: "You still have access to your first 25 items" },
  bintrove: { plain: "BinTrove", display: "BinTrove", host: "bintrove.com", site: "https://bintrove.com",
    from: "Bob Zick at BinTrove <hello@theatre4u.org>", reply: "hello@bintrove.com", ink: "#0A5450", accent: "#1C9E8F",
    planLabel: "plan", manage: "Account", pick: "Account, then pick a plan", freeNote: "Your bins and items are safe on the Free plan" },
};
function brandForOrg(o?: { vertical?: string; org_type?: string; signup_domain?: string }): WBrand {
  const v = o?.vertical || "theatre", t = o?.org_type, d = o?.signup_domain || "";
  if (v === "home" || t === "home") return WBRANDS.bintrove;
  if (v !== "theatre") return WBRANDS.artstracker;
  return d.includes("artstracker") ? WBRANDS.artstracker : WBRANDS.theatre4u;
}

// Customer-facing heads-up on a failed charge, so subscribers can fix their card before they lapse.
async function sendCardFailedEmail(toEmail: string, B: WBrand = WBRANDS.theatre4u) {
  if (!RESEND_KEY || !toEmail) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff">
  <div style="background:#FBF7F0;padding:20px 24px 16px;text-align:center;border-bottom:3px solid ${B.accent}"><span style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:${B.ink}">${B.display}</span></div>
  <div style="padding:26px 28px 20px">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">Hi there,</p>
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">Quick heads-up: the latest payment for your ${B.plain} ${B.planLabel} didn't go through. Usually it's just an expired card or a billing change &mdash; nothing to worry about.</p>
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 12px">Your account is still active, and we'll automatically retry the card over the next few days. To avoid any interruption, you can update your payment method anytime:</p>
    <ol style="font-size:15px;color:#333;line-height:1.9;margin:0 0 16px;padding-left:20px">
      <li>Sign in at <a href="${B.site}" style="color:#a5731f;font-weight:700">${B.host}</a></li>
      <li>Go to <strong>${B.manage}</strong></li>
      <li>Update your card</li>
    </ol>
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">Everything in your inventory is safe. If something has changed or you have any questions, please do not hesitate to let me know.</p>
    <p style="font-size:15px;color:#333;margin:22px 0 2px">Warmly,</p>
    <p style="font-size:15px;font-weight:700;color:#1a0f00;margin:0">Bob Zick</p>
    <p style="font-size:13px;color:#888;margin:2px 0 0">Founder, ${B.plain} &middot; ${B.reply}</p>
  </div>
  <div style="padding:12px 28px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">${B.display} &middot; Artstracker LLC</div>
</div></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: B.from, reply_to: B.reply, to: [toEmail],
      subject: `Your ${B.plain} payment didn't go through — a quick fix keeps your access`, html }),
  }).catch((e: Error) => console.error("sendCardFailedEmail:", e.message));
}

// Final notice when retries are exhausted and the subscription is canceled for non-payment,
// so no one lapses to Free without a heads-up. Only sent for payment-failure cancellations.
async function sendDowngradeEmail(toEmail: string, B: WBrand = WBRANDS.theatre4u) {
  if (!RESEND_KEY || !toEmail) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff">
  <div style="background:#FBF7F0;padding:20px 24px 16px;text-align:center;border-bottom:3px solid ${B.accent}"><span style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:${B.ink}">${B.display}</span></div>
  <div style="padding:26px 28px 20px">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">Hi there,</p>
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">After a few unsuccessful attempts to renew your ${B.plain} ${B.planLabel}, your subscription has ended and your account has moved to our Free plan.</p>
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">Everything in your inventory is safe &mdash; nothing has been deleted. ${B.freeNote}, and you can pick your paid features back up anytime:</p>
    <ol style="font-size:15px;color:#333;line-height:1.9;margin:0 0 16px;padding-left:20px">
      <li>Sign in at <a href="${B.site}" style="color:#a5731f;font-weight:700">${B.host}</a></li>
      <li>Go to <strong>${B.pick}</strong></li>
    </ol>
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">If the card trouble was a mistake or something has changed, please do not hesitate to let me know &mdash; I'm happy to help get you back up and running.</p>
    <p style="font-size:15px;color:#333;margin:22px 0 2px">Warmly,</p>
    <p style="font-size:15px;font-weight:700;color:#1a0f00;margin:0">Bob Zick</p>
    <p style="font-size:13px;color:#888;margin:2px 0 0">Founder, ${B.plain} &middot; ${B.reply}</p>
  </div>
  <div style="padding:12px 28px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">${B.display} &middot; Artstracker LLC</div>
</div></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: B.from, reply_to: B.reply, to: [toEmail],
      subject: `Your ${B.plain} plan has switched to Free`, html }),
  }).catch((e: Error) => console.error("sendDowngradeEmail:", e.message));
}

// Customer-facing RECEIPT for every paid invoice (the first charge AND each renewal), so
// subscribers always have proof of payment without having to ask. Uses Stripe's own hosted
// invoice page + PDF (no PDF generation on our side). Brand-aware. Best-effort: never throws.
async function sendReceiptEmail(inv: Record<string, any>, toEmail: string, B: WBrand) {
  if (!RESEND_KEY || !toEmail) return;
  try {
    const cents   = (inv.total ?? inv.amount_paid ?? 0) as number;
    const amount  = "$" + (cents / 100).toFixed(2);
    const paidAt  = (inv.status_transitions?.paid_at ?? inv.created ?? Math.floor(Date.now() / 1000)) as number;
    const dateStr = new Date(paidAt * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
    const number  = (inv.number ?? "") as string;
    const lineDesc = (inv.lines?.data?.[0]?.description ?? `${B.plain} ${B.planLabel}`) as string;
    const hosted  = (inv.hosted_invoice_url ?? "") as string;
    const pdf     = (inv.invoice_pdf ?? "") as string;
    const btn = (href: string, label: string, solid: boolean) =>
      `<a href="${href}" style="display:inline-block;${solid ? `background:${B.accent};color:#1a0f00;` : `background:#fff;color:${B.ink};border:1.5px solid ${B.accent};`}padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin:0 6px 8px 0">${label}</a>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff">
  <div style="background:#FBF7F0;padding:20px 24px 16px;text-align:center;border-bottom:3px solid ${B.accent}"><span style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:${B.ink}">${B.display}</span></div>
  <div style="padding:26px 28px 20px">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">Hi there,</p>
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 18px">Thank you &mdash; your payment to ${B.plain} was received. Here is your receipt:</p>
    <div style="background:#f5f0e8;border-radius:8px;padding:16px 18px;margin:0 0 18px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8b6914;margin-bottom:4px">Payment received</div>
      <div style="font-size:28px;font-weight:700;color:#1a1200;margin-bottom:10px">${amount}</div>
      <table cellpadding="4" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#444">
        <tr><td style="color:#777;width:110px;padding:3px 0">Date</td><td style="padding:3px 0">${dateStr}</td></tr>
        <tr><td style="color:#777;padding:3px 0">Description</td><td style="padding:3px 0">${lineDesc}</td></tr>
        ${number ? `<tr><td style="color:#777;padding:3px 0">Invoice</td><td style="padding:3px 0">${number}</td></tr>` : ""}
        <tr><td style="color:#777;padding:3px 0">Billed to</td><td style="padding:3px 0">${toEmail}</td></tr>
      </table>
    </div>
    ${(hosted || pdf) ? `<div style="margin:0 0 18px">${hosted ? btn(hosted, "View invoice", true) : ""}${pdf ? btn(pdf, "Download PDF", false) : ""}</div>` : ""}
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px">You can always find your past invoices and receipts in your account under <strong>${B.manage.split("&rarr;")[0].trim()} &rarr; Invoices</strong>. If you need anything else for your records, just reply to this email.</p>
    <p style="font-size:15px;color:#333;margin:22px 0 2px">Warmly,</p>
    <p style="font-size:15px;font-weight:700;color:#1a0f00;margin:0">Bob Zick</p>
    <p style="font-size:13px;color:#888;margin:2px 0 0">Founder, ${B.plain} &middot; ${B.reply}</p>
  </div>
  <div style="padding:12px 28px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa;line-height:1.7">${B.display} &middot; Artstracker LLC &middot; 10441 Stanford Ave., #1155, Garden Grove, CA 92842</div>
</div></body></html>`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: B.from, reply_to: B.reply, to: [toEmail],
        subject: `Your ${B.plain} payment receipt — ${amount}${number ? ` (Invoice ${number})` : ""}`, html }),
    }).catch((e: Error) => console.error("sendReceiptEmail:", e.message));
  } catch (e) { console.error("sendReceiptEmail build:", String(e)); }
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

async function findOrg(customerId?: string, email?: string, orgId?: string): Promise<{ id: string; name: string; email: string; vertical: string; org_type?: string; signup_domain?: string } | null> {
  try {
    if (orgId) {
      const { data } = await sb.from("orgs").select("id,name,email,vertical,org_type,signup_domain").eq("id", orgId).single();
      if (data) return data;
    }
    if (customerId) {
      const { data } = await sb.from("orgs").select("id,name,email,vertical,org_type,signup_domain").eq("stripe_customer_id", customerId).single();
      if (data) return data;
    }
    if (email) {
      const { data } = await sb.from("orgs").select("id,name,email,vertical,org_type,signup_domain").eq("email", email.toLowerCase().trim()).single();
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

        // ── BinTrove Move pass — one-time payment, 30-day unlimited window ──
        // Granted off the payment link's metadata.type (not a price ID). Sets home_plan=move
        // + plan_expires_at=now+30d. A daily pg_cron job reverts expired move orgs to free.
        // Never flips an org that already holds a paid home subscription (home_plus stays).
        if (data.mode === "payment" && meta?.type === "bintrove_move") {
          if (!IS_BINTROVE_PROJECT) break; // BinTrove product — ignore on the schools webhook
          const org = await findOrg(customerId, customerEmail, clientRef || undefined);
          const amt = (data.amount_total as number) || 2900;
          if (org) {
            const { data: cur } = await sb.from("orgs").select("home_plan, stripe_subscription_id").eq("id", org.id).single();
            const curPlan = (cur?.home_plan || "free") as string;
            const hasHomeSub = !!cur?.stripe_subscription_id && ["starter","home","home_plus"].includes(curPlan);
            if (!hasHomeSub) {
              await sb.from("orgs").update({
                home_plan: "move",
                plan_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
                stripe_customer_id: customerId,
              }).eq("id", org.id);
            }
            await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
              plan: "BinTrove Move" + (hasHomeSub ? " (kept existing sub)" : ""), interval: "one-time", amountCents: amt });
          } else {
            await sendErrorAlert("BinTrove Move paid with no matching org",
              `A Move pass checkout completed (${eventId}) but no org matched customer ${customerId} / ${customerEmail} / ref ${clientRef}. The customer paid but was not provisioned. Provision manually (home_plan=move, plan_expires_at=now+30d).`);
          }
          await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
            stripe_customer_id: customerId, stripe_payment_intent: data.payment_intent,
            amount_cents: amt, currency: "usd", status: "succeeded",
            description: "BinTrove Move pass (30-day)", customer_email: customerEmail,
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
        let alertAmountCents = subAmountCents;

        if (STRIPE_KEY && subscriptionId) {
          try {
            const subRes = await fetch("https://api.stripe.com/v1/subscriptions/" + subscriptionId + "?expand[]=discounts",
              { headers: { "Authorization": "Bearer " + STRIPE_KEY } });
            if (subRes.ok) {
              const sub = await subRes.json();
              priceId = sub?.items?.data?.[0]?.price?.id;
              planInfo = priceId ? PRICE_TO_PLAN[priceId] : undefined;
              const pe = periodEndsFromSub(sub as Record<string, unknown>);
              periodEnd = pe.end;
              periodStart = pe.start;
              const baseUnit = (sub?.items?.data?.[0]?.price?.unit_amount ?? 0) as number;
              subAmountCents = subAmountCents || baseUnit;
              // Alert shows the true recurring price after any founding/discount coupon.
              alertAmountCents = baseUnit ? await netOfDiscount(sub, baseUnit) : subAmountCents;
            }
          } catch (e) { console.error("Failed to fetch subscription:", e); }
        }

        // Brand guard: only provision prices that belong to THIS project's brand. A home
        // price arriving at the schools webhook (or a school price at the BinTrove webhook)
        // is another project's customer fanned out by the shared Stripe account — ignore it
        // entirely (no log, no write) so it can never touch the wrong project's orgs.
        {
          const isHomePrice   = !!(priceId && PRICE_TO_HOME[priceId]);
          const isSchoolPrice = !!(priceId && PRICE_TO_PLAN[priceId]);
          if ((IS_BINTROVE_PROJECT && isSchoolPrice) || (!IS_BINTROVE_PROJECT && isHomePrice)) {
            console.log("stripe-webhook: ignoring cross-brand checkout", { priceId, project: PROJECT_BRAND });
            break;
          }
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

        const homeInfo = priceId ? PRICE_TO_HOME[priceId] : undefined;
        if (org && homeInfo) {
          // BinTrove home subscription → set home_plan ONLY; never touch the school `plan`/verticals/points.
          await sb.from("orgs").update({
            home_plan: homeInfo.home_plan,
            subscription_status: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_expires_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          }).eq("id", org.id);
          await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
            plan: "BinTrove " + homeInfo.home_plan, interval: homeInfo.interval, amountCents: alertAmountCents });
        } else if (org && planInfo) {
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
          if (isAnnual) { try { await sb.rpc("award_milestone_points", { p_org_id: org.id, p_type: "annual_bonus", p_amount: 300, p_desc: "Annual plan bonus" }); } catch (_) {} }
          await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
            plan: planInfo.plan + (planInfo.allVerticals ? " (ArtsTracker)" : ""), interval: planInfo.interval, amountCents: alertAmountCents });
        } else if (!planInfo && !homeInfo) {
          console.warn("Unknown price ID:", priceId);
          await sendErrorAlert("unknown price ID on a completed checkout",
            `A subscription checkout completed (${eventId}) but price ${priceId} is not in PRICE_TO_PLAN, so the org was not upgraded. Customer ${customerId} / ${customerEmail}. Add the price mapping and provision manually.`);
        } else if (!org) {
          console.error("No org found for customer:", customerId, customerEmail);
          await sendErrorAlert("paid subscription with no matching org",
            `A subscription checkout completed (${eventId}) for plan ${planInfo.plan} ${planInfo.interval} but no org matched customer ${customerId} / ${customerEmail}. The customer paid but was not provisioned. Provision manually.`);
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
          const homeInfo = priceId ? PRICE_TO_HOME[priceId] : undefined;
          if (homeInfo) updates.home_plan = homeInfo.home_plan; // BinTrove: sync home_plan; school `plan` untouched
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

        const delHome = (() => { const pid = extractPriceId(data); return pid ? PRICE_TO_HOME[pid] : undefined; })();
        if (org && delHome) {
          // BinTrove home subscription canceled → home_plan back to free; school plan/verticals untouched.
          await sb.from("orgs").update({
            home_plan: "free", subscription_status: "canceled",
            stripe_subscription_id: null,
            plan_expires_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          }).eq("id", org.id);
        } else if (org) {
          await sb.from("orgs").update({
            plan: "free", plan_interval: "monthly", subscription_status: "canceled",
            stripe_subscription_id: null,
            plan_expires_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            // Revoke extra departments on cancellation — back to the home department only.
            verticals_enabled: [org.vertical || "theatre"],
          }).eq("id", org.id);
          // Only email on involuntary (dunning-exhausted) cancellations, not voluntary ones.
          const cancelReason = ((data.cancellation_details as Record<string, unknown>)?.reason ?? "") as string;
          if (cancelReason === "payment_failure") await sendDowngradeEmail(org.email, brandForOrg(org));
        }
        break;
      }

      // Stripe sends "invoice.paid" (that is what our endpoint subscribes to). Older code only
      // matched "invoice.payment_succeeded", so recurring charges fell through unhandled — no log,
      // no alert. Handle both. We only log + alert the recurring cycle invoices (monthly/annual
      // renewals, and the first real charge after a free trial). The very first charge on a direct
      // checkout is already captured by checkout.session.completed, so skipping it here avoids
      // double counting revenue.
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const customerId = (data.customer ?? "") as string;
        const isRenewal  = data.billing_reason === "subscription_cycle";
        const total      = (data.total ?? 0) as number;
        const org        = await findOrg(customerId);

        if (org) await sb.from("orgs").update({ subscription_status: "active" }).eq("id", org.id);

        // Customer receipt on EVERY paid invoice (first charge + renewals). Separate from the
        // revenue log below, which skips the first charge to avoid double-counting with
        // checkout.session.completed — receipts should go out every time, including the first.
        await sendReceiptEmail(
          data,
          ((data.customer_email as string) || org?.email || "").toLowerCase().trim(),
          org ? brandForOrg(org) : WBRANDS.theatre4u,
        );

        if (!isRenewal) break;

        await logPayment({ stripe_event_id: eventId, stripe_event_type: eventType,
          stripe_customer_id: customerId, stripe_subscription_id: data.subscription,
          stripe_invoice_id: data.id, stripe_payment_intent: data.payment_intent,
          amount_cents: total, currency: "usd", status: "succeeded",
          description: "Subscription renewal",
          customer_email: data.customer_email, org_id: org?.id ?? null, org_name: org?.name ?? null,
          period_start: data.period_start ? new Date((data.period_start as number) * 1000).toISOString() : null,
          period_end: data.period_end ? new Date((data.period_end as number) * 1000).toISOString() : null,
          stripe_created_at: event.created ? new Date((event.created as number) * 1000).toISOString() : null });

        if (org) {
          if (total >= 15000) { try { await sb.rpc("award_milestone_points", { p_org_id: org.id, p_type: "annual_renewal_bonus", p_amount: 300, p_desc: "Annual renewal bonus" }); } catch (_) {} }
          await sendPaymentAlert({ eventType, orgName: org.name, orgEmail: org.email,
            plan: "renewal", interval: "", amountCents: total });
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
          // Let the subscriber know so they can fix their card before they lapse.
          await sendCardFailedEmail(org.email, brandForOrg(org));
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
    // Alert the admin — otherwise this is a silent failure that only shows in logs.
    await sendErrorAlert(`handler error on ${eventType}`,
      `Event ${eventType} (${eventId}) threw while processing:\n\n${String(e)}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
});
