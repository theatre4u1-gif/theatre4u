// Watch — the triage center (Phase 8 admin app). One place for anything that might need action:
// content reports (safety), at-risk paying/founding programs (churn), data anomalies, and feedback.
// Sub-views reuse Data health + Content reports; the at-risk list and feedback inbox live here.
import React, { useState, useEffect, useContext } from "react";
import { SB } from "./supabase.js";
import { AdminBackContext } from "./admin-back.js";
import { DataHealthDashboard } from "./admin-health.jsx";
import { AdminContentReports } from "./admin-reports.jsx";
import { ProgramDetail } from "./admin-program.jsx";
import { lastActiveTs, doorOf } from "../lib/admin-metrics.js";

const DAY = 86400000;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const agoDays = (ts) => { if (!ts) return "never"; const d = Math.floor((Date.now() - ts) / DAY); return d <= 0 ? "today" : d === 1 ? "1 day ago" : d + " days ago"; };
const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const planLabel = (o) => o.stripe_subscription_id ? "Paying" : o.founding_member ? "Founding" : o.temp_pro ? "Beta" : (o.plan || "free");
const planColor = (o) => o.stripe_subscription_id ? "#1a7f37" : o.founding_member ? "#c4922a" : "#8a8272";

const th = { textAlign: "left", fontSize: 11, fontWeight: 800, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, padding: "8px 10px", borderBottom: "1px solid #e6e0d6" };
const td = { fontSize: 13, color: "#3a3a3a", padding: "9px 10px", borderBottom: "1px solid #f0ece3", verticalAlign: "top" };
const badge = (color) => ({ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: color + "1a" });

const FB_STATUS = ["new", "reviewing", "resolved", "wont_fix", "actioned"];

