// list-invoices — returns the signed-in owner's Stripe invoices for display in-app
// (Account → Invoices). Read-only. Verifies the caller's JWT, confirms they own/belong to
// the requested org, then lists that org's invoices from Stripe by stripe_customer_id.
// Never exposes another org's invoices. Deploy with --no-verify-jwt (validates the JWT itself).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_KEY   = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (!SERVICE_KEY) return json({ error: "server", message: "Service not configured." }, 500);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "auth", message: "Please sign in and try again." }, 401);
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "auth", message: "Please sign in and try again." }, 401);

    const body = await req.json().catch(() => ({}));
    const orgId = (body?.org_id as string) || user.id;

    // Authorize: the caller must own (owner model) or be the legacy id-owner of this org.
    const { data: org } = await sb.from("orgs")
      .select("id, owner_id, stripe_customer_id, email")
      .eq("id", orgId).maybeSingle();
    if (!org) return json({ error: "not_found", message: "Account not found." }, 404);
    const owns = org.id === user.id || org.owner_id === user.id;
    if (!owns) return json({ error: "forbidden", message: "You don't have access to this account's billing." }, 403);

    if (!org.stripe_customer_id) {
      // No Stripe customer yet (never subscribed) — return an empty list, not an error.
      return json({ invoices: [], has_customer: false });
    }
    if (!STRIPE_KEY) return json({ error: "server", message: "Billing is not configured." }, 500);

    const url = "https://api.stripe.com/v1/invoices?limit=24&customer=" + encodeURIComponent(org.stripe_customer_id);
    const r = await fetch(url, { headers: { "Authorization": "Bearer " + STRIPE_KEY } });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Stripe invoices fetch failed:", r.status, detail);
      return json({ error: "stripe", message: "Couldn't load invoices right now. Please try again." }, 502);
    }
    const d = await r.json();
    const invoices = (Array.isArray(d?.data) ? d.data : [])
      .filter((inv: Record<string, unknown>) => inv && inv.status !== "draft" && inv.status !== "void")
      .map((inv: Record<string, any>) => ({
        id: inv.id,
        number: inv.number ?? null,
        amount_cents: (inv.total ?? inv.amount_paid ?? 0),
        currency: inv.currency ?? "usd",
        status: inv.status ?? null,                       // paid / open / uncollectible
        paid: !!inv.paid,
        created: (inv.status_transitions?.paid_at ?? inv.created ?? null),
        period_start: inv.period_start ?? null,
        period_end: inv.period_end ?? null,
        description: inv.lines?.data?.[0]?.description ?? null,
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
        invoice_pdf: inv.invoice_pdf ?? null,
      }));
    return json({ invoices, has_customer: true });
  } catch (e) {
    return json({ error: "server", message: "Something went wrong loading invoices.", detail: String(e) }, 500);
  }
});
