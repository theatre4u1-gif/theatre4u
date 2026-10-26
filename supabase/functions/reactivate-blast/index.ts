// reactivate-blast — one-off activation nudge to never-activated signups (0 items).
// Schools only (Theatre4u / ArtsTracker), brand-aware. Honors email_opt_out, includes the
// platform one-click Unsubscribe + physical address (CAN-SPAM), and logs each send to
// email_sequence (email_num 99) so no one is emailed twice. The scheduler only sends 0-6,
// so 99 never goes out on the drip.
// Guarded by ?key=<BLAST_KEY>. Dry run: ?key=...&dry=1 (returns the recipient list, sends nothing).
// Deploy: supabase functions deploy reactivate-blast --no-verify-jwt --project-ref ldmmphwivnnboyhlxipl
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const BLAST_KEY = Deno.env.get("BLAST_KEY") || "reactivate-2026";
const EMAIL_NUM = 99; // reactivation marker; drip scheduler only sends 0-6
const ADDR = "Artstracker LLC &middot; 10441 Stanford Ave., #1155, Garden Grove, CA 92842";

type B = { name: string; plain: string; site: string; host: string; from: string; reply: string };
const T4U: B = { name: "Theatre4u", plain: "Theatre4u", site: "https://theatre4u.org", host: "theatre4u.org", from: "Bob Zick at Theatre4u <hello@theatre4u.org>", reply: "hello@theatre4u.org" };
const AT:  B = { name: "ArtsTracker", plain: "ArtsTracker", site: "https://artstracker.org", host: "artstracker.org", from: "Bob Zick at ArtsTracker <hello@theatre4u.org>", reply: "hello@artstracker.org" };
const brandOf = (o: Record<string, unknown>): B =>
  ((o.vertical && o.vertical !== "theatre") || String(o.signup_domain || "").includes("artstracker")) ? AT : T4U;

