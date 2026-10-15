// scan-item — AI Scan for every brand. mode "single" (one item) or "batch" (a shelf/rack -> many).
// The client passes its vertical + that vertical's categories/conditions, so the model is
// constrained to the right vocabulary (home goods, props, costumes, instruments, etc.) without
// duplicating the taxonomy here. One photo = one scan. Metered via ai_scan_log; the caller's plan
// (home_plan for BinTrove, plan for schools) sets the monthly allotment. Never writes items.
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

type Limit = { limit: number; period: "lifetime" | "month" | "window" };
// BinTrove (home) allotments — keep in sync with SCAN_LIMITS in plans.js.
const SCAN_LIMITS_HOME: Record<string, Limit> = {
  free: { limit: 10, period: "lifetime" }, starter: { limit: 50, period: "month" },
  home: { limit: 150, period: "month" }, home_plus: { limit: 500, period: "month" },
  move: { limit: 150, period: "window" },
};
// School (Theatre4u / ArtsTracker) allotments — keep in sync with SCHOOL_SCAN_LIMITS in plans.js.
const SCAN_LIMITS_SCHOOL: Record<string, Limit> = {
  free: { limit: 3, period: "month" }, pro: { limit: 100, period: "month" },
  district: { limit: 300, period: "month" }, district_m: { limit: 600, period: "month" }, district_l: { limit: 1000, period: "month" },
  at_pro: { limit: 100, period: "month" }, at_district_s: { limit: 300, period: "month" }, at_district_m: { limit: 600, period: "month" }, at_district_l: { limit: 1000, period: "month" },
  enterprise: { limit: 5000, period: "month" }, at_enterprise: { limit: 5000, period: "month" },
};

// Fallback (BinTrove legacy clients that don't send a taxonomy).
const HOME_CATEGORIES = [
  { id: "holiday", label: "Holiday & Seasonal" }, { id: "decor", label: "Decorations" }, { id: "kitchen", label: "Kitchen & Dining" },
  { id: "tools", label: "Tools & Hardware" }, { id: "outdoor", label: "Garage & Outdoor" }, { id: "keepsakes", label: "Keepsakes & Memories" },
  { id: "electronics", label: "Electronics" }, { id: "clothing", label: "Clothing & Linens" }, { id: "kids", label: "Kids & Toys" },
  { id: "documents", label: "Documents & Records" }, { id: "sports", label: "Sports & Hobbies" }, { id: "other", label: "Other" },
];
const HOME_CONDITIONS = ["New", "Good", "Used", "Fragile", "For Donation"];
const MAX_BATCH = 20;

