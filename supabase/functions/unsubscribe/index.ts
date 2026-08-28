// Public unsubscribe endpoint for marketing emails (CAN-SPAM).
// GET  /unsubscribe?t=<token>            -> opt the org out, show a confirmation page
// GET  /unsubscribe?t=<token>&action=resubscribe -> opt back in
// POST /unsubscribe?t=<token>            -> one-click (List-Unsubscribe-Post), returns 200
// No auth required (deploy with verify_jwt=false); the random per-org token is the credential.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Some mail gateways / link rewriters deliver the unsubscribe link with the token
// base64 encoded and truncated (observed in the wild: ".../unsubscribe/YzdjZDY4Nz",
// which is base64 of the first characters of a real token). A silently failed
// unsubscribe is a CAN-SPAM problem, so recover the token where we safely can.
const TOKEN_PREFIX = /^[0-9a-fA-F]{4,}(-[0-9a-fA-F]*)*$/;
const MIN_PREFIX = 7;

function decodeMangled(seg: string): string {
  try {
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const out = atob(padded);
    return /^[\x20-\x7e]*$/.test(out) ? out : "";
  } catch {
    return "";
  }
}

// Resolve a partial token to exactly one org. Ambiguous or too-short prefixes are refused.
async function resolvePrefix(prefix: string): Promise<string | null> {
  if (prefix.replace(/-/g, "").length < MIN_PREFIX) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orgs?select=unsubscribe_token`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows)) return null;
  const hits = rows
    .map((o: { unsubscribe_token?: string }) => o?.unsubscribe_token ?? "")
    .filter((t: string) => t && t.toLowerCase().startsWith(prefix.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}

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
  let rawSeg = "";
  if (parts.length) {
    const last = parts[parts.length - 1];
    if (last === "resubscribe") {
      action = "resubscribe";
      if (parts.length >= 2) {
        const prev = parts[parts.length - 2];
        if (UUID.test(prev)) token = prev; else rawSeg = prev;
      }
    } else if (!UUID.test(token) && UUID.test(last)) {
      token = last;
    } else if (!UUID.test(token) && last !== "unsubscribe") {
      rawSeg = last;
    }
  }

  // Recovery path: the segment was not a clean UUID. Log it (so mangling patterns are
  // visible in the function logs) and try to decode / prefix-match it to one org.
  if (!UUID.test(token) && rawSeg) {
    console.log(`unsubscribe: non-UUID token segment received: ${rawSeg}`);
    const decoded = decodeMangled(rawSeg);
    if (UUID.test(decoded)) {
      token = decoded;
    } else {
      const candidate = decoded && TOKEN_PREFIX.test(decoded) ? decoded : (TOKEN_PREFIX.test(rawSeg) ? rawSeg : "");
      if (candidate) {
        const full = await resolvePrefix(candidate);
        if (full) {
          console.log(`unsubscribe: recovered token from partial "${rawSeg}"`);
          token = full;
        }
      }
    }
  }

  // One-click unsubscribe (email clients POST to the List-Unsubscribe URL)
  if (req.method === "POST") {
    if (UUID.test(token)) await setOptOut(token, true);
    return new Response("ok", { status: 200 });
  }

  const html = (h: string, m: string, e = "") =>
    new Response(page(h, m, e), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });

  const MAILTO = `<p style="font-size:14px;margin:0"><a href="mailto:hello@theatre4u.org?subject=unsubscribe&amp;body=Please%20unsubscribe%20this%20address." style="color:#841C56;font-weight:bold">Click here to email us and we will remove you right away.</a></p>`;

  if (!UUID.test(token)) {
    return html("Link problem", "Some email programs shorten links, which can break this one. We are sorry for the trouble.", MAILTO);
  }

  if (action === "resubscribe") {
    const ok = await setOptOut(token, false);
    return ok
      ? html("You are resubscribed", "You will receive Theatre4u and ArtsTracker updates again. Thanks for coming back.")
      : html("Link problem", "We could not find your account for that link.", MAILTO);
  }

  const ok = await setOptOut(token, true);
  if (!ok) {
    return html("Link problem", "We could not find your account for that link.", MAILTO);
  }
  const resubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe/${token}/resubscribe`;
  return html(
    "You have been unsubscribed",
    "You will no longer receive our getting-started and update emails. Important account emails (like sign-in and billing) may still be sent.",
    `<p style="font-size:13px;color:#777;margin:0"><a href="${resubUrl}" style="color:#841C56">Changed your mind? Resubscribe.</a></p>`
  );
});
