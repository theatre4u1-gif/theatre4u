// Programs — the one place to find and act on any program/user (Phase 8 admin app).
// Search-first list with plan filters + a Leads view; every row opens the per-program
// support console (ProgramDetail). Replaces the old Operations "Users & Leads / Programs /
// Accounts" tabs.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { ProgramDetail } from "./admin-program.jsx";
import { lastActiveTs, doorOf } from "../lib/admin-metrics.js";

const DAY = 86400000;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const agoDays = (iso) => { if (!iso) return "never"; const d = Math.floor((Date.now() - new Date(iso)) / DAY); return d <= 0 ? "today" : d === 1 ? "1 day ago" : d + " days ago"; };
const planLabel = (o) => o.account_status === "closed" ? "Closed" : o.stripe_subscription_id ? "Paying" : o.founding_member ? "Founding" : o.temp_pro ? "Beta (free Pro)" : (o.plan || "free");
const planColor = (o) => o.account_status === "closed" ? "#b23b3b" : o.stripe_subscription_id ? "#1a7f37" : o.founding_member ? "#c4922a" : o.temp_pro ? "#b06fc9" : "#8a8272";

const th = { textAlign: "left", fontSize: 11, fontWeight: 800, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, padding: "8px 10px", borderBottom: "1px solid #e6e0d6" };
const td = { fontSize: 13, color: "#3a3a3a", padding: "9px 10px", borderBottom: "1px solid #f0ece3", verticalAlign: "middle" };
const badge = (color) => ({ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: color + "1a" });

const FILTERS = [
  ["all", "All"], ["paying", "Paying"], ["founding", "Founding"], ["beta", "Beta Pro"],
  ["free", "Free"], ["closed", "Closed"], ["leads", "Leads"],
];

