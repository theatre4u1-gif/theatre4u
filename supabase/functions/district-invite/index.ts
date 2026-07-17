import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!)
      .auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    if (!RESEND_KEY) {
      console.error("RESEND_API_KEY is not set in Supabase edge function secrets");
      return json({ error: "Email service not configured. Please contact the administrator." }, 500);
    }

    const { email, school_name } = await req.json();
    if (!email) return json({ error: "Missing email" }, 400);

    // Owner org drives branding (vertical + signup_domain)
    const { data: ownerOrg } = await sb.from("orgs").select("name, vertical, signup_domain").eq("id", user.id).single();
    const B = brandFor(ownerOrg?.signup_domain, ownerOrg?.vertical);

    // Find or auto-create district for this user
    let { data: district } = await sb.from("districts")
      .select("id, name, max_schools")
      .eq("owner_id", user.id)
      .single();

    if (!district) {
      const { data: newDist, error: distErr } = await sb.from("districts")
        .insert({ owner_id: user.id, name: ownerOrg?.name || "", max_schools: 6 })
        .select("id, name, max_schools")
        .single();
      if (distErr) return json({ error: "Could not create district: " + distErr.message }, 500);
      district = newDist;
    }

    const { count } = await sb.from("orgs")
      .select("id", { count: "exact", head: true })
      .eq("district_id", district.id);
    if ((count ?? 0) >= district.max_schools)
      return json({ error: `District limit reached (${district.max_schools} schools max)` }, 400);

    const { data: existing } = await sb.from("district_invites")
      .select("id, status")
      .eq("district_id", district.id)
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .single();
    if (existing) return json({ error: "An invite was already sent to this email. Check the Invites tab to copy the link." }, 400);

    const { data: invite, error: invErr } = await sb.from("district_invites")
      .insert({ district_id: district.id, email: email.toLowerCase(), school_name, invited_by: user.id })
      .select()
      .single();
    if (invErr) return json({ error: invErr.message }, 500);

    const inviteUrl = `${B.site}?invite=${invite.token}`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: B.from,
        reply_to: B.reply,
        to: [email],
        subject: `You're invited to join ${district.name || "a district"} on ${B.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
            <div style="text-align:center;margin-bottom:24px">
              <span style="font-size:48px">${B.emoji}</span>
              <h1 style="font-family:Georgia,serif;color:#d4a843;margin:8px 0 4px">${B.name}</h1>
              <p style="color:#888;font-size:13px;margin:0">Inventory &amp; Community</p>
            </div>
            <h2 style="font-family:Georgia,serif;color:#1a0600">You've been invited!</h2>
            <p style="color:#444;line-height:1.6">You've been invited to join <strong>${district.name || "a district"}</strong> on ${B.name}${school_name ? ` as <strong>${school_name}</strong>` : ""}.</p>
            <p style="color:#444;line-height:1.6">If you already have a ${B.name} account, <strong>sign in</strong> with your existing email and password &mdash; your inventory will link automatically. If you're new, create a free account.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${inviteUrl}" style="display:inline-block;background:#d4a843;color:#1a0600;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">Accept Invitation &#8594;</a>
            </div>
            <p style="color:#888;font-size:13px;text-align:center">Or copy this link: <a href="${inviteUrl}" style="color:#d4a843">${inviteUrl}</a></p>
            <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin-top:24px">If you didn't expect this email you can safely ignore it. This invite expires in 7 days.<br>Sent from ${B.name} &middot; ${B.reply}</p>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("Resend error:", errBody);
      return json({
        success: true,
        email_sent: false,
        invite_url: inviteUrl,
        token: invite.token,
        warning: "Invite created but email failed to send. Use the Copy Link button in the Invites tab."
      });
    }

    console.log("Invite email sent successfully to:", email);
    return json({ success: true, email_sent: true, invite_url: inviteUrl, token: invite.token });

  } catch (e) {
    console.error("district-invite error:", e);
    return json({ error: String(e) }, 500);
  }
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(), "Content-Type": "application/json" } });

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
