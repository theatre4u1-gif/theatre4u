import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      page = "landing",
      session_id,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      org_id,
      ref_code,
    } = body;

    // Detect Facebook traffic from referrer even without UTM
    let effectiveSource = utm_source || null;
    if (!effectiveSource && referrer) {
      if (referrer.includes("facebook") || referrer.includes("fb.com")) effectiveSource = "facebook";
      else if (referrer.includes("google")) effectiveSource = "google";
      else if (referrer.includes("instagram")) effectiveSource = "instagram";
      else if (referrer.includes("chatgpt")) effectiveSource = "chatgpt";
    }

    const ua = req.headers.get("user-agent") || null;

    await sb.from("page_views").insert({
      page,
      session_id: session_id || null,
      referrer: referrer || null,
      utm_source: effectiveSource,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      user_agent: ua,
      org_id: org_id || null,
      ref_code: ref_code || null,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});
