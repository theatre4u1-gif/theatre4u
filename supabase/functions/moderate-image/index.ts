// moderate-image — screens an uploaded image URL for explicit / adult content.
//
// STATUS: ready to deploy, but INERT until a provider key is configured.
//   - If GOOGLE_VISION_API_KEY is set, it uses Google Cloud Vision SafeSearch.
//   - Otherwise it fails OPEN (returns allowed:true) so it never blocks uploads
//     before it is configured.
//
// The client (uploadPhoto in items.jsx) only calls this when MODERATION_ON === true.
//
// IMPORTANT (child safety): generic SafeSearch detects adult/explicit content, NOT
// known child sexual abuse material (CSAM). CSAM detection requires a dedicated tool
// (Microsoft PhotoDNA or Thorn Safer) and a LEGAL reporting obligation to NCMEC.
// See the internal CSAM procedure. This function is the first (nudity) layer only.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") ?? "";

const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
});
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors(), "Content-Type": "application/json" } });

// Google SafeSearch likelihood buckets we treat as a rejection.
const BLOCK = new Set(["LIKELY", "VERY_LIKELY"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const { url } = await req.json().catch(() => ({ url: null }));
    if (!url) return json({ allowed: true, reason: "no-url" });

    // Not configured yet -> fail open (allow) so uploads are never blocked.
    if (!GOOGLE_VISION_API_KEY) return json({ allowed: true, reason: "moderation-not-configured" });

    const resp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ image: { source: { imageUri: url } }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }],
        }),
      },
    );
    const body = await resp.json();
    const ann = body?.responses?.[0]?.safeSearchAnnotation;
    if (!ann) return json({ allowed: true, reason: "no-annotation" });

    const adult = String(ann.adult || "");
    const racy = String(ann.racy || "");
    const violence = String(ann.violence || "");

    // Reject explicit adult content, strongly-racy content, or graphic violence.
    const rejected = BLOCK.has(adult) || racy === "VERY_LIKELY" || BLOCK.has(violence);

    return json({ allowed: !rejected, labels: { adult, racy, violence } });
  } catch (e) {
    // Fail open on any error — the report button + human review are the backstop.
    return json({ allowed: true, reason: "moderation-error", detail: String(e) });
  }
});
