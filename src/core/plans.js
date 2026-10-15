// Plan definitions, Stripe payment links + helper, pricing-card data — extracted from App.jsx.
// (The ArtsTracker $59/$199/$399/$699 tiers will be wired in here later — see ArtsTracker-Stripe-IDs.)

export const STRIPE_LINKS = {
  pro:        { monthly:"https://buy.stripe.com/fZu4gyeF39lpdu31AngA808", annual:"https://buy.stripe.com/fZu3cu40p2X11Ll5QDgA809" },
  district:   { monthly:"https://buy.stripe.com/aFa4gydAZ2X1cpZ6UHgA800", annual:"https://buy.stripe.com/eVqdR88gF1SX9dN0wjgA802" },
  district_m: { monthly:"https://buy.stripe.com/5kQ00ieF3aptahRbaXgA806", annual:"https://buy.stripe.com/6oU7sK68x41575F5QDgA807" },
  district_l: { monthly:"https://buy.stripe.com/6oU28q2Wl8hlgGfdj5gA804", annual:"https://buy.stripe.com/eVq00ieF37dhahR2ErgA805" },
  // ArtsTracker (all-verticals) track — created 2026-06-07, livemode. See ArtsTracker-Stripe-IDs.
  at_pro:        { monthly:"https://buy.stripe.com/fZucN42WlfJN2Pp1AngA80a", annual:"https://buy.stripe.com/bJe14m40p69dblVa6TgA80b" },
  at_district_s: { monthly:"https://buy.stripe.com/aFaaEW7cBdBF75F7YLgA80c", annual:"https://buy.stripe.com/fZuaEW54t1SX75FgvhgA80d" },
  at_district_m: { monthly:"https://buy.stripe.com/aFa3cugNb2X175Fen9gA80e", annual:"https://buy.stripe.com/fZueVc9kJbtxfCbdj5gA80f" },
  at_district_l: { monthly:"https://buy.stripe.com/3cIdR8gNb7dhahRen9gA80g", annual:"https://buy.stripe.com/00waEW7cBcxB2Pp6UHgA80h" },
};

export function stripeLink(baseUrl, userId, userEmail) {
  if (!baseUrl || baseUrl === "#") return "#";
  try {
    const url = new URL(baseUrl);
    if (userId)    url.searchParams.set("client_reference_id", userId);
    if (userEmail) url.searchParams.set("prefilled_email", userEmail);
    return url.toString();
  } catch { return baseUrl; }
}

// ── BinTrove (consumer home-inventory) — annual-only at launch ──────────────
// Live Stripe price IDs (product prod_VQeOWT8WqxNtrr). The webhook's PRICE_TO_HOME maps
// these prices → orgs.home_plan. BINTROVE_LINKS get the payment-link URLs once created.
export const BINTROVE_PRICE_IDS = {
  starter:   "price_1UPn5uBRkceXoRsJ1KDkvxb9", // $24/yr
  home:      "price_1UPn6fBRkceXoRsJCKN8IGLT", // $59/yr
  home_plus: "price_1UPn6UBRkceXoRsJTZUcCOOg", // $89/yr
};
export const BINTROVE_LINKS = {
  starter:   "https://buy.stripe.com/3cIeVcgNb4150Hh2ErgA80j", // $24/yr
  home:      "https://buy.stripe.com/cNi28q8gF9lp3TtgvhgA80k", // $59/yr
  home_plus: "https://buy.stripe.com/aFa14m0OdeFJ0Hhdj5gA80l", // $89/yr
  // ── BinTrove Move — $29 one-time, 30-day unlimited pass ──
  // PASTE the Stripe Payment Link URL here once created (see hub). The link must carry
  // metadata type=bintrove_move and after_completion redirect to https://bintrove.com/?paid=1.
  // The stripe-webhook grants home_plan=move + plan_expires_at=now+30d off that metadata,
  // so it does NOT need the price ID. Empty string = Move not yet live (UI hides it).
  move:      "https://buy.stripe.com/8x2bJ0eF39lp61B92PgA80m", // $29 one-time · price_1UQfaIBRkceXoRsJATOZsmgK · metadata type=bintrove_move
};
// ── BinTrove AI Scan allotments ─────────────────────────────────────────────
// Photo → AI suggests a catalog entry, user confirms. Metered per plan; the
// scan-item edge function enforces this server-side against ai_scan_log.
//   period "lifetime" = one trial pool ever (Free)
//   period "month"    = refreshes at the start of each calendar month (UTC)
//   period "window"   = counted within the Move pass's 30-day window
export const SCAN_LIMITS = {
  free:      { limit: 10,  period: "lifetime" },
  starter:   { limit: 50,  period: "month" },
  home:      { limit: 150, period: "month" },
  home_plus: { limit: 500, period: "month" },
  move:      { limit: 150, period: "window" },
};
// Map an orgs.home_plan value (null/"free"/"starter"/"home"/"home_plus"/"move")
// to its scan allotment. Unknown or empty → Free.
export function scanLimitFor(homePlan) {
  return SCAN_LIMITS[homePlan || "free"] || SCAN_LIMITS.free;
}

