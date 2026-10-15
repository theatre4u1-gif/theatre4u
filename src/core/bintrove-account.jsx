// BinTrove Account page (home accounts only). Shows plan + usage vs caps + upgrade tiers
// (wired to the live payment links) + sign out. Rendered instead of the school profile page
// when IS_BINTROVE. Separate file — school profile/settings are never touched.
import React, { useState, useEffect } from "react";
import { SB, callEdgeFn } from "./supabase.js";
import { BINTROVE_PLANS_DEF, BINTROVE_LINKS, stripeLink, scanLimitFor } from "./plans.js";

// Start of the current scan period for a plan (mirrors scan-item edge function).
function scanPeriodStart(plan, planExpiresAt) {
  const def = scanLimitFor(plan);
  const now = new Date();
  if (def.period === "lifetime") return new Date(0);
  if (def.period === "month") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (planExpiresAt) return new Date(new Date(planExpiresAt).getTime() - 30 * 86400000);
  return new Date(now.getTime() - 30 * 86400000);
}

const TEAL = "#0F6E6B", TEAL_D = "#0A5450", GOLD = "#D3A13C", INK = "#163230", CREAM = "#FBF4E6", LINE = "#e7e2d7", MUT = "#5d706d";
const ORDER = ["free", "starter", "home", "home_plus"];
const fmtCap = (n) => (n === Infinity || n === null ? "Unlimited" : n);

