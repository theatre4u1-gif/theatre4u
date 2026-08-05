// pending-notify — emails the program's director/owner when a team member submits an
// item that is waiting for approval (student upload review queue). Door-aware brand.
// Called fire-and-forget from the client on a student-tier submission. verify_jwt=false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

const BRANDS = {
  theatre4u:   { name: "Theatre4u",   site: "https://theatre4u.org",   from: "Theatre4u <hello@theatre4u.org>",   reply: "hello@theatre4u.org" },
  artstracker: { name: "ArtsTracker", site: "https://artstracker.org", from: "ArtsTracker <hello@theatre4u.org>", reply: "hello@artstracker.org" },
};
const brandFor = (d?: string, v?: string) =>
  ((v || "theatre") !== "theatre") ? BRANDS.artstracker
  : ((d || "").includes("artstracker") ? BRANDS.artstracker : BRANDS.theatre4u);

const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const cors = () => ({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" });
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors(), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const { org_id, item_name, submitter } = await req.json().catch(() => ({}));
    if (!org_id) return json({ ok: true, skipped: "no org_id" });

    const { data: org } = await sb.from("orgs").select("email,name,vertical,signup_domain").eq("id", org_id).single();
    if (!org?.email) return json({ ok: true, skipped: "no email" });
    const B = brandFor(org.signup_domain, org.vertical);
    const who = submitter ? ` (${esc(submitter)})` : "";
    const what = item_name ? `: <strong>${esc(item_name)}</strong>` : "";

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: B.from, reply_to: B.reply, to: [org.email],
          subject: `An item is waiting for your approval on ${B.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px;background:#fff">
              <h2 style="font-family:Georgia,serif;color:#1a0600">Something needs your approval</h2>
              <p style="color:#444">A team member${who} submitted a new item to <strong>${esc(org.name) || B.name}</strong>${what}. It will not appear in your catalog until you approve it.</p>
              <p style="color:#444">Open your inventory to review the photo, then approve or reject it.</p>
              <div style="text-align:center;margin:24px 0">
                <a href="${B.site}" style="display:inline-block;background:#d4a843;color:#1a0600;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">Review pending items &rarr;</a>
              </div>
              <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:14px">You received this because you manage ${esc(org.name) || B.name} on ${B.name} &middot; ${B.reply}</p>
            </div>`,
        }),
      });
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
