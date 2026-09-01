import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY   = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

const ADMIN_EMAILS = ["rzick@hbuhsd.edu", "hello@theatre4u.org"];

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok  = (d: unknown)      => new Response(JSON.stringify(d), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
const err = (msg: string, s = 400) => new Response(JSON.stringify({ error: msg }), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// Service-role client — bypasses RLS, can call admin_hard_delete_org
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

async function cancelStripe(subId: string): Promise<boolean> {
  if (!STRIPE_KEY || !subId) return false;
  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    });
    const body = await res.json();
    console.log("Stripe cancel:", body.status ?? body.error?.message);
    return res.ok;
  } catch (e) {
    console.error("Stripe error:", e);
    return false;
  }
}

// Door-aware brand for closure emails so ArtsTracker owners get ArtsTracker-branded mail.
function brandFor(org: any) {
  const at = (org?.vertical && org.vertical !== "theatre") || (org?.signup_domain || "").includes("artstracker");
  return at
    ? { name: "ArtsTracker", from: "ArtsTracker <hello@theatre4u.org>", reply: "hello@artstracker.org" }
    : { name: "Theatre4u", from: "Theatre4u <hello@theatre4u.org>", reply: "hello@theatre4u.org" };
}

async function sendEmail(to: string, subject: string, html: string, from = "Theatre4u <hello@theatre4u.org>", reply = "hello@theatre4u.org") {
  if (!RESEND_KEY || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, reply_to: reply, to: [to], subject, html }),
  }).catch(e => console.error("Resend:", e));
}

