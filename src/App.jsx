// Theatre4u — built 2026-03-26 17:02
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SB, activateDemoStore, callEdgeFn } from "./core/supabase.js";
import { getVertical, getCats, getCatGfx, VERTICALS_LIST, getExchangeName } from "./lib/verticals.js";
import { US_STATES, STATE_NAMES, zipToCoords, milesBetween, geocodeLocation } from "./lib/geo.js";
import { BG, usp } from "./lib/backgrounds.js";
import { CSS } from "./core/styles.js";
import { EM } from "./core/messages.js";
import { TERMS_CONTENT, PRIVACY_CONTENT } from "./core/legal.js";
import { authErrKey, getRefCode, isDemoMode, fmt$, parseCSV, autoMatch, postShareText, resizeImg, fbShare, getPointsName, itemShareUrl, itemShareText, CSV_FIELDS, uid } from "./core/helpers.js";
import { AuthOverlay } from "./core/auth.jsx";
import { STRIPE_LINKS, stripeLink, PLANS_DEF, UPGRADE_PLANS } from "./core/plans.js";
import { UpgradePrompt, UpgradePlans } from "./core/billing.jsx";
import { CAT_GFX, CATS, CAT, CAT_MAP, CONDS, SIZES, AVAIL, MKT, setCustomCats, customCatsFor, getCatsMerged } from "./core/inventory.js";
import { AdminHub, DistrictDashboard } from "./core/admin.jsx";
import { LabelsPage } from "./core/labels.jsx";
import { OrgProfilePage } from "./core/profile.jsx";
import { Prop28Page } from "./core/prop28.jsx";
import { Messages } from "./core/chat.jsx";
import { CreditsPage } from "./core/points.jsx";
import { Reports } from "./core/reports.jsx";
import { FundingPage } from "./core/funding.jsx";
import { ExternalLoans } from "./core/external-loans.jsx";

import { HOSTNAME, IS_THEATRE4U, IS_ARTSTRACKER, APP_NAME, APP_SUBTITLE, APP_EMAIL, APP_URL, ADMIN_EMAILS, isAdminEmail, ADMIN_EMAIL, LOGO_ICON, FAVICON, TOUCH_ICON, LOGO_FULL } from "./core/config.js";
import { POINT_EARN_RATES, POINTS_PER_DOLLAR, POINTS_FREE_MONTH, POINTS_MAX_BALANCE, POINTS_EXPIRE_DAYS, PLATFORM_FEE_PCT, POINTS_MIN_REDEEM, MILESTONE_POINTS } from "./core/points-config.js";
import { Ic } from "./core/icons.jsx";
import { Pager, Modal, FbShareBtn, HeroImg, CatCard, CatThumb, LegalModal } from "./core/ui.jsx";

// ── Storage map constants → moved to core/storage-map.js ──────────────────────
import { PIN_COLORS, ROW_LABELS, COL_LABELS } from "./core/storage-map.js";
// Rewards program name by vertical: theatre = "Stage Points", others = "Encore Points".

// ── Supabase ──────────────────────────────────────────────────────────────────

// ── Domain Detection ──────────────────────────────────────────────────────────
// Detects which site the user came from so we can show the right branding.
// localhost is treated as Theatre4u so local development works unchanged.
// ── End Domain Detection ──────────────────────────────────────────────────────

// ── Brand Assets ── logo + favicon, switched by domain (files live in src/public/)
// Brand assets (LOGO_ICON, FAVICON, TOUCH_ICON, LOGO_FULL) → moved to core/config.js
// Set the browser tab icon + iOS home-screen icon at runtime, by hostname.
// This is why we never need to edit the Vite-owned src/index.html.
if (typeof document !== "undefined") {
  const setIcon = (rel, href, type) => {
    let l = document.querySelector("link[rel='" + rel + "']");
    if (!l) { l = document.createElement("link"); l.rel = rel; document.head.appendChild(l); }
    if (type) { l.type = type; }
    l.href = href;
  };
  setIcon("icon", FAVICON, IS_THEATRE4U ? "image/svg+xml" : "image/png");
  setIcon("apple-touch-icon", TOUCH_ICON, null);
}


// ══════════════════════════════════════════════════════════════════════════════
// ERROR MESSAGE LIBRARY — friendly user-facing messages, no raw DB errors
// Usage: EM.itemSave.title / EM.itemSave.body / EM.itemSave.cta
// ══════════════════════════════════════════════════════════════════════════════

// Map Supabase auth error text to friendly EM keys

// Show a simple friendly error alert using the EM library
function errAlert(key) {
  const e = EM[key] || EM.generic;
  alert(e.title + "\n\n" + e.body);
}


// uid moved to core/helpers.js (shared)

// ── Social sharing ─────────────────────────────────────────────────────────
// Uses Facebook's native share dialog — no API key, no approval, works for everyone.
// The user shares to their own timeline, page, or any group they're in.
// Small reusable Facebook share button
// Fallback category map for use before CATS const is available
// itemNum moved to core/items.jsx (its only caller is ItemDetail)
// Page background images — 5 confirmed-working Unsplash IDs only

// Category visual identity — CSS gradients, always works, never breaks

// CatCard — renders a category tile using gradient instead of photo

// CatThumb — small square thumbnail for item cards/lists

const SHOWCASE = [
  {cat:"costumes", name:"Victorian Ball Gown",   price:"$25/wk", badge:"For Rent"},
  {cat:"fabrics",  name:"Grand Stage Drape",     price:"$60/wk", badge:"For Rent"},
  {cat:"effects",  name:"Fog Machine Pro",       price:"$20/wk", badge:"For Rent"},
  {cat:"props",    name:"Period Prop Set",        price:"$45",    badge:"For Sale"},
  {cat:"sets",     name:"Victorian Drawing Room",  price:"2wk loan",badge:"For Loan"},
  {cat:"lighting", name:"LED Par Can Array",     price:"$12/wk", badge:"Rent or Sale"},
  {cat:"sound",    name:"Shure Wireless Mic",    price:"$18/wk", badge:"For Rent"},
];

// ── Logo Components — simple emoji mark, always reliable ────────────────────
// LogoMarkDark and LogoMarkLight render the theatre masks emoji in a styled box
// These are intentionally simple until logo integration is ready
const LogoMarkDark = ({size=44}) => (
  <div style={{width:size,height:size,borderRadius:Math.round(size*0.24),background:"linear-gradient(135deg,#f7f1e6,#ece0cf)",border:"1px solid rgba(232,184,93,.45)",boxShadow:"0 2px 6px rgba(0,0,0,.28)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
    <img src={LOGO_ICON} alt={APP_NAME} width={Math.round(size*0.8)} height={Math.round(size*0.8)} style={{objectFit:"contain",display:"block"}}/>
  </div>
);
const LogoMarkLight = ({size=40}) => (
  <img src={LOGO_ICON} alt={APP_NAME} width={size} height={size} style={{flexShrink:0,objectFit:"contain",display:"block"}}/>
);

const LOGO_MARK_SVG_DARK = `<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#1a0c06" rx="10"/><text x="50" y="62" font-size="48" text-anchor="middle">🎭</text></svg>`;

// ── QR Code generator → moved to core/qr.js ──────────────────────────────────
import { QR } from "./core/qr.js";

function makeSamples(){
  return [
    {name:"Victorian Ball Gown – Blue",   category:"costumes", condition:"Good",     size:"M",       qty:1, location:"Costume Closet A",notes:"Used in A Christmas Carol 2024",mkt:"For Rent",   rent:25,sale:0, avail:"In Stock",tags:["period","formal"],img:null},
    {name:"Pirate Hat Collection (6 pc)", category:"costumes", condition:"Fair",     size:"One Size",qty:6, location:"Costume Closet B",notes:"Assorted styles",              mkt:"Not Listed", rent:0, sale:0, avail:"In Stock",tags:["adventure"],      img:null},
    {name:"Wireless Mic – Shure SM58",    category:"sound",    condition:"Excellent",size:"N/A",     qty:4, location:"Sound Booth",     notes:"4 channels, wireless",         mkt:"For Rent",   rent:15,sale:0, avail:"In Stock",tags:["audio"],          img:null},
    {name:"LED Par Can RGBW 54×3W",       category:"lighting", condition:"New",      size:"N/A",     qty:12,location:"Lighting Storage",notes:"DMX controllable",             mkt:"Rent or Sale",rent:10,sale:85,avail:"In Stock",tags:["dmx","led"],      img:null},
    {name:"Wooden Throne Chair",          category:"furniture",condition:"Good",     size:"N/A",     qty:1, location:"Scene Shop",      notes:"Gold painted, red velvet",     mkt:"For Rent",   rent:30,sale:0, avail:"In Stock",tags:["royalty"],         img:null},
    {name:"Fog Machine 1000W",            category:"effects",  condition:"Good",     size:"N/A",     qty:2, location:"Effects Cage",    notes:"Includes remote",              mkt:"For Rent",   rent:20,sale:0, avail:"In Stock",tags:["atmosphere"],      img:null},
    {name:"Romeo & Juliet Scripts (30)",  category:"scripts",  condition:"Fair",     size:"N/A",     qty:30,location:"Library",        notes:"Director annotated",            mkt:"For Sale",   rent:0, sale:5, avail:"In Stock",tags:["shakespeare"],     img:null},
    {name:"Forest Backdrop Flat 8×12ft",  category:"sets",     condition:"Good",     size:"N/A",     qty:2, location:"Scene Shop",      notes:"Painted muslin on frame",      mkt:"For Rent",   rent:40,sale:0, avail:"In Stock",tags:["outdoor"],         img:null},
    {name:"Ben Nye Master Makeup Kit",    category:"makeup",   condition:"Good",     size:"N/A",     qty:3, location:"Dressing Room 1", notes:"Full spectrum",                mkt:"Not Listed", rent:0, sale:0, avail:"In Stock",tags:["professional"],    img:null},
    {name:"Foam Rubber Swords (8 pc)",    category:"props",    condition:"Fair",     size:"N/A",     qty:8, location:"Props Table",     notes:"Safe for stage combat",        mkt:"For Sale",   rent:0, sale:12,avail:"In Stock",tags:["combat"],          img:null},
  ].map(i=>({...i,id:uid(),added:new Date().toISOString()}));
}


// uploadPhoto → moved into core/items.jsx (its only caller)




// Inline location picker — loads storage_locations for the org
function LocationDropdown({ userId, value, onChange }) {
  const [locs, setLocs] = useState([]);
  useEffect(() => {
    if (!userId) return;
    SB.from("storage_locations").select("id,name,code").eq("org_id", userId).order("name")
      .then(({ data }) => setLocs(data || []));
  }, [userId]);
  if (locs.length === 0) return null;
  return (
    <div className="fg">
      <label className="fl">Assign to Location <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
      <select className="fs" value={value || ""} onChange={e => onChange(e.target.value || null)}>
        <option value="">No location assigned</option>
        {locs.map(l => (
          <option key={l.id} value={l.id}>{l.name}{l.code ? " (" + l.code + ")" : ""}</option>
        ))}
      </select>
    </div>
  );
}


// ── ITEMS (ItemForm, ItemDetail, AvailabilityCalendar) → core/items.jsx ─────────
import { ItemForm, ItemDetail } from "./core/items.jsx";


/* ── PAGES ─────────────────────────────────────────────────────────────────── */

// ── Community Spotlight (Dashboard widget) ────────────────────────────────────
// ── DASHBOARD (+ CommunitySpotlight) → core/dashboard.jsx ───────────────────────
import { Dashboard } from "./core/dashboard.jsx";

// ── JoinCodePrompt ─────────────────────────────────────────────────────────
function JoinCodePrompt({ onJoined }) {
  const [code,      setCode]      = useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");
  const [done,      setDone]      = useState(false);
  const [orgName,   setOrgName]   = useState("");
  const [dismissed, setDismissed] = useState(
    ()=>{ try { return localStorage.getItem("t4u_code_prompt_dismissed")==="1"; } catch{return false;} }
  );

  // Don't show if already dismissed and no pending code
  const pendingCode = typeof window !== "undefined"
    ? localStorage.getItem("t4u_pending_join_code") : null;
  if (dismissed && !pendingCode) return null;

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setErr("Please enter a join code."); return; }
    setSaving(true); setErr("");
    const { data, error } = await SB.rpc("accept_team_invite_by_code", { p_code: trimmed });
    setSaving(false);
    if (error || data?.error) {
      setErr(data?.error || "Something went wrong. Please check the code and try again.");
      return;
    }
    setOrgName(data.org_name || "the program");
    setDone(true);
    if (onJoined) setTimeout(()=>{ window.location.reload(); }, 1800);
  };

  const dismiss = () => {
    try { localStorage.setItem("t4u_code_prompt_dismissed","1"); } catch(e) {}
    setDismissed(true);
  };

  // Auto-fill if there's a pending code from URL
  useEffect(()=>{
    if (pendingCode && !code) {
      setCode(pendingCode);
      localStorage.removeItem("t4u_pending_join_code");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  if (done) return (
    <div style={{background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.3)",
      borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <span style={{fontSize:20}}>✅</span>
      <span style={{fontSize:14,color:"#81c784",fontWeight:600}}>
        You've joined {orgName}'s team! Reloading…
      </span>
    </div>
  );

  return (
    <div style={{background:"rgba(212,168,67,.06)",border:"1px solid rgba(212,168,67,.2)",
      borderRadius:10,padding:"14px 18px",marginBottom:16,position:"relative"}}>
      <button onClick={dismiss}
        style={{position:"absolute",top:10,right:10,background:"none",border:"none",
          color:"var(--muted)",fontSize:16,cursor:"pointer",lineHeight:1,padding:"2px 6px"}}>
        ×
      </button>
      <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>
        👋 Have a join code from your director?
      </div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:10,lineHeight:1.5,paddingRight:24}}>
        Enter the code they shared to join their program's backstage team.
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start"}}>
        <input
          value={code}
          onChange={e=>{ setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"")); setErr(""); }}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="e.g. Y8H-YMH"
          maxLength={10}
          style={{padding:"9px 14px",borderRadius:8,
            border:`1px solid ${err?"rgba(194,24,91,.5)":"rgba(255,255,255,.15)"}`,
            background:"rgba(255,255,255,.06)",color:"#fff",fontSize:16,
            fontFamily:"monospace",letterSpacing:2,width:150,outline:"none",
            textTransform:"uppercase"}}
        />
        <button onClick={submit} disabled={saving||!code.trim()}
          style={{padding:"9px 20px",borderRadius:8,border:"none",
            background:"linear-gradient(135deg,var(--gold),#a37f2c)",
            color:"#1a0f00",fontWeight:700,fontSize:14,cursor:"pointer",
            fontFamily:"inherit",opacity:saving||!code.trim()?.6:1}}>
          {saving ? "Joining…" : "Join Team →"}
        </button>
      </div>
      {err&&<div style={{fontSize:12,color:"#e06090",marginTop:6}}>{err}</div>}
    </div>
  );
}


// ── INVENTORY PAGE → core/inventory-page.jsx ─────────────────────────────────
import { Inventory } from "./core/inventory-page.jsx";
// ── BACKSTAGE EXCHANGE (Marketplace, CSVImport, MarketplaceGate) → core/marketplace.jsx
import { MarketplaceGate, CSVImport } from "./core/marketplace.jsx";


// ── RENTAL REQUEST FLOW (RequestItemModal, Requests, docs) → core/requests.jsx ──
import { Requests } from "./core/requests.jsx";

// ── Production Report Tab (inside Reports page) ───────────────────────────────


// ── Upgrade prompt modal ─────────────────────────────────────────────────────

// ── Shared upgrade/pricing component — used in Settings + any upsell modal ────
// ── Plan definitions ─────────────────────────────────────────────────────────
// ── Admin accounts — add emails here for free District access + admin dashboard

