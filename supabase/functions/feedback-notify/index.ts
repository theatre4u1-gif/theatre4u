// feedback-notify — emails the founder when a beta user submits feedback.
// Flagged high-importance; bugs and low ratings are marked as action-needed.
// Called fire-and-forget from the feedback widget. verify_jwt=false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const TO = "hello@theatre4u.org";        // founder inbox (read personally)
const FROM = "Theatre4u Feedback <hello@theatre4u.org>";

const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cors = () => ({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" });
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors(), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const b = await req.json().catch(() => ({}));
    const org = esc(b.org_name || "a program");
    const cat = String(b.category || "other");
    const rating = b.rating != null ? Number(b.rating) : null;
    const stars = rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "no rating";
    const isSurvey = b.kind === "survey" || b.page_context === "leading-player-survey";

    // Priority: bugs, confusion, or low ratings need attention.
    const actionNeeded = cat === "bug" || cat === "confusion" || (rating != null && rating <= 2);
    const tag = actionNeeded ? "⚠️ ACTION" : "📣 New";
    const subject = `${tag} feedback · ${org} · ${cat}${rating ? " (" + rating + "★)" : ""}`;

    let bodyRows = "";
    if (isSurvey) {
      bodyRows =
        row("Hardest inventory", b.hardest_inventory) +
        row("Prop 28 pain (1-10)", b.prop28_pain_score) +
        row("Lending barrier", b.lending_barrier) +
        row("One wish", b.wishlist_hour);
    } else {
      bodyRows = row("Message", b.message);
    }

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: FROM, to: [TO], reply_to: TO,
          subject,
          headers: { "X-Priority": "1", "X-MSMail-Priority": "High", "Importance": "high" },
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:26px;background:#fff">
              <div style="display:inline-block;background:${actionNeeded ? "#c2185b" : "#1a7f37"};color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px">${actionNeeded ? "ACTION MAY BE NEEDED" : "NEW FEEDBACK"}</div>
              <h2 style="font-family:Georgia,serif;color:#1a0600;margin:12px 0 4px">${org}</h2>
              <p style="color:#666;margin:0 0 14px">${esc(cat)} · ${stars}${b.page_context ? " · " + esc(b.page_context) : ""}</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333">${bodyRows}</table>
              <div style="text-align:center;margin:22px 0 4px">
                <a href="https://theatre4u.org/?admin=1#admin" style="display:inline-block;background:#d4a843;color:#1a0600;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:700">Open the Feedback tab &rarr;</a>
              </div>
              <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:12px">Beta feedback alert · Theatre4u / ArtsTracker</p>
            </div>`,
        }),
      });
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function row(label: string, val: unknown) {
  if (val == null || String(val).trim() === "") return "";
  return `<tr><td style="padding:6px 10px 6px 0;color:#888;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${esc(String(val))}</td></tr>`;
}
