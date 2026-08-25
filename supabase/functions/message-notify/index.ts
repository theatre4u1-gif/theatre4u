import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

// Brand by vertical: non-theatre programs (music/dance/art/booster) = ArtsTracker; theatre follows signup_domain.
const BRANDS = {
  theatre4u:   { name:"Theatre4u",   site:"https://theatre4u.org",   host:"theatre4u.org",   from:"Theatre4u <hello@theatre4u.org>",   reply:"hello@theatre4u.org",   emoji:"&#x1F3AD;", mark:"https://theatre4u.org/logo-mark-theatre4u.png", mw:57, tag:"Built for the people who make theatre happen." },
  artstracker: { name:"ArtsTracker", site:"https://artstracker.org", host:"artstracker.org", from:"ArtsTracker <hello@theatre4u.org>", reply:"hello@artstracker.org", emoji:"&#x1F3A8;", mark:"https://theatre4u.org/logo-mark-artstracker.png", mw:62, tag:"Arts programs, organized." },
};
const brandFor = (d?: string, v?: string) =>
  ((v || "theatre") !== "theatre") ? BRANDS.artstracker
  : ((d || "").includes("artstracker") ? BRANDS.artstracker : BRANDS.theatre4u);

// Escape user-supplied text before interpolating into the HTML email body (prevents injection/phishing).
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { conversation_id, message_preview } = await req.json();
    if (!conversation_id) return json({ error: "conversation_id required" }, 400);

    // Authorize: the caller must be a participant in this conversation. Recipient and sender name
    // are derived server-side from the conversation/orgs — never trusted from the request body
    // (which previously let any user email any org with a spoofed sender and arbitrary HTML).
    const { data: conv } = await sb.from("conversations")
      .select("org_a, org_b, item_name").eq("id", conversation_id).single();
    if (!conv || (user.id !== conv.org_a && user.id !== conv.org_b)) return json({ error: "Forbidden" }, 403);
    const recipientId = user.id === conv.org_a ? conv.org_b : conv.org_a;

    const { data: recipientOrg } = await sb.from("orgs")
      .select("email, name, vertical, signup_domain").eq("id", recipientId).single();
    if (!recipientOrg?.email) return json({ ok: true, skipped: "no email" });
    const { data: senderOrg } = await sb.from("orgs").select("name").eq("id", user.id).single();

    const senderName = esc(senderOrg?.name || "A program");
    const itemName   = esc(conv.item_name || "");
    const preview    = esc(message_preview || "");
    const B = brandFor(recipientOrg.signup_domain, recipientOrg.vertical);

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: B.from,
          reply_to: B.reply,
          to: [recipientOrg.email],
          subject: `New message from ${senderOrg?.name || "a program"} on ${B.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
              <div style="text-align:center;margin-bottom:20px">
                <span style="font-size:40px">${B.emoji}</span>
                <h1 style="font-family:Georgia,serif;color:#d4a843;margin:6px 0 2px">${B.name}</h1>
              </div>
              <h2 style="font-family:Georgia,serif;color:#1a0600">You have a new message</h2>
              ${itemName ? `<p style="color:#666">About: <strong>${itemName}</strong></p>` : ""}
              <p style="color:#444">From: <strong>${senderName}</strong></p>
              <div style="background:#f9f3e8;border-left:4px solid #d4a843;padding:12px 16px;border-radius:4px;margin:16px 0">
                <p style="color:#333;margin:0;font-style:italic">${preview}</p>
              </div>
              <div style="text-align:center;margin:24px 0">
                <a href="${B.site}" style="display:inline-block;background:#d4a843;color:#1a0600;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">Reply on ${B.name} &rarr;</a>
              </div>
              <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:14px">You're receiving this because you have an account on ${B.name} &middot; ${B.reply}</p>
            </div>
          `
        })
      });
    }
    return json({ ok: true });
  } catch(e) {
    return json({ error: String(e) }, 500);
  }
});

const json = (d: unknown, s=200) => new Response(JSON.stringify(d), { status:s, headers:{...cors(),"Content-Type":"application/json"} });
const cors = () => ({ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type", "Access-Control-Allow-Methods":"POST,OPTIONS" });
