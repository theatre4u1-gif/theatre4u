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
  // ArtsTracker (all-verticals) track — allVerticals:true unlocks all 5 departments. Not yet enforced (needs vertical-switcher UX + webhook mapping).
  at_pro:        { label:"ArtsTracker Pro",        maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:59,  annualPrice:590  },
  at_district_s: { label:"ArtsTracker District S", maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:199, annualPrice:1990 },
  at_district_m: { label:"ArtsTracker District M", maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:399, annualPrice:3990 },
  at_district_l: { label:"ArtsTracker District L", maxItems:Infinity, marketplace:true, reports:true, allVerticals:true, monthlyPrice:699, annualPrice:6990 },
};

export const UPGRADE_PLANS = [
  { id:"free",     name:"Free",     monthlyPrice:"$0",  annualPrice:"Free",   per:"/forever", annualNote:null,       desc:"Perfect for getting started.",     hot:false,
    feats:["Up to 25 items","QR code generation","Photo uploads","Basic CSV export"] },
  { id:"pro",      name:"Pro",      monthlyPrice:"$15", annualPrice:"$12.50",  annualTotal:"$150/yr", per:"/month", annualNote:"save $30", desc:"For active programs & companies.", hot:true,
    feats:["Unlimited inventory","Full Backstage Exchange access","Photo storage 5GB","Analytics dashboard","Email support"] },
  { id:"district", name:"District S", monthlyPrice:"$49", annualPrice:"$42",  annualTotal:"$500/yr", per:"/month", annualNote:"save $88", desc:"Up to 6 schools, one platform.",  hot:false,
    feats:["Multiple organizations","District dashboard","Bulk import","Dedicated support","Everything in Pro"] },
  { id:"district_m", name:"District M", monthlyPrice:"$99", annualPrice:"$83",  annualTotal:"$999/yr",   per:"/month", annualNote:"save $189", desc:"Up to 15 schools — 54% savings.", hot:false,
    feats:["Everything in District S","Up to 15 school sites","District dashboard","Priority support","Dedicated onboarding"] },
  { id:"district_l", name:"District L", monthlyPrice:"$179", annualPrice:"$150", annualTotal:"$1,799/yr", per:"/month", annualNote:"save $349", desc:"Up to 30 schools — 58% savings.", hot:false,
    feats:["Everything in District M","Up to 30 school sites","District dashboard","Training webinar","Custom reporting"] },
  { id:"enterprise",  name:"Enterprise", monthlyPrice:"Custom", annualPrice:"Custom", per:"", annualNote:null, desc:"Large districts — custom contract.", hot:false,
    feats:["Everything in District L","Unlimited schools","Custom PO/invoicing","Data Processing Agreement","Dedicated support","Custom pricing"] },
];