// ── School AI Scan allotments (Theatre4u / ArtsTracker) — bundled into the plan, metered monthly.
// Free gets a small taste (the 25-item Free cap already limits how much it can save); Pro and up
// get a generous monthly pool. Kept in sync with SCAN_LIMITS_SCHOOL in the scan-item edge function.
export const SCHOOL_SCAN_LIMITS = {
  free:          { limit: 3,    period: "month" },
  pro:           { limit: 100,  period: "month" },
  district:      { limit: 300,  period: "month" },
  district_m:    { limit: 600,  period: "month" },
  district_l:    { limit: 1000, period: "month" },
  at_pro:        { limit: 100,  period: "month" },
  at_district_s: { limit: 300,  period: "month" },
  at_district_m: { limit: 600,  period: "month" },
  at_district_l: { limit: 1000, period: "month" },
  enterprise:    { limit: 5000, period: "month" },
  at_enterprise: { limit: 5000, period: "month" },
};
export function schoolScanLimitFor(plan) {
  return SCHOOL_SCAN_LIMITS[plan || "free"] || SCHOOL_SCAN_LIMITS.free;
}

export const BINTROVE_PLANS_DEF = {
  free:      { label:"Free",      maxBins:3,        maxItems:30,       annualPrice:0,  users:1,
    blurb:"Try it out — catalog a few bins and see how it works.",
    features:["QR labels for every bin","Photos, search & locations","CSV export"] },
  starter:   { label:"Starter",   maxBins:10,       maxItems:100,      annualPrice:24, users:1,
    blurb:"A closet, the garage, or your holiday bins.",
    features:["Everything in Free","10 bins · 100 items","1 user"] },
  home:      { label:"Home",      maxBins:30,       maxItems:300,      annualPrice:59, users:2,
    blurb:"A whole household — share with your partner.",
    features:["Everything in Starter","30 bins · 300 items","Share with 2 people"] },
  home_plus: { label:"Home Plus", maxBins:Infinity, maxItems:Infinity, annualPrice:89, users:5,
    blurb:"No limits — perfect for a big house or a move.",
    features:["Everything in Home","Unlimited bins & items","Share with up to 5"] },
  // One-time Move pass: unlimited for 30 days, then reverts to Free (data preserved).
  move:      { label:"Move", maxBins:Infinity, maxItems:Infinity, annualPrice:29, users:5, oneTime:true, windowDays:30,
    blurb:"Moving? Unlimited bins & items for 30 days — one payment, no subscription.",
    features:["Unlimited bins & items for 30 days","150 AI scans to catalog fast","Household sharing","All data preserved after it ends"] },
};

export const PLANS_DEF = {
  free:     { label:"Free",     maxItems:25,  marketplace:false, reports:false, allVerticals:false, monthlyPrice:0,  annualPrice:0   },
  pro:      { label:"Pro",      maxItems:Infinity, marketplace:true,  reports:true,  allVerticals:false, monthlyPrice:15, annualPrice:150 },
  district: { label:"District", maxItems:Infinity, marketplace:true,  reports:true,  allVerticals:false, monthlyPrice:49, annualPrice:500 },
  district_m:{ label:"District M", maxItems:Infinity, marketplace:true, reports:true, allVerticals:false, monthlyPrice:99,  annualPrice:999  },
  district_l:{ label:"District L", maxItems:Infinity, marketplace:true, reports:true, allVerticals:false, monthlyPrice:179, annualPrice:1799 },
  // ArtsTracker (all-verticals) track — allVerticals:true unlocks all 5 departments. Not yet enforced (needs vertical-switcher UX + webhook mapping).
  at_pro:        { label:"ArtsTracker Pro",        maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:59,  annualPrice:590  },
  at_district_s: { label:"ArtsTracker District S", maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:199, annualPrice:1990 },
  at_district_m: { label:"ArtsTracker District M", maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:399, annualPrice:3990 },
  at_district_l: { label:"ArtsTracker District L", maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:699, annualPrice:6990 },
};

// ── Beta → paid transition (billing goes live Sept 1 2026) ───────────────────
// Beta accounts (temp_pro) get full Pro free during beta. After beta_end_date
// there's a grace window; if still unpaid when grace ends, the account drops to
// Free (25-item cap). Comped accounts and paying/subscribed accounts are exempt.
// beta_end_date is a date; we anchor it to midnight Pacific (07:00 UTC) to match
// the launch gate in billing.jsx.
export const GRACE_DAYS = 14;

export function isComped(org) {
  return !!org && (org.admin_notes || "").includes("[COMPED]");
}

