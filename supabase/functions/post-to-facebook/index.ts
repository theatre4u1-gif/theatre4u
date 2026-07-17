import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Load config value from app_config table
async function cfg(key: string): Promise<string> {
  const { data } = await sb.from("app_config").select("value").eq("key", key).single();
  return data?.value ?? "";
}

// Refresh the page token using the long-lived user token
async function refreshPageToken(): Promise<string> {
  const appId     = await cfg("fb_app_id");
  const appSecret = await cfg("fb_app_secret");
  const userToken = await cfg("fb_user_token");
  const pageId    = await cfg("fb_page_id");

  // First extend the user token
  const extendRes = await fetch(
    `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`
  );
  const extended = await extendRes.json();
  if (!extended.access_token) throw new Error("Could not extend user token: " + JSON.stringify(extended));
  const newUserToken = extended.access_token;

  // Get page token using extended user token
  const pageRes = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}?fields=access_token&access_token=${newUserToken}`
  );
  const pageData = await pageRes.json();
  if (!pageData.access_token) throw new Error("Could not get page token: " + JSON.stringify(pageData));

  // Store refreshed tokens
  const expiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  await sb.from("app_config").upsert([
    { key: "fb_user_token",   value: newUserToken,              updated_at: new Date().toISOString() },
    { key: "fb_page_token",   value: pageData.access_token,     updated_at: new Date().toISOString() },
    { key: "fb_token_expires",value: expiry,                    updated_at: new Date().toISOString() },
  ], { onConflict: "key" });

  console.log("Tokens refreshed, new expiry:", expiry);
  return pageData.access_token;
}

// Post a message to the Theatre4U Facebook page
async function postToPage(message: string, link?: string): Promise<{ id: string }> {
  let pageToken = await cfg("fb_page_token");
  const pageId  = await cfg("fb_page_id");

  const body: Record<string, string> = { message, access_token: pageToken };
  if (link) body.link = link;

  let res = await fetch(`https://graph.facebook.com/v25.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = await res.json();

  // If token expired, refresh and retry once
  if (data.error?.code === 190) {
    console.log("Token expired, refreshing...");
    pageToken = await refreshPageToken();
    body.access_token = pageToken;
    res = await fetch(`https://graph.facebook.com/v25.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = await res.json();
  }

  if (data.error) throw new Error(data.error.message);
  return data; // { id: "pageId_postId" }
}

Deno.serve(async (req: Request) => {
  // Allow GET for token refresh check
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "refresh") {
      try {
        const token = await refreshPageToken();
        return new Response(JSON.stringify({ ok: true, message: "Tokens refreshed" }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch(e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500,
          headers: { "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ ok: true, message: "post-to-facebook edge function" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: { message?: string; link?: string; share_type?: string; source_id?: string; source_name?: string; org_id?: string; org_name?: string };
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const { message, link, share_type, source_id, source_name, org_id, org_name } = body;
  if (!message) return new Response(JSON.stringify({ ok: false, error: "message is required" }), {
    status: 400, headers: { "Content-Type": "application/json" }
  });

  // Log to social_shares before posting
  const shareRow = {
    org_id:      org_id || null,
    org_name:    org_name || null,
    share_type:  share_type || "manual",
    source_id:   source_id || null,
    source_name: source_name || null,
    platform:    "facebook",
    status:      "pending",
    content_text: message,
  };
  const { data: shareData } = await sb.from("social_shares").insert(shareRow).select().single();
  const shareId = shareData?.id;

  try {
    const result = await postToPage(message, link);
    const postUrl = `https://www.facebook.com/${result.id.replace("_", "/posts/")}`;

    // Update share log with success
    if (shareId) {
      await sb.from("social_shares").update({
        status: "posted",
        post_id: result.id,
        post_url: postUrl,
        posted_at: new Date().toISOString(),
      }).eq("id", shareId);
    }

    console.log("Posted to Facebook:", result.id);
    return new Response(JSON.stringify({ ok: true, post_id: result.id, post_url: postUrl }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch(e) {
    const errMsg = String(e);
    if (shareId) {
      await sb.from("social_shares").update({ status: "failed", error_msg: errMsg }).eq("id", shareId);
    }
    console.error("Facebook post failed:", errMsg);
    return new Response(JSON.stringify({ ok: false, error: errMsg }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});