// ══════════════════════════════════════════════════════════════════════════════
// PRICING MODEL — DO NOT CHANGE WITHOUT REVIEWING THIS RATIONALE
// Last reviewed: April 2026
//
// PRO ($15/mo | $150/yr): One theatre program, unlimited inventory.
//   Basis: Market rate for single-user SaaS tools in education.
//
// DISTRICT S ($49/mo | $500/yr): Up to 6 schools.
//   Basis: HBUHSD has 6 high schools. 6 × $144/yr (Pro) = $864/yr individual.
//   District price = $500/yr → 42% savings for district buyer.
//   This is the anchoring district unit. Do not raise school count without
//   adjusting price — the discount math breaks above ~8 schools at this price.
//
// DISTRICT M + L now in UPGRADE_PLANS UI. Add Stripe products then fill STRIPE_LINKS above.
// See Obsidian: District-Pricing.md for full pricing rationale.
// PLANNED FUTURE TIERS still to build in Stripe:
//   District M: Up to 15 schools → $99/mo | $999/yr  (54% savings)
//   District L: Up to 30 schools → $179/mo | $1,799/yr (58% savings)
//   Enterprise: 31+ schools → Custom quote, starting ~$2,500/yr for 50 schools
//               Add $25/school/year above 50 schools.
//               LAUSD fine arts dept (~80 schools) = ~$3,250/yr example.
//               Includes DPA, dedicated support, onboarding call.
//
// NEVER offer more than 6 schools on the current District plan without
// creating a new District M tier and updating Stripe products first.
// ══════════════════════════════════════════════════════════════════════════════


// ── Invoice Request Form — sends automated invoice via edge function ──────────



