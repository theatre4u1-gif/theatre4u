// Overview / Pulse dashboard for the standalone admin app (Phase 8).
// Headline numbers pulled live from Supabase (platform-admin read). Cards are clickable and drill
// into a filtered, actionable detail view (programs list, payments, traffic, sessions).
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { ProgramDetail } from "./admin-program.jsx";
import { lastActiveTs, activeBucket, doorOf, DOOR_LABEL } from "../lib/admin-metrics.js";

const DAY = 86400000;
const fmtMoney = (cents) => "$" + ((cents || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const agoDays = (iso) => { if (!iso) return "never"; const days = Math.floor((Date.now() - new Date(iso)) / DAY); return days <= 0 ? "today" : days === 1 ? "1 day ago" : days + " days ago"; };
const planLabel = (o) => o.stripe_subscription_id ? "Paying" : o.founding_member ? "Founding" : o.temp_pro ? "Beta (free Pro)" : (o.plan || "free");
const planColor = (o) => o.stripe_subscription_id ? "#1a7f37" : o.founding_member ? "#c4922a" : o.temp_pro ? "#b06fc9" : "#8a8272";

function Card({ label, value, sub, accent, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: "relative", background: "#fff", border: "1px solid " + (hov ? "#c4922a" : "#e6e0d6"), borderRadius: 12, padding: "16px 18px", cursor: onClick ? "pointer" : "default", boxShadow: hov && onClick ? "0 4px 18px rgba(0,0,0,.07)" : "none", transition: "all .15s" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent || "#2a2a2a", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9a9284", marginTop: 6 }}>{sub}</div>}
      {onClick && <span style={{ position: "absolute", top: 14, right: 14, color: hov ? "#c4922a" : "#cdc4b3", fontSize: 16, fontWeight: 800 }}>›</span>}
    </div>
  );
}

const th = { textAlign: "left", fontSize: 11, fontWeight: 800, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, padding: "8px 10px", borderBottom: "1px solid #e6e0d6" };
const td = { fontSize: 13, color: "#3a3a3a", padding: "9px 10px", borderBottom: "1px solid #f0ece3", verticalAlign: "middle" };
const badge = (color) => ({ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: color + "1a" });

function ProgramsTable({ rows, onToggleBeta, busyId, onOpen }) {
  const [q, setQ] = useState("");
  const filtered = rows.filter(o => { const s = (o.name || "") + " " + (o.email || "") + " " + (o.location || o.city || ""); return s.toLowerCase().includes(q.toLowerCase()); });
  return (
    <>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, location…" style={{ width: "100%", maxWidth: 360, padding: "9px 12px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, marginBottom: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
      <div style={{ fontSize: 12, color: "#9a9284", marginBottom: 8 }}>{filtered.length} program{filtered.length === 1 ? "" : "s"}</div>
      <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead><tr>
            <th style={th}>Program</th><th style={th}>Plan</th><th style={th}>Location</th><th style={th}>Last seen</th><th style={th}>Joined</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td style={td}><div onClick={() => onOpen && onOpen(o)} style={{ fontWeight: 700, color: "#a5731f", cursor: "pointer", textDecoration: "underline" }}>{o.name || "(no name)"}</div><div style={{ fontSize: 11.5, color: "#9a9284" }}>{o.email || ""}</div></td>
                <td style={td}><span style={badge(planColor(o))}>{planLabel(o)}</span></td>
                <td style={td}>{o.location || o.city || "—"}</td>
                <td style={td}>{agoDays(o.last_seen)}</td>
                <td style={td}>{fmtDate(o.created_at)}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {!o.stripe_subscription_id && !o.founding_member && (
                    <button onClick={() => onToggleBeta(o)} disabled={busyId === o.id}
                      style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid " + (o.temp_pro ? "#c4922a" : "#d5cfc4"), background: o.temp_pro ? "rgba(212,168,67,.12)" : "#fff", color: o.temp_pro ? "#a5731f" : "#666", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>
                      {busyId === o.id ? "…" : o.temp_pro ? "⭐ Beta Pro on" : "Grant Beta Pro"}
                    </button>
                  )}
                  <button onClick={() => onOpen && onOpen(o)} style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #d5cfc4", background: "#fff", color: "#555", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Manage →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PaymentsTable({ rows }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead><tr><th style={th}>Program</th><th style={th}>Amount</th><th style={th}>Plan</th><th style={th}>Status</th><th style={th}>Date</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td style={td} colSpan={5}>No payments yet this month.</td></tr>}
          {rows.map((p, i) => (
            <tr key={i}>
              <td style={td}><div style={{ fontWeight: 700 }}>{p.org_name || p.customer_name || "—"}</div><div style={{ fontSize: 11.5, color: "#9a9284" }}>{p.customer_email || ""}</div></td>
              <td style={{ ...td, fontWeight: 700 }}>{fmtMoney(p.amount_cents)}{p.refunded ? <span style={{ color: "#c0392b", fontWeight: 600, fontSize: 11 }}> (refunded)</span> : ""}</td>
              <td style={td}>{p.plan || "—"}</td>
              <td style={td}>{p.status || "—"}</td>
              <td style={td}>{fmtDate(p.stripe_created_at || p.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankList({ title, items }) {
  const max = Math.max(1, ...items.map(i => i.n));
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>{title}</div>
      {items.length === 0 && <div style={{ fontSize: 13, color: "#9a9284" }}>No data yet.</div>}
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span style={{ color: "#3a3a3a" }}>{it.label}</span><span style={{ fontWeight: 700, color: "#6b6459" }}>{it.n}</span></div>
          <div style={{ height: 6, background: "#efe9de", borderRadius: 3 }}><div style={{ height: 6, width: (it.n / max * 100) + "%", background: "#c4922a", borderRadius: 3 }} /></div>
        </div>
      ))}
    </div>
  );
}

function SessionsTable({ rows }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead><tr><th style={th}>Who</th><th style={th}>Length</th><th style={th}>Plan</th><th style={th}>Started</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td style={td} colSpan={4}>No sessions recorded yet — tracking was just enabled.</td></tr>}
          {rows.map((s, i) => (
            <tr key={i}>
              <td style={td}>{s.email || s.org_id || "—"}</td>
              <td style={{ ...td, fontWeight: 700 }}>{s.mins} min</td>
              <td style={td}>{s.plan || "—"}</td>
              <td style={td}>{new Date(s.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OverviewDashboard({ door = "all" }) {
  const [orgs, setOrgs] = useState(null);
  const [usageMap, setUsageMap] = useState({});
  const [pv, setPv] = useState([]);
  const [payments, setPayments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [rev, setRev] = useState(0);
  const [err, setErr] = useState("");
  const [drill, setDrill] = useState(null); // {type, filter, label}
  const [detailOrg, setDetailOrg] = useState(null); // program support console
  const [busyId, setBusyId] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const now = new Date();
        const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
        const d30 = new Date(Date.now() - 30 * DAY).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const [orgsRes, usageRes, pvRes, revRes, payRes, sessRes] = await Promise.all([
          SB.from("orgs").select("id,name,email,plan,temp_pro,founding_member,stripe_subscription_id,created_at,last_seen,deleted_at,location,city,vertical,signup_domain"),
          SB.from("org_platform_usage").select("org_id,last_item_added,last_exchange_activity").limit(20000),
          SB.from("page_views").select("page,utm_source,referrer,session_id").gte("created_at", weekAgo).limit(20000),
          SB.from("stripe_revenue_summary").select("month,revenue_cents,refunded_cents"),
          SB.from("stripe_payments_current").select("org_name,customer_name,customer_email,amount_cents,plan,status,refunded,stripe_created_at,created_at").gte("stripe_created_at", monthStart).order("stripe_created_at", { ascending: false }).limit(2000),
          SB.from("app_sessions").select("org_id,email,plan,started_at,last_seen_at").gte("started_at", d30).order("started_at", { ascending: false }).limit(20000),
        ]);
        if (!alive) return;
        if (orgsRes.error) throw orgsRes.error;
        const um = {}; (usageRes.data || []).forEach(u => { um[u.org_id] = u; });
        setUsageMap(um);
        setOrgs((orgsRes.data || []).filter(o => !o.deleted_at));
        setPv(pvRes.data || []);
        setPayments(payRes.data || []);
        setSessions((sessRes.data || []).map(s => ({ ...s, mins: Math.max(0, Math.round((new Date(s.last_seen_at) - new Date(s.started_at)) / 60000)) })));
        const cur = (revRes.data || []).find(r => { const m = new Date(r.month); return m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth(); });
        setRev(cur ? (cur.revenue_cents - (cur.refunded_cents || 0)) : 0);
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  const toggleBeta = async (o) => {
    const next = !o.temp_pro;
    setBusyId(o.id);
    const { error } = await SB.from("orgs").update({ temp_pro: next, temp_pro_granted_at: next ? new Date().toISOString() : null, temp_pro_note: next ? "Granted via admin overview" : "Removed via admin overview" }).eq("id", o.id);
    setBusyId("");
    if (error) { setFlash("Error: " + error.message); } else { setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, temp_pro: next } : x)); setFlash("✓ Beta Pro " + (next ? "granted" : "removed")); }
    setTimeout(() => setFlash(""), 3500);
  };

  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load overview: {err}</div>;
  if (!orgs) return <div style={{ padding: 24, color: "#888" }}>Loading overview…</div>;

  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const bucketOf = (o) => activeBucket(lastActiveTs(o, usageMap[o.id]));
  const doored = door === "all" ? orgs : orgs.filter(o => doorOf(o) === door);
  const seg = {
    all: doored,
    active7: doored.filter(o => bucketOf(o) === "a7"),
    active30: doored.filter(o => ["a7", "a30"].includes(bucketOf(o))),
    new: doored.filter(o => o.created_at >= weekAgo),
    newMonth: doored.filter(o => o.created_at >= monthStart),
    paying: doored.filter(o => o.stripe_subscription_id),
    founding: doored.filter(o => o.founding_member),
    beta: doored.filter(o => o.temp_pro && !o.founding_member && !o.stripe_subscription_id),
    free: doored.filter(o => o.plan === "free" && !o.temp_pro && !o.stripe_subscription_id),
  };
  // Always-visible side-by-side split by door (independent of the filter).
  const byDoor = ["theatre4u", "artstracker"].map(d => {
    const list = orgs.filter(o => doorOf(o) === d);
    return { d, total: list.length, active: list.filter(o => ["a7", "a30"].includes(bucketOf(o))).length, paying: list.filter(o => o.stripe_subscription_id).length, founding: list.filter(o => o.founding_member).length };
  });
  const visitors7 = new Set(pv.map(r => r.session_id).filter(Boolean)).size;
  const avgMin = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.mins, 0) / sessions.length) : null;

  const openProg = (filter, label) => setDrill({ type: "programs", filter, label });

  // ── Program support console (opened from a programs list) ──
  if (detailOrg) {
    return <ProgramDetail org={detailOrg} onBack={() => setDetailOrg(null)}
      onChanged={(id, p) => setOrgs(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))} />;
  }

  // ── Drill-down views ──
  if (drill) {
    const back = <button onClick={() => setDrill(null)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d5cfc4", background: "#fff", color: "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>← Back to overview</button>;
    let body = null, title = drill.label;
    if (drill.type === "programs") body = <ProgramsTable rows={seg[drill.filter] || []} onToggleBeta={toggleBeta} busyId={busyId} onOpen={setDetailOrg} />;
    else if (drill.type === "payments") { title = "Payments this month"; body = <PaymentsTable rows={payments} />; }
    else if (drill.type === "sessions") { title = "Recent sessions (last 30 days)"; body = <SessionsTable rows={sessions.slice(0, 200)} />; }
    else if (drill.type === "traffic") {
      title = "Traffic this week";
      const tally = (key) => { const m = {}; pv.forEach(r => { const k = (r[key] || "(direct/none)"); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 8); };
      body = <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}><RankList title="Top pages" items={tally("page")} /><RankList title="Top sources" items={tally("utm_source")} /></div>;
    }
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {back}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#2a2a2a", margin: "0 0 14px" }}>{title} {drill.type === "programs" && <span style={{ fontSize: 14, fontWeight: 600, color: "#9a9284" }}>({(seg[drill.filter] || []).length})</span>}</h2>
        {flash && <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 13, color: flash.startsWith("Error") ? "#c0392b" : "#1a7f37" }}>{flash}</div>}
        {body}
      </div>
    );
  }

  // ── Cards ──
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 };
  const H = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: "26px 0 12px" }}>{children}</h3>;
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 4px" }}>A live snapshot{door !== "all" ? " — showing " + DOOR_LABEL[door] + " only (use the Site filter above)" : ""}. Click any card to drill in and manage.</p>
      {flash && <div style={{ marginTop: 8, fontWeight: 700, fontSize: 13, color: flash.startsWith("Error") ? "#c0392b" : "#1a7f37" }}>{flash}</div>}

      <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>By site</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {byDoor.map(b => (
            <div key={b.d} style={{ border: "1px solid #eee6d9", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontWeight: 800, color: b.d === "theatre4u" ? "#a5731f" : "#b06fc9", marginBottom: 8 }}>{DOOR_LABEL[b.d]}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#3a3a3a" }}>
                <span><strong style={{ fontSize: 18 }}>{b.total}</strong> programs</span>
                <span><strong style={{ fontSize: 18 }}>{b.active}</strong> active</span>
                <span><strong style={{ fontSize: 18 }}>{b.paying}</strong> paying</span>
                <span><strong style={{ fontSize: 18 }}>{b.founding}</strong> founding</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <H>Programs</H>
      <div style={grid}>
        <Card label="Total programs" value={seg.all.length} onClick={() => openProg("all", "All programs")} />
        <Card label="Active this week" value={seg.active7.length} sub="signed in ≤ 7 days" accent="#1a7f37" onClick={() => openProg("active7", "Active this week")} />
        <Card label="Active this month" value={seg.active30.length} sub="signed in ≤ 30 days" accent="#1a7f37" onClick={() => openProg("active30", "Active this month")} />
        <Card label="New this week" value={seg.new.length} sub={seg.newMonth.length + " this month"} accent="#c4922a" onClick={() => openProg("new", "New this week")} />
      </div>

      <H>Plans</H>
      <div style={grid}>
        <Card label="Paying" value={seg.paying.length} sub="active Stripe subscription" accent="#1a7f37" onClick={() => openProg("paying", "Paying programs")} />
        <Card label="Founding members" value={seg.founding.length} accent="#c4922a" onClick={() => openProg("founding", "Founding members")} />
        <Card label="Beta (free Pro)" value={seg.beta.length} accent="#b06fc9" onClick={() => openProg("beta", "Beta programs")} />
        <Card label="Free" value={seg.free.length} onClick={() => openProg("free", "Free programs")} />
      </div>

      <H>Money & traffic{door !== "all" ? " (all sites)" : ""}</H>
      <div style={grid}>
        <Card label="Revenue this month" value={fmtMoney(rev)} sub="Stripe · click for payments" accent="#1a7f37" onClick={() => setDrill({ type: "payments" })} />
        <Card label="Visitors this week" value={visitors7} sub={pv.length.toLocaleString() + " page views"} onClick={() => setDrill({ type: "traffic" })} />
        <Card label="Avg session length" value={avgMin != null ? avgMin + " min" : "—"} sub={avgMin != null ? sessions.length + " sessions · click for list" : "collecting — new tracking"} onClick={() => setDrill({ type: "sessions" })} />
      </div>

      <p style={{ color: "#9a9284", fontSize: 11.5, marginTop: 22, lineHeight: 1.5 }}>
        Billing begins September 1, so revenue is expected to be minimal until then. Session-length tracking was just turned on, so that figure fills in over the coming days.
      </p>
    </div>
  );
}
