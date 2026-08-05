// Content Reports — admin review queue for user-submitted reports of
// inappropriate, explicit, or illegal content (images, listings, items).
// Reads/updates public.content_reports; RLS restricts this to platform admins.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";

const STATUS_LABELS = {
  open:      { label: "Open",      color: "#c2185b", bg: "rgba(194,24,91,.10)" },
  reviewing: { label: "Reviewing", color: "#b26a00", bg: "rgba(178,106,0,.10)" },
  actioned:  { label: "Actioned",  color: "#1a7f37", bg: "rgba(26,127,55,.10)" },
  dismissed: { label: "Dismissed", color: "#666",    bg: "rgba(0,0,0,.05)" },
};

export function AdminContentReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("open");
  const [uid, setUid]         = useState(null);
  const [msg, setMsg]         = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await SB.from("content_reports")
      .select("*").order("created_at", { ascending: false }).limit(500);
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => {
    SB.auth.getUser().then(({ data }) => setUid(data?.user?.id || null));
    load();
  }, []);

  const setStatus = async (id, status) => {
    const { error } = await SB.from("content_reports")
      .update({ status, reviewed_by: uid, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setReports(p => p.map(r => r.id === id ? { ...r, status, reviewed_at: new Date().toISOString() } : r));
      setMsg("✓ Updated");
      setTimeout(() => setMsg(""), 1600);
    }
  };

  const shown = filter === "all" ? reports : reports.filter(r => (r.status || "open") === filter);
  const openCount = reports.filter(r => (r.status || "open") === "open").length;

  const fmtDate = (s) => { try { return new Date(s).toLocaleString(); } catch { return s; } };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: 0 }}>🚩 Content Reports</h2>
        {openCount > 0 && <span style={{ background: "rgba(194,24,91,.12)", color: "#c2185b", fontWeight: 800, fontSize: 12, padding: "3px 10px", borderRadius: 999 }}>{openCount} open</span>}
        <button className="btn btn-o btn-sm" style={{ marginLeft: "auto" }} onClick={load}>↺ Refresh</button>
      </div>

      <div style={{ background: "rgba(194,24,91,.06)", border: "1px solid rgba(194,24,91,.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "#8b1a2a", lineHeight: 1.5 }}>
        <strong>Child-safety note:</strong> If any report involves a nude or sexual image of a person who may be a minor, do not download, forward, or delete it. Preserve it, and report it to the NCMEC CyberTipline at report.cybertip.org (this is a legal obligation). See the internal CSAM procedure.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["open", "reviewing", "actioned", "dismissed", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", cursor: "pointer",
              fontSize: 12.5, fontWeight: filter === f ? 800 : 500, fontFamily: "inherit",
              background: filter === f ? "var(--gold)" : "transparent", color: filter === f ? "#1a0f00" : "var(--muted)" }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {msg && <div style={{ color: "#1a7f37", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      {loading && <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>Loading…</div>}
      {!loading && shown.length === 0 && <div style={{ color: "var(--muted)", padding: 24, textAlign: "center" }}>No {filter === "all" ? "" : filter + " "}reports.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shown.map(r => {
          const st = STATUS_LABELS[r.status || "open"] || STATUS_LABELS.open;
          return (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", gap: 14, alignItems: "flex-start", background: "var(--white,#fff)" }}>
              {r.image_url
                ? <a href={r.image_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}><img src={r.image_url} alt="reported" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} /></a>
                : <div style={{ width: 72, height: 72, borderRadius: 8, background: "rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>🗒</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{r.reason || "(no reason)"}</span>
                  <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999 }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                  {r.item_name && <>Item: <strong>{r.item_name}</strong> · </>}
                  {r.context && <>Context: {r.context} · </>}
                  {fmtDate(r.created_at)}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--faint,#999)", marginTop: 3, wordBreak: "break-all" }}>
                  Reported org: {r.reported_org_id || "—"} · Item id: {r.reported_item_id || "—"} · By: {r.reporter_org_id || "—"}
                </div>
                {r.details && <div style={{ fontSize: 12.5, marginTop: 6, padding: "6px 10px", background: "rgba(0,0,0,.03)", borderRadius: 6 }}>{r.details}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-o btn-sm" onClick={() => setStatus(r.id, "reviewing")}>Reviewing</button>
                  <button className="btn btn-g btn-sm" onClick={() => setStatus(r.id, "actioned")}>Actioned</button>
                  <button className="btn btn-p btn-sm" onClick={() => setStatus(r.id, "dismissed")}>Dismiss</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
