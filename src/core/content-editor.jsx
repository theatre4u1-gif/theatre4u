// Content & Brand editor (Phase 8 admin app).
// Draft → live-preview → publish. Edits save as a private DRAFT (never public) and update a live
// preview as you type; PUBLISH copies the draft to the public value. Per door (Theatre4u/ArtsTracker).
// Tables: site_content (cvalue = published, draft = working) + site_theme (theme / draft_theme).
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";

const DOORS = [
  { id: "theatre4u",   label: "Theatre4u" },
  { id: "artstracker", label: "ArtsTracker" },
];

// The REAL live defaults per door (mirror src/core/public.jsx). Empty fields fall back to these,
// so an unedited door shows its true current copy — and switching doors actually changes the preview.
const DOOR_DEFAULTS = {
  theatre4u: {
    logo: "/logo-theatre4u.svg",
    "landing.hero.eyebrow":     "🎭 The Platform for Theatre Programs",
    "landing.hero.headline":    "Everything your theatre program needs — in one place",
    "landing.hero.subhead":     "Know what you have. Find what you need. Built specifically for theatre programs of every size.",
    "landing.hero.cta_label":   "Get Started Free — No credit card →",
    "landing.announcement.text": "⭐ Free during our beta — paid plans begin September 1",
  },
  artstracker: {
    logo: "/logo-artstracker.png",
    "landing.hero.eyebrow":     "🎨 The Platform for Arts & Activity Programs",
    "landing.hero.headline":    "Everything your program needs — in one place",
    "landing.hero.subhead":     "For theatre, music, dance, and visual arts — and any program that needs to keep track of what it owns. Know what you have, find what you need, and share with programs near you.",
    "landing.hero.cta_label":   "Get Started Free — No credit card →",
    "landing.announcement.text": "⭐ Free during our beta — paid plans begin September 1",
  },
};

const SECTIONS = [
  { title: "Landing page — hero", fields: [
    { key: "landing.hero.eyebrow",   label: "Eyebrow badge",        type: "text" },
    { key: "landing.hero.headline",  label: "Hero headline",        type: "text" },
    { key: "landing.hero.subhead",   label: "Hero sub-headline",    type: "textarea" },
    { key: "landing.hero.cta_label", label: "Primary button label", type: "text" },
  ] },
  { title: "Announcement bar", fields: [
    { key: "landing.announcement.show", label: "Show the announcement bar", type: "checkbox" },
    { key: "landing.announcement.text", label: "Announcement text",         type: "text" },
  ] },
];
const CONTENT_FIELDS = SECTIONS.flatMap(s => s.fields);

const THEME_FIELDS = [
  { key: "accent",  label: "Accent gold (text & highlights)", def: "#e8b85d" },
  { key: "primary", label: "Deep gold (button gradient)",     def: "#a37f2c" },
];

