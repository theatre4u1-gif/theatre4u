// Usage & Engagement module (Phase 8 admin app).
// Who is using the platform, how much, and who's gone quiet. Reads login_events, orgs.last_seen,
// org_platform_usage, and the new app_sessions. Program rows open the support console (ProgramDetail).
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { ProgramDetail } from "./admin-program.jsx";

const DAY = 86400000;
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const agoDays = (iso) => { if (!iso) return "never"; const n = Math.floor((Date.now() - new Date(iso)) / DAY); return n <= 0 ? "today" : n === 1 ? "1d ago" : n + "d ago"; };
const score = (u) => (u.total_items || 0) + (u.productions_tracked || 0) * 3 + (u.exchanges_completed || 0) * 5 + (u.community_posts || 0) * 2 + (u.requests_sent || 0) + (u.requests_received || 0);

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || "#2a2a2a", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9a9284", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ series, height = 70, color = "#c4922a" }) {
  const max = Math.max(1, ...series.map(s => s.n));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, borderBottom: "1px solid #e6e0d6", paddingBottom: 2 }}>
      {series.map((s, i) => (
        <div key={i} title={s.title} style={{ flex: 1, minWidth: 2, height: Math.max(1, (s.n / max) * height) + "px", background: s.n ? color : "#efe9de", borderRadius: "2px 2px 0 0" }} />
      ))}
    </div>
  );
}

const th = { textAlign: "left", fontSize: 11, fontWeight: 800, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, padding: "8px 10px", borderBottom: "1px solid #e6e0d6" };
const td = { fontSize: 13, color: "#3a3a3a", padding: "9px 10px", borderBottom: "1px solid #f0ece3" };
const nameLink = (onOpen, o) => <span onClick={() => onOpen(o)} style={{ fontWeight: 700, color: "#a5731f", cursor: "pointer", textDecoration: "underline" }}>{o.org_name || o.name || "(no name)"}</span>;

