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
import { Pager, Modal, FbShareBtn, HeroImg, CatCard, CatThumb, LegalModal, ErrorBoundary } from "./core/ui.jsx";

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

// ── Logo Components → moved to core/ui.jsx (LogoMarkDark, LogoMarkLight) ──────

// ── QR Code generator → moved to core/qr.js ──────────────────────────────────
import { QR } from "./core/qr.js";

// ── APP ROOT (main app shell) + makeSamples → core/app-root.jsx ──────────────────
import { AppRoot } from "./core/app-root.jsx";


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


// ── BETA FEEDBACK (FeedbackWidget) → moved to core/feedback.jsx ──────────────

// ── ErrorBoundary → core/ui.jsx · DEMO MODE (DemoApp) → core/demo.jsx ─────────────
import { DemoApp } from "./core/demo.jsx";


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

// ═══ FUNDING PAGE ════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PROP 28 PAGE — view legacy data + one-click migration to Funding Tracker
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING OVERLAY SYSTEM
// Tracks state in orgs.onboarding_step (0=new, 1=welcomed, 2=profiled,
// 3=first-item celebrated, 4=participation prompted / complete)
// ══════════════════════════════════════════════════════════════════════════════

// ── ONBOARDING OVERLAY → core/onboarding.jsx ─────────────────────────────────────
import { OnboardingOverlay } from "./core/onboarding.jsx";


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