// ══════════════════════════════════════════════════════════════════════════════
// DISTRICT DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN INVENTORY VIEW — Browse any org's inventory for support/QA
// All access is logged to audit_log
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: EDIT ORG MODAL
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: CLOSE / DELETE ORG MODAL
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: ACCOUNTS TAB (closed / pending deletion list)
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: DISTRICT ASSIGNMENT PANEL
// Lets admin bulk-assign orgs to districts or remove them
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: ORG INVENTORY EDITOR (admin edits any org's items)
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: EDIT ITEM MODAL
// ══════════════════════════════════════════════════════════════════════════════


// Parse a raw CSV string into rows

// Coerce a raw string value into the right type/valid value for a field


// ── PRODUCTIONS (Show Folders) → moved to core/productions.jsx ──────────────────
import { Productions } from "./core/productions.jsx";


// ══════════════════════════════════════════════════════════════════════════════
// MESSAGING  (Chat)
// ══════════════════════════════════════════════════════════════════════════════

// ── New Conversation Modal (shown from Marketplace "Contact" button) ──────────

// ── Chat Window ────────────────────────────────────────────────────────────────

// ── Messages Page ──────────────────────────────────────────────────────────────






// ── COMMUNITY BOARD → moved to core/community.jsx ───────────────────────────────
import { CommunityGate } from "./core/community.jsx";

// ══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE GATE — opt-in wrapper for Marketplace
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// THEATRE CREDITS PAGE
// ══════════════════════════════════════════════════════════════════════════════

// ── SETTINGS (Team, QR privacy, custom categories, account) → core/settings.jsx ──
import { Settings } from "./core/settings.jsx";

// ══════════════════════════════════════════════════════════════════════════════
// AUTH SCREENS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Legal Modals ────────────────────────────────────────────────────────────


// ── Landing Page ──────────────────────────────────────────────────────────────
// ── PUBLIC PAGES (Landing, PublicOrg, PublicItem) + visit tracking → core/public.jsx ──
import { LandingPage, PublicOrgPage, PublicItemPage } from "./core/public.jsx";


// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ORG PROFILE
// ══════════════════════════════════════════════════════════════════════════════

// ── Profile page (embedded in app, accessible via sidebar) ───────────────────


// ══════════════════════════════════════════════════════════════════════════════
// BETA FEEDBACK — floating widget + leading player survey
// ══════════════════════════════════════════════════════════════════════════════

function FeedbackWidget({ userId, orgName, isLeadingPlayer }) {
  const [open,    setOpen]    = useState(false);
  const [tab,     setTab]     = useState("quick");  // quick | survey
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);
  const [page,    setPage]    = useState("");

  // Quick feedback state
  const [category, setCategory] = useState("bug");
  const [message,  setMessage]  = useState("");
  const [rating,   setRating]   = useState(null);

  // Leading Player survey state
  const [q1, setQ1] = useState("");   // hardest inventory
  const [q2, setQ2] = useState(null); // prop28 pain 1-10
  const [q3, setQ3] = useState("");   // lending barrier
  const [q4, setQ4] = useState("");   // wishlist hour

  useEffect(() => {
    // Track current page for context
    const handler = () => setPage(window.location.pathname || document.title);
    window.__t4u_feedback_page = (p) => setPage(p);
    return () => { delete window.__t4u_feedback_page; };
  }, []);

  const submitQuick = async () => {
    if (!message.trim() && !rating) return;
    setSaving(true);
    await SB.from("beta_feedback").insert({
      org_id: userId, org_name: orgName,
      category, message: message.trim(),
      rating, page_context: page,
    });
    setSaving(false);
    setDone(true);
    setTimeout(() => { setDone(false); setOpen(false); setMessage(""); setRating(null); }, 2000);
  };

  const submitSurvey = async () => {
    if (!q1 && !q2 && !q3 && !q4) return;
    setSaving(true);
    await SB.from("beta_feedback").insert({
      org_id: userId, org_name: orgName,
      category: "feature",
      hardest_inventory: q1.trim(),
      prop28_pain_score: q2,
      lending_barrier: q3.trim(),
      wishlist_hour: q4.trim(),
      page_context: "leading-player-survey",
    });
    setSaving(false);
    setDone(true);
    setTimeout(() => { setDone(false); setOpen(false); }, 2500);
  };

  const cats = [
    { id:"bug",      label:"🐛 Bug",      color:"#c2185b" },
    { id:"feature",  label:"💡 Idea",     color:"#1554a0" },
    { id:"praise",   label:"🙌 Love it",  color:"#27723a" },
    { id:"confusion",label:"😕 Confused", color:"#d35400" },
    { id:"other",    label:"💬 Other",    color:"#546e7a" },
  ];

  return (
    <>
      {/* Floating trigger button */}
      {/* Leading Players get the prominent gold pill */}
      {isLeadingPlayer ? (
        <button onClick={() => setOpen(!open)} style={{
          position:"fixed", top:16, right:16, zIndex:900,
          height:40, borderRadius:20, padding:"0 16px",
          background:"linear-gradient(135deg,#ffcd3c,#f4a800)",
          border:"2px solid rgba(255,220,80,.6)",
          boxShadow:"0 0 18px rgba(255,200,0,.7), 0 4px 24px rgba(212,168,67,.6)",
          cursor:"pointer", display:"flex", alignItems:"center",
          gap:8, fontSize:15,
          transition:"transform .2s,box-shadow .2s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.05)";e.currentTarget.style.boxShadow="0 0 28px rgba(255,210,0,.9), 0 6px 32px rgba(212,168,67,.7)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 0 18px rgba(255,200,0,.7), 0 4px 24px rgba(212,168,67,.6)";}}
        title="Share feedback">
          {open ? <>✕ <span style={{fontSize:13,fontWeight:700}}>Close</span></> : <><span style={{fontSize:15}}>💬</span><span style={{fontSize:12,fontWeight:900,letterSpacing:.3,color:"#1a0f00",textShadow:"none"}}>Leading Players Feedback</span></>}
        </button>
      ) : (
        /* Regular users get a small subtle link */
        <button onClick={() => setOpen(!open)} style={{
          position:"fixed", top:16, right:16, zIndex:900,
          background:"none", border:"none",
          color:"var(--muted,#9b93a8)", fontSize:11, fontWeight:600,
          cursor:"pointer", padding:"4px 8px", borderRadius:6,
          fontFamily:"'DM Sans',sans-serif",
          opacity: open ? 1 : 0.6,
          transition:"opacity .2s",
          letterSpacing:.3,
        }}
        onMouseEnter={e=>e.currentTarget.style.opacity="1"}
        onMouseLeave={e=>{if(!open)e.currentTarget.style.opacity="0.6";}}
        title="Share feedback">
          {open ? "✕ Close" : "💬 Feedback"}
        </button>
      )}

      {/* Feedback panel */}
      {open && (
        <div style={{
          position:"fixed", top:64, right:16, zIndex:900,
          width:420, background:"#ffffff", border:"1.5px solid #e0d8f0",
          borderRadius:14, boxShadow:"0 8px 40px rgba(0,0,0,.18)",
          overflow:"hidden", animation:"feedIn .2s ease",
          color:"#1a1008",
        }}>
          <style>{`@keyframes feedIn{from{opacity:0;transform:translateY(-10px) scale(.97)}to{opacity:1;transform:none}}`}</style>

          {/* Header */}
          <div style={{background:"linear-gradient(135deg,#2d1054,#4a1a8a)",padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"12px 12px 0 0"}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#f0c866"}}>Share Feedback</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.85)",marginTop:2}}>You're a Leading Player — your voice shapes this tool.</div>
            </div>
            {isLeadingPlayer && <span style={{fontSize:11,background:"rgba(212,168,67,.3)",color:"#f0c866",padding:"2px 8px",borderRadius:6,fontWeight:800}}>🎭 LEADING PLAYER</span>}
          </div>

          {/* Tabs */}
          {isLeadingPlayer && (
            <div style={{display:"flex",borderBottom:"1px solid #e0d8f0",background:"#f8f5ff"}}>
              {[["quick","Quick Note"],["survey","Leading Player Survey"]].map(([id,label])=>(
                <button key={id} onClick={()=>setTab(id)} style={{
                  flex:1,padding:"9px 12px",background:"none",border:"none",
                  borderBottom:`2px solid ${tab===id?"#7c3aed":"transparent"}`,
                  color:tab===id?"#7c3aed":"#6b7280",fontFamily:"inherit",
                  fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .15s",
                }}>{label}</button>
              ))}
            </div>
          )}

          <div style={{padding:"20px 22px",background:"#ffffff",color:"#1a1008"}}>
            {done ? (
              <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{fontSize:44,marginBottom:12}}>🙏</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"var(--green)"}}>Thank you!</div>
                <div style={{fontSize:13,color:"var(--muted)",marginTop:4}}>Your feedback is making Theatre4u better.</div>
              </div>
            ) : tab === "quick" ? (
              <>
                {/* Category chips */}
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                  {cats.map(c=>(
                    <button key={c.id} onClick={()=>setCategory(c.id)} style={{
                      padding:"4px 10px",borderRadius:20,border:"1.5px solid",
                      fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",
                      background:category===c.id?c.color+"22":"#f3f4f6",
                      color:category===c.id?c.color:"#374151",
                      borderColor:category===c.id?c.color:"#d1d5db",
                    }}>{c.label}</button>
                  ))}
                </div>

                {/* Message */}
                <textarea value={message} onChange={e=>setMessage(e.target.value)}
                  placeholder={
                    category==="bug"?"Describe what happened and what you expected…":
                    category==="feature"?"What feature would make your life easier?":
                    category==="praise"?"What's working well for you?":
                    category==="confusion"?"What was confusing or hard to find?":
                    "Tell us anything on your mind…"
                  }
                  style={{
                    width:"100%",minHeight:80,background:"#f9fafb",
                    border:"1.5px solid #d1d5db",borderRadius:8,padding:"9px 11px",
                    color:"#111827",fontFamily:"'DM Sans',sans-serif",
                    fontSize:14,resize:"vertical",outline:"none",lineHeight:1.6,
                    marginBottom:12,
                  }}
                  onFocus={e=>e.target.style.borderColor="#7c3aed"}
                  onBlur={e=>e.target.style.borderColor="#d1d5db"}
                />

                {/* Star rating */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"#6b7280",marginBottom:8}}>
                    Overall experience so far
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>setRating(n)} style={{
                        background:"none",border:"none",fontSize:22,cursor:"pointer",
                        color:rating>=n?"#f9a825":"#d1d5db",transition:"color .1s",padding:"0 2px",
                      }}>★</button>
                    ))}
                  </div>
                </div>

                <button onClick={submitQuick} disabled={saving||(!message.trim()&&!rating)} style={{
                  width:"100%",padding:"10px 0",borderRadius:8,border:"none",
                  background:(!message.trim()&&!rating)?"#e5e7eb":"linear-gradient(135deg,#f0c866,#d4a843)",
                  color:(!message.trim()&&!rating)?"#9ca3af":"#1a1200",
                  fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:(!message.trim()&&!rating)?"default":"pointer",
                }}>
                  {saving?"Sending…":"Send Feedback"}
                </button>
              </>
            ) : (
              /* Leading Player Survey */
              <>
                <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
                  Your answers directly shape the next features we build. Takes about 3 minutes.
                </div>

                {/* Q1 */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:.8,color:"#6b7280",display:"block",marginBottom:8}}>
                    1. What inventory is hardest to track right now?
                  </label>
                  <input value={q1} onChange={e=>setQ1(e.target.value)}
                    placeholder="e.g. Small props, lighting gels, period costumes…"
                    style={{width:"100%",background:"#f9fafb",border:"1.5px solid #d1d5db",
                      borderRadius:8,padding:"10px 12px",color:"#111827",fontFamily:"inherit",fontSize:14,outline:"none"}}
                    onFocus={e=>e.target.style.borderColor="#7c3aed"} onBlur={e=>e.target.style.borderColor="#d1d5db"}
                  />
                </div>

                {/* Q2 */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:.8,color:"#6b7280",display:"block",marginBottom:8}}>
                    2. How useful is the Funding Tracker — 1 (not useful) to 10 (essential)?
                  </label>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                      <button key={n} onClick={()=>setQ2(n)} style={{
                        width:34,height:34,borderRadius:6,border:"1.5px solid",
                        background:q2===n?"var(--gold)":"transparent",
                        color:q2===n?"#1a1200":"#374151",
                        fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",
                        borderColor:q2===n?"#d4a843":"#d1d5db",
                      }}>{n}</button>
                    ))}
                  </div>
                </div>

                {/* Q3 */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:.8,color:"#6b7280",display:"block",marginBottom:8}}>
                    3. What stops you from lending items to other schools?
                  </label>
                  <select value={q3} onChange={e=>setQ3(e.target.value)} style={{
                    width:"100%",background:"#f9fafb",border:"1.5px solid #d1d5db",
                    borderRadius:8,padding:"10px 12px",color:"#111827",fontFamily:"inherit",fontSize:14,outline:"none",
                  }}>
                    <option value="">Select the biggest one…</option>
                    <option value="fear_damage">Fear of damage or loss</option>
                    <option value="logistics">Logistics — pickup, dropoff, timing</option>
                    <option value="no_agreement">No formal agreement / paperwork</option>
                    <option value="trust">Don't know the other program</option>
                    <option value="admin_approval">Need district/admin approval</option>
                    <option value="never_thought">Never thought about it before</option>
                    <option value="other">Something else</option>
                  </select>
                </div>

                {/* Q4 */}
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:.8,color:"#6b7280",display:"block",marginBottom:8}}>
                    4. What one thing could save you an hour a week?
                  </label>
                  <textarea value={q4} onChange={e=>setQ4(e.target.value)}
                    placeholder="e.g. Better funding reports, scan items in/out on my phone…"
                    style={{width:"100%",minHeight:64,background:"#f9fafb",border:"1.5px solid #d1d5db",
                      borderRadius:8,padding:"8px 10px",color:"#111827",fontFamily:"inherit",fontSize:12,
                      resize:"vertical",outline:"none",lineHeight:1.5}}
                    onFocus={e=>e.target.style.borderColor="#7c3aed"} onBlur={e=>e.target.style.borderColor="#d1d5db"}
                  />
                </div>

                <button onClick={submitSurvey} disabled={saving||(!q1&&!q2&&!q3&&!q4)} style={{
                  width:"100%",padding:"10px 0",borderRadius:8,border:"none",
                  background:"linear-gradient(135deg,var(--gold2),var(--gold))",
                  color:"#1a1200",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer",
                }}>
                  {saving?"Submitting…":"Submit Leading Player Survey 🎭"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p){super(p);this.state={err:null,info:null};}
  static getDerivedStateFromError(e){return{err:e};}
  componentDidCatch(e,info){console.error("App crashed:",e,info);}
  render(){
    if(this.state.err)return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        height:"100vh",gap:20,padding:40,textAlign:"center",background:"var(--bg,#0d0b11)",color:"var(--t1,#ede8df)"}}>
        <div style={{fontSize:52}}>🎭</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--gold,#d4a843)"}}>
          Something went wrong
        </div>
        <div style={{fontSize:13,color:"var(--t3,#9b93a8)",maxWidth:360,lineHeight:1.7}}>
          {this.state.err?.message||"An unexpected error occurred. This has been noted."}
        </div>
        <button onClick={()=>window.location.reload()} 
          style={{background:"linear-gradient(135deg,#d4a843,#a37f2c)",border:"none",color:"#1a1200",
            padding:"10px 24px",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
          Reload App
        </button>
        <a href="mailto:hello@theatre4u.org" style={{fontSize:12,color:"var(--t3,#9b93a8)"}}>
          Contact support
        </a>
      </div>
    );
    return this.props.children;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DEMO MODE — Full app running with in-memory store, no real Supabase writes
// Access via theatre4u.org?demo=1
// Shows the real signup → onboarding → full app experience
// ══════════════════════════════════════════════════════════════════════════════

const DEMO_ORG = {
  id: "demo-org-id",
  name: "", // filled in during signup demo
  email: "",
  type: "", phone: "", location: "", bio: "",
  plan: "pro", temp_pro: true,
  director_name: "", director_title: "Theatre Director",
  label_prefix: "DEMO",
  is_leading_player: false,
  beta_acknowledged: false,
  profile_public: false,
  onboarding_step: 0,
  created_at: new Date().toISOString(),
};

const DEMO_ITEMS = [
  { id:"di1", name:"Victorian Ball Gown — Blue", category:"costumes", condition:"Good", size:"M", qty:1, location:"Costume Closet A", notes:"Used in A Christmas Carol 2024", mkt:"For Rent", avail:"In Stock", sale:0, rent:25, tags:["period","formal"], img:null, display_id:"DEMO-0001", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di2", name:"Pirate Hat Collection (6pc)", category:"costumes", condition:"Fair", size:"One Size", qty:6, location:"Costume Closet B", notes:"Assorted styles", mkt:"Not Listed", avail:"In Stock", sale:0, rent:0, tags:["adventure"], img:null, display_id:"DEMO-0002", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di3", name:"Wireless Handheld Mic — Shure SM58", category:"sound", condition:"Excellent", size:"N/A", qty:4, location:"Sound Booth", notes:"4 channels, includes cases", mkt:"For Rent", avail:"In Stock", sale:0, rent:15, tags:["audio"], img:null, display_id:"DEMO-0003", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di4", name:"LED Par Can RGBW", category:"lighting", condition:"New", size:"N/A", qty:12, location:"Lighting Storage", notes:"DMX controllable", mkt:"Rent or Sale", avail:"In Stock", sale:85, rent:10, tags:["dmx","led"], img:null, display_id:"DEMO-0004", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di5", name:"Fog Machine 1000W", category:"effects", condition:"Good", size:"N/A", qty:2, location:"Effects Cage", notes:"Includes remote", mkt:"For Rent", avail:"In Stock", sale:0, rent:20, tags:["atmosphere"], img:null, display_id:"DEMO-0005", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di6", name:"Forest Backdrop 8x12ft", category:"sets", condition:"Good", size:"N/A", qty:2, location:"Scene Shop", notes:"Painted muslin on frame", mkt:"For Rent", avail:"In Stock", sale:0, rent:40, tags:["outdoor"], img:null, display_id:"DEMO-0006", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di7", name:"Foam Rubber Swords (8pc)", category:"props", condition:"Fair", size:"N/A", qty:8, location:"Props Table", notes:"Safe for stage combat", mkt:"For Sale", avail:"In Stock", sale:12, rent:0, tags:["combat"], img:null, display_id:"DEMO-0007", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di8", name:"Ben Nye Master Makeup Kit", category:"makeup", condition:"Good", size:"N/A", qty:3, location:"Dressing Room 1", notes:"Full spectrum palette", mkt:"Not Listed", avail:"In Stock", sale:0, rent:0, tags:["professional"], img:null, display_id:"DEMO-0008", org_id:"demo-org-id", added:new Date().toISOString() },
];

// In-memory store for demo — mimics Supabase table structure
function createDemoStore() {
  // Generic in-memory store — works for ANY table name automatically
  // Key: table name, Value: array of row objects
  const tables = {
    orgs:  [],
    items: [],
  };
  let seeded = false;

  const uid = () => "demo-" + Math.random().toString(36).slice(2,10);

  // Get or create a table
  const tbl = (name) => {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  };

  const mockTable = (table) => {
    const chain = {
      _filters: [],
      _data:    undefined,  // undefined = "not set", null = "explicitly null"
      _single:  false,
      _count:   false,

      select:   (cols) => {
        // If selecting with a nested join like "*, orgs(name,...)", enrich items with org data
        if (cols && typeof cols === "string" && cols.includes("orgs(") && table === "items") {
          chain._enrichWithOrg = true;
        }
        return chain;
      },
      order:    ()             => chain,
      limit:    ()             => chain,
      range:    ()             => chain,
      neq:      (col, val)     => { chain._filters.push(r => r[col] !== val); return chain; },
      gte:      (col, val)     => { chain._filters.push(r => r[col] >= val);  return chain; },
      lte:      (col, val)     => { chain._filters.push(r => r[col] <= val);  return chain; },
      lt:       (col, val)     => { chain._filters.push(r => r[col] < val);   return chain; },
      gt:       (col, val)     => { chain._filters.push(r => r[col] > val);   return chain; },
      ilike:    (col, val)     => { chain._filters.push(r => String(r[col]||"").toLowerCase().includes(String(val||"").toLowerCase().replace(/%/g,""))); return chain; },
      in:       (col, vals)    => { chain._filters.push(r => vals.includes(r[col])); return chain; },
      contains: ()             => chain,
      not:      ()             => chain,
      or:       ()             => chain,
      eq: (col, val) => {
        chain._filters.push(r => r[col] === val);
        return chain;
      },
      is: (col, val) => {
        chain._filters.push(r => val === null ? (r[col] == null) : r[col] === val);
        return chain;
      },
      single: () => { chain._single = true; return chain; },

      insert: (data) => {
        const rows = Array.isArray(data) ? data : [data];
        const inserted = rows.map(r => ({
          ...r,
          id:         r.id         || uid(),
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));
        tbl(table).push(...inserted);
        // Always store the array — then() will unwrap to single if .single() was chained
        chain._data = inserted;
        return chain;
      },

      upsert: (data, opts) => {
        const rows = Array.isArray(data) ? data : [data];
        const conflictKey = opts?.onConflict || "id";
        rows.forEach(r => {
          const store = tbl(table);
          const idx = store.findIndex(x => x[conflictKey] === r[conflictKey]);
          if (idx >= 0) {
            store[idx] = { ...store[idx], ...r, updated_at: new Date().toISOString() };
          } else {
            store.push({ ...r, id: r.id||uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }
        });
        const result = tbl(table).find(x => x[conflictKey] === rows[0]?.[conflictKey]);
        // Store as array so then() can unwrap for .single()
        chain._data = result ? [result] : [];
        return chain;
      },

      update: (data) => {
        const store = tbl(table);
        const updated = [];
        store.forEach((r, i) => {
          if (chain._filters.every(f => f(r))) {
            store[i] = { ...r, ...data, updated_at: new Date().toISOString() };
            updated.push(store[i]);
          }
        });
        // Store updated rows so chained .select().single() returns the row
        chain._data = updated;
        return chain;
      },

      delete: () => {
        tables[table] = tbl(table).filter(r => !chain._filters.every(f => f(r)));
        chain._data = null;
        return chain;
      },

      // Thenable — makes await work on every query
      then: (resolve, reject) => {
        try {
          let data;
          if (chain._data !== undefined) {
            data = chain._data;
            if (chain._single && Array.isArray(data)) data = data[0] || null;
          } else {
            const store = tbl(table);
            const filtered = store.filter(r => chain._filters.every(f => f(r)));
            data = chain._single ? (filtered[0] || null) : filtered;
          }
          // Enrich items with org data when a nested join was requested
          if (chain._enrichWithOrg && Array.isArray(data)) {
            const orgStore = tbl("orgs");
            data = data.map(item => {
              const org = orgStore.find(o => o.id === item.org_id) || {};
              return { ...item, orgs: {
                name: org.name || "Demo Theatre Program",
                location: org.location || "Demo City, CA",
                state: org.state || "CA",
                zipcode: org.zipcode || "92648",
                lat: null, lng: null,
                marketplace_enabled: true,
              }};
            });
          }
          const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
          resolve({ data, error: null, count });
        } catch(e) {
          if (reject) reject(e);
          else resolve({ data: null, error: e });
        }
      },
    };
    chain[Symbol.toStringTag] = "DemoQuery";
    return chain;
  };

  return {
    getStore: () => tables,
    seedItems: () => {
      if (!seeded) { tables.items = [...DEMO_ITEMS]; seeded = true; }
    },
    from: (table) => mockTable(table),
    rpc:  (fn, args) => {
      // Handle specific RPCs that need to return useful data
      if (fn === "generate_label_prefix") {
        const name = args?.p_name || "DEMO";
        const prefix = name.replace(/[^A-Z]/gi, "").toUpperCase().slice(0,4) || "DEMO";
        return Promise.resolve({ data: prefix, error: null });
      }
      // Credits spending always succeeds in demo
      if (fn === "spend_credits") return Promise.resolve({ data: { success: true }, error: null });
      // Points awarding, referrals, etc. — all succeed silently
      if (fn === "award_milestone_points")  return Promise.resolve({ data: null, error: null });
      if (fn === "award_referral_points")   return Promise.resolve({ data: null, error: null });
      if (fn === "get_my_credit_balance")   return Promise.resolve({ data: 150, error: null });
      if (fn === "points_eligible_in_days") return Promise.resolve({ data: 0,   error: null });
      if (fn === "lookup_label")            return Promise.resolve({ data: null, error: null });
      if (fn === "is_org_member")           return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getSession:        () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: ()=>{} } } }),
      signInWithPassword:() => Promise.resolve({ data: { user: null }, error: { message: "Demo mode" } }),
      signUp: (creds) => {
        const u = { id:"demo-user-id", email:creds.email, created_at:new Date().toISOString() };
        return Promise.resolve({ data: { user: u, session: { access_token:"demo-token", user:u } }, error: null });
      },
      signOut: () => { window.location.href = "https://theatre4u.org"; return Promise.resolve(); },
      admin: { getUserById: () => Promise.resolve({ data: null }) },
    },
    // Realtime — no-op in demo (no live updates needed)
    channel: (name) => {
      const noop = { on: ()=>noop, subscribe: ()=>noop, unsubscribe: ()=>{} };
      return noop;
    },
    removeChannel: () => {},
    removeAllChannels: () => {},
    storage: {
      from: () => ({
        upload:       () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        remove:       () => Promise.resolve({ data: null, error: null }),
      })
    },
  };
}

// Demo wrapper — replaces SB globally when ?demo=1
function DemoApp() {
  const [started,  setStarted]  = useState(false);
  const [store]    = useState(() => createDemoStore());
  const [showNudge,setShowNudge]= useState(false);
  const [demoUser, setDemoUser] = useState(null); // set when user clicks "Enter Demo"

  const enterDemo = async (orgName="Demo Theatre Program") => {
    // Create the demo org in the in-memory store
    const user = { id:"demo-user-id", email:"demo@theatre4u.org", created_at:new Date().toISOString() };
    await store.from("orgs").upsert({
      id: user.id, name: orgName, email: user.email,
      type:"School", phone:"", location:"", bio:"",
      temp_pro:true, onboarding_step:0,
      plan:"pro", created_at:new Date().toISOString(),
      label_prefix:"DEMO",
    },{onConflict:"id",ignoreDuplicates:false});
    store.seedItems();
    setDemoUser(user);
  };

  useEffect(() => {
    window.__demoStore = store;
    window.__isDemo = true;
    setStarted(true);
    const t = setTimeout(() => setShowNudge(true), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [store]);

  if (!started) return null;

  // Don't render AppRoot until the user has clicked Enter Demo
  // Once demoUser is set, AppRoot mounts fresh with that user as the initial state
  if (!demoUser) return (
    <>
      <style>{CSS}</style>
      {/* Demo ribbon shown even on entry screen */}
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,
        background:"linear-gradient(135deg,#1a0d2e,#0d1225)",
        borderBottom:"2px solid #d4a843",
        padding:"7px 20px",display:"flex",alignItems:"center",
        justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎭</span>
          <span style={{fontWeight:800,color:"#d4a843",fontSize:14}}>Demo Mode</span>
          <span style={{color:"rgba(255,255,255,.55)",fontSize:12}}>
            — Nothing is saved. Close the tab to reset.
          </span>
        </div>
        <a href="https://theatre4u.org"
          style={{padding:"5px 14px",borderRadius:6,fontSize:12,fontWeight:600,
            color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.2)",
            textDecoration:"none"}}>
          Exit Demo
        </a>
      </div>
      {/* Entry screen */}
      <div style={{minHeight:"100vh",background:"#0d0b11",display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",padding:"80px 20px 40px",textAlign:"center",
        fontFamily:"'DM Sans',sans-serif",color:"#ede8df"}}>
        <div style={{fontSize:56,marginBottom:16}}>🎭</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,color:"#d4a843",marginBottom:8}}>
          Theatre4u™ Demo
        </div>
        <p style={{fontSize:16,color:"rgba(255,255,255,.55)",maxWidth:440,lineHeight:1.7,marginBottom:36}}>
          Explore the full platform with sample data. Add items, browse the Backstage Exchange,
          and see how Theatre4u works — no account needed.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:14,alignItems:"center",width:"100%",maxWidth:340}}>
          <button
            onClick={()=>enterDemo("Ocean View High School Drama")}
            style={{width:"100%",padding:"16px 32px",borderRadius:10,border:"none",
              background:"linear-gradient(135deg,#d4a843,#a37f2c)",color:"#1a0f00",
              fontSize:17,fontWeight:800,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              boxShadow:"0 4px 20px rgba(212,168,67,.3)"}}>
            🎭 Enter Demo →
          </button>
          <div style={{fontSize:13,color:"rgba(255,255,255,.35)"}}>
            — or personalize with your program name —
          </div>
          <div style={{display:"flex",gap:8,width:"100%"}}>
            <input
              id="demo-org-input"
              placeholder="e.g. Lincoln High Drama"
              style={{flex:1,padding:"11px 14px",borderRadius:8,
                border:"1px solid rgba(255,255,255,.15)",
                background:"rgba(255,255,255,.06)",color:"#fff",
                fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none"}}
              onKeyDown={e=>{
                if(e.key==="Enter"){
                  const v=e.target.value.trim();
                  enterDemo(v||"Ocean View High School Drama");
                }
              }}
            />
            <button
              onClick={()=>{
                const v=document.getElementById("demo-org-input")?.value?.trim();
                enterDemo(v||"Ocean View High School Drama");
              }}
              style={{padding:"11px 18px",borderRadius:8,
                border:"1px solid rgba(212,168,67,.4)",
                background:"rgba(212,168,67,.12)",color:"#d4a843",
                fontSize:14,fontWeight:700,cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"}}>
              Go →
            </button>
          </div>
          <a href="https://theatre4u.org?signup=1"
            style={{fontSize:13,color:"rgba(255,255,255,.3)",textDecoration:"none",marginTop:4}}>
            Ready to create a real account? →
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div style={{position:"relative"}}>
      {/* Demo ribbon */}
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,
        background:"linear-gradient(135deg,#1a0d2e,#0d1225)",
        borderBottom:"2px solid var(--gold, #d4a843)",
        padding:"7px 20px",display:"flex",alignItems:"center",
        justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎭</span>
          <span style={{fontWeight:800,color:"#d4a843",fontSize:14}}>Demo Mode</span>
          <span style={{color:"rgba(255,255,255,.55)",fontSize:12}}>
            — Experience Theatre4u as a new user. Nothing is saved. Close the tab to reset.
          </span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <a href="https://theatre4u.org" style={{padding:"5px 14px",borderRadius:6,
            fontSize:12,fontWeight:600,color:"rgba(255,255,255,.7)",
            border:"1px solid rgba(255,255,255,.2)",textDecoration:"none"}}>
            Exit Demo
          </a>
          <button onClick={()=>{
            // Carry over org name if user typed one during the demo
            const demoOrg = store.getStore().orgs?.[0];
            const orgName = demoOrg?.name || "";
            const email   = demoOrg?.email || "";
            // Store for pre-filling the real signup form
            try {
              if(orgName) sessionStorage.setItem("t4u_prefill_org",   orgName);
              if(email)   sessionStorage.setItem("t4u_prefill_email", email);
            } catch(e) {}
            window.location.href = "https://theatre4u.org?signup=1";
          }} style={{padding:"6px 16px",borderRadius:6,fontSize:13,fontWeight:700,
            color:"#1a0f00",background:"#d4a843",border:"none",cursor:"pointer",
            fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            ⭐ Create Real Account →
          </button>
        </div>
      </div>
      <div style={{paddingTop:40}}>
        {/* Timed conversion nudge — appears after 3 minutes */}
        {showNudge&&(
          <div style={{margin:"12px 16px 0",padding:"14px 18px",borderRadius:10,
            background:"linear-gradient(135deg,rgba(76,175,80,.15),rgba(76,175,80,.08))",
            border:"1px solid rgba(76,175,80,.35)",display:"flex",gap:12,
            alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:22}}>🎭</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"#4caf50",marginBottom:2}}>
                Ready to save your work?
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.65)",lineHeight:1.5}}>
                Everything you've done disappears when you close this tab.
                Create a free account to keep it — it takes 30 seconds.
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexShrink:0}}>
              <button onClick={()=>{
                const demoOrg = store.getStore().orgs?.[0];
                try {
                  if(demoOrg?.name)  sessionStorage.setItem("t4u_prefill_org",   demoOrg.name);
                  if(demoOrg?.email) sessionStorage.setItem("t4u_prefill_email", demoOrg.email);
                } catch(e) {}
                window.location.href = "https://theatre4u.org?signup=1";
              }} style={{padding:"8px 18px",borderRadius:7,border:"none",fontFamily:"inherit",
                fontSize:13,fontWeight:700,cursor:"pointer",
                background:"#4caf50",color:"#fff"}}>
                ⭐ Create Free Account
              </button>
              <button onClick={()=>setShowNudge(false)}
                style={{background:"none",border:"1px solid rgba(255,255,255,.15)",
                  borderRadius:7,padding:"8px 12px",color:"rgba(255,255,255,.5)",
                  fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                Maybe later
              </button>
            </div>
          </div>
        )}
        <ErrorBoundary><AppRoot demoStore={store} demoUser={demoUser} onEnterDemo={enterDemo}/></ErrorBoundary>
      </div>
    </div>
  );
}


const AppWithBoundary = () => isDemoMode()
  ? <DemoApp/>
  : <ErrorBoundary><AppRoot/></ErrorBoundary>;

export default AppWithBoundary;


// ══════════════════════════════════════════════════════════════════════════════
// ── AI Help Bubble ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ── PREVIEW MODE + AI HELP BUBBLE → core/preview.jsx ─────────────────────────────
import { AIHelpBubble, PreviewMode } from "./core/preview.jsx";

// Small banner shown on dashboard and after signup to prompt label purchase
function LabelStoreBanner({ onGoLabels }) {
  return(    <div style={{background:"linear-gradient(135deg,rgba(212,168,67,.1),rgba(212,168,67,.04))",
      border:"1px solid rgba(212,168,67,.25)",borderRadius:12,padding:"14px 18px",
      display:"flex",gap:14,alignItems:"flex-start",marginBottom:18}}>
      <div style={{fontSize:28,flexShrink:0}}>🏷</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>
          Get pre-printed QR labels for your inventory
        </div>
        <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6,marginBottom:10}}>
          Stick them on costumes, props, set pieces, equipment, and storage bins.
          Scan any label with a phone camera to instantly pull up the item.
          Polyester labels for indoor use · Weatherproof for scene shops and storage.
        </div>
        <button className="btn btn-g btn-sm" onClick={onGoLabels}>
          Shop Label Packs →
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LABELS PAGE — Three tabs: Print Now · Assign · Order Physical Labels
// Pricing: WePrintBarcodes cost ~$0.10–0.15/label (standard), ~$0.20–0.25 (WP)
// Retail packs with margin built in. Logo add-on option.
// ══════════════════════════════════════════════════════════════════════════════

// Label pack definitions — retail prices with Theatre4u margin baked in
// Our cost: standard ~$0.12/label + ~$5 shipping. Weatherproof ~$0.22/label + ~$5 shipping.
// ── Label pack pricing ────────────────────────────────────────────────────────
// Our cost basis (WePrintBarcodes estimates — update after vendor call):
//   Standard polyester:  ~$0.12/label + ~$5 shipping
//   Weatherproof vinyl:  ~$0.22/label + ~$5 shipping
// Target: ~25% margin on cost. Round to clean buyer-friendly numbers.
// Update retail cents here after confirming actual WePrintBarcodes pricing.
//
//  Pack          Our cost   Retail   Profit   Margin
//  25 standard   $8.00      $10      $2.00    20%
//  50 standard   $11.00     $15      $4.00    27%
//  100 standard  $17.00     $23      $6.00    26%
//  200 standard  $29.00     $39      $10.00   26%
//  25 WP         $10.50     $14      $3.50    25%
//  50 WP         $16.00     $21      $5.00    24%
//  100 WP        $27.00     $36      $9.00    25%
//  200 WP        $49.00     $65      $16.00   25%
//          login_events, messages, beta_feedback
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN HUB — Single consolidated admin page
// Tabs: Overview · Daily Digest · Users · Analytics · Feedback · Labels · Tools
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PROGRAMS — GOD MODE
// Full oversight of every program: view inventory, edit items, manage team,
// transfer ownership, update org profile. All actions act as service role.
// ══════════════════════════════════════════════════════════════════════════════





function LabelOrderPanel({ org, userId, items=[] }) {
  const [step, setStep]       = useState("intro");
  const [labelItems, setLabelItems] = useState([]);
  const [allItems,   setAllItems]   = useState([]);
  const [labelSize,  setLabelSize]  = useState("2x2");
  const [labelStyle, setLabelStyle] = useState("standard");
  const [searching,  setSearching]  = useState("");
  const [existing,   setExisting]   = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [requestDone,setRequestDone]= useState(false);

  useEffect(()=>{
    SB.from("items").select("id,name,category,location,display_id,img")
      .eq("org_id",userId).order("added",{ascending:false}).limit(200)
      .then(({data})=>setAllItems(data||[]));
    SB.from("label_orders").select("id,item_count,label_type,status,created_at,tracking")
      .eq("org_id",userId).order("created_at",{ascending:false})
      .then(({data})=>setExisting(data||[]));
  },[userId]);

  const toggleItem = id => setLabelItems(prev =>
    prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]
  );
  const selectAll  = () => setLabelItems(allItems.map(i=>i.id));
  const clearAll   = () => setLabelItems([]);

  const SIZES = { "2x2":"2\" x 2\" (recommended)", "2x3":"2\" x 3\" (portrait)", "3x3":"3\" x 3\" (large)", "1x3":"1\" x 3\" (strip)" };
  const STYLES = {
    standard:    { name:"Standard Vinyl", desc:"Indoor use · Matte finish · Waterproof · ~$0.25/label" },
    weatherproof:{ name:"Weatherproof",   desc:"Outdoor/heavy use · Extra durable · ~$0.40/label" },
    "color-coded":{ name:"Color-Coded",  desc:"Color by category · Easier visual sorting · ~$0.35/label" },
  };

  const selectedItems = allItems.filter(i=>labelItems.includes(i.id));
  const count = selectedItems.length;
  const pricePerLabel = labelStyle==="standard"?0.25:labelStyle==="weatherproof"?0.40:0.35;
  const estTotal = (count * pricePerLabel + 7).toFixed(2);

  const LabelPreview = ({item}) => {
    const cat = CAT[item.category]||CAT.other;
    const url = `https://theatre4u.org/#/item/${item.display_id||item.id}`;
    const [qrSrc, setQrSrc] = useState(null);
    useEffect(()=>{
      QR.toDataURL(url,80).then(setQrSrc).catch(()=>{});
    },[item.id]);
    return(
      <div style={{width:96,height:96,border:"2px solid #1a0f00",borderRadius:6,
        padding:6,background:"#fff",display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
        <div style={{fontSize:8,fontWeight:800,color:"#d4a843",textTransform:"uppercase",
          letterSpacing:.5,lineHeight:1}}>{cat.icon} {cat.label}</div>
        <div style={{fontSize:9,fontWeight:700,color:"#1a0f00",lineHeight:1.2,flex:1,
          overflow:"hidden"}}>{item.name}</div>
        <div style={{display:"flex",gap:4,alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            {item.location&&<div style={{fontSize:7,color:"#666"}}>📍{item.location.slice(0,12)}</div>}
            {item.display_id&&<div style={{fontSize:7,fontWeight:700,color:"#d4a843",fontFamily:"monospace"}}>{item.display_id}</div>}
            <div style={{fontSize:7,color:"#999"}}>theatre4u.org</div>
          </div>
          {qrSrc&&<img src={qrSrc} width={30} height={30} alt="QR"/>}
        </div>
      </div>
    );
  };

  const submitRequest = async () => {
    setSaving(true);
    await SB.from("label_orders").insert({
      org_id:        userId,
      org_name:      org?.name||"",
      contact_email: org?.email||"",
      contact_name:  org?.director_name||"",
      item_count:    count,
      label_type:    labelStyle,
      notes:         `Size: ${labelSize}. Items: ${selectedItems.map(i=>i.name).join(", ")}`,
    });
    setSaving(false);
    setRequestDone(true);
    setExisting(prev=>[{item_count:count,label_type:labelStyle,status:"pending",
      created_at:new Date().toISOString()},...prev]);
  };

  return(
    <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,
      padding:20,marginTop:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:16}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:3}}>🏷 QR Label Printing</div>
          <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>
            Order professional QR label stickers for your inventory bins, racks, and props.
            We handle printing through WePrintBarcodes — durable QR label stickers shipped to your door.
          </div>
        </div>
        {step!=="intro"&&<button onClick={()=>{setStep("intro");setRequestDone(false);}} className="btn btn-o btn-sm">← Back</button>}
      </div>

      {existing.length>0&&step==="intro"&&(
        <div style={{marginBottom:14,display:"flex",flexDirection:"column",gap:4}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:4}}>Previous Orders</div>
          {existing.slice(0,3).map((o,i)=>(
            <div key={i} style={{fontSize:12,color:"var(--muted)",display:"flex",gap:12,alignItems:"center"}}>
              <span>{new Date(o.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
              <span>{o.item_count} labels · {o.label_type}</span>
              {o.tracking&&<span style={{fontSize:11}}>📦 {o.tracking}</span>}
              <span style={{fontWeight:600,
                color:o.status==="shipped"||o.status==="delivered"?"#4caf50":o.status==="processing"?"#2196f3":"var(--gold)",
                textTransform:"capitalize"}}>
                {o.status==="pending"?"⏳ Pending":o.status==="processing"?"🔄 Processing":o.status==="shipped"?"✈ Shipped":"✓ Delivered"}
              </span>
            </div>
          ))}
        </div>
      )}

      {step==="intro"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            {[
              { icon:"🎨", title:"We design the labels", body:"Your item name, category icon, QR code, storage location, and Theatre4u branding on every label." },
              { icon:"🏷", title:"Printed by WePrintBarcodes", body:"We generate the label files and order through WePrintBarcodes on your behalf. No action needed from you." },
              { icon:"📦", title:"Ships to your school", body:"WePrintBarcodes ships within 5–7 business days. Polyester and weatherproof vinyl options both survive costume closets and scene shops." },
            ].map(s=>(
              <div key={s.title} style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>{s.title}</div>
                <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.5}}>{s.body}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.2)",borderRadius:8,padding:"10px 14px",fontSize:12,color:"var(--muted)",marginBottom:14,lineHeight:1.6}}>
            <strong style={{color:"var(--text)"}}>Theatre4u label pricing:</strong>
            {" "}$12 for 25 standard · $18 for 25 weatherproof · see packs below.
            Shipping included. Printed and shipped via WePrintBarcodes.
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className="btn btn-g" onClick={()=>setStep("select")}>
              Design My Labels →
            </button>
            <a href="https://www.weprintbarcodes.com" target="_blank" rel="noreferrer"
              style={{fontSize:12,color:"var(--gold)"}}>WePrintBarcodes.com ↗</a>
          </div>
        </div>
      )}

      {step==="select"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <input value={searching} onChange={e=>setSearching(e.target.value)}
              placeholder="Search items…" style={{flex:1,minWidth:180,padding:"6px 10px",
              background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,
              color:"var(--text)",fontSize:13,outline:"none"}}/>
            <button className="btn btn-o btn-sm" onClick={selectAll}>Select All</button>
            <button className="btn btn-o btn-sm" onClick={clearAll}>Clear</button>
            <span style={{fontSize:12,color:"var(--muted)"}}>{count} selected</span>
          </div>
          <div style={{maxHeight:260,overflowY:"auto",border:"1px solid var(--border)",borderRadius:8,
            background:"var(--white)",marginBottom:14}}>
            {allItems
              .filter(i=>!searching||i.name.toLowerCase().includes(searching.toLowerCase())||
                (i.location||"").toLowerCase().includes(searching.toLowerCase()))
              .map(i=>(
              <div key={i.id} onClick={()=>toggleItem(i.id)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",cursor:"pointer",
                  borderBottom:"1px solid var(--border)",
                  background:labelItems.includes(i.id)?"rgba(212,168,67,.08)":"transparent"}}>
                <div style={{width:16,height:16,borderRadius:4,border:"1.5px solid var(--border)",
                  background:labelItems.includes(i.id)?"var(--gold)":"transparent",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {labelItems.includes(i.id)&&<span style={{color:"#1a0f00",fontSize:11,fontWeight:900}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{i.name}</div>
                  {i.location&&<div style={{fontSize:11,color:"var(--muted)"}}>📍 {i.location}</div>}
                </div>
                {i.display_id&&<span style={{fontFamily:"monospace",fontSize:11,color:"var(--amber)"}}>{i.display_id}</span>}
              </div>
            ))}
            {allItems.length===0&&<div style={{padding:20,textAlign:"center",color:"var(--muted)",fontSize:13}}>No items in inventory yet.</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,display:"block",marginBottom:4}}>Label Size</label>
              <select value={labelSize} onChange={e=>setLabelSize(e.target.value)}
                style={{width:"100%",background:"var(--white)",border:"1px solid var(--border)",
                  borderRadius:6,padding:"6px 8px",color:"var(--text)",fontSize:12}}>
                {Object.entries(SIZES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,display:"block",marginBottom:4}}>Label Material</label>
              <select value={labelStyle} onChange={e=>setLabelStyle(e.target.value)}
                style={{width:"100%",background:"var(--white)",border:"1px solid var(--border)",
                  borderRadius:6,padding:"6px 8px",color:"var(--text)",fontSize:12}}>
                {Object.entries(STYLES).map(([v,s])=><option key={v} value={v}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:14}}>
            {STYLES[labelStyle]?.desc}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button className="btn btn-g" disabled={count===0} onClick={()=>setStep("preview")}>
              Preview Labels ({count}) →
            </button>
            {count>0&&<span style={{fontSize:12,color:"var(--muted)"}}>Estimated total (shipping included)</span>}
          </div>
        </div>
      )}

      {step==="preview"&&(
        <div>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:14,lineHeight:1.5}}>
            Preview of your {count} labels at {SIZES[labelSize]} size.
            Your labels will be printed by WePrintBarcodes and mailed to you.
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20,
            maxHeight:320,overflowY:"auto",padding:4}}>
            {selectedItems.slice(0,20).map(item=>(
              <LabelPreview key={item.id} item={item}/>
            ))}
            {count>20&&<div style={{width:96,height:96,border:"2px dashed var(--border)",borderRadius:6,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:13,color:"var(--muted)",textAlign:"center",padding:8}}>
              +{count-20} more labels
            </div>}
          </div>
          {!requestDone?(
            <div>
              <div style={{background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.2)",
                borderRadius:8,padding:"12px 14px",fontSize:12,color:"var(--muted)",marginBottom:14,lineHeight:1.6}}>
                <strong style={{color:"var(--text)"}}>How this works:</strong>{" "}
                Submit your request below. We'll generate a print-ready PDF file and email it to{" "}
                <strong>{org?.email}</strong> within 1–2 business days.
                Labels are printed by WePrintBarcodes and shipped to your address on file. Payment is processed by Theatre4u when we confirm your order.
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={submitRequest} disabled={saving} className="btn btn-g">
                  {saving?"Submitting…":"📧 Send Me the Print File →"}
                </button>
                <button onClick={()=>setStep("select")} className="btn btn-o btn-sm">← Edit Selection</button>
                <span style={{fontSize:11,color:"var(--faint)"}}>You'll receive an email confirmation before payment is processed</span>
              </div>
            </div>
          ):(
            <div style={{background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.25)",
              borderRadius:8,padding:"14px 16px",fontSize:13,color:"var(--text)"}}>
              <div style={{fontWeight:700,marginBottom:4}}>✓ Request received!</div>
              <div style={{lineHeight:1.6,color:"var(--muted)"}}>
                We'll email a print-ready PDF to <strong>{org?.email}</strong> within 1–2 business days.
                Then just upload it to{" "}
                WePrintBarcodes. Labels ship within 5–7 business days.
              </div>
              <div style={{marginTop:10,display:"flex",gap:8}}>
                <button onClick={()=>{setStep("intro");setRequestDone(false);}} className="btn btn-o btn-sm">
                  Order More Labels
                </button>
                
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Pool health indicator for Admin Hub

// ── Visit tracking helper ────────────────────────────────────────────────────
// Capture referral code from ?ref= param and persist it for signup
;(()=>{
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) sessionStorage.setItem("t4u_ref", ref.toUpperCase().trim());
  } catch(e) {}
})();

