// Billing & Revenue module (Phase 8 admin app). Revenue trend, recurring-at-launch estimate, the
// founding/paying/beta cohorts, upcoming beta expiries, recent payments, and a CSV export.
// Note: billing begins Sept 1, so most "revenue" is ~0 until then and the recurring figure is an estimate.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { ProgramDetail } from "./admin-program.jsx";
import { doorOf } from "../lib/admin-metrics.js";

const fmtC = (c) => "$" + ((c || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtN = (n) => "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const PLAN_PRICE = { pro: 15, district: 49 }; // standard monthly $, estimate only
const monthlyFor = (o) => o.founding_member ? (Number(o.founding_rate_monthly) || 9.99) : o.stripe_subscription_id ? (PLAN_PRICE[o.plan] || 0) : 0;
const planTxt = (o) => o.stripe_subscription_id ? "Paying" : o.founding_member ? "Founding" : o.temp_pro ? "Beta" : (o.plan || "free");

function Card({ label, value, sub, accent, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ position: "relative", background: "#fff", border: "1px solid " + (h && onClick ? "#c4922a" : "#e6e0d6"), borderRadius: 12, padding: "16px 18px", cursor: onClick ? "pointer" : "default", transition: "all .15s" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || "#2a2a2a", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9a9284", marginTop: 6 }}>{sub}</div>}
      {onClick && <span style={{ position: "absolute", top: 14, right: 14, color: h ? "#c4922a" : "#cdc4b3", fontWeight: 800 }}>›</span>}
    </div>
  );
}

const th = { textAlign: "left", fontSize: 11, fontWeight: 800, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, padding: "8px 10px", borderBottom: "1px solid #e6e0d6" };
const td = { fontSize: 13, color: "#3a3a3a", padding: "9px 10px", borderBottom: "1px solid #f0ece3" };

export function BillingDashboard({ door = "all" }) {
  const [orgs, setOrgs] = useState(null);
  const [rev, setRev] = useState([]);
  const [pays, setPays] = useState([]);
  const [err, setErr] = useState("");
  const [detailOrg, setDetailOrg] = useState(null);
  const [tab, setTab] = useState("money"); // money | founding | beta
  const [paused, setPaused] = useState(null); // billing kill-switch (site_content global/billing_paused)

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [orgsRes, revRes, payRes, flagRes] = await Promise.all([
          SB.from("orgs").select("id,name,email,plan,vertical,signup_domain,temp_pro,founding_member,founding_rate_monthly,stripe_subscription_id,subscription_status,plan_expires_at,beta_end_date,account_status,deleted_at,created_at"),
          SB.from("stripe_revenue_summary").select("month,revenue_cents,refunded_cents,successful_payments,unique_customers"),
          SB.from("stripe_payments_current").select("org_name,customer_name,customer_email,amount_cents,plan,status,refunded,stripe_created_at").order("stripe_created_at", { ascending: false }).limit(100),
          SB.from("site_content").select("cvalue").eq("vertical", "global").eq("ckey", "billing_paused").maybeSingle(),
        ]);
        if (!alive) return;
        if (orgsRes.error) throw orgsRes.error;
        setOrgs((orgsRes.data || []).filter(o => !o.deleted_at));
        setRev((revRes.data || []).slice().sort((a, b) => new Date(a.month) - new Date(b.month)));
        setPays(payRes.data || []);
        setPaused(flagRes.data?.cvalue === "1");
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  if (detailOrg) return <ProgramDetail org={detailOrg} onBack={() => setDetailOrg(null)} onChanged={(id, p) => setOrgs(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))} />;
  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load billing: {err}</div>;
  if (!orgs) return <div style={{ padding: 24, color: "#888" }}>Loading billing…</div>;

  const now = new Date();
  const curRow = rev.find(r => { const m = new Date(r.month); return m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth(); });
  const revThisMonth = curRow ? (curRow.revenue_cents - (curRow.refunded_cents || 0)) : 0;
  const rev6 = rev.slice(-6).reduce((a, r) => a + (r.revenue_cents - (r.refunded_cents || 0)), 0);
  const shown = door === "all" ? orgs : orgs.filter(o => doorOf(o) === door);
  const paying = shown.filter(o => o.stripe_subscription_id);
  const founding = shown.filter(o => o.founding_member);
  const betaExp = shown.filter(o => o.beta_end_date);
  const committed = shown.reduce((a, o) => a + monthlyFor(o), 0);
  const nearestBeta = betaExp.map(o => o.beta_end_date).sort()[0];

  const exportCsv = () => {
    const head = ["Program", "Email", "Plan", "Status", "Founding", "Monthly($est)", "Beta ends", "Stripe sub"];
    const rows = orgs.map(o => [o.name || "", o.email || "", o.plan || "", o.subscription_status || (o.stripe_subscription_id ? "active" : (o.account_status || "")), o.founding_member ? "yes" : "", monthlyFor(o) || "", o.beta_end_date || "", o.stripe_subscription_id || ""]);
    const csv = [head, ...rows].map(r => r.map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "theatre4u-billing.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 };
  const H = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: "26px 0 12px" }}>{children}</h3>;
  const maxRev = Math.max(1, ...rev.slice(-12).map(r => r.revenue_cents || 0));

  const nameLink = (o) => <span onClick={() => setDetailOrg(o)} style={{ fontWeight: 700, color: "#a5731f", cursor: "pointer", textDecoration: "underline" }}>{o.name || "(no name)"}</span>;
  const cohort = tab === "founding" ? founding : tab === "beta" ? betaExp : paying;
  const cohortLabel = tab === "founding" ? "Founding members" : tab === "beta" ? "Beta ending" : "Paying now";

  const togglePause = async () => {
    const next = !paused;
    if (!window.confirm(next
      ? "PAUSE billing now? New in-app subscribe + founding checkout will be gated for everyone until you resume. This does NOT cancel existing Stripe subscriptions (pause those in Stripe if needed)."
      : "Resume billing? The subscribe buttons go live again.")) return;
    const { error } = await SB.from("site_content").upsert({ vertical: "global", ckey: "billing_paused", cvalue: next ? "1" : "0" }, { onConflict: "vertical,ckey" });
    if (error) { alert("Couldn't update the billing switch: " + error.message); return; }
    setPaused(next);
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 4px" }}>Revenue and the money-relevant cohorts. Billing begins September 1, so revenue stays near zero until then and the recurring figure is an estimate. Click a program to open its console.</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: paused ? "#fdecea" : "#f1f7f1", border: "1px solid " + (paused ? "#e6b0aa" : "#c8e0c8"), borderRadius: 12, padding: "12px 16px", margin: "8px 0 4px" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: paused ? "#a5342b" : "#1a7f37" }}>{paused === null ? "Billing switch…" : paused ? "⏸ Billing is PAUSED" : "● Billing is live"}</div>
          <div style={{ fontSize: 12, color: "#7a7367", marginTop: 2 }}>{paused ? "New in-app subscribe + founding checkout are gated. Existing Stripe subscriptions are unaffected — pause those in Stripe if needed." : "Emergency brake: instantly gate new in-app subscribe + founding checkout (does not touch existing Stripe subscriptions)."}</div>
        </div>
        <button onClick={togglePause} disabled={paused === null} style={{ padding: "9px 16px", borderRadius: 8, border: "none", fontWeight: 800, fontSize: 13, cursor: paused === null ? "default" : "pointer", fontFamily: "inherit", background: paused ? "#1a7f37" : "#c0392b", color: "#fff", opacity: paused === null ? .5 : 1 }}>
          {paused === null ? "…" : paused ? "Resume billing" : "Pause billing"}
        </button>
      </div>

      <H>Revenue{door !== "all" ? " (all sites — not split by door)" : ""}</H>
      <div style={grid}>
        <Card label="Revenue this month" value={fmtC(revThisMonth)} sub="net of refunds" accent="#1a7f37" />
        <Card label="Revenue (last 6 mo)" value={fmtC(rev6)} sub="net of refunds" />
        <Card label="Recurring at launch (est.)" value={fmtN(committed) + "/mo"} sub="founding + paying" accent="#c4922a" />
        <Card label="Beta ending" value={betaExp.length} sub={nearestBeta ? "from " + fmtDate(nearestBeta) : "—"} accent="#c07a00" onClick={() => setTab("beta")} />
      </div>

      <H>Cohorts</H>
      <div style={grid}>
        <Card label="Paying now" value={paying.length} sub="active Stripe subscription" accent="#1a7f37" onClick={() => setTab("money")} />
        <Card label="Founding members" value={founding.length} sub="$9.99 locked for life" accent="#c4922a" onClick={() => setTab("founding")} />
        <Card label="Total programs" value={shown.length} />
      </div>

      {rev.length > 0 && <>
        <H>Revenue by month</H>
        <div style={{ background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
            {rev.slice(-12).map((r, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div title={fmtC(r.revenue_cents)} style={{ height: Math.max(2, (r.revenue_cents / maxRev) * 76) + "px", background: "#c4922a", borderRadius: "3px 3px 0 0" }} />
                <div style={{ fontSize: 9, color: "#9a9284", marginTop: 4 }}>{new Date(r.month).toLocaleDateString(undefined, { month: "short" })}</div>
              </div>
            ))}
          </div>
        </div>
      </>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 12px", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: 0 }}>{cohortLabel} ({cohort.length})</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {[["money", "Paying"], ["founding", "Founding"], ["beta", "Beta ending"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + (tab === id ? "#c4922a" : "#dcd6cc"), background: tab === id ? "#c4922a" : "#fff", color: tab === id ? "#fff" : "#666", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
        <button onClick={exportCsv} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 8, border: "1px solid #1a7f37", background: "#fff", color: "#1a7f37", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⭳ Export all to CSV</button>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead><tr><th style={th}>Program</th><th style={th}>Plan</th><th style={th}>Monthly (est.)</th><th style={th}>{tab === "beta" ? "Beta ends" : "Status"}</th></tr></thead>
          <tbody>
            {cohort.length === 0 && <tr><td style={td} colSpan={4}>None yet.</td></tr>}
            {cohort.map(o => (
              <tr key={o.id}><td style={td}>{nameLink(o)}<div style={{ fontSize: 11.5, color: "#9a9284" }}>{o.email || ""}</div></td><td style={td}>{planTxt(o)}</td><td style={td}>{monthlyFor(o) ? fmtN(monthlyFor(o)) : "—"}</td><td style={td}>{tab === "beta" ? fmtDate(o.beta_end_date) : (o.subscription_status || (o.stripe_subscription_id ? "active" : o.account_status || "—"))}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>Recent payments</H>
      <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead><tr><th style={th}>Program</th><th style={th}>Amount</th><th style={th}>Plan</th><th style={th}>Status</th><th style={th}>Date</th></tr></thead>
          <tbody>
            {pays.length === 0 && <tr><td style={td} colSpan={5}>No payments recorded yet.</td></tr>}
            {pays.slice(0, 50).map((p, i) => (
              <tr key={i}><td style={td}>{p.org_name || p.customer_name || "—"}<div style={{ fontSize: 11.5, color: "#9a9284" }}>{p.customer_email || ""}</div></td><td style={{ ...td, fontWeight: 700 }}>{fmtC(p.amount_cents)}{p.refunded ? <span style={{ color: "#c0392b", fontSize: 11, fontWeight: 600 }}> (refunded)</span> : ""}</td><td style={td}>{p.plan || "—"}</td><td style={td}>{p.status || "—"}</td><td style={td}>{fmtDate(p.stripe_created_at)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
}