export function ProgramsDashboard({ door = "all" }) {
  const [orgs, setOrgs] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [detailOrg, setDetailOrg] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [flash, setFlash] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [orgsRes, usageRes, leadRes] = await Promise.all([
          SB.from("orgs").select("id,name,email,plan,temp_pro,founding_member,stripe_subscription_id,created_at,last_seen,deleted_at,account_status,location,city,vertical,signup_domain,owner_id"),
          SB.from("org_platform_usage").select("org_id,total_items,last_item_added,last_exchange_activity").limit(20000),
          SB.from("beta_leads").select("id,org,name,email,type,converted,created_at").order("created_at", { ascending: false }).limit(2000),
        ]);
        if (!alive) return;
        if (orgsRes.error) throw orgsRes.error;
        const im = {}, um = {}; (usageRes.data || []).forEach(u => { im[u.org_id] = u.total_items || 0; um[u.org_id] = u; });
        setItemsMap(im);
        setOrgs((orgsRes.data || []).filter(o => !o.deleted_at).map(o => ({ ...o, _um: um[o.id] })));
        setLeads(leadRes.data || []);
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  const toggleBeta = async (o) => {
    const next = !o.temp_pro; setBusyId(o.id);
    const { error } = await SB.from("orgs").update({ temp_pro: next, temp_pro_granted_at: next ? new Date().toISOString() : null, temp_pro_note: next ? "Granted via admin programs" : "Removed via admin programs" }).eq("id", o.id);
    setBusyId("");
    if (error) setFlash("Error: " + error.message);
    else { setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, temp_pro: next } : x)); setFlash("✓ Beta Pro " + (next ? "granted" : "removed")); }
    setTimeout(() => setFlash(""), 3500);
  };

  if (detailOrg) return <ProgramDetail org={detailOrg} onBack={() => setDetailOrg(null)} onChanged={(id, p) => setOrgs(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))} />;
  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load programs: {err}</div>;
  if (!orgs) return <div style={{ padding: 24, color: "#888" }}>Loading programs…</div>;

  const doored = door === "all" ? orgs : orgs.filter(o => doorOf(o) === door);
  const match = (o) => {
    if (o.account_status === "closed" && filter !== "closed") return false;
    if (filter === "paying") return !!o.stripe_subscription_id;
    if (filter === "founding") return !!o.founding_member;
    if (filter === "beta") return o.temp_pro && !o.founding_member && !o.stripe_subscription_id;
    if (filter === "free") return o.plan === "free" && !o.temp_pro && !o.stripe_subscription_id;
    if (filter === "closed") return o.account_status === "closed";
    return true; // all (non-closed)
  };
  const list = doored.filter(match).filter(o => {
    const s = (o.name || "") + " " + (o.email || "") + " " + (o.location || o.city || "");
    return s.toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const chip = (id, lbl) => (
    <button key={id} onClick={() => setFilter(id)} style={{ padding: "6px 13px", borderRadius: 20, border: "1px solid " + (filter === id ? "#c4922a" : "#e0d9cc"), background: filter === id ? "#c4922a" : "#fff", color: filter === id ? "#fff" : "#6b6459", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
      {lbl}{id === "leads" ? " (" + leads.length + ")" : ""}
    </button>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 12px" }}>Find any program and open its console to help, grant access, lock, or close. This is your one stop for a single user.</p>
      {flash && <div style={{ marginBottom: 10, fontWeight: 700, fontSize: 13, color: flash.startsWith("Error") ? "#c0392b" : "#1a7f37" }}>{flash}</div>}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>{FILTERS.map(([id, lbl]) => chip(id, lbl))}</div>

      {filter === "leads" ? (
        <>
          <div style={{ fontSize: 12, color: "#9a9284", marginBottom: 8 }}>{leads.length} lead{leads.length === 1 ? "" : "s"} (from the pre-launch waitlist / contact forms)</div>
          <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
              <thead><tr><th style={th}>Program</th><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Type</th><th style={th}>Converted</th><th style={th}>When</th></tr></thead>
              <tbody>
                {leads.length === 0 && <tr><td style={td} colSpan={6}>No leads.</td></tr>}
                {leads.map(l => (
                  <tr key={l.id}>
                    <td style={td}>{l.org || "—"}</td><td style={td}>{l.name || "—"}</td>
                    <td style={td}>{l.email || "—"}</td><td style={td}>{l.type || "—"}</td>
                    <td style={td}>{l.converted ? <span style={badge("#1a7f37")}>converted</span> : <span style={{ color: "#9a9284" }}>—</span>}</td>
                    <td style={td}>{fmtDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, location…" style={{ width: "100%", maxWidth: 380, padding: "9px 12px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" }} />
          <div style={{ fontSize: 12, color: "#9a9284", marginBottom: 8 }}>{list.length} program{list.length === 1 ? "" : "s"}</div>
          <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
              <thead><tr>
                <th style={th}>Program</th><th style={th}>Plan</th><th style={th}>Items</th><th style={th}>Location</th><th style={th}>Last seen</th><th style={th}>Joined</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {list.length === 0 && <tr><td style={td} colSpan={7}>No programs match.</td></tr>}
                {list.map(o => (
                  <tr key={o.id}>
                    <td style={td}><div onClick={() => setDetailOrg(o)} style={{ fontWeight: 700, color: "#a5731f", cursor: "pointer", textDecoration: "underline" }}>{o.name || "(no name)"}</div><div style={{ fontSize: 11.5, color: "#9a9284" }}>{o.email || ""}</div></td>
                    <td style={td}><span style={badge(planColor(o))}>{planLabel(o)}</span></td>
                    <td style={td}>{itemsMap[o.id] || 0}</td>
                    <td style={td}>{o.location || o.city || "—"}</td>
                    <td style={td}>{agoDays(lastActiveTs(o, o._um) ? new Date(lastActiveTs(o, o._um)).toISOString() : o.last_seen)}</td>
                    <td style={td}>{fmtDate(o.created_at)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {!o.stripe_subscription_id && !o.founding_member && o.account_status !== "closed" && (
                        <button onClick={() => toggleBeta(o)} disabled={busyId === o.id}
                          style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid " + (o.temp_pro ? "#c4922a" : "#d5cfc4"), background: o.temp_pro ? "rgba(212,168,67,.12)" : "#fff", color: o.temp_pro ? "#a5731f" : "#666", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>
                          {busyId === o.id ? "…" : o.temp_pro ? "⭐ Beta Pro on" : "Grant Beta Pro"}
                        </button>
                      )}
                      <button onClick={() => setDetailOrg(o)} style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #d5cfc4", background: "#fff", color: "#555", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Manage →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