function periodStart(plan: string, planExpiresAt: string | null, limits: Record<string, Limit>): string {
  const now = new Date();
  const def = limits[plan] || limits.free;
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

    // Taxonomy from the client (fallback to home set for legacy BinTrove calls).
    const rawCats = Array.isArray(bodyIn?.categories) && bodyIn.categories.length ? bodyIn.categories : HOME_CATEGORIES;
    const cats = rawCats.map((c: unknown) => typeof c === "string" ? { id: c, label: c } : { id: String((c as any).id), label: String((c as any).label || (c as any).id) })
      .filter((c: { id: string }) => c.id);
    const catIds = new Set(cats.map((c: { id: string }) => c.id));
    const conds: string[] = (Array.isArray(bodyIn?.conditions) && bodyIn.conditions.length ? bodyIn.conditions : HOME_CONDITIONS).map((x: unknown) => String(x));
    const noun = typeof bodyIn?.noun === "string" && bodyIn.noun ? bodyIn.noun : "item";

    // Global kill-switch.
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

    // Entitlement — pick the right plan field + limit table by brand.
    const { data: org } = await sb.from("orgs").select("home_plan, plan, plan_expires_at, vertical, org_type").eq("id", orgId).maybeSingle();
    const isHome = (bodyIn?.vertical === "home") || org?.vertical === "home" || org?.org_type === "home";
    const limits = isHome ? SCAN_LIMITS_HOME : SCAN_LIMITS_SCHOOL;
    const plan = (isHome ? (org?.home_plan || "free") : (org?.plan || "free")) as string;
    const def = limits[plan] || limits.free;
    const since = periodStart(plan, org?.plan_expires_at ?? null, limits);
    const { count: used } = await sb.from("ai_scan_log").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "ok").gte("created_at", since);
    const usedN = used ?? 0;
    if (usedN >= def.limit) {
      return json({ error: "limit", used: usedN, limit: def.limit, plan,
        message: "You've used all your AI scans for this plan this period. Upgrade for more, or add this item manually." }, 402);
    }

    if (!ANTHROPIC_KEY) return json({ error: "server", message: "AI Scan is not configured yet." }, 500);

    const catLines = cats.map((c: { id: string; label: string }) => `  "${c.id}" = ${c.label}`).join("\n");
    const FIELDS = `- name: short, specific, title-case.
- category: the single best id from this list ONLY (return the id, not the label):
${catLines}
  If unsure, use "other" if present, else the closest id.
- condition: one of: ${conds.join(", ")}.
- quantity: integer count of like items (default 1).
- est_value: rough USD replacement estimate as a number (no symbol). null if you can't tell.
- notes: one short phrase (color, size, material, era), under 12 words.
- confidence: "high", "medium", or "low".`;
    const SYSTEM = mode === "batch"
      ? `You help catalog inventory. You are shown ONE photo containing MULTIPLE distinct ${noun}s (e.g. a shelf, a rack, a bin). Identify each clearly distinct one (group identical ones into a single entry with a quantity). Return up to ${MAX_BATCH} entries as strict JSON: an object with key "items" whose value is an array, each entry having keys: name, category, condition, quantity, est_value, notes, confidence.
${FIELDS}
Only include items you can actually see. Output ONLY the JSON object, no prose, no markdown fences.`
      : `You help catalog inventory. You are shown ONE photo of a single ${noun} (or a small group logged as one entry). Return ONE catalog entry as strict JSON with keys: name, category, condition, quantity, est_value, notes, confidence.
${FIELDS}
Output ONLY the JSON object, no prose, no markdown fences.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: mode === "batch" ? 1500 : 300,
        system: SYSTEM,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "url", url } },
          { type: "text", text: mode === "batch" ? "List the distinct items in this photo as the JSON described." : "Identify this item and return the JSON entry." },
        ] }],
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
      return json({ error: "parse", message: "Couldn't read that photo. Try a clearer or closer shot, or add items manually." }, 502);
    }

    const normalize = (raw: Record<string, unknown>) => {
      const category = catIds.has(String(raw.category)) ? String(raw.category) : (catIds.has("other") ? "other" : cats[0].id);
      const condition = conds.includes(String(raw.condition)) ? String(raw.condition) : (conds[1] || conds[0]);
      let quantity = parseInt(String(raw.quantity ?? 1), 10); if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
      let estValue: number | null = null; const ev = Number(raw.est_value);
      if (Number.isFinite(ev) && ev >= 0) estValue = Math.round(ev * 100) / 100;
      return { name: String(raw.name ?? "").slice(0, 120), category, condition, quantity, est_value: estValue,
        notes: String(raw.notes ?? "").slice(0, 160), confidence: ["high", "medium", "low"].includes(String(raw.confidence)) ? String(raw.confidence) : "medium" };
    };
    const brand = isHome ? "bintrove" : "school";

    if (mode === "batch") {
      const arr = Array.isArray((parsed as { items?: unknown }).items) ? (parsed as { items: unknown[] }).items : [];
      const suggestions = arr.slice(0, MAX_BATCH).filter((x) => x && typeof x === "object").map((x) => normalize(x as Record<string, unknown>)).filter((s) => s.name);
      if (!suggestions.length) {
        await sb.from("ai_scan_log").insert({ org_id: orgId, mode, brand, status: "error" });
        return json({ error: "empty", message: "Couldn't make out any items. Try a clearer or closer photo." }, 502);
      }
      await sb.from("ai_scan_log").insert({ org_id: orgId, mode: "batch", brand, item_count: suggestions.length, status: "ok" });
      return json({ suggestions, used: usedN + 1, limit: def.limit, plan });
    }
    const suggestion = normalize(parsed);
    await sb.from("ai_scan_log").insert({ org_id: orgId, mode: "single", brand, item_count: 1, status: "ok" });
    return json({ suggestion, used: usedN + 1, limit: def.limit, plan });
  } catch (e) {
    return json({ error: "server", message: "Something went wrong. Please try again or add the item manually.", detail: String(e) }, 500);
  }
});
