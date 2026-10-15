// scan-item — BinTrove AI Scan. mode "single" (one item) or "batch" (a box/shelf -> many items).
//
// Flow: client uploads a photo to item-photos (public URL), then calls with { url, mode }.
// We authenticate the caller, check the global kill-switch and the caller's remaining scan
// allotment, then ask Anthropic Haiku (vision) to propose catalog entries. One photo = one
// scan regardless of how many items a batch returns. We log the scan and return suggestions.
// We never write items — the client prefills / shows a review list and the user confirms.
//
// Deploy: supabase functions deploy scan-item --no-verify-jwt --project-ref ldmmphwivnnboyhlxipl
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

const SCAN_LIMITS: Record<string, { limit: number; period: "lifetime" | "month" | "window" }> = {
  free:      { limit: 10,  period: "lifetime" },
  starter:   { limit: 50,  period: "month" },
  home:      { limit: 150, period: "month" },
  home_plus: { limit: 500, period: "month" },
  move:      { limit: 150, period: "window" },
};

const HOME_CATEGORIES = [
  "holiday", "decor", "kitchen", "tools", "outdoor", "keepsakes",
  "electronics", "clothing", "kids", "documents", "sports", "other",
];
const HOME_CONDITIONS = ["New", "Good", "Used", "Fragile", "For Donation"];
const MAX_BATCH = 20;

const FIELDS = `- name: short, specific, title-case (e.g. "Cordless Drill", "Ceramic Dinner Plates", "Holiday String Lights"). No brand guesses unless clearly legible.
- category: the single best id from this list ONLY: ${HOME_CATEGORIES.join(", ")}. If unsure, "other".
- condition: one of: ${HOME_CONDITIONS.join(", ")}.
- quantity: integer count of like items (default 1).
- est_value: rough USD resale/replacement estimate as a number (no symbol). null if you can't tell.
- notes: one short phrase (color, size, material), under 12 words.
- confidence: "high", "medium", or "low".`;

const SYSTEM_SINGLE = `You catalog home belongings for BinTrove. You are shown ONE photo of an item (or a small group logged as one entry, e.g. "a set of 6 wine glasses"). Return ONE catalog entry as strict JSON, nothing else, with keys: name, category, condition, quantity, est_value, notes, confidence.
${FIELDS}
Output ONLY the JSON object. No prose, no markdown fences.`;

const SYSTEM_BATCH = `You catalog home belongings for BinTrove. You are shown ONE photo of an open box, shelf, or pile containing MULTIPLE distinct items. Identify each clearly distinct item (group identical items into one entry with a quantity). Return up to ${MAX_BATCH} entries as strict JSON: an object with key "items" whose value is an array of entries, each with keys: name, category, condition, quantity, est_value, notes, confidence.
${FIELDS}
Only include items you can actually see. If you can only make out one item, return just that one. Output ONLY the JSON object. No prose, no markdown fences.`;

function periodStart(plan: string, planExpiresAt: string | null): string {
  const now = new Date();
  const def = SCAN_LIMITS[plan] || SCAN_LIMITS.free;
  if (def.period === "lifetime") return new Date(0).toISOString();
  if (def.period === "month") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  if (planExpiresAt) return new Date(new Date(planExpiresAt).getTime() - 30 * 86400000).toISOString();
  return new Date(now.getTime() - 30 * 86400000).toISOString();
}

