import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

// Brand by vertical: non-theatre programs (music/dance/art/booster) = ArtsTracker; theatre follows signup_domain.
type Brand = { name:string; site:string; host:string; from:string; reply:string; emoji:string };
const BRANDS: Record<string,Brand> = {
  theatre4u:   { name:"Theatre4u",   site:"https://theatre4u.org",   host:"theatre4u.org",   from:"Theatre4u <hello@theatre4u.org>",   reply:"hello@theatre4u.org",   emoji:"&#x1F3AD;" },
  artstracker: { name:"ArtsTracker", site:"https://artstracker.org", host:"artstracker.org", from:"ArtsTracker <hello@theatre4u.org>", reply:"hello@artstracker.org", emoji:"&#x1F3A8;" },
};
const brandFor = (d?: string, v?: string): Brand =>
  ((v || "theatre") !== "theatre") ? BRANDS.artstracker
  : ((d || "").includes("artstracker") ? BRANDS.artstracker : BRANDS.theatre4u);

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
});
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors(), "Content-Type": "application/json" } });

async function sendEmail(to: string, subject: string, html: string, B: Brand) {
  if (!RESEND_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: B.from, reply_to: B.reply, to: [to], subject, html })
  });
}

const header = (B: Brand) => `<div style="text-align:center;margin-bottom:20px"><span style="font-size:40px">${B.emoji}</span><h1 style="font-family:Georgia,serif;color:#d4a843;margin:6px 0 2px">${B.name}</h1></div>`;
const footer = (B: Brand) => `<p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:14px;margin-top:24px">${B.name} &middot; ${B.reply}</p>`;
const cta = (B: Brand, label: string) => `<div style="text-align:center;margin:24px 0"><a href="${B.site}" style="display:inline-block;background:#d4a843;color:#1a0600;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">${label}</a></div>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, ANON_KEY)
      .auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { type, request_id } = body;

    const { data: req_data } = await sb.from("rental_requests").select("*").eq("id", request_id).single();
    if (!req_data) return json({ error: "Request not found" }, 404);

    const { data: ownerOrg }     = await sb.from("orgs").select("name,email,vertical,signup_domain").eq("id", req_data.owner_id).single();
    const { data: requesterOrg } = await sb.from("orgs").select("name,email,vertical,signup_domain").eq("id", req_data.requester_id).single();
    const Bowner = brandFor(ownerOrg?.signup_domain, ownerOrg?.vertical);
    const Breq   = brandFor(requesterOrg?.signup_domain, requesterOrg?.vertical);

    const dateRange = req_data.start_date
      ? `${req_data.start_date} &rarr; ${req_data.end_date}`
      : "Purchase (no dates)";
    const typeLabel = req_data.item_type === "rent" ? "Rental" : req_data.item_type === "loan" ? "Loan" : "Purchase";

    if (type === "new_request" && ownerOrg?.email) {
      await sendEmail(
        ownerOrg.email,
        `New ${typeLabel} Request: ${req_data.item_name}`,
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
          ${header(Bowner)}
          <h2 style="font-family:Georgia,serif;color:#1a0600">New ${typeLabel} Request</h2>
          <p>You have a new request from <strong>${requesterOrg?.name || req_data.requester_name || "a program"}</strong>.</p>
          <div style="background:#f9f3e8;border-left:4px solid #d4a843;padding:12px 16px;border-radius:4px;margin:16px 0">
            <p style="margin:0 0 6px"><strong>Item:</strong> ${req_data.item_name}</p>
            <p style="margin:0 0 6px"><strong>Type:</strong> ${typeLabel}</p>
            <p style="margin:0 0 6px"><strong>Dates:</strong> ${dateRange}</p>
            <p style="margin:0 0 6px"><strong>Quantity:</strong> ${req_data.qty_requested}</p>
            ${req_data.message ? `<p style="margin:0"><strong>Message:</strong> ${req_data.message}</p>` : ""}
          </div>
          ${cta(Bowner, `Review Request on ${Bowner.name} &rarr;`)}
          ${footer(Bowner)}
        </div>`,
        Bowner
      );
    }

    if (type === "accepted" && requesterOrg?.email) {
      await sendEmail(
        requesterOrg.email,
        `Your request was accepted: ${req_data.item_name}`,
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
          ${header(Breq)}
          <h2 style="font-family:Georgia,serif;color:#27723a">&#x2713; Request Accepted!</h2>
          <p><strong>${ownerOrg?.name || "The listing owner"}</strong> has accepted your ${typeLabel.toLowerCase()} request.</p>
          <div style="background:#f0faf2;border-left:4px solid #27723a;padding:12px 16px;border-radius:4px;margin:16px 0">
            <p style="margin:0 0 6px"><strong>Item:</strong> ${req_data.item_name}</p>
            <p style="margin:0 0 6px"><strong>Dates:</strong> ${dateRange}</p>
            <p style="margin:0"><strong>Quantity:</strong> ${req_data.qty_requested}</p>
          </div>
          <p style="color:#555">A conversation thread has been opened so you can coordinate pickup, delivery, and any other details.</p>
          ${cta(Breq, `Open Messages on ${Breq.name} &rarr;`)}
          ${footer(Breq)}
        </div>`,
        Breq
      );
    }

    if (type === "declined" && requesterOrg?.email) {
      await sendEmail(
        requesterOrg.email,
        `Request update: ${req_data.item_name}`,
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
          ${header(Breq)}
          <h2 style="font-family:Georgia,serif;color:#c2185b">Request Declined</h2>
          <p><strong>${ownerOrg?.name || "The listing owner"}</strong> is unable to fulfil your ${typeLabel.toLowerCase()} request at this time.</p>
          ${req_data.decline_reason ? `<div style="background:#fdf2f5;border-left:4px solid #c2185b;padding:12px 16px;border-radius:4px;margin:16px 0"><p style="margin:0"><strong>Reason:</strong> ${req_data.decline_reason}</p></div>` : ""}
          <p style="color:#555">You can message them directly to discuss alternatives or check other listings in the Exchange.</p>
          ${cta(Breq, `Browse the Exchange &rarr;`)}
          ${footer(Breq)}
        </div>`,
        Breq
      );
    }

    if (type === "returned" && ownerOrg?.email) {
      await sendEmail(
        ownerOrg.email,
        `Item marked returned: ${req_data.item_name}`,
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
          ${header(Bowner)}
          <h2 style="font-family:Georgia,serif;color:#1a0600">Item Marked as Returned</h2>
          <p><strong>${req_data.item_name}</strong> has been marked as returned by ${requesterOrg?.name || "the borrower"}. The dates have been unblocked on your availability calendar.</p>
          ${cta(Bowner, `View Your Inventory &rarr;`)}
          ${footer(Bowner)}
        </div>`,
        Bowner
      );
    }

    return json({ ok: true });
  } catch(e) {
    return json({ error: String(e) }, 500);
  }
});
