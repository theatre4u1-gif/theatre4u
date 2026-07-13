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
    "landing.hero.bg_image":    "https://images.unsplash.com/photo-1503095396549-807759245b35?w=1600&h=900&fit=crop&auto=format&q=82",
    "landing.announcement.text": "⭐ Free during our beta — paid plans begin September 1",
    "landing.cta.headline1":    "Ready to get your",
    "landing.cta.headline2":    "theatre organized?",
    "landing.cta.subtext":      "Join theatre programs already using Theatre4u™ to get their inventory under control, track their shows, and connect with their community.",
    "landing.cta.button":       "Start Free — No credit card required →",
    "landing.cta.fineprint":    "Free plan · No contracts · Cancel anytime",
  },
  artstracker: {
    logo: "/logo-artstracker.png",
    "landing.hero.eyebrow":     "🎨 The Platform for Arts & Activity Programs",
    "landing.hero.headline":    "Everything your program needs — in one place",
    "landing.hero.subhead":     "For theatre, music, dance, and visual arts — and any program that needs to keep track of what it owns. Know what you have, find what you need, and share with programs near you.",
    "landing.hero.cta_label":   "Get Started Free — No credit card →",
    "landing.hero.bg_image":    "https://images.unsplash.com/photo-1503095396549-807759245b35?w=1600&h=900&fit=crop&auto=format&q=82",
    "landing.announcement.text": "⭐ Free during our beta — paid plans begin September 1",
    "landing.cta.headline1":    "Ready to get your",
    "landing.cta.headline2":    "program organized?",
    "landing.cta.subtext":      "Join programs already using ArtsTracker to get their inventory under control, track their events, and connect with their community.",
    "landing.cta.button":       "Start Free — No credit card required →",
    "landing.cta.fineprint":    "Free plan · No contracts · Cancel anytime",
  },
};

const SECTIONS = [
  { title: "Landing page — hero", fields: [
    { key: "landing.hero.eyebrow",   label: "Eyebrow badge",        type: "text" },
    { key: "landing.hero.headline",  label: "Hero headline",        type: "text" },
    { key: "landing.hero.subhead",   label: "Hero sub-headline",    type: "textarea" },
    { key: "landing.hero.cta_label", label: "Primary button label", type: "text" },
    { key: "landing.hero.bg_image",  label: "Background photo",     type: "image" },
  ] },
  { title: "Announcement bar", fields: [
    { key: "landing.announcement.show", label: "Show the announcement bar", type: "checkbox" },
    { key: "landing.announcement.text", label: "Announcement text",         type: "text" },
  ] },
  { title: "Closing call-to-action", fields: [
    { key: "landing.cta.headline1", label: "Closing headline — line 1",        type: "text" },
    { key: "landing.cta.headline2", label: "Closing headline — line 2 (gold)", type: "text" },
    { key: "landing.cta.subtext",   label: "Closing sub-text",                 type: "textarea" },
    { key: "landing.cta.button",    label: "Closing button label",             type: "text" },
    { key: "landing.cta.fineprint", label: "Fine print under the button",      type: "text" },
  ] },
];
const CONTENT_FIELDS = SECTIONS.flatMap(s => s.fields);

const THEME_FIELDS = [
  { key: "accent",  label: "Accent gold (text & highlights)", def: "#e8b85d" },
  { key: "primary", label: "Deep gold (button gradient)",     def: "#a37f2c" },
];

// Reorderable / hideable landing-page sections (must match the ids used in src/core/public.jsx).
const LAYOUT_SECTIONS = [
  { id: "hero",       label: "Hero" },
  { id: "social",     label: "Feature strip" },
  { id: "features",   label: "Features" },
  { id: "howitworks", label: "How it works" },
  { id: "pricing",    label: "Pricing" },
  { id: "finalcta",   label: "Closing call-to-action" },
  { id: "story",      label: "Our Story" },
];
const DEFAULT_ORDER = LAYOUT_SECTIONS.map(s => s.id);
const LAYOUT_KEYS = ["landing.layout.order", ...LAYOUT_SECTIONS.map(s => "landing.section." + s.id + ".show")];
// Every content key the editor saves (text fields + layout).
const ALL_CONTENT_KEYS = [...CONTENT_FIELDS.map(f => f.key), ...LAYOUT_KEYS];

