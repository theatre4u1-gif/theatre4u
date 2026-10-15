// scan-item — BinTrove AI Scan (Phase 1, single item).
//
// Flow: client uploads a photo to the item-photos bucket (public URL), then calls
// this with { url }. We authenticate the caller, check the global kill-switch and
// the caller's remaining scan allotment, then ask Anthropic Haiku (vision) to
// propose ONE catalog entry. We log the scan and return the suggestion. We never
// write items — the client prefills the Add-Item form and the user confirms.
//
// Deploy:  supabase functions deploy scan-item --no-verify-jwt --project-ref ldmmphwivnnboyhlxipl
// (verify_jwt MUST be false; we validate the JWT ourselves below.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// Keep in sync with SCAN_LIMITS in src/core/plans.js.
const SCAN_LIMITS: Record<string, { limit: number; period: "lifetime" | "month" | "window" }> = {
  free:      { limit: 10,  period: "lifetime" },
  starter:   { limit: 50,  period: "month" },
  home:      { limit: 150, period: "month" },
  home_plus: { limit: 500, period: "month" },
  move:      { limit: 150, period: "window" },
};

// BinTrove home categories (must match lib/verticals.js home.categories ids).
const HOME_CATEGORIES = [
  "holiday", "decor", "kitchen", "tools", "outdoor", "keepsakes",
  "electronics", "clothing", "kids", "documents", "sports", "other",
];
const HOME_CONDITIONS = ["New", "Good", "Used", "Fragile", "For Donation"];

const SYSTEM = `You catalog home belongings for BinTrove, a home-inventory app. You are shown ONE photo of an item (or a small group that should be logged as a single entry, e.g. "a set of 6 wine glasses"). Return ONE catalog entry as strict JSON, nothing else.

Rules:
- name: short, specific, title-case (e.g. "Cordless Drill", "Ceramic Dinner Plates", "Holiday String Lights"). No brand guesses unless the brand is clearly legible.
- category: choose the single best id from this list ONLY: ${HOME_CATEGORIES.join(", ")}. If unsure, use "other".
- condition: one of: ${HOME_CONDITIONS.join(", ")}.
- quantity: integer count of like items visible (default 1).
- est_value: rough USD resale/replacement estimate as a number (no currency symbol). Omit or use null if you truly cannot tell.
- notes: one short phrase of useful detail (color, size, material). Keep under 12 words.
- confidence: "high", "medium", or "low" — your confidence in the identification.

Output ONLY a JSON object with keys: name, category, condition, quantity, est_value, notes, confidence. No prose, no markdown fences.`;

function periodStart(plan: string, planExpiresAt: string | null): string {
  const now = new Date();
  const def = SCAN_LIMITS[plan] || SCAN_LIMITS.free;
  if (def.period === "lifetime") return new Date(0).toISOString();
  if (def.period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  // window (Move pass): count within the 30 days ending at plan_expires_at,
  // or the last 30 days if no expiry is set yet.
  if (planExpiresAt) {
    const end = new Date(planExpiresAt).getTime();
    return new Date(end - 30 * 86400000).toISOString();
  }
  return new Date(now.getTime() - 30 * 86400000).toISOString();
}

function parseSuggestion(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let t = text.trim();
  // strip ```json fences if present
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"); const b = t.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (!SERVICE_KEY) return json({ error: "server", message: "Service not configured." }, 500);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // ── Authenticate the caller from the Bearer token ──
    const authz = req.headers.get("Authorization") || "";
    const token = authz.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "auth", message: "Please sign in and try again." }, 401);
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "auth", message: "Please sign in and try again." }, 401);
    const orgId = user.id; // org id === auth uid in this app

    const { url } = await req.json().catch(() => ({ url: null }));
    if (!url || typeof url !== "string") return json({ error: "input", message: "No image provided." }, 400);

    // ── Global kill-switch ──
    const { data: setting } = await sb.from("app_settings").select("value").eq("key", "ai_scan").maybeSingle();
    const cfg = (setting?.value ?? {}) as { enabled?: boolean; daily_global_cap?: number };
    if (cfg.enabled === false) {
      await sb.from("ai_scan_log").insert({ org_id: orgId, status: "killswitch" });
      return json({ error: "disabled", message: "AI Scan is temporarily unavailable. Please add items manually for now." }, 503);
    }
    if (typeof cfg.daily_global_cap === "number") {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count: todayTotal } = await sb
        .from("ai_scan_log").select("id", { count: "exact", head: true })
        .eq("status", "ok").gte("created_at", since);
      if ((todayTotal ?? 0) >= cfg.daily_global_cap) {
        await sb.from("ai_scan_log").insert({ org_id: orgId, status: "killswitch" });
        return json({ error: "disabled", message: "AI Scan is busy right now. Please try again later or add items manually." }, 503);
      }
    }

    // ── Entitlement: scans remaining for this org's plan + period ──
    const { data: org } = await sb.from("orgs").select("home_plan, plan_expires_at").eq("id", orgId).maybeSingle();
    const plan = (org?.home_plan || "free") as string;
    const def = SCAN_LIMITS[plan] || SCAN_LIMITS.free;
    const since = periodStart(plan, org?.plan_expires_at ?? null);
    const { count: used } = await sb
      .from("ai_scan_log").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).eq("status", "ok").gte("created_at", since);
    const usedN = used ?? 0;
    if (usedN >= def.limit) {
      return json({ error: "limit", used: usedN, limit: def.limit, plan,
        message: "You've used all your AI scans for this plan. Upgrade for more, or add this item manually." }, 402);
    }

    if (!ANTHROPIC_KEY) return json({ error: "server", message: "AI Scan is not configured yet." }, 500);

    // ── Vision call (Anthropic Haiku) ──
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url } },
            { type: "text", text: "Identify this item and return the JSON entry." },
          ],
        }],
      }),
    });
    if (!r.ok) {
      await sb.from("ai_scan_log").insert({ org_id: orgId, status: "error" });
      return json({ error: "ai", message: "The scan didn't go through. Please try again or add the item manually." }, 502);
    }
    const d = JSON.parse(await r.text());
    const text = d?.content?.[0]?.text || "";
    const sug = parseSuggestion(text);
    if (!sug) {
      await sb.from("ai_scan_log").insert({ org_id: orgId, status: "error" });
      return json({ error: "parse", message: "Couldn't read that photo. Try a clearer shot, or add the item manually." }, 502);
    }

    // Normalize / clamp to our vocabulary.
    const category = HOME_CATEGORIES.includes(String(sug.category)) ? String(sug.category) : "other";
    const condition = HOME_CONDITIONS.includes(String(sug.condition)) ? String(sug.condition) : "Good";
    let quantity = parseInt(String(sug.quantity ?? 1), 10); if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    let estValue: number | null = null;
    const ev = Number(sug.est_value);
    if (Number.isFinite(ev) && ev >= 0) estValue = Math.round(ev * 100) / 100;

    const suggestion = {
      name: String(sug.name ?? "").slice(0, 120),
      category,
      condition,
      quantity,
      est_value: estValue,
      notes: String(sug.notes ?? "").slice(0, 160),
      confidence: ["high", "medium", "low"].includes(String(sug.confidence)) ? String(sug.confidence) : "medium",
    };

    await sb.from("ai_scan_log").insert({ org_id: orgId, status: "ok", mode: "single", item_count: 1 });

    return json({ suggestion, used: usedN + 1, limit: def.limit, plan });
  } catch (e) {
    return json({ error: "server", message: "Something went wrong. Please try again or add the item manually.", detail: String(e) }, 500);
  }
});