function FeedbackInbox({ rows, onStatus }) {
  const [openId, setOpenId] = useState(null);
  if (!rows.length) return <div style={{ color: "#888", fontSize: 13 }}>No feedback yet.</div>;
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead><tr><th style={th}>Program</th><th style={th}>Type</th><th style={th}>Rating</th><th style={th}>When</th><th style={th}>Status</th></tr></thead>
        <tbody>
          {rows.map(f => (
            <React.Fragment key={f.id}>
              <tr onClick={() => setOpenId(openId === f.id ? null : f.id)} style={{ cursor: "pointer", background: (f.status || "new") === "new" ? "#fdf6ea" : "transparent" }}>
                <td style={{ ...td, fontWeight: 700 }}>{f.org_name || "—"}</td>
                <td style={td}>{f.category || "—"}</td>
                <td style={td}>{f.rating != null ? f.rating + "★" : "—"}</td>
                <td style={td}>{fmtDate(f.created_at)}</td>
                <td style={td} onClick={e => e.stopPropagation()}>
                  <select value={f.status || "new"} onChange={e => onStatus(f.id, e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 7, border: "1px solid #d5cfc4", fontSize: 12, fontFamily: "inherit", background: "#fff" }}>
                    {FB_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
              {openId === f.id && (
                <tr><td style={{ ...td, background: "#faf7f0" }} colSpan={5}>
                  {f.message ? <div style={{ marginBottom: 6 }}>{f.message}</div> : <div style={{ color: "#9a9284", marginBottom: 6 }}>(no written message)</div>}
                  <div style={{ fontSize: 12, color: "#8a8272" }}>
                    {f.hardest_inventory ? "Hardest: " + f.hardest_inventory + " · " : ""}
                    {f.lending_barrier ? "Lending barrier: " + f.lending_barrier + " · " : ""}
                    {f.wishlist_hour ? "Wishlist: " + f.wishlist_hour : ""}
                  </div>
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AtRiskList({ rows, onOpen }) {
  if (!rows.length) return <div style={{ color: "#1a7f37", fontSize: 13 }}>No paying or founding programs are at risk right now. ✓</div>;
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead><tr><th style={th}>Program</th><th style={th}>Plan</th><th style={th}>Items</th><th style={th}>Last active</th><th style={th}></th></tr></thead>
        <tbody>
          {rows.map(o => (
            <tr key={o.id}>
              <td style={td}><div onClick={() => onOpen(o)} style={{ fontWeight: 700, color: "#a5731f", cursor: "pointer", textDecoration: "underline" }}>{o.name || "(no name)"}</div><div style={{ fontSize: 11.5, color: "#9a9284" }}>{o.email || ""}</div></td>
              <td style={td}><span style={badge(planColor(o))}>{planLabel(o)}</span></td>
              <td style={td}>{o._items}</td>
              <td style={{ ...td, color: "#c07a00", fontWeight: 700 }}>{agoDays(o._active)}</td>
              <td style={{ ...td, textAlign: "right" }}><button onClick={() => onOpen(o)} style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #d5cfc4", background: "#fff", color: "#555", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Open →</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WatchDashboard({ door = "all" }) {
  const [sub, setSub] = useState("reports");
  const [orgs, setOrgs] = useState(null);
  const [reports, setReports] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [detailOrg, setDetailOrg] = useState(null);
  const [err, setErr] = useState("");
  const back = useContext(AdminBackContext);

  useEffect(() => {
    if (!back || !detailOrg) return;
    return back(() => setDetailOrg(null));
  }, [back, detailOrg]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [orgsRes, usageRes, repRes, fbRes] = await Promise.all([
          SB.from("orgs").select("id,name,email,plan,temp_pro,founding_member,stripe_subscription_id,last_seen,account_status,owner_id,deleted_at,vertical,signup_domain"),
          SB.from("org_platform_usage").select("org_id,total_items,last_item_added,last_exchange_activity").limit(20000),
          SB.from("content_reports").select("id,status,created_at").limit(2000),
          SB.from("beta_feedback").select("id,org_name,category,rating,message,hardest_inventory,lending_barrier,wishlist_hour,status,created_at").order("created_at", { ascending: false }).limit(2000),
        ]);
        if (!alive) return;
        if (orgsRes.error) throw orgsRes.error;
        const um = {}, im = {}; (usageRes.data || []).forEach(u => { um[u.org_id] = u; im[u.org_id] = u.total_items || 0; });
        setOrgs((orgsRes.data || []).filter(o => !o.deleted_at).map(o => ({ ...o, _items: im[o.id] || 0, _active: lastActiveTs(o, um[o.id]) })));
        setReports(repRes.data || []);
        setFeedback(fbRes.data || []);
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  const setFbStatus = async (id, status) => {
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f));
    await SB.from("beta_feedback").update({ status }).eq("id", id);
  };

  if (detailOrg) return <ProgramDetail org={detailOrg} onBack={() => setDetailOrg(null)} onChanged={(id, p) => setOrgs(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))} />;
  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load Watch: {err}</div>;
  if (!orgs) return <div style={{ padding: 24, color: "#888" }}>Loading Watch…</div>;

  const doored = door === "all" ? orgs : orgs.filter(o => doorOf(o) === door);
  const atRisk = doored.filter(o => (o.stripe_subscription_id || o.founding_member) && o.account_status !== "closed" && (!o._active || (Date.now() - o._active) > 14 * DAY));
  const openReports = reports.filter(r => !["resolved", "dismissed", "actioned", "closed"].includes((r.status || "").toLowerCase()));
  const newFeedback = feedback.filter(f => (f.status || "new") === "new");
  const groupsBy = (fn) => { const m = {}; orgs.forEach(o => { const k = fn(o); if (!k) return; (m[k] = m[k] || []).push(o); }); return Object.values(m).filter(l => l.length > 1); };
  const anomalies = groupsBy(o => norm(o.name)).length + groupsBy(o => norm(o.email)).length
    + orgs.filter(o => o._items > 0 && !o.last_seen).length
    + orgs.filter(o => o.account_status && !["active", "closed"].includes(o.account_status)).length
    + orgs.filter(o => o.stripe_subscription_id && o.temp_pro).length
    + orgs.filter(o => !o.owner_id).length;

  const SUBS = [
    ["reports", "🚩 Content reports", openReports.length, "#c0392b"],
    ["atrisk", "💤 At-risk", atRisk.length, "#c07a00"],
    ["anomalies", "🩺 Data health", anomalies, "#c07a00"],
    ["feedback", "💬 Feedback", newFeedback.length, "#2a6fb0"],
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 12px" }}>Anything that may need you, in one place. Reports and safety first, then churn risk, data quality, and feedback.</p>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
        {SUBS.map(([id, lbl, n, c]) => (
          <button key={id} onClick={() => setSub(id)}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid " + (sub === id ? "#c4922a" : "#e0d9cc"), background: sub === id ? "#c4922a" : "#fff", color: sub === id ? "#fff" : "#6b6459", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {lbl}{n > 0 ? <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 20, color: sub === id ? "#fff" : c, background: sub === id ? "rgba(255,255,255,.22)" : c + "1a" }}>{n}</span> : null}
          </button>
        ))}
      </div>

      {sub === "reports" && <AdminContentReports />}
      {sub === "atrisk" && <AtRiskList rows={atRisk} onOpen={setDetailOrg} />}
      {sub === "anomalies" && <DataHealthDashboard />}
      {sub === "feedback" && <FeedbackInbox rows={feedback} onStatus={setFbStatus} />}
    </div>
  );
}
