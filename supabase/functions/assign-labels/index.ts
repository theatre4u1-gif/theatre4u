// assign-labels — atomically assigns N labels from the pool to an org.
// ADMIN-ONLY: this is a fulfillment action, not a customer-facing endpoint. It runs with the
// service role (bypasses RLS), so it must verify the caller is an authenticated platform admin
// before claiming labels or writing order amounts. (Previously it trusted the request body with
// no auth, letting anyone with the public anon key drain the label pool or forge order amounts.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAILS = ["rzick@hbuhsd.edu", "hello@theatre4u.org"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SB = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Require an authenticated platform admin.
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: { user }, error: authErr } = await SB.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);
  if (!ADMIN_EMAILS.includes((user.email ?? "").toLowerCase())) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const { org_id, label_count, order_id, delivery_addr, amount_cents } = await req.json();
    if (!org_id || !label_count || label_count < 1) {
      return json({ error: "org_id and label_count required" }, 400);
    }
    // Atomically claim the next N available labels
    const { data: labels, error } = await SB.rpc("claim_label_range", { p_org_id: org_id, p_count: label_count, p_order_id: order_id });
    if (error || !labels || labels.length === 0) {
      console.error("claim_label_range error:", error);
      return json({ error: "Could not assign labels. Pool may be low.", detail: error?.message }, 500);
    }
    const codes = labels as { code: string; seq: number }[];
    const seqNums = codes.map((c: { seq: number }) => c.seq);
    const codeStart = codes[0].code;
    const codeEnd = codes[codes.length - 1].code;
    const seqStart = Math.min(...seqNums);
    const seqEnd = Math.max(...seqNums);
    // Update the order with code range
    if (order_id) {
      await SB.from("label_orders").update({
        code_start: codeStart, code_end: codeEnd,
        seq_start: seqStart, seq_end: seqEnd,
        status: "processing", delivery_addr: delivery_addr || null,
        amount_cents: amount_cents || 0,
      }).eq("id", order_id);
    }
    console.log(`Assigned ${codes.length} labels to org ${org_id}: ${codeStart} - ${codeEnd}`);
    return json({ ok: true, assigned: codes.length, code_start: codeStart, code_end: codeEnd, codes: codes.map((c: { code: string }) => c.code) });
  } catch (e) {
    console.error(String(e));
    return json({ error: String(e) }, 500);
  }
});