Deno.serve(async (req: Request) => {
  // CORS preflight — no auth needed
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  // Verify JWT using service-role client getUser
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return err("Missing token", 401);

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) {
    console.error("Auth error:", authErr?.message);
    return err("Unauthorized", 401);
  }

  // Parse body
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON"); }

  const { org_id, reason, action = "close", is_admin_action = false } = body as {
    org_id?: string; reason?: string; action?: string; is_admin_action?: boolean;
  };
  if (!org_id) return err("org_id required");

  // Load org with service role
  const { data: org, error: orgErr } = await sb.from("orgs").select("*").eq("id", org_id).single();
  if (orgErr || !org) {
    console.error("Org load:", orgErr?.message);
    return err("Organization not found", 404);
  }
  const B = brandFor(org);

  // Permission check
  const { data: callerOrg } = await sb.from("orgs").select("email").eq("id", user.id).single();
  const callerEmail = (callerOrg?.email ?? "").toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(callerEmail);
  const isOwner = user.id === org_id;

  console.log(`close-org v4: action=${action} caller=${callerEmail} isAdmin=${isAdmin} isOwner=${isOwner} org=${org_id}`);

  if (!isOwner && !isAdmin) return err("Forbidden", 403);
  if ((action === "hard_delete" || action === "restore") && !isAdmin) return err("Admin only", 403);

  // ── RESTORE ────────────────────────────────────────────────────────────────
  if (action === "restore") {
    const { error: restErr } = await sb.from("orgs").update({
      account_status: "active",
      deleted_at: null,
      deletion_scheduled_at: null,
      cancellation_reason: null,
      closed_by: null,
    }).eq("id", org_id);
    if (restErr) return err(restErr.message, 500);
    return ok({ success: true, action: "restored" });
  }

  // ── HARD DELETE ────────────────────────────────────────────────────────────
  if (action === "hard_delete") {
    // Cancel Stripe first (non-fatal if fails)
    if (org.stripe_subscription_id) {
      await cancelStripe(org.stripe_subscription_id);
    }

    // Single DB call: deletes rental_requests, productions, org row (cascades
    // all child tables), and auth.users — fully atomic
    const { data: result, error: delErr } = await sb.rpc("admin_hard_delete_org", {
      p_org_id: org_id
    });

    if (delErr) {
      console.error("hard_delete RPC error:", delErr.message);
      return err(delErr.message, 500);
    }
    if (!result?.success) {
      console.error("hard_delete failed:", result?.error);
      return err(result?.error ?? "Delete failed", 500);
    }

    // Send notification
    if (org.email) {
      await sendEmail(
        org.email,
        `Your ${B.name} account has been permanently closed`,
        `<p>Your ${B.name} account for <strong>${org.name || "your program"}</strong> has been permanently closed by an administrator.</p>
         <p>All data has been removed. If you believe this was an error, contact <a href="mailto:${B.reply}">${B.reply}</a>.</p>`,
        B.from, B.reply
      );
    }

    console.log(`hard_delete complete: ${org_id} (${org.name})`);
    return ok({ success: true, action: "hard_deleted" });
  }

  // ── SOFT CLOSE ─────────────────────────────────────────────────────────────
  let stripeCanceled = false;
  if (org.stripe_subscription_id) {
    stripeCanceled = await cancelStripe(org.stripe_subscription_id);
  }

  const hardDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: closeErr } = await sb.from("orgs").update({
    account_status:        "closed",
    deleted_at:            new Date().toISOString(),
    deletion_scheduled_at: hardDeleteAt,
    cancellation_reason:   reason || null,
    closed_by:             is_admin_action ? "admin" : "owner",
    plan:                  "free",
    subscription_status:   "canceled",
    stripe_subscription_id: null,
  }).eq("id", org_id);

  if (closeErr) {
    console.error("soft_close error:", closeErr.message);
    return err(closeErr.message, 500);
  }

  // Confirmation email
  if (org.email) {
    const deleteDateStr = new Date(hardDeleteAt).toLocaleDateString("en-US",
      { month: "long", day: "numeric", year: "numeric" });
    await sendEmail(
      org.email,
      `Your ${B.name} account has been closed, ${org.name || "your program"}`,
      `<p>Hi,</p>
       <p>Your ${B.name} account for <strong>${org.name || "your program"}</strong> has been closed${
         is_admin_action ? " by an administrator" : " as requested"
       }.</p>
       <p>Your data will be permanently deleted on <strong>${deleteDateStr}</strong>.
       To restore your account before then, email
       <a href="mailto:${B.reply}">${B.reply}</a>.</p>
       ${reason ? `<p>Reason: ${reason}</p>` : ""}
       <p>Thank you for using ${B.name}.</p><p>— Bob Zick, ${B.name}</p>`,
      B.from, B.reply
    );
  }

  // Real-time internal alert so cancellations are seen immediately (owner self-closes only;
  // admin closes are our own action). Includes the reason so we can learn from churn.
  if (!is_admin_action) {
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const { count: itemCount } = await sb.from("items").select("id", { count: "exact", head: true }).eq("org_id", org_id);
    const signup = org.created_at ? new Date(org.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown";
    await sendEmail(
      "admin@theatre4u.org",
      `Account closed: ${org.name || org.email || org_id}`,
      `<div style="font-family:sans-serif;max-width:520px">
         <h2 style="margin:0 0 8px;font-family:Georgia,serif">Account closed</h2>
         <p style="margin:0 0 4px"><strong>${esc(org.name || "Unnamed")}</strong> &middot; ${esc(org.email || "no email")}</p>
         <p style="margin:0 0 4px;color:#555">Plan: ${esc(org.plan || "free")} &middot; Signed up: ${signup} &middot; Items: ${itemCount ?? 0}</p>
         <p style="margin:14px 0 4px"><strong>Reason given:</strong></p>
         <p style="margin:0;padding:10px 12px;background:#f7f2ea;border-left:3px solid #d4a843;border-radius:4px">${reason ? esc(reason) : "(none provided)"}</p>
         <p style="margin:14px 0 0;font-size:12px;color:#999">Recoverable for 30 days. Internal alert.</p>
       </div>`,
      B.from, B.reply
    );
  }

  console.log(`soft_close complete: ${org_id} stripe=${stripeCanceled} hard_delete_at=${hardDeleteAt}`);
  return ok({ success: true, action: "soft_closed", stripe_canceled: stripeCanceled, hard_delete_at: hardDeleteAt });
});
