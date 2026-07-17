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