function AppRoot({ demoStore = null, demoUser = null, onEnterDemo = null }){
  const isDemo = !!demoStore;
  activateDemoStore(demoStore);
  // In demo mode, use the pre-built demo user if provided
  const [user,setUser] = useState(demoUser);
  // ── Hash routing: #/item/:id and #/location/:id (storage location QR codes) ──
  const _parseHash = (h) => ({
    itemId:     (h.match(/^#\/item\/(.+)$/)     || [])[1] || null,
    locationId: (h.match(/^#\/location\/(.+)$/) || [])[1] || null,
    orgSlug:    (h.match(/^#\/org\/(.+)$/)      || [])[1] || null,
  });
  const [publicItemId,     setPublicItemId]     = useState(() => _parseHash(window.location.hash).itemId);
  const [deepLinkLocation, setDeepLinkLocation] = useState(() => _parseHash(window.location.hash).locationId);
  const [deepLinkCategory, setDeepLinkCategory] = useState(null);
  const [publicOrgSlug,    setPublicOrgSlug]    = useState(() => _parseHash(window.location.hash).orgSlug);
  useEffect(()=>{
    const onHash = () => {
      const { itemId, locationId, orgSlug } = _parseHash(window.location.hash);
      setPublicItemId(itemId);
      setDeepLinkLocation(locationId);
      setPublicOrgSlug(orgSlug);
      if (locationId && !itemId) setPage("inventory");
    };
    window.addEventListener("hashchange", onHash);
    // Also handle the case where the page loads with an existing hash
    // (e.g. second scan: browser already at #/item/X, so hashchange doesn't fire)
    // We handle this by watching document visibility — when user returns from camera
    const onVisible = () => {
      const { itemId } = _parseHash(window.location.hash);
      if(itemId) setPublicItemId(p => p === itemId ? itemId + " " : itemId); // force re-render
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const [items,setItems]   = useState([]);
  const [org,setOrg]       = useState({name:"",type:"",email:"",phone:"",location:"",bio:""});
  const [plan,setPlanState] = useState("free"); // derived from org.plan
  const [page,setPage]     = useState("dashboard");
  const [legalPage,setLegalPage] = useState(null);
  const [mob,setMob]       = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [authChk,setAuthChk] = useState(false);
  // Preview mode -- ?preview=1 in URL shows the platform with sample data (no login required)
  const [previewMode, setPreviewMode] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1"
  );
  // District: activeSchool = null means "own account", otherwise = school org object
  const [activeSchool,setActiveSchool]   = useState(null);
  const [memberRole,  setMemberRole]    = useState(null); // null=owner/director, or stage_manager/crew/house/program_director
  const [memberships, setMemberships]   = useState([]); // all program memberships (for multi-program directors)
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [openConvId,    setOpenConvId]    = useState(null);
  const [pendingReqCount, setPendingReqCount] = useState(0);
  const [creditBalance, setCreditBalance] = useState(0);
  const [onboardingStep, setOnboardingStep] = useState(null); // null=loading, 0-4
  const [schoolItems,setSchoolItems]     = useState([]);
  const [schoolLoading,setSchoolLoading] = useState(false);
  const [custCatVer,setCustCatVer] = useState(0); // bumped when custom categories reload, forces re-render
  const [facDistrict,setFacDistrict]= useState(null); // district this user facilitates (full-edit browse), or null
  const [facSchools, setFacSchools] = useState([]);   // schools in the facilitated district
  // Invite token from URL — persisted in localStorage so it survives
  // Supabase's email confirmation redirect (which strips query params)
  const [pendingInvite,setPendingInvite] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const fromUrl = p.get("invite") || p.get("token");
    // Also capture join codes from URL e.g. ?code=Y8H-YMH
    const codeFromUrl = p.get("code");
    if (codeFromUrl && !codeFromUrl.includes("-0") && codeFromUrl.length < 12) {
      // Looks like a join code (not a label code like OVHS-0001)
      localStorage.setItem("t4u_pending_join_code", codeFromUrl.toUpperCase().trim());
    }
    if (fromUrl) {
      localStorage.setItem("t4u_pending_invite", fromUrl);
      const itype = p.get("token") ? "team" : "district";
      localStorage.setItem("t4u_pending_invite_type", itype);
      return fromUrl;
    }
    return localStorage.getItem("t4u_pending_invite") || null;
  });
  const pendingInviteType = localStorage.getItem("t4u_pending_invite_type") || "district";
  const [inviteInfo, setInviteInfo] = useState(null);
  useEffect(()=>{
    if(!pendingInvite||user) return;
    (async()=>{
      try{const{data}=await SB.rpc("get_invite_by_token",{p_token:pendingInvite});if(data&&data.length>0)setInviteInfo(data[0]);}
      catch(e){console.warn("invite info:",e);}
    })();
  },[pendingInvite,user]);

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(()=>{
    // Demo mode: user is pre-set, skip all real auth checks
    if(isDemo){ setAuthChk(true); return; }

    SB.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user||null);
      setAuthChk(true);
      if(!session){
        try{
          const keys=Object.keys(localStorage).filter(k=>k.startsWith("sb-"));
          if(keys.length>0){keys.forEach(k=>localStorage.removeItem(k));}
        }catch(e){}
      }
    });
    const{data:{subscription}}=SB.auth.onAuthStateChange((_,session)=>{
      const u = session?.user||null;
      setUser(u);
      if(!session) {
        setItems([]); setOrg({name:"",type:"",email:"",phone:"",location:"",bio:""});
        setLoaded(false);
      } else if(u) {
        setLoaded(false);
      }
    });
    return()=>subscription.unsubscribe();
  },[]);

  // ── On load: if ?signin=1 or ?signup=1 in URL, open auth modal immediately ──
  useEffect(()=>{
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("signin")==="1" ? "login"
                 : params.get("signup")==="1" ? "signup"
                 : null;
      if(mode) {
        const nextHash = params.get("next") || "";
        const cleanUrl = window.location.pathname + (nextHash ? nextHash : "");
        window.history.replaceState({}, "", cleanUrl);
        if(nextHash && nextHash.startsWith("#/item/")) {
          try { localStorage.setItem("t4u_post_auth_hash", nextHash); } catch(e) {}
        }
        setTimeout(()=>{
          if(typeof window.__t4u_show_auth === "function") {
            window.__t4u_show_auth(mode);
          }
        }, 400);
      }
    } catch(e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detect post-Stripe-payment redirect and refresh org plan ────────────────
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");
  useEffect(()=>{
    if(!user) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const paymentSuccess = params.get("payment_success") || params.get("session_id");
      if(paymentSuccess) {
        // Clean the URL immediately
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
        // Refresh org data — try immediately then again after 3s for webhook processing
        const refresh = async () => {
          const { data: freshOrg } = await SB.from("orgs").select("*").eq("id", user.id).single();
          if(freshOrg) {
            setOrg(prev => ({ ...prev, ...freshOrg }));
            const ep = freshOrg.stripe_subscription_id ? freshOrg.plan
              : freshOrg.temp_pro ? "pro" : (freshOrg.plan || "free");
            setPlanState(ep);
          }
        };
        refresh();
        setTimeout(refresh, 3000);
        setPaymentSuccessMsg("🎉 Welcome to Pro! Your subscription is now active.");
        setTimeout(() => setPaymentSuccessMsg(""), 8000);
      }
    } catch(e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  useEffect(()=>{
    if(!user) return;
    try {
      const savedHash = localStorage.getItem("t4u_post_auth_hash");
      if(savedHash && savedHash.startsWith("#/item/")) {
        localStorage.removeItem("t4u_post_auth_hash");
        // Small delay to let auth state settle, then navigate to item
        setTimeout(()=>{ window.location.hash = savedHash; }, 300);
      }
    } catch(e) {}
  }, [user]);

  // ── Load data once logged in ─────────────────────────────────────────────
  useEffect(()=>{
    if(!user||loaded) return;
    (async()=>{
      // Check if user is a member of one or more orgs (team member or program director)
      const { data: memberRows } = await SB.from("org_members")
        .select("org_id, role, orgs(*)")
        .eq("user_id", user.id);
      let memberList = memberRows || [];
      // Always make the user's OWN org (id === user.id) selectable as owner, so a
      // multi-program owner who is also a member elsewhere can still reach their
      // own org. Appended (not prepended) to preserve the default-landing behavior.
      if (!memberList.some(m => m.org_id === user.id)) {
        const { data: ownOrg } = await SB.from("orgs").select("*").eq("id", user.id).single();
        if (ownOrg) memberList = [...memberList, { org_id: user.id, role: null, orgs: ownOrg, _own: true }];
      }
      setMemberships(memberList);

      // Pick the active program: a saved preference if still valid, else the first
      // REAL membership (preserves prior default), else the user's own org.
      const savedId = (()=>{ try { return localStorage.getItem("t4u_active_program"); } catch(e){ return null; } })();
      const firstReal = (memberRows && memberRows.length) ? memberRows[0] : (memberList[0] || null);
      let activeMembership = memberList.find(m => m.org_id === savedId) || firstReal;
      // The user's own org is owner access, NOT a membership — treat it like the
      // old "0 memberships" path (memberRole=null, not a member).
      const realMembership = (activeMembership && activeMembership.org_id !== user.id) ? activeMembership : null;
      const targetOrgId = realMembership ? realMembership.org_id : user.id;
      const memberRole  = realMembership ? realMembership.role : null;

      const{data:orgData}=await SB.from("orgs").select("*").eq("id",targetOrgId).single();
      // Admin emails always get District plan regardless of what is stored
      // temp_pro = true gives Pro access during beta (no payment required)
      const effectivePlan = isAdminEmail(user?.email) ? "district"
        : orgData?.temp_pro ? "pro"
        : (orgData?.plan || "free");
      if(orgData){
        setOrg({...orgData, _memberRole: memberRole, _isMember: !!realMembership});
        setMemberRole(memberRole);
        setPlanState(effectivePlan);
        // Load onboarding step — 0 = brand new user
        setOnboardingStep(orgData.onboarding_step ?? 0);
      } else { setPlanState(effectivePlan); }
      const{data:itemData}=await SB.from("items").select("*").eq("org_id",targetOrgId).order("added",{ascending:false}).limit(2000);
      if(itemData) setItems(itemData);
      // Facilitator detection — if this user facilitates a district, load it + its schools (full-edit browse)
      const { data: facRows } = await SB.from("district_members")
        .select("district_id").eq("user_id", user.id).eq("role","facilitator").limit(1);
      if (facRows && facRows.length) {
        const fdId = facRows[0].district_id;
        const { data: fDist } = await SB.from("districts").select("*").eq("id", fdId).single();
        setFacDistrict(fDist || null);
        const { data: fSch } = await SB.from("orgs").select("*").eq("district_id", fdId).order("name");
        setFacSchools(fSch || []);
      } else { setFacDistrict(null); setFacSchools([]); }
      setLoaded(true);
      // Load unread message count
      const { count: unread } = await SB.from("messages")
        .select("id", { count: "exact", head: true })
        .eq("read", false)
        .neq("sender_id", user.id);
      setUnreadCount(unread || 0);
      // Load pending request count (incoming)
      const { count: reqCount } = await SB.from("rental_requests")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "pending");
      setPendingReqCount(reqCount || 0);
      // Stage Points balance — loaded at login so it shows in nav/dashboard
      SB.rpc("get_my_credit_balance").then(({data})=>{ if(data!=null) setCreditBalance(data||0); }).catch(()=>{});
      // Stage Points balance — also refreshed on Credits page visit
      // (removed from startup to reduce login query count)
    })();
  },[user]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const add = useCallback(async(item)=>{
    const row={...item,org_id:user.id};
    // Sanitize optional numeric/date/uuid fields — empty string → null
    if(!row.purchase_cost || row.purchase_cost==="")    row.purchase_cost    = null;
    else row.purchase_cost = parseFloat(row.purchase_cost) || null;
    if(!row.purchase_date  || row.purchase_date==="")   row.purchase_date    = null;
    if(!row.purchase_vendor|| row.purchase_vendor==="") row.purchase_vendor  = null;
    if(!row.funding_source_id||row.funding_source_id==="") row.funding_source_id = null;
    if(!row.location_id    || row.location_id==="")     row.location_id      = null;
    if(!row.pin_id         || row.pin_id==="")           row.pin_id           = null;
    if(!row.rack_slot      || row.rack_slot==="")        row.rack_slot        = null;
    const{data,error}=await SB.from("items").insert(row).select().single();
    if(error){ alert("Could not save item: "+error.message); console.error(error); return; }
    if(data){
      setItems(p=>[data,...p]);
      // Auto-create funding expenditure if a funding source and cost were provided
      if(item.funding_source_id && item.purchase_cost && parseFloat(item.purchase_cost)>0){
        await SB.from("funding_expenditures").insert({
          org_id:           user.id,
          funding_source_id: item.funding_source_id,
          item_id:          data.id,
          amount:           parseFloat(item.purchase_cost),
          description:      item.name || "Inventory item",
          vendor:           item.purchase_vendor || null,
          purchase_date:    item.purchase_date || new Date().toISOString().slice(0,10),
          category:         "Supplies",
        });
      }
    }
  },[user]);

  const edit = useCallback(async(item)=>{
    const payload={...item};
    // Strip immutable fields and any joined org_ fields from Exchange cross-org queries
    delete payload.id; delete payload.org_id; delete payload.added;
    Object.keys(payload).forEach(k=>{ if(k.startsWith('org_')||k==='orgs') delete payload[k]; });
    // Sanitize optional numeric/date/uuid fields — empty string → null
    if(payload.purchase_cost===""||payload.purchase_cost===null||isNaN(parseFloat(payload.purchase_cost)))
      payload.purchase_cost = null;
    else payload.purchase_cost = parseFloat(payload.purchase_cost);
    if(!payload.purchase_date    ||payload.purchase_date==="")    payload.purchase_date    = null;
    if(!payload.purchase_vendor  ||payload.purchase_vendor==="")  payload.purchase_vendor  = null;
    if(!payload.funding_source_id||payload.funding_source_id==="")payload.funding_source_id= null;
    if(!payload.location_id      ||payload.location_id==="")      payload.location_id      = null;
    if(!payload.pin_id           ||payload.pin_id===""           )payload.pin_id           = null;
    if(!payload.rack_slot        ||payload.rack_slot===""        )payload.rack_slot         = null;
    const{data,error}=await SB.from("items").update(payload).eq("id",item.id).select().single();
    if(error){ alert("Could not update item: "+error.message); console.error(error); return; }
    if(data){
      setItems(p=>p.map(x=>x.id===item.id?data:x));
      // If a funding source + cost is set, upsert the expenditure linked to this item
      // (only create if none exists yet for this item — avoid duplicating on every edit)
      if(item.funding_source_id && item.purchase_cost && parseFloat(item.purchase_cost)>0){
        const{data:existing}=await SB.from("funding_expenditures").select("id").eq("item_id",item.id).maybeSingle();
        if(!existing){
          await SB.from("funding_expenditures").insert({
            org_id:           user.id,
            funding_source_id: item.funding_source_id,
            item_id:          item.id,
            amount:           parseFloat(item.purchase_cost),
            description:      item.name || "Inventory item",
            vendor:           item.purchase_vendor || null,
            purchase_date:    item.purchase_date || new Date().toISOString().slice(0,10),
            category:         "Supplies",
          });
        } else {
          // Update existing expenditure amount/source if changed
          await SB.from("funding_expenditures").update({
            funding_source_id: item.funding_source_id,
            amount:           parseFloat(item.purchase_cost),
            vendor:           item.purchase_vendor || null,
            purchase_date:    item.purchase_date || existing.purchase_date,
          }).eq("id",existing.id);
        }
      }
    }
  },[user]);

  const del = useCallback(async(id)=>{
    await SB.from("items").delete().eq("id",id);
    setItems(p=>p.filter(x=>x.id!==id));
  },[]);

  const seed = useCallback(async()=>{
    if(items.length>0){
      if(!window.confirm("You already have "+items.length+" item(s). Add sample data anyway?")) return;
    }
    const samples=makeSamples().map(i=>({...i,org_id:user.id}));
    const{data,error}=await SB.from("items").insert(samples).select();
    if(error){alert(EM.sampleLoad.title+"\n\n"+EM.sampleLoad.body);return;}
    if(data) setItems(p=>[...data,...p]);
  },[user,items]);

  // setPlan — used by admin test panel to override plan
  const setPlan = useCallback(async(newPlan)=>{
    setPlanState(newPlan);
    setOrg(p=>({...p,plan:newPlan}));
    await SB.from("orgs").update({plan:newPlan}).eq("id",user.id);
  },[user]);

  const saveOrg = useCallback(async(o)=>{
    setOrg(o);
    let update = {...o, id:user.id};
    // Auto-geocode zipcode when saving profile
    if(o.zipcode && o.zipcode.length===5 && o.zipcode!==org.zipcode){
      const coords = await zipToCoords(o.zipcode);
      if(coords){ update.lat=coords.lat; update.lng=coords.lng; update.state=update.state||coords.state; }
    }
    await SB.from("orgs").upsert(update);
  },[user,org.zipcode]);

  const signOut = async()=>{ await SB.auth.signOut(); };

  const nav = p => {
    // Handle special onboarding actions
    if (p === "inventory-csv") { setPage("inventory"); setMob(false); setActiveSchool(null);
      window.history.pushState({ t4uPage: "inventory" }, "", window.location.pathname);
      // Signal inventory to open CSV modal after mount
      setTimeout(()=>window.__t4u_open_csv&&window.__t4u_open_csv(), 400); return; }
    if (p === "sample") { setPage("dashboard"); setMob(false); setActiveSchool(null);
      window.history.pushState({ t4uPage: "dashboard" }, "", window.location.pathname);
      setTimeout(()=>window.__t4u_load_samples&&window.__t4u_load_samples(), 400); return; }
    setPage(p); setMob(false); setActiveSchool(null);
    // Push a history entry so browser back button navigates within the app
    window.history.pushState({ t4uPage: p }, "", window.location.pathname);
  };
  // Onboarding: auto-advance when item milestones are hit
  useEffect(()=>{
    if (onboardingStep === null) return;
    // Step 2 triggers after first item is added
    if (onboardingStep === 2 && items.length === 0) return; // wait for item
    // Step 3 triggers after 5+ items
    if (onboardingStep === 3 && items.length < 5) return;
  },[onboardingStep, items.length]);

  // Redirect to dashboard if current page's flag gets turned off

  useEffect(()=>{
    if(page==="marketplace"&& !org?.marketplace_enabled) setPage("dashboard");
  },[org?.marketplace_enabled, page]);
  // Expose for cross-component navigation
  useEffect(()=>{
    window.__t4u_nav_messages = (convId) => { setOpenConvId(convId); setPage("messages"); setMob(false); };
    window.__t4u_nav_requests = ()       => { setPage("requests"); setMob(false); };
    return () => { delete window.__t4u_nav_messages; delete window.__t4u_nav_requests; };
  },[]);
  // Back button: intercept popstate and navigate within the app
  useEffect(()=>{
    // Seed initial history entry so there's always somewhere to go back to
    window.history.replaceState({ t4uPage: "dashboard" }, "", window.location.pathname);
    const onPop = (e) => {
      const p = e.state?.t4uPage;
      if (p) {
        setPage(p); setMob(false); setActiveSchool(null);
      } else {
        // No state means we've gone back past our first entry — push again to trap
        window.history.pushState({ t4uPage: page }, "", window.location.pathname);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const isDesk = typeof window !== "undefined" && window.innerWidth > 900;
  const listed = items.filter(i=>i.mkt!=="Not Listed").length;

  // Switch into a school's context (district admin only)
  const switchSchool = useCallback(async (school) => {
    if (!school) { setActiveSchool(null); setSchoolItems([]); return; }
    setActiveSchool(school);
    setSchoolLoading(true);
    const { data } = await SB.from("items").select("*").eq("org_id", school.id).order("added", { ascending: false });
    setSchoolItems(data || []);
    setSchoolLoading(false);
    setPage("inventory");
    setMob(false);
  }, []);

  // Keep custom inventory categories in sync with whichever org is currently active
  // (own account OR a district school being viewed) — so switching never needs a page refresh.
  useEffect(()=>{
    const oid = activeSchool?.id || org?.id;
    if(!oid){ setCustomCats([]); return; }
    let cancelled=false;
    SB.from("org_categories").select("id,vertical,label").eq("org_id", oid).then(({data})=>{
      if(cancelled) return;
      setCustomCats(data||[]);
      setCustCatVer(v=>v+1);
    });
    return ()=>{ cancelled=true; };
  },[activeSchool, org?.id]);

  // Handle invite token — after login, accept the invite
  useEffect(() => {
    if (!user || !pendingInvite) return;
    const itype = localStorage.getItem("t4u_pending_invite_type") || "district";

    const clearInvite = () => {
      localStorage.removeItem("t4u_pending_invite");
      localStorage.removeItem("t4u_pending_invite_type");
      setPendingInvite(null);
      window.history.replaceState({}, "", window.location.pathname);
    };

    (async () => {
      // ── TEAM INVITE (org_invites) ──────────────────────────────────────
      if (itype === "team") {
        // Use SECURITY DEFINER RPC to bypass RLS — handles insert + mark accepted
        const { data: result, error: rpcErr } = await SB.rpc("accept_team_invite", {
          p_token: pendingInvite,
        });

        if (rpcErr || result?.error) {
          console.error("accept_team_invite error:", rpcErr || result?.error);
          clearInvite();
          const msg = result?.error || "Something went wrong accepting the invite.";
          if (msg.includes("Already a member")) {
            alert("You're already a member of this team!");
          } else if (msg.includes("expired")) {
            alert("This invite has expired. Ask the director to send a new invite.");
          } else {
            alert(msg + " Please try again or contact hello@theatre4u.org.");
          }
          return;
        }

        clearInvite();
        const orgName = result?.org_name || "the program";
        const roleLabel = result?.role === "stage_manager" ? "Stage Manager"
          : result?.role === "crew" ? "Crew" : "House";
        alert(`✓ Welcome to ${orgName}'s Backstage Team! You've joined as ${roleLabel}. The page will reload to show your team inventory.`);
        window.location.reload();
        return;
      }

      // ── JOIN CODE (persisted from URL or signup) ──────────────────────
      const pendingCode = localStorage.getItem("t4u_pending_join_code");
      if (pendingCode) {
        localStorage.removeItem("t4u_pending_join_code");
        clearInvite();
        const { data: codeResult, error: codeErr } = await SB.rpc("accept_team_invite_by_code", {
          p_code: pendingCode,
        });
        if (!codeErr && codeResult?.success) {
          const orgName   = codeResult.org_name || "the program";
          const roleLabel = codeResult.role === "stage_manager" ? "Stage Manager"
            : codeResult.role === "crew" ? "Crew"
            : codeResult.role === "co_director" ? "Co-Director" : "House";
          alert(`✓ Welcome to ${orgName}'s Backstage Team! You've joined as ${roleLabel}. The page will reload.`);
          window.location.reload();
        } else if (codeResult?.error?.includes("Already a member")) {
          // Silent — they're already in, just reload
          window.location.reload();
        }
        return;
      }

      // ── DISTRICT INVITE (district_invites) ────────────────────────────
      const { data: invite } = await SB.from("district_invites")
        .select("*, districts(id,name)")
        .eq("token", pendingInvite)
        .eq("status", "pending")
        .single();
      if (!invite) {
        clearInvite();
        alert("This invite link has expired or has already been used. Ask your district administrator to send a fresh invite link.");
        return;
      }

      // Check if this org is already in a different district
      const { data: currentOrg } = await SB.from("orgs").select("district_id,name").eq("id", user.id).single();
      if (currentOrg?.district_id && currentOrg.district_id !== invite.district_id) {
        const districtName = invite.districts?.name || "this district";
        const confirmed = window.confirm(
          `Your account (${currentOrg.name || user.email}) is currently linked to another district.\n\n` +
          `Accepting this invite will move your account to "${districtName}".\n\n` +
          `Your inventory and data will move with you. Continue?`
        );
        if (!confirmed) { clearInvite(); return; }
      }

      // Link org to district + mark invite accepted
      await SB.from("orgs").update({ district_id: invite.district_id, role: "school_admin" }).eq("id", user.id);
      await SB.from("district_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);
      clearInvite();
      // Reload org data to pick up new district_id
      const { data: updatedOrg } = await SB.from("orgs").select("*").eq("id", user.id).single();
      if (updatedOrg) setOrg(updatedOrg);
      alert(`✓ You've joined ${invite.districts?.name || "the district"}! Your account and inventory are now linked. Welcome to Theatre4u™.`);
    })();
  }, [user, pendingInvite]);

  // Navigate to inventory when location QR is scanned and user is logged in
  useEffect(()=>{
    if (deepLinkLocation && loaded && user) {
      setPage("inventory");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [deepLinkLocation, loaded, user]);

  const isAdmin = isAdminEmail(user?.email);
  const NAV = (() => {
    const role = memberRole; // null=director/owner, stage_manager, crew, house
    const isCrew  = role === "crew"  || role === "house";
    const isStage = role === "stage_manager";
    const isMember = !!role; // any team member (not the owner)
    return [
      { id:"dashboard",   label:"Dashboard",   ico:Ic.home    },
      ...(!isCrew  ? [{ id:"messages",    label:"Messages",    ico:"💬"       }] : []),
      ...(!isCrew  ? [{ id:"requests",    label:"Requests",    ico:"📋"       }] : []),
      { id:"inventory",   label:"Inventory",   ico:Ic.box     },
      ...(!isCrew && org?.marketplace_enabled ? [{ id:"marketplace", label:getExchangeName(org?.vertical), ico:Ic.store   }] : []),
      ...(!isCrew && org?.community_enabled   ? [{ id:"community",   label:"Community",   ico:"🎪", community:true }] : []),
      { id:"productions", label:"Productions", ico:"🎭"       },
      ...(!isMember? [{ id:"reports",     label:"Reports",     ico:Ic.chart   }] : []),
      ...(!isMember? [{ id:"funding",     label:"Funding Tracker", ico:"💰"  }] : []),
      // Prop 28 nav hidden — legacy data accessible via Funding Tracker migration banner
      { id:"profile",     label:"My Profile",  ico:"👤"       },
      ...(!isMember ? [{ id:"labels",  label:"QR Labels",    ico:"🏷" }] : []),
      ...(!isMember ? [{ id:"points", label:getPointsName(org?.vertical), ico:"🪙" }] : []),
      ...(!isMember && plan === "district" ? [{ id:"district", label:"District", ico:"🏢", district:true }] : []),
      ...(!isMember && facDistrict ? [{ id:"facschools", label:"District Schools", ico:"🏫" }] : []),
      ...(!isMember && isAdmin ? [{ id:"admin", label:"Admin", ico:Ic.settings, admin:true }] : []),
    ];
  })();
  const TITLES = { messages:"Messages", prop28:"Prop 28", requests:"Requests", dashboard:"Dashboard", inventory: activeSchool ? `📦 ${activeSchool.name}` : "Inventory", marketplace:getExchangeName(org?.vertical), productions:"Productions", reports:"Reports", settings:"Settings", admin:"Admin Dashboard", district:"District", credits:getPointsName(org?.vertical), points:getPointsName(org?.vertical), community:"Community Board", labels:"QR Labels", facschools:"District Schools" };

  // ── Public item page — no auth required ─────────────────────────────────────
  if (publicOrgSlug) return <PublicOrgPage slug={publicOrgSlug} />;
  if (publicItemId) return <PublicItemPage itemId={publicItemId} />;

  // ── Auth gate ────────────────────────────────────────────────────────────
  if(!authChk) return(
    <div style={{minHeight:"100vh",background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexDirection:"column"}}>
      <style>{CSS}</style>
      <div style={{fontSize:52}}>🎭</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--gold)"}}>Loading Theatre4u™…</div>
      <div style={{width:32,height:32,border:"2.5px solid var(--linen)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
    </div>
  );

  if(!user && previewMode) return <PreviewMode onSignUp={()=>{ setPreviewMode(false); window.__t4u_show_auth&&window.__t4u_show_auth("signup"); }}/>;

  if(!user) return(
    <>
      <style>{CSS}</style>
      <LandingPage
        onSignIn={()=>{
          // Show auth screen in signin mode by mounting AuthScreen with initial mode
          const el=document.getElementById("t4u-auth-overlay");
          if(el) el.style.display="flex";
          window.__t4u_auth_mode="login";
          window.__t4u_show_auth&&window.__t4u_show_auth("login");
        }}
        onSignUp={()=>{
          window.__t4u_show_auth&&window.__t4u_show_auth("signup");
        }}
        onTakeTour={()=>{ window.location.href = window.location.href.split("?")[0] + "?preview=1"; }}
      />
      <AuthOverlay onAuth={u=>{setUser(u);}} pendingInvite={pendingInvite} inviteInfo={inviteInfo}/>
      {user && <FeedbackWidget userId={user.id} orgName={org?.name||""} isLeadingPlayer={org?.is_leading_player||false}/>}
      {user && !isDemo && <AIHelpBubble user={user} />}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        {/* Sidebar */}
        <aside className={`sidebar ${isDesk ? "" : mob ? "open" : "hidden"}`}
               style={isDesk ? {position:"relative",transform:"none"} : {}}>
          <div className="sb-root">
            <div className="sb-photo" style={{background:"linear-gradient(180deg,#0F0B0A 0%,#1a1208 50%,#0F0B0A 100%)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.06,userSelect:"none"}}>
                <svg width="180" height="180" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="5" width="90" height="90" rx="14" stroke="#D4A64A" fill="none" strokeWidth="3"/>
                  <path d="M20 50 Q37 22 54 50 Q37 72 20 50Z" fill="#D4A64A"/>
                  <path d="M46 50 Q63 78 80 50 Q63 28 46 50Z" fill="#D4A64A"/>
                </svg>
              </div>
            </div>
            <div className="sb-inner">
              <div className="sb-logo">
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <LogoMarkDark size={54}/>
                  <div>
                    <div className="sb-name">{APP_NAME}</div>
                    <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"rgba(212,168,67,.5)",marginTop:2,fontFamily:"'Raleway',sans-serif",fontWeight:700}}>{APP_SUBTITLE}</div>
                  </div>
                </div>
                <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{padding:"2px 8px",background:plan==="free"?"rgba(255,255,255,.08)":plan==="pro"?"rgba(212,168,67,.2)":"rgba(66,165,245,.2)",color:plan==="free"?"rgba(255,255,255,.35)":plan==="pro"?"var(--gold)":"#42a5f5",borderRadius:9,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>
                    {plan==="free"?"Free Plan":plan==="pro"?"Pro":"District"}
                  </span>
                  {IS_ARTSTRACKER && org?.vertical && (
                    <span style={{padding:"2px 8px",background:"rgba(212,168,67,.15)",color:"var(--gold)",borderRadius:9,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"inline-flex",alignItems:"center",gap:4}}>
                      {getVertical(org.vertical).icon} {getVertical(org.vertical).label}
                    </span>
                  )}
                </div>
                {/* Program switcher — only for directors assigned to 2+ programs */}
                {memberships.length >= 2 && (
                  <select
                    value={org?.id || ""}
                    onChange={e=>{ try{ localStorage.setItem("t4u_active_program", e.target.value);}catch(err){} window.location.reload(); }}
                    style={{marginTop:8,width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--linen)",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}
                    title="Switch between the programs you direct">
                    {memberships.map(m=>(
                      <option key={m.org_id} value={m.org_id}>{m.orgs?.name || "Program"}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Member banner — shown when logged in as a team member */}
              {memberRole && org && (
                <div style={{
                  margin:"8px 12px 4px",
                  background:"rgba(212,168,67,.08)",
                  border:"1px solid rgba(212,168,67,.2)",
                  borderRadius:8,
                  padding:"8px 12px",
                  fontSize:11,
                  lineHeight:1.4,
                }}>
                  <div style={{color:"var(--gold)",fontWeight:700,marginBottom:2}}>
                    {memberRole==="stage_manager"?"📋 Stage Manager":
                     memberRole==="crew"?"🔧 Crew":
                     memberRole==="house"?"🎟 House":
                     memberRole==="program_director"?"🎯 Program Director":"Team Member"}
                  </div>
                  <div style={{color:"rgba(255,255,255,.5)"}}>
                    Viewing <strong style={{color:"rgba(255,255,255,.75)"}}>{org.name}</strong>
                  </div>
                </div>
              )}

              <nav className="sb-nav">
                {/* School context banner when browsing a school as district admin */}
                {activeSchool && (
                  <div style={{ padding: "8px 10px", marginBottom: 6, background: "rgba(66,165,245,.12)", border: "1px solid rgba(66,165,245,.25)", borderRadius: 8, fontSize: 12 }}>
                    <div style={{ color: "#42a5f5", fontWeight: 700, marginBottom: 3 }}>📋 Viewing School</div>
                    <div style={{ color: "rgba(255,255,255,.75)", lineHeight: 1.3, marginBottom: 6 }}>{activeSchool.name}</div>
                    <button onClick={() => { setActiveSchool(null); setPage(plan==="district" ? "district" : "facschools"); }}
                      style={{ fontSize: 11, color: "rgba(255,255,255,.6)", background: "none", border: "1px solid rgba(255,255,255,.2)", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                      {plan==="district" ? "← Back to District" : "← Back to Schools"}
                    </button>
                  </div>
                )}
                {NAV.map(n=>(
                  <div key={n.id}
                    className={`sb-item ${page===n.id?"on":""}`}
                    onClick={()=>nav(n.id)}
                    style={n.admin ? {marginTop:12, borderTop:"1px solid rgba(212,168,67,.15)", paddingTop:12, color: page===n.id ? undefined : "rgba(212,168,67,.65)"}
                         : n.district ? {marginTop:4, color: page===n.id ? undefined : "rgba(66,165,245,.75)"}
                         
                         : n.credits  ? {color: page===n.id ? undefined : "rgba(212,168,67,.75)"}
                         : n.community ? {color: page===n.id ? undefined : "rgba(82,153,224,.85)"}
                         : {}}>
                    <span className="sb-ico">{n.admin ? "🔧" : n.district ? "🏢" : n.ico}</span>
                    <span>{n.label}</span>
                    {n.admin && <span style={{marginLeft:"auto",fontSize:9,padding:"1px 5px",background:"rgba(212,168,67,.2)",color:"var(--gold)",borderRadius:4,fontWeight:700,letterSpacing:1}}>ADMIN</span>}
                    {n.district && <span style={{marginLeft:"auto",fontSize:9,padding:"1px 5px",background:"rgba(66,165,245,.2)",color:"#42a5f5",borderRadius:4,fontWeight:700,letterSpacing:1}}>DIST</span>}
                    {n.id==="messages"   && unreadCount>0    && <span className="sb-badge" style={{background:"var(--red)",color:"#fff"}}>{unreadCount}</span>}
                    {n.id==="requests"   && pendingReqCount>0 && <span className="sb-badge" style={{background:"var(--red)",color:"#fff"}}>{pendingReqCount}</span>}
                    {n.id==="inventory"  && items.length>0 && <span className="sb-badge">{activeSchool ? schoolItems.length : items.length}</span>}
                    {n.id==="marketplace"&& listed>0       && <span className="sb-badge">{listed}</span>}
                    {n.id==="productions"&& <span className="sb-badge" style={{background:"rgba(212,168,67,.2)",color:"var(--gold)"}}>🎭</span>}
                    
                    {n.id==="points"    && creditBalance>0 && <span className="sb-badge" style={{background:"rgba(212,168,67,.2)",color:"var(--gold)"}}>{creditBalance}</span>}
                  </div>
                ))}
              </nav>

              <div className="sb-foot">
                <div style={{display:"flex",gap:5,flexDirection:"column"}}>
                  {(plan==="pro"||plan==="district"||isAdmin)&&!isDemo&&(
                    <a href="/app.html" target="_blank" rel="noreferrer" className="btn btn-o btn-sm btn-full"
                      style={{color:"var(--gold)",borderColor:"rgba(212,168,67,.3)",fontSize:12,padding:"7px 12px",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      📱 Mobile App
                    </a>
                  )}
                  {(plan==="pro"||plan==="district"||isAdmin)&&!isDemo&&(
                    <a href="/help.html" target="_blank" rel="noreferrer" className="btn btn-o btn-sm btn-full"
                      style={{color:"rgba(255,255,255,.6)",borderColor:"rgba(255,255,255,.12)",fontSize:12,padding:"7px 12px",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      ❓ Help & Tutorials
                    </a>
                  )}
                  {plan==="free"&&!isAdmin&&(
                    <button className="btn btn-sm btn-full" style={{background:"linear-gradient(135deg,var(--gold),var(--amber))",border:"none",color:"#1a0f00",fontSize:13,fontWeight:800,padding:"9px 12px",letterSpacing:.2}} onClick={()=>nav("settings")}>
                      ⭐ Upgrade Plan
                    </button>
                  )}
                  <button className="btn btn-o btn-sm btn-full" style={{color:"rgba(255,255,255,.85)",borderColor:"rgba(255,255,255,.28)",fontSize:13,padding:"8px 12px"}} onClick={()=>nav("settings")}>
                    <span style={{width:13,height:13,display:"flex"}}>{Ic.settings}</span>Settings
                  </button>
                  {/* Subscribe button — shown for temp_pro users who haven't paid yet, not in demo */}
                  {org?.temp_pro && !org?.stripe_subscription_id && !isAdmin && !isDemoMode() && (
                    <a href={stripeLink(STRIPE_LINKS.pro?.monthly, user?.id, user?.email)}
                      target="_blank" rel="noreferrer"
                      style={{display:"flex",alignItems:"center",justifyContent:"center",
                        gap:7,padding:"9px 12px",borderRadius:8,fontSize:13,fontWeight:700,
                        background:"linear-gradient(135deg,var(--gold),#a37f2c)",color:"#1a0f00",
                        textDecoration:"none",border:"none",cursor:"pointer",marginBottom:0}}>
                      ⭐ Subscribe — $15/mo
                    </a>
                  )}
                  <button className="btn btn-sm btn-full" style={{background:"rgba(139,26,42,.22)",border:"1px solid rgba(139,26,42,.38)",color:"rgba(255,255,255,.85)",fontSize:13,padding:"8px 12px"}} onClick={signOut}>
                    Sign Out
                  </button>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:10}}>
                  <span onClick={()=>setLegalPage("terms")} style={{fontSize:10,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Terms</span>
                  <span style={{color:"rgba(255,255,255,.15)"}}>·</span>
                  <span onClick={()=>setLegalPage("privacy")} style={{fontSize:10,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Privacy</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {mob && !isDesk && <div className="mob-overlay" onClick={()=>setMob(false)}/>}

        <div className="main">
          <div style={{height:3,background:"linear-gradient(90deg,var(--gold),var(--amber),var(--gilt) 55%,transparent 82%)",flexShrink:0}}/>
          <div className="topbar">
            <button className="menu-btn" onClick={()=>setMob(!mob)}>{mob?Ic.x:Ic.menu}</button>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <LogoMarkLight size={32}/>
              <span className="topbar-title">{TITLES[page]}</span>
            </div>
          </div>
          <div className="scroll-area" onClick={()=>mob&&setMob(false)}>
            {/* Post-payment success banner */}
            {paymentSuccessMsg&&(
              <div style={{background:"linear-gradient(135deg,rgba(76,175,80,.15),rgba(76,175,80,.08))",
                border:"1px solid rgba(76,175,80,.35)",borderRadius:10,margin:"16px 24px 0",
                padding:"12px 18px",display:"flex",gap:12,alignItems:"center"}}>
                <span style={{fontSize:20}}>🎉</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#4caf50"}}>
                    Subscription active!
                  </div>
                  <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>
                    {paymentSuccessMsg.replace("🎉 ","")}
                  </div>
                </div>
                <button onClick={()=>setPaymentSuccessMsg("")}
                  style={{background:"none",border:"none",color:"var(--muted)",
                    cursor:"pointer",fontSize:18,padding:"0 4px",lineHeight:1}}>✕</button>
              </div>
            )}
            {!loaded
              ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:18,color:"var(--faint)"}}>
                  <div style={{fontSize:52}}>🎭</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"var(--muted)"}}>Loading your collection…</div>
                  <div style={{width:32,height:32,border:"2.5px solid var(--linen)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
                </div>
              : <div className="fin">
                  {page==="requests"    && <Requests userId={user?.id} orgName={org?.name} orgEmail={org?.email}
                    onUnreadChange={async()=>{
                      const{count}=await SB.from("rental_requests").select("id",{count:"exact",head:true}).eq("owner_id",user?.id).eq("status","pending");
                      setPendingReqCount(count||0);
                    }}/>}
                  {page==="messages"    && <Messages userId={user?.id} orgName={org?.name} openConvId={openConvId} onClearOpenConv={()=>setOpenConvId(null)} onUnreadChange={async()=>{ const{count}=await SB.from("messages").select("id",{count:"exact",head:true}).eq("read",false).neq("sender_id",user?.id); setUnreadCount(count||0); }}/>}
                  {page==="dashboard"   && <Dashboard   items={items} org={org} plan={plan} pointBalance={creditBalance} goInventory={(cat)=>{ if(cat) setDeepLinkCategory(cat); nav("inventory"); }} goMarketplace={()=>nav("marketplace")} goCommunity={()=>nav("community")} goProfile={()=>nav("profile")} goPoints={()=>nav("points")}/>}
                  {page==="inventory"   && !activeSchool && <Inventory   items={items} onAdd={add} onEdit={edit} onDelete={del} userId={user?.id} plan={plan} memberRole={memberRole} org={org} enableLoans={!memberRole} onImported={(data)=>setItems(data)} deepLinkLocationId={deepLinkLocation} onDeepLinkConsumed={()=>setDeepLinkLocation(null)} deepLinkCategory={deepLinkCategory} onDeepLinkCategoryConsumed={()=>setDeepLinkCategory(null)}/>}
                  {page==="inventory"   && activeSchool && (
                    schoolLoading
                      ? <div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>Loading {activeSchool.name}…</div>
                      : <Inventory items={schoolItems}
                          onAdd={async(item)=>{ const row={...item,org_id:activeSchool.id}; const{data}=await SB.from("items").insert(row).select().single(); if(data) setSchoolItems(p=>[data,...p]); }}
                          onEdit={async(item)=>{ const pl={...item}; delete pl.id; delete pl.org_id; delete pl.added; const{data,error}=await SB.from("items").update(pl).eq("id",item.id).select().single(); if(error){alert("Could not update item: "+error.message);console.error(error);}else if(data) setSchoolItems(p=>p.map(x=>x.id===item.id?data:x)); }}
                          onDelete={async(id)=>{ await SB.from("items").delete().eq("id",id); setSchoolItems(p=>p.filter(x=>x.id!==id)); }}
                          userId={activeSchool.id} plan={plan} org={activeSchool}
                          schoolName={activeSchool.name}
                          headerNote={<div style={{padding:"8px 12px",background:"rgba(66,165,245,.1)",border:"1px solid rgba(66,165,245,.2)",borderRadius:7,marginBottom:12,fontSize:12,color:"#42a5f5"}}>🏫 Editing inventory for <strong>{activeSchool.name}</strong></div>}
                        />
                  )}
                  {page==="marketplace" && <MarketplaceGate items={items} org={org} setOrg={setOrg} plan={plan} userId={user?.id} activeSchool={activeSchool} allSchoolsMode={plan==="district"} onEdit={edit} onDelete={del}/>}
                  {page==="productions" && <Productions userId={user?.id} allItems={items} org={org} onNavigateTo={nav}/>}
                  {page==="reports"     && <Reports     items={activeSchool ? schoolItems : items} plan={plan} org={org} userId={user?.id} userEmail={user?.email}/>}
                  {page==="funding"     && <FundingPage userId={user?.id} org={org} plan={plan}/>}
                  {page==="prop28"      && <Prop28Page  userId={user?.id} org={org} onNav={nav}/>}
                  {page==="profile"     && <OrgProfilePage userId={user?.id} org={org} setOrg={saveOrg} plan={plan} items={items}/>}
              {page==="settings"    && <Settings    org={org} setOrg={saveOrg} onSeed={seed} user={user} userId={user?.id} items={items} setItems={setItems} plan={plan} userEmail={user?.email} setPlan={setPlan} memberRole={memberRole}/>}
                  {page==="district"    && plan==="district" && <DistrictDashboard user={user} plan={plan} onSwitchSchool={switchSchool}/>}
                  {page==="facschools"  && facDistrict && (
                    <div style={{padding:"32px 36px 56px"}}>
                      <h1 style={{fontFamily:"var(--serif)",fontSize:32,marginBottom:4}}>District Schools</h1>
                      <p style={{color:"var(--muted)",fontSize:14,marginBottom:24}}>{facDistrict.name} — you can view and edit inventory for any school below.</p>
                      {facSchools.length===0 ? (
                        <div style={{color:"var(--muted)",fontSize:14}}>No schools in this district yet.</div>
                      ) : (
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                          {facSchools.map(sc=>(
                            <div key={sc.id} className="card card-p" style={{display:"flex",flexDirection:"column",gap:8}}>
                              <div style={{fontWeight:700,fontSize:15}}>{sc.name||"(unnamed school)"}</div>
                              <div style={{fontSize:12,color:"var(--muted)"}}>{getVertical(sc.vertical).icon} {getVertical(sc.vertical).label}{sc.location?" · "+sc.location:""}</div>
                              <button className="btn btn-g btn-sm" style={{marginTop:4}} onClick={()=>switchSchool(sc)}>Open inventory →</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {page==="community"   && <CommunityGate userId={user?.id} org={org} setOrg={setOrg} plan={plan}/>}
                  {page==="labels"     && <LabelsPage org={org} userId={user?.id} items={items} isAdmin={isAdmin}/>}
                  {page==="points"     && (plan!=="free"||isAdmin) && <CreditsPage userId={user?.id} org={org} plan={plan} balance={creditBalance} onBalanceChange={setCreditBalance}/>}
                  {page==="points"     && plan==="free"&&!isAdmin && <div style={{padding:40,textAlign:"center"}}><div style={{fontSize:44,marginBottom:14}}>🪙</div><h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:10}}>{getPointsName(org?.vertical)} is a Pro Feature</h2><p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 24px",lineHeight:1.6}}>Earn credits by lending and renting your items. Spend them when you borrow. Upgrade to unlock.</p><UpgradePlans compact={true} userId={user?.id} userEmail={user?.email}/></div>}


                  {page==="admin"       && isAdmin && <AdminHub currentUser={user} org={org}/>}
                </div>
            }
          </div>
        </div>
      </div>

      {/* ── Legal Modals ── */}
      {legalPage==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegalPage(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legalPage==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegalPage(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {user && <FeedbackWidget userId={user.id} orgName={org?.name||""} isLeadingPlayer={org?.is_leading_player||false}/>}
      {user && !isDemo && <AIHelpBubble user={user} />}
      {/* ── Onboarding overlay ─ shown once to new users ── */}
      {user && onboardingStep !== null && onboardingStep < 4 && (
        (onboardingStep === 0 ||
         onboardingStep === 1 ||
         (onboardingStep === 2 && items.length >= 1) ||
         (onboardingStep === 3 && items.length >= 5)
        ) ? (
          <OnboardingOverlay
            step={onboardingStep}
            org={org}
            userId={user?.id}
            items={items}
            onUpdate={(updated) => { setOrg(p=>({...p,...updated})); setOnboardingStep(updated.onboarding_step ?? 4); }}
            onNav={nav}
          />
        ) : null
      )}
    </>
  );
}
// ═══ FUNDING PAGE ════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PROP 28 PAGE — view legacy data + one-click migration to Funding Tracker
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING OVERLAY SYSTEM
// Tracks state in orgs.onboarding_step (0=new, 1=welcomed, 2=profiled,
// 3=first-item celebrated, 4=participation prompted / complete)
// ══════════════════════════════════════════════════════════════════════════════

function OnboardingOverlay({ step, org, userId, items, onUpdate, onNav }) {
  const [saving, setSaving] = useState(false);

  // Profile form state (step 2)
  const [pf, setPf] = useState({
    name:         org?.name           || "",
    director_name:org?.director_name  || "",
    phone:        org?.phone          || "",
    type:         org?.type           || "",
    location:     org?.location       || "",
    bio:          org?.bio            || "",
  });

  // Participation toggles (step 4)
  const [joinCommunity,  setJoinCommunity]  = useState(false);
  const [joinExchange,   setJoinExchange]   = useState(false);

  const advance = async (nextStep, orgUpdates = {}) => {
    setSaving(true);
    const update = { onboarding_step: nextStep, ...orgUpdates };
    await SB.from("orgs").update(update).eq("id", userId);
    onUpdate({ ...org, ...update });
    setSaving(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    const update = {
      onboarding_step: 2,
      name:          pf.name.trim()          || org.name,
      director_name: pf.director_name.trim() || "",
      director_title:"Theatre Director",
      phone:         pf.phone.trim()         || "",
      type:          pf.type                 || org.type,
      location:      pf.location.trim()      || org.location,
      bio:           pf.bio.trim()           || org.bio,
    };
    await SB.from("orgs").update(update).eq("id", userId);
    onUpdate({ ...org, ...update });
    setSaving(false);
  };

  const saveParticipation = async () => {
    setSaving(true);
    const update = {
      onboarding_step:    4,
      community_enabled:  joinCommunity,
      marketplace_enabled: joinExchange,
    };
    await SB.from("orgs").update(update).eq("id", userId);
    onUpdate({ ...org, ...update });
    setSaving(false);
  };

  // Overlay shell styles
  const ov = {
    position:"fixed", inset:0, background:"rgba(13,11,17,.88)",
    zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center",
    padding:20, animation:"fi .2s ease",
  };
  const box = {
    background:"var(--cream,#fdf6ec)", borderRadius:16, width:"100%",
    maxWidth:520, maxHeight:"92vh", overflow:"auto",
    boxShadow:"0 24px 80px rgba(0,0,0,.6)", animation:"su .25s ease",
  };
  const hdr = {
    padding:"28px 32px 0", textAlign:"center",
  };
  const bod = { padding:"20px 32px 28px" };
  const btn = (primary) => ({
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    gap:6, padding:"11px 24px", borderRadius:8, fontFamily:"inherit",
    fontSize:14, fontWeight:700, cursor:saving?"not-allowed":"pointer",
    opacity:saving?0.6:1, border:"none", transition:"all .15s",
    background: primary ? "linear-gradient(135deg,var(--gold,#d4a843),#a37f2c)" : "transparent",
    color: primary ? "#1a0f00" : "var(--muted,#9b93a8)",
    ...(primary ? {} : {border:"1px solid var(--border,#282333)"}),
  });
  const inp = {
    background:"rgba(255,255,255,.06)", border:"1px solid var(--border,#282333)",
    borderRadius:7, padding:"9px 12px", color:"var(--ink,#ede8df)",
    fontSize:13, fontFamily:"inherit", outline:"none", width:"100%",
    boxSizing:"border-box",
  };
  const lbl = {
    fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1,
    color:"var(--muted,#9b93a8)", display:"block", marginBottom:4,
  };

  // ── STEP 0 — Welcome ──────────────────────────────────────────────────────
  if (step === 0) return (
    <div style={ov}>
      <div style={box}>
        <div style={{...hdr, paddingTop:36}}>
          <div style={{fontSize:52, marginBottom:12}}>🎭</div>
          <h2 style={{fontFamily:"'Playfair Display',serif", fontSize:26, marginBottom:8, color:"var(--ink,#1a0f00)"}}>
            Welcome to Theatre4u™
          </h2>
          <p style={{fontSize:14, color:"var(--muted,#685f76)", lineHeight:1.7, marginBottom:4}}>
            Your backstage command center is ready. Let's get your inventory started — pick how you'd like to begin:
          </p>
        </div>
        <div style={bod}>
          <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:20}}>
            {[
              ["📝", "Add items one by one",    "Start with a few key pieces — costumes, props, lights.",    "inventory"],
              ["📥", "Import from a spreadsheet","Already have a list? Upload a CSV and we'll map the columns.","inventory-csv"],
              ["🎪", "Load sample data",         "See how Theatre4u looks with a full inventory loaded in.",   "sample"],
            ].map(([ico, title, desc, action]) => (
              <button key={action} onClick={async () => {
                await advance(1);
                if (action === "inventory")     onNav("inventory");
                if (action === "inventory-csv") onNav("inventory-csv");
                if (action === "sample")        onNav("sample");
              }} style={{
                display:"flex", alignItems:"flex-start", gap:14, padding:"14px 16px",
                background:"rgba(212,168,67,.08)", border:"1.5px solid rgba(212,168,67,.25)",
                borderRadius:10, cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                transition:"all .15s",
              }}>
                <span style={{fontSize:26, flexShrink:0}}>{ico}</span>
                <div>
                  <div style={{fontWeight:700, fontSize:14, color:"var(--ink,#1a0f00)", marginBottom:3}}>{title}</div>
                  <div style={{fontSize:12, color:"var(--muted,#685f76)", lineHeight:1.5}}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{textAlign:"center"}}>
            <button style={btn(false)} onClick={() => advance(1)}>Skip for now</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 1 — Profile prompt ───────────────────────────────────────────────
  if (step === 1) return (
    <div style={ov}>
      <div style={box}>
        <div style={hdr}>
          <div style={{fontSize:40, marginBottom:10}}>🏫</div>
          <h2 style={{fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:6, color:"var(--ink,#1a0f00)"}}>
            Tell us about your program
          </h2>
          <p style={{fontSize:13, color:"var(--muted,#685f76)", lineHeight:1.6, marginBottom:4}}>
            This helps other programs find you in the community and makes your listings more trustworthy. You can always update this in Profile.
          </p>
        </div>
        <div style={bod}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={lbl}>Program / School Name *</label>
              <input style={inp} value={pf.name} onChange={e=>setPf(p=>({...p,name:e.target.value}))}
                placeholder="Lincoln High Drama · Valley Rep · etc." autoFocus/>
            </div>
            <div>
              <label style={lbl}>Your Name *</label>
              <input style={inp} value={pf.director_name} onChange={e=>setPf(p=>({...p,director_name:e.target.value}))}
                placeholder="Jane Smith"/>
            </div>
            <div>
              <label style={lbl}>Your Phone <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
              <input style={inp} value={pf.phone} onChange={e=>setPf(p=>({...p,phone:e.target.value}))}
                placeholder="(555) 123-4567" type="tel"/>
            </div>
            <div>
              <label style={lbl}>Program Type</label>
              <select style={{...inp, cursor:"pointer"}} value={pf.type} onChange={e=>setPf(p=>({...p,type:e.target.value}))}>
                <option value="">Select…</option>
                {["School","District","Community Theatre","College","Professional","Other"].map(t=>(
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>City, State</label>
              <input style={inp} value={pf.location} onChange={e=>setPf(p=>({...p,location:e.target.value}))}
                placeholder="Portland, OR"/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={lbl}>About your program <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
              <textarea style={{...inp, minHeight:64, resize:"vertical"}} value={pf.bio}
                onChange={e=>setPf(p=>({...p,bio:e.target.value}))}
                placeholder="A line or two about what your program does, what shows you produce…"/>
            </div>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
            <button style={btn(false)} onClick={() => advance(2)}>Skip for now</button>
            <button style={btn(true)} disabled={saving || !pf.name.trim()} onClick={saveProfile}>
              {saving ? "Saving…" : "Save Profile →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 2 — First item celebration ──────────────────────────────────────
  if (step === 2 && items.length >= 1) return (
    <div style={ov}>
      <div style={box}>
        <div style={{...hdr, paddingTop:36}}>
          <div style={{fontSize:52, marginBottom:10}}>🎉</div>
          <h2 style={{fontFamily:"'Playfair Display',serif", fontSize:24, marginBottom:8, color:"var(--ink,#1a0f00)"}}>
            Your inventory is live!
          </h2>
          <p style={{fontSize:14, color:"var(--muted,#685f76)", lineHeight:1.7}}>
            {org?.name ? (org.name+" now has") : "You now have"} {items.length} item{items.length!==1?"s":""} in Theatre4u™. Here's what to do next:
          </p>
        </div>
        <div style={bod}>
          <div style={{display:"flex", flexDirection:"column", gap:8, marginBottom:22}}>
            {[
              ["📦", "Keep adding items",       "The more you catalog, the more useful it becomes — especially before strike."],
              ["🔖", "Print QR labels",          "Every item gets a scannable code. Stick one on the bin and you'll always know what's inside."],
              ["🏪", "Explore Backstage Exchange","Browse what nearby programs have available for rent, sale, or loan."],
            ].map(([ico, title, desc]) => (
              <div key={title} style={{display:"flex", gap:12, padding:"10px 12px",
                background:"rgba(212,168,67,.06)", borderRadius:8,
                border:"1px solid rgba(212,168,67,.18)"}}>
                <span style={{fontSize:22, flexShrink:0}}>{ico}</span>
                <div>
                  <div style={{fontWeight:700, fontSize:13, color:"var(--ink,#1a0f00)", marginBottom:2}}>{title}</div>
                  <div style={{fontSize:12, color:"var(--muted,#685f76)", lineHeight:1.5}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button style={{...btn(true), width:"100%"}} disabled={saving}
            onClick={() => advance(3)}>
            {saving ? "…" : "Got it — let's go!"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP 3 — Participation prompt (5+ items) ──────────────────────────────
  if (step === 3 && items.length >= 5) return (
    <div style={ov}>
      <div style={box}>
        <div style={hdr}>
          <div style={{fontSize:44, marginBottom:10}}>🎪</div>
          <h2 style={{fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:6, color:"var(--ink,#1a0f00)"}}>
            Want to connect with other theatre programs?
          </h2>
          <p style={{fontSize:13, color:"var(--muted,#685f76)", lineHeight:1.65, marginBottom:0}}>
            Theatre4u™ has two optional community features. Both are completely opt-in — nothing is shared until you say so.
          </p>
        </div>
        <div style={bod}>
          {[
            {
              key:  "community",
              ico:  "🎭",
              title:"Community Board",
              desc: "Post your upcoming shows, share audition notices, and see what other programs are up to nearby. Your program name and city appear on posts you make. Your inventory stays private.",
              val:  joinCommunity,
              set:  setJoinCommunity,
            },
            {
              key:  "exchange",
              ico:  "🏪",
              title:"Backstage Exchange",
              desc: "Browse items other programs are renting, selling, or loaning. List your own items to earn revenue or Stage Points. You control exactly which items appear — everything else stays invisible.",
              val:  joinExchange,
              set:  setJoinExchange,
            },
          ].map(opt => (
            <div key={opt.key} style={{
              padding:"14px 16px", marginBottom:10,
              background: opt.val ? "rgba(212,168,67,.10)" : "rgba(255,255,255,.03)",
              border: `1.5px solid ${opt.val ? "rgba(212,168,67,.4)" : "var(--border,#282333)"}`,
              borderRadius:10, transition:"all .2s",
            }}>
              <div style={{display:"flex", alignItems:"flex-start", gap:12}}>
                <span style={{fontSize:26, flexShrink:0}}>{opt.ico}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5}}>
                    <div style={{fontWeight:700, fontSize:14, color:"var(--ink,#1a0f00)"}}>{opt.title}</div>
                    <button onClick={()=>opt.set(!opt.val)} style={{
                      width:44, height:24, borderRadius:12, border:"none", cursor:"pointer",
                      background: opt.val ? "var(--gold,#d4a843)" : "var(--border,#282333)",
                      position:"relative", flexShrink:0, transition:"background .2s",
                    }}>
                      <span style={{
                        position:"absolute", top:3, left: opt.val ? 22 : 2,
                        width:18, height:18, borderRadius:"50%",
                        background:"#fff", transition:"left .2s",
                        display:"block",
                      }}/>
                    </button>
                  </div>
                  <div style={{fontSize:12, color:"var(--muted,#685f76)", lineHeight:1.55}}>{opt.desc}</div>
                </div>
              </div>
            </div>
          ))}
          <div style={{fontSize:11, color:"var(--muted,#685f76)", lineHeight:1.6, marginBottom:16,
            padding:"8px 10px", background:"rgba(255,255,255,.03)", borderRadius:7,
            border:"1px solid var(--border,#282333)"}}>
            You can join or leave either feature at any time from Settings.
          </div>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
            <button style={btn(false)} onClick={() => advance(4)}>Maybe later</button>
            <button style={btn(true)} disabled={saving} onClick={saveParticipation}>
              {saving ? "Saving…" : "Save & Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}


// ── STORAGE LOCATIONS (LocationsPanel + RoomMap/StorageRack) → core/locations.jsx ──
import { LocationsPanel } from "./core/locations.jsx";



// ── EXTERNAL LOANS (Borrowed & Lent) → core/external-loans.jsx ──────────────────



// ══════════════════════════════════════════════════════════════════════════════
// PROGRAM IMPACT REPORT
// Print-ready: how funding was used — for principals, boards, districts
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM USAGE REPORT
// How the program uses Theatre4u — for principals and superintendents
// ══════════════════════════════════════════════════════════════════════════════