// Returns one of: "paid" | "comped" | "free" | "beta" | "grace" | "expired"
export function betaPhase(org, now = Date.now()) {
  if (!org) return "free";
  if (org.stripe_subscription_id) return "paid";     // already subscribing
  if (isComped(org)) return "comped";                // free & exempt (e.g. HBUHSD)
  if (!org.temp_pro) return "free";                  // ordinary Free plan, not a beta grant
  const end = org.beta_end_date ? Date.parse(org.beta_end_date + "T07:00:00Z") : null;
  if (!end || now < end) return "beta";              // still complimentary
  const graceEnd = end + GRACE_DAYS * 86400000;
  return now < graceEnd ? "grace" : "expired";
}

// The date a beta account's grace window ends (Date object) or null.
export function graceEndDate(org) {
  const end = org?.beta_end_date ? Date.parse(org.beta_end_date + "T07:00:00Z") : null;
  return end ? new Date(end + GRACE_DAYS * 86400000) : null;
}

export const UPGRADE_PLANS = [
  // ── Single-Department track — one art area ──────────────────────────────────
  { id:"free",     track:"single", name:"Free",     monthlyPrice:"$0",  annualPrice:"Free",   per:"/forever", annualNote:null,       desc:"Perfect for getting started.",     hot:false,
    feats:["Up to 25 items","QR code generation","Photo uploads","Basic CSV export"] },
  { id:"pro",      track:"single", name:"Pro",      monthlyPrice:"$15", annualPrice:"$12.50",  annualTotal:"$150/yr", per:"/month", annualNote:"save $30", desc:"For active programs & companies.", hot:true,
    feats:["Unlimited inventory","Full Exchange access","Photo storage 5GB","Analytics dashboard","Email support"] },
  { id:"district", track:"single", name:"District S", monthlyPrice:"$49", annualPrice:"$42",  annualTotal:"$500/yr", per:"/month", annualNote:"save $88", desc:"Up to 6 schools, one platform.",  hot:false,
    feats:["Multiple organizations","District dashboard","Bulk import","District internal loans","Everything in Pro"] },
  { id:"district_m", track:"single", name:"District M", monthlyPrice:"$99", annualPrice:"$83",  annualTotal:"$999/yr",   per:"/month", annualNote:"save $189", desc:"Up to 15 schools — 54% savings.", hot:false,
    feats:["Everything in District S","Up to 15 school sites","Arts facilitator roles","District funding rollup"] },
  { id:"district_l", track:"single", name:"District L", monthlyPrice:"$179", annualPrice:"$150", annualTotal:"$1,799/yr", per:"/month", annualNote:"save $349", desc:"Up to 30 schools — 58% savings.", hot:false,
    feats:["Everything in District M","Up to 30 school sites","Storage maps at every site","Email support"] },
  { id:"enterprise",  track:"single", name:"Enterprise", monthlyPrice:"Custom", annualPrice:"Custom", per:"", annualNote:null, desc:"Large districts — custom contract.", hot:false,
    feats:["Everything in District L","Unlimited schools","Custom PO/invoicing","Data Processing Agreement","Custom pricing"] },

  // ── ArtsTracker track — all five departments (Theatre · Music · Dance · Visual Art · Boosters) ──
  { id:"at_pro",        track:"artstracker", name:"ArtsTracker Pro",        monthlyPrice:"$59",  annualPrice:"$49",  annualTotal:"$590/yr",   per:"/month", annualNote:"save $118",   desc:"All five departments, one school.", hot:true,
    feats:["All 5 departments in one account","Switch between departments anytime","Unlimited inventory · all areas","Full Exchange access","Analytics & reports","Email support"] },
  { id:"at_district_s", track:"artstracker", name:"ArtsTracker District S", monthlyPrice:"$199", annualPrice:"$166", annualTotal:"$1,990/yr", per:"/month", annualNote:"save $398",   desc:"All departments · up to 6 schools.", hot:false,
    feats:["Everything in ArtsTracker Pro","Up to 6 schools","District dashboard","Bulk import","District internal loans"] },
  { id:"at_district_m", track:"artstracker", name:"ArtsTracker District M", monthlyPrice:"$399", annualPrice:"$333", annualTotal:"$3,990/yr", per:"/month", annualNote:"save $798",   desc:"All departments · up to 15 schools.", hot:false,
    feats:["Everything in District S","Up to 15 schools","Arts facilitator roles","District funding rollup"] },
  { id:"at_district_l", track:"artstracker", name:"ArtsTracker District L", monthlyPrice:"$699", annualPrice:"$583", annualTotal:"$6,990/yr", per:"/month", annualNote:"save $1,398", desc:"All departments · up to 30 schools.", hot:false,
    feats:["Everything in District M","Up to 30 schools","Storage maps at every site","Email support"] },
  { id:"at_enterprise", track:"artstracker", name:"ArtsTracker Enterprise", monthlyPrice:"Custom", annualPrice:"Custom", per:"", annualNote:null, desc:"31+ schools — custom contract.", hot:false,
    feats:["Everything in District L","Unlimited schools","Custom PO/invoicing","Data Processing Agreement"] },
];
