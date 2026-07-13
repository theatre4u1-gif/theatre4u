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

const CONTENT_FIELDS = [
  { key: "landing.hero.headline",  label: "Hero headline",        type: "text",     ph: "Everything your theatre program needs — in one place" },
  { key: "landing.hero.subhead",   label: "Hero sub-headline",    type: "textarea", ph: "Know what you have. Find what you need." },
  { key: "landing.hero.cta_label", label: "Primary button label", type: "text",     ph: "Get Started Free — No credit card →" },
];

const THEME_FIELDS = [
  { key: "primary",  label: "Primary color",  type: "color", def: "#c4922a" },
  { key: "accent",   label: "Accent color",   type: "color", def: "#e8b85d" },
  { key: "logo_url", label: "Logo image URL", type: "text",  def: "" },
];

const S = {
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 },
  input: { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" },
  card:  { background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: 18, marginBottom: 16 },
  h3:    { margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#2a2a2a" },
  row:   { marginBottom: 13 },
  tab:   (on) => ({ padding: "8px 18px", borderRadius: 8, border: "1px solid " + (on ? "#c4922a" : "#dcd6cc"), background: on ? "#c4922a" : "#fff", color: on ? "#fff" : "#555", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }),
  btn:   (bg, dis) => ({ padding: "10px 22px", borderRadius: 9, border: "none", background: bg, color: "#fff", fontWeight: 800, fontSize: 14, cursor: dis ? "default" : "pointer", fontFamily: "inherit", opacity: dis ? .7 : 1 }),
};

// Live preview of the landing hero, using the current draft values + theme.
function HeroPreview({ vals, theme }) {
  const gold = theme.accent || "#e8b85d";
  const primary = theme.primary || "#c4922a";
  const headline = (vals["landing.hero.headline"] || "").trim() || "Everything your theatre program needs — in one place";
  const sub = (vals["landing.hero.subhead"] || "").trim() || "Know what you have. Find what you need. Built for theatre programs of every size.";
  const cta = (vals["landing.hero.cta_label"] || "").trim() || "Get Started Free — No credit card →";
  return (
    <div style={{ background: "linear-gradient(160deg,#1a0f06,#2a1a0c)", borderRadius: 12, padding: "36px 26px", textAlign: "center", overflow: "hidden" }}>
      {theme.logo_url ? <img src={theme.logo_url} alt="" style={{ maxHeight: 40, marginBottom: 18, objectFit: "contain" }} /> : null}
      <div style={{ display: "inline-block", padding: "5px 14px", background: "rgba(76,175,80,.13)", border: "1px solid rgba(76,175,80,.4)", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#82d68c", marginBottom: 16 }}>
        ⭐ Free during our beta — paid plans begin September 1
      </div>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 30, lineHeight: 1.1, color: "#fff", marginBottom: 12, fontWeight: 700 }}>{headline}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,.72)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 20px" }}>{sub}</div>
      <span style={{ display: "inline-block", background: "linear-gradient(135deg," + gold + "," + primary + ")", color: "#1a0f00", padding: "11px 24px", borderRadius: 9, fontSize: 14, fontWeight: 800 }}>{cta}</span>
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

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {DOORS.map(d => <button key={d.id} style={S.tab(door === d.id)} onClick={() => setDoor(d.id)}>{d.label}</button>)}
      </div>
      <p style={{ color: "#777", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
        Edits are a private <strong>draft</strong> — the preview updates as you type, but nothing changes on the public site until you click <strong>Publish</strong>. Editing price copy here does not change what customers are charged (that's in Stripe).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,1fr) minmax(300px,1fr)", gap: 20, alignItems: "start" }}>
        {/* ── Editor form ── */}
        <div>
          <div style={S.card}>
            <h3 style={S.h3}>Brand — {DOORS.find(d => d.id === door)?.label}</h3>
            {THEME_FIELDS.map(f => (
              <div key={f.key} style={S.row}>
                <label style={S.label}>{f.label}</label>
                {f.type === "color"
                  ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="color" value={dt(f.key, f.def) || f.def} onChange={e => setDT(f.key, e.target.value)} style={{ width: 46, height: 34, padding: 0, border: "1px solid #d5cfc4", borderRadius: 6, cursor: "pointer" }} />
                      <input style={{ ...S.input, width: 120 }} value={dt(f.key, f.def)} onChange={e => setDT(f.key, e.target.value)} placeholder={f.def} />
                    </div>
                  : <input style={S.input} value={dt(f.key, f.def)} onChange={e => setDT(f.key, e.target.value)} placeholder="https://… (paste an image URL)" />}
              </div>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={S.h3}>Landing page — hero</h3>
            {CONTENT_FIELDS.map(f => (
              <div key={f.key} style={S.row}>
                <label style={S.label}>{f.label}</label>
                {f.type === "textarea"
                  ? <textarea style={{ ...S.input, minHeight: 66, resize: "vertical" }} value={dc(f.key)} onChange={e => setDC(f.key, e.target.value)} placeholder={f.ph} />
                  : <input style={S.input} value={dc(f.key)} onChange={e => setDC(f.key, e.target.value)} placeholder={f.ph} />}
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: "#999" }}>More sections (feature cards, pricing display, etc.) are coming to this editor.</div>
          </div>
        </div>

        {/* ── Live preview ── */}
        <div style={{ position: "sticky", top: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: .5, color: "#888" }}>Live preview</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: dirty ? "#c07a00" : "#1a7f37" }}>{dirty ? "● Unpublished changes" : "✓ Live version"}</span>
          </div>
          <HeroPreview vals={CONTENT_FIELDS.reduce((o, f) => (o[f.key] = dc(f.key), o), {})} theme={draftThemeObj} />
          <div style={{ fontSize: 11.5, color: "#999", marginTop: 8 }}>This is a preview only — visible to you, not the public.</div>
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
