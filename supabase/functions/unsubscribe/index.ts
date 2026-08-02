// Public unsubscribe endpoint for marketing emails (CAN-SPAM).
// GET  /unsubscribe?t=<token>            -> opt the org out, show a confirmation page
// GET  /unsubscribe?t=<token>&action=resubscribe -> opt back in
// POST /unsubscribe?t=<token>            -> one-click (List-Unsubscribe-Post), returns 200
// No auth required (deploy with verify_jwt=false); the random per-org token is the credential.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function setOptOut(token: string, value: boolean): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orgs?unsubscribe_token=eq.${token}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ email_opt_out: value }),
  });
  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

function page(heading: string, message: string, extra = ""): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title></head>
<body style="margin:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif;color:#281b22">
  <div style="max-width:520px;margin:60px auto;background:#fff;border:1px solid #e8e0d0;border-radius:14px;overflow:hidden">
    <div style="background:#4C1035;padding:20px 28px;color:#fff;font-family:Georgia,serif;font-size:20px;font-weight:700">Theatre4u &amp; ArtsTracker</div>
    <div style="padding:28px">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${heading}</h1>
      <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 16px">${message}</p>
      ${extra}
    </div>
    <div style="padding:14px 28px;border-top:1px solid #e8e0d0;font-size:11px;color:#999;line-height:1.6">
      Artstracker LLC &middot; 10441 Stanford Ave., #1155, Garden Grove, CA 92842<br>
      Questions? <a href="mailto:hello@theatre4u.org" style="color:#841C56">hello@theatre4u.org</a>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Token can arrive as a path segment (/unsubscribe/<token> or /unsubscribe/<token>/resubscribe)
  // or as a ?t= query. Path form is more robust for email links (query params can be dropped).
  const parts = url.pathname.split("/").filter(Boolean);
  let token = (url.searchParams.get("t") || url.searchParams.get("token") || "").trim();
  let action = (url.searchParams.get("action") || "").trim();
  if (parts.length) {
    const last = parts[parts.length - 1];
    if (last === "resubscribe") {
      action = "resubscribe";
      if (parts.length >= 2 && UUID.test(parts[parts.length - 2])) token = parts[parts.length - 2];
    } else if (!UUID.test(token) && UUID.test(last)) {
      token = last;
    }
  }

  // One-click unsubscribe (email clients POST to the List-Unsubscribe URL)
  if (req.method === "POST") {
    if (UUID.test(token)) await setOptOut(token, true);
    return new Response("ok", { status: 200 });
  }

  const html = (h: string, m: string, e = "") =>
    new Response(page(h, m, e), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!UUID.test(token)) {
    return html("Link problem", "This unsubscribe link is not valid. If you keep getting emails you did not ask for, email us and we will remove you right away.");
  }

  if (action === "resubscribe") {
    const ok = await setOptOut(token, false);
    return ok
      ? html("You are resubscribed", "You will receive Theatre4u and ArtsTracker updates again. Thanks for coming back.")
      : html("Link problem", "We could not find your account for that link. Please email us and we will help.");
  }

  const ok = await setOptOut(token, true);
  if (!ok) {
    return html("Link problem", "We could not find your account for that link. Please email us and we will remove you right away.");
  }
  const resubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe/${token}/resubscribe`;
  return html(
    "You have been unsubscribed",
    "You will no longer receive our getting-started and update emails. Important account emails (like sign-in and billing) may still be sent.",
    `<p style="font-size:13px;color:#777;margin:0"><a href="${resubUrl}" style="color:#841C56">Changed your mind? Resubscribe.</a></p>`
  );
});