export function BinTroveAccount({ user, org }) {
  const plan = (org?.home_plan) || "free";
  const def = BINTROVE_PLANS_DEF[plan] || BINTROVE_PLANS_DEF.free;
  const [bins, setBins] = useState(null);
  const [items, setItems] = useState(null);
  const [scans, setScans] = useState(null);
  const orgId = org?.id || user?.id;
  const scanDef = scanLimitFor(plan);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const since = scanPeriodStart(plan, org?.plan_expires_at).toISOString();
        const [b, i, s] = await Promise.all([
          SB.from("storage_locations").select("*", { count: "exact", head: true }).eq("org_id", orgId),
          SB.from("items").select("*", { count: "exact", head: true }).eq("org_id", orgId),
          SB.from("ai_scan_log").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "ok").gte("created_at", since),
        ]);
        if (live) { setBins(b.count ?? 0); setItems(i.count ?? 0); setScans(s.count ?? 0); }
      } catch (e) { if (live) { setBins(0); setItems(0); setScans(0); } }
    })();
    return () => { live = false; };
  }, [orgId, plan]);

  const signOut = async () => { try { await SB.auth.signOut(); } catch (e) {} window.location.href = "/"; };
  const [closing, setClosing] = useState(false);
  const closeAccount = async () => {
    if (!window.confirm("Close your BinTrove account and delete all your bins, items, and photos? This cannot be undone.")) return;
    setClosing(true);
    try {
      const { data: { session } } = await SB.auth.getSession();
      const result = await callEdgeFn("close-org", { org_id: orgId, reason: "User requested", action: "close", is_admin_action: false }, session?.access_token);
      if (result?.success) { try { await SB.auth.signOut(); } catch (e) {} window.location.href = "/"; return; }
      alert(result?.error || "Something went wrong. Email hello@bintrove.com for help.");
    } catch (e) { alert("Something went wrong. Email hello@bintrove.com for help."); }
    setClosing(false);
  };

  const wrap = { maxWidth: 820, margin: "0 auto", padding: "8px 4px 40px", color: INK, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" };
  const card = { background: "#fff", border: "1px solid " + LINE, borderRadius: 16, padding: 22, marginBottom: 18 };
  const Bar = ({ used, cap }) => {
    const pct = (cap === Infinity || cap === null || !cap) ? (used ? 8 : 0) : Math.min(100, Math.round((used / cap) * 100));
    const full = cap !== Infinity && cap !== null && used >= cap;
    return (
      <div style={{ height: 9, background: "#eee6d6", borderRadius: 5, overflow: "hidden", margin: "6px 0 2px" }}>
        <div style={{ width: pct + "%", height: "100%", background: full ? "#c0453a" : TEAL, transition: "width .3s" }} />
      </div>
    );
  };

  const tierCard = (id) => {
    const t = BINTROVE_PLANS_DEF[id];
    const isCurrent = id === plan;
    const link = id === "free" ? null : stripeLink(BINTROVE_LINKS[id], user?.id, user?.email);
    return (
      <div key={id} style={{ ...card, marginBottom: 0, flex: 1, minWidth: 180, textAlign: "center", borderColor: id === "home" ? TEAL : LINE, boxShadow: id === "home" ? "0 8px 24px rgba(15,110,107,.12)" : "none" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{t.label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 2px" }}>{id === "free" ? "$0" : "$" + t.annualPrice}<span style={{ fontSize: 13, fontWeight: 500, color: MUT }}>{id === "free" ? "" : "/yr"}</span></div>
        <div style={{ fontSize: 13, color: MUT, marginBottom: 8 }}>{fmtCap(t.maxBins)} bins · {fmtCap(t.maxItems)} items</div>
        {t.blurb && <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.5, marginBottom: 10, minHeight: 36 }}>{t.blurb}</div>}
        {Array.isArray(t.features) && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", textAlign: "left" }}>
            {t.features.map((f, i) => (
              <li key={i} style={{ fontSize: 12.5, color: MUT, marginBottom: 4, paddingLeft: 18, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: TEAL, fontWeight: 800 }}>✓</span>{f}
              </li>
            ))}
          </ul>
        )}
        {isCurrent
          ? <div style={{ padding: "9px 0", fontWeight: 700, color: TEAL, border: "1.5px solid " + TEAL, borderRadius: 10 }}>Your plan</div>
          : (link
            ? <a href={link} style={{ display: "block", padding: "10px 0", background: TEAL, color: "#fff", fontWeight: 700, borderRadius: 10, textDecoration: "none" }}>Upgrade →</a>
            : <div style={{ padding: "9px 0", color: MUT }}>Free</div>)}
      </div>
    );
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, color: MUT, fontWeight: 700, letterSpacing: .3 }}>YOUR PLAN</div>
        <div style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 14px", color: TEAL }}>{def.label}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span><b>Bins</b></span><span style={{ color: MUT }}>{bins == null ? "…" : bins} of {fmtCap(def.maxBins)}</span>
        </div>
        <Bar used={bins || 0} cap={def.maxBins} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 12 }}>
          <span><b>Items</b></span><span style={{ color: MUT }}>{items == null ? "…" : items} of {fmtCap(def.maxItems)}</span>
        </div>
        <Bar used={items || 0} cap={def.maxItems} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 12 }}>
          <span><b>AI scans</b> <span style={{ fontWeight: 400, color: MUT, fontSize: 12 }}>{scanDef.period === "lifetime" ? "(trial)" : scanDef.period === "month" ? "(this month)" : "(this move)"}</span></span>
          <span style={{ color: MUT }}>{scans == null ? "…" : scans} of {scanDef.limit}</span>
        </div>
        <Bar used={scans || 0} cap={scanDef.limit} />
        <div style={{ fontSize: 12, color: MUT, marginTop: 6 }}>
          {scans != null && scans >= scanDef.limit
            ? (plan === "home_plus" ? "You've used this month's scans — they refresh on the 1st." : "Out of scans — upgrade for more, or keep adding items by hand.")
            : "Snap a photo of an item and AI fills in the details for you."}
        </div>
      </div>

      {plan !== "home_plus" && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Need more room?</div>
          <div style={{ color: MUT, fontSize: 14, marginBottom: 16 }}>Upgrade any time — billed yearly, cancel whenever. More bins, more items, household sharing.</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {ORDER.filter(id => id !== "free").map(tierCard)}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Account</div>
        <div style={{ fontSize: 14, color: MUT, marginBottom: 4 }}>Signed in as</div>
        <div style={{ fontSize: 15, marginBottom: 16 }}>{user?.email}</div>
        <button onClick={signOut} style={{ background: "none", border: "1.5px solid " + LINE, color: INK, padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Sign out</button>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid " + LINE }}>
          <button onClick={closeAccount} disabled={closing} style={{ background: "none", border: "none", color: "#b0493e", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{closing ? "Closing…" : "Close my account"}</button>
          <div style={{ fontSize: 12, color: MUT, marginTop: 4 }}>Permanently deletes your account and all your bins, items, and photos.</div>
        </div>
      </div>
    </div>
  );
}