function buildHtml(B: B, name: string, org: string, unsub: string): string {
  const sp = B === AT ? "space" : "theatre";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif;color:#333">
  <div style="max-width:540px;margin:0 auto;background:#fff">
   <div style="background:#1a1200;padding:16px 28px"><span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#d4a843">${B.plain}</span></div>
   <div style="padding:22px 28px;font-size:15px;line-height:1.65">
    <p>Hi ${name},</p>
    <p>You created your ${B.plain} account for <strong>${org}</strong> a little while back, but it looks like nothing&rsquo;s been added yet &mdash; completely understandable, the hardest part is just starting.</p>
    <p>The good news: it&rsquo;s faster than you&rsquo;d think, especially from your phone. Three ways:</p>
    <ul style="line-height:1.7;padding-left:20px">
      <li><strong>Scan several at once:</strong> point your camera at a shelf or a rack and ${B.plain} lists every item it sees &mdash; you review and save. The quickest way to add 10+ at once.</li>
      <li><strong>From your phone:</strong> open the app at <a href="${B.site}/app.html" style="color:#8b6914;font-weight:700">${B.host}/app.html</a> and snap items as you walk your ${sp}.</li>
      <li><strong>One at a time:</strong> sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>, open Inventory, and click + Add.</li>
    </ul>
    <p>Your first <strong>25 items are free forever</strong>, no card needed. Once a handful are in, the QR codes, storage locations, and reports all start working for you.</p>
    <p>If anything&rsquo;s in the way &mdash; or you&rsquo;d like me to walk you through it &mdash; just reply. I read every one.</p>
    <p style="margin-bottom:0">&mdash; Bob, ${B.plain}</p>
   </div>
   <div style="padding:14px 28px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa;line-height:1.7">${B.name} &mdash; ${ADDR}<br/><a href="${B.site}" style="color:#aaa">${B.host}</a> &middot; <a href="${unsub}" style="color:#aaa;text-decoration:underline">Unsubscribe</a><br/><span style="color:#bbb">You are receiving this because you signed up for ${B.name}.</span></div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if ((u.searchParams.get("key") || "") !== BLAST_KEY) return new Response("forbidden", { status: 403 });
  const dry = u.searchParams.get("dry") === "1";
  const sb = createClient(SB_URL, SVC, { auth: { persistSession: false } });

  // Any email that has a PAID org anywhere is a real customer — never nudge them with the
  // free-tier message, even if they also created a second empty free org.
  const { data: paidRows } = await sb.from("orgs").select("email").not("stripe_subscription_id", "is", null);
  const paidEmails = new Set((paidRows || []).map((p) => String(p.email || "").toLowerCase()));

  // Candidate real schools orgs (exclude home, test/internal, comped HBUHSD, closed/deleted,
  // opted-out, and anything without a plausible email).
  const { data: cands } = await sb.from("orgs")
    .select("id,name,email,director_name,vertical,signup_domain,unsubscribe_token,email_opt_out,account_status,deleted_at,kind,stripe_subscription_id")
    .not("account_status", "in", "(closed,deleted)")
    .is("deleted_at", null)
    .is("stripe_subscription_id", null)   // free accounts only — paid customers get a different touch
    .neq("kind", "home")
    .or("email_opt_out.is.null,email_opt_out.eq.false")
    .not("email", "ilike", "%theatre4u1%")
    .not("email", "ilike", "rzickjr%")
    .not("email", "ilike", "%@theatre4u.or%")
    .not("email", "ilike", "%hbuhsd.edu")
    .like("email", "%@%.%")
    .limit(2000);

  const picked: { id: string; email: string; name: string; org: string; brand: string }[] = [];
  let sent = 0, skippedAlready = 0, errors = 0;

  for (const o of (cands || [])) {
    // never activated?
    const { count: items } = await sb.from("items").select("id", { count: "exact", head: true }).eq("org_id", o.id);
    if ((items ?? 0) > 0) continue;
    if (paidEmails.has(String(o.email || "").toLowerCase())) continue; // email belongs to a paying customer elsewhere
    // already got this reactivation?
    const { data: ex } = await sb.from("email_sequence").select("id").eq("org_id", o.id).eq("email_num", EMAIL_NUM).maybeSingle();
    if (ex) { skippedAlready++; continue; }

    const B = brandOf(o as Record<string, unknown>);
    const first = ((o.director_name as string) || "").trim().split(/\s+/)[0] || "there";
    const localPart = String(o.email || "").split("@")[0].toLowerCase();
    let org = (o.name as string) || "your program";
    if (!org.includes(" ") && org.toLowerCase() === localPart) org = "your program"; // name is just an email prefix
    picked.push({ id: o.id as string, email: o.email as string, name: first, org, brand: B.plain });
    if (dry) continue;

    try {
      const unsub = `${SB_URL}/functions/v1/unsubscribe/${o.unsubscribe_token}`;
      const headers: Record<string, string> = {
        "List-Unsubscribe": `<${unsub}>, <mailto:hello@theatre4u.org?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: B.from, reply_to: B.reply, to: [o.email],
          subject: "Stuck on where to start? Add your first 10 in a few minutes",
          html: buildHtml(B, first, org, unsub), headers,
        }),
      });
      const rid = r.ok ? ((await r.json())?.id ?? null) : null;
      if (!r.ok) { errors++; } else { sent++; }
      await sb.from("email_sequence").insert({ org_id: o.id, email_num: EMAIL_NUM, resend_id: rid, status: r.ok ? "sent" : "error" });
    } catch (_e) { errors++; }
  }

  return new Response(JSON.stringify({
    dry, matched: picked.length, sent, skipped_already: skippedAlready, errors,
    recipients: dry ? picked.map(p => ({ email: p.email, org: p.org, brand: p.brand })) : undefined,
  }), { headers: { "Content-Type": "application/json" } });
});