const arrowBtn = (dis) => ({ width: 26, height: 18, lineHeight: "16px", padding: 0, borderRadius: 4, border: "1px solid #d5cfc4", background: dis ? "#f0ece3" : "#fff", color: dis ? "#c3bbab" : "#6b6459", cursor: dis ? "default" : "pointer", fontSize: 10, fontFamily: "inherit" });

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
  const bg = v("landing.hero.bg_image");
  return (
    <div style={{ position: "relative", background: "radial-gradient(ellipse 90% 60% at 50% 30%, #241009, #150a05 70%, #0d0705)", borderRadius: 12, padding: "26px 22px 30px", textAlign: "center", overflow: "hidden", color: "#fff", fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      {/* background photo (faint, like the live hero) */}
      {bg && <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: 'url("' + bg + '")', backgroundSize: "cover", backgroundPosition: "center", opacity: .2, pointerEvents: "none" }} />}
      {bg && <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(13,10,8,.7),rgba(13,10,8,.5) 50%,rgba(13,10,8,.95))", pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1 }}>
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
    </div>
  );
}

// Preview of the closing call-to-action band at the bottom of the landing page.
function CtaPreview({ vals, theme, def }) {
  const gold = theme.accent || "#e8b85d";
  const deep = theme.primary || "#a37f2c";
  const v = (k) => ((vals[k] || "").trim() || def[k]);
  return (
    <div style={{ background: "#160b06", borderRadius: 12, padding: "30px 22px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,.06)", fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 26, lineHeight: 1.15, color: "#fff", marginBottom: 12, fontWeight: 700 }}>
        {v("landing.cta.headline1")}<br /><span style={{ color: gold }}>{v("landing.cta.headline2")}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", lineHeight: 1.6, maxWidth: 340, margin: "0 auto 18px" }}>{v("landing.cta.subtext")}</div>
      <span style={{ display: "inline-block", background: "linear-gradient(135deg," + gold + "," + deep + ")", color: "#1a0f00", padding: "12px 26px", borderRadius: 11, fontSize: 14, fontWeight: 800, boxShadow: "0 4px 24px rgba(212,168,67,.4)" }}>{v("landing.cta.button")}</span>
      <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,.3)" }}>{v("landing.cta.fineprint")}</div>
    </div>
  );
}