export function UsageDashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [detailOrg, setDetailOrg] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const login30 = new Date(Date.now() - 30 * DAY).toISOString();
        const sess14 = new Date(Date.now() - 14 * DAY).toISOString();
        const [loginRes, orgsRes, usageRes, sessRes] = await Promise.all([
          SB.from("login_events").select("org_id,created_at").gte("created_at", login30).limit(50000),
          SB.from("orgs").select("id,name,plan,temp_pro,founding_member,stripe_subscription_id,last_seen,deleted_at").is("deleted_at", null),
          SB.from("org_platform_usage").select("*").limit(20000),
          SB.from("app_sessions").select("started_at,last_seen_at").gte("started_at", sess14).limit(20000),
        ]);
        if (!alive) return;
        if (orgsRes.error) throw orgsRes.error;
        const orgs = orgsRes.data || [];
        const seenMap = {}; orgs.forEach(o => { seenMap[o.id] = o.last_seen; });

        const now = Date.now();
        const bucket = (o) => { if (!o.last_seen) return "never"; const n = (now - new Date(o.last_seen)) / DAY; return n <= 7 ? "a7" : n <= 30 ? "a30" : n <= 90 ? "dormant" : "inactive"; };
        const counts = { a7: 0, a30: 0, dormant: 0, inactive: 0, never: 0 };
        orgs.forEach(o => { counts[bucket(o)]++; });

        // logins per day (30d)
        const logins = loginRes.data || [];
        const lmap = {}; logins.forEach(e => { const k = dayKey(e.created_at); lmap[k] = (lmap[k] || 0) + 1; });
        const loginSeries = []; for (let i = 29; i >= 0; i--) { const day = new Date(now - i * DAY); const k = dayKey(day); loginSeries.push({ n: lmap[k] || 0, title: k + ": " + (lmap[k] || 0) }); }
        const distinctLogins = new Set(logins.map(e => e.org_id)).size;

        // sessions per day (14d) + avg duration
        const sess = (sessRes.data || []).map(s => ({ day: dayKey(s.started_at), mins: Math.max(0, (new Date(s.last_seen_at) - new Date(s.started_at)) / 60000) }));
        const smap = {}; sess.forEach(s => { smap[s.day] = (smap[s.day] || 0) + 1; });
        const sessSeries = []; for (let i = 13; i >= 0; i--) { const day = new Date(now - i * DAY); const k = dayKey(day); sessSeries.push({ n: smap[k] || 0, title: k + ": " + (smap[k] || 0) }); }
        const avgMin = sess.length ? Math.round(sess.reduce((a, s) => a + s.mins, 0) / sess.length) : null;

        // usage merge
        const usage = (usageRes.data || []).map(u => ({ ...u, _score: score(u), _lastSeen: seenMap[u.org_id] }));
        const mostActive = usage.slice().sort((a, b) => b._score - a._score).filter(u => u._score > 0).slice(0, 12);
        const needsAttention = usage.filter(u => (u.total_items || 0) > 0 && u._lastSeen && (now - new Date(u._lastSeen)) / DAY > 30)
          .sort((a, b) => (b.total_items || 0) - (a.total_items || 0)).slice(0, 12);

        setD({ counts, total: orgs.length, loginSeries, distinctLogins, totalLogins: logins.length, sessSeries, avgMin, sessCount: sess.length, mostActive, needsAttention });
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  if (detailOrg) return <ProgramDetail org={detailOrg} onBack={() => setDetailOrg(null)} onChanged={() => {}} />;
  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load usage: {err}</div>;
  if (!d) return <div style={{ padding: 24, color: "#888" }}>Loading usage…</div>;

  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 };
  const H = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: "26px 0 12px" }}>{children}</h3>;
  const card = { background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: 18 };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 4px" }}>Who's active, who's gone quiet, and how the platform is being used. Click any program to open its support console.</p>

      <H>Engagement (by last sign-in)</H>
      <div style={grid}>
        <Stat label="Active ≤ 7 days" value={d.counts.a7} accent="#1a7f37" />
        <Stat label="Active ≤ 30 days" value={d.counts.a30 + d.counts.a7} accent="#1a7f37" sub="includes this-week" />
        <Stat label="Dormant 30–90d" value={d.counts.dormant} accent="#c07a00" />
        <Stat label="Inactive 90d+ / never" value={d.counts.inactive + d.counts.never} accent="#a5342b" />
      </div>

      <H>Logins — last 30 days</H>
      <div style={card}>
        <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 24, fontWeight: 800 }}>{d.totalLogins}</div><div style={{ fontSize: 12, color: "#9a9284" }}>total logins</div></div>
          <div><div style={{ fontSize: 24, fontWeight: 800 }}>{d.distinctLogins}</div><div style={{ fontSize: 12, color: "#9a9284" }}>distinct programs</div></div>
        </div>
        <BarChart series={d.loginSeries} />
        <div style={{ fontSize: 11, color: "#b3aa98", marginTop: 4 }}>30 days ago → today</div>
      </div>

      <H>Sessions — last 14 days</H>
      <div style={card}>
        <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 24, fontWeight: 800 }}>{d.sessCount}</div><div style={{ fontSize: 12, color: "#9a9284" }}>sessions</div></div>
          <div><div style={{ fontSize: 24, fontWeight: 800 }}>{d.avgMin != null ? d.avgMin + " min" : "—"}</div><div style={{ fontSize: 12, color: "#9a9284" }}>avg length</div></div>
        </div>
        <BarChart series={d.sessSeries} color="#1a7f37" height={54} />
        <div style={{ fontSize: 11, color: "#b3aa98", marginTop: 4 }}>Session tracking is new — this fills in over the coming days.</div>
      </div>

      <H>Most active programs</H>
      <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead><tr><th style={th}>Program</th><th style={th}>Items</th><th style={th}>Productions</th><th style={th}>Exchanges</th><th style={th}>Last seen</th></tr></thead>
          <tbody>
            {d.mostActive.length === 0 && <tr><td style={td} colSpan={5}>No activity yet.</td></tr>}
            {d.mostActive.map((u, i) => (
              <tr key={i}><td style={td}>{nameLink(setDetailOrg, { id: u.org_id, name: u.org_name })}</td><td style={td}>{u.total_items || 0}</td><td style={td}>{u.productions_tracked || 0}</td><td style={td}>{u.exchanges_completed || 0}</td><td style={td}>{agoDays(u._lastSeen)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>Needs attention — had activity, now quiet (30d+)</H>
      <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead><tr><th style={th}>Program</th><th style={th}>Items</th><th style={th}>Productions</th><th style={th}>Last seen</th></tr></thead>
          <tbody>
            {d.needsAttention.length === 0 && <tr><td style={td} colSpan={4}>Nobody's gone quiet — nice.</td></tr>}
            {d.needsAttention.map((u, i) => (
              <tr key={i}><td style={td}>{nameLink(setDetailOrg, { id: u.org_id, name: u.org_name })}</td><td style={td}>{u.total_items || 0}</td><td style={td}>{u.productions_tracked || 0}</td><td style={{ ...td, color: "#c07a00", fontWeight: 600 }}>{agoDays(u._lastSeen)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
}