const S = {
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 },
  input: { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" },
  card:  { background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: 18, marginBottom: 16 },
  h3:    { margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#2a2a2a" },
  row:   { marginBottom: 13 },
  tab:   (on) => ({ padding: "8px 18px", borderRadius: 8, border: "1px solid " + (on ? "#c4922a" : "#dcd6cc"), background: on ? "#c4922a" : "#fff", color: on ? "#fff" : "#555", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }),
  btn:   (bg, dis) => ({ padding: "10px 22px", borderRadius: 9, border: "none", background: bg, color: "#fff", fontWeight: 800, fontSize: 14, cursor: dis ? "default" : "pointer", fontFamily: "inherit", opacity: dis ? .7 : 1 }),
  note:  { fontSize: 11.5, color: "#999", marginTop: 8, lineHeight: 1.5 },
};

const isShown = (v) => (v || "1") !== "0"; // announcement bar defaults to shown when unset
const GOLD_TAIL = "in one place"; // default headlines end with this; the live site renders it in gold

// Live preview of the landing hero — mirrors the real landing (src/core/public.jsx) as closely as
// possible so edits show true-to-life. Uses the draft values + theme + this door's real defaults.
function HeroPreview({ vals, theme, def }) {
  const gold = theme.accent || "#e8b85d";
  const deep = theme.primary || "#a37f2c";
  const v = (k) => ((vals[k] || "").trim() || def[k]);
  const customHeadline = (vals["landing.hero.headline"] || "").trim();
  // Match the live site: default headline puts the trailing "in one place" in gold; a custom one is plain white.
  const headline = customHeadline
    ? <span>{customHeadline}</span>
    : <span>{def["landing.hero.headline"].slice(0, -GOLD_TAIL.length)}<span style={{ color: gold }}>{GOLD_TAIL}</span></span>;
  return (
    <div style={{ position: "relative", background: "radial-gradient(ellipse 90% 60% at 50% 30%, #241009, #150a05 70%, #0d0705)", borderRadius: 12, padding: "26px 22px 30px", textAlign: "center", overflow: "hidden", color: "#fff", fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      {/* logo in a cream oval glow */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 96, marginBottom: 10 }}>
        <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "94%", height: 118, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 50%, rgba(250,244,232,.97) 0%, rgba(249,242,227,.95) 62%, rgba(243,221,165,.45) 80%, rgba(234,193,108,.14) 89%, transparent 94%)", filter: "blur(1px)" }} />
        <img src={def.logo} alt="" style={{ position: "relative", zIndex: 1, maxWidth: "74%", maxHeight: 82, objectFit: "contain" }} />
      </div>
      {/* eyebrow pill */}
      <div style={{ marginBottom: 9 }}>
        <span style={{ display: "inline-block", padding: "4px 13px", background: "rgba(212,168,67,.15)", border: "1px solid rgba(212,168,67,.3)", borderRadius: 20, fontSize: 10, fontWeight: 700, color: gold, textTransform: "uppercase", letterSpacing: 1 }}>{v("landing.hero.eyebrow")}</span>
      </div>
      {/* announcement (beta) ribbon */}
      {isShown(vals["landing.announcement.show"]) && (
        <div style={{ marginBottom: 14 }}>
          <span style={{ display: "inline-block", padding: "5px 14px", background: "rgba(76,175,80,.13)", border: "1px solid rgba(76,175,80,.4)", borderRadius: 20, fontSize: 11.5, fontWeight: 700, color: "#82d68c" }}>{v("landing.announcement.text")}</span>
        </div>
      )}
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 30, lineHeight: 1.06, color: "#fff", marginBottom: 12, fontWeight: 700 }}>{headline}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", lineHeight: 1.65, maxWidth: 380, margin: "0 auto 18px" }}>{v("landing.hero.subhead")}</div>
      <span style={{ display: "inline-block", background: "linear-gradient(135deg," + gold + "," + deep + ")", color: "#1a0f00", padding: "11px 24px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, boxShadow: "0 4px 20px rgba(212,168,67,.35)" }}>{v("landing.hero.cta_label")}</span>
    </div>
  );
}

export function ContentBrandEditor({ userId }) {
  const [door, setDoor] = useState("theatre4u");
  const [pub, setPub] = useState({ content: {}, theme: {} });     // published: content "v||k"->cvalue, theme v->{}
  const [draft, setDraft] = useState({ content: {}, theme: {} }); // working draft
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");   // "" | "draft" | "publish"
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: c }, { data: t }] = await Promise.all([
        SB.from("site_content").select("vertical,ckey,cvalue,draft"),
        SB.from("site_theme").select("vertical,theme,draft_theme"),
      ]);
      if (!alive) return;
      const pc = {}, dcm = {}, pt = {}, dtm = {};
      (c || []).forEach(r => { const k = r.vertical + "||" + r.ckey; pc[k] = r.cvalue || ""; dcm[k] = (r.draft != null ? r.draft : (r.cvalue || "")); });
      (t || []).forEach(r => { pt[r.vertical] = r.theme || {}; dtm[r.vertical] = (r.draft_theme || r.theme || {}); });
      setPub({ content: pc, theme: pt }); setDraft({ content: dcm, theme: dtm }); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const dc  = (k) => draft.content[door + "||" + k] ?? "";
  const setDC = (k, v) => setDraft(p => ({ ...p, content: { ...p.content, [door + "||" + k]: v } }));
  const dt  = (k, def) => (draft.theme[door] || {})[k] ?? def ?? "";
  const setDT = (k, v) => setDraft(p => ({ ...p, theme: { ...p.theme, [door]: { ...(p.theme[door] || {}), [k]: v } } }));
  const draftThemeObj = draft.theme[door] || {};
  const defs = DOOR_DEFAULTS[door];

  const dirty = (() => {
    for (const f of CONTENT_FIELDS) if ((draft.content[door + "||" + f.key] ?? "") !== (pub.content[door + "||" + f.key] ?? "")) return true;
    const pth = pub.theme[door] || {}, dth = draft.theme[door] || {};
    for (const f of THEME_FIELDS) if ((dth[f.key] ?? "") !== (pth[f.key] ?? "")) return true;
    return false;
  })();

  const finish = (err, okMsg) => { setBusy(""); setMsg(err ? ("Error: " + err.message) : okMsg); setTimeout(() => setMsg(""), 4000); };

  const saveDraft = async () => {
    setBusy("draft"); setMsg("");
    const now = new Date().toISOString();
    const rows = CONTENT_FIELDS.map(f => ({ vertical: door, ckey: f.key, draft: draft.content[door + "||" + f.key] ?? "", updated_by: userId || null, updated_at: now }));
    const { error: e1 } = await SB.from("site_content").upsert(rows, { onConflict: "vertical,ckey" });
    const { error: e2 } = await SB.from("site_theme").upsert({ vertical: door, draft_theme: draftThemeObj, updated_by: userId || null, updated_at: now }, { onConflict: "vertical" });
    finish(e1 || e2, "Draft saved — not public yet");
  };

  const publish = async () => {
    setBusy("publish"); setMsg("");
    const now = new Date().toISOString();
    const rows = CONTENT_FIELDS.map(f => { const v = draft.content[door + "||" + f.key] ?? ""; return { vertical: door, ckey: f.key, cvalue: v, draft: v, updated_by: userId || null, updated_at: now }; });
    const { error: e1 } = await SB.from("site_content").upsert(rows, { onConflict: "vertical,ckey" });
    const { error: e2 } = await SB.from("site_theme").upsert({ vertical: door, theme: draftThemeObj, draft_theme: draftThemeObj, updated_by: userId || null, updated_at: now }, { onConflict: "vertical" });
    if (!(e1 || e2)) {
      setPub(p => {
        const nc = { ...p.content }; CONTENT_FIELDS.forEach(f => { nc[door + "||" + f.key] = draft.content[door + "||" + f.key] ?? ""; });
        return { content: nc, theme: { ...p.theme, [door]: draftThemeObj } };
      });
    }
    finish(e1 || e2, "✓ Published — now live on the site");
  };

  if (loading) return <div style={{ padding: 24, color: "#888" }}>Loading content…</div>;

  const renderField = (f) => {
    if (f.type === "checkbox") {
      const on = isShown(dc(f.key));
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#444" }}>
          <input type="checkbox" checked={on} onChange={e => setDC(f.key, e.target.checked ? "1" : "0")} style={{ width: 17, height: 17, cursor: "pointer" }} />
          {f.label}
        </label>
      );
    }
    return (
      <>
        <label style={S.label}>{f.label}</label>
        {f.type === "textarea"
          ? <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} value={dc(f.key)} onChange={e => setDC(f.key, e.target.value)} placeholder={defs[f.key]} />
          : <input style={S.input} value={dc(f.key)} onChange={e => setDC(f.key, e.target.value)} placeholder={defs[f.key]} />}
      </>
    );
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {DOORS.map(d => <button key={d.id} style={S.tab(door === d.id)} onClick={() => setDoor(d.id)}>{d.label}</button>)}
      </div>
      <p style={{ color: "#777", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
        Editing <strong>{DOORS.find(d => d.id === door)?.label}</strong>. Fields left blank use the site's current copy (shown as grey placeholder text). Edits are a private <strong>draft</strong> — the preview updates as you type, but nothing changes on the public site until you click <strong>Publish</strong>. Editing price copy here does not change what customers are charged (that's in Stripe).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,1fr) minmax(300px,1fr)", gap: 20, alignItems: "start" }}>
        {/* ── Editor form ── */}
        <div>
          {SECTIONS.map(sec => (
            <div key={sec.title} style={S.card}>
              <h3 style={S.h3}>{sec.title}</h3>
              {sec.fields.map(f => <div key={f.key} style={S.row}>{renderField(f)}</div>)}
              {sec.title.startsWith("Landing") && <div style={S.note}>Each door already shows its own logo automatically — no need to add one.</div>}
            </div>
          ))}
          <div style={S.card}>
            <h3 style={S.h3}>Brand colors — {DOORS.find(d => d.id === door)?.label}</h3>
            {THEME_FIELDS.map(f => (
              <div key={f.key} style={S.row}>
                <label style={S.label}>{f.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="color" value={dt(f.key, f.def) || f.def} onChange={e => setDT(f.key, e.target.value)} style={{ width: 46, height: 34, padding: 0, border: "1px solid #d5cfc4", borderRadius: 6, cursor: "pointer" }} />
                  <input style={{ ...S.input, width: 120 }} value={dt(f.key, f.def)} onChange={e => setDT(f.key, e.target.value)} placeholder={f.def} />
                </div>
              </div>
            ))}
            <div style={S.note}>These recolor the gold accents on this door's landing page once published.</div>
          </div>
        </div>

        {/* ── Live preview ── */}
        <div style={{ position: "sticky", top: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: .5, color: "#888" }}>Live preview</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: dirty ? "#c07a00" : "#1a7f37" }}>{dirty ? "● Unpublished changes" : "✓ Live version"}</span>
          </div>
          <HeroPreview vals={CONTENT_FIELDS.reduce((o, f) => (o[f.key] = dc(f.key), o), {})} theme={draftThemeObj} def={defs} />
          <div style={S.note}>Preview only — visible to you, not the public.</div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, paddingTop: 16, borderTop: "1px solid #e6e0d6" }}>
        <button style={S.btn("#6b6459", busy !== "")} onClick={saveDraft} disabled={busy !== ""}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
        <button style={S.btn("#1a7f37", busy !== "" || !dirty)} onClick={publish} disabled={busy !== "" || !dirty}>{busy === "publish" ? "Publishing…" : "Publish — go live"}</button>
        {msg && <span style={{ fontWeight: 700, fontSize: 13, color: msg.startsWith("Error") ? "#c0392b" : "#1a7f37" }}>{msg}</span>}
      </div>
    </div>
  );
}