// Compact, representative previews for the sections that aren't text-editable yet — enough to make
// reordering and show/hide visible in the preview stack. Gold accents follow the draft theme.
const bar = (w, o) => ({ height: 4, width: w, background: "rgba(255,255,255," + (o || .1) + ")", borderRadius: 2, marginBottom: 4 });
function MiniSocial() {
  return (
    <div style={{ background: "#1a0f06", borderTop: "1px solid rgba(212,168,67,.15)", borderBottom: "1px solid rgba(212,168,67,.15)", padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
      {["📦 Inventory", "🎭 Productions", "📱 Mobile", "💰 Funding", "🔄 Exchange", "🎪 Community"].map(t => <span key={t} style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>{t}</span>)}
    </div>
  );
}
function MiniFeatures({ gold }) {
  return (
    <div style={{ background: "#140b06", padding: "18px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: gold, marginBottom: 4 }}>What it does</div>
        <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 16, color: "#fff" }}>Built for busy directors</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {["📦", "🎭", "📱"].map((ic, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "12px 10px" }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{ic}</div>
            <div style={bar("70%", .22)} /><div style={bar("100%")} /><div style={{ ...bar("85%"), marginBottom: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
function MiniSteps({ gold, deep }) {
  return (
    <div style={{ background: "#120a05", padding: "18px 16px" }}>
      <div style={{ textAlign: "center", fontFamily: "'Playfair Display',Georgia,serif", fontSize: 15, color: "#fff", marginBottom: 12 }}>How it works</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} style={{ textAlign: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg," + gold + "," + deep + ")", color: "#1a0f00", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>{n}</div>
            <div style={{ height: 4, width: 34, background: "rgba(255,255,255,.14)", borderRadius: 2, margin: "0 auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
function MiniPricing({ gold, deep }) {
  const cols = [["Free", "$0"], ["Pro", "$15"], ["District", "$49"]];
  return (
    <div style={{ background: "#140b06", padding: "18px 16px" }}>
      <div style={{ textAlign: "center", fontFamily: "'Playfair Display',Georgia,serif", fontSize: 15, color: "#fff", marginBottom: 12 }}>Pricing</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {cols.map(([n, pr], i) => (
          <div key={n} style={{ border: i === 1 ? "1px solid " + gold + "88" : "1px solid rgba(255,255,255,.1)", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: i === 1 ? "linear-gradient(135deg," + gold + "," + deep + ")" : "rgba(255,255,255,.06)", padding: 8, color: i === 1 ? "#1a0f00" : "#fff" }}>
              <div style={{ fontSize: 10, fontWeight: 700 }}>{n}</div>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Playfair Display',Georgia,serif" }}>{pr}</div>
            </div>
            <div style={{ padding: 8 }}>{[0, 1, 2].map(j => <div key={j} style={bar((90 - j * 12) + "%")} />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function MiniStory({ gold }) {
  return (
    <div style={{ background: "#160b06", padding: "18px 16px", textAlign: "center" }}>
      <div style={{ display: "inline-block", padding: "3px 10px", border: "1px solid " + gold + "44", borderRadius: 12, fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: gold, marginBottom: 8 }}>Our Story</div>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 15, color: "#fff", marginBottom: 10 }}>Built by a Theatre Person</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
        {[0, 1].map(col => <div key={col}>{[0, 1, 2, 3].map(r => <div key={r} style={bar((95 - r * 8) + "%")} />)}</div>)}
      </div>
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
  const [uploading, setUploading] = useState(""); // field key currently uploading

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

  // Landing-page section order + visibility (stored as content).
  const layoutOrder = (() => {
    const saved = (dc("landing.layout.order") || "").split(",").map(s => s.trim()).filter(Boolean);
    const valid = saved.filter(id => DEFAULT_ORDER.includes(id));
    return [...valid, ...DEFAULT_ORDER.filter(id => !valid.includes(id))];
  })();
  const sectionShown = (id) => (dc("landing.section." + id + ".show") || "1") !== "0";
  const moveSection = (id, dir) => {
    const arr = layoutOrder.slice(); const i = arr.indexOf(id); const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    setDC("landing.layout.order", arr.join(","));
  };
  const toggleSection = (id) => setDC("landing.section." + id + ".show", sectionShown(id) ? "0" : "1");

  const dirty = (() => {
    for (const k of ALL_CONTENT_KEYS) if ((draft.content[door + "||" + k] ?? "") !== (pub.content[door + "||" + k] ?? "")) return true;
    const pth = pub.theme[door] || {}, dth = draft.theme[door] || {};
    for (const f of THEME_FIELDS) if ((dth[f.key] ?? "") !== (pth[f.key] ?? "")) return true;
    return false;
  })();

  const finish = (err, okMsg) => { setBusy(""); setMsg(err ? ("Error: " + err.message) : okMsg); setTimeout(() => setMsg(""), 4000); };

  const uploadImage = async (key, file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setMsg("Error: image is over 8 MB — please use a smaller file."); setTimeout(() => setMsg(""), 5000); return; }
    setUploading(key); setMsg("");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = door + "/" + key.replace(/[^a-z0-9]+/gi, "-") + "-" + Date.now() + "." + ext;
    const { error } = await SB.storage.from("site-assets").upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type || undefined });
    if (error) { setUploading(""); setMsg("Upload error: " + error.message); setTimeout(() => setMsg(""), 5000); return; }
    const { data } = SB.storage.from("site-assets").getPublicUrl(path);
    setDC(key, data.publicUrl);
    setUploading(""); setMsg("Image uploaded — remember to Publish to go live."); setTimeout(() => setMsg(""), 4000);
  };

  const saveDraft = async () => {
    setBusy("draft"); setMsg("");
    const now = new Date().toISOString();
    const rows = ALL_CONTENT_KEYS.map(k => ({ vertical: door, ckey: k, draft: draft.content[door + "||" + k] ?? "", updated_by: userId || null, updated_at: now }));
    const { error: e1 } = await SB.from("site_content").upsert(rows, { onConflict: "vertical,ckey" });
    const { error: e2 } = await SB.from("site_theme").upsert({ vertical: door, draft_theme: draftThemeObj, updated_by: userId || null, updated_at: now }, { onConflict: "vertical" });
    finish(e1 || e2, "Draft saved — not public yet");
  };

  const publish = async () => {
    setBusy("publish"); setMsg("");
    const now = new Date().toISOString();
    const rows = ALL_CONTENT_KEYS.map(k => { const v = draft.content[door + "||" + k] ?? ""; return { vertical: door, ckey: k, cvalue: v, draft: v, updated_by: userId || null, updated_at: now }; });
    const { error: e1 } = await SB.from("site_content").upsert(rows, { onConflict: "vertical,ckey" });
    const { error: e2 } = await SB.from("site_theme").upsert({ vertical: door, theme: draftThemeObj, draft_theme: draftThemeObj, updated_by: userId || null, updated_at: now }, { onConflict: "vertical" });
    if (!(e1 || e2)) {
      setPub(p => {
        const nc = { ...p.content }; ALL_CONTENT_KEYS.forEach(k => { nc[door + "||" + k] = draft.content[door + "||" + k] ?? ""; });
        return { content: nc, theme: { ...p.theme, [door]: draftThemeObj } };
      });
    }
    finish(e1 || e2, "✓ Published — now live on the site");
  };

  if (loading) return <div style={{ padding: 24, color: "#888" }}>Loading content…</div>;

  const renderField = (f) => {
    if (f.type === "image") {
      const val = dc(f.key);
      const shown = val || defs[f.key];
      return (
        <>
          <label style={S.label}>{f.label}</label>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 104, height: 62, borderRadius: 8, border: "1px solid #d5cfc4", backgroundImage: shown ? 'url("' + shown + '")' : "none", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#efe9de", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <label style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #c4922a", background: "#c4922a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: uploading === f.key ? "default" : "pointer", fontFamily: "inherit" }}>
                  {uploading === f.key ? "Uploading…" : "Upload image"}
                  <input type="file" accept="image/*" disabled={uploading === f.key} style={{ display: "none" }} onChange={e => { const file = e.target.files && e.target.files[0]; uploadImage(f.key, file); e.target.value = ""; }} />
                </label>
                {val && <button onClick={() => setDC(f.key, "")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d5cfc4", background: "#fff", color: "#666", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Reset to default</button>}
              </div>
              <input style={S.input} value={val} onChange={e => setDC(f.key, e.target.value)} placeholder="…or paste an image URL" />
            </div>
          </div>
        </>
      );
    }
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
          <div style={S.card}>
            <h3 style={S.h3}>Page layout — order & visibility</h3>
            {layoutOrder.map((id, idx) => {
              const sec = LAYOUT_SECTIONS.find(s => s.id === id);
              const on = sectionShown(id);
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid #e6e0d6", borderRadius: 8, marginBottom: 7, background: on ? "#fff" : "#f3efe7" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button onClick={() => moveSection(id, -1)} disabled={idx === 0} style={arrowBtn(idx === 0)}>▲</button>
                    <button onClick={() => moveSection(id, 1)} disabled={idx === layoutOrder.length - 1} style={arrowBtn(idx === layoutOrder.length - 1)}>▼</button>
                  </div>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: on ? "#333" : "#9a9284" }}>{sec ? sec.label : id}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#666", cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={() => toggleSection(id)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    {on ? "Shown" : "Hidden"}
                  </label>
                </div>
              );
            })}
            <div style={S.note}>Use ▲ ▼ to reorder sections, or untick to hide one. The hero works best kept first. Changes go live when you Publish.</div>
          </div>
        </div>

        {/* ── Live preview — full page in current order ── */}
        <div style={{ position: "sticky", top: 16, maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: .5, color: "#888" }}>Live preview — full page</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: dirty ? "#c07a00" : "#1a7f37" }}>{dirty ? "● Unpublished changes" : "✓ Live version"}</span>
          </div>
          <div style={{ overflowY: "auto", borderRadius: 12, border: "1px solid #e6e0d6" }}>
            {(() => {
              const pv = CONTENT_FIELDS.reduce((o, f) => (o[f.key] = dc(f.key), o), {});
              const gold = draftThemeObj.accent || "#e8b85d";
              const deep = draftThemeObj.primary || "#a37f2c";
              const render = (id) => {
                switch (id) {
                  case "hero":       return <HeroPreview vals={pv} theme={draftThemeObj} def={defs} />;
                  case "social":     return <MiniSocial />;
                  case "features":   return <MiniFeatures gold={gold} />;
                  case "howitworks": return <MiniSteps gold={gold} deep={deep} />;
                  case "pricing":    return <MiniPricing gold={gold} deep={deep} />;
                  case "finalcta":   return <CtaPreview vals={pv} theme={draftThemeObj} def={defs} />;
                  case "story":      return <MiniStory gold={gold} />;
                  default:           return null;
                }
              };
              return layoutOrder.map(id => {
                const shown = sectionShown(id);
                return (
                  <div key={id} style={{ position: "relative", opacity: shown ? 1 : .4 }}>
                    {render(id)}
                    {!shown && <span style={{ position: "absolute", top: 8, right: 8, background: "#6b6459", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase", letterSpacing: .5 }}>Hidden</span>}
                  </div>
                );
              });
            })()}
          </div>
          <div style={{ ...S.note, flexShrink: 0 }}>Full page in your current order — reorder or hide sections at left and watch it change. Preview only.</div>
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