function extractJson(text: string): unknown {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"); const b = t.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function normalize(raw: Record<string, unknown>) {
  const category = HOME_CATEGORIES.includes(String(raw.category)) ? String(raw.category) : "other";
  const condition = HOME_CONDITIONS.includes(String(raw.condition)) ? String(raw.condition) : "Good";
  let quantity = parseInt(String(raw.quantity ?? 1), 10); if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
  let estValue: number | null = null;
  const ev = Number(raw.est_value);
  if (Number.isFinite(ev) && ev >= 0) estValue = Math.round(ev * 100) / 100;
  return {
    name: String(raw.name ?? "").slice(0, 120),
    category, condition, quantity, est_value: estValue,
    notes: String(raw.notes ?? "").slice(0, 160),
    confidence: ["high", "medium", "low"].includes(String(raw.confidence)) ? String(raw.confidence) : "medium",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (!SERVICE_KEY) return json({ error: "server", message: "Service not configured." }, 500);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const authz = req.headers.get("Authorization") || "";
    const token = authz.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "auth", message: "Please sign in and try again." }, 401);
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "auth", message: "Please sign in and try again." }, 401);
    const orgId = user.id;

    const bodyIn = await req.json().catch(() => ({}));
    const url = bodyIn?.url;
    const mode = bodyIn?.mode === "batch" ? "batch" : "single";
    if (!url || typeof url !== "string") return json({ error: "input", message: "No image provided." }, 400);

    // Global kill-switch
    const { data: setting } = await sb.from("app_settings").select("value").eq("key", "ai_scan").maybeSingle();
    const cfg = (setting?.value ?? {}) as { enabled?: boolean; daily_global_cap?: number };
    if (cfg.enabled === false) {
      await sb.from("ai_scan_log").insert({ org_id: orgId, mode, status: "killswitch" });
      return json({ error: "disabled", message: "AI Scan is temporarily unavailable. Please add items manually for now." }, 503);
    }
    if (typeof cfg.daily_global_cap === "number") {
      const sinceDay = new Date(Date.now() - 86400000).toISOString();
      const { count: todayTotal } = await sb.from("ai_scan_log").select("id", { count: "exact", head: true }).eq("status", "ok").gte("created_at", sinceDay);
      if ((todayTotal ?? 0) >= cfg.daily_global_cap) {
        await sb.from("ai_scan_log").insert({ org_id: orgId, mode, status: "killswitch" });
        return json({ error: "disabled", message: "AI Scan is busy right now. Please try again later or add items manually." }, 503);
      }
    }

    // Entitlement
    const { data: org } = await sb.from("orgs").select("home_plan, plan_expires_at").eq("id", orgId).maybeSingle();
    const plan = (org?.home_plan || "free") as string;
    const def = SCAN_LIMITS[plan] || SCAN_LIMITS.free;
    const since = periodStart(plan, org?.plan_expires_at ?? null);
    const { count: used } = await sb.from("ai_scan_log").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "ok").gte("created_at", since);
    const usedN = used ?? 0;
    if (usedN >= def.limit) {
      return json({ error: "limit", used: usedN, limit: def.limit, plan,
        message: "You've used all your AI scans for this plan. Upgrade for more, or add this item manually." }, 402);
    }

    if (!ANTHROPIC_KEY) return json({ error: "server", message: "AI Scan is not configured yet." }, 500);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: mode === "batch" ? 1500 : 300,
        system: mode === "batch" ? SYSTEM_BATCH : SYSTEM_SINGLE,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url } },
            { type: "text", text: mode === "batch" ? "List the distinct items in this photo as the JSON described." : "Identify this item and return the JSON entry." },
          ],
        }],
      }),
    });
    if (!r.ok) {
      await sb.from("ai_scan_log").insert({ org_id: orgId, mode, status: "error" });
      return json({ error: "ai", message: "The scan didn't go through. Please try again or add the item manually." }, 502);
    }
    const d = JSON.parse(await r.text());
    const text = d?.content?.[0]?.text || "";
    const parsed = extractJson(text) as Record<string, unknown> | null;
    if (!parsed) {
      await sb.from("ai_scan_log").insert({ org_id: orgId, mode, status: "error" });
      return json({ error: "parse", message: "Couldn't read that photo. Try a clearer shot, or add items manually." }, 502);
    }

    if (mode === "batch") {
      const arr = Array.isArray((parsed as { items?: unknown }).items) ? (parsed as { items: unknown[] }).items : [];
      const suggestions = arr.slice(0, MAX_BATCH)
        .filter((x) => x && typeof x === "object")
        .map((x) => normalize(x as Record<string, unknown>))
        .filter((s) => s.name);
      if (suggestions.length === 0) {
        await sb.from("ai_scan_log").insert({ org_id: orgId, mode, status: "error" });
        return json({ error: "empty", message: "Couldn't make out any items. Try a clearer or closer photo." }, 502);
      }
      await sb.from("ai_scan_log").insert({ org_id: orgId, mode: "batch", item_count: suggestions.length, status: "ok" });
      return json({ suggestions, used: usedN + 1, limit: def.limit, plan });
    }

    const suggestion = normalize(parsed);
    await sb.from("ai_scan_log").insert({ org_id: orgId, mode: "single", item_count: 1, status: "ok" });
    return json({ suggestion, used: usedN + 1, limit: def.limit, plan });
  } catch (e) {
    return json({ error: "server", message: "Something went wrong. Please try again or add the item manually.", detail: String(e) }, 500);
  }
});
