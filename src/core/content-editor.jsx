// Content & Brand editor (Phase 8 admin app). Lets a platform admin edit marketing
// copy + brand theme per door (Theatre4u / ArtsTracker), stored in site_content / site_theme.
// Public pages read these tables at runtime (wired separately). No code deploy needed to edit content.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";

const DOORS = [
  { id: "theatre4u",   label: "Theatre4u" },
  { id: "artstracker", label: "ArtsTracker" },
];

// Editable marketing copy (site_content rows, keyed by vertical + ckey).
const CONTENT_FIELDS = [
  { key: "landing.hero.headline",  label: "Hero headline",            type: "text",     ph: "Every costume, prop & set piece — in one place." },
  { key: "landing.hero.subhead",   label: "Hero sub-headline",        type: "textarea", ph: "The inventory + exchange platform built for theatre programs." },
  { key: "landing.hero.cta_label", label: "Primary button label",     type: "text",     ph: "Get Started Free" },
  { key: "landing.announcement",   label: "Announcement bar (optional, blank = hidden)", type: "text", ph: "" },
];

// Editable brand theme (site_theme.theme jsonb per vertical).
const THEME_FIELDS = [
  { key: "primary",  label: "Primary color",  type: "color", def: "#c4922a" },
  { key: "accent",   label: "Accent color",   type: "color", def: "#e8b85d" },
  { key: "logo_url", label: "Logo image URL", type: "text",  def: "" },
];

const S = {
  wrap:  { maxWidth: 720, margin: "0 auto", padding: "8px 4px" },
  tabs:  { display: "flex", gap: 8, marginBottom: 20 },
  tab:   (on) => ({ padding: "8px 18px", borderRadius: 8, border: "1px solid " + (on ? "#c4922a" : "#dcd6cc"), background: on ? "#c4922a" : "#fff", color: on ? "#fff" : "#555", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }),
  card:  { background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: 20, marginBottom: 18 },
  h3:    { margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#2a2a2a" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 },
  input: { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" },
  row:   { marginBottom: 14 },
};

export function ContentBrandEditor({ userId }) {
  const [door, setDoor] = useState("theatre4u");
  const [content, setContent] = useState({}); // "vertical||ckey" -> value
  const [theme, setTheme] = useState({});      // vertical -> { primary, accent, logo_url }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: c }, { data: t }] = await Promise.all([
        SB.from("site_content").select("vertical,ckey,cvalue"),
        SB.from("site_theme").select("vertical,theme"),
      ]);
      if (!alive) return;
      const cm = {}; (c || []).forEach(r => { cm[r.vertical + "||" + r.ckey] = r.cvalue || ""; });
      const tm = {}; (t || []).forEach(r => { tm[r.vertical] = r.theme || {}; });
      setContent(cm); setTheme(tm); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const cval   = (k) => content[door + "||" + k] ?? "";
  const setC   = (k, v) => setContent(p => ({ ...p, [door + "||" + k]: v }));
  const tval   = (k, def) => (theme[door] || {})[k] ?? def ?? "";
  const setT   = (k, v) => setTheme(p => ({ ...p, [door]: { ...(p[door] || {}), [k]: v } }));

  const save = async () => {
    setSaving(true); setMsg("");
    const now = new Date().toISOString();
    const rows = CONTENT_FIELDS.map(f => ({ vertical: door, ckey: f.key, cvalue: content[door + "||" + f.key] ?? "", updated_by: userId || null, updated_at: now }));
    const { error: e1 } = await SB.from("site_content").upsert(rows, { onConflict: "vertical,ckey" });
    const { error: e2 } = await SB.from("site_theme").upsert({ vertical: door, theme: theme[door] || {}, updated_by: userId || null, updated_at: now }, { onConflict: "vertical" });
    setSaving(false);
    const err = e1 || e2;
    setMsg(err ? ("Error: " + err.message) : "✓ Saved");
    setTimeout(() => setMsg(""), 3500);
  };

  if (loading) return <div style={{ padding: 24, color: "#888" }}>Loading content…</div>;

  return (
    <div style={S.wrap}>
      <p style={{ color: "#777", fontSize: 13, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>
        Edit your marketing copy and brand look for each door. Changes save to the database and show on the public pages.
        <br /><strong>Note:</strong> editing the price shown here does <em>not</em> change what customers are charged — real prices live in Stripe.
      </p>

      <div style={S.tabs}>
        {DOORS.map(d => (
          <button key={d.id} style={S.tab(door === d.id)} onClick={() => setDoor(d.id)}>{d.label}</button>
        ))}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Brand — {DOORS.find(d => d.id === door)?.label}</h3>
        {THEME_FIELDS.map(f => (
          <div key={f.key} style={S.row}>
            <label style={S.label}>{f.label}</label>
            {f.type === "color"
              ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="color" value={tval(f.key, f.def) || f.def} onChange={e => setT(f.key, e.target.value)} style={{ width: 46, height: 34, padding: 0, border: "1px solid #d5cfc4", borderRadius: 6, cursor: "pointer" }} />
                  <input style={{ ...S.input, width: 120 }} value={tval(f.key, f.def)} onChange={e => setT(f.key, e.target.value)} placeholder={f.def} />
                </div>
              : <input style={S.input} value={tval(f.key, f.def)} onChange={e => setT(f.key, e.target.value)} placeholder="https://… (paste an image URL)" />}
          </div>
        ))}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Landing page copy — {DOORS.find(d => d.id === door)?.label}</h3>
        {CONTENT_FIELDS.map(f => (
          <div key={f.key} style={S.row}>
            <label style={S.label}>{f.label}</label>
            {f.type === "textarea"
              ? <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} value={cval(f.key)} onChange={e => setC(f.key, e.target.value)} placeholder={f.ph} />
              : <input style={S.input} value={cval(f.key)} onChange={e => setC(f.key, e.target.value)} placeholder={f.ph} />}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button style={{ padding: "11px 24px", borderRadius: 9, border: "none", background: saving ? "#9bbfa4" : "#1a7f37", color: "#fff", fontWeight: 800, fontSize: 14, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {msg && <span style={{ fontWeight: 700, fontSize: 13, color: msg.startsWith("✓") ? "#1a7f37" : "#c0392b" }}>{msg}</span>}
      </div>
    </div>
  );
}
