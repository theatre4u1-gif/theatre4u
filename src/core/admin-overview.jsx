// Overview / Pulse dashboard for the standalone admin app (Phase 8).
// Headline numbers pulled live from Supabase (platform-admin read). Reuses the same fields the
// in-app AdminHub uses (plan / temp_pro / founding_member / stripe_subscription_id / last_seen).
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";

const fmtMoney = (cents) => "$" + ((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const DAY = 86400000;

function Card({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || "#2a2a2a", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9a9284", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export function OverviewDashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const now = new Date();
        const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
        const d30 = new Date(Date.now() - 30 * DAY).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [orgsRes, pvCountRes, pvSessRes, revRes, sessRes] = await Promise.all([
          SB.from("orgs").select("plan,temp_pro,founding_member,stripe_subscription_id,created_at,last_seen,deleted_at"),
          SB.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
          SB.from("page_views").select("session_id").gte("created_at", weekAgo).limit(20000),
          SB.from("stripe_revenue_summary").select("month,revenue_cents,refunded_cents,unique_customers"),
          SB.from("app_sessions").select("started_at,last_seen_at").gte("started_at", d30).limit(20000),
        ]);
        if (!alive) return;

        const orgs = (orgsRes.data || []).filter(o => !o.deleted_at);
        const activeSince = (iso) => (o) => o.last_seen && o.last_seen >= iso;
        const paying = orgs.filter(o => o.stripe_subscription_id);
        const founding = orgs.filter(o => o.founding_member);
        const betaOnly = orgs.filter(o => o.temp_pro && !o.founding_member && !o.stripe_subscription_id);
        const free = orgs.filter(o => o.plan === "free" && !o.temp_pro && !o.stripe_subscription_id);

        const uniqVisitors = new Set((pvSessRes.data || []).map(r => r.session_id).filter(Boolean)).size;

        // Revenue for the current calendar month (summary view keyed by month start).
        const curMonthRow = (revRes.data || []).find(r => {
          const m = new Date(r.month);
          return m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth();
        });
        const revThisMonth = curMonthRow ? (curMonthRow.revenue_cents - (curMonthRow.refunded_cents || 0)) : 0;

        // Average session length from the new heartbeat data (may be empty until it accrues).
        const sess = (sessRes.data || []).map(s => (new Date(s.last_seen_at) - new Date(s.started_at)) / 60000).filter(m => m >= 0);
        const avgMin = sess.length ? Math.round(sess.reduce((a, b) => a + b, 0) / sess.length) : null;

        setD({
          total: orgs.length,
          active7: orgs.filter(activeSince(weekAgo)).length,
          active30: orgs.filter(activeSince(d30)).length,
          newWeek: orgs.filter(o => o.created_at >= weekAgo).length,
          newMonth: orgs.filter(o => o.created_at >= monthStart.toISOString()).length,
          paying: paying.length,
          founding: founding.length,
          betaOnly: betaOnly.length,
          free: free.length,
          pageViews7: pvCountRes.count || 0,
          visitors7: uniqVisitors,
          revThisMonth,
          avgMin,
          sessCount: sess.length,
        });
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load overview: {err}</div>;
  if (!d) return <div style={{ padding: 24, color: "#888" }}>Loading overview…</div>;

  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 };
  const H = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: "26px 0 12px" }}>{children}</h3>;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 4px" }}>A live snapshot across both doors. Numbers refresh when you reload.</p>

      <H>Programs</H>
      <div style={grid}>
        <Card label="Total programs" value={d.total} />
        <Card label="Active this week" value={d.active7} sub="signed in ≤ 7 days" accent="#1a7f37" />
        <Card label="Active this month" value={d.active30} sub="signed in ≤ 30 days" accent="#1a7f37" />
        <Card label="New this week" value={d.newWeek} sub={d.newMonth + " this month"} accent="#c4922a" />
      </div>

      <H>Plans</H>
      <div style={grid}>
        <Card label="Paying" value={d.paying} sub="active Stripe subscription" accent="#1a7f37" />
        <Card label="Founding members" value={d.founding} accent="#c4922a" />
        <Card label="Beta (free Pro)" value={d.betaOnly} accent="#b06fc9" />
        <Card label="Free" value={d.free} />
      </div>

      <H>Money & traffic</H>
      <div style={grid}>
        <Card label="Revenue this month" value={fmtMoney(d.revThisMonth)} sub="from Stripe (net of refunds)" accent="#1a7f37" />
        <Card label="Visitors this week" value={d.visitors7} sub={d.pageViews7.toLocaleString() + " page views"} />
        <Card label="Avg session length" value={d.avgMin != null ? d.avgMin + " min" : "—"} sub={d.avgMin != null ? "last 30 days · " + d.sessCount + " sessions" : "collecting — new tracking just enabled"} />
      </div>

      <p style={{ color: "#9a9284", fontSize: 11.5, marginTop: 22, lineHeight: 1.5 }}>
        Billing begins September 1, so revenue is expected to be minimal until then. Session-length tracking was just turned on, so that figure fills in over the coming days.
      </p>
    </div>
  );
}
