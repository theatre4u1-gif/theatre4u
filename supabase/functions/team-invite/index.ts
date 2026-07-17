import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

// Brand by vertical: non-theatre programs (music/dance/art/booster) = ArtsTracker; theatre follows signup_domain.
type Brand = { name:string; site:string; host:string; from:string; reply:string; emoji:string; exchange:string };
const BRANDS: Record<string,Brand> = {
  theatre4u:   { name:"Theatre4u",   site:"https://theatre4u.org",   host:"theatre4u.org",   from:"Theatre4u <hello@theatre4u.org>",   reply:"hello@theatre4u.org",   emoji:"&#x1F3AD;", exchange:"Backstage Exchange" },
  artstracker: { name:"ArtsTracker", site:"https://artstracker.org", host:"artstracker.org", from:"ArtsTracker <hello@theatre4u.org>", reply:"hello@artstracker.org", emoji:"&#x1F3A8;", exchange:"The Exchange" },
};
const brandFor = (d?: string, v?: string): Brand =>
  ((v || "theatre") !== "theatre") ? BRANDS.artstracker
  : ((d || "").includes("artstracker") ? BRANDS.artstracker : BRANDS.theatre4u);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function formatExpiry(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    timeZone: "America/Chicago",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, ANON_KEY)
      .auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    if (!RESEND_KEY) {
      console.error("RESEND_API_KEY not set");
      return json({ error: "Email service not configured" }, 500);
    }

    const body = await req.json();
    const invite_id = body?.invite_id;
    if (!invite_id) return json({ error: "Missing invite_id" }, 400);

    const { data: invite, error: invErr } = await sb
      .from("org_invites")
      .select("id, org_id, email, role, token, expires_at")
      .eq("id", invite_id)
      .single();

    if (invErr || !invite) {
      console.error("Invite not found:", invErr);
      return json({ error: "Invite not found" }, 404);
    }

    if (invite.org_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (!invite.email) return json({ error: "No email on this invite" }, 400);

    const { data: org } = await sb.from("orgs").select("name, vertical, signup_domain").eq("id", user.id).single();
    const orgName = org?.name || "a program";
    const B = brandFor(org?.signup_domain, org?.vertical);

    const inviteUrl = `${B.site}/invite.html?token=${invite.token}`;

    const roleLabel = invite.role === "stage_manager" ? "Stage Manager"
      : invite.role === "co_director" ? "Co-Director"
      : invite.role === "crew" ? "Crew"
      : invite.role === "house" ? "House (view only)"
      : invite.role;

    const roleDesc = invite.role === "co_director"
      ? "Full access &mdash; same as director. Add, edit, delete items and manage the program."
      : invite.role === "stage_manager"
      ? `You can add, edit, and delete items, access the Funding Tracker, ${B.exchange}, and Community Board.`
      : invite.role === "crew"
      ? "You can add and edit items and upload photos."
      : "You can view and search inventory.";

    const expiryDisplay = formatExpiry(invite.expires_at);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: B.from,
        reply_to: B.reply,
        to: [invite.email],
        subject: `You've been invited to join ${orgName} on ${B.name}`,
        html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
  <div style="text-align:center;margin-bottom:24px">
    <span style="font-size:48px">${B.emoji}</span>
    <h1 style="font-family:Georgia,serif;color:#d4a843;margin:8px 0 4px">${B.name}</h1>
    <p style="color:#888;font-size:13px;margin:0">Inventory &amp; ${B.exchange}</p>
  </div>
  <h2 style="font-family:Georgia,serif;color:#1a0600">You've been invited!</h2>
  <p style="color:#444;line-height:1.6">
    <strong>${orgName}</strong> has invited you to join their team on ${B.name}
    as a <strong>${roleLabel}</strong>.
  </p>
  <p style="color:#444;line-height:1.6">
    Click below to accept. If you already have a ${B.name} account, sign in with your
    existing email &mdash; your team access will be applied automatically.
    If you're new, you'll create a free account (no email confirmation required).
  </p>
  <div style="text-align:center;margin:28px 0">
    <a href="${inviteUrl}"
      style="display:inline-block;background:#d4a843;color:#1a0600;padding:14px 32px;
             border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
      Accept Invitation &rarr;
    </a>
  </div>
  <p style="color:#888;font-size:13px;text-align:center">
    Or copy this link:<br>
    <a href="${inviteUrl}" style="color:#d4a843">${inviteUrl}</a>
  </p>
  <div style="background:#f9f5ee;border-radius:8px;padding:14px;margin:20px 0;font-size:13px;color:#666">
    <strong>Your role: ${roleLabel}</strong><br>${roleDesc}
  </div>
  <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
    If you didn't expect this email you can safely ignore it.
    This invite expires on ${expiryDisplay}.<br>
    Sent from ${B.name} &middot; Artstracker LLC &middot; ${B.reply}
  </p>
</div>`,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("Resend error:", errBody);
      return json({
        success: true,
        email_sent: false,
        invite_url: inviteUrl,
        warning: "Invite saved but email failed. Use Copy Link to share manually.",
      });
    }

    console.log("Team invite email sent to:", invite.email);
    return json({ success: true, email_sent: true, invite_url: inviteUrl });

  } catch (e) {
    console.error("team-invite error:", e);
    return json({ error: String(e) }, 500);
  }
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
