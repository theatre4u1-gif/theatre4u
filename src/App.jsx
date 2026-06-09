// Theatre4u — built 2026-03-26 17:02
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SB, activateDemoStore, callEdgeFn } from "./core/supabase.js";
import { getVertical, getCats, getCatGfx, VERTICALS_LIST, getExchangeName } from "./lib/verticals.js";
import { US_STATES, STATE_NAMES, zipToCoords, milesBetween, geocodeLocation } from "./lib/geo.js";
import { BG, usp } from "./lib/backgrounds.js";
import { CSS } from "./core/styles.js";
import { EM } from "./core/messages.js";
import { TERMS_CONTENT, PRIVACY_CONTENT } from "./core/legal.js";
import { authErrKey, getRefCode, isDemoMode } from "./core/helpers.js";
import { AuthOverlay } from "./core/auth.jsx";
import { STRIPE_LINKS, stripeLink, PLANS_DEF, UPGRADE_PLANS } from "./core/plans.js";
import { UpgradePrompt, UpgradePlans } from "./core/billing.jsx";
import { CAT_GFX, CATS, CAT, CAT_MAP, CONDS, SIZES, AVAIL, MKT } from "./core/inventory.js";
import { AdminHub, DistrictDashboard } from "./core/admin.jsx";
import { LabelsPage } from "./core/labels.jsx";
import { OrgProfilePage } from "./core/profile.jsx";
import { Prop28Page } from "./core/prop28.jsx";
import { Messages } from "./core/chat.jsx";
import { Reports } from "./core/reports.jsx";
import { FundingPage } from "./core/funding.jsx";

// ── Custom inventory categories (ADD-TO model) ──────────────────────────────
// Loaded per-org at runtime; these SUPPLEMENT the built-in vertical categories.
let CUSTOM_CATS = [];
function setCustomCats(rows){ CUSTOM_CATS = Array.isArray(rows) ? rows.map(r=>({id:r.id,vertical:r.vertical,label:r.label})) : []; }
function customCatsFor(vertical){ return CUSTOM_CATS.filter(c=>c.vertical===(vertical||"theatre")).map(c=>({id:c.id,label:c.label,icon:"📦",color:"#4a2e1a",custom:true})); }
function getCatsMerged(vertical){ return [...getCats(vertical), ...customCatsFor(vertical)]; }

// ── Point earn rates by category (mirrors point_earn_rates DB table) ──────────
const POINT_EARN_RATES = {
  lighting: 50, sound: 50, sets: 40, costumes: 25, props: 20,
  furniture: 20, effects: 20, fabrics: 15, makeup: 15,
  scripts: 10, tools: 10, other: 15,
};
import { HOSTNAME, IS_THEATRE4U, IS_ARTSTRACKER, APP_NAME, APP_SUBTITLE, APP_EMAIL, APP_URL } from "./core/config.js";
import { Ic } from "./core/icons.jsx";
import { Pager, Modal, FbShareBtn, HeroImg, CatCard, CatThumb, LegalModal } from "./core/ui.jsx";

// ── Storage map constants (used by ItemForm and RoomMap/StorageRack) ──────────
const PIN_COLORS = ["#D4A843","#5299E0","#52C784","#D85A30","#9B6EBF","#1D9E75","#E24B4A","#BA7517","#2B5BA8","#C2185B"];
const ROW_LABELS = { alpha:["A","B","C","D","E","F","G","H"], num:["1","2","3","4","5","6","7","8"], shelf:["Shelf 1","Shelf 2","Shelf 3","Shelf 4","Shelf 5","Shelf 6","Shelf 7","Shelf 8"], custom:["Top","Upper","Middle","Lower","Bottom"] };
const COL_LABELS = { num:["1","2","3","4","5","6"], alpha:["A","B","C","D","E","F"], none:["","","","","",""] };
// Rewards program name by vertical: theatre = "Stage Points", others = "Encore Points".
const getPointsName = (vertical) => (!vertical || vertical === "theatre") ? "Stage Points" : "Encore Points";

// ── Supabase ──────────────────────────────────────────────────────────────────

// ── Domain Detection ──────────────────────────────────────────────────────────
// Detects which site the user came from so we can show the right branding.
// localhost is treated as Theatre4u so local development works unchanged.
// ── End Domain Detection ──────────────────────────────────────────────────────

// ── Brand Assets ── logo + favicon, switched by domain (files live in src/public/)
// In-app square logo mark shown beside the wordmark in the sidebar and topbar.
const LOGO_ICON  = IS_THEATRE4U ? "/favicon-theatre4u.svg"        : "/icon-192-artstracker.png";
const FAVICON    = IS_THEATRE4U ? "/favicon-theatre4u.svg"        : "/favicon-artstracker.png";
const TOUCH_ICON = IS_THEATRE4U ? "/apple-touch-icon-theatre4u.png" : "/apple-touch-icon-artstracker.png";
const LOGO_FULL       = IS_THEATRE4U ? "/logo-theatre4u.svg"           : "/logo-artstracker.png";        // full lockup, shown over a spotlight pool on the landing hero
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


const uid  = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const fmt$ = n  => "$" + Number(n || 0).toFixed(2);

// ── Social sharing ─────────────────────────────────────────────────────────
// Uses Facebook's native share dialog — no API key, no approval, works for everyone.
// The user shares to their own timeline, page, or any group they're in.
function fbShare(url, quote="") {
  const params = new URLSearchParams({ u: url, ...(quote ? { quote } : {}) });
  window.open("https://www.facebook.com/sharer/sharer.php?" + params, "fb-share", "width=600,height=500,scrollbars=yes");
}
function itemShareUrl(item) {
  return "https://theatre4u.org/#/item/" + (item.display_id || item.id);
}
function itemShareText(item, orgName) {
  const cat = CAT_FALLBACK[item.category] || { icon:"🎭" };
  const price = item.mkt==="For Loan" ? "Free loan"
    : item.rent>0&&item.sale>0 ? "$"+item.rent+"/wk or $"+item.sale+" to buy"
    : item.rent>0 ? "$"+item.rent+"/wk to rent"
    : item.sale>0 ? "$"+item.sale+" to buy" : "";
  return cat.icon+" "+item.name+(orgName?" — from "+orgName:"")+(price?" · "+price:"")+
    "\n\nAvailable on the Backstage Exchange — free resource sharing for theatre programs everywhere."+
    "\n\ntheatre4u.org #Theatre #TheatreEducation #BackstageExchange #TheatreTeacher";
}
function postShareText(post, orgName) {
  const body = post.body ? "\n\n"+post.body.slice(0,200)+(post.body.length>200?"…":"") : "";
  return "🎭 "+post.title+(orgName?" — "+orgName:"")+body+
    "\n\nPosted on Theatre4u Community.\n\ntheatre4u.org #Theatre #TheatreEducation";
}
// Small reusable Facebook share button
// Fallback category map for use before CATS const is available
const CAT_FALLBACK = {
  costumes:"🥻",props:"🎭",sets:"🏗️",lighting:"💡",sound:"🔊",
  scripts:"📜",makeup:"💄",furniture:"🪑",fabrics:"🧵",tools:"🔧",effects:"✨",other:"📦"
};
const itemNum = n  => n != null ? "#" + String(n).padStart(4, "0") : "";
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

// Points: 1 point = $0.01 · 1,500 points = free Pro month · max balance 5,000
const POINTS_PER_DOLLAR   = 1;       // rental earn rate
const POINTS_FREE_MONTH   = 1500;    // points needed for a free month
const POINTS_MAX_BALANCE  = 5000;    // cap per org
const POINTS_EXPIRE_DAYS  = 365;     // points expire after 12 months
const PLATFORM_FEE_PCT    = 0.08;    // 8% platform fee on Exchange transactions
const POINTS_MIN_REDEEM   = 500;     // minimum points to redeem in one go

// Onboarding milestone points (one-time, idempotent via DB function)
const MILESTONE_POINTS = {
  welcome_bonus:    { pts: 25,  label: "Welcome Bonus" },
  profile_complete: { pts: 25,  label: "Profile Completed" },
  items_10:         { pts: 25,  label: "10 Items Added" },
  items_25_photos:  { pts: 50,  label: "25 Items with Photos" },
  first_listing:    { pts: 15,  label: "First Exchange Listing" },
  first_request:    { pts: 10,  label: "First Exchange Request" },
  team_invite:      { pts: 15,  label: "Team Member Invited" },
  referral_earn:    { pts: 50,  label: "Referral Bonus" },
};

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

// ── QR Code Generator (pure canvas, no dependencies) ─────────────────────────
// ── QR Code — generated client-side via esm.sh/qrcode ───────────────────────
let _qrMod = null;
async function _getQR() {
  if (_qrMod) return _qrMod;
  _qrMod = await import("https://esm.sh/qrcode@1.5.3");
  return _qrMod;
}
const QR = {
  // Returns a data URL (canvas-rendered, no network after first load)
  async toDataURL(text, size = 200) {
    try {
      const QRCode = await _getQR();
      return await QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch(e) {
      console.error("QR error:", e);
      return null;
    }
  },
  // Sync convenience — returns a promise, named for readable call sites
  src: null, // not used in new version
};

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

function resizeImg(file,maxW=560,q=0.78){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement("canvas");
        let w=img.width,h=img.height;
        if(w>maxW){h=Math.round((maxW/w)*h);w=maxW;}
        c.width=w;c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",q));
      };
      img.src=e.target.result;
    };
    r.readAsDataURL(file);
  });
}

// Upload a file to Supabase Storage and return the public URL
async function uploadPhoto(file, userId) {
  try {
    // Resize first to keep file sizes small
    const dataUrl = await resizeImg(file, 800, 0.82);
    // Convert base64 dataURL to a Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    // Unique filename: userId/timestamp.jpg
    const path = userId + "/" + Date.now() + ".jpg";
    const { error } = await SB.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = SB.storage.from("item-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch(e) { console.error("uploadPhoto failed:", e); return null; }
}




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


function ItemForm({item,onSave,onCancel,userId,marketplaceEnabled=false,vertical="theatre"}){
  const vConfig = getVertical(vertical);
  const vCATS   = [...vConfig.categories, ...customCatsFor(vertical)];
  const vCONDS  = vConfig.conditions;
  const vSIZES  = vConfig.sizes;
  const vAVAIL  = vConfig.availability;
  const vMKT    = vConfig.marketOptions;
  const defaultCat = vCATS[0]?.id || "costumes";
  const blank={name:"",category:defaultCat,condition:vCONDS[2]||"Good",size:vSIZES.includes("N/A")?"N/A":vSIZES[0],qty:1,location:"",notes:"",mkt:"Not Listed",rent:0,sale:0,loan_period:2,deposit:0,avail:"In Stock",img:null,tags:[],purchase_cost:"",purchase_date:"",purchase_vendor:"",funding_source_id:"",low_stock_threshold:0};
  const[f,setF]=useState(item||blank);
  const[ti,setTi]=useState("");
  const[upl,setUpl]=useState(false);
  const[svng,setSvng]=useState(false);
  const fr=useRef();
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  // Keep a ref always pointing at latest form state so the footer button works

  const showRent=f.mkt==="For Rent"||f.mkt==="Rent or Sale";
  const showSale=f.mkt==="For Sale"||f.mkt==="Rent or Sale";
  const showLoan=f.mkt==="For Loan";
  const handlePhoto=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    setUpl(true);
    const url = userId ? await uploadPhoto(file, userId) : await resizeImg(file);
    if(url) upd("img", url);
    if(!url){console.error("Photo upload failed"); alert(EM.photoTooLarge.title+"\n\n"+EM.photoTooLarge.body);}
    setUpl(false);
    if(fr.current)fr.current.value="";
  };
  const addTag=()=>{const t=ti.trim().toLowerCase();if(t&&!(f.tags||[]).includes(t))upd("tags",[...(f.tags||[]),t]);setTi("");};
  // Load active funding sources for the "charge to fund" dropdown
  const[fundSources,setFundSources]=useState([]);
  const[storLocs,setStorLocs]=useState([]);
  useEffect(()=>{
    if(!userId)return;
    SB.from("funding_sources").select("id,name,source_type").eq("org_id",userId).eq("is_active",true).order("name")
      .then(({data})=>{ if(data) setFundSources(data); });
    SB.from("storage_locations").select("id,name,code,location_type,map_pins,rack_rows,rack_cols,rack_row_style,rack_col_style").eq("org_id",userId).order("name")
      .then(({data})=>{ if(data) setStorLocs(data); });
  },[userId]);

  // Quick-add state — inline creation of new location or funding source
  const[qloc, setQloc] = useState(false);  // showing new-location mini-form
  const[qfund,setQfund]= useState(false);  // showing new-fund-source mini-form
  const[qlocName, setQlocName] = useState("");
  const[qlocCode, setQlocCode] = useState("");
  const[qfundName, setQfundName] = useState("");
  const[qfundType, setQfundType] = useState("grant");
  const[qsaving,  setQsaving]   = useState(false);

  const addLocation = async()=>{
    if(!qlocName.trim()||qsaving) return;
    setQsaving(true);
    const{data,error}=await SB.from("storage_locations").insert({
      org_id:userId, name:qlocName.trim(), code:qlocCode.trim()||null
    }).select("id,name,code").single();
    setQsaving(false);
    if(error){alert("Could not create location: "+error.message);return;}
    if(data){
      setStorLocs(p=>[...p,data]);
      upd("location_id",data.id);
      upd("location",data.name);
    }
    setQlocName("");setQlocCode("");setQloc(false);
  };

  const addFundSource = async()=>{
    if(!qfundName.trim()||qsaving) return;
    setQsaving(true);
    const{data,error}=await SB.from("funding_sources").insert({
      org_id:userId, name:qfundName.trim(), source_type:qfundType, is_active:true
    }).select("id,name,source_type").single();
    setQsaving(false);
    if(error){alert("Could not create funding source: "+error.message);return;}
    if(data){
      setFundSources(p=>[...p,data]);
      upd("funding_source_id",data.id);
    }
    setQfundName("");setQfund(false);
  };

  return(
    <div className="fg2">
      <div className="fg fu"><label className="fl">Item Name *</label><input className="fi" value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="e.g. Victorian Ball Gown" autoFocus/></div>
      <div className="fg"><label className="fl">Category</label><select className="fs" value={f.category} onChange={e=>upd("category",e.target.value)}>{vCATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
      <div className="fg"><label className="fl">Condition</label><select className="fs" value={f.condition} onChange={e=>upd("condition",e.target.value)}>{vCONDS.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"><label className="fl">Size</label><select className="fs" value={f.size} onChange={e=>upd("size",e.target.value)}>{vSIZES.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="0" step="1" placeholder="1" value={f.qty||""} onChange={e=>upd("qty",parseInt(e.target.value)||0)}/></div>
      {(vertical==="art"||vertical==="booster") && (
        <div className="fg"><label className="fl">Low-stock alert at <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10,color:"var(--muted)"}}>(0 = off)</span></label><input className="fi" type="number" min="0" step="1" placeholder="0" value={f.low_stock_threshold||""} onChange={e=>upd("low_stock_threshold",parseInt(e.target.value)||0)}/></div>
      )}
      <div className="fg"><label className="fl">Availability</label><select className="fs" value={f.avail} onChange={e=>upd("avail",e.target.value)}>{vAVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
      <div className="fg"><label className="fl">Location</label><input className="fi" value={f.location} onChange={e=>upd("location",e.target.value)} placeholder="e.g. Costume Closet A"/></div>
      <div className="fg fu">
        <label className="fl">Storage Location</label>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <select className="fs" style={{flex:1}} value={f.location_id||""} onChange={e=>{
            upd("location_id",e.target.value||null);
            upd("rack_slot",null);
            upd("pin_id",null);
            const loc=storLocs.find(l=>l.id===e.target.value);
            if(loc)upd("location",loc.name);
          }}>
            <option value="">— None —</option>
            {storLocs.map(l=>{
              const icon=l.location_type==="room"?"🗺️":l.location_type==="rack"?"🏗️":"📦";
              return <option key={l.id} value={l.id}>{icon} {l.name}{l.code?" ("+l.code+")":""}</option>;
            })}
          </select>
          <button type="button" className="btn btn-o btn-sm" style={{whiteSpace:"nowrap",flexShrink:0}}
            onClick={()=>{setQloc(v=>!v);setQfund(false);}}>+ New</button>
        </div>

        {/* ── Pin sub-picker for room maps ── */}
        {(()=>{
          const selLoc = storLocs.find(l=>l.id===f.location_id);
          if(!selLoc||selLoc.location_type!=="room") return null;
          const pins = selLoc.map_pins||[];
          if(pins.length===0) return <div style={{fontSize:11,color:"var(--muted)",marginTop:6,fontStyle:"italic"}}>No pins on this room map yet — add pins in Inventory → Locations tab.</div>;
          return (
            <div style={{marginTop:8}}>
              <label className="fl" style={{fontSize:10}}>Pin / spot in this room <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
              <select className="fs" value={f.pin_id||""} onChange={e=>upd("pin_id",e.target.value||null)}>
                <option value="">— No specific pin —</option>
                {pins.map((pin,i)=>(
                  <option key={pin.id} value={pin.id}>📍 {i+1}. {pin.name}{pin.notes?" — "+pin.notes:""}</option>
                ))}
              </select>
            </div>
          );
        })()}

        {/* ── Slot sub-picker for storage racks ── */}
        {(()=>{
          const selLoc = storLocs.find(l=>l.id===f.location_id);
          if(!selLoc||selLoc.location_type!=="rack") return null;
          const rows = selLoc.rack_rows||3;
          const cols = selLoc.rack_cols||4;
          const rowLabels = (ROW_LABELS[selLoc.rack_row_style]||ROW_LABELS.alpha);
          const colLabels = (COL_LABELS[selLoc.rack_col_style]||COL_LABELS.num);
          const slots = [];
          for(let i=0;i<rows;i++){
            for(let j=0;j<cols;j++){
              const key=`${rowLabels[i]||String(i+1)}-${j+1}`;
              const colLabel=colLabels[j]||"";
              slots.push({key, label:colLabel?`Row ${rowLabels[i]||i+1}, Slot ${colLabel}`:`Row ${rowLabels[i]||i+1}, Position ${j+1}`});
            }
          }
          return (
            <div style={{marginTop:8}}>
              <label className="fl" style={{fontSize:10}}>Rack slot <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
              <select className="fs" value={f.rack_slot||""} onChange={e=>upd("rack_slot",e.target.value||null)}>
                <option value="">— No specific slot —</option>
                {slots.map(s=>(
                  <option key={s.key} value={s.key}>🏗️ {s.label} ({s.key})</option>
                ))}
              </select>
            </div>
          );
        })()}
        {qloc&&(
          <div style={{marginTop:8,padding:"12px 14px",background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.25)",borderRadius:8}}>
            <div style={{fontWeight:700,fontSize:12,color:"var(--gold)",marginBottom:8}}>New Storage Location</div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input className="fi" style={{flex:1}} placeholder="Name (e.g. Costume Closet A)" value={qlocName}
                onChange={e=>setQlocName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addLocation()}/>
              <input className="fi" style={{width:80}} placeholder="Code" value={qlocCode}
                onChange={e=>setQlocCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addLocation()}/>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button type="button" className="btn btn-g btn-sm" onClick={addLocation}
                disabled={!qlocName.trim()||qsaving}>{qsaving?"Saving…":"Create & Select"}</button>
              <button type="button" className="btn btn-o btn-sm" onClick={()=>{setQloc(false);setQlocName("");setQlocCode("");}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="fg fu sdiv">
        <div className="slbl">📷 Photo</div>
        <div style={{display:"flex",gap:10}}>
          {f.img?<div className="ph-wrap"><img src={f.img} alt=""/><button className="ph-rm" onClick={()=>upd("img",null)}>×</button></div>
                :<label className="ph-add" style={{opacity:upl?.5:1}}>{Ic.cam}<span>{upl?"Uploading…":"Add Photo"}</span><input ref={fr} type="file" accept="image/*" hidden onChange={handlePhoto} disabled={upl}/></label>}
        </div>
      </div>
      <div className="fg fu">
        <div className="slbl">🏷 Tags</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{(f.tags||[]).map(t=><span key={t} className="tc" onClick={()=>upd("tags",f.tags.filter(x=>x!==t))}>#{t} ×</span>)}</div>
        <div style={{display:"flex",gap:7}}><input className="fi" style={{flex:1}} value={ti} onChange={e=>setTi(e.target.value)} placeholder="Add tag…" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag()}}}/><button className="btn btn-o btn-sm" onClick={addTag}>Add</button></div>
      </div>
      <div className="fg fu"><label className="fl">Notes</label><textarea className="ft" value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Production history, care instructions…"/></div>
      <div className="fg fu sdiv"><div className="slbl">🏪 Backstage Exchange</div></div>
      <div className="fg"><label className="fl">Listing Status</label><select className="fs" value={f.mkt} onChange={e=>upd("mkt",e.target.value)}>{MKT.map(s=><option key={s}>{s}</option>)}</select></div>
      {f.mkt!=="Not Listed"&&f.mkt!=="Private"&&!marketplaceEnabled&&(
        <div className="fg fu" style={{marginTop:-4}}>
          <div style={{background:"rgba(212,168,67,.1)",border:"1px solid rgba(212,168,67,.3)",borderRadius:7,padding:"9px 12px",fontSize:12,color:"var(--amber)",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}>
            <span style={{flexShrink:0}}>⚠️</span>
            <span>This item won't appear in Backstage Exchange until your program joins. Go to <strong>Backstage Exchange</strong> in the nav to opt in — it only takes one click.</span>
          </div>
        </div>
      )}
      <div className="fg"/>
      {showRent&&<div className="fg"><label className="fl">Rental / week ($)</label><input className="fi" type="number" min="0" step="any" placeholder="e.g. 25" value={f.rent||""} onChange={e=>upd("rent",parseFloat(e.target.value)||0)}/></div>}
      {showSale&&<div className="fg"><label className="fl">Sale Price ($)</label><input className="fi" type="number" min="0" step="any" placeholder="e.g. 50" value={f.sale||""} onChange={e=>upd("sale",parseFloat(e.target.value)||0)}/></div>}
      {showLoan&&<div className="fg"><label className="fl">Loan Period (weeks)</label><input className="fi" type="number" min="1" step="1" placeholder="e.g. 2" value={f.loan_period||""} onChange={e=>upd("loan_period",parseInt(e.target.value)||2)}/></div>}
      {showLoan&&<div className="fg"><label className="fl">Refundable Deposit ($)</label><input className="fi" type="number" min="0" step="any" placeholder="0 = free loan" value={f.deposit||""} onChange={e=>upd("deposit",parseFloat(e.target.value)||0)}/></div>}

      {/* Purchase & Funding Source — optional, links item to Funding Tracker */}
      <div className="fg fu sdiv">
        <div className="slbl">💰 Purchase & Funding</div>
      </div>
      <div className="fg">
        <label className="fl">Item Cost ($)</label>
        <input className="fi" type="number" min="0" step="any" placeholder="e.g. 49.99"
          value={f.purchase_cost||""} onChange={e=>upd("purchase_cost",e.target.value)}/>
      </div>
      <div className="fg">
        <label className="fl">Purchase Date</label>
        <input className="fi" type="date" value={f.purchase_date||""}
          onChange={e=>upd("purchase_date",e.target.value)}/>
      </div>
      <div className="fg fu">
        <label className="fl">Vendor / Supplier</label>
        <input className="fi" placeholder="e.g. Goodwill, Amazon, Drama Bookshop"
          value={f.purchase_vendor||""} onChange={e=>upd("purchase_vendor",e.target.value)}/>
      </div>
      <div className="fg fu">
        <label className="fl">Charge to Funding Source</label>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <select className="fs" style={{flex:1}} value={f.funding_source_id||""} onChange={e=>upd("funding_source_id",e.target.value)}>
            <option value="">— None —</option>
            {fundSources.map(s=><option key={s.id} value={s.id}>{s.name}{s.source_type?" ("+s.source_type+")":""}</option>)}
          </select>
          <button type="button" className="btn btn-o btn-sm" style={{whiteSpace:"nowrap",flexShrink:0}}
            onClick={()=>{setQfund(v=>!v);setQloc(false);}}>+ New</button>
        </div>
        {f.funding_source_id&&f.purchase_cost&&parseFloat(f.purchase_cost)>0&&(
          <div style={{fontSize:11.5,color:"var(--amber)",marginTop:5,lineHeight:1.5}}>
            ✓ A ${parseFloat(f.purchase_cost||0).toFixed(2)} expenditure will be added to this fund automatically.
          </div>
        )}
        {f.funding_source_id&&(!f.purchase_cost||parseFloat(f.purchase_cost)===0)&&(
          <div style={{fontSize:11.5,color:"var(--t3)",marginTop:5}}>
            Enter an item cost above to log an expenditure to this fund.
          </div>
        )}
        {fundSources.length===0&&!qfund&&(
          <div style={{fontSize:12,color:"var(--t3)",marginTop:4,fontStyle:"italic"}}>
            No active funding sources yet — click "+ New" to create one.
          </div>
        )}
        {qfund&&(
          <div style={{marginTop:8,padding:"12px 14px",background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.25)",borderRadius:8}}>
            <div style={{fontWeight:700,fontSize:12,color:"var(--gold)",marginBottom:8}}>New Funding Source</div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input className="fi" style={{flex:1}} placeholder="Name (e.g. Prop 28, Booster Fund)"
                value={qfundName} onChange={e=>setQfundName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addFundSource()}/>
              <select className="fs" style={{width:140}} value={qfundType} onChange={e=>setQfundType(e.target.value)}>
                <option value="grant">Grant</option>
                <option value="district">District Allocation</option>
                <option value="booster">Booster/Fundraising</option>
                <option value="earned">Earned Income</option>
                <option value="donation">Donation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button type="button" className="btn btn-g btn-sm" onClick={addFundSource}
                disabled={!qfundName.trim()||qsaving}>{qsaving?"Saving…":"Create & Select"}</button>
              <button type="button" className="btn btn-o btn-sm" onClick={()=>{setQfund(false);setQfundName("");}}>Cancel</button>
            </div>
          </div>
        )}
      </div>

    {/* Save / Cancel — always visible at bottom of form */}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",
      marginTop:20,paddingTop:16,borderTop:"1px solid var(--border)"}}>
      <button type="button" className="btn btn-o" onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-g"
        disabled={!f.name.trim()||upl||svng}
        style={{opacity:!f.name.trim()||upl||svng?0.45:1}}
        onClick={async()=>{if(!f.name.trim()||svng)return;setSvng(true);try{await onSave(f);}finally{setSvng(false);}}}>
        {upl?"Uploading…":svng?"Saving…":item?"Save Changes":"Add Item"}
      </button>
    </div>

    </div>
  );
}

function ItemDetail({item,onEdit,onDelete,userId=null,schoolName=null, canEdit=true, canDelete=true}){
  const cat=CAT[item.category]||CAT.other;
  const[lb,setLb]=useState(false);
  const[qr,setQr]=useState(null);
  const[showAddToProd,setShowAddToProd]=useState(false);
  const[showCal,setShowCal]=useState(false);
  const gfx=CAT_GFX[item.category]||CAT_GFX.other;
  const mktCls=item.mkt==="For Rent"?"mb-rent":item.mkt==="For Sale"?"mb-sale":item.mkt==="Rent or Sale"?"mb-both":item.mkt==="For Loan"?"mb-loan":"mb-none";

  useEffect(()=>{
    QR.toDataURL("https://theatre4u.org/#/item/"+(item.display_id||item.id), 200).then(url=>{if(url)setQr(url);});
  },[item.id, item.name]);

  const printQR=async()=>{
    // QR encodes the display_id if available — it's human-readable, unique per org,
    // and the public-item edge function resolves it correctly.
    // Fall back to item.id for items that predate the display_id system.
    const qrIdentifier = item.display_id || item.id;
    const qrUrl = "https://theatre4u.org/#/item/" + qrIdentifier;
    const qrSrc=await QR.toDataURL(qrUrl,200);
    if(!qrSrc)return;
    const w=window.open("","_blank","width=420,height=520");if(!w)return;
    const loc=item.location?"Location: "+item.location:"";
    const itemUrl="theatre4u.org/#/item/"+qrIdentifier;
    const numStr = item.display_id || (item.item_number != null ? itemNum(item.item_number) : "");
    w.document.write(`<html><head><title>QR – ${item.name}</title><style>body{font-family:sans-serif;text-align:center;padding:40px}img{margin:12px 0;border:1px solid #eee;border-radius:6px}h2{margin-bottom:4px;font-size:18px}.num{font-size:22px;font-weight:900;font-family:monospace;color:#c4761a;margin:2px 0 6px}p{color:#666;font-size:13px;margin:3px 0}</style></head><body><h2>${item.name}</h2>${numStr?`<div class="num">${numStr}</div>`:""}<p>${cat.label} · ${item.condition}</p>${loc?`<p style="font-weight:700;color:#333">${loc}</p>`:""}<img src="${qrSrc}" width="200" height="200"/><p style="font-size:11px;margin-top:8px;color:#888">${itemUrl}</p><p style="font-size:11px;color:#bbb">Theatre4u™ · theatre4u.org</p><script>setTimeout(function(){window.print()},300)<\/script></body></html>`);
    w.document.close();
  };

  const dlQR=async()=>{const qId=item.display_id||item.id;const u=await QR.toDataURL("https://theatre4u.org/#/item/"+qId,300);if(!u)return;const a=document.createElement("a");a.href=u;a.download="T4U-"+(item.display_id||item.id)+".png";a.click();};

  return(
    <>
      {lb&&item.img&&<div className="lb" onClick={()=>setLb(false)}><img src={item.img} alt=""/></div>}
      <div className="dt-img" onClick={()=>item.img&&setLb(true)} style={{cursor:item.img?"zoom-in":"default"}}>
        {item.img
          ?<img src={item.img} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<div style={{width:"100%",height:"100%",background:gfx.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:72,opacity:.85}}>{gfx.icon}</div>
        }
      </div>
      <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:16}}>
        <div style={{width:50,height:50,background:cat.color+"22",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,border:`1.5px solid ${cat.color}44`}}>{cat.icon}</div>
        <div>
          <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:cat.color}}>{cat.label}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"var(--ink)",lineHeight:1.1}}>{item.name}</div>
        </div>
      </div>
      {(item.tags||[]).length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{item.tags.map(t=><span key={t} style={{background:"rgba(196,118,26,.12)",color:"var(--cog)",fontSize:12.5,fontWeight:700,padding:"3px 9px",borderRadius:3}}>#{t}</span>)}</div>}
      <div className="dt-sec"><h3>Details</h3>
        {[...(schoolName?[["School Site",<span style={{fontWeight:700,color:"#42a5f5"}}>🏫 {schoolName}</span>]]:[]),["Condition",item.condition],["Size",item.size],["Quantity",item.qty],["Availability",item.avail],["Location",item.location||"—"],["Notes",item.notes||"—"],["Added",item.added?new Date(item.added).toLocaleDateString():"—"],...(item.display_id?[["Item ID",<span style={{fontWeight:800,fontSize:14,color:"var(--amber)",fontFamily:"monospace",letterSpacing:1}}>{item.display_id}</span>]]:[]),["UUID",<span style={{fontFamily:"monospace",fontSize:11,color:"var(--faint)"}}>{item.id}</span>]].map(([l,v])=>(
          <div className="dt-row" key={l}><span className="dt-lbl">{l}</span><span>{v}</span></div>
        ))}
      </div>
      <div className="dt-sec"><h3>Backstage Exchange</h3>
        <div className="dt-row"><span className="dt-lbl">Status</span><span className={`mkt-badge ${mktCls}`}>{item.mkt}</span></div>
        {(item.mkt==="For Rent"||item.mkt==="Rent or Sale")&&<div className="dt-row"><span className="dt-lbl">Rental/week</span><span className="price">{fmt$(item.rent)}</span></div>}
        {(item.mkt==="For Sale"||item.mkt==="Rent or Sale")&&<div className="dt-row"><span className="dt-lbl">Sale Price</span><span className="price">{fmt$(item.sale)}</span></div>}
        {item.mkt==="For Loan"&&<div className="dt-row"><span className="dt-lbl">Loan Period</span><span style={{fontWeight:700,color:"#00838f"}}>{item.loan_period||2} week{(item.loan_period||2)!==1?"s":""}</span></div>}
        {item.mkt==="For Loan"&&<div className="dt-row"><span className="dt-lbl">Deposit</span><span className="price">{item.deposit>0?fmt$(item.deposit):"None (free loan)"}</span></div>}
      </div>
      <div className="dt-sec">
        <h3 style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{display:"flex",alignItems:"center",gap:7}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Availability
          </span>
          <button className="btn btn-o btn-sm" style={{fontSize:11}} onClick={()=>setShowCal(c=>!c)}>
            {showCal?"Hide":"Show"} Calendar
          </button>
        </h3>
        {showCal && (
          <div style={{marginTop:8}}>
            <AvailabilityCalendar
              itemId={item.id}
              isOwner={!!userId}
              userId={userId}
            />
          </div>
        )}
      </div>
      <div className="dt-sec">
        <h3 style={{display:"flex",alignItems:"center",gap:7}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><path d="M21 14h-3v3"/><path d="M21 21h-3v-3"/></svg>
          QR Code Label
        </h3>
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px",background:"var(--parch)",borderRadius:10,border:"1px solid var(--border)"}}>
          <img src={qr||""} alt="QR Code" width={110} height={110} style={{borderRadius:6,flexShrink:0,border:"1px solid var(--linen)"}}/>
          <div>
            <div style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:14,marginBottom:2}}>{item.name}</div>
            {item.display_id&&<div style={{fontSize:12,fontWeight:800,color:"var(--amber)",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>{item.display_id}</div>}
            <p style={{fontSize:12,color:"var(--muted)",lineHeight:1.5,marginBottom:10}}>Print and attach to the item or storage bin. Anyone can scan it to look up details instantly.</p>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <button className="btn btn-o btn-sm" onClick={printQR}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button className="btn btn-o btn-sm" onClick={dlQR}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Save PNG
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
        {canEdit&&onEdit&&<button className="btn btn-p btn-sm" onClick={onEdit}><span style={{width:14,height:14,display:"flex"}}>{Ic.edit}</span>Edit</button>}
        {canDelete&&onDelete&&<button className="btn btn-d btn-sm" onClick={()=>{if(window.confirm("Delete this item?"))onDelete(item.id)}}><span style={{width:14,height:14,display:"flex"}}>{Ic.trash}</span>Delete</button>}
        {userId && <button className="btn btn-o btn-sm" onClick={()=>setShowAddToProd(true)}>🎭 Add to Production</button>}
        {item.mkt!=="Not Listed"&&<FbShareBtn
          url={itemShareUrl(item)}
          text={itemShareText(item, schoolName)}
          compact={true}
          label="Share on Facebook"
        />}
      </div>
      {showAddToProd && userId && (
        <AddToProductionPicker item={item} userId={userId} onClose={()=>setShowAddToProd(false)}/>
      )}
    </>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// AVAILABILITY CALENDAR
// ══════════════════════════════════════════════════════════════════════════════

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// Returns all dates a block covers as "YYYY-MM-DD" strings
function blockDates(b) {
  const dates = new Set();
  const d = new Date(b.start_date + "T00:00:00");
  const end = new Date(b.end_date + "T00:00:00");
  while (d <= end) {
    dates.add(d.toISOString().slice(0,10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function toYMD(d) {
  return d.toISOString().slice(0,10);
}

// ── AvailabilityCalendar ───────────────────────────────────────────────────────
// isOwner = true  → owner can add/remove blocks
// isOwner = false → read-only, shows availability to potential renters
function AvailabilityCalendar({ itemId, isOwner, userId }) {
  const today = new Date();
  const [year,  setYear]   = useState(today.getFullYear());
  const [month, setMonth]  = useState(today.getMonth());
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Selection state (owner only)
  const [selStart, setSelStart] = useState(null);
  const [selEnd,   setSelEnd]   = useState(null);
  const [selHover, setSelHover] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [label,    setLabel]    = useState("");
  const [blockType,setBlockType]= useState("blocked");
  const [saving,   setSaving]   = useState(false);

  const loadBlocks = useCallback(async () => {
    const { data } = await SB.from("availability_blocks")
      .select("*").eq("item_id", itemId).order("start_date");
    setBlocks(data || []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // All blocked dates as a map: "YYYY-MM-DD" → block object
  const blockedMap = useMemo(() => {
    const m = {};
    blocks.forEach(b => {
      blockDates(b).forEach(d => { m[d] = b; });
    });
    return m;
  }, [blocks]);

  // Calendar grid for current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const ymd = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // Determine if a date is in current selection range
  const inSelection = (d) => {
    if (!selStart) return false;
    const anchor = selEnd || selHover;
    if (!anchor) return ymd(d) === selStart;
    const a = selStart < anchor ? selStart : anchor;
    const b = selStart < anchor ? anchor : selStart;
    return ymd(d) >= a && ymd(d) <= b;
  };

  const handleDayClick = (d) => {
    if (!isOwner) return;
    const dateStr = ymd(d);
    if (!selStart || selEnd) {
      setSelStart(dateStr); setSelEnd(null); setSelHover(null); setShowForm(false);
    } else {
      const a = selStart < dateStr ? selStart : dateStr;
      const b = selStart < dateStr ? dateStr : selStart;
      setSelStart(a); setSelEnd(b);
      setShowForm(true);
    }
  };

  const saveBlock = async () => {
    if (!selStart || !selEnd) return;
    setSaving(true);
    const { error } = await SB.from("availability_blocks").insert({
      item_id: itemId, org_id: userId,
      start_date: selStart, end_date: selEnd,
      label: label.trim() || null, block_type: blockType,
    });
    if (!error) {
      await loadBlocks();
      setSelStart(null); setSelEnd(null); setSelHover(null);
      setShowForm(false); setLabel(""); setBlockType("blocked");
    }
    setSaving(false);
  };

  const deleteBlock = async (blockId) => {
    await SB.from("availability_blocks").delete().eq("id", blockId);
    setBlocks(p => p.filter(b => b.id !== blockId));
  };

  const blockColor = (type) =>
    type === "confirmed" ? "#c2185b" :
    type === "pending"   ? "#d35400" : "#546e7a";

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const isToday = (d) => {
    return year===today.getFullYear() && month===today.getMonth() && d===today.getDate();
  };
  const isPast = (d) => {
    const dt = new Date(year, month, d);
    dt.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return dt < t;
  };

  return (
    <div>
      {/* Calendar header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <button onClick={prevMonth} className="btn btn-o btn-sm" style={{padding:"4px 10px"}}>‹</button>
        <div style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:15}}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button onClick={nextMonth} className="btn btn-o btn-sm" style={{padding:"4px 10px"}}>›</button>
      </div>

      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DAY_NAMES.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:800,
            color:"var(--muted)",padding:"2px 0",textTransform:"uppercase",letterSpacing:.5}}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`}/>;
          const dateStr = ymd(d);
          const block = blockedMap[dateStr];
          const sel   = inSelection(d);
          const past  = isPast(d);
          const todayCell = isToday(d);

          const bg = block
            ? blockColor(block.block_type) + (past?"44":"88")
            : sel ? "rgba(196,118,26,.35)"
            : "transparent";

          return (
            <div key={d}
              onClick={() => !past && handleDayClick(d)}
              onMouseEnter={() => isOwner && selStart && !selEnd && setSelHover(dateStr)}
              title={block?.label || (block ? "Unavailable" : "Available")}
              style={{
                aspectRatio:"1",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:todayCell?800:400,
                borderRadius:5,
                background:bg,
                color: block ? "#fff" : past ? "var(--faint)" : sel ? "var(--ink)" : "var(--ink)",
                cursor: past ? "default" : isOwner ? "pointer" : "default",
                border: todayCell ? "2px solid var(--gold)" : "2px solid transparent",
                transition:"background .1s",
                opacity: past ? .5 : 1,
                position:"relative",
              }}>
              {d}
              {block && block.block_type === "confirmed" && (
                <div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",
                  width:4,height:4,borderRadius:"50%",background:"#fff"}}/>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:10,fontSize:11,color:"var(--muted)"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,background:"#546e7a88",display:"inline-block"}}/>Blocked
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,background:"#d3540088",display:"inline-block"}}/>Pending
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,background:"#c2185b88",display:"inline-block"}}/>Confirmed
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,border:"2px solid var(--gold)",display:"inline-block"}}/>Today
        </span>
      </div>

      {/* Owner: add block form */}
      {isOwner && (
        <div style={{marginTop:14}}>
          {!selStart && !showForm && (
            <p style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>
              Click a start date, then an end date to block a range.
            </p>
          )}
          {selStart && !selEnd && (
            <p style={{fontSize:12,color:"var(--amber)",fontWeight:600}}>
              Start: {selStart} — now click an end date
              <button onClick={()=>setSelStart(null)} style={{marginLeft:8,background:"none",border:"none",
                color:"var(--muted)",cursor:"pointer",fontSize:11}}>cancel</button>
            </p>
          )}
          {showForm && selStart && selEnd && (
            <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,
              padding:14,marginTop:8,animation:"su .2s ease"}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>
                Block {selStart} → {selEnd}
              </div>
              <div className="fg2">
                <div className="fg">
                  <label className="fl">Type</label>
                  <select className="fs" value={blockType} onChange={e=>setBlockType(e.target.value)}>
                    <option value="blocked">Blocked / Unavailable</option>
                    <option value="pending">Pending Request</option>
                    <option value="confirmed">Confirmed Booking</option>
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Label (optional)</label>
                  <input className="fi" value={label} onChange={e=>setLabel(e.target.value)}
                    placeholder="e.g. Spring Musical 2026"/>
                </div>
              </div>
              <div style={{display:"flex",gap:7,marginTop:12}}>
                <button className="btn btn-o btn-sm" onClick={()=>{setShowForm(false);setSelStart(null);setSelEnd(null);}}>Cancel</button>
                <button className="btn btn-g btn-sm" onClick={saveBlock} disabled={saving}>
                  {saving?"Saving…":"Block These Dates"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing blocks list */}
      {blocks.length > 0 && (
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,
            color:"var(--muted)",marginBottom:8}}>Blocked Periods</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {blocks.map(b => (
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",
                borderRadius:7,background:"var(--parch)",border:"1px solid var(--border)"}}>
                <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,
                  background:blockColor(b.block_type)}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700}}>{b.start_date} → {b.end_date}</div>
                  {b.label&&<div style={{fontSize:11,color:"var(--muted)"}}>{b.label}</div>}
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:6,
                  background:blockColor(b.block_type)+"22",color:blockColor(b.block_type)}}>
                  {b.block_type}
                </span>
                {isOwner && (
                  <button onClick={()=>deleteBlock(b.id)}
                    style={{background:"none",border:"none",color:"var(--muted)",
                      cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{textAlign:"center",padding:20,color:"var(--muted)",fontSize:12}}>Loading availability…</div>
      )}
    </div>
  );
}


/* ── PAGES ─────────────────────────────────────────────────────────────────── */

// ── Community Spotlight (Dashboard widget) ────────────────────────────────────
function CommunitySpotlight({onViewAll}){
  const [posts,   setPosts]   = useState([]);
  const [orgs,    setOrgs]    = useState({});
  const [idx,     setIdx]     = useState(0);
  const [fade,    setFade]    = useState(true);
  const timerRef = useRef(null);

  useEffect(()=>{
    (async()=>{
      // Get viewer coords from org for proximity sorting
      const vLat = null, vLng = null; // org coords passed separately if needed
      const{data}=await SB.rpc("proximity_community_posts",{
        viewer_lat: null, viewer_lng: null, radius_miles: 150, row_limit: 20
      });
      if(!data||data.length===0)return;
      setPosts(data);
      const ids=[...new Set(data.map(p=>p.org_id))];
      const{data:od}=await SB.from("orgs").select("id,name").in("id",ids);
      const map={};(od||[]).forEach(o=>{map[o.id]=o.name;});
      setOrgs(map);
    })();
  },[]);

  // Auto-rotate every 5s
  useEffect(()=>{
    if(posts.length<2)return;
    timerRef.current=setInterval(()=>{
      setFade(false);
      setTimeout(()=>{
        setIdx(i=>(i+1)%posts.length);
        setFade(true);
      },250);
    },5000);
    return()=>clearInterval(timerRef.current);
  },[posts.length]);

  const goTo=(i)=>{
    clearInterval(timerRef.current);
    setFade(false);
    setTimeout(()=>{setIdx(i);setFade(true);},200);
  };

  const PT_COLORS={show:"#7b1fa2",audition:"#1565c0",photo:"#c2185b",wanted:"#d84315",announcement:"#2e7d32"};
  const PT_ICONS ={show:"🎭",audition:"🎤",photo:"📸",wanted:"🔍",announcement:"📢"};
  const PT_LABELS={show:"Upcoming Show",audition:"Audition Notice",photo:"Production Photos",wanted:"Item Wanted",announcement:"Announcement"};

  // Empty state — encourage first post
  if(posts.length===0) return(
    <div style={{background:"var(--parch)",border:"2px dashed var(--border)",borderRadius:"var(--rl)",padding:"32px 24px",textAlign:"center",marginBottom:32}}>
      <div style={{fontSize:40,marginBottom:10}}>🎪</div>
      <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:6}}>Nothing posted yet</h3>
      <p style={{color:"var(--muted)",fontSize:13,maxWidth:380,margin:"0 auto 16px",lineHeight:1.6}}>Be the first to share an upcoming show, post an audition notice, or connect with your theatre community.</p>
      <button className="btn btn-g" onClick={onViewAll}>+ Post to Community Board</button>
    </div>
  );

  const post  = posts[idx];
  const color = PT_COLORS[post.type]||"#7b1fa2";
  const icon  = PT_ICONS[post.type]||"📢";
  const label = PT_LABELS[post.type]||"Post";
  const orgName = orgs[post.org_id]||"A Theatre Program";

  return(
    <div style={{marginBottom:32}}>
      {/* Main card */}
      <div style={{
        background:`linear-gradient(135deg,${color}18,${color}08)`,
        border:`1.5px solid ${color}30`,
        borderRadius:"var(--rl)",
        overflow:"hidden",
        transition:"all .3s",
        cursor:"pointer",
      }} onClick={onViewAll}>
        {/* Top stripe */}
        <div style={{height:4,background:`linear-gradient(90deg,${color},${color}66)`}}/>
        <div style={{
          padding:"22px 24px 18px",
          opacity:fade?1:0,
          transition:"opacity .25s",
        }}>
          {/* Type badge + org */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:22}}>{icon}</span>
              <span style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:color}}>{label}</span>
            </div>
            <div style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>by {orgName}{post.location?` · ${post.location}`:""}</div>
          </div>

          {/* Title */}
          <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,lineHeight:1.2,marginBottom:8,color:"var(--ink)"}}>{post.title}</h3>

          {/* Show meta */}
          {(post.show_title||post.start_date||post.venue)&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}}>
              {post.show_title&&<span style={{fontSize:12,fontWeight:700,padding:"2px 9px",background:color+"18",borderRadius:6,color}}>{post.show_title}</span>}
              {post.venue&&<span style={{fontSize:12,color:"var(--muted)",padding:"2px 9px",background:"var(--white)",borderRadius:6}}>📍 {post.venue}</span>}
              {post.start_date&&<span style={{fontSize:12,fontWeight:700,padding:"2px 9px",background:color+"18",borderRadius:6,color}}>
                📅 {new Date(post.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                {post.end_date&&post.end_date!==post.start_date?" – "+new Date(post.end_date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}
              </span>}
            </div>
          )}

          {/* Body excerpt */}
          {post.body&&<p style={{fontSize:13.5,color:"var(--muted)",lineHeight:1.65,marginBottom:12}}>{post.body.length>180?post.body.slice(0,180)+"…":post.body}</p>}

          {/* Production Photos */}
          {(post.images||[]).length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {(post.images||[]).slice(0,4).map((url,i)=>(
                <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",flexShrink:0,
                  width:(post.images||[]).length===1?"100%":"calc(50% - 3px)",
                  height:(post.images||[]).length===1?240:120,cursor:"pointer"}}
                  onClick={e=>{e.stopPropagation();window.open(url,"_blank");}}>
                  <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  {i===3&&(post.images||[]).length>4&&(
                    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:18}}>
                      +{(post.images||[]).length-4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${color}20`}}>
            <div style={{display:"flex",gap:6}}>
              {(post.tags||[]).slice(0,3).map(t=><span key={t} style={{fontSize:11,padding:"1px 7px",background:"var(--white)",borderRadius:4,color:"var(--muted)"}}>#{t}</span>)}
            </div>
            <span style={{fontSize:12,fontWeight:700,color:color}}>View on Community Board →</span>
          </div>
        </div>
      </div>

      {/* Dots + navigation */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12}}>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {posts.slice(0,8).map((_,i)=>(
            <button key={i} onClick={e=>{e.stopPropagation();goTo(i);}} style={{
              width:i===idx?20:7,height:7,borderRadius:4,border:"none",cursor:"pointer",
              background:i===idx?color:"var(--border)",
              transition:"all .3s",padding:0,
            }}/>
          ))}
          {posts.length>8&&<span style={{fontSize:11,color:"var(--muted)"}}>+{posts.length-8} more</span>}
        </div>
        <button className="btn btn-o btn-sm" onClick={onViewAll} style={{fontSize:12}}>
          See All {posts.length} Post{posts.length!==1?"s":""}
        </button>
      </div>
    </div>
  );
}

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

function Dashboard({items,org,plan="free",pointBalance=0,goInventory,goMarketplace,goCommunity,goProfile,goPoints}){
  const totalQty=items.reduce((s,i)=>s+(i.qty||1),0);
  const listed=items.filter(i=>i.mkt!=="Not Listed").length;
  const withImg=items.filter(i=>i.img).length;
  const totalVal=items.reduce((s,i)=>s+((i.sale||0)*(i.qty||1)),0);
  const cc={};items.forEach(i=>{cc[i.category]=(cc[i.category]||0)+(i.qty||1)});
  const maxC=Math.max(1,...Object.values(cc));
  const vVertical=org?.vertical||"theatre"; const vCATS=getCatsMerged(vVertical);
  const [highlights, setHighlights] = useState([]);
  useEffect(()=>{
    (async()=>{
      const{data}=await SB.from("items")
        .select("*, orgs(name,location)")
        .neq("mkt","Not Listed")
        .eq("avail","In Stock")
        .order("added",{ascending:false})
        .limit(40);
      const mine=(data||[]).filter(i=>(i.vertical||"theatre")===vVertical).slice(0,6);
      setHighlights(mine);
    })();
  },[vVertical]);

  const profileIncomplete = !org?.director_name;
  const isTempPro = org?.temp_pro;

  return(
    <div style={{position:"relative",padding:"32px 36px 56px"}}>
      <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.dashboard} w={1400} h={900} className="page-bg-img"/>
      <div className="page-layer">

        {/* Temp Pro beta notice */}
        {isTempPro&&(()=>{
          const itemCount = items.filter(i=>!i._is_loan).length;
          const hasFeedback = org?.founding_member_rate || false;
          const isFoundingMember = org?.founding_member_rate || false;
          const itemsNeeded = Math.max(0, 25 - itemCount);
          const itemPct = Math.min(100, Math.round(itemCount / 25 * 100));

          // Founding member — show celebration
          if (isFoundingMember) return (
            <div style={{background:"linear-gradient(135deg,rgba(76,175,80,.15),rgba(76,175,80,.05))",
              border:"1px solid rgba(76,175,80,.4)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:24,flexShrink:0}}>🎉</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#4caf50",marginBottom:3}}>
                    You've earned the Founding Member Rate — $9.99/month!
                  </div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6}}>
                    You added 25+ items and shared your feedback during beta. When Theatre4u launches,
                    your rate is locked at <strong style={{color:"var(--text)"}}>$9.99/month</strong> for
                    as long as you subscribe — 33% less than the standard $15 rate. Thank you for being
                    a founding member of Theatre4u.
                  </div>
                </div>
              </div>
            </div>
          );

          // Still working toward founding member rate
          return(
            <div style={{background:"linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04))",
              border:"1px solid rgba(212,168,67,.3)",borderRadius:10,padding:"14px 16px",
              marginBottom:16}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
                <span style={{fontSize:20,flexShrink:0}}>⭐</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--gold)",marginBottom:3}}>
                    Full Pro access — complimentary during Theatre4u beta
                  </div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6,marginBottom:10}}>
                    When Theatre4u launches you'll have the option to subscribe.
                    {" "}<strong style={{color:"var(--text)"}}>Add 25+ items and share feedback</strong>{" "}
                    to lock in the founding member rate of <strong style={{color:"var(--gold)"}}>$9.99/month</strong> — 
                    instead of the standard $15 — for life.
                  </div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:140}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                        <span style={{color:"var(--muted)"}}>📦 Items added</span>
                        <span style={{fontWeight:700,color:itemCount>=25?"#4caf50":"var(--gold)"}}>
                          {itemCount}/25 {itemCount>=25?"✓":""}
                        </span>
                      </div>
                      <div style={{height:5,background:"rgba(0,0,0,.2)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:itemPct+"%",
                          background:itemCount>=25?"#4caf50":"var(--gold)",
                          borderRadius:3,transition:"width .5s"}}/>
                      </div>
                      {itemsNeeded>0&&<div style={{fontSize:10,color:"var(--muted)",marginTop:3}}>
                        {itemsNeeded} more item{itemsNeeded===1?"":"s"} to go
                      </div>}
                    </div>
                    <div style={{flex:1,minWidth:140}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                        <span style={{color:"var(--muted)"}}>💬 Feedback</span>
                        <span style={{fontWeight:700,color:"var(--muted)"}}>via Leading Players button</span>
                      </div>
                      <div style={{height:5,background:"rgba(0,0,0,.2)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:"0%",background:"var(--gold)",borderRadius:3}}/>
                      </div>
                      <div style={{fontSize:10,color:"var(--muted)",marginTop:3}}>
                        Click the ? button to submit
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Incomplete profile banner */}
        {profileIncomplete&&(
          <div style={{background:"rgba(33,150,243,.06)",border:"1px solid rgba(33,150,243,.2)",
            borderRadius:10,padding:"12px 16px",marginBottom:16,
            display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>👤</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13}}>Complete your profile</div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>
                Add your name under <strong>My Profile → Edit Profile</strong> so other programs know who to contact.
              </div>
            </div>
            <button onClick={goProfile}
              style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(33,150,243,.4)",
                background:"rgba(33,150,243,.1)",color:"#42a5f5",fontSize:12,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
              Go to My Profile →
            </button>
          </div>
        )}

        <div className="hero-wrap" style={{height:380,marginBottom:32}}>
          <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.dashboard} w={1200} h={480} alt="" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📦 Inventory · Productions · Community</div>
            <h1 className="hero-title">{org.name?`Welcome,\n${org.name}`:"Welcome to\nTheatre4u"}</h1>
            <p className="hero-sub">Everything your program owns — cataloged, photographed, and organized. Your theatre's complete inventory, always at your fingertips.</p>
          </div>
          <div className="hero-bar"/>
        </div>
        {/* Profile Completion Nudge — show only if 2+ fields missing */}
        {([!org?.location, !org?.phone, !org?.bio].filter(Boolean).length >= 2) && items.length > 0 && (
          <div style={{background:"linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.05))",
            border:"1.5px solid rgba(212,168,67,.3)",borderRadius:14,padding:"14px 18px",
            display:"flex",alignItems:"center",gap:14,marginBottom:20,cursor:"pointer"}}
            onClick={()=>goProfile&&goProfile()}>
            <div style={{fontSize:28,flexShrink:0}}>✏️</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--gold)",marginBottom:3}}>
                Complete your profile
              </div>
              <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>
                Add your location, phone, and bio so other programs can find and contact you in Backstage Exchange.
              </div>
            </div>
            <div style={{color:"var(--gold)",fontSize:18,flexShrink:0}}>→</div>
          </div>
        )}

        {/* Stats */}
        <div className="stats">
          {[
            {ico:"📦",val:totalQty,   lbl:"Total Items",     col:"#c4761a", bg:"photo-1558618666-fcd25c85cd64"}, // organized prop storage
            {ico:"📂",val:items.length,lbl:"Entries",         col:"#1554a0", bg:"photo-1489987707025-afc232f7ea0f"}, // costume racks
            {ico:"🏪",val:listed,     lbl:"On Backstage Exchange",  col:"#27723a", bg:"photo-1460723237483-7a6dc9d0b212"}, // stage lit up
            {ico:"📷",val:withImg,    lbl:"With Photos",     col:"#a0144e", bg:"photo-1516450360452-9312f5e86fc7"}, // stage lighting rigs
            {ico:"💰",val:totalVal>0?fmt$(totalVal):"—",lbl:"Est. Value",col:"#8b3a0f",bg:"photo-1503095396549-807759245b35"}, // grand theatre
          ].map(s=>(
            <div key={s.lbl} className="stat" style={{borderTop:`4px solid ${s.col}`,overflow:"hidden"}}>
              {/* Background photo with dark overlay */}
              <img src={usp(s.bg,400,200)} alt="" loading="lazy"
                style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.13,pointerEvents:"none",userSelect:"none"}}/>
              <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${s.col}18,rgba(18,6,0,.55))`,pointerEvents:"none"}}/>
              <div style={{position:"relative",zIndex:1}}>
                <div className="stat-ico">{s.ico}</div>
                <div className="stat-val">{s.val}</div>
                <div className="stat-lbl">{s.lbl}</div>
              </div>
            </div>
          ))}
        </div>
        {/* ── Stage Points Progress Card ── */}
        {plan !== "free" && (
          <div onClick={()=>goPoints&&goPoints()} style={{cursor:"pointer",
            background:"linear-gradient(135deg,rgba(212,168,67,.1),rgba(212,168,67,.04))",
            border:"1.5px solid rgba(212,168,67,.25)",borderRadius:14,
            padding:"16px 20px",marginBottom:24,
            display:"flex",alignItems:"center",gap:16}}>
            <div style={{fontSize:36,flexShrink:0}}>🪙</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                <div style={{fontWeight:800,fontSize:15,color:"var(--gold)"}}>{getPointsName(vVertical)}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--gold)",fontWeight:700}}>
                  {(pointBalance||0).toLocaleString()}
                  <span style={{fontSize:12,color:"var(--muted)",fontWeight:400}}> pts</span>
                </div>
              </div>
              {/* Progress bar toward free month */}
              <div style={{background:"rgba(0,0,0,.2)",borderRadius:99,height:6,marginBottom:6,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,
                  background:"linear-gradient(90deg,var(--gold),#c4921a)",
                  width: Math.min(100,(pointBalance||0)/POINTS_FREE_MONTH*100)+"%",
                  transition:"width .5s ease"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)"}}>
                <span>Earn by sharing inventory &amp; completing Exchange deals</span>
                <span style={{fontWeight:700,color:(pointBalance||0)>=POINTS_FREE_MONTH?"var(--gold)":"var(--muted)"}}>
                  {Math.max(0,POINTS_FREE_MONTH-(pointBalance||0)).toLocaleString()} until free month
                </span>
              </div>
            </div>
            <div style={{color:"var(--gold)",fontSize:18,flexShrink:0}}>→</div>
          </div>
        )}

        {/* ── Community Spotlight ── */}
        <div className="sh"><h2>🎪 Community Board</h2><p>Upcoming events, opportunities, and announcements from your arts network.</p></div>
        <CommunitySpotlight onViewAll={goCommunity}/>
        {/* Divider 1 */}
        <div className="img-div" style={{marginBottom:32}}>
          <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId="photo-1503095396549-807759245b35" w={1000} h={240} alt="" loading="lazy"/>
          <div className="img-div-fade"/>
          <div className="img-div-text">
            <h3>{getExchangeName(vVertical)}</h3>
            <p>Browse items posted by other programs — rent, borrow, or purchase. Share your own when you're ready.</p>
          </div>
        </div>
        {/* Marketplace Highlights — auto-scrolling carousel */}
        <div className="sh"><h2>{getExchangeName(vVertical)} — Highlights</h2><p>Items posted for rent, sale, or loan by programs in your community.</p></div>
        {highlights.length===0?(
          <div style={{background:"var(--parch)",border:"2px dashed var(--border)",borderRadius:"var(--rl)",padding:"40px 32px",textAlign:"center",marginBottom:36}}>
            <div style={{fontSize:44,marginBottom:12}}>🏪</div>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:8}}>No Listings Yet</h3>
            <p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 18px"}}>When you or other programs post items to the {getExchangeName(vVertical)}, they'll be showcased here for the whole community to discover.</p>
            <button className="btn btn-g" onClick={()=>goMarketplace&&goMarketplace()}>Browse {getExchangeName(vVertical)}</button>
          </div>
        ):(
          <div style={{marginBottom:36}}>
            {/* Carousel track — overflows and animates */}
            <div style={{position:"relative",overflow:"hidden",borderRadius:"var(--rm)",
              background:"var(--parch)",border:"1px solid var(--border)",padding:"20px 0",marginBottom:14}}
              onMouseEnter={e=>e.currentTarget.querySelector(".scroll-track").style.animationPlayState="paused"}
              onMouseLeave={e=>e.currentTarget.querySelector(".scroll-track").style.animationPlayState="running"}>
              {/* Fade edges */}
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:80,
                background:"linear-gradient(to right,var(--parch),transparent)",zIndex:2,pointerEvents:"none"}}/>
              <div style={{position:"absolute",right:0,top:0,bottom:0,width:80,
                background:"linear-gradient(to left,var(--parch),transparent)",zIndex:2,pointerEvents:"none"}}/>
              {/* Scrolling track — duplicated for seamless loop */}
              <div className="scroll-track" style={{
                display:"flex",gap:16,paddingLeft:16,
                width:"max-content",
                animation:`mkt-scroll ${highlights.length * 6}s linear infinite`,
              }}>
                {[...highlights,...highlights].map((item,i)=>{
                  const cat=CAT[item.category]||CAT.other;
                  const orgName=item.orgs?.name||"";
                  const mktCls=item.mkt==="For Rent"?"mb-rent":item.mkt==="For Sale"?"mb-sale":item.mkt==="For Loan"?"mb-loan":"mb-both";
                  return(
                    <div key={`${item.id}-${i}`}
                      onClick={()=>goMarketplace&&goMarketplace()}
                      style={{width:220,flexShrink:0,background:"var(--cream)",borderRadius:"var(--rm)",
                        border:"1px solid var(--border)",overflow:"hidden",cursor:"pointer",
                        boxShadow:"var(--sh1)",transition:"transform .2s,box-shadow .2s"}}
                      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="var(--sh2)";}}
                      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="var(--sh1)";}}>
                      {/* Image or gradient */}
                      <div style={{height:140,position:"relative",overflow:"hidden",flexShrink:0}}>
                        {item.img
                          ?<img src={item.img} alt={item.name} loading="lazy"
                              style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          :<div style={{width:"100%",height:"100%",
                              background:getCatGfx(vVertical,item.category).grad,
                              display:"flex",alignItems:"center",justifyContent:"center",
                              fontSize:52,opacity:.85}}>
                              {cat.icon}
                            </div>
                        }
                        {/* Org badge top-left */}
                        {orgName&&<div style={{position:"absolute",top:8,left:8,
                          background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)",
                          color:"#fff",fontSize:10,fontWeight:700,padding:"2px 7px",
                          borderRadius:6,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {orgName}
                        </div>}
                        {/* Badge top-right */}
                        <div style={{position:"absolute",top:8,right:8}}>
                          <span className={`mkt-badge ${mktCls}`}>{item.mkt}</span>
                        </div>
                      </div>
                      {/* Info */}
                      <div style={{padding:"10px 12px"}}>
                        <div style={{fontSize:11,color:cat.color,fontWeight:700,marginBottom:3}}>{cat.icon} {cat.label}</div>
                        <div style={{fontFamily:"'Lora',serif",fontSize:14,fontWeight:600,lineHeight:1.3,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:6}}>{item.name}</div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontSize:11,color:"var(--muted)"}}>{item.condition} · ×{item.qty}</span>
                          <span style={{fontWeight:800,fontSize:13,color:"var(--cog)"}}>
                            {item.mkt==="For Loan"
                              ?`${item.loan_period||2}wk loan`
                              :item.rent>0?fmt$(item.rent)+"/wk"
                              :item.sale>0?fmt$(item.sale):""}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{textAlign:"center"}}>
              <button className="btn btn-g" onClick={()=>goMarketplace&&goMarketplace()}>
                Browse All Listings →
              </button>
            </div>
          </div>
        )}
        {/* Category gallery */}
        <div className="sh"><h2>Browse by Category</h2><p>Click any category to explore your inventory.</p></div>
        <div className="cat-gallery" style={{marginBottom:36}}>
          {vCATS.map(cat=>{
            const count=items.filter(it=>it.category===cat.id).length;
            return(
              <div key={cat.id} className="cat-tile" onClick={()=>goInventory&&goInventory(cat.id)}>
                <CatCard catId={cat.id} label={cat.label} icon={cat.icon} width="100%" height={160} vertical={vVertical}>
                  <div className="cat-info"><span className="cat-emo">{cat.icon}</span><span className="cat-name">{cat.label}</span>{count>0&&<div className="cat-cnt">{count} item{count!==1?"s":""}</div>}</div>
                </CatCard>
              </div>
            );
          })}
        </div>
        {/* Divider 2 */}
        <div className="img-div" style={{marginBottom:32}}>
          <img src={usp("photo-1504196606672-aef5c9cefc92",1000,240)} alt="Theatre seats" loading="lazy"/>
          <div className="img-div-fade"/>
          <div className="img-div-text">
            <h3>Every Costume Found. Every Prop Accounted For.</h3>
            <p>Theatre4u™ keeps your complete inventory organized — from the costume closet to the lighting rig.</p>
          </div>
        </div>
        {/* Bar chart */}
        {items.length>0?(
          <div className="card card-p">
            <div className="sh" style={{marginBottom:20}}><h2>Inventory at a Glance</h2></div>
            {vCATS.map(cat=>{const c=cc[cat.id]||0;if(!c)return null;return(
              <div key={cat.id} className="bar-row">
                <span className="bar-ico">{cat.icon}</span>
                <span className="bar-lbl">{cat.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(c/maxC)*100}%`,background:cat.color}}/></div>
                <span className="bar-cnt">{c}</span>
              </div>
            );})}
          </div>
        ):(
          <div className="empty"><div className="empty-ico">{getVertical(vVertical).icon}</div><h3>Welcome to Your Program</h3><p>Load sample data from Settings, or add your first item to begin.</p></div>
        )}
      </div>
    </div>
  );
}

function Inventory({items,onAdd,onEdit,onDelete,userId, memberRole="director",plan="free",headerNote=null,schoolName=null,org=null, deepLinkLocationId=null, onDeepLinkConsumed=null, deepLinkCategory=null, onDeepLinkCategoryConsumed=null, enableLoans=false}){
    const[upgradeReason,setUpgradeReason]=useState(null);
  const vVertical=org?.vertical||"theatre";
  const vCATS=getCatsMerged(vVertical);
  const vCfg=getVertical(vVertical);
  const vCONDS=vCfg.conditions, vAVAIL=vCfg.availability, vMKT=vCfg.marketOptions;
  const vCAT=Object.fromEntries(vCATS.map(c=>[c.id,c]));
  // Role-based permissions
  const canEdit   = memberRole !== "house";
  const canAdd    = memberRole !== "house";
  const canDelete = memberRole === null || memberRole === "director" || memberRole === "stage_manager";

  // ── Storage location deep link — filter items when QR scanned ────────────────
  const [locFilter,     setLocFilter]     = useState(deepLinkLocationId || "all");
  const [locFilterName, setLocFilterName] = useState(null);
  useEffect(()=>{
    if (!deepLinkLocationId) return;
    setLocFilter(deepLinkLocationId);
    (async()=>{
      try {
        const {data} = await SB.from("storage_locations")
          .select("name,code,description").eq("id", deepLinkLocationId).single();
        if (data) setLocFilterName(data);
      } catch(e){}
      if (onDeepLinkConsumed) onDeepLinkConsumed();
    })();
  }, [deepLinkLocationId]);

  // Consume category deep link from dashboard Browse by Category
  useEffect(()=>{
    if (!deepLinkCategory) return;
    setCatF(deepLinkCategory);
    setView("grid");
    if (onDeepLinkCategoryConsumed) onDeepLinkCategoryConsumed();
  }, [deepLinkCategory]);

  const[search,setSrch]=useState("");const[catF,setCatF]=useState("all");
  const[condF,setCondF]=useState("all");const[availF,setAvailF]=useState("all");
  const[mktF,setMktF]=useState("all");const[view,setView]=useState("grid"); // grid | table | locations
  const[showF,setShowF]=useState(false);const[pg,setPg]=useState(1);
  const[modal,setModal]=useState(null);const[active,setActive]=useState(null);
  const[showImport,setShowImport]=useState(false);
  const[invView,setInvView]=useState("items"); // items | loans (Borrowed & Lent tab)

  // ── Bulk / mass edit state ───────────────────────────────────────────────
  const[selectMode, setSelectMode] = useState(false);
  const[selected,   setSelected]   = useState(new Set()); // Set of item ids
  const[bulkSaving, setBulkSaving] = useState(false);
  const[bulkMsg,    setBulkMsg]    = useState("");
  const[bulkField,  setBulkField]  = useState(""); // which field to bulk-update
  const[bulkValue,  setBulkValue]  = useState("");  // what value
  const[autoCatRunning, setAutoCatRunning] = useState(false);
  const[autoCatMsg,     setAutoCatMsg]     = useState("");

  // Auto-categorize selected items using Claude AI
  const autoCategorizeSel = async () => {
    if (selected.size === 0) return;
    setAutoCatRunning(true);
    setAutoCatMsg("Analyzing items…");
    const ids = [...selected];
    const toProcess = items.filter(i => ids.includes(i.id));
    let updated = 0, failed = 0;

    for (const item of toProcess) {
      try {
        const vCatIds = getCats(vVertical).map(c=>c.id);
        const prompt = "You are categorizing " + vCfg.label + " program inventory items. "
          + "Given the item name and notes, return ONLY the single best category ID from this list: "
          + vCatIds.join(", ") + ". "
          + "Return only the category ID, nothing else. "
          + "Item name: " + item.name + ". "
          + (item.notes ? "Notes: " + item.notes + "." : "");

        const res = await fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/ai-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prompt, context: "categorize" }),
        });
        const json = await res.json();
        const raw  = (json.reply || json.response || json.content || "").trim().toLowerCase();
        const VALID = getCats(vVertical).map(c=>c.id);
        const cat   = VALID.find(c => raw.includes(c));
        if (cat && cat !== item.category) {
          const { error } = await SB.from("items").update({ category: cat }).eq("id", item.id);
          if (!error) { onEdit({ ...item, category: cat }); updated++; }
          else failed++;
        } else {
          updated++; // already correct or no change needed
        }
        setAutoCatMsg("Analyzing… " + (updated + failed) + "/" + toProcess.length);
      } catch(e) { failed++; }
    }

    setAutoCatMsg("✅ Done — " + updated + " item" + (updated!==1?"s":"") + " categorized"
      + (failed > 0 ? ", " + failed + " failed" : ""));
    setAutoCatRunning(false);
    setSelected(new Set());
    setTimeout(() => setAutoCatMsg(""), 4000);
  };

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const selectAll  = () => setSelected(new Set(filtered.map(i=>i.id)));
  const clearSelect = () => { setSelected(new Set()); };

  const applyBulkEdit = async () => {
    if (!bulkField || !bulkValue || selected.size === 0) return;
    setBulkSaving(true);
    setBulkMsg("");
    const ids = [...selected];
    const colMap = {
      category:   "category",
      location:   "location",
      condition:  "condition",
      avail:      "avail",
      mkt:        "mkt",
    };
    const col = colMap[bulkField];
    if (!col) { setBulkSaving(false); return; }
    const { error } = await SB.from("items")
      .update({ [col]: bulkValue })
      .in("id", ids)
      .eq("org_id", userId);
    if (error) {
      setBulkMsg("❌ Update failed: " + error.message);
    } else {
      ids.forEach(id => onEdit({ ...items.find(i=>i.id===id), [col]: bulkValue }));
      setBulkMsg("✅ Updated " + ids.length + " item" + (ids.length!==1?"s":""));
      setSelected(new Set());
      setBulkField("");
      setBulkValue("");
      setTimeout(()=>setBulkMsg(""), 3000);
    }
    setBulkSaving(false);
  };
  const PP=20;
  const mktCls=m=>m==="For Rent"?"mb-rent":m==="For Sale"?"mb-sale":m==="Rent or Sale"?"mb-both":m==="For Loan"?"mb-loan":"mb-none";
  const filtered=useMemo(()=>{
    let f=items;
    if(search){const q=search.toLowerCase();f=f.filter(i=>i.name.toLowerCase().includes(q)||(i.notes||"").toLowerCase().includes(q)||(i.location||"").toLowerCase().includes(q)||(i.display_id||"").toLowerCase().includes(q)||(i.tags||[]).some(t=>t.includes(q)))}
    if(catF!=="all")f=f.filter(i=>i.category===catF);
    if(condF!=="all")f=f.filter(i=>i.condition===condF);
    if(availF!=="all")f=f.filter(i=>i.avail===availF);
    if(mktF!=="all")f=f.filter(i=>i.mkt===mktF);
    if(locFilter!=="all")f=f.filter(i=>
      i.location_id===locFilter ||
      (i.location&&locFilterName&&i.location.toLowerCase()===locFilterName.name.toLowerCase())
    );
    return f;
  },[items,search,catF,condF,availF,mktF,locFilter,locFilterName]);
  const paged=useMemo(()=>filtered.slice((pg-1)*PP,pg*PP),[filtered,pg]);
  useEffect(()=>setPg(1),[search,catF,condF,availF,mktF]);
  const openD=item=>{setActive(item);setModal("d")};
  const openE=item=>{setActive(item);setModal("e")};
  const handleSave=async form=>{
    if(active&&modal==="e"){
      await onEdit({...active,...form,id:active.id});
    } else {
      await onAdd({...form,id:uid(),added:new Date().toISOString()});
    }
    setModal(null);setActive(null);
  };
  const maxItems = PLANS_DEF[plan]?.maxItems ?? 25;
  const nearLimit = plan==="free" && items.length >= 20 && items.length < 25;

  const [printingQR, setPrintingQR] = useState(false);

  const printQRFiltered = async () => {
    const toPrint = filtered.length > 0 ? filtered : items;
    if (!toPrint.length) { alert("No items to print."); return; }
    setPrintingQR(true);
    try {
      const w = window.open("", "_blank", "width=950,height=720");
      if (!w) { alert("Pop-up blocked — please allow pop-ups for theatre4u.org and try again."); setPrintingQR(false); return; }
      w.document.write(`<html><head><title>QR Labels</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;background:#fff;padding:14px}
        .controls{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
        .controls h2{font-size:14px;color:#333;flex:1}
        .btn{padding:6px 16px;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px}
        .btn-p{background:#d4a843;color:#1a0800}
        .btn-c{background:#eee;color:#333;border:1px solid #ccc}
        .grid{display:flex;flex-wrap:wrap;gap:8px}
        .lbl{width:170px;height:170px;border:1.5px solid #222;border-radius:7px;padding:9px;display:flex;flex-direction:column;gap:2px;page-break-inside:avoid;background:#fff}
        .lbl-cat{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;overflow:hidden;white-space:nowrap}
        .lbl-name{font-size:10px;font-weight:700;color:#111;line-height:1.25;flex:1;overflow:hidden;word-break:break-word}
        .lbl-loc{font-size:8.5px;color:#444;font-weight:600}
        .lbl-id{font-size:9px;font-weight:800;color:#c4761a;font-family:monospace;letter-spacing:.5px}
        .lbl-row{display:flex;align-items:flex-end;justify-content:space-between;margin-top:auto}
        .lbl-brand{font-size:7px;color:#bbb}
        .lbl-qr{width:62px;height:62px}
        @media print{.controls{display:none!important}.grid{gap:7px}.lbl{width:162px;height:162px}}
      </style></head><body>
      <div class="controls">
        <h2>${toPrint.length} label${toPrint.length!==1?"s":""}</h2>
        <button class="btn btn-p" onclick="window.print()">Print</button>
        <button class="btn btn-c" onclick="window.close()">Close</button>
        <span style="font-size:11px;color:#888">Tip: set margins to None in print dialog</span>
      </div>
      <div class="grid" id="lbl">Generating labels…</div>
      </body></html>`);
      w.document.close();
      const srcs = await Promise.all(toPrint.map(i => QR.toDataURL("https://theatre4u.org/#/item/" + i.id, 140)));
      const labels = toPrint.map((item, n) => {
        const cat = CAT[item.category] || CAT.other;
        const dispId = item.display_id || item.id.slice(0,8).toUpperCase();
        return "<div class=\"lbl\">"
          + "<div class=\"lbl-cat\" style=\"color:"+( cat.color||"#888")+"\">" + cat.icon + " " + cat.label + "</div>"
          + "<div class=\"lbl-name\">" + item.name + "</div>"
          + (item.location ? "<div class=\"lbl-loc\">📍 " + item.location + "</div>" : "")
          + "<div class=\"lbl-id\">" + dispId + "</div>"
          + "<div class=\"lbl-row\"><div><div class=\"lbl-brand\">theatre4u.org</div></div>"
          + (srcs[n] ? "<img class=\"lbl-qr\" src=\"" + srcs[n] + "\" alt=\"QR\"/>" : "")
          + "</div></div>";
      }).join("");
      const el = w.document.getElementById("lbl");
      if (el) { el.outerHTML = "<div class=\"grid\">" + labels + "</div>"; setTimeout(() => w.print(), 500); }
    } finally { setPrintingQR(false); }
  };

  const atLimit   = plan==="free" && items.length >= 25;

  return(<>
    {enableLoans&&(
      <div className="vtog" style={{margin:"0 0 14px"}}>
        <button className={invView==="items"?"on":""} onClick={()=>setInvView("items")}>📦 Inventory</button>
        <button className={invView==="loans"?"on":""} onClick={()=>setInvView("loans")}>🔄 Borrowed & Lent</button>
      </div>
    )}
    {enableLoans&&invView==="loans" ? (
      <div style={{padding:"8px 0 56px"}}><ExternalLoans userId={userId} org={org} items={items}/></div>
    ) : (<>
    {upgradeReason&&<UpgradePrompt reason={upgradeReason} onClose={()=>setUpgradeReason(null)} userId={user?.id} userEmail={user?.email}/>}
    {locFilter!=="all"&&locFilterName&&(
      <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(232,184,93,.1)",border:"1px solid rgba(232,184,93,.3)",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
        <span style={{fontSize:20}}>📦</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14,color:"var(--gold)"}}>{locFilterName.name}{locFilterName.code?` · ${locFilterName.code}`:""}</div>
          <div style={{fontSize:12,color:"var(--t2)",marginTop:1}}>{filtered.length} item{filtered.length!==1?"s":""} in this location</div>
          {locFilterName.description&&<div style={{fontSize:11,color:"var(--t3)",marginTop:1,fontStyle:"italic"}}>{locFilterName.description}</div>}
        </div>
        <button onClick={()=>{setLocFilter("all");setLocFilterName(null);}} style={{background:"none",border:"1px solid rgba(232,184,93,.3)",borderRadius:6,color:"var(--t2)",padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",whiteSpace:"nowrap"}}>Show All</button>
      </div>
    )}
    {headerNote}
    {(nearLimit||atLimit)&&(
      <div style={{background:atLimit?"rgba(194,24,91,.12)":"rgba(212,168,67,.1)",border:"1px solid "+(atLimit?"rgba(194,24,91,.3)":"rgba(212,168,67,.25)"),borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:13,color:atLimit?"var(--red)":"var(--gold)",fontWeight:600}}>
          {atLimit?"⚠️ Item limit reached — upgrade to add more items.":"⚡ "+items.length+"/25 items used on free plan."}
        </span>
        <button className="btn btn-g" style={{padding:"5px 14px",fontSize:12}} onClick={()=>setUpgradeReason("Upgrade to Pro for unlimited inventory, Backstage Exchange access, Stage Points, and more.")}>Upgrade →</button>
      </div>
    )}
    <div style={{position:"relative"}}>
      <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.inventory} w={1400} h={900} className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:240}}>
          <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.inventory} w={1100} h={300} alt="" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📦 Your Collection</div>
            <h1 className="hero-title" style={{fontSize:46}}>Inventory</h1>
            <p className="hero-sub">Every costume, prop, set piece and piece of gear — all in one place.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>
      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
          <div className="srch">{Ic.search}<input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search items, tags, location…"/></div>
          <button className="ico-btn" style={showF?{borderColor:"var(--gold)",color:"var(--cog)"}:{}} onClick={()=>setShowF(!showF)}>{Ic.filter}</button>
          <div className="vtog"><button className={view==="grid"?"on":""} onClick={()=>setView("grid")}>Grid</button><button className={view==="table"?"on":""} onClick={()=>setView("table")}>Table</button><button className={view==="locations"?"on":""} onClick={()=>setView("locations")}>📦 Locations</button></div>
          {canEdit&&<button
            onClick={()=>{ setSelectMode(m=>!m); setSelected(new Set()); setBulkField(""); setBulkValue(""); setBulkMsg(""); }}
            style={{padding:"6px 13px",borderRadius:7,border:"1.5px solid",fontSize:13,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
              borderColor: selectMode?"var(--gold)":"var(--border)",
              background:  selectMode?"rgba(212,168,67,.12)":"transparent",
              color:       selectMode?"var(--gold)":"var(--muted)"}}>
            {selectMode ? ("✓ Selecting "+(selected.size>0?"("+selected.size+")":"")) : "☐ Select"}
          </button>}
          <div style={{marginLeft:"auto",display:"flex",gap:7}}>
            <button className="btn btn-o" style={{fontSize:12,padding:"6px 12px"}} disabled={printingQR}
              onClick={printQRFiltered} title="Print QR labels for visible items">
              {printingQR ? "Generating…" : ("🖨 Print QR" + (filtered.length < items.length ? " ("+filtered.length+")" : ""))}
            </button>
            <button className="btn btn-o" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setShowImport(true)}
              title="Import from CSV">⬆ Import CSV</button>
            {canAdd&&<button className="btn btn-g" onClick={()=>{
              const max=PLANS_DEF[plan]?.maxItems??25;
              if(items.length>=max){setUpgradeReason(EM.planItemLimit.body);return;}
              setActive(null);setModal("a");
            }}><span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add Item</button>}
          </div>
        </div>

        {/* ── Bulk Edit Action Bar — shown when Select Mode is active ── */}
        {selectMode&&canEdit&&(
          <div style={{background:"linear-gradient(135deg,rgba(212,168,67,.1),rgba(212,168,67,.04))",
            border:"1px solid rgba(212,168,67,.35)",borderRadius:10,padding:"12px 16px",
            marginBottom:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            {/* Selection controls */}
            <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
              <button onClick={selectAll}
                style={{padding:"5px 11px",borderRadius:6,border:"1px solid var(--border)",
                  background:"transparent",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                Select All ({filtered.length})
              </button>
              {selected.size>0&&<button onClick={clearSelect}
                style={{padding:"5px 11px",borderRadius:6,border:"1px solid var(--border)",
                  background:"transparent",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                Clear
              </button>}
              {selected.size>0&&<span style={{fontSize:13,fontWeight:700,color:"var(--gold)"}}>
                {selected.size} selected
              </span>}
            </div>

            {/* Auto-categorize — shown when items are selected */}
            {selected.size>0&&(
              <button onClick={autoCategorizeSel} disabled={autoCatRunning}
                title="Use AI to suggest the best category for each selected item based on its name and description"
                style={{padding:"5px 13px",borderRadius:6,border:"1px solid rgba(212,168,67,.4)",
                  background:"rgba(212,168,67,.1)",color:"var(--gold)",fontSize:12,fontWeight:700,
                  cursor:autoCatRunning?"not-allowed":"pointer",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                {autoCatRunning ? "✨ Analyzing…" : "✨ Auto-categorize"}
              </button>
            )}
            {autoCatMsg&&<span style={{fontSize:12,fontWeight:700,
              color:autoCatMsg.startsWith("✅")?"#4caf50":"var(--gold)"}}>{autoCatMsg}</span>}

            {/* Field + value pickers — only show when items are selected */}
            {selected.size>0&&(<>
              <div style={{display:"flex",gap:6,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:700,color:"var(--muted)",whiteSpace:"nowrap"}}>
                  Change:
                </span>
                <select value={bulkField} onChange={e=>{setBulkField(e.target.value);setBulkValue("");}}
                  style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                    background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  <option value="">— pick a field —</option>
                  <option value="category">Category</option>
                  <option value="location">Location</option>
                  <option value="condition">Condition</option>
                  <option value="avail">Availability</option>
                  <option value="mkt">Exchange Status</option>
                </select>

                {bulkField==="category"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick category —</option>
                    {vCATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                  </select>
                )}
                {bulkField==="location"&&(
                  <input value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    placeholder="e.g. Storage Bin 4A"
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit",
                      outline:"none",minWidth:160}}/>
                )}
                {bulkField==="condition"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick condition —</option>
                    {vCONDS.map(c=><option key={c}>{c}</option>)}
                  </select>
                )}
                {bulkField==="avail"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick availability —</option>
                    {vAVAIL.map(a=><option key={a}>{a}</option>)}
                  </select>
                )}
                {bulkField==="mkt"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick status —</option>
                    {vMKT.map(s=><option key={s}>{s}</option>)}
                  </select>
                )}

                {bulkField&&bulkValue&&(
                  <button onClick={applyBulkEdit} disabled={bulkSaving}
                    style={{padding:"6px 16px",borderRadius:7,border:"none",fontFamily:"inherit",
                      fontSize:13,fontWeight:700,cursor:bulkSaving?"not-allowed":"pointer",
                      background:"var(--gold)",color:"#1a0f00"}}>
                    {bulkSaving?"Saving…":"Apply to "+selected.size+" item"+(selected.size!==1?"s":"")}
                  </button>
                )}
              </div>
            </>)}

            {bulkMsg&&<div style={{fontSize:13,fontWeight:700,
              color:bulkMsg.startsWith("✅")?"#4caf50":"#e53935",
              padding:"4px 10px",borderRadius:6,
              background:bulkMsg.startsWith("✅")?"rgba(76,175,80,.1)":"rgba(229,57,53,.08)"}}>
              {bulkMsg}
            </div>}
          </div>
        )}
        {showF&&(
          <div className="fbar fin">
            <div><label>Category</label><select value={catF} onChange={e=>setCatF(e.target.value)}><option value="all">All</option>{vCATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label>Condition</label><select value={condF} onChange={e=>setCondF(e.target.value)}><option value="all">All</option>{vCONDS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label>Availability</label><select value={availF} onChange={e=>setAvailF(e.target.value)}><option value="all">All</option>{vAVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
            <div><label>Exchange Status</label><select value={mktF} onChange={e=>setMktF(e.target.value)}><option value="all">All</option>{vMKT.map(s=><option key={s}>{s}</option>)}</select></div>
            <button className="btn btn-o btn-sm" onClick={()=>{setCatF("all");setCondF("all");setAvailF("all");setMktF("all")}}>Clear</button>
          </div>
        )}
        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>{filtered.length} item{filtered.length!==1?"s":""}</div>
        {view==="grid"&&(paged.length===0
          ?<div className="empty"><div className="empty-ico">{vCfg.icon}</div><h3>No Items Found</h3><p>{items.length===0?"Add your first item to build your catalog.":"Try adjusting search or filters."}</p>{items.length===0&&<button className="btn btn-g" onClick={()=>{setActive(null);setModal("a")}}><span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add First Item</button>}</div>
          :<div className="inv-grid">
              {paged.map(item=>{
                const cat=vCAT[item.category]||vCAT.other||CAT.other;
                return(
                  <div key={item.id} className="inv-card"
                    onClick={()=>selectMode ? toggleSelect(item.id) : openD(item)}
                    style={{position:"relative",...(selectMode?{cursor:"pointer",outline:selected.has(item.id)?"2px solid var(--gold)":"2px solid transparent",outlineOffset:2,background:selected.has(item.id)?"rgba(212,168,67,.06)":""}:{})}}>
                    {selectMode&&<div style={{position:"absolute",top:10,left:10,zIndex:10,width:24,height:24,borderRadius:6,border:"2px solid",borderColor:selected.has(item.id)?"var(--gold)":"rgba(255,255,255,.6)",background:selected.has(item.id)?"var(--gold)":"rgba(0,0,0,.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#1a0f00"}}>{selected.has(item.id)?"✓":""}</div>}
                    <div className="inv-img">{item.img?<img src={item.img} alt={item.name} loading="lazy"/>:<CatCard catId={item.category} width="100%" height={220} vertical={vVertical}><div style={{padding:"0 14px 12px",color:"#fff"}}></div></CatCard>}</div>
                    <div className="inv-body">
                      {schoolName&&<div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:"#42a5f5",marginBottom:4,display:"flex",alignItems:"center",gap:4}}><span>🏫</span>{schoolName}</div>}
                      <div className="inv-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</div>
                      <div className="inv-name">{item.name}</div>
                      {item.location&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:4,display:"flex",alignItems:"center",gap:3}}>📍 {item.location}</div>}
                      <div className="inv-meta">{item.display_id&&<span className="chip" style={{fontFamily:"monospace",fontWeight:800,color:"var(--amber)",letterSpacing:.5}}>{item.display_id}</span>}<span className="chip">{item.condition}</span><span className="chip">×{item.qty}</span>{item.low_stock_threshold>0&&item.qty<=item.low_stock_threshold&&<span className="chip" style={{background:"rgba(230,74,25,.18)",color:"#ff7043",fontWeight:800}}>⚠ Low Stock</span>}{item.size!=="N/A"&&<span className="chip">{item.size}</span>}<span className="chip">{item.avail}</span></div>
                      <div className="inv-foot"><span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span>{item.mkt==="For Loan"?<span style={{fontSize:12,color:"#00838f",fontWeight:700}}>{item.loan_period||2}wk loan{item.deposit>0?" · "+fmt$(item.deposit)+" dep.":""}</span>:item.mkt!=="Not Listed"&&<span className="price">{item.rent>0?fmt$(item.rent)+"/wk":""}{item.rent>0&&item.sale>0?" · ":""}{item.sale>0?fmt$(item.sale):""}</span>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
        )}
        {view==="table"&&(
          <div className="tw">
            <table>
              <thead><tr>
                {selectMode&&<th style={{width:36}}></th>}
                <th style={{width:60}}>#</th><th></th><th>Item</th><th>Category</th><th>Cond.</th><th>Qty</th><th>Location</th><th>Avail.</th><th>Market</th><th></th>
              </tr></thead>
              <tbody>
                {paged.map(item=>{
                  const cat=vCAT[item.category]||vCAT.other||CAT.other;
                  const isSel = selectMode && selected.has(item.id);
                  return(
                    <tr key={item.id} style={isSel?{background:"rgba(212,168,67,.06)"}:{}}
                      onClick={selectMode?()=>toggleSelect(item.id):undefined}
                      className={selectMode?"select-row":""}>
                      {selectMode&&<td style={{width:36,padding:"4px 8px",textAlign:"center"}}>
                        <div style={{width:20,height:20,borderRadius:5,border:"1.5px solid",
                          borderColor:isSel?"var(--gold)":"var(--border)",
                          background:isSel?"var(--gold)":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:12,fontWeight:900,color:"#1a0f00",margin:"0 auto"}}>
                          {isSel?"✓":""}
                        </div>
                      </td>}
                      <td style={{padding:"4px 10px",fontFamily:"monospace",fontSize:12,fontWeight:800,color:"var(--amber)",whiteSpace:"nowrap"}}>{item.display_id||""}</td>
                      <td style={{width:40,padding:"4px 8px"}}>{item.img?<img src={item.img} alt="" style={{width:32,height:32,borderRadius:4,objectFit:"cover"}}/>:<CatThumb catId={item.category} size={32} vertical={vVertical}/>}</td>
                      <td style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:15,cursor:"pointer",color:"var(--ink)"}} onClick={selectMode?undefined:()=>openD(item)}>{item.name}</td>
                      <td style={{fontWeight:700,color:"var(--muted)"}}>{cat.icon} {cat.label}</td>
                      <td>{item.condition}</td><td style={{fontWeight:800}}>{item.qty}</td>
                      <td style={{color:"var(--muted)"}}>
                        {schoolName&&<div style={{fontSize:10,fontWeight:800,color:"#42a5f5",marginBottom:2}}>🏫 {schoolName}</div>}
                        {item.location||"—"}
                      </td>
                      <td>{item.avail}</td>
                      <td><span className={"mkt-badge "+mktCls(item.mkt)}>{item.mkt}</span></td>
                      <td><div style={{display:"flex",gap:4}}>
                        {!selectMode&&<button className="ico-btn" onClick={e=>{e.stopPropagation();openE(item)}}>{Ic.edit}</button>}
                        {!selectMode&&canDelete&&<button className="ico-btn" style={{color:"var(--red)"}} onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))onDelete(item.id)}}>{Ic.trash}</button>}
                      </div></td>
                    </tr>
                  );
                })}
                {paged.length===0&&<tr><td colSpan={selectMode?10:9} style={{textAlign:"center",color:"var(--faint)",padding:40,fontFamily:"'Lora',serif",fontStyle:"italic"}}>No items found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pager total={filtered.length} page={pg} per={PP} onPage={setPg}/>
      </div>
      {view==="locations"&&<LocationsPanel
        userId={userId}
        items={items}
        onEditItem={item=>{setActive(item);setModal("e");}}
        onDeleteItem={id=>{onDelete(id);}}
      />}
      {modal==="a"&&(<Modal title="Add New Item" onClose={()=>setModal(null)}
         >
          <ItemForm onSave={handleSave} onCancel={()=>setModal(null)} userId={userId} marketplaceEnabled={!!org?.marketplace_enabled} vertical={org?.vertical||"theatre"}/>
        </Modal>)}
      {modal==="e"&&active&&(<Modal title="Edit Item" onClose={()=>setModal(null)}
         >
          <ItemForm item={active} onSave={handleSave} onCancel={()=>setModal(null)} userId={userId} marketplaceEnabled={!!org?.marketplace_enabled} vertical={org?.vertical||"theatre"}/>
        </Modal>)}
      {modal==="d"&&active&&<Modal title="Item Details" onClose={()=>{setModal(null);setActive(null)}}><ItemDetail item={active} userId={userId} schoolName={schoolName} onEdit={canEdit?()=>setModal("e"):null} onDelete={canDelete?(id=>{onDelete(id);setModal(null);setActive(null)}):null} canEdit={canEdit} canDelete={canDelete}/></Modal>}
      {showImport&&<CSVImport userId={userId} onClose={()=>setShowImport(false)} onImport={async()=>{setShowImport(false);const{data}=await SB.from("items").select("*").eq("org_id",user?.id).order("added",{ascending:false});if(data)setItems(data);}}/>}
    </div>
    </>)}
  </>
  );
}
function Marketplace({items,org,plan="free",activeSchool=null,allSchoolsMode=false,onEdit=null,onDelete=null}){
  const[search,   setSrch]    = useState("");
  const[catF,     setCatF]    = useState("all");
  const[typeF,    setTypeF]   = useState("all");
  const[mktTab,   setMktTab]  = useState("browse"); // "browse" | "mine"
  const[pg,       setPg]      = useState(1);
  const[viewing,   setViewing]   = useState(null);
  const[editingItem,setEditingItem]= useState(null); // editing own item from Exchange
  const[contactItem,setContactItem] = useState(null);
  const[requestItem, setRequestItem]  = useState(null);
  // Location search
  const[zipInput, setZipInput]= useState(org?.zipcode||"");
  const[radius,   setRadius]  = useState("25");   // miles or "state" or "all"
  const[userCoords,setUserCoords]=useState(null); // {lat,lng,state}
  const[geoLoading,setGeoLoading]=useState(false);
  const[geoErr,   setGeoErr]  = useState("");
  // Cross-org listings
  const[allListings, setAllListings] = useState([]); // [{...item, org_name, org_state, org_lat, org_lng, org_zipcode}]
  const[loadingAll,  setLoadingAll]  = useState(false);
  const PP=16;
  const mktCls=m=>m==="For Rent"?"mb-rent":m==="For Sale"?"mb-sale":m==="For Loan"?"mb-loan":"mb-both";

  // Load ALL marketplace listings from ALL orgs (cross-org)
  const loadAllListings = useCallback(async()=>{
    setLoadingAll(true);
    // Join items with org info in one query
    const{data,error}=await SB.from("items")
      .select("*, orgs(name,location,state,zipcode,lat,lng,marketplace_enabled,vertical)")
      .neq("mkt","Not Listed")
      .neq("mkt","Private")
      .eq("avail","In Stock")
      .order("added",{ascending:false});
    if(!error&&data){
      const flat=data
        .filter(i=>i.orgs?.marketplace_enabled !== false)
        .map(i=>({
        ...i,
        org_name:    i.orgs?.name     || "Unknown Program",
        org_location:i.orgs?.location || "",
        org_state:   i.orgs?.state    || "",
        org_zipcode: i.orgs?.zipcode  || "",
        org_lat:     i.orgs?.lat      || null,
        org_lng:     i.orgs?.lng      || null,
        org_vertical:i.orgs?.vertical || "theatre",
      }));
      setAllListings(flat);
    }
    setLoadingAll(false);
  },[]);

  useEffect(()=>{ if(plan!=="free") loadAllListings(); },[plan,loadAllListings]);

  // Geocode zip when user clicks search or changes zip
  const applyZip = useCallback(async(zip)=>{
    if(!zip||zip.length<5){setUserCoords(null);return;}
    setGeoLoading(true);setGeoErr("");
    const coords=await zipToCoords(zip.trim());
    if(coords){ setUserCoords(coords); }
    else { setGeoErr("Zip code not found. Try again."); setUserCoords(null); }
    setGeoLoading(false);
  },[]);

  // Pre-load org zip if set
  useEffect(()=>{ if(org?.zipcode) applyZip(org.zipcode); },[org?.zipcode]);

  // Filter logic
  const filtered = useMemo(()=>{
    // "mine" tab = own items only
    const source = mktTab==="mine"
      ? allListings.filter(i=>i.org_id===org?.id)
      : allListings;

    let f=source;

    // Vertical: only show listings from programs of the same type
    const myVertical = org?.vertical || "theatre";
    f = f.filter(i => (i.vertical || i.org_vertical || "theatre") === myVertical);

    // Text search
    if(search){
      const q=search.toLowerCase();
      f=f.filter(i=>i.name.toLowerCase().includes(q)||
        (i.notes||"").toLowerCase().includes(q)||
        (i.org_name||"").toLowerCase().includes(q)||
        (i.tags||[]).some(t=>t.includes(q)));
    }

    // Category
    if(catF!=="all") f=f.filter(i=>i.category===catF);

    // Type
    if(typeF==="rent") f=f.filter(i=>i.mkt.includes("Rent"));
    if(typeF==="sale") f=f.filter(i=>i.mkt.includes("Sale"));
    if(typeF==="loan") f=f.filter(i=>i.mkt==="For Loan");

    // Location filter
    if(radius==="state"&&userCoords?.state){
      f=f.filter(i=>i.org_state===userCoords.state||!i.org_state);
    } else if(radius!=="all"&&userCoords?.lat&&userCoords?.lng){
      const miles=parseFloat(radius);
      f=f.filter(i=>{
        if(!i.org_lat||!i.org_lng) return true; // orgs without coords shown
        return milesBetween(userCoords.lat,userCoords.lng,i.org_lat,i.org_lng)<=miles;
      });
    }

    // Sort: own items first, then by distance if we have coords
    if(userCoords?.lat&&radius!=="all"&&radius!=="state"){
      f=[...f].sort((a,b)=>{
        const da=a.org_lat?milesBetween(userCoords.lat,userCoords.lng,a.org_lat,a.org_lng):9999;
        const db=b.org_lat?milesBetween(userCoords.lat,userCoords.lng,b.org_lat,b.org_lng):9999;
        return da-db;
      });
    }

    return f;
  },[allListings,mktTab,search,catF,typeF,radius,userCoords,org?.id]);

  const paged=useMemo(()=>filtered.slice((pg-1)*PP,pg*PP),[filtered,pg]);
  useEffect(()=>setPg(1),[search,catF,typeF,radius,userCoords,mktTab]);

  if(plan==="free") return(
    <div style={{padding:"40px 20px",textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:14}}>🏪</div>
      <h2 style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:22,marginBottom:10}}>Backstage Exchange is a Pro Feature</h2>
      <p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 24px",lineHeight:1.6}}>Share selected items with other programs — rent, sell, or loan. Upgrade to Pro to join Backstage Exchange.</p>
      <UpgradePlans compact={true} userId={userId} userEmail={userEmail}/>
    </div>
  );

  return(
    <div style={{position:"relative"}}>
      <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1400} h={900} className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:280}}>
          <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1100} h={340} alt="" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🏪 {getExchangeName(org?.vertical)}</div>
            <h1 className="hero-title" style={{fontSize:46}}>{getExchangeName(org?.vertical)}</h1>
            <p className="hero-sub">Rent, sell, or loan items with programs near you. Give your assets a second life.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>

        {/* ── Location Search Bar ── */}
        <div className="card card-p" style={{marginBottom:18,padding:"14px 18px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            <div style={{flex:"0 0 auto"}}>
              <label style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>📍 Your Zip Code</label>
              <div style={{display:"flex",gap:6}}>
                <input
                  value={zipInput}
                  onChange={e=>setZipInput(e.target.value.replace(/[^0-9]/g,"").slice(0,5))}
                  onKeyDown={e=>e.key==="Enter"&&applyZip(zipInput)}
                  placeholder="e.g. 92648"
                  style={{width:110,background:"var(--parch)",border:"1.5px solid var(--border)",borderRadius:6,padding:"7px 10px",fontSize:14,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",outline:"none"}}
                  maxLength={5}
                />
                <button className="btn btn-g btn-sm" onClick={()=>applyZip(zipInput)} disabled={geoLoading}>
                  {geoLoading?"…":"Search"}
                </button>
              </div>
              {geoErr&&<div style={{fontSize:11,color:"var(--red)",marginTop:3}}>{geoErr}</div>}
              {userCoords&&<div style={{fontSize:11,color:"var(--green)",marginTop:3}}>📍 {userCoords.city}, {userCoords.state}</div>}
            </div>
            <div style={{flex:"0 0 auto"}}>
              <label style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Radius</label>
              <div style={{display:"flex",gap:4}}>
                {[["10","10 mi"],["25","25 mi"],["50","50 mi"],["100","100 mi"],["state","Statewide"],["all","All"]].map(([v,l])=>(
                  <button key={v}
                    onClick={()=>setRadius(v)}
                    style={{padding:"6px 10px",fontSize:12,fontWeight:700,borderRadius:6,cursor:"pointer",fontFamily:"'Raleway',sans-serif",border:"1.5px solid",
                      background:radius===v?"var(--ink)":"transparent",
                      color:radius===v?"var(--gold)":"var(--muted)",
                      borderColor:radius===v?"var(--ink)":"var(--border)",
                      transition:"all .15s"}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{flex:1,minWidth:180}}>
              <label style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Search Items</label>
              <div className="srch" style={{width:"100%",maxWidth:"100%"}}>
                {Ic.search}
                <input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Costumes, props, lighting…" style={{width:"100%"}}/>
              </div>
            </div>
          </div>
          {userCoords&&radius!=="all"&&radius!=="state"&&(
            <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>
              Showing listings within <strong>{radius} miles</strong> of {userCoords.city}, {userCoords.state}
              {!userCoords.lat&&" — add your zip to Profile for precise distance filtering"}
            </div>
          )}
          {radius==="state"&&userCoords?.state&&(
            <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>
              Showing listings in <strong>{STATE_NAMES[userCoords.state]||userCoords.state}</strong>
            </div>
          )}
        </div>

        {/* ── Tabs + Filters ── */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
          <div className="vtog">
            <button className={mktTab==="browse"?"on":""} onClick={()=>setMktTab("browse")}>🌐 Browse All</button>
            <button className={mktTab==="mine"?"on":""} onClick={()=>setMktTab("mine")}>🏫 My Listings</button>
            {allSchoolsMode&&<button className={mktTab==="district"?"on":""} onClick={()=>setMktTab("district")}>🏢 District</button>}
            <button className={mktTab==="external"?"on":""} onClick={()=>setMktTab("external")}>🔄 Borrowed & Lent</button>
          </div>
          {mktTab!=="external"&&(<>
          <select style={{background:"rgba(253,246,236,.9)",border:"1.5px solid var(--border)",borderRadius:"var(--r)",padding:"7px 10px",fontSize:13,fontWeight:700,color:"var(--ink)",fontFamily:"'Raleway',sans-serif",outline:"none"}}
            value={catF} onChange={e=>setCatF(e.target.value)}>
            <option value="all">All Categories</option>
            {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="vtog">
            <button className={typeF==="all"?"on":""} onClick={()=>setTypeF("all")}>All</button>
            <button className={typeF==="rent"?"on":""} onClick={()=>setTypeF("rent")}>Rent</button>
            <button className={typeF==="sale"?"on":""} onClick={()=>setTypeF("sale")}>Sale</button>
            <button className={typeF==="loan"?"on":""} onClick={()=>setTypeF("loan")}>Loan</button>
          </div>
          </>)}
        </div>

        {mktTab!=="external" ? (<>
        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>
          {loadingAll?"Loading listings…":(filtered.length+" listing"+(filtered.length!==1?"s":""))}
          {userCoords&&radius!=="all"&&!loadingAll&&(" within "+(radius==="state"?STATE_NAMES[userCoords.state]||userCoords.state:radius+" miles"))}
        </div>

        {/* ── Listings Grid ── */}
        {paged.length===0
          ?<div className="empty">
              <div className="empty-ico">🏪</div>
              <h3>{mktTab==="mine"?"No Active Listings":"No Listings Found"}</h3>
              <p>{mktTab==="mine"
                ?"Mark items as “For Rent” or “For Sale” in Inventory to list them here."
                :radius!=="all"
                  ?"Try expanding your search radius or searching All to see listings everywhere."
                  :"No listings yet — be the first to list items for your community!"}</p>
            </div>
          :<div className="inv-grid">
            {paged.map(item=>{
              const cat=CAT[item.category]||CAT.other;
              const isOwn = item.org_id===org?.id;
              const dist = userCoords?.lat&&item.org_lat
                ? Math.round(milesBetween(userCoords.lat,userCoords.lng,item.org_lat,item.org_lng))
                : null;
              return(
                <div key={item.id} className="inv-card" onClick={()=>setViewing(item)}>
                  {/* Org header */}
                  <div style={{padding:"7px 14px",background:isOwn?"rgba(196,118,26,.12)":"var(--parch)",borderBottom:"1px solid var(--linen)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div style={{fontSize:11,fontWeight:800,color:isOwn?"var(--amber)":"var(--muted)",textTransform:"uppercase",letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {isOwn?"⭐ Your Listing":item.org_name}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                      {item.org_state&&<span style={{fontSize:10,fontWeight:700,color:"var(--faint)"}}>{item.org_state}</span>}
                      {dist!==null&&!isOwn&&<span style={{fontSize:10,fontWeight:700,color:"var(--amber)",background:"rgba(196,118,26,.1)",padding:"1px 6px",borderRadius:8}}>~{dist}mi</span>}
                    </div>
                  </div>
                  <div className="inv-img">{item.img
                    ?<img src={item.img} alt={item.name} loading="lazy"/>
                    :<CatCard catId={item.category} width="100%" height={220}><div style={{padding:"0 14px 12px",color:"#fff"}}></div></CatCard>}
                  </div>
                  <div className="inv-body">
                    <div className="inv-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</div>
                    <div className="inv-name">{item.name}</div>
                    {item.notes&&<p style={{fontFamily:"'Lora',serif",fontStyle:"italic",fontSize:14,color:"var(--muted)",margin:"3px 0 8px",lineHeight:1.5}}>{item.notes.slice(0,80)}{item.notes.length>80?"…":""}</p>}
                    {item.org_location&&!isOwn&&<div style={{fontSize:11,color:"var(--faint)",marginBottom:4}}>📍 {item.org_location}</div>}
                    <div className="inv-meta"><span className="chip">{item.condition}</span><span className="chip">×{item.qty}</span></div>
                    <div className="inv-foot">
                      <span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span>
                      {item.mkt==="For Loan"?<span style={{fontSize:12,color:"#00838f",fontWeight:700}}>{item.loan_period||2}wk loan{item.deposit>0?" · "+fmt$(item.deposit)+" dep.":""}</span>:<span className="price">{item.rent>0?fmt$(item.rent)+"/wk":""}{item.rent>0&&item.sale>0?" · ":""}{item.sale>0?fmt$(item.sale):""}</span>}
                    </div>
                    {!isOwn&&<div style={{display:"flex",gap:6,marginTop:8}}>
                      <button className="btn btn-g btn-sm" style={{flex:1,fontSize:12}}
                        onClick={e=>{e.stopPropagation();setRequestItem(item);}}>
                        📋 Request
                      </button>
                      <button className="btn btn-o btn-sm" style={{flex:1,fontSize:12}}
                        onClick={e=>{e.stopPropagation();setContactItem(item);}}>
                        💬 Message
                      </button>
                      <FbShareBtn url={itemShareUrl(item)} text={itemShareText(item,item.org_name)} compact={true}/>
                    </div>}
                    {isOwn&&<div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}>
                      <FbShareBtn url={itemShareUrl(item)} text={itemShareText(item,org?.name)} compact={true}
                        label="Share Your Listing"/>
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        }
        <Pager total={filtered.length} page={pg} per={PP} onPage={setPg}/>
        </>) : <div style={{marginTop:4}}><ExternalLoans userId={org?.id} org={org} items={items}/></div>}
      </div>
      {viewing&&<Modal title="Listing Details" onClose={()=>setViewing(null)}>
        <ItemDetail item={viewing}
          onEdit={viewing.org_id===org?.id&&onEdit ? ()=>{setEditingItem(viewing);setViewing(null);} : null}
          onDelete={viewing.org_id===org?.id&&onDelete ? id=>{onDelete(id);setViewing(null);} : null}
          canEdit={viewing.org_id===org?.id}
          canDelete={viewing.org_id===org?.id}
          schoolName={viewing.org_name&&viewing.org_id!==org?.id?viewing.org_name:null}/>
      </Modal>}
      {editingItem&&<Modal title="Edit Item" onClose={()=>setEditingItem(null)}>
        <ItemForm item={editingItem} onSave={async(form)=>{
          if(onEdit){
            // Merge form over base item, then strip any joined org_ fields before saving
            const merged={...editingItem,...form,id:editingItem.id};
            Object.keys(merged).forEach(k=>{ if(k.startsWith('org_')||k==='orgs') delete merged[k]; });
            await onEdit(merged); setEditingItem(null);
          }
        }} onCancel={()=>setEditingItem(null)} userId={org?.id} marketplaceEnabled={!!org?.marketplace_enabled}/>
      </Modal>}
      {contactItem&&<NewConversationModal
        item={contactItem}
        itemOrgId={contactItem.org_id}
        itemOrgName={contactItem.org_name}
        currentUserId={org?.id}
        currentOrgName={org?.name}
        onOpen={convId=>{setOpenConvId(convId); window.__t4u_nav_messages&&window.__t4u_nav_messages(convId);}}
        onClose={()=>setContactItem(null)}
      />}
      {requestItem&&<RequestItemModal
        item={requestItem}
        currentUserId={org?.id}
        currentOrgName={org?.name}
        currentOrgEmail={org?.email}
        onClose={()=>setRequestItem(null)}
        onSuccess={()=>{ window.__t4u_nav_requests&&window.__t4u_nav_requests(); }}
      />}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// RENTAL REQUEST FLOW
// ══════════════════════════════════════════════════════════════════════════════

const NOTIFY_URL = "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/request-notify";

async function notifyRequest(type, requestId) {
  try {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) return;
    fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ type, request_id: requestId })
    });
  } catch {}
}

// ── Request Form Modal ────────────────────────────────────────────────────────
function RequestItemModal({ item, currentUserId, currentOrgName, currentOrgEmail, onClose, onSuccess, plan="free" }) {
  const today     = new Date().toISOString().slice(0,10);
  const isRent    = item.mkt === "For Rent" || item.mkt === "Rent or Sale";
  const isLoan    = item.mkt === "For Loan";
  const isSale    = item.mkt === "For Sale" || item.mkt === "Rent or Sale";
  const isBoth    = item.mkt === "Rent or Sale";
  const [type,    setType]    = useState(isRent?"rent":isLoan?"loan":"buy");
  const [start,   setStart]   = useState(today);
  const [end,     setEnd]     = useState("");
  const [qty,     setQty]     = useState(1);
  const [msg,     setMsg]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [err,       setErr]       = useState("");
  const [conflict,  setConflict]  = useState(false);
  const [blocks,    setBlocks]    = useState([]);
  const [myCredits, setMyCredits] = useState(0);
  const [useCredits,setUseCredits]= useState(false);
  const [creditAmt, setCreditAmt] = useState(0);
  const needsDates = type !== "buy";

  // Load availability blocks + my point balance
  useEffect(()=>{
    SB.from("availability_blocks").select("*").eq("item_id", item.id)
      .then(({data})=>setBlocks(data||[]));
    SB.rpc("get_my_credit_balance").then(({data})=>setMyCredits(data||0));
  },[item.id]);

  // Recalculate credit amount when toggled (50% cap, whole credits only)
  useEffect(()=>{
    if(!useCredits||type==="loan") { setCreditAmt(0); return; }
    const price = type==="rent" ? (item.rent||0) : (item.sale||0);
    const maxCreditCover = Math.floor(price * 0.5);
    setCreditAmt(Math.min(myCredits, maxCreditCover));
  },[useCredits, type, item.rent, item.sale, myCredits]);

  // Check if selected dates conflict with blocks
  useEffect(()=>{
    if (!start || !end || !needsDates) { setConflict(false); return; }
    const s = new Date(start), e = new Date(end);
    const hasConflict = blocks.some(b => {
      const bs = new Date(b.start_date), be = new Date(b.end_date);
      return s <= be && e >= bs;
    });
    setConflict(hasConflict);
  },[start,end,blocks,needsDates]);

  const submit = async () => {
    if (!msg.trim()) { setErr("Please include a message to the owner."); return; }
    if (needsDates && (!start || !end)) { setErr("Please select start and end dates."); return; }
    if (needsDates && end < start) { setErr("End date must be after start date."); return; }
    setSending(true); setErr("");
    const basePrice = type==="rent" ? item.rent : type==="loan" ? (item.deposit||0) : item.sale;
    const finalPrice = Math.max(0, basePrice - creditAmt);
    // Platform fee: 8% on rental and sale only (not loans)
    const platformFee = (type==="loan") ? 0 : Math.max(0, parseFloat((basePrice * PLATFORM_FEE_PCT).toFixed(2)));
    const platformFeeCents = Math.round(platformFee * 100);

    // Spend credits atomically if using them
    if(creditAmt > 0 && useCredits) {
      const{data:spendResult}=await SB.rpc("spend_credits",{
        p_org_id: currentUserId, p_amount: creditAmt,
        p_type: "spend_rental",
        p_description: `Applied ${creditAmt} credits to ${item.name} ${type}`,
        p_item_id: item.id
      });
      if(!spendResult?.success){ setErr(spendResult?.error||"Could not apply credits."); setSending(false); return; }
    }

    const { data, error } = await SB.from("rental_requests").insert({
      item_id:        item.id,
      item_name:      item.name,
      item_type:      type,
      owner_id:       item.org_id,
      requester_id:   currentUserId,
      requester_name: currentOrgName,
      requester_email:currentOrgEmail,
      start_date:     needsDates ? start : null,
      end_date:       needsDates ? end   : null,
      qty_requested:  qty,
      message:        msg.trim() + (creditAmt>0?`

[${creditAmt} Stage Points applied — cash due: $${finalPrice.toFixed(2)}]`:"") + (platformFee>0?`

[8% platform fee: $${platformFee.toFixed(2)} payable to Theatre4u — instructions will follow by email]`:""),
      agreed_price:        finalPrice,
      platform_fee_cents:  platformFeeCents,
      status:              "pending",
    }).select().single();
    if (error) { setErr(EM.requestSend.body); setSending(false); return; }
    // Award first_request milestone points (one-time, idempotent)
    SB.rpc("award_milestone_points", {
      p_org_id: currentUserId, p_type: "first_request",
      p_amount: MILESTONE_POINTS.first_request.pts,
      p_desc: "First Exchange request sent"
    }).catch(()=>{});
    notifyRequest("new_request", data.id);
    onSuccess?.();
    onClose();
    setSending(false);
  };

  const paymentNote = type === "loan"
    ? null
    : `By submitting this request, you agree that any agreed cash payment will be made directly to the item owner outside of Theatre4u. Artstracker LLC does not process or guarantee payments between organizations.`;

  const typeColor = { rent:"#1554a0", loan:"#00838f", buy:"#27723a" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>

      {plan==="free" ? (
        <div style={{background:"var(--bg2,#15121b)",border:"1px solid rgba(212,168,67,.3)",
          borderRadius:14,padding:32,maxWidth:420,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>🔒</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:8,color:"var(--gold)"}}>
            Pro Required for Exchange
          </div>
          <p style={{fontSize:14,color:"var(--muted)",lineHeight:1.7,marginBottom:20}}>
            Sending and receiving Exchange requests requires a Pro or District plan.
            Upgrade to connect with nearby programs and start sharing resources.
          </p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn btn-g" onClick={()=>{onClose();setTimeout(()=>window.__t4u_nav_upgrade?.(),100);}}>
              Upgrade to Pro →
            </button>
            <button className="btn btn-o" onClick={onClose}>Maybe Later</button>
          </div>
          <p style={{fontSize:11,color:"var(--faint)",marginTop:12}}>
            Pro: $15/mo · Unlimited inventory · Full Exchange access · Stage Points
          </p>
        </div>
      ) : (
        <div style={{width:"100%",maxWidth:500,background:"var(--cream)",border:"1px solid var(--border)",
          borderRadius:14,overflow:"hidden",boxShadow:"0 12px 48px rgba(0,0,0,.4)",animation:"su .2s ease",maxHeight:"90vh",overflowY:"auto"}}>

          {/* Header */}
          <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",
            background:"var(--parch)",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700}}>Request Item</div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{item.name}</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"1px solid var(--border)",
              color:"var(--muted)",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:"inherit",
              fontSize:18,lineHeight:1}}>×</button>
          </div>

          <div style={{padding:18,display:"flex",flexDirection:"column",gap:14}}>
            {/* Type selector */}
            {isBoth && (
              <div>
                <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:6}}>Request Type</label>
                <div style={{display:"flex",gap:8}}>
                  {[["rent","🔑 Rent"],["buy","🛒 Buy"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setType(v)}
                      style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",
                        fontWeight:700,fontSize:13,border:"2px solid",transition:"all .15s",
                        background:type===v?typeColor[v]:"transparent",
                        color:type===v?"#fff":"var(--muted)",
                        borderColor:type===v?typeColor[v]:"var(--border)"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date range */}
            {needsDates && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Start Date</label>
                  <input type="date" value={start} min={today}
                    onChange={e=>setStart(e.target.value)}
                    style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
                      borderRadius:7,padding:"8px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                      color:"var(--ink)",outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>End Date</label>
                  <input type="date" value={end} min={start||today}
                    onChange={e=>setEnd(e.target.value)}
                    style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
                      borderRadius:7,padding:"8px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                      color:"var(--ink)",outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
            )}

            {/* Conflict warning */}
            {conflict && (
              <div style={{background:"rgba(194,24,91,.08)",border:"1px solid rgba(194,24,91,.25)",
                borderRadius:8,padding:"10px 12px",fontSize:12,color:"#c2185b",display:"flex",gap:8}}>
                <span>⚠️</span>
                <span>These dates overlap with an existing booking. The owner may not be able to fulfil your request for these exact dates.</span>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Quantity</label>
              <input type="number" value={qty} min={1} max={item.qty||99}
                onChange={e=>setQty(Math.max(1,parseInt(e.target.value)||1))}
                style={{width:80,background:"var(--parch)",border:"1.5px solid var(--border)",
                  borderRadius:7,padding:"8px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                  color:"var(--ink)",outline:"none"}}/>
              <span style={{fontSize:12,color:"var(--muted)",marginLeft:8}}>{item.qty} available</span>
            </div>

            {/* Pricing summary */}
            {(item.rent>0||item.sale>0||item.deposit>0) && (
              <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",fontSize:13}}>
                {type==="rent"&&item.rent>0&&<div>Rental rate: <strong style={{color:"var(--cog)"}}>{fmt$(item.rent)}/week</strong></div>}
                {type==="buy" &&item.sale>0&&<div>Sale price:  <strong style={{color:"var(--cog)"}}>{fmt$(item.sale)}</strong></div>}
                {type==="loan"&&<div>Free loan{item.deposit>0?` · Deposit: ${fmt$(item.deposit)}`:""}</div>}
                {type==="loan"&&item.loan_period&&<div style={{color:"var(--muted)",fontSize:12,marginTop:2}}>Loan period: {item.loan_period} days</div>}
                {platformFee>0&&<div style={{marginTop:4,fontSize:12,color:"var(--muted)"}}>8% platform fee: <strong>{fmt$(platformFee)}</strong> payable to Theatre4u</div>}
              </div>
            )}

            {/* Stage Points toggle */}
            {myCredits > 0 && type !== "loan" && (item.rent > 0 || item.sale > 0) && (
              <div style={{background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.25)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:useCredits&&creditAmt>0?10:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>🪙</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"var(--gold)"}}>Apply Stage Points</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>You have {myCredits.toLocaleString()} points available</div>
                    </div>
                  </div>
                  <label style={{position:"relative",display:"inline-block",width:42,height:24,cursor:"pointer"}}>
                    <input type="checkbox" checked={useCredits} onChange={e=>setUseCredits(e.target.checked)}
                      style={{opacity:0,width:0,height:0}}/>
                    <span style={{position:"absolute",inset:0,background:useCredits?"var(--green)":"var(--border)",borderRadius:12,transition:".25s"}}>
                      <span style={{position:"absolute",height:18,width:18,left:useCredits?20:3,bottom:3,background:"#fff",borderRadius:"50%",transition:".25s"}}/>
                    </span>
                  </label>
                </div>
                {useCredits && creditAmt > 0 && (
                  <div style={{background:"rgba(0,0,0,.04)",borderRadius:7,padding:"8px 10px",fontSize:13}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{color:"var(--muted)"}}>Original price</span>
                      <span style={{fontWeight:700}}>${type==="rent"?(item.rent||0).toFixed(2):(item.sale||0).toFixed(2)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,color:"var(--green)"}}>
                      <span>Points applied ({creditAmt})</span>
                      <span style={{fontWeight:700}}>−${creditAmt.toFixed(2)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:"1px solid var(--border)"}}>
                      <span style={{fontWeight:800}}>Cash due to owner</span>
                      <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"var(--cog)",fontWeight:700}}>${Math.max(0,(type==="rent"?item.rent:item.sale)-creditAmt).toFixed(2)}</span>
                    </div>
                    <div style={{fontSize:12,color:"var(--red)",fontWeight:600,marginTop:8,padding:"7px 10px",background:"rgba(194,24,91,.06)",borderRadius:6}}>
                      ⚠️ <strong>Payment responsibility:</strong> The cash balance above must be paid <strong>directly to the item owner</strong> outside of Theatre4u. Artstracker LLC does not process or guarantee payments between organizations.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message */}
            <div>
              <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Message to Owner *</label>
              <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={3}
                placeholder={needsDates
                  ?"Hi! We're interested in this item for our Spring production. Is it available for those dates?"
                  :"Hi! We'd like to purchase this item. Is it still available?"}
                style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
                  borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                  color:"var(--ink)",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            </div>

            {err && <div style={{color:"var(--red)",fontSize:12,background:"rgba(194,24,91,.06)",
              border:"1px solid rgba(194,24,91,.2)",borderRadius:6,padding:"8px 11px"}}>{err}</div>}

            {paymentNote && (
              <div style={{fontSize:11.5,color:"var(--muted)",lineHeight:1.6,padding:"8px 11px",background:"var(--parch)",border:"1px solid var(--border)",borderRadius:7}}>
                💳 <strong style={{color:"var(--ink)"}}>Payment note:</strong> {paymentNote}
              </div>
            )}

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn btn-o" onClick={onClose}>Cancel</button>
              <button className="btn btn-g" onClick={submit} disabled={sending||!msg.trim()}>
                {sending?"Sending…":"Send Request →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTION DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

const DOC_TYPES = {
  rental_agreement:        { label:"Rental Agreement",          icon:"📄", color:"#1554a0" },
  loan_agreement:          { label:"Loan Agreement",            icon:"🤝", color:"#00838f" },
  bill_of_sale:            { label:"Bill of Sale",              icon:"🧾", color:"#27723a" },
  condition_report_pickup: { label:"Condition Report — Pickup", icon:"🔍", color:"#d35400" },
  condition_report_return: { label:"Condition Report — Return", icon:"📦", color:"#7b1fa2" },
};

// ── Document Form ─────────────────────────────────────────────────────────────
function TransactionDocForm({ req, docType, existing, org, onSave, onCancel }) {
  const dt = DOC_TYPES[docType];
  const isCondition = docType.startsWith("condition_report");
  const isRental    = docType === "rental_agreement";
  const isLoan      = docType === "loan_agreement";
  const isSale      = docType === "bill_of_sale";

  const [f, setF] = useState(() => existing || {
    type:             docType,
    request_id:       req.id,
    lender_name:      req.ownerOrg?.name || "",
    lender_email:     req.ownerOrg?.email || "",
    lender_phone:     "",
    lender_address:   "",
    borrower_name:    req.requesterOrg?.name || req.requester_name || "",
    borrower_email:   req.requesterOrg?.email || req.requester_email || "",
    borrower_phone:   "",
    borrower_address: "",
    item_name:        req.item_name || "",
    item_description: "",
    item_condition:   "",
    item_qty:         req.qty_requested || 1,
    item_value:       "",
    start_date:       req.start_date || "",
    end_date:         req.end_date || "",
    agreed_price:     req.agreed_price || "",
    deposit_amount:   "",
    late_fee_per_day: "",
    payment_method:   "",
    special_terms:    "",
    condition_notes:  "",
    condition_rating: "",
    lender_signed_name:  "",
    borrower_signed_name: "",
    notes: "",
  });

  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onSave(f);
    setSaving(false);
  };

  return (
    <div>
      {/* Header banner */}
      <div style={{ background:`linear-gradient(135deg,${dt.color},${dt.color}cc)`,
        borderRadius:10, padding:"14px 18px", marginBottom:20, display:"flex",
        alignItems:"center", gap:12 }}>
        <span style={{ fontSize:30 }}>{dt.icon}</span>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"#fff" }}>{dt.label}</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:2 }}>
            {req.item_name} · {req.ownerOrg?.name || "Owner"} → {req.requesterOrg?.name || req.requester_name || "Borrower"}
          </div>
        </div>
      </div>

      {!isCondition && <>
        {/* Parties */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
              color:"var(--muted)", marginBottom:8 }}>
              {isSale ? "Seller" : "Lender / Owner"}
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Organization Name</label>
              <input className="fi" value={f.lender_name} onChange={e=>upd("lender_name",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" value={f.lender_email} onChange={e=>upd("lender_email",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Phone</label>
              <input className="fi" value={f.lender_phone} onChange={e=>upd("lender_phone",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Address</label>
              <textarea className="ft" value={f.lender_address} onChange={e=>upd("lender_address",e.target.value)}
                placeholder="Street, City, State, Zip" style={{ minHeight:60 }}/>
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
              color:"var(--muted)", marginBottom:8 }}>
              {isSale ? "Buyer" : "Borrower / Requester"}
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Organization Name</label>
              <input className="fi" value={f.borrower_name} onChange={e=>upd("borrower_name",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" value={f.borrower_email} onChange={e=>upd("borrower_email",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Phone</label>
              <input className="fi" value={f.borrower_phone} onChange={e=>upd("borrower_phone",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Address</label>
              <textarea className="ft" value={f.borrower_address} onChange={e=>upd("borrower_address",e.target.value)}
                placeholder="Street, City, State, Zip" style={{ minHeight:60 }}/>
            </div>
          </div>
        </div>

        {/* Item Details */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:16, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
            color:"var(--muted)", marginBottom:10 }}>Item Details</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Item Name</label>
              <input className="fi" value={f.item_name} onChange={e=>upd("item_name",e.target.value)}/>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Description / Identifying Details</label>
              <textarea className="ft" value={f.item_description} onChange={e=>upd("item_description",e.target.value)}
                placeholder="Color, size, serial number, distinguishing features…" style={{ minHeight:56 }}/>
            </div>
            <div className="fg">
              <label className="fl">Condition at Time of Agreement</label>
              <select className="fs" value={f.item_condition} onChange={e=>upd("item_condition",e.target.value)}>
                <option value="">Select…</option>
                {["Excellent","Good","Fair","Poor"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Quantity</label>
              <input className="fi" type="number" min="1" value={f.item_qty} onChange={e=>upd("item_qty",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Declared Value (for insurance)</label>
              <input className="fi" type="number" min="0" step="0.01" value={f.item_value}
                onChange={e=>upd("item_value",e.target.value)} placeholder="$0.00"/>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:16, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
            color:"var(--muted)", marginBottom:10 }}>Terms</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {(isRental || isLoan) && <>
              <div className="fg">
                <label className="fl">{isLoan ? "Loan Start Date" : "Rental Start Date"}</label>
                <input className="fi" type="date" value={f.start_date} onChange={e=>upd("start_date",e.target.value)}/>
              </div>
              <div className="fg">
                <label className="fl">Return Date</label>
                <input className="fi" type="date" value={f.end_date} onChange={e=>upd("end_date",e.target.value)}/>
              </div>
            </>}
            {(isRental || isSale) && <>
              <div className="fg">
                <label className="fl">{isSale ? "Sale Price" : "Rental Fee (per week)"}</label>
                <input className="fi" type="number" min="0" step="0.01" value={f.agreed_price}
                  onChange={e=>upd("agreed_price",e.target.value)} placeholder="$0.00"/>
              </div>
              <div className="fg">
                <label className="fl">Deposit Amount</label>
                <input className="fi" type="number" min="0" step="0.01" value={f.deposit_amount}
                  onChange={e=>upd("deposit_amount",e.target.value)} placeholder="$0.00"/>
              </div>
            </>}
            {isRental && (
              <div className="fg">
                <label className="fl">Late Fee (per day after return date)</label>
                <input className="fi" type="number" min="0" step="0.01" value={f.late_fee_per_day}
                  onChange={e=>upd("late_fee_per_day",e.target.value)} placeholder="$0.00"/>
              </div>
            )}
            <div className="fg">
              <label className="fl">Payment Method</label>
              <select className="fs" value={f.payment_method} onChange={e=>upd("payment_method",e.target.value)}>
                <option value="">Select…</option>
                {["Check","Venmo","PayPal","Zelle","Cash","School Invoice","Other"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Special Terms / Additional Notes</label>
              <textarea className="ft" value={f.special_terms} onChange={e=>upd("special_terms",e.target.value)}
                placeholder="Any additional terms, pickup/return instructions, or special conditions…"
                style={{ minHeight:60 }}/>
            </div>
          </div>
        </div>

        {/* Standard Clauses preview */}
        <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid var(--border)",
          borderRadius:8, padding:"12px 14px", marginBottom:16, fontSize:12,
          color:"var(--muted)", lineHeight:1.7 }}>
          <div style={{ fontWeight:800, color:"var(--ink)", marginBottom:6, fontSize:13 }}>
            📋 Standard Clauses (included automatically)
          </div>
          {isRental && <>
            <p>• The borrower agrees to return the item(s) in the same condition as received, reasonable wear excepted.</p>
            <p>• The borrower is responsible for any damage, loss, or theft during the rental period.</p>
            <p>• Deposit will be returned within 7 days of item return, less any damage deductions.</p>
            <p>• Payment is due prior to or at the time of pickup unless otherwise agreed in writing.</p>
          </>}
          {isLoan && <>
            <p>• The borrower agrees to return the item(s) in the same condition as received, reasonable wear excepted.</p>
            <p>• The borrower is responsible for any damage, loss, or theft during the loan period.</p>
            <p>• This is a free loan between theatre programs. No monetary exchange is required.</p>
          </>}
          {isSale && <>
            <p>• Item is sold "as-is" in the condition described above. No warranty is expressed or implied.</p>
            <p>• Title and ownership transfer to the buyer upon receipt of full payment.</p>
            <p>• All sales are final unless otherwise agreed in writing between parties.</p>
          </>}
        </div>
      </>}

      {/* Condition Report Fields */}
      {isCondition && (
        <div style={{ marginBottom:18 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div className="fg">
              <label className="fl">Item Name</label>
              <input className="fi" value={f.item_name} onChange={e=>upd("item_name",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Condition Rating</label>
              <select className="fs" value={f.condition_rating} onChange={e=>upd("condition_rating",e.target.value)}>
                <option value="">Select…</option>
                {["Excellent","Good","Fair","Poor","Damaged"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Condition Notes — describe the item&apos;s state in detail</label>
              <textarea className="ft" value={f.condition_notes} onChange={e=>upd("condition_notes",e.target.value)}
                placeholder="Describe existing scratches, wear, missing parts, working order of electronics, etc.…"
                style={{ minHeight:100 }}/>
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid var(--border)",
            borderRadius:8, padding:"12px 14px", fontSize:12, color:"var(--muted)" }}>
            💡 Tip: Take photos of the item now and upload them via the item detail page. Photo evidence protects both parties in case of disputes.
          </div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
          color:"var(--muted)", marginBottom:4 }}>Digital Signatures</div>
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:12, lineHeight:1.5 }}>
          Type your full name to sign. Signing confirms you have read and agree to the terms above. Date and time are recorded automatically.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div className="fg">
            <label className="fl">{isSale ? "Seller Signature" : "Lender / Owner Signature"}</label>
            <input className="fi" value={f.lender_signed_name}
              onChange={e=>upd("lender_signed_name",e.target.value)}
              placeholder="Type full name to sign"/>
            {f.lender_signed_name && (
              <div style={{ fontSize:11, color:"var(--green)", marginTop:3 }}>
                ✓ Signed as: {f.lender_signed_name}
              </div>
            )}
          </div>
          <div className="fg">
            <label className="fl">{isSale ? "Buyer Signature" : "Borrower Signature"}</label>
            <input className="fi" value={f.borrower_signed_name}
              onChange={e=>upd("borrower_signed_name",e.target.value)}
              placeholder="Type full name to sign"/>
            {f.borrower_signed_name && (
              <div style={{ fontSize:11, color:"var(--green)", marginTop:3 }}>
                ✓ Signed as: {f.borrower_signed_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
            {/* Sticky save footer - always visible at bottom */}
      <div style={{ position:"sticky", bottom:0, background:"var(--parch)", 
        borderTop:"2px solid var(--linen)", padding:"14px 0 0",
        display:"flex", gap:8, justifyContent:"flex-end", marginTop:24,
        zIndex:10 }}>
        <button className="btn btn-o" onClick={onCancel}>Cancel</button>
        <button className="btn btn-o btn-sm" onClick={() => onSave({ ...f, status:"draft" })} disabled={saving}>
          💾 Save Draft
        </button>
        <button className="btn btn-g" onClick={submit} disabled={saving}
          style={{ background:`linear-gradient(135deg,${dt.color},${dt.color}cc)`,
            color:"#fff", border:"none" }}>
          {saving ? "Saving…" : (dt.icon+" Finalize "+dt.label)}
        </button>
      </div>
    </div>
  );
}

// ── Document Print / PDF generator ───────────────────────────────────────────
function printDocument(doc, req) {
  const dt    = DOC_TYPES[doc.type] || DOC_TYPES.rental_agreement;
  const today = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const isSale      = doc.type === "bill_of_sale";
  const isCondition = doc.type.startsWith("condition_report");

  const lenderLabel   = isSale ? "Seller" : "Lender / Owner";
  const borrowerLabel = isSale ? "Buyer"  : "Borrower";

  const row = (l,v) => v ? `<tr><td style="width:180px;color:#555;font-size:13px;padding:5px 0;vertical-align:top">${l}</td><td style="font-size:13px;padding:5px 0">${v}</td></tr>` : "";

  const sigBlock = (name, title, signedName, signedAt) => `
    <div style="border:1px solid #ddd;border-radius:8px;padding:16px;flex:1">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">${title}</div>
      ${signedName
        ? `<div style="font-family:Georgia,serif;font-size:18px;color:#1a5c2a;margin-bottom:4px">${signedName}</div>
           <div style="font-size:11px;color:#888">Signed: ${signedAt ? new Date(signedAt).toLocaleString() : today}</div>`
        : `<div style="border-bottom:2px solid #333;margin-top:32px;margin-bottom:6px"></div>
           <div style="font-size:12px;color:#888">Signature &amp; Date</div>`}
      <div style="font-size:12px;color:#555;margin-top:6px">${name||""}</div>
      <div style="font-size:11px;color:#aaa">${title}</div>
    </div>`;

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"/>
    <title>${dt.label} — ${doc.item_name}</title>
    <style>
      body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:40px;color:#1a1a1a;max-width:780px;margin:0 auto}
      h1{font-family:Georgia,serif;font-size:28px;margin-bottom:4px;color:#1a1a1a}
      .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;
        text-transform:uppercase;letter-spacing:1px;color:#fff;background:${dt.color};margin-bottom:16px}
      .section{margin-bottom:24px}
      .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;
        color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #eee}
      table{width:100%;border-collapse:collapse}
      .clauses{background:#f9f9f9;border-left:4px solid ${dt.color};padding:14px 18px;
        border-radius:0 8px 8px 0;margin:14px 0;font-size:13px;line-height:1.8;color:#444}
      .sig-row{display:flex;gap:20px;margin-top:32px}
      @media print{body{padding:20px}.no-print{display:none}}
    </style>
  </head><body>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
      <div>
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Theatre4u™</div>
        <h1>${dt.icon} ${dt.label}</h1>
        <span class="badge">${doc.status === "finalized" ? "✓ Finalized" : "Draft"}</span>
      </div>
      <div style="text-align:right;font-size:12px;color:#888;margin-top:8px">
        <div>Generated: ${today}</div>
        <div>Document ID: ${doc.id ? doc.id.slice(0,8).toUpperCase() : "DRAFT"}</div>
      </div>
    </div>
    <hr style="border:none;border-top:2px solid #eee;margin-bottom:24px"/>

    ${!isCondition ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div class="section">
        <div class="section-title">${lenderLabel}</div>
        <table>${row("Organization",doc.lender_name)}${row("Email",doc.lender_email)}${row("Phone",doc.lender_phone)}${row("Address",doc.lender_address)}</table>
      </div>
      <div class="section">
        <div class="section-title">${borrowerLabel}</div>
        <table>${row("Organization",doc.borrower_name)}${row("Email",doc.borrower_email)}${row("Phone",doc.borrower_phone)}${row("Address",doc.borrower_address)}</table>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Item Description</div>
      <table>
        ${row("Item Name",doc.item_name)}
        ${row("Description",doc.item_description)}
        ${row("Condition",doc.item_condition)}
        ${row("Quantity",doc.item_qty)}
        ${row("Declared Value",doc.item_value ? "$"+Number(doc.item_value).toFixed(2) : "")}
      </table>
    </div>

    <div class="section">
      <div class="section-title">Terms</div>
      <table>
        ${row("Start Date", doc.start_date ? new Date(doc.start_date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}) : "")}
        ${row("Return Date", doc.end_date ? new Date(doc.end_date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}) : "")}
        ${row(isSale ? "Sale Price" : "Rental Fee", doc.agreed_price > 0 ? "$"+Number(doc.agreed_price).toFixed(2)+(doc.type==="rental_agreement"?" per week":"") : "")}
        ${row("Deposit", doc.deposit_amount > 0 ? "$"+Number(doc.deposit_amount).toFixed(2) : "")}
        ${row("Late Fee", doc.late_fee_per_day > 0 ? "$"+Number(doc.late_fee_per_day).toFixed(2)+" per day" : "")}
        ${row("Payment Method", doc.payment_method)}
      </table>
      ${doc.special_terms ? `<div style="margin-top:10px;padding:10px 14px;background:#f5f5f5;border-radius:6px;font-size:13px;line-height:1.6"><strong>Special Terms:</strong> ${doc.special_terms}</div>` : ""}
    </div>

    <div class="section">
      <div class="section-title">Standard Terms &amp; Conditions</div>
      <div class="clauses">
        ${doc.type === "rental_agreement" ? `
          <div>1. The borrower agrees to return all item(s) in the same condition as received, reasonable wear excepted.</div>
          <div>2. The borrower is responsible for any damage, loss, or theft occurring during the rental period.</div>
          <div>3. Deposit will be returned within 7 business days of item return, less deductions for documented damage.</div>
          <div>4. Payment is due prior to or at the time of pickup unless otherwise agreed in writing by both parties.</div>
          <div>5. Late fees apply for each day the item is retained beyond the agreed return date.</div>
          <div>6. This agreement is between the two organizations named above. Artstracker LLC (operating Theatre4u™) serves as the platform facilitating this agreement and is not a party to this transaction.</div>
        ` : doc.type === "loan_agreement" ? `
          <div>1. The borrower agrees to return all item(s) in the same condition as received, reasonable wear excepted.</div>
          <div>2. The borrower is responsible for any damage, loss, or theft occurring during the loan period.</div>
          <div>3. This is a free loan between theatre organizations. No monetary exchange is required or implied.</div>
          <div>4. The borrower agrees to return all item(s) by the agreed return date.</div>
          <div>5. This agreement is between the two organizations named above. Artstracker LLC (operating Theatre4u™) serves as the platform facilitating this agreement and is not a party to this transaction.</div>
        ` : `
          <div>1. Item is sold in "as-is" condition as described above. No warranty is expressed or implied.</div>
          <div>2. Title and ownership transfer to the buyer upon receipt of full payment.</div>
          <div>3. All sales are final unless otherwise agreed in writing between both parties prior to sale.</div>
          <div>4. This agreement is between the two organizations named above. Artstracker LLC (operating Theatre4u™) serves as the platform facilitating this agreement and is not a party to this transaction.</div>
        `}
      </div>
    </div>` : `
    <div class="section">
      <div class="section-title">Item</div>
      <table>${row("Item Name",doc.item_name)}${row("Condition Rating",doc.condition_rating)}</table>
    </div>
    <div class="section">
      <div class="section-title">Condition Notes</div>
      <div style="background:#f9f9f9;padding:14px;border-radius:8px;font-size:13px;line-height:1.7;min-height:80px">${doc.condition_notes||"No notes recorded."}</div>
    </div>`}

    <div class="sig-row">
      ${sigBlock(doc.lender_name, lenderLabel, doc.lender_signed_name, doc.lender_signed_at)}
      ${sigBlock(doc.borrower_name, borrowerLabel, doc.borrower_signed_name, doc.borrower_signed_at)}
    </div>

    <div style="margin-top:32px;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center">
      Generated by Theatre4u™ · Inventory · Backstage Exchange · Community · theatre4u.org · ${today}
    </div>

    <script>window.onload=function(){window.print();}</script>
  </body></html>`;

  const w = window.open("","_blank","width=900,height=700");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Document Manager (shown inside a request card) ────────────────────────────
function DocumentManager({ req, userId, orgName }) {
  const [docs,      setDocs]    = useState([]);
  const [loading,   setLoading] = useState(true);
  const [showForm,  setShowForm]= useState(null); // docType being created/edited
  const [editDoc,   setEditDoc] = useState(null);
  const [expanded,  setExpanded]= useState(false);

  const load = useCallback(async () => {
    const { data } = await SB.from("transaction_documents")
      .select("*").eq("request_id", req.id).order("created_at");
    setDocs(data || []);
    setLoading(false);
  }, [req.id]);

  useEffect(() => { load(); }, [load]);

  const saveDoc = async (f) => {
    const now = new Date().toISOString();
    const payload = {
      ...f,
      request_id: req.id,
      org_id:     userId,
      lender_signed_at:  f.lender_signed_name  && !editDoc?.lender_signed_at  ? now : editDoc?.lender_signed_at  || null,
      borrower_signed_at: f.borrower_signed_name && !editDoc?.borrower_signed_at ? now : editDoc?.borrower_signed_at || null,
    };

    if (editDoc) {
      await SB.from("transaction_documents").update(payload).eq("id", editDoc.id);
    } else {
      await SB.from("transaction_documents").insert(payload);
    }
    await load();
    setShowForm(null);
    setEditDoc(null);
  };

  // Which docs are available based on request type
  const availableDocTypes = req.item_type === "buy"
    ? ["bill_of_sale","condition_report_pickup"]
    : req.item_type === "loan"
    ? ["loan_agreement","condition_report_pickup","condition_report_return"]
    : ["rental_agreement","condition_report_pickup","condition_report_return"];

  const existingTypes = new Set(docs.map(d => d.type));

  if (!expanded) return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)" }}>
      <button className="btn btn-o btn-sm" onClick={() => setExpanded(true)}
        style={{ fontSize:12 }}>
        📄 Documents {docs.length > 0 ? `(${docs.length})` : ""}
      </button>
    </div>
  );

  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>
          📄 Transaction Documents
        </div>
        <button className="ico-btn" onClick={() => setExpanded(false)} style={{ fontSize:11 }}>
          ↑ Collapse
        </button>
      </div>

      {/* Existing docs */}
      {loading
        ? <div style={{ fontSize:12, color:"var(--muted)" }}>Loading…</div>
        : docs.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {docs.map(doc => {
              const dt = DOC_TYPES[doc.type] || DOC_TYPES.rental_agreement;
              const bothSigned = doc.lender_signed_name && doc.borrower_signed_name;
              return (
                <div key={doc.id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"8px 12px", background:"var(--parch)",
                  border:"1px solid var(--border)", borderRadius:8 }}>
                  <span style={{ fontSize:18 }}>{dt.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{dt.label}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>
                      {doc.status === "finalized" ? "✅ Finalized" : "📝 Draft"}
                      {bothSigned ? " · Both signed" : doc.lender_signed_name ? " · Owner signed" : doc.borrower_signed_name ? " · Borrower signed" : " · Unsigned"}
                      {" · "}{new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button className="btn btn-o btn-sm" style={{ fontSize:11 }}
                    onClick={() => { setEditDoc(doc); setShowForm(doc.type); }}>
                    ✏️ Edit
                  </button>
                  <button className="btn btn-o btn-sm" style={{ fontSize:11,
                    background:dt.color+"18", color:dt.color, borderColor:dt.color+"40" }}
                    onClick={() => printDocument(doc, req)}>
                    🖨️ Print/PDF
                  </button>
                </div>
              );
            })}
          </div>
        )}

      {/* Create new document buttons */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {availableDocTypes.filter(t => !existingTypes.has(t)).map(docType => {
          const dt = DOC_TYPES[docType];
          return (
            <button key={docType} className="btn btn-o btn-sm"
              style={{ fontSize:12, background:dt.color+"12",
                color:dt.color, borderColor:dt.color+"35" }}
              onClick={() => { setEditDoc(null); setShowForm(docType); }}>
              {dt.icon} Create {dt.label}
            </button>
          );
        })}
        {availableDocTypes.every(t => existingTypes.has(t)) && (
          <div style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>
            ✅ All documents created
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <Modal title={`${DOC_TYPES[showForm]?.label || "Document"}`}
          onClose={() => { setShowForm(null); setEditDoc(null); }}>
          <TransactionDocForm
            req={req}
            docType={showForm}
            existing={editDoc}
            org={{ name:orgName }}
            onSave={saveDoc}
            onCancel={() => { setShowForm(null); setEditDoc(null); }}
          />
        </Modal>
      )}
    </div>
  );
}


// ── Requests Page ──────────────────────────────────────────────────────────────
function Requests({ userId, orgName, orgEmail }) {
  const [tab,       setTab]      = useState("incoming");
  const [requests,  setRequests] = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [acting,    setActing]   = useState(null); // requestId being acted on
  const [declineId, setDeclineId]= useState(null); // showing decline reason form
  const [reason,    setReason]   = useState("");

  const load = useCallback(async () => {
    const col = tab === "incoming" ? "owner_id" : "requester_id";
    const { data } = await SB.from("rental_requests")
      .select("*").eq(col, userId)
      .order("created_at", { ascending: false });

    // Attach org names
    const ids = new Set();
    (data||[]).forEach(r => { ids.add(r.owner_id); ids.add(r.requester_id); });
    const { data: orgs } = await SB.from("orgs").select("id,name,email").in("id",[...ids]);
    const orgMap = {};
    (orgs||[]).forEach(o => orgMap[o.id] = o);

    setRequests((data||[]).map(r => ({
      ...r,
      ownerOrg:     orgMap[r.owner_id],
      requesterOrg: orgMap[r.requester_id],
    })));
    setLoading(false);
  }, [userId, tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Realtime updates
  useEffect(() => {
    const ch = SB.channel("requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_requests" },
        () => load())
      .subscribe();
    return () => SB.removeChannel(ch);
  }, [load]);

  const accept = async (req) => {
    setActing(req.id);
    // 1. Block the availability calendar
    let blockId = null;
    if (req.start_date && req.end_date) {
      const { data: block } = await SB.from("availability_blocks").insert({
        item_id:    req.item_id,
        org_id:     userId,
        start_date: req.start_date,
        end_date:   req.end_date,
        label:      `${req.item_type==="loan"?"Loan":"Rental"} — ${req.requesterOrg?.name||req.requester_name||"Requester"}`,
        block_type: "confirmed",
      }).select().single();
      blockId = block?.id;
    }

    // 2. Open or reuse a conversation thread
    let convId = null;
    const { data: existingConv } = await SB.from("conversations")
      .select("id").eq("org_a", userId).eq("org_b", req.requester_id).single();
    if (existingConv) {
      convId = existingConv.id;
    } else {
      const { data: newConv } = await SB.from("conversations").insert({
        item_id:      req.item_id,
        org_a:        userId,
        org_b:        req.requester_id,
        item_name:    req.item_name,
        last_message: `Request accepted for ${req.item_name}`,
        last_at:      new Date().toISOString(),
      }).select().single();
      convId = newConv?.id;
    }

    // Auto-send acceptance message in chat
    if (convId) {
      const dateStr = req.start_date ? ` (${req.start_date} → ${req.end_date})` : "";
      await SB.from("messages").insert({
        conversation_id: convId,
        sender_id:       userId,
        body: `✅ Great news! I've accepted your ${req.item_type} request for "${req.item_name}"${dateStr}. Let's coordinate the details here.`,
      });
      await SB.from("conversations").update({
        last_message: `Request accepted — let's coordinate!`,
        last_at: new Date().toISOString()
      }).eq("id", convId);
    }

    // 3. Update request status
    await SB.from("rental_requests").update({
      status:      "accepted",
      block_id:    blockId,
      conversation_id: convId,
      updated_at:  new Date().toISOString(),
    }).eq("id", req.id);

    notifyRequest("accepted", req.id);
    await load();
    setActing(null);
  };

  const decline = async (req) => {
    setActing(req.id);
    await SB.from("rental_requests").update({
      status:         "declined",
      decline_reason: reason.trim() || null,
      updated_at:     new Date().toISOString(),
    }).eq("id", req.id);
    notifyRequest("declined", req.id);
    setDeclineId(null); setReason("");
    await load();
    setActing(null);
  };

  const markReturned = async (req) => {
    setActing(req.id);
    // Unblock calendar
    if (req.block_id) {
      await SB.from("availability_blocks").delete().eq("id", req.block_id);
    }
    await SB.from("rental_requests").update({
      status:     "returned",
      updated_at: new Date().toISOString(),
    }).eq("id", req.id);
    notifyRequest("returned", req.id);
    await load();
    setActing(null);
  };

  const cancel = async (req) => {
    setActing(req.id);
    await SB.from("rental_requests").update({
      status: "cancelled", updated_at: new Date().toISOString()
    }).eq("id", req.id);
    await load();
    setActing(null);
  };

  const statusColor = { pending:"#d35400", accepted:"#27723a", declined:"#c2185b", returned:"#546e7a", cancelled:"#9e9e9e" };
  const statusIcon  = { pending:"⏳", accepted:"✅", declined:"❌", returned:"📦", cancelled:"🚫" };
  const typeLabel   = { rent:"Rental", loan:"Loan", buy:"Purchase" };
  const typeColor   = { rent:"#1554a0", loan:"#00838f", buy:"#27723a" };

  const pending   = requests.filter(r => r.status === "pending").length;
  const accepted  = requests.filter(r => r.status === "accepted").length;

  return (
    <div style={{position:"relative"}}>
      <img src={usp(BG.dashboard,1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:200}}>
          <img src={usp("photo-1503095396549-807759245b35",1100,260)} alt="Requests" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📋 Transaction Centre</div>
            <h1 className="hero-title" style={{fontSize:42}}>Requests</h1>
            <p className="hero-sub">Manage rental, loan, and purchase requests for your items.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        {/* Tabs */}
        <div className="tabs" style={{marginBottom:20}}>
          <button className={`tab ${tab==="incoming"?"on":""}`} onClick={()=>setTab("incoming")}>
            Incoming {pending>0&&<span style={{background:"var(--red)",color:"#fff",borderRadius:8,
              padding:"1px 6px",fontSize:10,fontWeight:800,marginLeft:4}}>{pending}</span>}
          </button>
          <button className={`tab ${tab==="outgoing"?"on":""}`} onClick={()=>setTab("outgoing")}>
            My Requests {accepted>0&&tab==="outgoing"&&<span style={{background:"var(--green)",color:"#fff",borderRadius:8,
              padding:"1px 6px",fontSize:10,fontWeight:800,marginLeft:4}}>{accepted}</span>}
          </button>
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>Loading requests…</div>
        ) : requests.length === 0 ? (
          <div className="empty">
            <div className="empty-ico">{tab==="incoming"?"📬":"📤"}</div>
            <h3>{tab==="incoming"?"No Incoming Requests":"No Outgoing Requests"}</h3>
            <p>{tab==="incoming"
              ?"When other programs request your listed items, they'll appear here."
              :"When you request items from Backstage Exchange, they'll appear here."}</p>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {requests.map(req => {
              const otherOrg = tab==="incoming" ? req.requesterOrg : req.ownerOrg;
              const isActive = acting === req.id;
              return (
                <div key={req.id} className="card" style={{overflow:"hidden"}}>
                  {/* Status bar */}
                  <div style={{height:4,background:statusColor[req.status]||"#ccc"}}/>
                  <div style={{padding:"14px 18px"}}>
                    <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-start",marginBottom:12}}>
                      {/* Left: item info */}
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontFamily:"'Lora',serif",fontSize:17,fontWeight:700}}>{req.item_name}</span>
                          <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,
                            background:typeColor[req.item_type]+"18",color:typeColor[req.item_type]}}>
                            {typeLabel[req.item_type]||req.item_type}
                          </span>
                          <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,
                            background:statusColor[req.status]+"18",color:statusColor[req.status]}}>
                            {statusIcon[req.status]} {req.status}
                          </span>
                        </div>
                        <div style={{fontSize:13,color:"var(--muted)"}}>
                          {tab==="incoming"?"From":"To"}: <strong>{otherOrg?.name||"Unknown Program"}</strong>
                        </div>
                      </div>
                      {/* Right: dates + price */}
                      <div style={{textAlign:"right",flexShrink:0}}>
                        {req.start_date&&<div style={{fontSize:13,fontWeight:700,color:"var(--ink)"}}>
                          {req.start_date} → {req.end_date}
                        </div>}
                        {req.agreed_price>0&&<div style={{fontSize:13,color:"var(--cog)",fontWeight:700}}>
                          {req.item_type==="rent"?fmt$(req.agreed_price)+"/wk":fmt$(req.agreed_price)}
                        </div>}
                        <div style={{fontSize:11,color:"var(--faint)",marginTop:2}}>
                          Qty: {req.qty_requested}
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    {req.message&&(
                      <div style={{background:"var(--parch)",border:"1px solid var(--border)",
                        borderRadius:7,padding:"9px 12px",fontSize:13,color:"var(--muted)",
                        lineHeight:1.5,marginBottom:12,fontStyle:"italic"}}>
                        "{req.message}"
                      </div>
                    )}

                    {/* Decline reason */}
                    {req.status==="declined"&&req.decline_reason&&(
                      <div style={{background:"rgba(194,24,91,.06)",border:"1px solid rgba(194,24,91,.15)",
                        borderRadius:7,padding:"8px 12px",fontSize:12,color:"#c2185b",marginBottom:12}}>
                        Reason: {req.decline_reason}
                      </div>
                    )}

                    {/* Decline reason form */}
                    {declineId===req.id&&(
                      <div style={{marginBottom:12}}>
                        <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",
                          letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>
                          Reason for declining (optional)
                        </label>
                        <input className="fi" value={reason} onChange={e=>setReason(e.target.value)}
                          placeholder="e.g. Already booked for those dates"
                          style={{width:"100%",marginBottom:8}}/>
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn btn-d btn-sm" onClick={()=>decline(req)} disabled={isActive}>
                            {isActive?"…":"Confirm Decline"}
                          </button>
                          <button className="btn btn-o btn-sm" onClick={()=>setDeclineId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                      {/* Incoming pending — owner accepts or declines */}
                      {tab==="incoming"&&req.status==="pending"&&(<>
                        <button className="btn btn-g btn-sm" onClick={()=>accept(req)} disabled={isActive}>
                          {isActive?"Processing…":"✅ Accept"}
                        </button>
                        <button className="btn btn-d btn-sm" onClick={()=>setDeclineId(req.id)} disabled={isActive}>
                          ❌ Decline
                        </button>
                      </>)}

                      {/* Incoming accepted — owner marks returned */}
                      {tab==="incoming"&&req.status==="accepted"&&(
                        <div style={{width:"100%",marginBottom:4}}>
                          {/* Urgent banner if past return date */}
                          {req.end_date&&new Date(req.end_date)<new Date()&&(
                            <div style={{background:"rgba(212,168,67,.12)",border:"1.5px solid rgba(212,168,67,.4)",
                              borderRadius:8,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:18}}>⚠️</span>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:800,fontSize:13,color:"var(--gold)"}}>Return date has passed</div>
                                <div style={{fontSize:12,color:"var(--muted)"}}>Mark the item returned to release the calendar and earn your Stage Points.</div>
                              </div>
                            </div>
                          )}
                          <button style={{
                            width:"100%",padding:"11px 16px",borderRadius:8,
                            background:"linear-gradient(135deg,var(--green),#2d8a45)",
                            border:"none",color:"#fff",fontFamily:"inherit",fontSize:14,
                            fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",
                            justifyContent:"center",gap:8,letterSpacing:.3,
                            boxShadow:"0 2px 12px rgba(38,94,42,.3)",
                            opacity:isActive?.6:1,
                          }} onClick={()=>markReturned(req)} disabled={isActive}>
                            {isActive?"Processing…":"📦 Mark Item as Returned → Earn Credits"}
                          </button>
                          <div style={{textAlign:"center",fontSize:11,color:"var(--muted)",marginTop:5}}>
                            🪙 You'll earn {POINT_EARN_RATES[req?.item?.category] || 15} Stage Points when you confirm the return
                          </div>
                        </div>
                      )}

                      {/* Outgoing pending — requester can cancel */}
                      {tab==="outgoing"&&req.status==="pending"&&(
                        <button className="btn btn-d btn-sm" onClick={()=>cancel(req)} disabled={isActive}>
                          {isActive?"…":"Cancel Request"}
                        </button>
                      )}

                      {/* Link to conversation if exists */}
                      {req.conversation_id&&(
                        <button className="btn btn-o btn-sm" onClick={()=>window.__t4u_nav_messages&&window.__t4u_nav_messages(req.conversation_id)}>
                          💬 Open Chat
                        </button>
                      )}

                      <div style={{marginLeft:"auto",fontSize:11,color:"var(--faint)",
                        display:"flex",alignItems:"center"}}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Transaction Documents — available on accepted requests */}
                    {(req.status==="accepted"||req.status==="returned")&&(
                      <DocumentManager req={req} userId={userId} orgName={orgName}/>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Production Report Tab (inside Reports page) ───────────────────────────────


// ── Upgrade prompt modal ─────────────────────────────────────────────────────

// ── Shared upgrade/pricing component — used in Settings + any upsell modal ────
// ── Plan definitions ─────────────────────────────────────────────────────────
// ── Admin accounts — add emails here for free District access + admin dashboard
const ADMIN_EMAILS = [
  "theatre4u1@gmail.com",
  // Add tester emails here:
  // "tester1@example.com",
];
const isAdminEmail = (e) => ADMIN_EMAILS.includes((e||"").toLowerCase().trim());
const ADMIN_EMAIL  = ADMIN_EMAILS[0]; // legacy alias

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

function autoMatch(header) {
  const h = header.toLowerCase().trim();
  for (const f of CSV_FIELDS) {
    if (h === f.key) return f.key;
    if (f.hints.some(hint => h.includes(hint) || hint.includes(h))) return f.key;
  }
  return null;
}

// Parse a raw CSV string into rows
function parseCSV(text) {
  const lines = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").filter(l=>l.trim());
  const rows = [];
  for (const line of lines) {
    const cols = [];
    let cur = "", inQ = false;
    for (let i=0; i<line.length; i++) {
      const c = line[i];
      if (c==="\"" && inQ && line[i+1]==="\"") { cur+="\""; i++; }
      else if (c==="\"") { inQ=!inQ; }
      else if (c==="," && !inQ) { cols.push(cur); cur=""; }
      else { cur+=c; }
    }
    cols.push(cur);
    rows.push(cols.map(c=>c.trim()));
  }
  return rows;
}

// Coerce a raw string value into the right type/valid value for a field
function coerce(key, raw) {
  if (!raw && raw!==0) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  switch(key) {
    case "category": {
      const lo = v.toLowerCase();
      const match = CATS.find(c => lo.includes(c.id) || lo.includes(c.label.toLowerCase()) ||
        c.label.toLowerCase().includes(lo));
      return match ? match.id : "other";
    }
    case "condition": {
      const match = CONDS.find(c=>c.toLowerCase()===v.toLowerCase());
      return match || "Good";
    }
    case "size": {
      const match = SIZES.find(s=>s.toLowerCase()===v.toLowerCase());
      return match || "N/A";
    }
    case "avail": {
      const match = AVAIL.find(a=>a.toLowerCase()===v.toLowerCase());
      return match || "In Stock";
    }
    case "mkt": {
      const match = MKT.find(m=>m.toLowerCase()===v.toLowerCase());
      return match || "Not Listed";
    }
    case "qty":        { const n=parseInt(v); return isNaN(n)?1:Math.max(0,n); }
    case "loan_period":{ const n=parseInt(v); return isNaN(n)?2:Math.max(1,n); }
    case "rent":
    case "sale": { const n=parseFloat(v.replace(/[$,]/g,"")); return isNaN(n)?0:Math.max(0,n); }
    case "tags": { return v.split(/[;,|]/).map(t=>t.trim().toLowerCase()).filter(Boolean); }
    case "img":  { return normalizeImageUrl(v); }
    default:     return v;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTIONS  (Show Folders)
// ══════════════════════════════════════════════════════════════════════════════

const PROD_COLORS = [
  "#d4a843","#c2185b","#7b1fa2","#1565c0","#2e7d32",
  "#d84315","#00838f","#4e342e","#ad1457","#546e7a",
];

const PROD_STATUSES = [
  { key:"needed",      label:"Needed",      color:"#9b93a8" },
  { key:"confirmed",   label:"Confirmed",   color:"#4caf50" },
  { key:"checked_out", label:"Checked Out", color:"#42a5f5" },
  { key:"returned",    label:"Returned",    color:"#d4a843" },
];
const PROD_STATUS_MAP = Object.fromEntries(PROD_STATUSES.map(s=>[s.key,s]));

// ── Add-to-Production picker (shown from item detail or card) ─────────────
function AddToProductionPicker({ item, userId, onClose }) {
  const [productions, setProductions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(null);
  const [done,        setDone]        = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await SB.from("productions")
        .select("*, production_items(item_id)")
        .eq("org_id", userId)
        .neq("status","closed")
        .order("created_at", { ascending: false });
      setProductions(data || []);
      setLoading(false);
    })();
  }, [userId]);

  const toggle = async (prod) => {
    const already = prod.production_items?.some(pi => pi.item_id === item.id);
    setSaving(prod.id);
    if (already) {
      await SB.from("production_items")
        .delete()
        .eq("production_id", prod.id)
        .eq("item_id", item.id);
      setDone(p => ({ ...p, [prod.id]: false }));
    } else {
      await SB.from("production_items")
        .insert({ production_id: prod.id, item_id: item.id, qty_needed: 1 });
      setDone(p => ({ ...p, [prod.id]: true }));
    }
    // Refresh
    const { data } = await SB.from("productions")
      .select("*, production_items(item_id)")
      .eq("org_id", userId)
      .neq("status","closed")
      .order("created_at", { ascending: false });
    setProductions(data || []);
    setSaving(null);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:3000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxWidth:400, background:"#fdf6ec",
        border:"1px solid var(--border)", borderRadius:14, overflow:"hidden",
        boxShadow:"0 12px 48px rgba(0,0,0,.5)", animation:"su .2s ease" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700 }}>Add to Production</div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{item.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--border)",
            color:"var(--muted)", borderRadius:6, padding:"3px 9px", cursor:"pointer", fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:14, maxHeight:360, overflowY:"auto" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:24, color:"var(--muted)" }}>Loading…</div>
          ) : productions.length === 0 ? (
            <div style={{ textAlign:"center", padding:24 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🎭</div>
              <p style={{ color:"var(--muted)", fontSize:13, marginBottom:12 }}>
                No active productions yet. Create one on the Productions page first.
              </p>
            </div>
          ) : (
            productions.map(prod => {
              const inProd = prod.production_items?.some(pi => pi.item_id === item.id);
              const isDone = done[prod.id] !== undefined ? done[prod.id] : inProd;
              return (
                <div key={prod.id} onClick={() => saving !== prod.id && toggle(prod)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                    borderRadius:8, cursor:"pointer", marginBottom:4,
                    background: isDone ? "rgba(76,175,80,.1)" : "rgba(255,255,255,.03)",
                    border:`1px solid ${isDone ? "rgba(76,175,80,.25)" : "var(--border)"}`,
                    transition:"all .15s" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%",
                    background:prod.color||"var(--gold)", flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{prod.name}</div>
                    {prod.opening_date && (
                      <div style={{ fontSize:11, color:"var(--muted)" }}>
                        Opens {new Date(prod.opening_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize:18, flexShrink:0 }}>
                    {saving === prod.id ? "⏳" : isDone ? "✅" : "○"}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div style={{ padding:"10px 14px", borderTop:"1px solid var(--border)",
          textAlign:"center", fontSize:12, color:"var(--muted)" }}>
          Click a production to add or remove this item
        </div>
      </div>
    </div>
  );
}

// ── Production Form ────────────────────────────────────────────────────────
function ProductionForm({ prod, onSave, onCancel }) {
  const [f, setF] = useState(prod || {
    name:"", show_title:"", opening_date:"", closing_date:"",
    notes:"", color:PROD_COLORS[0], status:"planning"
  });
  const s = (k,v) => setF(p => ({ ...p, [k]:v }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div className="fg2">
        <div className="fg fu">
          <label className="fl">Production Name *</label>
          <input className="fi" value={f.name} onChange={e=>s("name",e.target.value)}
            placeholder="e.g. The Wiz — Spring 2026" autoFocus/>
        </div>
        <div className="fg">
          <label className="fl">Show Title</label>
          <input className="fi" value={f.show_title||""} onChange={e=>s("show_title",e.target.value)}
            placeholder="The Wiz"/>
        </div>
        <div className="fg">
          <label className="fl">Status</label>
          <select className="fs" value={f.status} onChange={e=>s("status",e.target.value)}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="fg">
          <label className="fl">Opening Date</label>
          <input className="fi" type="date" value={f.opening_date||""} onChange={e=>s("opening_date",e.target.value)}/>
        </div>
        <div className="fg">
          <label className="fl">Closing Date</label>
          <input className="fi" type="date" value={f.closing_date||""} onChange={e=>s("closing_date",e.target.value)}/>
        </div>
        <div className="fg fu">
          <label className="fl">Color Label</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
            {PROD_COLORS.map(c => (
              <div key={c} onClick={()=>s("color",c)}
                style={{ width:28, height:28, borderRadius:"50%", background:c, cursor:"pointer",
                  border: f.color===c ? "3px solid white" : "3px solid transparent",
                  boxShadow: f.color===c ? `0 0 0 2px ${c}` : "none",
                  transition:"all .15s" }}/>
            ))}
          </div>
        </div>
        <div className="fg fu">
          <label className="fl">Notes</label>
          <textarea className="ft" value={f.notes||""} onChange={e=>s("notes",e.target.value)}
            placeholder="Budget notes, director's vision, special requirements…"/>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", paddingTop:10,
        borderTop:"1px solid var(--border)" }}>
        <button className="btn btn-o" onClick={onCancel}>Cancel</button>
        <button className="btn btn-g" disabled={!f.name.trim()} onClick={()=>onSave(f)}
          style={!f.name.trim()?{opacity:.4}:{}}>
          {prod ? "Save Changes" : "Create Production"}
        </button>
      </div>
    </div>
  );
}

// ── Shared: Print Production Report ──────────────────────────────────────────
async function printProductionReport(prod, needs, prodItems, allItems, org) {
  const today = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const orgName = org?.name || "Theatre Program";

  // Status helpers
  const statusLabel = { needed:"Still Needed", searching:"Searching", found:"Found",
    acquired:"Acquired", not_needed:"Not Needed" };
  const sourceLabel  = { unknown:"TBD", in_house:"From Our Inventory",
    exchange:"Backstage Exchange", borrow:"Borrowing", buy:"Purchasing", donate:"Donated" };

  // Stats
  const totalNeeds = needs.length;
  const acquiredN  = needs.filter(n=>n.status==="acquired").length;
  const pct        = totalNeeds > 0 ? Math.round(acquiredN/totalNeeds*100) : 0;
  const estCost    = needs.reduce((s,n)=>s+(parseFloat(n.estimated_cost)||0),0);
  const actCost    = needs.reduce((s,n)=>s+(parseFloat(n.actual_cost)||0),0);

  // Group needs by category
  const needsByCat = {};
  needs.forEach(n=>{
    const cat = n.category||"other";
    if(!needsByCat[cat]) needsByCat[cat]=[];
    needsByCat[cat].push(n);
  });

  // Group inventory items by category
  const enriched = prodItems.map(pi=>({...pi, item:allItems.find(i=>i.id===pi.item_id)}))
    .filter(pi=>pi.item);
  const invByCat = {};
  enriched.forEach(pi=>{
    const cat = pi.item?.category||"other";
    if(!invByCat[cat]) invByCat[cat]=[];
    invByCat[cat].push(pi);
  });

  const statusColor = { needed:"#c0392b", searching:"#e67e22", found:"#2980b9",
    acquired:"#27ae60", not_needed:"#95a5a6" };

  const needsHTML = Object.entries(needsByCat).map(([catId, catNeeds])=>{
    const cat = catId.charAt(0).toUpperCase()+catId.slice(1);
    const rows = catNeeds.map((n,i)=>`
      <tr style="background:${i%2===0?"#fff":"#faf7f2"}">
        <td style="padding:7px 12px;border-bottom:1px solid #eee">${n.name}${n.qty_needed>1?` ×${n.qty_needed}`:""}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee">
          <span style="color:${statusColor[n.status]||"#666"};font-weight:700;font-size:11px">
            ${statusLabel[n.status]||n.status}
          </span>
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">
          ${sourceLabel[n.source]||n.source}
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">
          ${n.resolved_notes||n.notes||"—"}
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:right;font-size:12px">
          ${n.actual_cost?`$${parseFloat(n.actual_cost).toFixed(2)}`:n.estimated_cost?`~$${parseFloat(n.estimated_cost).toFixed(2)}`:"—"}
        </td>
      </tr>`).join("");
    return `
      <div style="margin-bottom:24px;break-inside:avoid">
        <div style="background:#f5ede0;padding:7px 12px;font-weight:700;font-size:12px;
          text-transform:uppercase;letter-spacing:1px;color:#8a6a20;border-radius:4px 4px 0 0">
          ${cat} (${catNeeds.length})
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#fff8ef">
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Item</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Status</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Source</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Notes</th>
            <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Cost</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const invHTML = Object.entries(invByCat).length > 0 ? Object.entries(invByCat).map(([catId,items])=>{
    const cat = catId.charAt(0).toUpperCase()+catId.slice(1);
    const rows = items.map((pi,i)=>`
      <tr style="background:${i%2===0?"#fff":"#faf7f2"}">
        <td style="padding:7px 12px;border-bottom:1px solid #eee">${pi.item?.name||"—"}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">${pi.item?.condition||"—"}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">${pi.item?.location||"—"}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee">
          <span style="font-size:11px;font-weight:700;color:${
            pi.status==="confirmed"||pi.status==="returned"?"#27ae60":
            pi.status==="needed"?"#c0392b":"#e67e22"}">
            ${pi.status||"needed"}
          </span>
        </td>
      </tr>`).join("");
    return `
      <div style="margin-bottom:24px;break-inside:avoid">
        <div style="background:#f5ede0;padding:7px 12px;font-weight:700;font-size:12px;
          text-transform:uppercase;letter-spacing:1px;color:#8a6a20;border-radius:4px 4px 0 0">
          ${cat} (${items.length})
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#fff8ef">
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Item</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Condition</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Location</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("") : '<p style="color:#888;font-style:italic;font-size:13px">No inventory items assigned to this production.</p>';

  const html = `<!DOCTYPE html><html><head><title>${prod.name} — Production Report</title>
  <style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1008;margin:0;padding:0}
    @media print{body{margin:0}.no-print{display:none}}
    h1,h2,h3{font-family:Georgia,serif}
  </style></head><body>
  <div style="max-width:860px;margin:0 auto;padding:40px 32px">

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;
      margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1200">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;
          color:#c4922a;margin-bottom:6px">Production Report · Theatre4u™</div>
        <h1 style="font-size:32px;font-weight:700;color:#1a1200;margin:0 0 4px">${prod.name}</h1>
        ${prod.show_title?`<div style="font-size:16px;color:#666;margin-bottom:4px">${prod.show_title}</div>`:""}
        <div style="font-size:13px;color:#888">${orgName}</div>
      </div>
      <div style="text-align:right">
        ${prod.opening_date?`<div style="font-size:13px;color:#444;margin-bottom:3px">
          <strong>Opens:</strong> ${new Date(prod.opening_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
        </div>`:""}
        ${prod.closing_date?`<div style="font-size:13px;color:#444;margin-bottom:3px">
          <strong>Closes:</strong> ${new Date(prod.closing_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
        </div>`:""}
        <div style="font-size:11px;color:#aaa;margin-top:8px">Generated ${today}</div>
      </div>
    </div>

    <!-- Summary stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px">
      ${[
        ["Needs List Items", totalNeeds],
        ["Items Sourced",    acquiredN],
        ["Progress",         pct+"%"],
        ["Items from Inventory", enriched.length],
      ].map(([l,v])=>`
        <div style="border:1px solid #e8dcc8;border-radius:8px;padding:14px;text-align:center;background:#fffcf7">
          <div style="font-size:26px;font-weight:700;font-family:Georgia,serif;color:#c4922a">${v}</div>
          <div style="font-size:10px;color:#8a7a60;margin-top:3px;text-transform:uppercase;letter-spacing:.5px">${l}</div>
        </div>`).join("")}
    </div>

    ${(estCost>0||actCost>0)?`
    <!-- Cost summary -->
    <div style="background:#fffcf7;border:1px solid #e8d89a;border-radius:8px;padding:16px 20px;
      margin-bottom:28px;display:flex;gap:32px">
      ${estCost>0?`<div><div style="font-size:11px;color:#8a7a60;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Estimated Budget</div>
        <div style="font-size:22px;font-weight:700;font-family:Georgia,serif;color:#c4922a">$${estCost.toFixed(2)}</div></div>`:""}
      ${actCost>0?`<div><div style="font-size:11px;color:#8a7a60;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Actual Spent</div>
        <div style="font-size:22px;font-weight:700;font-family:Georgia,serif;color:#1a1200">$${actCost.toFixed(2)}</div></div>`:""}
    </div>`:""}

    ${prod.notes?`
    <!-- Director notes -->
    <div style="background:#f5f5f5;border-left:4px solid #c4922a;padding:12px 16px;
      border-radius:0 6px 6px 0;margin-bottom:28px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;
        color:#8a7a60;margin-bottom:6px">Director's Notes</div>
      <div style="font-size:13px;color:#444;line-height:1.7">${prod.notes}</div>
    </div>`:""}

    <!-- Needs List -->
    ${totalNeeds>0?`
    <h2 style="font-size:20px;font-weight:700;color:#1a1200;margin:0 0 16px;
      padding-bottom:8px;border-bottom:2px solid #e8dcc8">
      📋 Needs List — What This Production Requires
    </h2>
    ${needsHTML}`:""}

    <!-- From Inventory -->
    <h2 style="font-size:20px;font-weight:700;color:#1a1200;margin:28px 0 16px;
      padding-bottom:8px;border-bottom:2px solid #e8dcc8">
      📦 Items from Your Inventory
    </h2>
    ${invHTML}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;
      font-size:11px;color:#aaa;text-align:center">
      Generated by Theatre4u™ · theatre4u.org · ${today}
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`;

  const w = window.open("","_blank","width=1000,height=750");
  if(w){ w.document.write(html); w.document.close(); }
}

// ── Production Needs CSV Import ───────────────────────────────────────────────
function ProductionNeedsImport({ prod, userId, onImported, onClose }) {
  const [step,      setStep]      = useState("upload"); // upload → preview → done
  const [rows,      setRows]      = useState([]);
  const [headers,   setHeaders]   = useState([]);
  const [mapping,   setMapping]   = useState({});
  const [preview,   setPreview]   = useState([]);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);
  const fileRef = useRef();

  // Fields we can map from CSV
  const FIELDS = [
    { key:"name",           label:"Item Name *",     required:true  },
    { key:"category",       label:"Category",        required:false },
    { key:"qty_needed",     label:"Quantity",        required:false },
    { key:"status",         label:"Status",          required:false },
    { key:"source",         label:"Source",          required:false },
    { key:"estimated_cost", label:"Estimated Cost",  required:false },
    { key:"notes",          label:"Notes",           required:false },
  ];

  const downloadTemplate = () => {
    const h = ["Item Name","Category","Quantity","Status","Source","Estimated Cost","Notes"];
    const ex = [
      ["Magic Wand","props","1","needed","unknown","","Check with Lincoln High"],
      ["Victorian Ball Gown","costumes","2","searching","exchange","","Need size M and L"],
      ["Crown","props","3","needed","buy","15.00","Party City or Amazon"],
      ["Fog Machine","effects","1","found","in_house","","We have one in effects cage"],
      ["Period Boots","costumes","4","needed","borrow","","Try Fountain Valley HS"],
    ];
    const csv = [h,...ex].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "production_needs_template.csv";
    a.click();
  };

  // Auto-match column headers to field keys
  const autoMatch = h => {
    const s = h.toLowerCase().trim();
    if (s.includes("name") || s.includes("item"))          return "name";
    if (s.includes("cat"))                                  return "category";
    if (s.includes("qty") || s.includes("quantity") || s.includes("num")) return "qty_needed";
    if (s.includes("status"))                               return "status";
    if (s.includes("source") || s.includes("how"))         return "source";
    if (s.includes("cost") || s.includes("price") || s.includes("est")) return "estimated_cost";
    if (s.includes("note") || s.includes("comment"))       return "notes";
    return null;
  };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const allRows = parseCSV(ev.target.result);
      if (allRows.length < 2) { alert("File must have a header row and at least one data row."); return; }
      const hdrs = allRows[0];
      const dataRows = allRows.slice(1).filter(r => r.some(c=>c));
      setHeaders(hdrs);
      setRows(dataRows);
      // Auto-detect mapping
      const auto = {};
      hdrs.forEach((h,i) => { const m = autoMatch(h); if (m) auto[i] = m; });
      setMapping(auto);
      buildPreviewFromRows(hdrs, dataRows, auto);
    };
    reader.readAsText(file);
  };

  const buildPreviewFromRows = (hdrs, dataRows, map) => {
    // Validate category and source values
    const validCats   = CATS.map(c=>c.id);
    const validStatus = ["needed","searching","found","acquired","not_needed"];
    const validSource = ["unknown","in_house","exchange","borrow","buy","donate"];

    const items = dataRows.map(row => {
      const item = {
        name:"", category:"other", qty_needed:1,
        status:"needed", source:"unknown",
        estimated_cost:null, notes:"",
      };
      Object.entries(map).forEach(([colIdx, fieldKey]) => {
        const raw = (row[parseInt(colIdx)]||"").trim();
        if (!raw) return;
        switch(fieldKey) {
          case "name":           item.name = raw; break;
          case "category": {
            const lc = raw.toLowerCase();
            const match = validCats.find(c=>lc.includes(c)||c.includes(lc));
            if (match) item.category = match;
            else item.category = "other";
            break;
          }
          case "qty_needed":     item.qty_needed = parseInt(raw)||1; break;
          case "status": {
            const lc = raw.toLowerCase();
            item.status = validStatus.find(s=>s.includes(lc)||lc.includes(s))||"needed";
            break;
          }
          case "source": {
            const lc = raw.toLowerCase();
            if (lc.includes("house")||lc.includes("own")||lc.includes("inventory")) item.source="in_house";
            else if (lc.includes("exchange")||lc.includes("borrow exchange"))       item.source="exchange";
            else if (lc.includes("borrow"))                                          item.source="borrow";
            else if (lc.includes("buy")||lc.includes("purch"))                      item.source="buy";
            else if (lc.includes("donat"))                                           item.source="donate";
            else item.source="unknown";
            break;
          }
          case "estimated_cost": item.estimated_cost = parseFloat(raw.replace(/[$,]/g,""))||null; break;
          case "notes":          item.notes = raw; break;
        }
      });
      return item;
    }).filter(i => i.name.trim());

    setPreview(items);
    setStep("preview");
  };

  const doImport = async () => {
    setImporting(true);
    const now = new Date().toISOString();
    const payload = preview.map(item => ({
      ...item,
      production_id: prod.id,
      org_id: userId,
      added_at: now,
      updated_at: now,
    }));

    // Insert in batches of 50
    let imported = 0;
    for (let i=0; i<payload.length; i+=50) {
      const { error } = await SB.from("production_needs").insert(payload.slice(i, i+50));
      if (!error) imported += Math.min(50, payload.length-i);
    }
    setResult(imported);
    setStep("done");
    setImporting(false);
  };

  const card = { background:"var(--parch)", border:"1px solid var(--border)",
    borderRadius:10, padding:20 };

  // ── DONE ──
  if (step === "done") return (
    <div style={{...card, textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>✅</div>
      <h3 style={{fontFamily:"var(--serif)",marginBottom:8}}>Import Complete</h3>
      <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>
        {result} item{result!==1?"s":""} added to your needs list.
      </p>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}>
        <button className="btn btn-o btn-sm" onClick={()=>{
          setStep("upload"); setPreview([]); setRows([]); setHeaders([]); setMapping({}); setResult(null);
        }}>Import Another File</button>
        <button className="btn btn-g btn-sm" onClick={()=>onImported()}>Done</button>
      </div>
    </div>
  );

  // ── PREVIEW ──
  if (step === "preview") return (
    <div style={card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>
            Preview — {preview.length} items ready to import
          </div>
          <div style={{fontSize:12,color:"var(--muted)"}}>
            Review the list below. Items with a blank name are skipped automatically.
          </div>
        </div>
        <button className="btn btn-o btn-sm" onClick={()=>setStep("upload")}>← Back</button>
      </div>

      {/* Column mapping */}
      <div style={{marginBottom:16,padding:"12px 14px",background:"rgba(255,255,255,.04)",
        borderRadius:8,border:"1px solid var(--border)"}}>
        <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,
          color:"var(--muted)",marginBottom:10}}>Column Mapping</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
          {FIELDS.map(f=>{
            const colIdx = Object.entries(mapping).find(([,v])=>v===f.key)?.[0];
            return (
              <div key={f.key} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                <span style={{color:"var(--muted)",width:110,flexShrink:0}}>{f.label}</span>
                <select value={colIdx??""} className="fs"
                  style={{fontSize:11,padding:"3px 6px",flex:1}}
                  onChange={e=>{
                    const newMap={...mapping};
                    // Remove old mapping for this field
                    Object.keys(newMap).forEach(k=>{ if(newMap[k]===f.key) delete newMap[k]; });
                    if(e.target.value!=="") newMap[e.target.value]=f.key;
                    setMapping(newMap);
                    buildPreviewFromRows(headers, rows, newMap);
                  }}>
                  <option value="">— skip —</option>
                  {headers.map((h,i)=><option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview table */}
      <div style={{maxHeight:280,overflowY:"auto",marginBottom:16,
        border:"1px solid var(--border)",borderRadius:8}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"rgba(255,255,255,.06)"}}>
              {["Item","Category","Qty","Status","Source","Est. Cost","Notes"].map(h=>(
                <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,
                  fontWeight:800,textTransform:"uppercase",letterSpacing:1,
                  color:"var(--muted)",borderBottom:"1px solid var(--border)",
                  whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((item,i)=>(
              <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"6px 10px",fontWeight:600}}>{item.name}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.category}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.qty_needed}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.status}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.source}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>
                  {item.estimated_cost?`$${item.estimated_cost.toFixed(2)}`:"—"}
                </td>
                <td style={{padding:"6px 10px",color:"var(--muted)",
                  maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap"}}>{item.notes||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button className="btn btn-o btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-g" disabled={importing||preview.length===0} onClick={doImport}>
          {importing ? "Importing…" : `Import ${preview.length} Items`}
        </button>
      </div>
    </div>
  );

  // ── UPLOAD ──
  return (
    <div style={card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:15}}>Import Needs List from CSV</div>
        <button className="btn btn-o btn-sm" onClick={onClose}>✕ Cancel</button>
      </div>

      <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.7,marginBottom:16}}>
        Upload a spreadsheet of everything your production needs — props, costumes, lighting,
        whatever you're tracking. We'll map your columns and import the list in one step.
      </p>

      {/* Download template */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
        background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",
        borderRadius:8,marginBottom:20}}>
        <span style={{fontSize:24}}>📄</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>Download our template</div>
          <div style={{fontSize:12,color:"var(--muted)"}}>
            Start with our CSV template — it has the right columns already set up with example items.
          </div>
        </div>
        <button className="btn btn-o btn-sm" onClick={downloadTemplate}>
          ⬇ Template
        </button>
      </div>

      {/* Upload area */}
      <label style={{display:"block",border:"2px dashed var(--border)",borderRadius:10,
        padding:"32px 20px",textAlign:"center",cursor:"pointer",
        background:"rgba(255,255,255,.02)",transition:"border .15s"}}
        onDragOver={e=>{e.preventDefault();}}
        onDrop={e=>{e.preventDefault();
          const file = e.dataTransfer.files[0];
          if(file){fileRef.current.files=e.dataTransfer.files;handleFile({target:{files:[file]}});}
        }}>
        <div style={{fontSize:36,marginBottom:10}}>📂</div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>
          Drop your CSV here, or click to browse
        </div>
        <div style={{fontSize:12,color:"var(--muted)"}}>
          Supports .csv files. Columns can be in any order — we'll help you map them.
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile}/>
      </label>

      {/* Accepted columns hint */}
      <div style={{marginTop:14,padding:"10px 14px",background:"rgba(255,255,255,.03)",
        borderRadius:8,fontSize:11,color:"var(--muted)",lineHeight:1.8}}>
        <strong style={{color:"var(--text)"}}>Columns we recognize:</strong>{" "}
        Item Name (required) · Category · Quantity · Status · Source · Estimated Cost · Notes
      </div>
    </div>
  );
}

// ── Production Needs Checklist ────────────────────────────────────────────────
// Planning layer: list what you need BEFORE you have it, then track how you source it

const NEED_STATUSES = [
  { key:"needed",     label:"Still Needed",  color:"var(--red)",   icon:"🔴" },
  { key:"searching",  label:"Searching",     color:"var(--gold)",  icon:"🟡" },
  { key:"found",      label:"Found",         color:"var(--blue)",  icon:"🔵" },
  { key:"acquired",   label:"Acquired",      color:"var(--green)", icon:"🟢" },
  { key:"not_needed", label:"Not Needed",    color:"var(--muted)", icon:"⚫" },
];
const NEED_SOURCES = [
  { key:"unknown",   label:"Source TBD"      },
  { key:"in_house",  label:"From Our Inventory" },
  { key:"exchange",  label:"Backstage Exchange" },
  { key:"borrow",    label:"Borrowing"       },
  { key:"buy",       label:"Purchasing"      },
  { key:"donate",    label:"Donated"         },
];

function ProductionNeedsChecklist({ prod, allItems, userId, org, onNavigateToExchange, memberRole=null }) {
  // Role-based permissions
  // director (null) + stage_manager: full access
  // crew: can add and update status, cannot delete or import
  // house: view only (but house can't see Productions at all in nav)
  const canAdd    = memberRole !== "house";
  const canEdit   = memberRole !== "house";
  const canDelete = !memberRole || memberRole === "director" || memberRole === "stage_manager";
  const canImport = !memberRole || memberRole === "director" || memberRole === "stage_manager";
  const [needs,    setNeeds]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [adding,   setAdding]  = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing,  setEditing] = useState(null);
  const [filter,   setFilter]  = useState("all"); // all | needed | acquired
  const [catFilter,setCatFilter]= useState("all");

  // Blank need form
  const blank = () => ({
    name:"", category:"costumes", qty_needed:1,
    notes:"", status:"needed", source:"unknown",
    resolved_item_id:null, resolved_notes:"",
    estimated_cost:"", actual_cost:"",
  });
  const [form, setForm] = useState(blank());
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = async () => {
    const { data } = await SB.from("production_needs")
      .select("*")
      .eq("production_id", prod.id)
      .order("added_at");
    setNeeds(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [prod.id]);

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      production_id: prod.id,
      org_id: userId,
      qty_needed: parseInt(form.qty_needed) || 1,
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
      updated_at: new Date().toISOString(),
    };
    // Strip id from payload
    const { id: _id, ...rest } = payload;
    if (editing) {
      const { error } = await SB.from("production_needs").update(rest).eq("id", editing.id);
      if (error) { alert("Save failed: " + error.message); return; }
      setNeeds(p => p.map(n => n.id === editing.id ? { ...n, ...rest, id:editing.id } : n));
    } else {
      const { data, error } = await SB.from("production_needs").insert(payload).select().single();
      if (error) { alert("Save failed: " + error.message); return; }
      if (data) setNeeds(p => [...p, data]);
    }
    setAdding(false); setEditing(null); setForm(blank());
  };

  const deleteNeed = async (id) => {
    const { error } = await SB.from("production_needs").delete().eq("id", id);
    if (error) { alert("Delete failed: " + error.message); return; }
    setNeeds(p => p.filter(n => n.id !== id));
  };

  const quickStatus = async (id, status) => {
    const { error } = await SB.from("production_needs").update({ status, updated_at:new Date().toISOString() }).eq("id", id);
    if (!error) setNeeds(p => p.map(n => n.id === id ? { ...n, status } : n));
  };

  const linkToInventory = async (needId, itemId) => {
    const { error } = await SB.from("production_needs").update({
      resolved_item_id: itemId,
      source: "in_house",
      status: "acquired",
      updated_at: new Date().toISOString()
    }).eq("id", needId);
    if (!error) setNeeds(p => p.map(n => n.id === needId
      ? { ...n, resolved_item_id:itemId, source:"in_house", status:"acquired" } : n));
  };

  // Filtered view
  const filtered = needs.filter(n => {
    if (filter === "needed" && (n.status === "acquired" || n.status === "not_needed")) return false;
    if (filter === "acquired" && n.status !== "acquired") return false;
    if (catFilter !== "all" && n.category !== catFilter) return false;
    return true;
  });

  // Stats
  const total    = needs.length;
  const acquired = needs.filter(n => n.status === "acquired").length;
  const pct      = total > 0 ? Math.round(acquired / total * 100) : 0;

  // Categories present in this needs list
  const catsUsed = [...new Set(needs.map(n => n.category))];

  const card = { background:"var(--parch)", border:"1px solid var(--border)",
    borderRadius:10, overflow:"hidden" };

  const NeedForm = ({ onDone }) => (
    <div style={{ ...card, padding:20, marginBottom:16 }}>
      <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--gold)" }}>
        {editing ? "Edit Item" : "Add to Needs List"}
      </div>

      {/* Name + Qty row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:12 }}>
        <div className="fg" style={{ margin:0 }}>
          <label className="fl">Item Name *</label>
          <input className="fi" value={form.name} autoFocus
            onChange={e=>upd("name",e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&save()}
            placeholder="e.g. Victorian Ball Gown, Magic Wand, Crown (3)"/>
        </div>
        <div className="fg" style={{ margin:0, width:70 }}>
          <label className="fl">Qty</label>
          <input className="fi" type="number" min="1" value={form.qty_needed}
            onChange={e=>upd("qty_needed",e.target.value)}/>
        </div>
      </div>

      {/* Category */}
      <div className="fg" style={{ marginBottom:12 }}>
        <label className="fl">Category</label>
        <select className="fs" value={form.category} onChange={e=>upd("category",e.target.value)}>
          {CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>

      {/* Source + Status row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
        <div className="fg" style={{ margin:0 }}>
          <label className="fl">How will you source it?</label>
          <select className="fs" value={form.source} onChange={e=>upd("source",e.target.value)}>
            {NEED_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="fg" style={{ margin:0 }}>
          <label className="fl">Status</label>
          <select className="fs" value={form.status} onChange={e=>upd("status",e.target.value)}>
            {NEED_STATUSES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Cost estimates — show only if buying */}
      {(form.source === "buy" || form.source === "borrow") && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          <div className="fg" style={{ margin:0 }}>
            <label className="fl">Est. Cost ($)</label>
            <input className="fi" type="number" min="0" step="0.01"
              value={form.estimated_cost} onChange={e=>upd("estimated_cost",e.target.value)}
              placeholder="0.00"/>
          </div>
          <div className="fg" style={{ margin:0 }}>
            <label className="fl">Actual Cost ($)</label>
            <input className="fi" type="number" min="0" step="0.01"
              value={form.actual_cost} onChange={e=>upd("actual_cost",e.target.value)}
              placeholder="0.00"/>
          </div>
        </div>
      )}

      {/* Resolved notes */}
      <div className="fg" style={{ marginBottom:16 }}>
        <label className="fl">Notes</label>
        <input className="fi" value={form.resolved_notes||form.notes||""}
          onChange={e=>upd("resolved_notes",e.target.value)}
          placeholder='e.g. "Check with Lincoln High", "Order from Amazon", "Grandma has one"'/>
      </div>

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button className="btn btn-o btn-sm" onClick={onDone}>Cancel</button>
        <button className="btn btn-g btn-sm" disabled={!form.name.trim()} onClick={save}>
          {editing ? "Save Changes" : "Add to List"}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Stats row */}
      {total > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12,
            color:"var(--muted)", marginBottom:5 }}>
            <span>{acquired} of {total} items sourced</span>
            <span style={{ fontWeight:700, color:pct===100?"var(--green)":"var(--ink)" }}>{pct}%</span>
          </div>
          <div style={{ height:6, background:"rgba(255,255,255,.08)", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:pct+"%", borderRadius:4,
              background: pct===100 ? "var(--green)" : prod.color||"var(--gold)",
              transition:"width .5s ease" }}/>
          </div>

          {/* Cost summary */}
          {needs.some(n=>n.estimated_cost||n.actual_cost) && (
            <div style={{ display:"flex", gap:16, marginTop:10 }}>
              {[
                { label:"Estimated", val: needs.reduce((s,n)=>s+(parseFloat(n.estimated_cost)||0),0) },
                { label:"Actual",    val: needs.reduce((s,n)=>s+(parseFloat(n.actual_cost)||0),0) },
              ].map(s => s.val > 0 && (
                <div key={s.label} style={{ fontSize:12, color:"var(--muted)" }}>
                  {s.label}: <strong style={{ color:"var(--text)" }}>${s.val.toFixed(2)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
        {/* Filter pills */}
        <div style={{ display:"flex", gap:5 }}>
          {[["all","All"],["needed","Still Needed"],["acquired","Acquired"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)}
              className={"btn btn-o btn-sm"+(filter===k?" btn-active":"")}
              style={{ padding:"4px 10px", fontSize:11,
                background:filter===k?"var(--gold)":"var(--parch)",
                color:filter===k?"#1a1000":"var(--muted)",
                borderColor:filter===k?"var(--gold)":"var(--border)" }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
          {canImport && (
            <button className="btn btn-o btn-sm"
              onClick={()=>{ setShowImport(true); setAdding(false); setEditing(null); }}
              style={{ fontSize:11 }}>
              ⬆ Import CSV
            </button>
          )}
          {canAdd && (
            <button className="btn btn-g btn-sm"
              onClick={()=>{ setEditing(null); setForm(blank()); setAdding(true); setShowImport(false); }}>
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* Import CSV */}
      {showImport && (
        <ProductionNeedsImport
          prod={prod}
          userId={userId}
          onClose={()=>setShowImport(false)}
          onImported={async()=>{ setShowImport(false); await load(); }}
        />
      )}

      {/* Add / Edit form */}
      {!showImport && (adding || editing) && (
        <NeedForm onDone={()=>{ setAdding(false); setEditing(null); setForm(blank()); }}/>
      )}

      {/* Exchange shortcut callout */}
      {needs.some(n=>n.status==="needed"||n.status==="searching") && org?.marketplace_enabled && (
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
          background:"rgba(82,153,224,.08)", border:"1px solid rgba(82,153,224,.2)",
          borderRadius:8, marginBottom:14, cursor:"pointer" }}
          onClick={onNavigateToExchange}>
          <span style={{ fontSize:20 }}>🏪</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--blue)" }}>Check Backstage Exchange</div>
            <div style={{ fontSize:11, color:"var(--muted)" }}>
              Other programs near you may have items on your needs list available to borrow or rent.
            </div>
          </div>
          <span style={{ color:"var(--blue)", fontSize:18 }}>→</span>
        </div>
      )}

      {/* Needs list */}
      {loading ? (
        <div style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>Loading…</div>
      ) : total === 0 ? (
        <div style={{ textAlign:"center", padding:36 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
          <h3 style={{ fontFamily:"var(--serif)", marginBottom:8 }}>Start Your Needs List</h3>
          <p style={{ color:"var(--muted)", fontSize:13, lineHeight:1.7, maxWidth:380, margin:"0 auto 16px" }}>
            Add every prop, costume, and piece of gear your production needs —
            even before you know where it's coming from. Then track how you source each one.
          </p>
          {canAdd && (
            <button className="btn btn-g" onClick={()=>{ setForm(blank()); setAdding(true); }}>
              + Add Your First Item
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:20, color:"var(--muted)", fontSize:13 }}>
          No items match this filter.
        </div>
      ) : (
        // Group by category
        Object.entries(
          filtered.reduce((acc, n) => {
            const cat = n.category || "other";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(n);
            return acc;
          }, {})
        ).map(([catId, catNeeds]) => {
          const cat = CAT[catId] || CAT.other;
          return (
            <div key={catId} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase",
                letterSpacing:1.5, color:cat.color, marginBottom:8,
                display:"flex", alignItems:"center", gap:6 }}>
                {cat.icon} {cat.label} ({catNeeds.length})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {catNeeds.map(need => {
                  const st  = NEED_STATUSES.find(s=>s.key===need.status)||NEED_STATUSES[0];
                  const src = NEED_SOURCES.find(s=>s.key===need.source)||NEED_SOURCES[0];
                  const linkedItem = need.resolved_item_id
                    ? allItems.find(i=>i.id===need.resolved_item_id) : null;

                  return (
                    <div key={need.id} style={{
                      padding:"10px 12px", borderRadius:8,
                      background:"rgba(255,255,255,.03)",
                      border:`1px solid ${need.status==="acquired"
                        ? "rgba(82,199,132,.25)"
                        : need.status==="not_needed"
                        ? "var(--border)"
                        : "var(--border)"}`,
                      opacity: need.status==="not_needed" ? 0.5 : 1,
                    }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                        {/* Status icon — click to cycle */}
                        <div style={{ fontSize:16, cursor:"pointer", flexShrink:0, marginTop:1 }}
                          title="Click to mark acquired"
                          onClick={()=>{
                            const next = need.status==="needed"?"searching"
                              :need.status==="searching"?"found"
                              :need.status==="found"?"acquired"
                              :"needed";
                            quickStatus(need.id, next);
                          }}>
                          {st.icon}
                        </div>

                        {/* Main info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:13,
                            textDecoration:need.status==="not_needed"?"line-through":"none",
                            color:need.status==="acquired"?"var(--green)":"var(--text)" }}>
                            {need.name}
                            {need.qty_needed > 1 && (
                              <span style={{ fontSize:11, color:"var(--muted)",
                                marginLeft:6, fontWeight:400 }}>×{need.qty_needed}</span>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:"var(--muted)", marginTop:2,
                            display:"flex", gap:8, flexWrap:"wrap" }}>
                            <span>{src.label}</span>
                            {need.resolved_notes && <span>· {need.resolved_notes}</span>}
                            {linkedItem && (
                              <span style={{ color:"var(--green)" }}>
                                · Linked: {linkedItem.name}
                              </span>
                            )}
                            {(need.estimated_cost||need.actual_cost) && (
                              <span>
                                {need.actual_cost
                                  ? ("· Actual $"+parseFloat(need.actual_cost).toFixed(2))
                                  : ("· Est. $"+parseFloat(need.estimated_cost).toFixed(2))}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                          {/* Link to inventory */}
                          {need.status !== "acquired" && allItems.length > 0 && (
                            <select
                              onChange={e=>{ if(e.target.value) linkToInventory(need.id, e.target.value); }}
                              value=""
                              style={{ background:"var(--parch)", border:"1px solid var(--border)",
                                borderRadius:6, padding:"2px 6px", fontSize:10,
                                color:"var(--muted)", fontFamily:"inherit", cursor:"pointer" }}
                              title="Link to an item in your inventory">
                              <option value="">Link inventory…</option>
                              {allItems
                                .filter(i=>i.category===need.category || need.category==="other")
                                .slice(0,30)
                                .map(i=>(
                                  <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                            </select>
                          )}
                          {canEdit && (
                            <button onClick={()=>{ setEditing(need); setForm({...need, estimated_cost:need.estimated_cost||"", actual_cost:need.actual_cost||""}); setAdding(false); }}
                              style={{ background:"none", border:"none", color:"var(--muted)",
                                cursor:"pointer", fontSize:13, padding:"0 3px" }}>✏️</button>
                          )}
                          {canDelete && (
                            <button onClick={()=>deleteNeed(need.id)}
                              style={{ background:"none", border:"none", color:"var(--muted)",
                                cursor:"pointer", fontSize:14, padding:"0 3px" }}>✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Production Detail (the folder view) ────────────────────────────────────
function ProductionDetail({ prod, allItems, userId, onEdit, onDelete, onClose, onNavigateTo, org }) {
  const [detailTab, setDetailTab] = useState("needs"); // needs | inventory
  const [prodItems, setProdItems] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");

  const load = useCallback(async () => {
    const { data } = await SB.from("production_items")
      .select("*")
      .eq("production_id", prod.id)
      .order("added_at");
    setProdItems(data || []);
    setLoading(false);
  }, [prod.id]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (piId, status) => {
    const { error } = await SB.from("production_items").update({ status }).eq("id", piId);
    if (!error) setProdItems(p => p.map(x => x.id === piId ? { ...x, status } : x));
  };

  const removeItem = async (piId) => {
    const { error } = await SB.from("production_items").delete().eq("id", piId);
    if (!error) setProdItems(p => p.filter(x => x.id !== piId));
  };

  // Join production_items with allItems
  const enriched = prodItems.map(pi => ({
    ...pi,
    item: allItems.find(i => i.id === pi.item_id)
  })).filter(pi => {
    if (!pi.item) return false;
    if (!search) return true;
    return pi.item.name.toLowerCase().includes(search.toLowerCase());
  });

  // Group by category
  const byCategory = {};
  enriched.forEach(pi => {
    const cat = pi.item?.category || "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(pi);
  });

  const total     = prodItems.length;
  const confirmed = prodItems.filter(p => p.status === "confirmed" || p.status === "returned").length;
  const pct       = total > 0 ? Math.round(confirmed / total * 100) : 0;

  // Days until opening
  const daysUntil = prod.opening_date
    ? Math.ceil((new Date(prod.opening_date) - new Date()) / 86400000)
    : null;

  return (
    <div>
      {/* Header strip */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:20 }}>
        <div style={{ width:48, height:48, borderRadius:10, background:prod.color||"var(--gold)",
          flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:24 }}>🎭</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:700 }}>{prod.name}</div>
          {prod.show_title && <div style={{ fontSize:12, color:"var(--muted)" }}>{prod.show_title}</div>}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6 }}>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8, fontWeight:700,
              background:"rgba(255,255,255,.08)", color:"var(--muted)" }}>{prod.status}</span>
            {prod.opening_date && (
              <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8, fontWeight:700,
                background: daysUntil !== null && daysUntil <= 14 ? "rgba(212,168,67,.2)" : "rgba(255,255,255,.08)",
                color: daysUntil !== null && daysUntil <= 14 ? "var(--gold)" : "var(--muted)" }}>
                {daysUntil !== null && daysUntil > 0
                  ? ("Opens in "+daysUntil+" day"+(daysUntil!==1?"s":""))
                  : daysUntil === 0 ? "Opens today!"
                  : ("Opened "+new Date(prod.opening_date).toLocaleDateString())}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button className="btn btn-o btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn btn-o btn-sm"
            onClick={async()=>{
              const { data:needsData } = await SB.from("production_needs")
                .select("*").eq("production_id", prod.id).order("added_at");
              const { data:piData } = await SB.from("production_items")
                .select("*").eq("production_id", prod.id).order("added_at");
              printProductionReport(prod, needsData||[], piData||[], allItems, org);
            }}
            style={{ color:"var(--gold)", borderColor:"rgba(212,168,67,.3)" }}>
            🖨 Print Report
          </button>
          <button className="btn btn-o btn-sm" style={{ color:"var(--red)" }}
            onClick={()=>{ if(window.confirm("Delete this production?")) onDelete(prod.id); }}>
            Delete
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12,
            color:"var(--muted)", marginBottom:5 }}>
            <span>{confirmed} of {total} items confirmed</span>
            <span style={{ fontWeight:700, color: pct===100?"var(--green)":"var(--ink)" }}>{pct}%</span>
          </div>
          <div style={{ height:7, background:"rgba(255,255,255,.08)", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:pct+"%", borderRadius:4,
              background: pct===100 ? "var(--green)" : prod.color||"var(--gold)",
              transition:"width .5s ease" }}/>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:18, borderBottom:"1px solid var(--border)", paddingBottom:0 }}>
        {[
          { key:"needs",     label:"📋 Needs List",      desc:"Plan what you need" },
          { key:"inventory", label:"📦 From Inventory",  desc:"Items from your collection" },
        ].map(t => (
          <button key={t.key} onClick={()=>setDetailTab(t.key)}
            style={{ padding:"8px 16px", background:"none", border:"none",
              borderBottom: detailTab===t.key ? "2px solid var(--gold)" : "2px solid transparent",
              color: detailTab===t.key ? "var(--gold)" : "var(--muted)",
              fontWeight: detailTab===t.key ? 700 : 400,
              fontSize:13, cursor:"pointer", fontFamily:"inherit",
              marginBottom:-1, transition:"all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Needs List tab */}
      {detailTab === "needs" && (
        <ProductionNeedsChecklist
          prod={prod}
          allItems={allItems}
          userId={userId}
          org={org}
          memberRole={org?._memberRole||null}
          onNavigateToExchange={()=>onNavigateTo&&onNavigateTo("marketplace")}
        />
      )}

      {/* From Inventory tab */}
      {detailTab === "inventory" && (<>

      {/* Search */}
      {total > 3 && (
        <div className="srch" style={{ marginBottom:14, width:"100%", maxWidth:280 }}>
          {Ic.search}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…"/>
        </div>
      )}

      {/* Items grouped by category */}
      {loading ? (
        <div style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>Loading…</div>
      ) : total === 0 ? (
        <div style={{ textAlign:"center", padding:36 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📦</div>
          <h3 style={{ fontFamily:"var(--serif)", marginBottom:6 }}>No Items Yet</h3>
          <p style={{ color:"var(--muted)", fontSize:13, lineHeight:1.6 }}>
            Open any item in Inventory and click "Add to Production" to start building your list.
          </p>
        </div>
      ) : enriched.length === 0 ? (
        <div style={{ textAlign:"center", padding:24, color:"var(--muted)" }}>No items match your search.</div>
      ) : (
        Object.entries(byCategory).map(([catId, items]) => {
          const cat = CAT[catId] || CAT.other;
          return (
            <div key={catId} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1.5,
                color:cat.color, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                {cat.icon} {cat.label} ({items.length})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {items.map(pi => {
                  const st = PROD_STATUS_MAP[pi.status] || PROD_STATUS_MAP.needed;
                  return (
                    <div key={pi.id} style={{ display:"flex", alignItems:"center", gap:10,
                      padding:"9px 12px", borderRadius:8,
                      background:"rgba(255,255,255,.03)", border:"1px solid var(--border)" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {pi.item?.name}
                        </div>
                        <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>
                          {pi.item?.location || pi.item?.condition || ""}
                          {pi.qty_needed > 1 ? " · Need "+pi.qty_needed : ""}
                        </div>
                      </div>
                      {/* Status toggle */}
                      <select value={pi.status}
                        onChange={e => updateStatus(pi.id, e.target.value)}
                        style={{ background:"var(--parch)", border:`1px solid ${st.color}40`,
                          borderRadius:6, padding:"3px 7px", fontSize:11, fontWeight:700,
                          color:st.color, fontFamily:"inherit", cursor:"pointer", outline:"none" }}>
                        {PROD_STATUSES.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                      <button onClick={() => removeItem(pi.id)}
                        style={{ background:"none", border:"none", color:"var(--muted)",
                          cursor:"pointer", fontSize:16, padding:"0 2px", lineHeight:1,
                          display:"flex", alignItems:"center" }}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
      {prod.notes && (
        <div style={{ marginTop:16, padding:"10px 14px", background:"rgba(255,255,255,.03)",
          borderRadius:8, border:"1px solid var(--border)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:4,
            textTransform:"uppercase", letterSpacing:1 }}>Notes</div>
          <div style={{ fontSize:13, color:"var(--ink)", lineHeight:1.6 }}>{prod.notes}</div>
        </div>
      )}
      </>)}
    </div>
  );
}

// ── Productions Page ───────────────────────────────────────────────────────
function Productions({ userId, allItems, org, onNavigateTo }) {
  const [productions, setProductions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null); // "new" | "edit" | "detail"
  const [active,      setActive]      = useState(null);
  const [filter,      setFilter]      = useState("all"); // all | planning | active | closed

  const load = useCallback(async () => {
    const { data } = await SB.from("productions")
      .select("*, production_items(id, status)")
      .eq("org_id", userId)
      .order("created_at", { ascending: false });
    setProductions(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const saveProd = async (form) => {
    // Strip fields that aren't columns (embedded joins, immutable fields)
    const { id: _id, org_id: _org, created_at: _ca, production_items: _pi, ...payload } = form;
    if (active && modal === "edit") {
      const { data, error } = await SB.from("productions")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", active.id).select().single();
      if (error) { alert("Save failed: " + error.message); return; }
      if (data) {
        setProductions(p => p.map(x => x.id === data.id ? { ...x, ...data } : x));
        // If we came from detail view, update active so it reflects new dates
        setActive(prev => prev ? { ...prev, ...data } : prev);
      }
    } else {
      const { data, error } = await SB.from("productions")
        .insert({ ...payload, org_id: userId }).select().single();
      if (error) { alert("Save failed: " + error.message); return; }
      if (data) setProductions(p => [data, ...p]);
    }
    // If editing from detail, go back to detail not close entirely
    if (modal === "edit" && active) {
      setModal("detail");
    } else {
      setModal(null); setActive(null);
    }
  };

  const deleteProd = async (id) => {
    await SB.from("productions").delete().eq("id", id);
    setProductions(p => p.filter(x => x.id !== id));
    setModal(null); setActive(null);
  };

  const visible = filter === "all" ? productions : productions.filter(p => p.status === filter);

  return (
    <div style={{ position:"relative" }}>
      <img src={usp("photo-1503095396549-807759245b35", 1400, 900)} alt="" className="page-bg-img"/>
      <div style={{ padding:"32px 36px 0" }}>
        <div className="hero-wrap" style={{ height:220 }}>
          <img src={usp("photo-1503095396549-807759245b35", 1100, 280)} alt="Productions" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🎭 Show Planning</div>
            <h1 className="hero-title" style={{ fontSize:44 }}>Productions</h1>
            <p className="hero-sub">Create a folder for each show. Track every costume, prop, and piece of gear from wishlist to opening night.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{ padding:"24px 36px 56px", position:"relative", zIndex:1 }}>
        {/* Toolbar */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:20, alignItems:"center" }}>
          <div className="vtog">
            {["all","planning","active","closed"].map(f => (
              <button key={f} className={filter===f?"on":""} onClick={()=>setFilter(f)}
                style={{ textTransform:"capitalize" }}>{f}</button>
            ))}
          </div>
          <div style={{ marginLeft:"auto" }}>
            <button className="btn btn-g" onClick={()=>{ setActive(null); setModal("new"); }}>
              <span style={{ width:15, height:15, display:"flex" }}>{Ic.plus}</span>
              New Production
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:"center", padding:56 }}>
            <div style={{ fontSize:48, marginBottom:14 }}>🎭</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:8 }}>
              {filter==="all" ? "No Productions Yet" : ("No "+filter+" productions")}
            </h3>
            <p style={{ color:"var(--muted)", fontSize:13, maxWidth:380, margin:"0 auto 20px", lineHeight:1.6 }}>
              {filter==="all"
                ? "Create a production folder for each show. Save items from your inventory to track exactly what you need."
                : ("No shows in "+filter+" status.")}
            </p>
            {filter==="all" && (
              <button className="btn btn-g" onClick={()=>{ setActive(null); setModal("new"); }}>
                + Create First Production
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:14 }}>
            {visible.map(prod => {
              const total     = prod.production_items?.length || 0;
              const confirmed = prod.production_items?.filter(pi =>
                pi.status==="confirmed"||pi.status==="returned").length || 0;
              const pct = total > 0 ? Math.round(confirmed/total*100) : 0;
              const daysUntil = prod.opening_date
                ? Math.ceil((new Date(prod.opening_date) - new Date()) / 86400000)
                : null;
              return (
                <div key={prod.id} className="card card-p"
                  style={{ cursor:"pointer", borderLeft:`4px solid ${prod.color||"var(--gold)"}` }}
                  onClick={() => { setActive(prod); setModal("detail"); }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:10 }}>
                    <div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700,
                        lineHeight:1.3 }}>{prod.name}</div>
                      {prod.show_title && (
                        <div style={{ fontSize:12, color:"var(--muted)", marginTop:1 }}>{prod.show_title}</div>
                      )}
                    </div>
                    <span style={{ fontSize:10, padding:"3px 8px", borderRadius:8, fontWeight:800,
                      textTransform:"uppercase", letterSpacing:.5, flexShrink:0,
                      background: prod.status==="active" ? "rgba(76,175,80,.15)" :
                                  prod.status==="closed" ? "rgba(255,255,255,.07)" : "rgba(212,168,67,.12)",
                      color: prod.status==="active" ? "var(--green)" :
                             prod.status==="closed" ? "var(--muted)" : "var(--gold)" }}>
                      {prod.status}
                    </span>
                  </div>

                  {/* Progress */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      fontSize:11, color:"var(--muted)", marginBottom:4 }}>
                      <span>{total} item{total!==1?"s":""}</span>
                      <span style={{ fontWeight:700, color:pct===100?"var(--green)":undefined }}>{pct}% confirmed</span>
                    </div>
                    <div style={{ height:5, background:"rgba(255,255,255,.08)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:pct+"%", borderRadius:3,
                        background: pct===100 ? "var(--green)" : prod.color||"var(--gold)",
                        transition:"width .5s" }}/>
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {prod.opening_date && (
                      <span style={{ fontSize:11, color:"var(--muted)" }}>
                        📅 {daysUntil !== null && daysUntil > 0
                          ? ("Opens in "+daysUntil+"d")
                          : new Date(prod.opening_date).toLocaleDateString()}
                      </span>
                    )}
                    {prod.closing_date && (
                      <span style={{ fontSize:11, color:"var(--muted)" }}>
                        → {new Date(prod.closing_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {(modal==="new"||modal==="edit") && (
        <Modal title={modal==="new"?"New Production":"Edit Production"}
          onClose={()=>{ setModal(null); setActive(null); }}>
          <ProductionForm prod={modal==="edit"?active:null}
            onSave={saveProd}
            onCancel={()=>{ setModal(null); setActive(null); }}/>
        </Modal>
      )}
      {modal==="detail" && active && (
        <Modal title="Production Details"
          onClose={()=>{ setModal(null); setActive(null); load(); }}>
          <ProductionDetail
            prod={active}
            allItems={allItems}
            userId={userId}
            org={org}
            onNavigateTo={onNavigateTo}
            onEdit={()=>setModal("edit")}
            onDelete={deleteProd}
            onClose={()=>{ setModal(null); setActive(null); load(); }}
          />
        </Modal>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MESSAGING  (Chat)
// ══════════════════════════════════════════════════════════════════════════════

// ── New Conversation Modal (shown from Marketplace "Contact" button) ──────────
function NewConversationModal({ item, itemOrgId, itemOrgName, currentUserId, currentOrgName, onOpen, onClose }) {
  const [body,    setBody]    = useState("");
  const [sending, setSending] = useState(false);
  const [err,     setErr]     = useState("");

  const send = async () => {
    if (!body.trim()) return;
    setSending(true); setErr("");
    try {
      // Check for existing conversation about this item
      let convId = null;
      const { data: existing } = await SB.from("conversations")
        .select("id")
        .eq("item_id", item?.id || null)
        .eq("org_a", currentUserId)
        .eq("org_b", itemOrgId)
        .single();

      if (existing) {
        convId = existing.id;
      } else {
        const { data: newConv, error: convErr } = await SB.from("conversations").insert({
          item_id:      item?.id   || null,
          org_a:        currentUserId,
          org_b:        itemOrgId,
          item_name:    item?.name || null,
          last_message: body.trim(),
          last_at:      new Date().toISOString(),
        }).select().single();
        if (convErr) throw convErr;
        convId = newConv.id;
      }

      // Insert message
      const { error: msgErr } = await SB.from("messages").insert({
        conversation_id: convId,
        sender_id:       currentUserId,
        body:            body.trim(),
      });
      if (msgErr) throw msgErr;

      // Update conversation last_message
      await SB.from("conversations").update({ last_message: body.trim(), last_at: new Date().toISOString() }).eq("id", convId);

      // Email notification (non-blocking)
      const { data: { session } } = await SB.auth.getSession();
      fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/message-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          conversation_id: convId,
          recipient_id:    itemOrgId,
          message_preview: body.trim().slice(0, 200),
          item_name:       item?.name || null,
          sender_name:     currentOrgName || "A theatre program",
        })
      }).catch(() => {});

      onOpen(convId);
      onClose();
    } catch(e) {
      setErr(EM.msgSend.body);
    }
    setSending(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:460,background:"#fdf6ec",border:"1px solid var(--border)",
        borderRadius:14,overflow:"hidden",boxShadow:"0 12px 48px rgba(0,0,0,.4)",animation:"su .2s ease"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",display:"flex",
          alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700}}>
              Contact {itemOrgName || "Program"}
            </div>
            {item?.name && <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>Re: {item.name}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid var(--border)",
            color:"var(--muted)",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
        </div>
        <div style={{padding:18}}>
          <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,
            color:"var(--muted)",display:"block",marginBottom:6}}>Your Message</label>
          <textarea
            value={body}
            onChange={e=>setBody(e.target.value)}
            placeholder={item
              ? `Hi! I saw your listing for "${item.name}" on Theatre4u. Is it available for our production running March 15–22?`
              : `Hi! I found your organization on Theatre4u and wanted to reach out…`}
            autoFocus
            rows={5}
            style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
              borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"'Raleway',sans-serif",
              color:"var(--ink)",outline:"none",resize:"vertical",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor="var(--gold)"}
            onBlur={e=>e.target.style.borderColor="var(--border)"}
          />
          {err && <div style={{color:"var(--red)",fontSize:12,marginTop:6}}>{err}</div>}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
            <button className="btn btn-o" onClick={onClose}>Cancel</button>
            <button className="btn btn-g" onClick={send} disabled={!body.trim()||sending}>
              {sending ? "Sending…" : "Send Message →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chat Window ────────────────────────────────────────────────────────────────

// ── Messages Page ──────────────────────────────────────────────────────────────



function normalizeImageUrl(url) {
  if (!url) return null;
  const u = url.trim();
  if (!u.startsWith("http")) return null;
  const gD=u.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if(gD) return `https://drive.google.com/thumbnail?id=${gD[1]}&sz=w800`;
  const gO=u.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if(gO) return `https://drive.google.com/thumbnail?id=${gO[1]}&sz=w800`;
  const gU=u.match(/drive\.google\.com\/uc[^?]*\?.*[?&]id=([^&]+)/);
  if(gU) return `https://drive.google.com/thumbnail?id=${gU[1]}&sz=w800`;
  if(u.includes("dropbox.com")) return u.replace("www.dropbox.com","dl.dropboxusercontent.com").replace(/[?&]dl=0/,"").replace(/[?&]raw=0/,"")+(u.includes("?")?"&":"?")+"raw=1";
  if(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)) return u;
  return u;
}

function CSVImport({ onImport, onClose, userId }) {
  const [step,    setStep]    = useState("upload");   // upload → map → preview → done
  const [headers, setHeaders] = useState([]);
  const [rows,    setRows]    = useState([]);
  const [mapping, setMapping] = useState({});         // csvCol → fieldKey
  const [parsed,  setParsed]  = useState([]);
  const [errors,  setErrors]  = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result,  setResult]  = useState(null);
  const fileRef = useRef();

  // ── Step 1: Upload & parse ───────────────────────────────────────────────
  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const allRows = parseCSV(ev.target.result);
      if (allRows.length < 2) { alert(EM.csvFormat.title+"\n\n"+EM.csvFormat.body); return; }
      const hdrs = allRows[0];
      const dataRows = allRows.slice(1).filter(r => r.some(c=>c));
      setHeaders(hdrs);
      setRows(dataRows);
      // Auto-detect mapping
      const auto = {};
      hdrs.forEach((h,i) => { const match = autoMatch(h); if (match) auto[i] = match; });
      setMapping(auto);
      setStep("map");
    };
    reader.readAsText(file);
  };

  // Download our template
  const downloadTemplate = () => {
    const h = ["Name","Category","Condition","Size","Qty","Location","Availability","Market","Rent","Sale","Tags","Image URL","Notes"];
    const ex = [
      ["Victorian Ball Gown","costumes","Good","M","1","Costume Closet A","In Stock","For Rent","25","0","period;formal","Used in A Christmas Carol"],
      ["Fog Machine 1000W","effects","Excellent","N/A","2","Effects Cage","In Stock","For Rent","20","0","atmosphere","Includes remote"],
      ["Romeo & Juliet Scripts","scripts","Fair","N/A","30","Library","In Stock","For Sale","0","5","shakespeare","Director annotated"],
    ];
    const csv = [h,...ex].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "theatre4u_import_template.csv";
    a.click();
  };

  // ── Step 2: Column mapping → build preview ───────────────────────────────
  const buildPreview = () => {
    const errs = [];
    const nameCol = Object.entries(mapping).find(([,v])=>v==="name");
    if (!nameCol) { errs.push(EM.csvNoName.body); setErrors(errs); return; }

    const items = rows.map((row, ri) => {
      const item = {
        category: "other", condition: "Good", size: "N/A",
        qty: 1, avail: "In Stock", mkt: "Not Listed",
        rent: 0, sale: 0, tags: [], notes: "", location: "", img: null, description: ""
      };
      Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
        const raw = row[parseInt(colIdx)];
        const val = coerce(fieldKey, raw);
        if (val !== undefined) item[fieldKey] = val;
      });
      if (!item.name?.trim()) errs.push(`Row ${ri+2}: Item name is blank — row will be skipped.`);
      return item;
    }).filter(i => i.name?.trim());

    setErrors(errs);
    setParsed(items);
    setStep("preview");
  };

  // ── Step 3: Import ────────────────────────────────────────────────────────
  const doImport = async () => {
    setImporting(true);
    setProgress(0);
    const BATCH = 50;
    let imported = 0, failed = 0;
    const now = new Date().toISOString();

    for (let i=0; i<parsed.length; i+=BATCH) {
      const batch = parsed.slice(i, i+BATCH).map(item => ({
        ...item,
        org_id: userId,
        added: now,
      }));
      const { error } = await SB.from("items").insert(batch);
      if (error) { failed += batch.length; console.error("Import batch error:", error); }
      else { imported += batch.length; }
      setProgress(Math.round(((i+BATCH)/parsed.length)*100));
    }
    setResult({ imported, failed, total: parsed.length });
    setImporting(false);
    setStep("done");
    if (imported > 0) onImport(); // trigger reload
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const W = { maxWidth:680, width:"100%" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(18,6,0,.78)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fi .15s ease"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...W,background:"#fdf6ec",border:"1px solid var(--border)",borderRadius:14,
        maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 56px rgba(0,0,0,.5)",
        animation:"su .2s ease"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 22px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:2}}>Import from CSV</h2>
            <div style={{display:"flex",gap:12,marginTop:6}}>
              {["upload","map","preview","done"].map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,
                  color:step===s?"var(--gold)":["upload","map","preview","done"].indexOf(step)>i?"var(--green)":"var(--muted)",
                  fontWeight:step===s?700:400}}>
                  <div style={{width:18,height:18,borderRadius:"50%",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:9,fontWeight:800,
                    background:step===s?"var(--gold)":["upload","map","preview","done"].indexOf(step)>i?"var(--green)":"rgba(18,6,0,.1)",
                    color:step===s||["upload","map","preview","done"].indexOf(step)>i?"#1a0f00":"var(--muted)"}}>
                    {["upload","map","preview","done"].indexOf(step)>i?"✓":i+1}
                  </div>
                  {s[0].toUpperCase()+s.slice(1)}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid var(--border)",
            color:"var(--muted)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>✕</button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 22px"}}>

          {/* ── STEP 1: UPLOAD ── */}
          {step==="upload" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",
                borderRadius:10,padding:16}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:6,color:"var(--gold)"}}>💡 Two ways to import</div>
                <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,marginBottom:10}}>
                  <strong style={{color:"var(--ink)"}}>Option A</strong> — Download our template, fill it in, upload it back.<br/>
                  <strong style={{color:"var(--ink)"}}>Option B</strong> — Upload any spreadsheet you already have. We'll help you match your columns to ours.
                </p>
                <button onClick={downloadTemplate} style={{background:"none",border:"1px solid var(--border)",
                  color:"var(--ink)",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12,
                  fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                  ⬇ Download Template CSV
                </button>
              </div>

              <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                gap:10,border:"2px dashed var(--border)",borderRadius:12,padding:"36px 20px",
                cursor:"pointer",transition:"border-color .2s",textAlign:"center"}}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--gold)"}}
                onDragLeave={e=>{e.currentTarget.style.borderColor="var(--border)"}}
                onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--border)";
                  const f=e.dataTransfer.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);fileRef.current.files=dt.files;handleFile({target:{files:[f]}})}}}>
                <div style={{fontSize:40}}>📂</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Drop your CSV here</div>
                <div style={{fontSize:12,color:"var(--muted)"}}>or click to browse — .csv files only</div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile}/>
              </label>

              <div style={{background:"rgba(66,165,245,.06)",border:"1px solid rgba(66,165,245,.18)",borderRadius:9,padding:"11px 14px",fontSize:12,color:"var(--muted)",lineHeight:1.65}}><strong style={{color:"#42a5f5"}}>📷 Adding Photos via Image URL</strong> — Add a column called <strong style={{color:"var(--ink)"}}>Image URL</strong> with a public Google Drive or Dropbox share link. Google Drive: right-click → Share → "Anyone with the link" → Copy link → paste in CSV.</div>
              <div style={{fontSize:11,color:"var(--muted)",textAlign:"center"}}>
                Supports exports from Google Sheets, Excel, Airtable, and most inventory apps.
              </div>
            </div>
          )}

          {/* ── STEP 2: MAP COLUMNS ── */}
          {step==="map" && (
            <div>
              <p style={{fontSize:13,color:"var(--muted)",marginBottom:16,lineHeight:1.5}}>
                We found <strong style={{color:"var(--ink)"}}>{headers.length} columns</strong> and <strong style={{color:"var(--ink)"}}>{rows.length} rows</strong> in your file.
                Match each column to a Theatre4u field. We've auto-detected what we can — check and adjust below.
              </p>

              <div style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 28px 1fr",gap:0,
                  background:"rgba(18,6,0,.06)",padding:"8px 14px",fontSize:10,
                  textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",fontWeight:700}}>
                  <span>Your Column</span><span/>
                  <span>Maps To</span>
                </div>
                {headers.map((h,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 28px 1fr",
                    alignItems:"center",gap:0,padding:"8px 14px",
                    borderTop:"1px solid var(--border)",background:i%2===0?"transparent":"rgba(255,255,255,.02)"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{h||"(blank)"}</div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>
                        e.g. {rows[0]?.[i]||"—"}
                      </div>
                    </div>
                    <div style={{textAlign:"center",color:"var(--muted)",fontSize:16}}>→</div>
                    <select value={mapping[i]||""} onChange={e=>{
                        const v=e.target.value;
                        setMapping(p=>{const n={...p};if(v)n[i]=v;else delete n[i];return n;});
                      }}
                      style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:6,
                        padding:"5px 8px",color:mapping[i]?"var(--ink)":"var(--muted)",
                        fontSize:12,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
                      <option value="">— skip this column —</option>
                      {CSV_FIELDS.map(f=>(
                        <option key={f.key} value={f.key}>{f.label}{f.required?" *":""}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {errors.length>0&&<div style={{background:"rgba(194,24,91,.1)",border:"1px solid rgba(194,24,91,.25)",
                borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"var(--red)"}}>
                {errors.map((e,i)=><div key={i}>⚠ {e}</div>)}
              </div>}

              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setStep("upload")} style={{background:"none",border:"1px solid var(--border)",
                  color:"var(--muted)",padding:"7px 16px",borderRadius:7,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
                  ← Back
                </button>
                <button onClick={buildPreview} className="btn btn-g" style={{padding:"7px 20px"}}>
                  Preview Import →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: PREVIEW ── */}
          {step==="preview" && (
            <div>
              {(()=>{const withImg=parsed.filter(i=>i.img).length;return withImg>0&&(<div style={{background:"rgba(66,165,245,.08)",border:"1px solid rgba(66,165,245,.2)",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"var(--muted)"}}>📷 <strong style={{color:"#42a5f5"}}>{withImg}</strong> of {parsed.length} items have image URLs.</div>);})()} 
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
                <div style={{flex:1,background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.2)",
                  borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:800,color:"var(--green)"}}>{parsed.length}</div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Items Ready</div>
                </div>
                {errors.length>0&&<div style={{flex:2,background:"rgba(255,167,38,.08)",border:"1px solid rgba(255,167,38,.2)",
                  borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#ffa726",marginBottom:4}}>⚠ {errors.length} warning{errors.length!==1?"s":""}</div>
                  {errors.slice(0,3).map((e,i)=><div key={i} style={{fontSize:11,color:"var(--muted)"}}>{e}</div>)}
                  {errors.length>3&&<div style={{fontSize:11,color:"var(--muted)"}}>+{errors.length-3} more…</div>}
                </div>}
              </div>

              <div style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
                <div style={{overflowX:"auto",maxHeight:320}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:"rgba(18,6,0,.07)",position:"sticky",top:0}}>
                        {["#","Photo","Name","Category","Cond.","Qty","Location","Market","Notes"].map(h=>(
                          <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,
                            textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)",fontWeight:700,
                            whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.slice(0,100).map((item,i)=>{
                        const cat=CAT[item.category]||CAT.other;
                        return(
                          <tr key={i} style={{borderTop:"1px solid var(--border)",
                            background:i%2===0?"transparent":"rgba(18,6,0,.03)"}}>
                            <td style={{padding:"6px 10px",color:"var(--muted)"}}>{i+1}</td>
                            <td style={{padding:"6px 10px",fontWeight:600,maxWidth:160,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</td>
                            <td style={{padding:"6px 10px",whiteSpace:"nowrap"}}>{cat.icon} {cat.label}</td>
                            <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.condition}</td>
                            <td style={{padding:"6px 10px"}}>{item.qty}</td>
                            <td style={{padding:"6px 10px",color:"var(--muted)",maxWidth:120,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.location||"—"}</td>
                            <td style={{padding:"6px 10px"}}>
                              <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:3,
                                background:item.mkt==="Not Listed"?"rgba(255,255,255,.07)":"rgba(212,168,67,.15)",
                                color:item.mkt==="Not Listed"?"var(--muted)":"var(--gold)"}}>{item.mkt}</span>
                            </td>
                            <td style={{padding:"6px 10px",color:"var(--muted)",maxWidth:140,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.notes||"—"}</td>
                          </tr>
                        );
                      })}
                      {parsed.length>100&&(
                        <tr><td colSpan={9} style={{padding:"8px 10px",textAlign:"center",
                          color:"var(--muted)",fontSize:11,borderTop:"1px solid var(--border)"}}>
                          + {parsed.length-100} more rows not shown in preview
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>
                <button onClick={()=>setStep("map")} style={{background:"none",border:"1px solid var(--border)",
                  color:"var(--muted)",padding:"7px 16px",borderRadius:7,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
                  ← Back
                </button>
                <button onClick={doImport} className="btn btn-g"
                  style={{padding:"8px 22px",fontSize:14,fontWeight:800}} disabled={parsed.length===0||importing}>
                  {importing
                    ? <span style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",
                          borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>
                        Importing… {progress}%
                      </span>
                    : `Import ${parsed.length} Item${parsed.length!==1?"s":""} →`}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: DONE ── */}
          {step==="done" && result && (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:56,marginBottom:16}}>{result.failed===0?"🎉":"⚠️"}</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:24,marginBottom:8}}>
                {result.failed===0?"Import Complete!":"Import Finished with Errors"}
              </h3>
              <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:20,flexWrap:"wrap"}}>
                <div style={{background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.2)",
                  borderRadius:10,padding:"12px 24px",textAlign:"center"}}>
                  <div style={{fontSize:28,fontWeight:800,color:"var(--green)"}}>{result.imported}</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>Items Imported</div>
                </div>
                {result.failed>0&&<div style={{background:"rgba(194,24,91,.1)",border:"1px solid rgba(194,24,91,.2)",
                  borderRadius:10,padding:"12px 24px",textAlign:"center"}}>
                  <div style={{fontSize:28,fontWeight:800,color:"var(--red)"}}>{result.failed}</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>Failed</div>
                </div>}
              </div>
              <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>
                {result.imported>0
                  ? "Your items are now in your Inventory. You can edit any of them individually to add photos or refine details."
                  : "Something went wrong. Please check your CSV file and try again."}
              </p>
              <button onClick={onClose} className="btn btn-g" style={{padding:"9px 28px"}}>
                Go to Inventory →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// COMMUNITY BOARD
// ══════════════════════════════════════════════════════════════════════════════
const POST_TYPES = [
  { id:"show",         label:"Upcoming Event",   icon:"🎟️", color:"#7b1fa2", desc:"Share your performance, concert, or exhibition dates" },
  { id:"audition",     label:"Call / Tryout",    icon:"🎤", color:"#1565c0", desc:"Looking for performers, members, or crew" },
  { id:"photo",        label:"Event Photos",      icon:"📸", color:"#c2185b", desc:"Share photos from your recent events" },
  { id:"wanted",       label:"Item Wanted",       icon:"🔍", color:"#d84315", desc:"Looking for a specific prop, costume, or equipment" },
  { id:"resource",     label:"Resource Share",    icon:"🤝", color:"#00838f", desc:"Offering props, costumes, or equipment to borrow or share" },
  { id:"announcement", label:"Announcement",      icon:"📢", color:"#2e7d32", desc:"News, updates, or anything else" },
];
const PT = Object.fromEntries(POST_TYPES.map(p=>[p.id,p]));

function CommunityPostForm({initial, onSave, onCancel, saving=false}) {
  const blank = {type:"show",title:"",body:"",show_title:"",venue:"",start_date:"",end_date:"",ticket_url:"",contact_email:"",tags:[],images:[]};
  const [f,setF] = useState(()=>initial ? {...blank,...initial,images:initial.images||[]} : blank);
  const [tagInput,setTagInput] = useState("");
  const [uploading,setUploading] = useState(false);
  const photoRef = useRef();
  const upd = (k,v)=>setF(p=>({...p,[k]:v}));

  const handlePhotos = async(e)=>{
    const files = Array.from(e.target.files||[]).slice(0,6-(f.images||[]).length);
    if(!files.length) return;
    setUploading(true);
    const urls = [];
    for(const file of files){
      // Use resizeImg if available, otherwise compressImage
      const resized = typeof resizeImg==="function"
        ? await resizeImg(file,1200,0.85)
        : await new Promise(res=>{
            const reader=new FileReader();
            reader.onload=e2=>{
              const img=new Image();
              img.onload=()=>{
                const canvas=document.createElement("canvas");
                let w=img.width,h=img.height;
                if(w>1200){h=Math.round(1200/w*h);w=1200;}
                canvas.width=w;canvas.height=h;
                canvas.getContext("2d").drawImage(img,0,0,w,h);
                res(canvas.toDataURL("image/jpeg",0.85));
              };
              img.src=e2.target.result;
            };
            reader.readAsDataURL(file);
          });
      // Upload to community-photos bucket
      try{
        const blob=await fetch(resized).then(r=>r.blob());
        const path=`community/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const{data,error}=await SB.storage.from("community-photos").upload(path,blob,{contentType:"image/jpeg",upsert:false});
        if(!error&&data){
          const{data:urlData}=SB.storage.from("community-photos").getPublicUrl(path);
          if(urlData?.publicUrl) urls.push(urlData.publicUrl);
        }
      }catch(err){console.error("Photo upload error:",err);}
    }
    upd("images",[...(f.images||[]),...urls]);
    setUploading(false);
    if(photoRef.current) photoRef.current.value="";
  };

  const removePhoto=(url)=>upd("images",(f.images||[]).filter(u=>u!==url));
  const addTag=()=>{const t=tagInput.trim().toLowerCase();if(t&&!(f.tags||[]).includes(t))upd("tags",[...(f.tags||[]),t]);setTagInput("");};
  const valid = f.title.trim() && f.type;

  return(<div className="fg2">
    <div className="fg fu">
      <label className="fl">Post Type</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {POST_TYPES.map(pt=>(
          <button key={pt.id} type="button" onClick={()=>upd("type",pt.id)}
            style={{padding:"8px 14px",borderRadius:8,border:"1.5px solid",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",
              background:f.type===pt.id?pt.color+"22":"var(--parch)",
              color:f.type===pt.id?pt.color:"var(--muted)",
              borderColor:f.type===pt.id?pt.color:"var(--border)"}}>
            {pt.icon} {pt.label}
          </button>
        ))}
      </div>
    </div>
    <div className="fg fu"><label className="fl">Title *</label><input className="fi" value={f.title} onChange={e=>upd("title",e.target.value)} placeholder={f.type==="show"?"e.g. Tickets Now Available — Into the Woods":f.type==="audition"?"e.g. Seeking Leads & Ensemble for Spring Musical":f.type==="wanted"?"e.g. Looking for Wizard of Oz costume set":"Title"} autoFocus/></div>
    {(f.type==="show"||f.type==="audition")&&<>
      <div className="fg"><label className="fl">Show Title</label><input className="fi" value={f.show_title||""} onChange={e=>upd("show_title",e.target.value)} placeholder="Into the Woods"/></div>
      <div className="fg"><label className="fl">Venue</label><input className="fi" value={f.venue||""} onChange={e=>upd("venue",e.target.value)} placeholder="Lincoln High Auditorium"/></div>
    </>}
    {f.type==="show"&&<>
      <div className="fg"><label className="fl">Opening Date</label><input className="fi" type="date" value={f.start_date||""} onChange={e=>upd("start_date",e.target.value)}/></div>
      <div className="fg"><label className="fl">Closing Date</label><input className="fi" type="date" value={f.end_date||""} onChange={e=>upd("end_date",e.target.value)}/></div>
      <div className="fg"><label className="fl">Ticket Link (optional)</label><input className="fi" type="url" value={f.ticket_url||""} onChange={e=>upd("ticket_url",e.target.value)} placeholder="https://..."/></div>
    </>}
    {f.type==="audition"&&<>
      <div className="fg"><label className="fl">Audition Date(s)</label><input className="fi" type="date" value={f.start_date||""} onChange={e=>upd("start_date",e.target.value)}/></div>
      <div className="fg"><label className="fl">Contact Email</label><input className="fi" type="email" value={f.contact_email||""} onChange={e=>upd("contact_email",e.target.value)} placeholder="director@school.edu"/></div>
    </>}
    <div className="fg fu"><label className="fl">{f.type==="photo"?"Caption / Description":f.type==="audition"?"What You're Looking For":"Details"}</label><textarea className="ft" value={f.body||""} onChange={e=>upd("body",e.target.value)} placeholder={f.type==="show"?"Tell the community about your production...":f.type==="audition"?"Describe the roles available, experience needed, rehearsal schedule...":f.type==="wanted"?"Describe exactly what you're looking for...":"What would you like to share?"}/></div>

    <div className="fg fu">
      <label className="fl">Tags</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>{(f.tags||[]).map(t=><span key={t} className="mt" style={{cursor:"pointer"}} onClick={()=>upd("tags",f.tags.filter(x=>x!==t))}>{t} ×</span>)}</div>
      <div style={{display:"flex",gap:6}}><input className="fi" value={tagInput} onChange={e=>setTagInput(e.target.value)} placeholder="musical, drama, comedy..." style={{flex:1}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag();}}}/><button className="btn btn-o btn-sm" onClick={addTag}>Add</button></div>
    </div>
    
    {/* ── Photo Upload ─────────────────────────────────────────── */}
    <div className="fg fu" style={{marginBottom:4}}>
      <label className="fl" style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        📸 Production Photos <span style={{fontWeight:400,color:"var(--muted)",fontSize:10}}>(up to 6)</span>
      </label>
      {(f.images||[]).length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
          {(f.images||[]).map((url,i)=>(
            <div key={i} style={{position:"relative",width:80,height:80,borderRadius:8,overflow:"hidden",border:"1.5px solid var(--border)",flexShrink:0}}>
              <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <button onClick={()=>removePhoto(url)} style={{position:"absolute",top:2,right:2,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,.75)",border:"none",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
            </div>
          ))}
        </div>
      )}
      {(f.images||[]).length<6&&(
        <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:8,border:"1.5px dashed var(--border)",cursor:"pointer",color:"var(--muted)",fontSize:13,fontWeight:600,transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--gold)";e.currentTarget.style.color="var(--gold)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--muted)";}}>
          {uploading?"⏳ Uploading…":"📷 Add Photos"}
          <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} disabled={uploading}/>
        </label>
      )}
      {uploading&&<div style={{fontSize:12,color:"var(--gold)",marginTop:4}}>Uploading photos…</div>}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10,paddingTop:14,borderTop:"1.5px solid var(--border)",gridColumn:"1/-1"}}>
      <button className="btn btn-o" onClick={onCancel}>Cancel</button>
      <button className="btn btn-g" disabled={!valid||saving} style={(!valid||saving)?{opacity:.4}:{}} onClick={()=>onSave(f)}>{saving?"Posting…":initial?"Save Changes":"Post to Community"}</button>
    </div>
  </div>);
}

function CommunityPostCard({post, orgName, onEdit, onDelete, isOwn}) {
  const pt = PT[post.type]||PT.announcement;
  const [expanded,setExpanded] = useState(false);
  const hasMore = post.body && post.body.length > 160;

  return(
    <div className="card" style={{marginBottom:14,overflow:"hidden",border:`1px solid ${pt.color}22`}}>
      {/* Header stripe */}
      <div style={{height:4,background:`linear-gradient(90deg,${pt.color},${pt.color}88)`}}/>
      <div style={{padding:"14px 18px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
            <div style={{width:40,height:40,borderRadius:10,background:pt.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{pt.icon}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:pt.color,marginBottom:2}}>{pt.label}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,lineHeight:1.2,color:"var(--ink)"}}>{post.title}</div>
            </div>
          </div>
          {isOwn&&<div style={{display:"flex",gap:4,flexShrink:0}}>
            <button className="ico-btn" onClick={()=>onEdit(post)}>{Ic.edit}</button>
            <button className="ico-btn" style={{color:"var(--red)"}} onClick={()=>onDelete(post.id)}>{Ic.trash}</button>
          </div>}
        </div>

        {/* Show/audition meta */}
        {(post.show_title||post.venue||post.start_date)&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            {post.show_title&&<span style={{padding:"2px 9px",background:"var(--parch)",borderRadius:6,fontSize:12,fontWeight:600,color:"var(--ink)"}}>{post.show_title}</span>}
            {post.venue&&<span style={{padding:"2px 9px",background:"var(--parch)",borderRadius:6,fontSize:12,color:"var(--muted)"}}>📍 {post.venue}</span>}
            {post.start_date&&<span style={{padding:"2px 9px",background:pt.color+"15",borderRadius:6,fontSize:12,fontWeight:600,color:pt.color}}>📅 {new Date(post.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}{post.end_date&&post.end_date!==post.start_date?" – "+new Date(post.end_date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}  </span>}
          </div>
        )}

        {/* Body */}
        {post.body&&(
          <div style={{fontSize:13.5,color:"var(--muted)",lineHeight:1.7,marginBottom:10}}>
            {expanded||!hasMore ? post.body : post.body.slice(0,160)+"…"}
            {hasMore&&<button onClick={()=>setExpanded(!expanded)} style={{marginLeft:5,background:"none",border:"none",color:pt.color,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{expanded?"Show less":"Read more"}</button>}
          </div>
        )}

        {/* Footer */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--amber))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🎭</div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--ink)"}}>{orgName}</div>
              {post.location&&<div style={{fontSize:11,color:"var(--faint)"}}>{post.location}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {(post.tags||[]).slice(0,3).map(t=><span key={t} className="mt">#{t}</span>)}
            {post.ticket_url&&<a href={post.ticket_url} target="_blank" rel="noreferrer" className="btn btn-o btn-sm" style={{fontSize:11,padding:"3px 10px"}}>🎟️ Tickets</a>}
            {post.contact_email&&<a href={`mailto:${post.contact_email}`} className="btn btn-o btn-sm" style={{fontSize:11,padding:"3px 10px"}}>✉️ Contact</a>}
            <FbShareBtn
              url={"https://theatre4u.org/#/community"}
              text={postShareText(post, orgName)}
              compact={true}
              style={{fontSize:11,padding:"3px 9px"}}
            />
            {post.distance_miles != null && (
              <span style={{fontSize:11,fontWeight:700,padding:"1px 7px",background:"rgba(255,255,255,.06)",borderRadius:5,color:"var(--muted)"}}>
                📍 {post.distance_miles < 1 ? "< 1" : Math.round(post.distance_miles)} mi
              </span>
            )}
            <div style={{fontSize:11,color:"var(--faint)"}}>{new Date(post.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunityPage({userId, org, plan}) {
  const [posts,    setPosts]   = useState([]);
  const [orgs,     setOrgs]    = useState({});
  const [loading,  setLoading] = useState(true);
  const [viewerLoc,setViewerLoc] = useState(null);
  const [typeF,    setTypeF]   = useState("all");
  const [search,   setSearch]  = useState("");
  const [modal,    setModal]   = useState(null);
  const [active,   setActive]  = useState(null);
  const [saving,   setSaving]  = useState(false);
  const [msg,      setMsg]     = useState("");

  const load = useCallback(async()=>{
    setLoading(true);
    // Get viewer location — use stored org coords only, no blocking network calls
    const vLat = org?.lat || null;
    const vLng = org?.lng || null;
    setViewerLoc(vLat && vLng ? { lat: vLat, lng: vLng } : null);

    // Use proximity RPC — falls back to recency if no location
    const { data } = await SB.rpc("proximity_community_posts", {
      viewer_lat:   vLat   || null,
      viewer_lng:   vLng   || null,
      radius_miles: 150,
      row_limit:    80,
    });
    // Strip computed RPC columns (distance_miles) before storing
    setPosts((data || []).map(({distance_miles, ...p}) => p));
    // Load org names
    const ids = [...new Set((data || []).map(p => p.org_id))];
    if (ids.length > 0) {
      const { data: orgData } = await SB.from("orgs").select("id,name,location").in("id", ids);
      const map = {}; (orgData || []).forEach(o => { map[o.id] = o.name; });
      setOrgs(map);
    }
    setLoading(false);
  }, [org?.lat, org?.lng, org?.location]);

  useEffect(()=>{load();},[load]);

  const save = async(f)=>{
    setSaving(true);
    try {
      // Use org's stored coordinates directly — no geocoding needed
      // The org's lat/lng is already stored from profile setup
      const geoFields = (org?.lat && org?.lng)
        ? { lat: org.lat, lng: org.lng }
        : viewerLoc
          ? { lat: viewerLoc.lat, lng: viewerLoc.lng }
          : {};
      // Convert empty date strings to null — Postgres DATE columns reject ""
      // Only include real community_posts columns — strip computed fields like distance_miles
      const row = {
        type:           f.type,
        title:          f.title,
        body:           f.body         || null,
        show_title:     f.show_title   || null,
        venue:          f.venue        || null,
        location:       f.location     || null,
        start_date:     f.start_date   || null,
        end_date:       f.end_date     || null,
        ticket_url:     f.ticket_url   || null,
        contact_email:  f.contact_email|| null,
        tags:           f.tags         || [],
        images:         f.images       || [],
        org_id:         userId,
        status:         "active",
        ...geoFields,
      };
      if(active&&modal==="edit"){
        const{data,error}=await SB.from("community_posts").update(row).eq("id",active.id).select().single();
        if(error) throw new Error(error.message);
        if(data){setPosts(p=>p.map(x=>x.id===data.id?data:x));setMsg("✓ Post updated");}
      } else {
        const{data,error}=await SB.from("community_posts").insert(row).select().single();
        if(error) throw new Error(error.message);
        if(data){setPosts(p=>[data,...p]);setMsg("✓ Post published!");}
      }
      setModal(null);setActive(null);
      setTimeout(()=>setMsg(""),3000);
    } catch(err) {
      console.error("Community post save error:", err);
      setMsg("❌ " + EM.generic.body);
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async(id)=>{
    if(!window.confirm("Delete this post?"))return;
    await SB.from("community_posts").update({status:"archived"}).eq("id",id);
    setPosts(p=>p.filter(x=>x.id!==id));
  };

  const filtered = posts.filter(p=>{
    if(typeF!=="all"&&p.type!==typeF)return false;
    if(search){const q=search.toLowerCase();return p.title.toLowerCase().includes(q)||(p.body||"").toLowerCase().includes(q)||(p.show_title||"").toLowerCase().includes(q)||(p.location||"").toLowerCase().includes(q)||(p.tags||[]).some(t=>t.includes(q));}
    return true;
  });

  const myPosts = posts.filter(p=>p.org_id===userId);

  return(
    <div style={{position:"relative"}}>
      <img src={usp("photo-1503095396549-807759245b35",1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:230}}>
          <img src={usp("photo-1503095396549-807759245b35",1100,290)} alt="Community" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🎪 Theatre Community</div>
            <h1 className="hero-title" style={{fontSize:44}}>Community Board</h1>
            <p className="hero-sub">Upcoming shows, audition notices, production photos, and wanted items — from programs across the network.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        {/* Actions bar */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20,alignItems:"center"}}>
          <div className="srch" style={{position:"relative",flex:1,minWidth:220}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",display:"flex",pointerEvents:"none"}}>{Ic.search}</span>
            <input className="fi" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search shows, auditions, wanted items…" style={{paddingLeft:34,width:"100%"}}/>
          </div>
          <div style={{display:"flex",gap:0,border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
            {[["all","All"],["show","🎟️ Events"],["audition","🎤 Calls"],["photo","📸 Photos"],["wanted","🔍 Wanted"],["announcement","📢 News"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTypeF(id)} style={{background:typeF===id?"var(--gold)":"transparent",color:typeF===id?"#1a0f00":"var(--muted)",border:"none",padding:"7px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
                {label}
              </button>
            ))}
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            {msg&&<span style={{color:msg.startsWith("❌")?"var(--red)":"var(--green)",fontWeight:700,fontSize:13}}>{msg}</span>}
            <button className="btn btn-g" onClick={()=>{setActive(null);setModal("add");}}>+ Share Something</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:24,alignItems:"start"}}>
          {/* Main feed */}
          <div>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:12,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
              <span>{filtered.length} post{filtered.length!==1?"s":""}{typeF!=="all"?` · ${PT[typeF]?.label}`:""}</span>
              {viewerLoc
                ? <span style={{color:"var(--green)",fontWeight:700}}>📍 Sorted by proximity to you</span>
                : <span style={{color:"var(--amber)",fontSize:11}}>⚠️ Set your location in Profile for proximity sorting</span>}
            </div>
            {loading
              ?<div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>Loading community posts…</div>
              :filtered.length===0
                ?<div className="empty">
                    <div className="empty-ico">🎪</div>
                    <h3>Be the first to post</h3>
                    <p>Share your upcoming show, post an audition notice, or let the community know what items you're looking for.</p>
                    <button className="btn btn-g" onClick={()=>{setActive(null);setModal("add");}}>+ Share Something</button>
                  </div>
                :filtered.map(post=>(
                    <CommunityPostCard key={post.id} post={post} orgName={orgs[post.org_id]||"A Theatre Program"} isOwn={post.org_id===userId} onEdit={p=>{setActive(p);setModal("edit");}} onDelete={deletePost}/>
                  ))
            }
          </div>

          {/* Sidebar */}
          <div style={{position:"sticky",top:80}}>
            {/* Your posts */}
            {myPosts.length>0&&(
              <div className="card card-p" style={{marginBottom:16}}>
                <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:12}}>Your Posts</h3>
                {myPosts.slice(0,5).map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--linen)"}}>
                    <span style={{fontSize:16}}>{PT[p.type]?.icon||"📢"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                      <div style={{fontSize:10,color:"var(--muted)"}}>{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                    <button className="ico-btn" style={{flexShrink:0,color:"var(--red)"}} onClick={()=>deletePost(p.id)}>{Ic.trash}</button>
                  </div>
                ))}
              </div>
            )}

            {/* What to post guide */}
            <div className="card card-p" style={{background:"linear-gradient(135deg,rgba(212,168,67,.08),rgba(212,168,67,.03))",borderColor:"rgba(212,168,67,.25)"}}>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:12,color:"var(--gold)"}}>What to Share</h3>
              {POST_TYPES.map(pt=>(
                <div key={pt.id} style={{display:"flex",gap:8,padding:"7px 0",borderBottom:"1px solid var(--linen)"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{pt.icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:pt.color}}>{pt.label}</div>
                    <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.4}}>{pt.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{marginTop:10,fontSize:11,color:"var(--muted)",lineHeight:1.5}}>Open to all Theatre4u™ members — free and Pro alike.</div>
              <div style={{marginTop:8,fontSize:11,color:"var(--amber)",lineHeight:1.5,padding:"6px 8px",background:"rgba(212,168,67,.08)",borderRadius:6}}>
                📍 Posts are sorted by proximity. Set your city in Profile for best results.
              </div>
            </div>
          </div>
        </div>
      </div>

      {(modal==="add"||modal==="edit")&&(
        <Modal title={modal==="add"?"Share with the Community":"Edit Post"} onClose={()=>{setModal(null);setActive(null);}}>
          <CommunityPostForm initial={modal==="edit"?active:null} onSave={save} onCancel={()=>{setModal(null);setActive(null);}} saving={saving}/>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMUNITY GATE — opt-in wrapper for CommunityPage
// ══════════════════════════════════════════════════════════════════════════════
function CommunityGate({userId, org, setOrg, plan}) {
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    const updated = {...org, community_enabled: true};
    setOrg(updated);
    await SB.from("orgs").update({community_enabled: true}).eq("id", userId);
    // no need to setJoining(false) — component will re-render as CommunityPage
  };

  if (org?.community_enabled) {
    return <CommunityPage userId={userId} org={org} plan={plan}/>;
  }

  return (
    <div style={{position:"relative",minHeight:"70vh"}}>
      <img src={usp("photo-1503095396549-807759245b35",1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:230}}>
          <img src={usp("photo-1503095396549-807759245b35",1100,290)} alt="Community" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🎪 Theatre Community</div>
            <h1 className="hero-title" style={{fontSize:44}}>Community Board</h1>
            <p className="hero-sub">Connect with theatre programs across the network.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"40px 36px 64px",position:"relative",zIndex:1,maxWidth:700}}>
        <div className="card card-p" style={{borderColor:"rgba(212,168,67,.3)",background:"linear-gradient(135deg,rgba(212,168,67,.06),rgba(212,168,67,.02))"}}>
          <div style={{fontSize:44,marginBottom:16,textAlign:"center"}}>🎪</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,marginBottom:12,textAlign:"center"}}>Join the Community Board</h2>
          <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.7,marginBottom:20,textAlign:"center",maxWidth:500,margin:"0 auto 20px"}}>
            The Community Board is a shared space for theatre programs to connect — post upcoming shows, audition notices, production photos, and wanted items. Other opted-in programs can see your posts.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
            {[
              ["🎭","Post Show Announcements","Let the network know about your upcoming productions."],
              ["🎤","Share Audition Notices","Find talent and help others find their next role."],
              ["📸","Share Production Photos","Celebrate your work with the broader community."],
              ["🔍","Post Wanted Items","Let others know what you're looking for."],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{padding:"14px",background:"var(--parch)",borderRadius:10,border:"1px solid var(--linen)"}}>
                <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{title}</div>
                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:"var(--muted)",lineHeight:1.5}}>
            📍 <strong>Proximity sorted</strong> — posts from nearby programs appear first. Set your city or zip in <strong>Profile</strong> for best results. You can leave the Community Board at any time from <strong>Settings</strong>.
          </div>
          <div style={{textAlign:"center"}}>
            <button className="btn btn-g" style={{fontSize:15,padding:"11px 32px"}}
              disabled={joining} onClick={join}>
              {joining ? "Joining…" : "Join the Community Board →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE GATE — opt-in wrapper for Marketplace
// ══════════════════════════════════════════════════════════════════════════════
function MarketplaceGate({items, org, setOrg, plan, userId, activeSchool, allSchoolsMode, onEdit=null, onDelete=null}) {
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    const updated = {...org, marketplace_enabled: true};
    setOrg(updated);
    await SB.from("orgs").update({marketplace_enabled: true}).eq("id", userId);
  };

  // Free plan users see the upgrade prompt (Marketplace handles that internally)
  // Pro/District users who haven't opted in see the gate
  if (org?.marketplace_enabled || plan === "free") {
    return <Marketplace items={items} org={org} plan={plan} activeSchool={activeSchool} allSchoolsMode={allSchoolsMode} onEdit={onEdit} onDelete={onDelete}/>;
  }

  return (
    <div style={{position:"relative",minHeight:"70vh"}}>
      <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1400} h={900} className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:280}}>
          <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1100} h={340} alt="" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🏪 {getExchangeName(org?.vertical)}</div>
            <h1 className="hero-title" style={{fontSize:46}}>{getExchangeName(org?.vertical)}</h1>
            <p className="hero-sub">Rent, buy, or loan theatre assets from programs near you.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"40px 36px 64px",position:"relative",zIndex:1,maxWidth:720}}>
        <div className="card card-p" style={{borderColor:"rgba(212,168,67,.3)",background:"linear-gradient(135deg,rgba(212,168,67,.06),rgba(212,168,67,.02))"}}>
          <div style={{fontSize:44,marginBottom:16,textAlign:"center"}}>🏪</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,marginBottom:12,textAlign:"center"}}>Join Backstage Exchange</h2>
          <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.7,marginBottom:24,textAlign:"center",maxWidth:520,margin:"0 auto 24px"}}>
            Backstage Exchange is Theatre4u™'s optional resource-sharing network. You choose exactly which items to share — your full inventory stays completely private. Browse what other programs near you have available.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
            {[
              ["🔍","Browse Nearby","Find costumes, props, lighting and sound from programs in your area."],
              ["💰","Earn Revenue","List items for rent or sale and earn income for your program."],
              ["🤝","Share Resources","Loan items to other programs and earn Stage Points in return."],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{padding:"14px",background:"var(--parch)",borderRadius:10,border:"1px solid var(--linen)",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
                <div style={{fontWeight:700,fontSize:13,marginBottom:5}}>{title}</div>
                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:"var(--muted)",lineHeight:1.6}}>
            🏷️ <strong>What becomes visible:</strong> your organization name, city, and any items you've marked "For Rent", "For Sale", or "For Loan" in Inventory. Your full item list and private notes are never shared. You can leave Backstage Exchange at any time from <strong>Settings</strong>.
          </div>
          <div style={{textAlign:"center"}}>
            <button className="btn btn-g" style={{fontSize:15,padding:"11px 32px"}}
              disabled={joining} onClick={join}>
              {joining ? "Joining…" : "Join Backstage Exchange →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// THEATRE CREDITS PAGE
// ══════════════════════════════════════════════════════════════════════════════
function CreditsPage({ userId, org, plan, balance, onBalanceChange }) {
  const [ledger,        setLedger]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState("overview");
  const [adminOrg,      setAdminOrg]      = useState("");
  const [adminAmt,      setAdminAmt]      = useState("");
  const [adminMsg,      setAdminMsg]      = useState("");
  const [adminSaving,   setAS]            = useState(false);
  const [daysUntilElig, setDaysUntilElig] = useState(null);
  const [redeeming,     setRedeeming]     = useState(false);
  const [redeemMsg,     setRedeemMsg]     = useState("");
  const isAdmin   = ADMIN_EMAILS?.includes?.(org?.email);
  const isAnnual  = org?.plan_interval === "annual";
  const earnMult  = isAnnual ? 1.5 : 1.0;

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ledgerData }, { data: bal }, { data: daysData }] = await Promise.all([
      SB.from("credit_ledger").select("*").eq("org_id", userId)
        .order("created_at", { ascending: false }).limit(100),
      SB.rpc("get_my_credit_balance"),
      SB.rpc("points_eligible_in_days", { p_org_id: userId }),
    ]);
    setLedger(ledgerData || []);
    onBalanceChange?.(bal || 0);
    setDaysUntilElig(typeof daysData === "number" ? daysData : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const totalEarned = ledger.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalSpent  = Math.abs(ledger.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0));

  const typeIcon = {
    welcome_bonus:        "🎉", catalog_bonus:         "📸", rental_earn:  "🔑",
    loan_earn:            "🤝", early_return_bonus:    "⚡", referral_earn: "👥",
    spend_rental:         "🛒", spend_deposit:         "🔒", admin_adjust: "🔧",
    expire:               "⏰", annual_bonus:          "⭐", annual_renewal_bonus: "⭐",
    profile_complete:     "✅", items_10:              "📦", items_25_photos: "📸",
    first_listing:        "🏪", first_request:         "📨", team_invite:  "👥",
  };
  const typeLabel = {
    welcome_bonus:        "Welcome Bonus",       catalog_bonus:        "Catalog Milestone",
    rental_earn:          "Rental Completed",    loan_earn:            "Loan Completed",
    early_return_bonus:   "Early Return",        referral_earn:        "Referral Bonus",
    spend_rental:         "Points Applied",      spend_deposit:        "Deposit Covered",
    admin_adjust:         "Admin Adjustment",    expire:               "Points Expired",
    annual_bonus:         "Annual Plan Bonus",   annual_renewal_bonus: "Annual Renewal Bonus",
    profile_complete:     "Profile Completed",   items_10:             "10 Items Added",
    items_25_photos:      "25 Items + Photos",   first_listing:        "First Exchange Listing",
    first_request:        "First Exchange Request", team_invite:       "Team Member Invited",
  };

  const adminAward = async () => {
    if (!adminOrg || !adminAmt) return;
    setAS(true);
    await SB.rpc("admin_award_credits", {
      p_org_id: adminOrg, p_amount: parseInt(adminAmt), p_description: adminMsg || "Admin adjustment"
    });
    setAS(false); setAdminOrg(""); setAdminAmt(""); setAdminMsg("");
    load();
  };

  return (
    <div style={{ position: "relative" }}>
      <img src={usp(BG.dashboard, 1400, 900)} alt="" className="page-bg-img" />
      <div style={{ padding: "32px 36px 0" }}>
        <div className="hero-wrap" style={{ height: 210 }}>
          <img src={usp(BG.dashboard, 1100, 270)} alt="Credits" loading="eager" />
          <div className="hero-fade" />
          <div className="hero-body">
            <div className="hero-eyebrow">🪙 Stage Economy</div>
            <h1 className="hero-title" style={{ fontSize: 44 }}>{getPointsName(org?.vertical)}</h1>
            <p className="hero-sub">Earn points by sharing inventory and completing Exchange deals. Spend them for discounts — or save up for a free month.</p>
          </div>
          <div className="hero-bar" />
        </div>
      </div>

      <div style={{ padding: "24px 36px 56px", position: "relative", zIndex: 1 }}>

        {/* Balance card */}
        <div className="card card-p" style={{ marginBottom: 22, background: "linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04))", borderColor: "rgba(212,168,67,.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6 }}>Your Balance</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 64, color: "var(--gold)", lineHeight: 1 }}>{balance.toLocaleString()}</span>
                <span style={{ fontSize: 18, color: "var(--muted)", fontWeight: 700 }}>points</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>1 point = $0.01 · 1,500 points = free Pro month</div>
              {isAnnual && (
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(212,168,67,.15)", border: "1px solid rgba(212,168,67,.3)",
                  borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "var(--gold)", fontWeight: 700 }}>
                  ⭐ Annual plan — earning at 1.5× rate on loans &amp; rentals
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Total Earned", val: totalEarned, icon: "📈", col: "var(--green)" },
                { label: "Total Spent",  val: totalSpent,  icon: "📤", col: "var(--amber)" },
                { label: "Transactions", val: ledger.length, icon: "📋", col: "var(--blue)" },
              ].map(s => (
                <div key={s.label} className="card card-p" style={{ textAlign: "center", padding: "12px 18px", minWidth: 100 }}>
                  <div style={{ fontSize: 20, marginBottom: 3 }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: s.col }}>{s.val.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How to earn — always visible */}
        <div className="card card-p" style={{ marginBottom: 22, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {[
            { icon: "🎉", title: "Join & Welcome",      earn: "+25 pts",      note: "Awarded automatically on signup." },
            { icon: "✅", title: "Complete Profile",    earn: "+25 pts",      note: "Add name, location, bio, and email." },
            { icon: "📦", title: "Add 10 Items",        earn: "+25 pts",      note: "One-time milestone." },
            { icon: "📸", title: "25 Items + Photos",   earn: "+50 pts",      note: "Quality catalog milestone." },
            { icon: "🏪", title: "First Exchange Listing",earn: "+15 pts",    note: "List any item on the Exchange." },
            { icon: "📨", title: "First Exchange Request",earn: "+10 pts",    note: "Send your first request to another program." },
            { icon: "👥", title: "Invite a Team Member", earn: "+15 pts",     note: "Per member who signs in." },
            { icon: "👋", title: "Refer a Program",     earn: "+50 pts",      note: "Per program that creates an account using your referral link." },
            { icon: "🤝", title: "Loan Completed",       earn: isAnnual ? "+15–75 pts ⭐" : "+10–50 pts",
              note: isAnnual ? "1.5× annual rate. Lighting/Sound = 75 pts." : "Varies by item category. Lighting/Sound = 50 pts." },
            { icon: "🔑", title: "Rental Completed",     earn: isAnnual ? "+$1 = 1.5 pts ⭐" : "+$1 = 1 pt",
              note: isAnnual ? "1.5× annual rate — 1.5 pts per dollar of rental price." : "1 point per dollar of rental price." },
            { icon: "🛒", title: "Exchange Discount", earn: "Up to 50% off", note: "Apply points when requesting any rental or purchase." },
            { icon: "🎟️", title: "Free Pro Month",    earn: "1,500 pts",   note: "Redeem 1,500 points for one free month of Pro." },
          ].map(s => (
            <div key={s.title} style={{ padding: "12px 14px", background: "var(--parch)", borderRadius: 10, border: "1px solid var(--linen)" }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{s.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.earn.startsWith("+") ? "var(--green)" : "var(--amber)", marginBottom: 4 }}>{s.earn}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{s.note}</div>
            </div>
          ))}
        </div>

        {/* ── Referral Link ── */}
        {org?.referral_code && (
          <div className="card card-p" style={{ marginBottom: 22,
            background: "linear-gradient(135deg,rgba(212,168,67,.06),rgba(212,168,67,.02))",
            border: "1px solid rgba(212,168,67,.25)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>👋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                  Your Referral Link — Earn 50 Points Per Program
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
                  Share this link with other theatre directors. When they sign up and create an account,
                  you automatically earn 50 Stage Points. No limit on referrals.
                </div>
                {/* Referral link box */}
                {(()=>{
                  const refUrl = "https://theatre4u.org?ref=" + org.referral_code;
                  const [copied, setCopied] = useState(false);
                  const copy = () => {
                    navigator.clipboard.writeText(refUrl).then(()=>{
                      setCopied(true); setTimeout(()=>setCopied(false), 2500);
                    });
                  };
                  return (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 200, background: "var(--parch)",
                        border: "1px solid var(--border)", borderRadius: 8,
                        padding: "9px 14px", fontFamily: "monospace", fontSize: 13,
                        color: "var(--gold)", letterSpacing: 0.3, wordBreak: "break-all" }}>
                        {refUrl}
                      </div>
                      <button onClick={copy}
                        style={{ padding: "9px 18px", borderRadius: 8, border: "none",
                          background: copied ? "var(--green)" : "var(--gold)",
                          color: "#1a0f00", fontWeight: 700, fontSize: 13,
                          cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                          transition: "background .2s" }}>
                        {copied ? "✓ Copied!" : "Copy Link"}
                      </button>
                      <button onClick={()=>fbShare(refUrl,
                        "🎭 I use Theatre4u to manage my theatre program's inventory and share resources with other programs through the Backstage Exchange. It's free right now — check it out!\n\ntheatre4u.org #Theatre #TheatreEducation")}
                        style={{ padding: "9px 14px", borderRadius: 8,
                          border: "1px solid rgba(24,119,242,.35)",
                          background: "rgba(24,119,242,.08)", color: "#4285f4",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                          fontFamily: "inherit", flexShrink: 0,
                          display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Share
                      </button>
                    </div>
                  );
                })()}
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                  Your referral code: <strong style={{ color: "var(--gold)", fontFamily: "monospace", letterSpacing: 1 }}>{org.referral_code}</strong>
                  {" · "}Points appear in your ledger within seconds of the new program signing up.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Redeem Free Month ── */}
        {plan !== "free" && (
          <div className="card card-p" style={{ marginBottom: 22,
            border: balance >= POINTS_FREE_MONTH ? "1.5px solid rgba(212,168,67,.5)" : "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 36 }}>🎟️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>Redeem for a Free Pro Month</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                  1,500 points = one free month of Pro ($15 value)
                </div>
                {/* Eligibility gate */}
                {daysUntilElig !== null && daysUntilElig > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(107,100,120,.15)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>
                    🕐 Free-month redemption available in <strong style={{ color: "var(--text)" }}>&nbsp;{daysUntilElig} days</strong>
                    &nbsp;· Exchange discounts available now
                  </div>
                ) : balance < POINTS_FREE_MONTH ? (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {(POINTS_FREE_MONTH - balance).toLocaleString()} more points needed
                    {/* Mini progress bar */}
                    <div style={{ marginTop: 6, background: "var(--border)", borderRadius: 99, height: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 99, background: "var(--gold)",
                        width: Math.min(100, balance / POINTS_FREE_MONTH * 100) + "%" }}/>
                    </div>
                  </div>
                ) : (
                  <div>
                    {redeemMsg && (
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8,
                        color: redeemMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>
                        {redeemMsg}
                      </div>
                    )}
                    <button
                      disabled={redeeming || balance < POINTS_FREE_MONTH}
                      onClick={async () => {
                        setRedeeming(true); setRedeemMsg("");
                        // Check eligibility server-side
                        const { data: eligible } = await SB.rpc("is_points_eligible", { p_org_id: userId });
                        if (!eligible) {
                          setRedeemMsg("⚠️ Not yet eligible — 90 days of Pro required for free-month redemption.");
                          setRedeeming(false); return;
                        }
                        const { data } = await SB.rpc("spend_credits", {
                          p_org_id: userId, p_amount: POINTS_FREE_MONTH,
                          p_type: "spend_rental",
                          p_description: "Redeemed 1,500 pts for free Pro month"
                        });
                        if (data?.success) {
                          setRedeemMsg("✓ 1,500 points redeemed! Your free month credit will be applied. Contact hello@theatre4u.org to confirm.");
                          load();
                        } else {
                          setRedeemMsg("⚠️ " + (data?.error || "Could not redeem — please try again."));
                        }
                        setRedeeming(false);
                      }}
                      className="btn btn-g" style={{ marginTop: 4 }}>
                      {redeeming ? "Processing…" : "Redeem 1,500 Points → Free Month"}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28,
                  color: balance >= POINTS_FREE_MONTH ? "var(--gold)" : "var(--muted)",
                  fontWeight: 700 }}>
                  {balance.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>/ 1,500 pts</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 18 }}>
          {[["overview","📋 History"],["rules","📖 How It Works"],...( isAdmin ? [["admin","🔧 Admin"]] : [])].map(([t, l]) => (
            <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{l}</button>
          ))}
        </div>

        {/* ── History ── */}
        {tab === "overview" && (
          <div className="card" style={{ overflow: "hidden" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading…</div>
            ) : ledger.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">🪙</div>
                <h3>No credit activity yet</h3>
                <p>Complete a loan or rental, add photos to 10+ items, or just wait — your welcome bonus should appear shortly.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--parch)" }}>
                      {["Date", "Type", "Description", "Amount", "Balance"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 700, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.reduce((acc, row, i) => {
                      // Running balance (ledger is newest-first, so we go reverse)
                      const runningBal = ledger.slice(i).reduce((s, r) => s + r.amount, 0);
                      acc.push(
                        <tr key={row.id} style={{ borderBottom: "1px solid var(--linen)", background: i % 2 === 0 ? "transparent" : "rgba(243,230,204,.3)" }}>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                            {new Date(row.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span style={{ fontSize: 13 }}>{typeIcon[row.type] || "•"} {typeLabel[row.type] || row.type}</span>
                          </td>
                          <td style={{ padding: "9px 14px", fontSize: 13, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.description}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: row.amount > 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                              {row.amount > 0 ? "+" : ""}{row.amount.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px", fontFamily: "'Playfair Display',serif", fontSize: 15, color: "var(--gold)" }}>
                            {runningBal.toLocaleString()}
                          </td>
                        </tr>
                      );
                      return acc;
                    }, [])}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Rules ── */}
        {tab === "rules" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { title: "Earning Credits",
                body: "Credits are earned automatically when a transaction is marked returned by the owner. For free loans, the item must have been out for at least 3 days to qualify. For rentals, you earn 1 credit per $1 of rental value (minimum 5, maximum 500 per transaction)." },
              { title: "Spending Credits",
                body: "When requesting a rental or purchase, you can apply credits to cover up to 50% of the price. The remaining cash balance must be paid directly to the item owner outside of Theatre4u — by check, Venmo, invoice, or any payment method agreed between your organizations. Theatre4u does not collect or transfer cash payments. Credits can also be used to cover 100% of a security deposit." },
              { title: "Credit Value",
                body: "1 credit = $1 of discount toward a rental or purchase. Credits have no cash value and cannot be refunded, transferred to another organization, or exchanged for money." },
              { title: "Expiry & Forfeiture",
                body: "Points expire 12 months after they are earned. Your maximum balance is 5,000 points. Points can be redeemed for Exchange discounts (up to 50% of transaction value) or traded for a free Pro month at 1,500 points. Points have no cash value and cannot be transferred between accounts." },
              { title: "Fair Use",
                body: "Theatre4u reserves the right to adjust or revoke credits in cases of abuse, fraudulent transactions, or violations of the Terms of Service. The admin_adjust transaction type will appear in your history if a correction is made." },
            ].map(r => (
              <div key={r.title} className="card card-p">
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, marginBottom: 8 }}>{r.title}</h3>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{r.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Admin ── */}
        {tab === "admin" && isAdmin && (
          <div className="card card-p" style={{ maxWidth: 480 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 14 }}>🔧 Award Credits to Any Org</h3>
            <div className="fg2">
              <div className="fg fu">
                <label className="fl">Org ID</label>
                <input className="fi" value={adminOrg} onChange={e => setAdminOrg(e.target.value)} placeholder="Paste org UUID…" />
              </div>
              <div className="fg">
                <label className="fl">Amount</label>
                <input className="fi" type="number" min="1" value={adminAmt} onChange={e => setAdminAmt(e.target.value)} placeholder="50" />
              </div>
              <div className="fg fu">
                <label className="fl">Description</label>
                <input className="fi" value={adminMsg} onChange={e => setAdminMsg(e.target.value)} placeholder="Reason for adjustment…" />
              </div>
            </div>
            <button className="btn btn-g" onClick={adminAward} disabled={adminSaving || !adminOrg || !adminAmt}>
              {adminSaving ? "Awarding…" : "Award Credits"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEAM SETTINGS — Org member management with backstage roles
// ══════════════════════════════════════════════════════════════════════════════
const ROLES = [
  { id: "stage_manager", label: "Stage Manager", icon: "📋", desc: "Add, edit, delete items · Funding Tracker · Backstage Exchange · Community" },
  { id: "crew",          label: "Crew",          icon: "🔧", desc: "Add and edit items · Upload photos" },
  { id: "house",         label: "House",         icon: "🎟", desc: "View and look up items only" },
];
const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r]));

function TeamSettings({ userId, orgName, plan }) {
  const [members,  setMembers]  = useState([]);
  const [invites,  setInvites]  = useState([]);
  const [joinCode, setJoinCode] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("crew");
  const [sending,  setSending]  = useState(false);
  const [msg,      setMsg]      = useState("");
  const [showCode, setShowCode] = useState(false);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  // Load team
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: mData }, { data: iData }] = await Promise.all([
      SB.from("org_members").select("*").eq("org_id", userId).order("created_at"),
      SB.from("org_invites").select("*").eq("org_id", userId)
        .is("accepted_at", null).order("created_at", { ascending: false }),
    ]);
    setMembers(mData || []);
    // Find existing join code invite
    const code = (iData || []).find(i => i.invite_type === "code");
    setJoinCode(code?.join_code || null);
    setInvites((iData || []).filter(i => i.invite_type === "email"));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Generate or show join code
  const getJoinCode = async () => {
    if (joinCode) { setShowCode(true); return; }
    // Insert — DB trigger auto-generates join_code
    const { error } = await SB.from("org_invites").insert({
      org_id: userId,
      role: "crew",
      invite_type: "code",
      is_permanent: true,
      expires_at: new Date(Date.now() + 365*24*60*60*1000).toISOString(), // 1 year
    });
    if (error) { flash("❌ Could not generate join code. Try again."); return; }
    // Re-fetch the newly created code invite (RLS: org_id = auth.uid())
    const { data: fetched } = await SB.from("org_invites")
      .select("join_code")
      .eq("org_id", userId)
      .eq("invite_type", "code")
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (fetched?.join_code) {
      setJoinCode(fetched.join_code);
      setShowCode(true);
    } else {
      flash("❌ Code generated but couldn't load — try refreshing.");
    }
  };

  // Send email invite
  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    // Step 1: Insert the invite row
    const { data, error } = await SB.from("org_invites").insert({
      org_id: userId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invite_type: "email",
    }).select().single();
    if (error || !data) {
      flash("❌ " + EM.sendInvite.body);
      setSending(false);
      return;
    }
    setInvites(p => [data, ...p]);
    setInviteEmail("");
    // Step 2: Call edge function to send the email
    try {
      const { data: { session } } = await SB.auth.getSession();
      const res = await fetch(
        "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/team-invite",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + session?.access_token,
          },
          body: JSON.stringify({ invite_id: data.id }),
        }
      );
      const result = await res.json();
      if (result.email_sent) {
        flash("✓ Invite email sent to " + data.email);
      } else {
        flash("✓ Invite saved — copy the link below to share manually");
      }
    } catch {
      flash("✓ Invite saved — copy the link below to share manually");
    }
    setSending(false);
  };

  // Remove a member
  const removeMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from your team?`)) return;
    await SB.from("org_members").delete().eq("id", memberId);
    setMembers(p => p.filter(m => m.id !== memberId));
    flash("✓ Removed from team");
  };

  // Cancel a pending invite
  const cancelInvite = async (inviteId) => {
    await SB.from("org_invites").delete().eq("id", inviteId);
    setInvites(p => p.filter(i => i.id !== inviteId));
    flash("✓ Invite cancelled");
  };

  // Change a member's role
  const changeRole = async (memberId, newRole) => {
    await SB.from("org_members").update({ role: newRole }).eq("id", memberId);
    setMembers(p => p.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    flash("✓ Role updated");
  };

  const joinUrl = joinCode ? `theatre4u.org/invite.html?code=${joinCode}` : null;

  return (
    <div className="card card-p" style={{ marginBottom: 20 }}>
      <div className="sh">
        <h2>🎭 Your Backstage Team</h2>
        <p>Invite people to help manage your inventory. Each role has different access levels.</p>
      </div>

      {/* Role legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {[{ id: "director", label: "Director", icon: "🎬", desc: "Full access — that's you" }, ...ROLES].map(r => (
          <div key={r.id} style={{ background: "var(--parch)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 12px", minWidth: 160 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{r.icon} {r.label}</div>
            <div style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.4 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Current members */}
      {loading ? (
        <div style={{ color: "var(--faint)", fontSize: 13, padding: "12px 0" }}>Loading team…</div>
      ) : members.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
            color: "var(--faint)", marginBottom: 8 }}>Current Team</div>
          {members.map(m => {
            const r = ROLE_MAP[m.role] || { label: m.role, icon: "👤" };
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "9px 0", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--parch)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.email}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>
                    Joined {new Date(m.joined_at).toLocaleDateString()}
                  </div>
                </div>
                <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                  style={{ background: "var(--parch)", border: "1px solid var(--bd)", borderRadius: 6,
                    padding: "4px 8px", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}>
                  {ROLES.map(ro => <option key={ro.id} value={ro.id}>{ro.icon} {ro.label}</option>)}
                </select>
                <button onClick={() => removeMember(m.id, m.email)}
                  style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer",
                    fontSize: 18, lineHeight: 1, padding: "0 4px" }} title="Remove">×</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "var(--faint)", fontSize: 13, marginBottom: 20, fontStyle: "italic" }}>
          No team members yet — invite someone below.
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
            color: "var(--faint)", marginBottom: 8 }}>Pending Invites</div>
          {invites.map(inv => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--bd)" }}>
              <div style={{ fontSize: 15 }}>✉️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.email}</div>
                <div style={{ fontSize: 11, color: "var(--faint)" }}>
                  {ROLE_MAP[inv.role]?.label} · Expires {new Date(inv.expires_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => {
                const url = `https://theatre4u.org/invite.html?token=${inv.token}`;
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(url)
                    .then(() => flash("✓ Invite link copied!"))
                    .catch(() => { prompt("Copy this link:", url); });
                } else { prompt("Copy this link:", url); }
              }} style={{ background: "var(--parch)", border: "1px solid var(--bd)", borderRadius: 6,
                color: "var(--muted)", padding: "4px 10px", cursor: "pointer", fontSize: 11,
                fontFamily: "inherit" }}>Copy Link</button>
              <button onClick={() => cancelInvite(inv.id)}
                style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer",
                  fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Invite by email */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
          color: "var(--faint)", marginBottom: 8 }}>Invite by Email</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="fi" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@school.edu" type="email"
            onKeyDown={e => e.key === "Enter" && sendInvite()}
            style={{ flex: "1 1 200px", minWidth: 0 }}/>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            className="fs" style={{ flex: "0 0 auto", minWidth: 130 }}>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
          </select>
          <button className="btn bp" onClick={sendInvite} disabled={sending || !inviteEmail.trim()}
            style={{ whiteSpace: "nowrap" }}>
            {sending ? "Sending…" : "Send Invite"}
          </button>
        </div>
        {inviteEmail && (
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 6 }}>
            They'll get a link to join your team at <strong>{orgName}</strong> as <strong>{ROLE_MAP[inviteRole]?.label}</strong>.
          </div>
        )}
      </div>

      {/* Join code */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
          color: "var(--faint)", marginBottom: 8 }}>Join Code — For Groups & Students</div>
        {!showCode ? (
          <button className="btn bs" onClick={getJoinCode}>
            🔑 Generate Join Code
          </button>
        ) : (
          <div style={{ background: "var(--parch)", border: "1px solid var(--bd)", borderRadius: 12,
            padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>Share this code</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 900,
                  letterSpacing: 4, color: "var(--gold)" }}>{joinCode}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>Or share this link</div>
                <div style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
                  theatre4u.org/invite.html?code={joinCode}
                </div>
              </div>
              <button className="btn bs bsm" onClick={() => {
                navigator.clipboard?.writeText(`https://theatre4u.org/invite.html?code=${joinCode}`)
                  .then(() => flash("✓ Link copied to clipboard!"))
                  .catch(() => flash("✓ Link: https://theatre4u.org/invite.html?code=" + joinCode));
                flash("✓ Link copied!");
              }}>Copy Link</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12, lineHeight: 1.5 }}>
              Anyone with this code joins as <strong>Crew</strong> — they can add and edit items.
              Post it in your costume room or send it to your team. Expires in 30 days.
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: msg.startsWith("❌") ? "#7f1d1d" : "#14532d",
          color: "#fff", padding: "10px 22px", borderRadius: 10,
          fontSize: 14, fontWeight: 700, boxShadow: "0 4px 20px rgba(0,0,0,.35)",
          whiteSpace: "nowrap", pointerEvents: "none",
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}



// ── QR Code Privacy Settings ─────────────────────────────────────────────────
function QRPrivacySettings({ org, setOrg, userId }) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const privacy       = org?.qr_privacy       ?? "contact";
  const contactFields = org?.qr_contact_fields ?? ["name","email"];

  const togglePrivacy = async (val) => {
    setSaving(true);
    const { error } = await SB.from("orgs").update({ qr_privacy: val }).eq("id", userId);
    if (!error) setOrg(p => ({ ...p, qr_privacy: val }));
    setSaving(false);
  };

  const toggleField = async (field) => {
    const current = Array.isArray(contactFields) ? contactFields : ["name","email"];
    const next    = current.includes(field) ? current.filter(f => f !== field) : [...current, field];
    setSaving(true);
    const { error } = await SB.from("orgs").update({ qr_contact_fields: next }).eq("id", userId);
    if (!error) { setOrg(p => ({ ...p, qr_contact_fields: next })); setSaved(true); setTimeout(()=>setSaved(false),2000); }
    setSaving(false);
  };

  const fields = [
    { key:"name",     label:"Organization Name",  always: true },
    { key:"email",    label:"Email Address" },
    { key:"phone",    label:"Phone Number" },
    { key:"location", label:"City / Location" },
    { key:"bio",      label:"About / Bio" },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Privacy mode toggle */}
      <div style={{display:"flex",gap:0,border:"1px solid var(--border)",borderRadius:8,overflow:"hidden",width:"fit-content"}}>
        {[{v:"contact",label:"🔒 Contact Only",desc:"Show org contact info only"},{v:"public",label:"🌐 Public Details",desc:"Show full item details"}].map(opt=>(
          <button key={opt.v} onClick={()=>togglePrivacy(opt.v)} style={{
            background: privacy===opt.v ? "var(--gold)" : "transparent",
            color:      privacy===opt.v ? "#1a0f00" : "var(--muted)",
            border:"none", padding:"9px 18px", cursor:"pointer",
            fontFamily:"inherit", fontSize:13, fontWeight:700, transition:"all .15s"
          }}>{opt.label}</button>
        ))}
      </div>
      <p style={{fontSize:12.5,color:"var(--muted)",lineHeight:1.6,margin:0}}>
        {privacy === "contact"
          ? "When someone scans a QR label they are NOT a team member of, they will see your contact info and a prompt to sign in or request access."
          : "Full item details are visible to anyone who scans a QR label — no sign-in required."}
      </p>

      {/* Contact fields (only relevant in contact mode) */}
      {privacy === "contact" && (
        <div>
          <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:10}}>
            Information shown to scanner
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {fields.map(f => {
              const checked = f.always || (Array.isArray(contactFields) && contactFields.includes(f.key));
              return (
                <label key={f.key} style={{display:"flex",alignItems:"center",gap:10,cursor:f.always?"default":"pointer",opacity:f.always?.6:1}}>
                  <div onClick={()=>!f.always&&toggleField(f.key)} style={{
                    width:18, height:18, borderRadius:4,
                    background: checked ? "var(--gold)" : "transparent",
                    border: checked ? "2px solid var(--gold)" : "2px solid var(--border)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    flexShrink:0, cursor:f.always?"default":"pointer", transition:"all .15s"
                  }}>
                    {checked && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" fill="none" stroke="#1a0f00" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{fontSize:13.5,color:"var(--text)"}}>{f.label}</span>
                  {f.always && <span style={{fontSize:11,color:"var(--faint)"}}>always shown</span>}
                </label>
              );
            })}
          </div>
          {saved && <div style={{fontSize:12,color:"var(--grn,#4caf50)",marginTop:8,fontWeight:600}}>✓ Saved</div>}
          <p style={{fontSize:12,color:"var(--faint)",lineHeight:1.6,marginTop:10}}>
            Only the fields you check above will be visible to someone who scans a QR label. Your email is always the primary way for them to request access.
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELF-SERVICE ACCOUNT DELETION (owner-initiated, 30-day soft close)
// ══════════════════════════════════════════════════════════════════════════════
function SelfServiceDeleteAccount({ user, org }) {
  const [open,    setOpen]    = useState(false);
  const [reason,  setReason]  = useState("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");
  const CONFIRM_WORD = "CLOSE";

  if (done) return (
    <div style={{ background:"rgba(76,175,80,.08)",border:"1px solid rgba(76,175,80,.25)",
      borderRadius:9,padding:"14px 16px",fontSize:13,lineHeight:1.7 }}>
      <div style={{ fontWeight:700,fontSize:15,marginBottom:4 }}>✅ Account Closed</div>
      <div>Your subscription has been canceled and your account is now closed.
        A confirmation email has been sent to <strong>{org?.email}</strong>.</div>
      <div style={{ marginTop:8,color:"var(--muted)" }}>
        Your data will be permanently deleted in 30 days.
        To restore your account before then, email <strong>hello@theatre4u.org</strong>.
      </div>
    </div>
  );

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ padding:"9px 18px",borderRadius:8,fontFamily:"inherit",fontWeight:700,
        fontSize:13,cursor:"pointer",background:"rgba(194,24,91,.08)",
        border:"1px solid rgba(194,24,91,.3)",color:"var(--red)" }}>
      Close My Account →
    </button>
  );

  const submit = async () => {
    if (confirm !== CONFIRM_WORD) { setErr(`Type ${CONFIRM_WORD} to confirm`); return; }
    setWorking(true); setErr("");
    const { data: { session } } = await SB.auth.getSession();
    const result = await callEdgeFn("close-org", {
      org_id: user.id, reason: reason || "Owner requested", action: "close", is_admin_action: false
    }, session?.access_token);
    if (result?.success) {
      setDone(true);
      // Sign out after a short delay
      setTimeout(() => SB.auth.signOut(), 3500);
    } else {
      setErr(result?.error || "Something went wrong. Email hello@theatre4u.org for help.");
      setWorking(false);
    }
  };

  return (
    <div style={{ background:"rgba(194,24,91,.05)",border:"1px solid rgba(194,24,91,.2)",
      borderRadius:10,padding:"16px" }}>
      <div style={{ fontWeight:700,fontSize:14,marginBottom:10,color:"var(--red)" }}>
        Confirm Account Closure
      </div>
      <div className="fg" style={{ marginBottom:12 }}>
        <label className="fl">Why are you closing your account? (optional)</label>
        <textarea className="ft" value={reason} onChange={e=>setReason(e.target.value)}
          placeholder="Switching tools, program ended, budget cuts…" rows={2} />
      </div>
      <div className="fg" style={{ marginBottom:12 }}>
        <label className="fl">
          Type <strong style={{ color:"var(--red)",fontFamily:"monospace",letterSpacing:2 }}>{CONFIRM_WORD}</strong> to confirm
        </label>
        <input className="fi" value={confirm}
          onChange={e=>setConfirm(e.target.value.toUpperCase())}
          placeholder={CONFIRM_WORD}
          style={{ fontFamily:"monospace",letterSpacing:3 }} />
      </div>
      {err && <div style={{ color:"var(--red)",fontSize:12,marginBottom:10 }}>{err}</div>}
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={()=>{setOpen(false);setConfirm("");setReason("");setErr("");}}
          className="btn btn-o">Cancel</button>
        <button onClick={submit} disabled={working || confirm !== CONFIRM_WORD}
          style={{ padding:"8px 18px",borderRadius:8,fontFamily:"inherit",fontWeight:800,
            fontSize:13,cursor:working||confirm!==CONFIRM_WORD?"not-allowed":"pointer",
            background:confirm===CONFIRM_WORD?"rgba(194,24,91,.8)":"rgba(194,24,91,.15)",
            color:confirm===CONFIRM_WORD?"#fff":"var(--red)",border:"1px solid rgba(194,24,91,.4)",
            opacity:working?.5:1 }}>
          {working ? "Closing account…" : "Close My Account"}
        </button>
      </div>
    </div>
  );
}

function CustomCategoriesManager({ org, userId, memberRole=null }){
  const vertical = org?.vertical || "theatre";
  const CAT_EXAMPLE = { theatre:"Concessions", music:"Sheet Music", dance:"Recital Props", art:"Canvases", booster:"Banners" };
  const catExample = CAT_EXAMPLE[vertical] || "Concessions";
  const canManage = !memberRole || memberRole==="director" || memberRole==="program_director";
  const [list,setList] = useState([]);
  const [label,setLabel] = useState("");
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState("");
  const refresh = async()=>{
    if(!org?.id) return;
    const { data } = await SB.from("org_categories").select("id,vertical,label").eq("org_id", org.id);
    const all = data||[];
    setCustomCats(all);
    setList(all.filter(c=>c.vertical===vertical));
  };
  useEffect(()=>{ refresh(); },[org?.id, vertical]);
  const add = async()=>{
    const name = label.trim();
    if(!name) return;
    setBusy(true); setErr("");
    const { error } = await SB.from("org_categories").insert({ org_id:org.id, vertical, label:name, created_by:userId });
    setBusy(false);
    if(error){ setErr((error.code==="23505"||(error.message||"").includes("duplicate")) ? "That category already exists." : "Couldn't add category. Please try again."); return; }
    setLabel(""); refresh();
  };
  const del = async(id,nm)=>{
    if(!window.confirm("Delete the category \""+nm+"\"? Items already in it will show as \"Other\" until you re-categorize them.")) return;
    const { error } = await SB.from("org_categories").delete().eq("id", id);
    if(!error) refresh();
  };
  if(!canManage) return <p style={{fontSize:13,color:"var(--muted)"}}>Only the account owner or a director can manage custom categories.</p>;
  return(
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <input className="fs" style={{flex:1,minWidth:200}} placeholder={`New category name (e.g. ${catExample})`} value={label}
          onChange={e=>setLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")add();}} maxLength={40}/>
        <button className="btn btn-p" disabled={busy||!label.trim()} onClick={add}>Add</button>
      </div>
      {err&&<p style={{fontSize:12,color:"var(--red)",marginBottom:8}}>{err}</p>}
      {list.length===0
        ? <p style={{fontSize:13,color:"var(--muted)"}}>No custom categories yet. Add one above — it'll appear alongside the built-in categories when you add or edit items.</p>
        : <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {list.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"rgba(255,255,255,.04)",borderRadius:6}}>
                <span style={{fontSize:14}}>📦 {c.label}</span>
                <button className="btn btn-d btn-sm" onClick={()=>del(c.id,c.label)}>Remove</button>
              </div>
            ))}
          </div>}
      <p style={{fontSize:11,color:"var(--muted)",marginTop:12,fontStyle:"italic"}}>Custom categories use a default 📦 icon and apply to this program's {vertical} inventory.</p>
    </div>
  );
}
function Settings({ org, setOrg, onSeed, user, userId, items, setItems, plan="free", userEmail="", setPlan, memberRole=null }) {
  const [f,setF]       = useState(org);
  const [saved,setSaved] = useState(false);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));
  const save = async() => {
    // Geocode location if it changed so community posts are proximity-sorted correctly
    let geoUpdate = {};
    let fData = {...f};
    if (f.location && f.location !== org?.location) {
      const geo = await geocodeLocation(f.location);
      if (geo) { geoUpdate = { lat: geo.lat, lng: geo.lng }; fData = { ...fData, ...geoUpdate }; }
    } else if (f.zipcode && f.zipcode !== org?.zipcode) {
      const geo = await geocodeLocation(f.zipcode + ", USA");
      if (geo) { geoUpdate = { lat: geo.lat, lng: geo.lng }; fData = { ...fData, ...geoUpdate }; }
    }
    await setOrg(fData);
    setSaved(true);
    setTimeout(()=>setSaved(false),2200);
  };

  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.settings,1400,900)} alt="" className="page-bg-img"/>

      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:210}}>
          <img src={usp(BG.settings,1100,260)} alt="Settings" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">⚙️ Configuration</div>
            <h1 className="hero-title" style={{fontSize:44}}>Profile</h1>
            <p className="hero-sub">{f.name||"Your program"} — manage your profile and data.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 48px",position:"relative",zIndex:1,maxWidth:760}}>

        {/* Org Profile */}
        <div className="card card-p" style={{marginBottom:20}}>
          <div className="sh"><h2>Organization Profile</h2><p>This information appears on your Exchange listings.</p></div>
          <div className="fg2">
            <div className="fg fu"><label className="fl">Organization Name</label><input className="fi" value={f.name||""} onChange={e=>upd("name",e.target.value)} placeholder="e.g. Lincoln High Drama Dept"/></div>
            <div className="fg">
              <label className="fl">Type</label>
              <select className="fs" value={f.type||""} onChange={e=>upd("type",e.target.value)}>
                <option value="">Select…</option>
                {["School","District","Community Theatre","College","Professional","Other"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={f.email||""} onChange={e=>upd("email",e.target.value)} placeholder="drama@school.edu"/></div>
            <div className="fg"><label className="fl">Phone</label><input className="fi" value={f.phone||""} onChange={e=>upd("phone",e.target.value)} placeholder="(555) 123-4567"/></div>
            <div className="fg"><label className="fl">City / Location</label><input className="fi" value={f.location||""} onChange={e=>upd("location",e.target.value)} placeholder="Huntington Beach, CA"/></div>
            <div className="fg">
              <label className="fl">State</label>
              <select className="fs" value={f.state||""} onChange={e=>upd("state",e.target.value)}>
                <option value="">Select state…</option>
                {US_STATES.map(s=><option key={s} value={s}>{STATE_NAMES[s]} ({s})</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Zip Code</label>
              <input className="fi" value={f.zipcode||""} onChange={e=>upd("zipcode",e.target.value.replace(/[^0-9]/g,"").slice(0,5))} placeholder="e.g. 92648" maxLength={5}/>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>Used to sort Community Board posts by proximity to you</div>
            </div>
            <div className="fg fu"><label className="fl">About Your Program</label><textarea className="ft" value={f.bio||""} onChange={e=>upd("bio",e.target.value)} placeholder="Tell others about your program…"/></div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:18,paddingTop:14,borderTop:"1.5px solid var(--border)"}}>
            <button className="btn btn-p" onClick={save}><span style={{width:14,height:14,display:"flex"}}>{Ic.check}</span>Save Profile</button>
            {saved&&<span style={{color:"var(--green)",fontWeight:800,fontSize:13.5}}>✓ Saved!</span>}
          </div>
        </div>

        {/* Plans */}
        <div className="card card-p" style={{marginBottom:20}}>
          <div className="sh"><h2>Plans</h2><p>Choose the right plan for your program.</p></div>
          {/* Billing toggle */}
          <UpgradePlans userId={userId} userEmail={userEmail} plan={plan}/>
          {/* Manage / Cancel billing — only shown to paid non-admin users */}
          {plan !== "free" && !isAdminEmail(userEmail) && (
            <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--bd)"}}>
              <div style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>
                You are on the <strong style={{color:"var(--gold)",textTransform:"capitalize"}}>{plan}</strong> plan.
                Your subscription renews automatically. Cancel anytime — you keep access until the end of your billing period.
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <a
                  href={"https://billing.stripe.com/p/login/aFa4gydAZ2X1cpZ6UHgA800" + (userEmail ? "?prefilled_email=" + encodeURIComponent(userEmail) : "")}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-o btn-sm"
                  style={{fontSize:12}}>
                  💳 Manage Billing &amp; Cancel
                </a>
                <a href="mailto:hello@theatre4u.org?subject=Cancel Subscription" className="btn btn-o btn-sm" style={{fontSize:12}}>
                  ✉️ Email Us to Cancel
                </a>
              </div>
              <div style={{fontSize:11,color:"var(--faint)",marginTop:8,lineHeight:1.6}}>
                Need help? Email <a href="mailto:hello@theatre4u.org" style={{color:"var(--gold)"}}>hello@theatre4u.org</a> — we respond personally.
              </div>
              <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--bd)",fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
                <span style={{fontWeight:700,color:"var(--text)"}}>🏛️ Paying by check or PO?</span> Email{" "}
                <a href="mailto:hello@theatre4u.org?subject=Check/PO Subscription Request" style={{color:"var(--gold)"}}>hello@theatre4u.org</a>
                {" "}and we'll send a formal invoice. Payment made payable to <strong>Artstracker LLC</strong>. Net-30 available for districts.
              </div>
            </div>
          )}
        </div>

        {/* Data */}
        {/* Admin Test Panel — only visible to admin email */}
        {isAdminEmail(userEmail)&&(
          <div className="card card-p" style={{marginBottom:20,border:"1px solid rgba(212,168,67,.4)",background:"rgba(212,168,67,.04)"}}>
            <div className="sh">
              <h2 style={{color:"var(--gold)"}}>🔧 Admin: Plan Test Mode</h2>
              <p>Simulate any subscription level. Changes are saved to the database so you can test the full flow.</p>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>Current plan:</span>
              <span style={{padding:"3px 10px",background:"var(--gold)",color:"#1a0f00",borderRadius:9,fontSize:12,fontWeight:700,textTransform:"uppercase"}}>{plan}</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["free","pro","district"].map(p=>(
                <button key={p} className={"btn "+(plan===p?"btn-g":"btn-o")} style={{textTransform:"capitalize",opacity:plan===p?.6:1}}
                  onClick={()=>plan!==p&&setPlan(p)}
                  disabled={plan===p}>
                  {plan===p?"✓ ":""}{p.charAt(0).toUpperCase()+p.slice(1)}{plan===p?" (active)":""}
                </button>
              ))}
            </div>
            <div style={{marginTop:10,fontSize:11.5,color:"var(--faint)",lineHeight:1.6}}>
              <strong>Free:</strong> 25 item cap, no Exchange or Reports · <strong>Pro:</strong> unlimited items, Backstage Exchange · <strong>District:</strong> all Pro features + multi-org (future)
            </div>
          </div>
        )}

        {!memberRole&&<TeamSettings userId={userId} orgName={org?.name||"Your Program"} plan={plan}/>}

        {/* ── Participation Toggles ─────────────────────────────────────── */}
        {!memberRole&&(
        <div className="card card-p">
          <div className="sh">
            <h2>Participation Settings</h2>
            <p>Choose which Theatre4u features your program participates in. These settings are private and only visible to your account.</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:16}}>
            {[
              {key:"community_enabled",  icon:"🎪", label:"Community Board",  desc:"Appear in the community directory and post to the shared board. Other programs can see your posts."},
              {key:"marketplace_enabled",icon:"🏪", label:"Backstage Exchange",  desc:"Share selected items with other theatre programs in the region. You control exactly which items are posted. Browse what others have available."},
            ].map(({key,icon,label,desc})=>(
              <div key={key} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{fontSize:22,marginTop:2}}>{icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>{label}</div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>{desc}</div>
                </div>
                <label style={{display:"flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>
                  <input type="checkbox"
                    checked={!!(org&&org[key])}
                    onChange={async e=>{
                      const val = e.target.checked;
                      const updated = {...org,[key]:val};
                      setOrg(updated);
                      await SB.from("orgs").update({[key]:val}).eq("id",userId);
                    }}
                    style={{width:18,height:18,cursor:"pointer",accentColor:"var(--gold)"}}
                  />
                  <span style={{marginLeft:8,fontSize:13,color:"var(--muted)",fontWeight:600}}>
                    {org&&org[key]?"On":"Off"}
                  </span>
                </label>
              </div>
            ))}
          </div>
          <p style={{fontSize:11,color:"var(--muted)",marginTop:14,fontStyle:"italic"}}>
            Changes take effect immediately. Turning off Community or Backstage Exchange removes your content from shared views but does not delete it. The Funding Tracker is always private to your account.
          </p>
        </div>
        )}

        <div className="card card-p">
          <div className="sh"><h2>🔒 QR Code Privacy</h2><p>Control what others see when they scan your item QR labels.</p></div>
          <QRPrivacySettings org={org} setOrg={setOrg} userId={userId}/>
        </div>

        <div className="card card-p">
          <div className="sh"><h2>🗂️ Custom Categories</h2><p>Add your own inventory categories alongside the built-in ones.</p></div>
          <CustomCategoriesManager org={org} userId={userId} memberRole={memberRole}/>
        </div>

        <div className="sc">
          <div className="sh"><h2>Data Management</h2><p>Load sample data to explore, or reset everything to start fresh.</p></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn btn-o" onClick={onSeed}><span style={{width:14,height:14,display:"flex"}}>{Ic.box}</span>Load Sample Data</button>
            <button className="btn btn-d" onClick={async()=>{
              if(!window.confirm("This will permanently delete ALL your inventory items from the database. Your account and organization profile will remain. This cannot be undone.")) return;
              // Get current item IDs from state and delete each by primary key
              // (more reliable than bulk delete against org_id with RLS)
              const currentItems = items;
              if(currentItems.length===0){window.alert("No items to delete.");return;}
              let failed=0;
              for(const item of currentItems){
                const{error}=await SB.from("items").delete().eq("id",item.id);
                if(error) failed++;
              }
              // Also try a bulk delete by org_id as belt-and-suspenders
              await SB.from("items").delete().eq("org_id",user.id);
              setItems([]);
              if(failed>0) window.alert("Deleted with "+failed+" error(s). Refresh if items remain.");
              else window.alert("All inventory items deleted.");
            }}><span style={{width:14,height:14,display:"flex"}}>{Ic.trash}</span>Delete All Items</button>
          </div>
        </div>

        {/* ── Delete My Account (self-service) ── */}
        <div className="card card-p" style={{ borderColor:"rgba(194,24,91,.25)",background:"rgba(194,24,91,.02)" }}>
          <div className="sh">
            <h2 style={{ color:"var(--red)" }}>⚠️ Close My Account</h2>
            <p>
              Permanently close your Theatre4u account. Your Stripe subscription will be canceled immediately.
              Your data will be preserved for 30 days — email <strong>hello@theatre4u.org</strong> within
              30 days to restore your account. After 30 days, all data is permanently deleted.
            </p>
          </div>
          <SelfServiceDeleteAccount user={user} org={org} />
        </div>

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH SCREENS
// ══════════════════════════════════════════════════════════════════════════════

// ─── Legal Modals ────────────────────────────────────────────────────────────


// ── Landing Page ──────────────────────────────────────────────────────────────
function LandingPage({onSignIn, onSignUp, onTakeTour=null}){
  const[scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",h,{passive:true});
    trackVisit("landing");
    return()=>window.removeEventListener("scroll",h);
  },[]);

  const features=[
    {icon:"📦",title:"Inventory That Actually Works",desc:"Catalog every costume, prop, light, and sound item your program owns. Add photos, tag by production, print QR labels for storage bins. Always know exactly what you have and where it lives."},
    {icon:"🎭",title:"Productions Tracker",desc:"Create a folder for each show. Assign items from your inventory, track what's checked out, and see at a glance what every production needs from wishlist to opening night."},
    {icon:"📱",title:"Mobile-Ready Backstage",desc:"Add items by taking a photo. Scan QR labels with your phone's camera — the iPhone Camera app reads Theatre4u labels instantly. Available on iPhone and Android — no app store required."},
    {icon:"💰",title:"Funding Tracker",desc:"Track grants, district allocations, booster funds, earned income, and donations. Log expenditures against each source, generate reports, and export to CSV — for your records."},
    {icon:"🏪",title:"Backstage Exchange",desc:"When you're ready, opt in to share selected items with other programs. You choose exactly which items to post — your full inventory stays completely private. Browse what others near you have available, rent, purchase, or arrange a loan."},
    {icon:"🎪",title:"Community Board",desc:"Post audition notices, share upcoming show dates, upload production photos, and find items you need. A regional bulletin board for the performing arts community."},
  ];

  const plans=[
    {name:"Free",price:"$0",period:"forever",color:"rgba(255,255,255,.15)",textColor:"rgba(255,255,255,.7)",features:["Up to 50 inventory items","QR labels & photos","Productions tracking","Browse Backstage Exchange","Community Board"],cta:"Get Started",primary:false},
    {name:"Pro",price:"$15",period:"/month",annual:"$150/year",color:"linear-gradient(135deg,var(--gold),var(--goldd))",textColor:"#1a0f00",features:["Unlimited inventory","Full Backstage Exchange access","Stage Points","Reports & CSV export","Funding Tracker","Mobile app","Messages & requests"],cta:"Start Pro",primary:true},
    {name:"District",price:"$49",period:"/month",annual:"$500/year",color:"linear-gradient(135deg,#1565c0,#0d47a1)",textColor:"#fff",features:["Everything in Pro","Up to 6 school sites","District dashboard","Shared Backstage Exchange","District funding rollup","Priority support"],cta:"Start District",primary:false},
  ];

  const steps=[
    {n:"1",title:"Create your free account",desc:"Sign up in 60 seconds. No credit card needed. Your first 50 items are always free."},
    {n:"2",title:"Build your inventory",desc:"Take photos on your phone or upload from your computer. Add name, category, condition, and location. Print QR labels for bins and racks."},
    {n:"3",title:"Track your productions",desc:"Create a show folder and pull items straight from your inventory. See what's assigned, what's checked out, and what you still need."},
    {n:"4",title:"Optionally join Backstage Exchange",desc:"When you're ready, opt in to Backstage Exchange. Post selected items for rent, loan, or sale. Browse what other programs near you have available."},
  ];

  return(<div style={{background:"var(--ink)",minHeight:"100vh",color:"var(--linen)",fontFamily:"'DM Sans',sans-serif"}}>
    
    {/* ── Sticky Nav ── */}
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:1000,padding:"0 32px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",background:scrolled?"rgba(13,10,8,.97)":"transparent",borderBottom:scrolled?"1px solid rgba(255,255,255,.08)":"none",backdropFilter:scrolled?"blur(12px)":"none",transition:"all .3s"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <img src={LOGO_ICON} alt={APP_NAME} style={{width:34,height:34,objectFit:"contain",display:"block",flexShrink:0}}/>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"var(--gold)"}}>{APP_NAME}</span>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <button onClick={onSignIn} style={{background:"none",border:"1px solid rgba(255,255,255,.25)",color:"rgba(255,255,255,.8)",padding:"7px 16px",borderRadius:7,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600}}>Sign In</button>
        <button onClick={onSignUp} style={{background:"linear-gradient(135deg,var(--gold),var(--goldd))",border:"none",color:"#1a0f00",padding:"7px 18px",borderRadius:7,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800}}>Get Started Free →</button>
      </div>
    </nav>

    {/* ── Hero ── */}
    <div style={{position:"relative",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"120px 24px 80px",overflow:"hidden"}}>
      {/* Background image */}
      <img src={usp("photo-1503095396549-807759245b35",1600,900)} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.2,pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(13,10,8,.7) 0%,rgba(13,10,8,.5) 50%,rgba(13,10,8,.95) 100%)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,maxWidth:760}}>
        <div style={{position:"relative",display:"flex",justifyContent:"center",alignItems:"center",margin:"0 auto 30px",minHeight:190}}>
          <div aria-hidden="true" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(820px,100vw)",height:310,borderRadius:"50%",pointerEvents:"none",background:"radial-gradient(ellipse at 50% 50%, rgba(250,244,232,.98) 0%, rgba(249,242,227,.93) 46%, rgba(243,221,165,.5) 64%, rgba(234,193,108,.18) 76%, transparent 86%)",filter:"blur(3px)"}}/>
          <img src={LOGO_FULL} alt={APP_NAME} style={{position:"relative",zIndex:1,width:"min(430px,80vw)",height:"auto",display:"block"}}/>
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"4px 14px",background:"rgba(212,168,67,.15)",border:"1px solid rgba(212,168,67,.3)",borderRadius:20,fontSize:12,fontWeight:700,color:"var(--gold)",textTransform:"uppercase",letterSpacing:1,marginBottom:20}}>
          🎭 The Platform for Theatre Programs
        </div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(42px,7vw,76px)",lineHeight:1.05,marginBottom:20,color:"#fff"}}>
          Everything your theatre program needs —{" "}
          <span style={{color:"var(--gold)"}}>in one place</span>
        </h1>
        <p style={{fontSize:"clamp(16px,2.5vw,20px)",color:"rgba(255,255,255,.7)",lineHeight:1.7,marginBottom:36,maxWidth:600,margin:"0 auto 36px"}}>
          Know what you have. Find what you need. Built specifically for theatre programs of every size.
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={onSignUp} style={{background:"linear-gradient(135deg,var(--gold),var(--goldd))",border:"none",color:"#1a0f00",padding:"14px 32px",borderRadius:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:16,fontWeight:800,boxShadow:"0 4px 24px rgba(212,168,67,.4)"}}>
            Get Started Free — No credit card →
          </button>
          <button onClick={onSignIn} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",padding:"14px 24px",borderRadius:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:600}}>
            Sign In
          </button>
          {onTakeTour && (
            <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
              <button onClick={()=>window.location.href=window.location.href.split("?")[0]+"?demo=1"}
                style={{background:"linear-gradient(135deg,rgba(212,168,67,.25),rgba(212,168,67,.1))",
                  border:"1px solid rgba(212,168,67,.6)",color:"rgba(212,168,67,.95)",
                  padding:"12px 22px",borderRadius:10,cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700}}>
                🎭 Try the Full Demo
              </button>
              <button onClick={onTakeTour}
                style={{background:"transparent",border:"1px solid rgba(255,255,255,.2)",
                  color:"rgba(255,255,255,.65)",padding:"12px 20px",borderRadius:10,cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500}}>
                👁 Quick Preview
              </button>
            </div>
          )}
        </div>
        <div style={{marginTop:20,fontSize:12,color:"rgba(255,255,255,.4)"}}>
          Free plan available · Pro from $15/month · No contracts
        </div>
      </div>
    </div>

    {/* ── Social proof strip ── */}
    <div style={{background:"rgba(212,168,67,.08)",borderTop:"1px solid rgba(212,168,67,.15)",borderBottom:"1px solid rgba(212,168,67,.15)",padding:"16px 32px",display:"flex",flexWrap:"wrap",gap:24,justifyContent:"center",alignItems:"center"}}>
      {[["📦","Inventory management"],["🎭","Productions tracker"],["📱","Mobile-ready"],["💰","Funding Tracker"],["🏪","Backstage Exchange"],["🎪","Community board"]].map(([ico,lbl])=>(
        <div key={lbl} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,color:"rgba(255,255,255,.7)"}}>
          <span style={{fontSize:16}}>{ico}</span>{lbl}
        </div>
      ))}
    </div>

    {/* ── Features ── */}
    <div style={{padding:"80px 32px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:52}}>
        <div style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",marginBottom:10}}>What Theatre4u™ does</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(32px,5vw,48px)",color:"#fff",lineHeight:1.15}}>Built for busy drama directors</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,.55)",marginTop:12,maxWidth:520,margin:"12px auto 0"}}>Not a generic inventory app. Built specifically for theatre programs, schools, and the broader performing arts community — by someone who has lived it.</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20}}>
        {features.map(f=>(
          <div key={f.title} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"24px 22px",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(212,168,67,.08)";e.currentTarget.style.borderColor="rgba(212,168,67,.25)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor="rgba(255,255,255,.08)";}}>
            <div style={{fontSize:32,marginBottom:12}}>{f.icon}</div>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#fff",marginBottom:8,lineHeight:1.2}}>{f.title}</h3>
            <p style={{fontSize:13.5,color:"rgba(255,255,255,.55)",lineHeight:1.7}}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* ── How it works ── */}
    <div style={{background:"rgba(255,255,255,.03)",borderTop:"1px solid rgba(255,255,255,.06)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"72px 32px"}}>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",marginBottom:10}}>Get started in minutes</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(28px,4vw,42px)",color:"#fff"}}>How it works</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:24}}>
          {steps.map(s=>(
            <div key={s.n} style={{textAlign:"center"}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--goldd))",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:22,color:"#1a0f00",margin:"0 auto 14px"}}>{s.n}</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#fff",marginBottom:7}}>{s.title}</h3>
              <p style={{fontSize:13,color:"rgba(255,255,255,.5)",lineHeight:1.6}}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* ── Pricing ── */}
    <div style={{padding:"80px 32px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:48}}>
        <div style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",marginBottom:10}}>Simple, honest pricing</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(28px,4vw,42px)",color:"#fff"}}>Plans for every program</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,.45)",marginTop:10}}>Annual plans available — save up to 2 months free</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>
        {plans.map(p=>(
          <div key={p.name} style={{borderRadius:16,overflow:"hidden",border:p.primary?"1px solid rgba(212,168,67,.4)":"1px solid rgba(255,255,255,.1)",position:"relative",boxShadow:p.primary?"0 8px 40px rgba(212,168,67,.2)":"none"}}>
            {p.primary&&<div style={{position:"absolute",top:14,right:14,background:"var(--gold)",color:"#1a0f00",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:10,textTransform:"uppercase",letterSpacing:.5}}>Most Popular</div>}
            <div style={{background:p.color,padding:"28px 24px 20px"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:p.textColor,marginBottom:4}}>{p.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:42,color:p.textColor}}>{p.price}</span>
                <span style={{fontSize:14,color:p.textColor,opacity:.7}}>{p.period}</span>
              </div>
              {p.annual&&<div style={{fontSize:11,color:p.textColor,opacity:.6,marginTop:3}}>{p.annual} · save 2 months</div>}
            </div>
            <div style={{background:"rgba(255,255,255,.04)",padding:"20px 24px 24px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:20}}>
                {p.features.map(f=>(
                  <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"rgba(255,255,255,.75)"}}>
                    <span style={{color:"var(--gold)",fontWeight:800,flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={onSignUp} style={{width:"100%",padding:"11px",borderRadius:9,border:"none",background:p.primary?"linear-gradient(135deg,var(--gold),var(--goldd))":"rgba(255,255,255,.12)",color:p.primary?"#1a0f00":"rgba(255,255,255,.85)",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,cursor:"pointer"}}>
                {p.cta} →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* ── Final CTA ── */}
    <div style={{textAlign:"center",padding:"72px 32px 96px",borderTop:"1px solid rgba(255,255,255,.06)"}}>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(28px,5vw,52px)",color:"#fff",marginBottom:16,lineHeight:1.15}}>
        Ready to get your<br/><span style={{color:"var(--gold)"}}>theatre organized?</span>
      </h2>
      <p style={{fontSize:16,color:"rgba(255,255,255,.5)",marginBottom:32,maxWidth:440,margin:"0 auto 32px"}}>Join theatre programs already using Theatre4u™ to get their inventory under control, track their shows, and connect with their community.</p>
      <button onClick={onSignUp} style={{background:"linear-gradient(135deg,var(--gold),var(--goldd))",border:"none",color:"#1a0f00",padding:"16px 40px",borderRadius:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:18,fontWeight:800,boxShadow:"0 4px 32px rgba(212,168,67,.45)"}}>
        Start Free — No credit card required →
      </button>
      <div style={{marginTop:14,fontSize:12,color:"rgba(255,255,255,.3)"}}>Free plan · No contracts · Cancel anytime</div>
    </div>

    {/* Our Story */}
    <div style={{padding:"80px 32px",maxWidth:900,margin:"0 auto",textAlign:"center"}}>
      <div style={{display:"inline-block",padding:"4px 14px",background:"rgba(212,168,67,.1)",border:"1px solid rgba(212,168,67,.2)",borderRadius:20,fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",marginBottom:20}}>
        Our Story
      </div>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(26px,4vw,40px)",marginBottom:24,lineHeight:1.2}}>
        Built by a Theatre Person,<br/><span style={{color:"var(--gold)"}}>For Theatre People.</span>
      </h2>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,textAlign:"left",marginBottom:48}}>
        <div>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)",marginBottom:16}}>
            After spending over 30 years in the theatre and 18+ years in the classroom, I know how quickly props and costumes can seem to explode out of control. As theatre artists moving from one production to the next, we need to know which box that magic wand for Puffs lives in.
          </p>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)"}}>
            And we need a chance to connect with other theatre programs that may have something we need, or need something we have. This is why Theatre4u was started.
          </p>
        </div>
        <div>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)",marginBottom:16}}>
            Theatre4u keeps track of everything your program owns — and opens the door to a community of programs ready to share resources, collaborate, and support each other.
          </p>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)"}}>
            <strong style={{color:"#fff"}}>Theatre is always better together.</strong> This platform was built to help make that connection easier — from the wings to the whole community.
          </p>
          <div style={{marginTop:28,paddingTop:20,borderTop:"1px solid rgba(255,255,255,.1)",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),#8a6a20)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1000" strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>Robert Zick</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.45)"}}>Founder, Theatre4u™ &amp; Artstracker · 18+ years in the classroom</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:24,justifyContent:"center",flexWrap:"wrap"}}>
        {[
          {ico:"🎭",val:"30+",lbl:"Years in theatre"},
          {ico:"🎓",lbl:"Studied & performed theatre"},
          {ico:"🏫",lbl:"Built for the classroom"},
          {ico:"🤝",lbl:"Teacher to teacher"},
        ].map(s=>(
          <div key={s.lbl} style={{textAlign:"center",padding:"16px 20px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,minWidth:130}}>
            <div style={{fontSize:26,marginBottom:6}}>{s.ico}</div>
            {s.val&&<div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"var(--gold)",marginBottom:2}}>{s.val}</div>}
            <div style={{fontSize:12,color:"rgba(255,255,255,.5)",fontWeight:600}}>{s.lbl}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Footer */}
    <div style={{borderTop:"1px solid rgba(255,255,255,.06)",padding:"24px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:26,height:26,background:"linear-gradient(135deg,var(--gold),var(--goldd))",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎭</div>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"var(--gold)"}}>{APP_NAME}</span>
        <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>© 2026 Artstracker LLC</span>
      </div>
      <div style={{display:"flex",gap:18,fontSize:12,color:"rgba(255,255,255,.35)"}}>
        <a href="/help.html" target="_blank" style={{color:"rgba(255,255,255,.35)",textDecoration:"none"}} onMouseEnter={e=>e.target.style.color="var(--gold)"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.35)"}>Help Center</a>
        <a href="/contact.html" target="_blank" style={{color:"rgba(255,255,255,.35)",textDecoration:"none"}} onMouseEnter={e=>e.target.style.color="var(--gold)"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.35)"}>Contact</a>
        <span style={{cursor:"pointer"}} onClick={onSignIn}>Sign In</span>
        <span style={{cursor:"pointer"}} onClick={onSignUp}>Sign Up</span>
        <span>hello@theatre4u.org</span>
      </div>
    </div>
  </div>);
}




// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════════

// ── Public Item Page (no login required) ─────────────────────────────────────
function PublicOrgPage({ slug }) {
  const [org,   setOrg]   = useState(null);
  const [items, setItems] = useState([]);
  const [err,   setErr]   = useState(null);

  useEffect(()=>{
    (async()=>{
      const { data: orgData, error } = await SB.from("orgs")
        .select("id,name,type,location,bio,email,phone,website,facebook,instagram,logo_url,founded_year,student_count,profile_public,label_prefix,director_name,director_title")
        .eq("slug", slug).eq("profile_public", true).single();
      if (error || !orgData) { setErr("Program not found or profile is private."); return; }
      setOrg(orgData);
      const { data: listed } = await SB.from("items")
        .select("id,name,category,img,mkt,rent,sale,avail,condition,display_id,location")
        .eq("org_id", orgData.id)
        .neq("mkt", "Not Listed")
        .eq("avail", "In Stock")
        .limit(24);
      setItems(listed || []);
    })();
  }, [slug]);

  const Header = () => (
    <div style={{background:"linear-gradient(135deg,#1a0d2e,#0d1829)",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:26}}>🎭</span>
      <div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"var(--gold)",lineHeight:1}}>{APP_NAME}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>Inventory · Backstage Exchange · Community</div>
      </div>
      <a href="https://theatre4u.org" style={{marginLeft:"auto",fontSize:12,color:"var(--gold)",textDecoration:"none",border:"1px solid rgba(212,168,67,.3)",borderRadius:6,padding:"5px 12px"}}>Visit Site →</a>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:"var(--ink)",color:"var(--linen)",fontFamily:"'DM Sans',sans-serif",padding:"0 0 60px"}}>
        <Header/>
        <div style={{maxWidth:700,margin:"0 auto",padding:"28px 16px"}}>

          {err && (
            <div style={{textAlign:"center",padding:"40px 16px"}}>
              <div style={{fontSize:42,marginBottom:12}}>🔍</div>
              <div style={{fontSize:18,color:"var(--gold)",fontFamily:"'Playfair Display',serif",marginBottom:8}}>Profile Not Found</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>{err}</div>
            </div>
          )}

          {!org && !err && (
            <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,.4)"}}>
              <div style={{fontSize:42,marginBottom:12}}>🎭</div>
              <div>Loading…</div>
            </div>
          )}

          {org && (<>
            {/* Org header */}
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,
              background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",
              borderRadius:14,padding:20}}>
              <div style={{width:64,height:64,borderRadius:12,flexShrink:0,overflow:"hidden",
                background:"linear-gradient(135deg,rgba(212,168,67,.3),rgba(212,168,67,.1))",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>
                {org.logo_url
                  ? <img src={org.logo_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : "🎭"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,lineHeight:1.2,marginBottom:4}}>
                  {org.name}
                </div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>
                  {[org.type, org.location].filter(Boolean).join(" · ")}
                </div>
                {org.director_name && (
                  <div style={{fontSize:12,color:"var(--gold)",marginTop:4}}>
                    {org.director_name}{org.director_title ? " · "+org.director_title : ""}
                  </div>
                )}
                {org.label_prefix && (
                  <div style={{fontFamily:"monospace",fontSize:11,color:"rgba(212,168,67,.6)",
                    marginTop:4,letterSpacing:1}}>{org.label_prefix}</div>
                )}
              </div>
            </div>

            {/* Bio + stats */}
            {org.bio && (
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",
                borderRadius:10,padding:16,marginBottom:16,fontSize:13.5,
                color:"rgba(255,255,255,.65)",lineHeight:1.7}}>
                {org.bio}
              </div>
            )}

            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
              {org.founded_year&&<span style={{padding:"3px 10px",background:"rgba(212,168,67,.1)",color:"var(--gold)",borderRadius:6,fontSize:12,fontWeight:700}}>Est. {org.founded_year}</span>}
              {org.student_count&&<span style={{padding:"3px 10px",background:"rgba(82,199,132,.1)",color:"#4caf50",borderRadius:6,fontSize:12,fontWeight:700}}>{org.student_count.toLocaleString()} students</span>}
              {items.length>0&&<span style={{padding:"3px 10px",background:"rgba(66,165,245,.1)",color:"#42a5f5",borderRadius:6,fontSize:12,fontWeight:700}}>{items.length} items on Exchange</span>}
            </div>

            {/* Contact */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24}}>
              {org.email&&<a href={"mailto:"+org.email} style={{fontSize:13,color:"var(--gold)",textDecoration:"none"}}>✉️ {org.email}</a>}
              {org.phone&&<span style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>📞 {org.phone}</span>}
              {org.website&&<a href={org.website} target="_blank" rel="noreferrer" style={{fontSize:13,color:"var(--gold)",textDecoration:"none"}}>🌐 Website</a>}
            </div>

            {/* Exchange listings */}
            {items.length > 0 && (<>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:14}}>
                Backstage Exchange Listings
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12,marginBottom:24}}>
                {items.map(item=>{
                  const cat = CAT_MAP[item.category]||CAT_MAP.other;
                  const mB  = item.mkt==="For Rent"?"r":item.mkt==="For Sale"?"s":"b";
                  return(
                    <a key={item.id} href={"#/item/"+(item.display_id||item.id)}
                      style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",
                        borderRadius:10,padding:14,textDecoration:"none",color:"var(--linen)",
                        display:"block",transition:"border-color .15s"}}
                      onMouseOver={e=>e.currentTarget.style.borderColor="rgba(212,168,67,.4)"}
                      onMouseOut={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.08)"}>
                      {item.img&&<div style={{height:100,borderRadius:7,overflow:"hidden",marginBottom:10,background:"rgba(0,0,0,.2)"}}>
                        <img src={item.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      </div>}
                      <div style={{fontSize:12,color:cat.color,fontWeight:700,marginBottom:3}}>{cat.icon} {cat.label}</div>
                      <div style={{fontSize:14,fontWeight:600,marginBottom:6,lineHeight:1.3}}>{item.name}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span className={"mb "+mB} style={{fontSize:10}}>{item.mkt}</span>
                        <span style={{fontSize:13,fontWeight:700,color:"var(--gold)"}}>
                          {item.rent>0?"$"+Number(item.rent).toFixed(2)+"/wk":""}
                          {item.rent>0&&item.sale>0?" · ":""}
                          {item.sale>0?"$"+Number(item.sale).toFixed(2):""}
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>)}

            <div style={{textAlign:"center",marginTop:20}}>
              <a href="https://theatre4u.org?signin=1"
                style={{display:"inline-flex",alignItems:"center",gap:8,padding:"11px 24px",
                  background:"linear-gradient(135deg,#c4922a,#8b6914)",color:"#1a0f00",
                  borderRadius:8,textDecoration:"none",fontSize:14,fontWeight:700}}>
                🎭 Browse the Backstage Exchange →
              </a>
            </div>
          </>)}
        </div>
      </div>
    </>
  );
}

// ── UnassignedLabelAssigner ───────────────────────────────────────────────────
// Shown when someone scans a blank label. Lets the owner assign it to an item
// or add a new item, all from the scan page.
function UnassignedLabelAssigner({ labelCode, onDone }) {
  const [session,    setSession]    = useState(null);
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");
  const [mode,       setMode]       = useState("pick"); // "pick" | "new"
  const [newName,    setNewName]    = useState("");
  const [newCat,     setNewCat]     = useState("costumes");
  const [newLoc,     setNewLoc]     = useState("");

  useEffect(()=>{
    (async()=>{
      const { data:{ session:s } } = await SB.auth.getSession();
      setSession(s);
      if(s){
        // Load items that don't already have a label
        const {data} = await SB.from("items")
          .select("id,name,category,location,display_id")
          .eq("org_id", s.user.id)
          .order("name");
        setItems(data||[]);
      }
      setLoading(false);
    })();
  },[]);

  const assign = async(itemId) => {
    setSaving(true); setErr("");
    const {error} = await SB.from("label_pool")
      .update({ item_id: itemId, status:"claimed", claimed_at: new Date().toISOString() })
      .eq("code", labelCode);
    if(error){ setErr("Could not assign label. Try again."); setSaving(false); return; }
    // Also write the label code back to the item
    await SB.from("items").update({ item_number: labelCode }).eq("id", itemId);
    onDone();
  };

  const createAndAssign = async() => {
    if(!newName.trim()){ setErr("Please enter an item name."); return; }
    setSaving(true); setErr("");
    const newItem = {
      id: crypto.randomUUID(),
      org_id: session.user.id,
      name: newName.trim(),
      category: newCat,
      location: newLoc.trim(),
      condition:"Good", qty:1, avail:"In Stock", mkt:"Not Listed",
      added: new Date().toISOString(),
    };
    const {error} = await SB.from("items").insert(newItem);
    if(error){ setErr("Could not create item. Try again."); setSaving(false); return; }
    await assign(newItem.id);
  };

  if(loading) return <div style={{color:"rgba(255,255,255,.4)",fontSize:13}}>Checking account…</div>;

  // Not logged in
  if(!session) return (
    <div>
      <div style={{color:"rgba(255,255,255,.5)",fontSize:13,marginBottom:16}}>
        Sign in to assign this label to one of your inventory items.
      </div>
      <a href={`https://theatre4u.org?signin=1&next=${encodeURIComponent("#/item/"+labelCode)}`}
        style={{display:"inline-block",padding:"11px 28px",
          background:"linear-gradient(135deg,#c4922a,#8b6914)",
          borderRadius:8,color:"#1a0f00",fontWeight:700,
          textDecoration:"none",fontSize:14}}>
        Sign In to Assign →
      </a>
    </div>
  );

  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.location||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{textAlign:"left",maxWidth:400,margin:"0 auto"}}>
      {err && <div style={{background:"rgba(194,24,91,.15)",border:"1px solid rgba(194,24,91,.3)",
        borderRadius:8,padding:"10px 14px",color:"#e06090",fontSize:13,marginBottom:12}}>{err}</div>}

      {/* Mode toggle */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setMode("pick")}
          style={{flex:1,padding:"9px",borderRadius:8,fontFamily:"inherit",fontSize:13,
            fontWeight:600,cursor:"pointer",border:"1px solid rgba(255,255,255,.15)",
            background:mode==="pick"?"var(--gold)":"rgba(255,255,255,.06)",
            color:mode==="pick"?"#1a0f00":"rgba(255,255,255,.7)"}}>
          📦 Assign to Existing Item
        </button>
        <button onClick={()=>setMode("new")}
          style={{flex:1,padding:"9px",borderRadius:8,fontFamily:"inherit",fontSize:13,
            fontWeight:600,cursor:"pointer",border:"1px solid rgba(255,255,255,.15)",
            background:mode==="new"?"var(--gold)":"rgba(255,255,255,.06)",
            color:mode==="new"?"#1a0f00":"rgba(255,255,255,.7)"}}>
          ✨ Add New Item
        </button>
      </div>

      {/* Pick existing item */}
      {mode==="pick" && (<>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search your items…"
          style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.15)",
            background:"rgba(255,255,255,.06)",color:"#fff",fontSize:14,
            fontFamily:"inherit",outline:"none",marginBottom:10}}/>
        {filtered.length===0
          ? <div style={{color:"rgba(255,255,255,.4)",fontSize:13,textAlign:"center",padding:20}}>
              No items found. Try a different search or add a new item.
            </div>
          : <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>
              {filtered.map(i=>(
                <button key={i.id} onClick={()=>assign(i.id)} disabled={saving}
                  style={{textAlign:"left",padding:"10px 14px",borderRadius:8,
                    border:"1px solid rgba(255,255,255,.12)",
                    background:"rgba(255,255,255,.05)",cursor:"pointer",
                    fontFamily:"inherit",color:"#fff",width:"100%",
                    opacity:saving?.5:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{i.name}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:2}}>
                    {i.category}{i.location?" · "+i.location:""}
                    {i.display_id?" · "+i.display_id:""}
                  </div>
                </button>
              ))}
            </div>
        }
      </>)}

      {/* Add new item */}
      {mode==="new" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:4,
              textTransform:"uppercase",letterSpacing:1}}>Item Name *</div>
            <input value={newName} onChange={e=>setNewName(e.target.value)}
              placeholder="e.g. Victorian Ball Gown"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,
                border:"1px solid rgba(255,255,255,.15)",
                background:"rgba(255,255,255,.06)",color:"#fff",
                fontSize:14,fontFamily:"inherit",outline:"none"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:4,
              textTransform:"uppercase",letterSpacing:1}}>Category</div>
            <select value={newCat} onChange={e=>setNewCat(e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,
                border:"1px solid rgba(255,255,255,.15)",
                background:"#1a1520",color:"#fff",fontSize:14,fontFamily:"inherit"}}>
              {Object.entries(CAT_MAP).map(([id,c])=>(
                <option key={id} value={id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginBottom:4,
              textTransform:"uppercase",letterSpacing:1}}>Location</div>
            <input value={newLoc} onChange={e=>setNewLoc(e.target.value)}
              placeholder="e.g. Storage Bin 3A"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,
                border:"1px solid rgba(255,255,255,.15)",
                background:"rgba(255,255,255,.06)",color:"#fff",
                fontSize:14,fontFamily:"inherit",outline:"none"}}/>
          </div>
          <button onClick={createAndAssign} disabled={saving||!newName.trim()}
            style={{padding:"12px",borderRadius:8,border:"none",
              background:"linear-gradient(135deg,#c4922a,#8b6914)",
              color:"#1a0f00",fontWeight:700,fontSize:14,cursor:"pointer",
              fontFamily:"inherit",opacity:saving||!newName.trim()?.6:1}}>
            {saving?"Saving…":"✨ Create Item & Assign Label"}
          </button>
          <div style={{fontSize:12,color:"rgba(255,255,255,.35)",textAlign:"center"}}>
            You can add more details (photos, condition, notes) after assignment in Theatre4u.
          </div>
        </div>
      )}
    </div>
  );
}


function PublicItemPage({ itemId }) {
  const [item,    setItem]    = useState(null);
  const [org,     setOrg]     = useState(null);
  const [err,     setErr]     = useState(null);
  const [legacy,  setLegacy]  = useState(false);
  const [lb,      setLb]      = useState(null);
  const [access,  setAccess]  = useState("full"); // "full" | "loan" | "guest" | "contact"
  const [contact, setContact] = useState(null);

  const [poolLabel,   setPoolLabel]   = useState(null); // {code, org_name, status}
  const [assigning,   setAssigning]   = useState(false);
  const [assignDone,  setAssignDone]  = useState(false);

  useEffect(()=>{
    (async()=>{
      const cleanId = (itemId || "").trim();
      if(!cleanId) return;
      try {
        const { data: { session } } = await SB.auth.getSession();
        const token = session?.access_token;
        const headers = token ? { "x-t4u-token": token } : {};
        const res  = await fetch(
          "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/public-item?id=" + encodeURIComponent(cleanId),
          { headers }
        );
        const json = await res.json();

        // ── Unassigned pool label ─────────────────────────────────────────
        if (json.pool_code && !json.item) {
          setPoolLabel({
            code:     json.label_code || cleanId,
            org_name: json.org_name   || null,
            org_id:   json.org_id     || null,
            status:   json.status     || "assigned",
          });
          return;
        }

        if (!res.ok || !json.item) {
          setLegacy(!!json.legacy);
          setErr("Item not found.");
          return;
        }
        setAccess(json.access || "full");
        if (json.contact) setContact(json.contact);
        const raw = json.item;
        setItem({
          ...raw,
          quantity:     raw.qty,
          availability: raw.avail,
          images:       raw.img ? [raw.img] : [],
        });
        if (json.org) setOrg(json.org);
      } catch(e) {
        setErr("Item not found.");
      }
    })();
  }, [itemId]);

  const cat    = item ? (CAT_MAP[item.category] || CAT_MAP.other) : null;
  const mkt    = item?.mkt || item?.marketStatus || "Not Listed";
  const rentalPrice = item?.rent || item?.rentalPrice || 0;
  const salePrice   = item?.sale || item?.salePrice  || 0;
  const mB     = mkt==="For Rent"?"r":mkt==="For Sale"?"s":mkt==="Rent or Sale"?"b":"n";
  const imgs   = item?.images || [];
  const prefix = org?.label_prefix || "";

  // Header bar — same for all access levels
  const Header = () => (
    <div style={{background:"linear-gradient(135deg,#1a0d2e,#0d1829)",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:26}}>🎭</span>
      <div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"var(--gold)",lineHeight:1}}>{APP_NAME}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>Inventory · Backstage Exchange · Community</div>
      </div>
      <a href="https://theatre4u.org" style={{marginLeft:"auto",fontSize:12,color:"var(--gold)",textDecoration:"none",border:"1px solid rgba(212,168,67,.3)",borderRadius:6,padding:"5px 12px"}}>Visit Site →</a>
    </div>
  );

  // Owner badge shown on guest + loan views
  const OwnerBadge = () => (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
      background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",
      borderRadius:8,marginBottom:16}}>
      <div style={{fontFamily:"monospace",fontSize:13,fontWeight:800,color:"var(--gold)",
        background:"rgba(212,168,67,.15)",padding:"3px 10px",borderRadius:5,letterSpacing:1}}>
        {prefix || "T4U"}
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:700}}>{org?.name || "Theatre4u Program"}</div>
        {org?.city && <div style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>📍 {org.city}</div>}
      </div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:"var(--ink)",color:"var(--linen)",fontFamily:"'DM Sans',sans-serif",padding:"0 0 60px"}}>
        {lb && <div className="lightbox" onClick={()=>setLb(null)}><img src={lb} alt=""/></div>}
        <Header/>

        <div style={{maxWidth:640,margin:"0 auto",padding:"24px 16px"}}>

          {/* Loading */}
          {!item && !err && (
            <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,.4)"}}>
              <div style={{fontSize:42,marginBottom:12}}>🎭</div>
              <div>Loading item…</div>
            </div>
          )}

          {/* ── Unassigned pool label ──────────────────────────────────────── */}
          {poolLabel && !assignDone && (
            <div style={{textAlign:"center",padding:"40px 16px"}}>
              <div style={{fontSize:48,marginBottom:12}}>🏷️</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,
                color:"var(--gold)",marginBottom:8}}>
                Unassigned Label
              </div>
              <div style={{fontFamily:"monospace",fontSize:14,color:"rgba(255,255,255,.5)",
                marginBottom:16,background:"rgba(255,255,255,.05)",display:"inline-block",
                padding:"4px 12px",borderRadius:6,letterSpacing:1}}>
                {poolLabel.code}
              </div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:14,lineHeight:1.7,
                maxWidth:360,margin:"0 auto 28px"}}>
                This label hasn't been assigned to an item yet.
                {poolLabel.org_name && <><br/><strong style={{color:"rgba(255,255,255,.8)"}}>
                  {poolLabel.org_name}</strong> — scan this label from your Theatre4u
                  inventory to assign it to an item.</>}
              </div>

              {/* Two paths: logged-in owner can assign now, others prompted to sign in */}
              <UnassignedLabelAssigner
                labelCode={poolLabel.code}
                onDone={()=>setAssignDone(true)}
              />
            </div>
          )}

          {poolLabel && assignDone && (
            <div style={{textAlign:"center",padding:"40px 16px"}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,
                color:"var(--gold)",marginBottom:12}}>Label Assigned!</div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:14,marginBottom:24}}>
                Next time someone scans this label, they'll see the item details.
              </div>
              <a href="https://theatre4u.org" style={{display:"inline-block",
                padding:"10px 24px",background:"linear-gradient(135deg,#c4922a,#8b6914)",
                borderRadius:8,color:"#1a0f00",fontWeight:700,textDecoration:"none",fontSize:14}}>
                Back to Theatre4u →
              </a>
            </div>
          )}

          {/* Not found */}
          {err && (
            <div style={{textAlign:"center",padding:"40px 16px"}}>
              <div style={{fontSize:42,marginBottom:12}}>🔍</div>
              <div style={{fontSize:20,fontFamily:"'Playfair Display',serif",marginBottom:10,color:"var(--gold)"}}>Item Not Found</div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:14,lineHeight:1.7,marginBottom:20}}>
                {legacy
                  ? "This QR label was printed with an older format. The item owner needs to reprint the label from their Theatre4u inventory."
                  : "This item may have been deleted or the QR label may be damaged."}
              </div>
              <a href="https://theatre4u.org?signin=1" style={{display:"inline-block",padding:"10px 24px",background:"linear-gradient(135deg,#c4922a,#8b6914)",borderRadius:8,color:"#1a0f00",fontWeight:700,textDecoration:"none",fontSize:14}}>
                Sign In to Theatre4u →
              </a>
            </div>
          )}

          {/* ── FULL ACCESS (owner or team member) ─────────────────────────── */}
          {item && access === "full" && (<>
            {imgs.length > 0 && (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
                {imgs.map((src,i)=>(
                  <img key={i} src={src} alt="" onClick={()=>setLb(src)}
                    style={{width:i===0?"100%":"calc(33% - 6px)",height:i===0?260:90,
                      objectFit:"cover",borderRadius:i===0?10:6,cursor:"pointer",
                      border:"1px solid rgba(255,255,255,.08)"}}/>
                ))}
              </div>
            )}
            <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16}}>
              <div style={{width:44,height:44,borderRadius:8,background:cat.color+"33",
                display:"flex",alignItems:"center",justifyContent:72,fontSize:22,flexShrink:0}}>
                {cat.icon}
              </div>
              <div>
                <div style={{fontSize:11,color:cat.color,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{cat.label}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,lineHeight:1.2}}>{item.name}</div>
                {prefix && <div style={{fontFamily:"monospace",fontSize:11,color:"var(--gold)",marginTop:3,letterSpacing:1}}>{prefix}-{(item.display_id||"").replace(/[^0-9]/g,"").padStart(4,"0") || "—"}</div>}
              </div>
            </div>
            {(item.tags||[]).length>0 && (
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
                {item.tags.map(t=><span key={t} style={{padding:"2px 8px",background:"rgba(212,168,67,.12)",color:"var(--gold)",borderRadius:4,fontSize:11}}>#{t}</span>)}
              </div>
            )}
            <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"rgba(255,255,255,.4)",marginBottom:10}}>Item Details</div>
              {[
                ["Condition",    item.condition],
                ["Size",         item.size!=="N/A"?item.size:null],
                ["Quantity",     item.quantity],
                ["Location",     item.location],
                ["Availability", item.availability],
                item.notes && ["Notes", item.notes],
              ].filter(r=>r&&r[1]).map(([l,v])=>(
                <div key={l} style={{display:"flex",padding:"5px 0",borderTop:"1px solid rgba(255,255,255,.05)"}}>
                  <span style={{width:120,color:"rgba(255,255,255,.4)",fontSize:12,flexShrink:0}}>{l}</span>
                  <span style={{fontSize:13}}>{v}</span>
                </div>
              ))}
            </div>
            {mkt !== "Not Listed" && (
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"rgba(255,255,255,.4)",marginBottom:10}}>Backstage Exchange</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span className={"mb "+mB}>{mkt}</span>
                  <span style={{fontWeight:700,color:"var(--gold)",fontSize:15}}>
                    {rentalPrice>0 ? ("$"+Number(rentalPrice).toFixed(2)+"/wk") : ""}
                    {rentalPrice>0&&salePrice>0 ? " · " : ""}
                    {salePrice>0 ? ("$"+Number(salePrice).toFixed(2)) : ""}
                  </span>
                </div>
              </div>
            )}
            {org && (
              <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.08)",fontSize:12,color:"rgba(255,255,255,.35)",textAlign:"center"}}>
                {org.name} · Theatre4u™
              </div>
            )}
            {/* Open in App — deep links to the item in the main app */}
            <a href={"https://theatre4u.org/#/item/"+(item.display_id||itemId)}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                marginTop:16,background:"rgba(212,168,67,.1)",border:"1px solid rgba(212,168,67,.25)",
                color:"var(--gold)",padding:"10px 16px",borderRadius:8,
                textDecoration:"none",fontSize:13,fontWeight:600}}>
              🎭 Open in Theatre4u →
            </a>
          </>)}

          {/* ── LOAN ACCESS (another Theatre4u program borrowing this item) ─── */}
          {item && access === "loan" && (
            <div>
              {org && <OwnerBadge/>}
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:20,marginBottom:14}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:6}}>Item on Loan</div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  {cat && <div style={{width:36,height:36,borderRadius:7,background:cat.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.icon}</div>}
                  <div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20}}>{item.name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{cat?.label}</div>
                  </div>
                </div>
                {[
                  ["Condition",  item.condition],
                  ["Quantity",   item.quantity],
                ].filter(r=>r&&r[1]).map(([l,v])=>(
                  <div key={l} style={{display:"flex",padding:"5px 0",borderTop:"1px solid rgba(255,255,255,.05)"}}>
                    <span style={{width:120,color:"rgba(255,255,255,.4)",fontSize:12}}>{l}</span>
                    <span style={{fontSize:13}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(66,165,245,.08)",border:"1px solid rgba(66,165,245,.2)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>📋 On Loan via Backstage Exchange</div>
                <p style={{fontSize:13,color:"rgba(255,255,255,.6)",lineHeight:1.7,margin:0}}>
                  {"This item is currently on loan from "+( org?.name||"another program")+". " +
                   "You can manage this loan through the Backstage Exchange in your Theatre4u account."}
                </p>
              </div>
              <a href={"https://theatre4u.org?signin=1&next="+encodeURIComponent("#/item/"+itemId)}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,#c4922a,#8b6914)",color:"#1a0f00",padding:"12px 16px",borderRadius:8,textDecoration:"none",fontSize:14,fontWeight:700}}>
                🎭 Open in Theatre4u →
              </a>
            </div>
          )}

          {/* ── GUEST ACCESS (Theatre4u member, not the owner, not borrowing) ─ */}
          {item && access === "guest" && (
            <div>
              {org && <OwnerBadge/>}
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:20,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  {cat && <div style={{width:36,height:36,borderRadius:7,background:cat.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat.icon}</div>}
                  <div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20}}>{item.name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{cat?.label} · {item.condition}</div>
                  </div>
                </div>
                {prefix && item.display_id && (
                  <div style={{fontFamily:"monospace",fontSize:12,color:"var(--gold)",letterSpacing:1,marginBottom:8}}>
                    {prefix+"-"+((item.display_id||"").replace(/[^0-9]/g,"").padStart(4,"0"))}
                  </div>
                )}
              </div>
              {mkt !== "Not Listed" && (
                <div style={{background:"rgba(76,175,80,.08)",border:"1px solid rgba(76,175,80,.2)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>🏪 Available on Backstage Exchange</div>
                  <p style={{fontSize:13,color:"rgba(255,255,255,.65)",lineHeight:1.7,margin:"0 0 12px"}}>
                    {"This item is listed for "+mkt.toLowerCase()+" on the Backstage Exchange. " +
                     "Sign in to Theatre4u to request it for your program."}
                  </p>
                  <div style={{fontWeight:700,color:"var(--gold)",fontSize:16,marginBottom:10}}>
                    {rentalPrice>0 ? ("$"+Number(rentalPrice).toFixed(2)+"/wk") : ""}
                    {rentalPrice>0&&salePrice>0 ? " · " : ""}
                    {salePrice>0 ? ("$"+Number(salePrice).toFixed(2)) : ""}
                  </div>
                  <a href={"https://theatre4u.org?signin=1&next="+encodeURIComponent("#/item/"+itemId)}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,#c4922a,#8b6914)",color:"#1a0f00",padding:"10px 16px",borderRadius:8,textDecoration:"none",fontSize:13,fontWeight:700}}>
                    Request via Backstage Exchange →
                  </a>
                </div>
              )}
              {mkt === "Not Listed" && (
                <div style={{background:"rgba(212,168,67,.06)",border:"1px solid rgba(212,168,67,.2)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>💬 Not Currently Listed</div>
                  <p style={{fontSize:13,color:"rgba(255,255,255,.6)",lineHeight:1.7,margin:"0 0 12px"}}>
                    {"This item isn't listed on the Backstage Exchange right now, but you can reach out to "+( org?.name||"this program")+" directly to ask about borrowing or purchasing it."}
                  </p>
                  {contact?.email && (
                    <a href={"mailto:"+contact.email+"?subject=Item Inquiry: "+encodeURIComponent(item.name||"")+"&body=Hi, I scanned a Theatre4u QR code for '"+encodeURIComponent(item.name||"")+"' and am interested in borrowing it for our program. Could we discuss this through the Backstage Exchange?"}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",padding:"10px 16px",borderRadius:8,textDecoration:"none",fontSize:13,fontWeight:600}}>
                      ✉️ Contact {org?.name||"this program"}
                    </a>
                  )}
                </div>
              )}
              <a href={"https://theatre4u.org?signin=1&next="+encodeURIComponent("#/item/"+itemId)}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,#1a3a2a,#0d2419)",border:"1px solid rgba(76,175,80,.3)",color:"rgba(255,255,255,.8)",padding:"10px 16px",borderRadius:8,textDecoration:"none",fontSize:13,fontWeight:600,marginTop:8}}>
                🎭 Open in Theatre4u
              </a>
            </div>
          )}

          {/* ── CONTACT ONLY (private inventory, not a Theatre4u member) ────── */}
          {item && access === "contact" && (
            <div>
              {org && <OwnerBadge/>}
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:20,marginBottom:14}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:4}}>Item Scanned</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:4}}>{item.name}</div>
                {item.display_id && <div style={{fontSize:12,color:"var(--gold)",fontWeight:700}}>{item.display_id}</div>}
              </div>
              <div style={{background:"rgba(212,168,67,.06)",border:"1px solid rgba(212,168,67,.2)",borderRadius:12,padding:20,marginBottom:14}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"var(--gold)",marginBottom:10}}>🔒 Private Inventory</div>
                <p style={{fontSize:13.5,color:"rgba(255,255,255,.65)",lineHeight:1.7,margin:0}}>
                  This item belongs to a private Theatre4u inventory. To view full details, sign in to Theatre4u or contact the program directly.
                </p>
              </div>
              {contact && Object.keys(contact).length > 0 && (
                <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:20,marginBottom:14}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:10}}>Program Contact</div>
                  {contact.name     && <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{contact.name}</div>}
                  {contact.location && <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:8}}>📍 {contact.location}</div>}
                  {contact.bio      && <div style={{fontSize:13,color:"rgba(255,255,255,.55)",lineHeight:1.6,marginBottom:10}}>{contact.bio}</div>}
                  {contact.email && (
                    <a href={"mailto:"+contact.email+"?subject=Item Inquiry: "+encodeURIComponent(item.name||"")+"&body=Hi, I scanned a Theatre4u QR code for '"+encodeURIComponent(item.name||"")+"' and would like to learn more or request access."}
                      style={{display:"flex",alignItems:"center",gap:8,background:"var(--gold)",color:"#1a0f00",padding:"10px 16px",borderRadius:8,textDecoration:"none",fontWeight:700,fontSize:14,marginBottom:8}}>
                      ✉️ Email to Request Access
                    </a>
                  )}
                  {contact.phone && (
                    <a href={"tel:"+contact.phone} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",padding:"10px 16px",borderRadius:8,textDecoration:"none",fontWeight:600,fontSize:14}}>
                      📞 {contact.phone}
                    </a>
                  )}
                </div>
              )}
              <a href={"https://theatre4u.org?signin=1&next="+encodeURIComponent("#/item/"+itemId)}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,#c4922a,#8b6914)",color:"#1a0f00",padding:"12px 16px",borderRadius:8,textDecoration:"none",fontSize:14,fontWeight:700}}>
                🎭 Sign In to Theatre4u
              </a>
            </div>
          )}

        </div>
      </div>
    </>
  );
}


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
function AIHelpBubble({ user }) {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const EDGE_URL = "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/ai-help";

  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 120);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    setMsgs(p => [...p, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { data: { session } } = await SB.auth.getSession();
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": "Bearer " + session.access_token } : {}),
        },
        body: JSON.stringify({ messages: [...msgs, userMsg] }),
      });
      const json = await res.json();
      const reply = json.reply || "Sorry, I had trouble with that. Try emailing hello@theatre4u.org.";
      setMsgs(p => [...p, { role: "assistant", content: reply }]);
      if (!open) setUnread(true);
    } catch {
      setMsgs(p => [...p, { role: "assistant", content: "Connection error. Please check your internet and try again, or email hello@theatre4u.org." }]);
    }
    setLoading(false);
  };

  const bubbleStyle = {
    position: "fixed", bottom: 24, right: 24, zIndex: 9000,
    display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
    fontFamily: "'DM Sans', sans-serif",
  };
  const panelStyle = {
    width: 340, maxWidth: "calc(100vw - 32px)",
    height: 440, maxHeight: "calc(100vh - 120px)",
    background: "var(--bg2)", border: "1px solid var(--bd)",
    borderRadius: 16, display: "flex", flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,.5)",
    overflow: "hidden", animation: "su .2s ease",
  };

  return (
    <div style={bubbleStyle}>
      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#d4a843,#a37f2c)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 20 }}>🎭</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a0f00" }}>Theatre4u Help</div>
                <div style={{ fontSize: 11, color: "rgba(26,15,0,.65)" }}>Powered by Claude AI</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "rgba(0,0,0,.15)", border: "none", borderRadius: 6, color: "#1a0f00", cursor: "pointer", padding: "4px 8px", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 12px" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>👋</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, marginBottom: 6, color: "var(--t1)" }}>Hi! How can I help?</div>
                <div style={{ fontSize: 12.5, color: "var(--t3)", lineHeight: 1.6 }}>Ask me anything about Theatre4u — inventory, QR codes, Exchange, team sharing, and more.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {["How do QR codes work?", "How do I invite my crew?", "What's in the Pro plan?", "How do I export my inventory?"].map(q => (
                    <button key={q} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 20, padding: "5px 11px", fontSize: 11.5, color: "var(--t2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all .15s" }}
                      onMouseEnter={e => e.target.style.borderColor = "var(--gold)"}
                      onMouseLeave={e => e.target.style.borderColor = "var(--bd)"}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", padding: "9px 12px", borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                  background: m.role === "user" ? "linear-gradient(135deg,#d4a843,#a37f2c)" : "var(--bg3)",
                  color: m.role === "user" ? "#1a0f00" : "var(--t1)",
                  fontSize: 13, lineHeight: 1.55, border: m.role === "user" ? "none" : "1px solid var(--bd)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 5, padding: "8px 12px" }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gold)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.6 }}/>)}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bd)", flexShrink: 0, display: "flex", gap: 8, alignItems: "center", background: "var(--bg2)" }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ask anything…"
              style={{ flex: 1, background: "var(--bgi)", border: "1px solid var(--bd)", borderRadius: 8, padding: "8px 11px", color: "var(--t1)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
              onFocus={e => e.target.style.borderColor = "var(--gold)"}
              onBlur={e => e.target.style.borderColor = "var(--bd)"}
            />
            <button onClick={send} disabled={!input.trim() || loading}
              style={{ background: "linear-gradient(135deg,#d4a843,#a37f2c)", border: "none", borderRadius: 8, padding: "8px 13px", cursor: input.trim() && !loading ? "pointer" : "not-allowed", opacity: input.trim() && !loading ? 1 : 0.5, fontSize: 16, display: "flex", alignItems: "center" }}>
              ➤
            </button>
          </div>
        </div>
      )}
      {/* Floating button */}
      <button onClick={() => setOpen(p => !p)}
        style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#d4a843,#a37f2c)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 20px rgba(212,168,67,.45)", transition: "all .2s", position: "relative" }}
        title="Get help"
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        {open ? "×" : "?"}
        {unread && !open && <span style={{ position: "absolute", top: 2, right: 2, width: 12, height: 12, background: "#c2185b", borderRadius: "50%", border: "2px solid var(--bg)" }}/>}
      </button>
    </div>
  );
}


// PREVIEW MODE -- guest exploration before sign-up
// Accessed via theatre4u.org?preview=1 or the "Take a Tour" button
// Shows sample inventory, demo UI, and a persistent sign-up prompt
const PREVIEW_ITEMS = [
  { id:"p1",  name:"Victorian Ball Gown — Blue",      category:"costumes",  condition:"Good",      size:"M",       qty:1,  location:"Costume Closet A",  notes:"Used in A Christmas Carol 2024", mkt:"For Rent",    avail:"In Stock", sale:0,  rent:25, tags:["period","formal"] },
  { id:"p2",  name:"Pirate Hat Collection (6pc)",     category:"costumes",  condition:"Fair",      size:"One Size",qty:6,  location:"Costume Closet B",  notes:"Assorted styles",               mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0,  tags:["adventure"] },
  { id:"p3",  name:"Wireless Handheld Mic — Shure",  category:"sound",     condition:"Excellent", size:"N/A",     qty:4,  location:"Sound Booth",       notes:"SM58 compatible, 4 channels",   mkt:"For Rent",    avail:"In Stock", sale:0,  rent:15, tags:["audio"] },
  { id:"p4",  name:"LED Par Can RGBW 54x3W",          category:"lighting",  condition:"New",       size:"N/A",     qty:12, location:"Lighting Storage",  notes:"DMX controllable",              mkt:"Rent or Sale",avail:"In Stock", sale:85, rent:10, tags:["dmx","led"] },
  { id:"p5",  name:"Wooden Throne Chair",             category:"furniture", condition:"Good",      size:"N/A",     qty:1,  location:"Scene Shop",        notes:"Gold painted, red velvet",      mkt:"For Rent",    avail:"In Stock", sale:0,  rent:30, tags:["royalty"] },
  { id:"p6",  name:"Fog Machine 1000W",              category:"effects",   condition:"Good",      size:"N/A",     qty:2,  location:"Effects Cage",      notes:"Includes remote",               mkt:"For Rent",    avail:"In Stock", sale:0,  rent:20, tags:["atmosphere"] },
  { id:"p7",  name:"Romeo and Juliet Scripts (30)",   category:"scripts",   condition:"Fair",      size:"N/A",     qty:30, location:"Library",           notes:"Director annotated",            mkt:"For Sale",    avail:"In Stock", sale:5,  rent:0,  tags:["shakespeare"] },
  { id:"p8",  name:"Ben Nye Master Makeup Kit",       category:"makeup",    condition:"Good",      size:"N/A",     qty:3,  location:"Dressing Room 1",   notes:"Full spectrum",                 mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0,  tags:["professional"] },
  { id:"p9",  name:"Forest Backdrop Flat 8x12ft",     category:"sets",      condition:"Good",      size:"N/A",     qty:2,  location:"Scene Shop",        notes:"Painted muslin on frame",       mkt:"For Rent",    avail:"In Stock", sale:0,  rent:40, tags:["outdoor"] },
  { id:"p10", name:"DeWalt Cordless Drill 20V",       category:"tools",     condition:"Good",      size:"N/A",     qty:2,  location:"Tool Cabinet",      notes:"With charger and bits",         mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0,  tags:["power tool"] },
  { id:"p11", name:"Foam Rubber Swords (8pc)",        category:"props",     condition:"Fair",      size:"N/A",     qty:8,  location:"Props Table",       notes:"Safe for stage combat",         mkt:"For Sale",    avail:"In Stock", sale:12, rent:0,  tags:["combat"] },
  { id:"p12", name:"Black Velvet Main Drape 20x40",   category:"fabrics",   condition:"Excellent", size:"N/A",     qty:1,  location:"Fly Loft",          notes:"Flame retardant",               mkt:"Not Listed",  avail:"In Use",   sale:0,  rent:0,  tags:["main stage"] },
];

const PREVIEW_CATS = {
  costumes:"🥻",props:"🎭",sets:"🏗️",lighting:"💡",sound:"🔊",
  scripts:"📜",makeup:"💄",furniture:"🪑",fabrics:"🧵",tools:"🔧",effects:"✨",other:"📦"
};

function PreviewMode({ onSignUp }) {
  const [tab,     setTab]     = React.useState("inventory");
  const [search,  setSearch]  = React.useState("");
  const [catF,    setCatF]    = React.useState("all");
  const [detail,  setDetail]  = React.useState(null);
  const [showCTA, setShowCTA] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setShowCTA(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const filtered = PREVIEW_ITEMS.filter(i => {
    if (catF !== "all" && i.category !== catF) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())
        && !i.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalItems = PREVIEW_ITEMS.length;
  const listed     = PREVIEW_ITEMS.filter(i => i.mkt !== "Not Listed").length;
  const totalQty   = PREVIEW_ITEMS.reduce((s, i) => s + i.qty, 0);
  const estValue   = PREVIEW_ITEMS.reduce((s, i) => s + (i.sale * i.qty), 0);

  const gold = "#d4a843", dark = "#1a0f00", bg = "#0d0b11", bg2 = "#15121b";
  const bd = "#282333", t1 = "#ede8df", t2 = "#9b93a8", t3 = "#685f76";

  const navs = [
    { id:"dashboard",  label:"Dashboard",         icon:"⌂" },
    { id:"inventory",  label:"Inventory",          icon:"📦" },
    { id:"marketplace",label:"Backstage Exchange", icon:"🏪" },
    { id:"reports",    label:"Reports",            icon:"📊" },
    { id:"funding",    label:"Funding Tracker",    icon:"💰" },
  ];

  const GoldBtn = ({ label, onClick, style = {} }) => (
    <button onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
      padding:"9px 20px", borderRadius:8, fontFamily:"'DM Sans',sans-serif",
      fontSize:14, fontWeight:700, cursor:"pointer", border:"none",
      background:`linear-gradient(135deg,${gold},#a37f2c)`, color:dark,
      transition:"all .2s", ...style
    }}>{label}</button>
  );

  const mktColor = (mkt) =>
    mkt === "Not Listed" ? "rgba(107,100,120,.5)"
    : mkt.includes("Rent") ? "rgba(66,165,245,.8)"
    : "rgba(76,175,80,.8)";

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden",
      background:bg, color:t1, fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>

      {/* Preview banner */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:9999,
        background:"linear-gradient(135deg,rgba(212,168,67,.97),rgba(163,127,44,.97))",
        padding:"9px 20px", display:"flex", alignItems:"center",
        justifyContent:"space-between", gap:12, flexWrap:"wrap",
        boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>🎭</span>
          <span style={{ fontWeight:800, color:dark, fontSize:14 }}>Preview Mode</span>
          <span style={{ color:"rgba(26,15,0,.65)", fontSize:12 }}>
            — Explore Theatre4u with sample data. No account needed.
          </span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => window.location.href = "https://theatre4u.org"}
            style={{ padding:"6px 14px", borderRadius:6, fontFamily:"'DM Sans',sans-serif",
              fontSize:12, fontWeight:600, cursor:"pointer",
              background:"rgba(0,0,0,.15)", border:"1px solid rgba(0,0,0,.2)", color:dark }}>
            Sign In
          </button>
          <GoldBtn label="Start Free Account →" onClick={onSignUp}
            style={{ padding:"6px 18px", fontSize:13 }}/>
        </div>
      </div>

      {/* Sidebar */}
      <aside style={{ width:224, minWidth:224, background:bg2,
        borderRight:`1px solid ${bd}`, display:"flex", flexDirection:"column",
        paddingTop:48, overflowY:"auto", zIndex:100 }}>
        <div style={{ padding:"18px 14px", borderBottom:`1px solid ${bd}`,
          display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:8, fontSize:20,
            background:`linear-gradient(135deg,${gold},#a37f2c)`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>🎭</div>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16,
              fontWeight:700, color:gold }}>{APP_NAME}</div>
            <div style={{ fontSize:9, color:t3, textTransform:"uppercase", letterSpacing:2 }}>
              Ocean View Drama
            </div>
          </div>
        </div>

        <nav style={{ padding:"12px 8px", flex:1 }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:2,
            color:t3, padding:"8px 10px 4px" }}>Main</div>
          {navs.map(n => (
            <div key={n.id} onClick={() => setTab(n.id)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
                borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:500, marginBottom:1,
                color: tab === n.id ? gold : t2,
                background: tab === n.id
                  ? "linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04))"
                  : "transparent",
                border: `1px solid ${tab === n.id ? "rgba(212,168,67,.2)" : "transparent"}` }}>
              <span style={{ fontSize:15 }}>{n.icon}</span>
              {n.label}
              {n.id === "inventory" && (
                <span style={{ marginLeft:"auto", background:bg, padding:"1px 6px",
                  borderRadius:9, fontSize:10, color:t3 }}>{totalItems}</span>
              )}
            </div>
          ))}
        </nav>

        <div style={{ padding:12, borderTop:`1px solid ${bd}` }}>
          <div style={{ background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)",
            borderRadius:10, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:gold, marginBottom:4 }}>
              🎟 Join for Free
            </div>
            <div style={{ fontSize:11, color:t2, lineHeight:1.5, marginBottom:8 }}>
              Create your program's inventory, earn Stage Points, and share with nearby schools.
            </div>
            <GoldBtn label="Start Free →" onClick={onSignUp}
              style={{ width:"100%", fontSize:12, padding:"8px 12px" }}/>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, display:"flex", flexDirection:"column",
        overflow:"hidden", paddingTop:42 }}>
        <div style={{ padding:"12px 24px", borderBottom:`1px solid ${bd}`,
          background:bg2, display:"flex", alignItems:"center", gap:12 }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700 }}>
            {navs.find(n => n.id === tab)?.label}
          </h1>
          <span style={{ marginLeft:"auto", fontSize:11, color:gold, fontWeight:600,
            background:"rgba(212,168,67,.1)", border:"1px solid rgba(212,168,67,.2)",
            padding:"3px 10px", borderRadius:12 }}>
            👁 Preview — sample data only
          </span>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>
                Welcome to Ocean View Drama
              </h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>
                Your theatre inventory at a glance. (Sample data)
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",
                gap:12, marginBottom:20 }}>
                {[
                  { icon:"📦", label:"Cataloged Items",  val:totalItems },
                  { icon:"🔢", label:"Total Quantity",    val:totalQty },
                  { icon:"🏪", label:"Listed / Shared",   val:listed },
                  { icon:"💰", label:"Est. Sale Value",   val:"$"+estValue.toLocaleString() },
                ].map(s => (
                  <div key={s.label} style={{ background:bg2, border:`1px solid ${bd}`,
                    borderRadius:10, padding:16, textAlign:"center" }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22,
                      fontWeight:700, color:gold }}>{s.val}</div>
                    <div style={{ fontSize:11, color:t3, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16, marginBottom:20 }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:16, marginBottom:12 }}>
                  What Theatre4u™ Does
                </h3>
                {[
                  ["📦","Inventory Management","Catalog every costume, prop, light, and piece of gear with photos, QR labels, and condition tracking."],
                  ["🔲","QR Code Labels","Print scannable labels for any item. Any phone camera looks it up instantly."],
                  ["🏪","Backstage Exchange","Share items with other theatre programs near you — rent, loan, or sell gear to your neighbours."],
                  ["🪙","Stage Points","Earn points for cataloging and sharing inventory. Redeem for free months or Exchange discounts."],
                  ["💰","Funding Tracker","Track grants, Prop 28 funds, and spending. Generate accountability reports for principals and boards."],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ display:"flex", gap:12, padding:"10px 0",
                    borderBottom:`1px solid rgba(255,255,255,.05)` }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{title}</div>
                      <div style={{ fontSize:12, color:t2, lineHeight:1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <GoldBtn label="🎟 Create Your Free Account →" onClick={onSignUp}
                  style={{ fontSize:15, padding:"12px 32px" }}/>
                <div style={{ fontSize:12, color:t3, marginTop:8 }}>
                  No credit card required · Free forever for basic use
                </div>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div>
              <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ position:"relative" }}>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search items…"
                    style={{ background:"#110f18", border:`1px solid ${bd}`, borderRadius:8,
                      padding:"7px 10px 7px 32px", color:t1, fontSize:13, width:220, outline:"none" }}/>
                  <span style={{ position:"absolute", left:10, top:"50%",
                    transform:"translateY(-50%)", fontSize:14, color:t3 }}>🔍</span>
                </div>
                <select value={catF} onChange={e => setCatF(e.target.value)}
                  style={{ background:"#110f18", border:`1px solid ${bd}`, borderRadius:8,
                    padding:"7px 10px", color:t1, fontSize:13, outline:"none" }}>
                  <option value="all">All Categories</option>
                  {Object.keys(PREVIEW_CATS).map(c => (
                    <option key={c} value={c}>
                      {PREVIEW_CATS[c]} {c[0].toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize:12, color:t3 }}>{filtered.length} items</span>
                <button onClick={() => setShowCTA(true)}
                  style={{ marginLeft:"auto", padding:"7px 14px", borderRadius:8,
                    fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700,
                    cursor:"pointer", background:"rgba(212,168,67,.12)",
                    border:"1px solid rgba(212,168,67,.25)", color:gold }}>
                  + Add Item (sign up first)
                </button>
              </div>

              <div style={{ display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
                {filtered.map(item => (
                  <div key={item.id} onClick={() => setDetail(item)}
                    style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10,
                      padding:14, cursor:"pointer", transition:"border-color .2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(212,168,67,.4)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = bd}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
                      <div style={{ fontSize:24, flexShrink:0 }}>{PREVIEW_CATS[item.category] || "📦"}</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, lineHeight:1.3 }}>{item.name}</div>
                        <div style={{ fontSize:11, color:t3, marginTop:2 }}>{item.location}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                      {[item.condition, `x${item.qty}`, item.avail].map(tag => (
                        <span key={tag} style={{ fontSize:10, padding:"2px 7px",
                          background:"rgba(255,255,255,.05)", borderRadius:4, color:t2 }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background: mktColor(item.mkt) + "22", color: mktColor(item.mkt) }}>
                        {item.mkt}
                      </span>
                      {(item.rent > 0 || item.sale > 0) && (
                        <span style={{ fontSize:12, fontWeight:700, color:gold }}>
                          {item.rent > 0 ? `$${item.rent}/wk` : ""}
                          {item.rent > 0 && item.sale > 0 ? " · " : ""}
                          {item.sale > 0 ? `$${item.sale}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {detail && (
                <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)",
                  zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
                  onClick={e => e.target === e.currentTarget && setDetail(null)}>
                  <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:14,
                    width:"100%", maxWidth:520, padding:24, boxShadow:"0 8px 48px rgba(0,0,0,.5)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"flex-start", marginBottom:16 }}>
                      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                        <div style={{ fontSize:32 }}>{PREVIEW_CATS[detail.category] || "📦"}</div>
                        <div>
                          <div style={{ fontFamily:"'Playfair Display',serif",
                            fontSize:18, fontWeight:700 }}>{detail.name}</div>
                          <div style={{ fontSize:12, color:t3, marginTop:2 }}>
                            {detail.category} · {detail.condition}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setDetail(null)}
                        style={{ background:"none", border:`1px solid ${bd}`, color:t2,
                          borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:16,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                    </div>
                    {[
                      ["Location",      detail.location || "—"],
                      ["Quantity",      detail.qty],
                      ["Availability",  detail.avail],
                      ["Market Status", detail.mkt],
                      ...(detail.rent > 0 ? [["Rental Price", `$${detail.rent}/week`]] : []),
                      ...(detail.sale > 0 ? [["Sale Price",   `$${detail.sale}`]]      : []),
                      ...(detail.notes    ? [["Notes",        detail.notes]]            : []),
                    ].map(([l, v]) => (
                      <div key={l} style={{ display:"flex", padding:"7px 0",
                        borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                        <span style={{ width:130, color:t3, fontSize:12, flexShrink:0 }}>{l}</span>
                        <span style={{ fontSize:13 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop:16, padding:12, background:"rgba(212,168,67,.06)",
                      border:"1px solid rgba(212,168,67,.15)", borderRadius:9, textAlign:"center" }}>
                      <div style={{ fontSize:12, color:t2, marginBottom:8 }}>
                        Sign up to manage your own inventory, add photos, and print QR labels.
                      </div>
                      <GoldBtn label="🎟 Start Free Account →" onClick={onSignUp}
                        style={{ width:"100%" }}/>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OTHER TABS — teaser */}
          {(tab === "marketplace" || tab === "reports" || tab === "funding") && (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ fontSize:56, marginBottom:16 }}>
                {tab === "marketplace" ? "🏪" : tab === "reports" ? "📊" : "💰"}
              </div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26,
                fontWeight:700, marginBottom:10 }}>
                {tab === "marketplace" ? "Backstage Exchange"
                  : tab === "reports"    ? "Reports & Analytics"
                  : "Funding Tracker"}
              </div>
              <div style={{ color:t2, fontSize:14, maxWidth:480, margin:"0 auto 28px", lineHeight:1.8 }}>
                {tab === "marketplace" && "Browse and request items from theatre programs near you — or list your own inventory to share with the community. Free loans between district schools, rentals, and sales."}
                {tab === "reports"    && "Category breakdowns, condition reports, platform utilization reports for principals, and CSV export. The Platform Usage Report is designed to hand to an administrator showing how Theatre4u protects program assets."}
                {tab === "funding"    && "Track grants, Prop 28 funds, and all program spending. Generate accountability reports for principals, arts directors, and boards — formatted and print-ready in one click."}
              </div>
              <GoldBtn label="🎟 Create Free Account to Access →" onClick={onSignUp}
                style={{ fontSize:14, padding:"12px 32px" }}/>
              <div style={{ fontSize:12, color:t3, marginTop:10 }}>
                Full platform access · No credit card required
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Floating CTA (appears after 20s) */}
      {showCTA && (
        <div style={{ position:"fixed", bottom:20, right:20, zIndex:9998,
          background:bg2, border:"1px solid rgba(212,168,67,.4)", borderRadius:14,
          padding:"16px 18px", maxWidth:280, boxShadow:"0 8px 32px rgba(0,0,0,.5)" }}>
          <button onClick={() => setShowCTA(false)}
            style={{ position:"absolute", top:8, right:10, background:"none",
              border:"none", color:t3, cursor:"pointer", fontSize:16 }}>×</button>
          <div style={{ fontSize:24, marginBottom:8 }}>🎟</div>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:4, color:t1 }}>
            Ready to try it for your program?
          </div>
          <div style={{ fontSize:12, color:t2, lineHeight:1.5, marginBottom:12 }}>
            Free to start. No credit card. Your inventory, QR labels, and Backstage Exchange access in under 5 minutes.
          </div>
          <GoldBtn label="Start Free Account →" onClick={onSignUp}
            style={{ width:"100%", fontSize:13 }}/>
        </div>
      )}
    </div>
  );
}

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
const LABEL_PACKS = [
  { qty:25,  type:"standard",    label:"25 Standard",     retail:1000, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:50,  type:"standard",    label:"50 Standard",     retail:1500, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:100, type:"standard",    label:"100 Standard",    retail:2300, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:200, type:"standard",    label:"200 Standard",    retail:3900, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:25,  type:"weatherproof",label:"25 Weatherproof", retail:1400, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
  { qty:50,  type:"weatherproof",label:"50 Weatherproof", retail:2100, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
  { qty:100, type:"weatherproof",label:"100 Weatherproof",retail:3600, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
  { qty:200, type:"weatherproof",label:"200 Weatherproof",retail:6500, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
];
const LOGO_ADDON_CENTS = 500; // $5 to include program logo on labels



// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DAILY DIGEST — standalone component used as first tab in AdminHub
// Time windows: 24h | 7d | 30d
// Sources: orgs, items, beta_leads, email_sequence, page_views (UTM),
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
const TRACK_URL = "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/track-visit";
function getSessionId() {
  let sid = sessionStorage.getItem("t4u_sid");
  if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("t4u_sid", sid); }
  return sid;
}
// Capture referral code from ?ref= param and persist it for signup
;(()=>{
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) sessionStorage.setItem("t4u_ref", ref.toUpperCase().trim());
  } catch(e) {}
})();
function trackVisit(page, extra = {}) {
  try {
    const params = new URLSearchParams(window.location.search);
    fetch(TRACK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page,
        session_id:   getSessionId(),
        referrer:     document.referrer || null,
        utm_source:   params.get("utm_source"),
        utm_medium:   params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
        ref_code:     getRefCode(),
        ...extra
      })
    }).catch(() => {});
  } catch(e) {}
}

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
      const memberList = memberRows || [];
      setMemberships(memberList);

      // Pick the active membership: a saved preference if still valid, else the first.
      // Users with 0 memberships use their own org (unchanged behavior).
      // Users with exactly 1 membership use it (unchanged behavior).
      // Users with 2+ (multi-program directors) default to first; switcher can change it.
      let activeMembership = null;
      if (memberList.length > 0) {
        const savedId = (()=>{ try { return localStorage.getItem("t4u_active_program"); } catch(e){ return null; } })();
        activeMembership = memberList.find(m => m.org_id === savedId) || memberList[0];
      }
      const targetOrgId = activeMembership ? activeMembership.org_id : user.id;
      const memberRole  = activeMembership ? activeMembership.role : null;

      const{data:orgData}=await SB.from("orgs").select("*").eq("id",targetOrgId).single();
      // Admin emails always get District plan regardless of what is stored
      // temp_pro = true gives Pro access during beta (no payment required)
      const effectivePlan = isAdminEmail(user?.email) ? "district"
        : orgData?.temp_pro ? "pro"
        : (orgData?.plan || "free");
      if(orgData){
        setOrg({...orgData, _memberRole: memberRole, _isMember: !!activeMembership});
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
                  {page==="inventory"   && !activeSchool && <Inventory   items={items} onAdd={add} onEdit={edit} onDelete={del} userId={user?.id} plan={plan} memberRole={memberRole} org={org} enableLoans={!memberRole} deepLinkLocationId={deepLinkLocation} onDeepLinkConsumed={()=>setDeepLinkLocation(null)} deepLinkCategory={deepLinkCategory} onDeepLinkCategoryConsumed={()=>setDeepLinkCategory(null)}/>}
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
const FUND_TYPES = [
  {id:"grant",      label:"Grant",           icon:"🏛️"},
  {id:"allocation", label:"District Allocation", icon:"🏫"},
  {id:"earned",     label:"Earned Income",   icon:"🎟️"},
  {id:"donation",   label:"Donation",        icon:"🤝"},
  {id:"booster",    label:"Booster/PTA",     icon:"⭐"},
  {id:"other",      label:"Other",           icon:"📋"},
];
const FUND_CATS = ["Equipment","Instruments","Supplies","Instruction","Personnel","Travel","Production","Technology","Other"];

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


// ══════════════════════════════════════════════════════════════════════════════
// STORAGE LOCATIONS — manage named locations, browse items by location
// ══════════════════════════════════════════════════════════════════════════════
// ── Room Map sub-component ──────────────────────────────────────────────────
function RoomMap({ loc, items, userId, onUpdate }) {
  const [pins,        setPins]        = useState(loc.map_pins || []);
  const [adding,      setAdding]      = useState(false);
  const [pending,     setPending]     = useState(null);
  const [pinMode,     setPinMode]     = useState("link");   // "link" | "new"
  const [pinName,     setPinName]     = useState("");
  const [pinNotes,    setPinNotes]    = useState("");
  const [linkedLocId, setLinkedLocId] = useState("");
  const [allLocs,     setAllLocs]     = useState([]);
  const [locsLoaded,  setLocsLoaded]  = useState(false);
  const [selPin,      setSelPin]      = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef();

  // Load all named locations for this org when pin form opens
  useEffect(() => {
    if (!pending || locsLoaded) return;
    SB.from("storage_locations")
      .select("id,name,location_type,code")
      .eq("org_id", userId)
      .neq("id", loc.id)
      .order("name")
      .then(({ data }) => { setAllLocs(data || []); setLocsLoaded(true); });
  }, [pending]);

  const savePins = async (newPins) => {
    await SB.from("storage_locations").update({ map_pins: newPins }).eq("id", loc.id);
    setPins(newPins);
    onUpdate({ ...loc, map_pins: newPins });
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `${userId}/${loc.id}.${ext}`;
    const { error } = await SB.storage.from("room-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data: { publicUrl } } = SB.storage.from("room-photos").getPublicUrl(path);
      await SB.from("storage_locations").update({ map_photo_url: publicUrl }).eq("id", loc.id);
      onUpdate({ ...loc, map_photo_url: publicUrl });
    }
    setUploading(false);
  };

  const onMapClick = (e) => {
    if (!adding) return;
    if (e.target.closest(".pin-dot")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(2);
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(2);
    setPending({ x: parseFloat(x), y: parseFloat(y) });
    setPinName(""); setPinNotes(""); setLinkedLocId(""); setPinMode("link");
  };

  const savePin = async () => {
    const color = PIN_COLORS[pins.length % PIN_COLORS.length];
    let newPin;
    if (pinMode === "link" && linkedLocId) {
      const linked = allLocs.find(l => l.id === linkedLocId);
      if (!linked) return;
      newPin = { id: Date.now(), x: pending.x, y: pending.y, name: linked.name, notes: pinNotes.trim(), color, linked_location_id: linked.id };
    } else {
      if (!pinName.trim()) return;
      newPin = { id: Date.now(), x: pending.x, y: pending.y, name: pinName.trim(), notes: pinNotes.trim(), color };
    }
    const newPins = [...pins, newPin];
    await savePins(newPins);
    setPending(null); setAdding(false);
  };

  const deletePin = async (id) => {
    const newPins = pins.filter(p => p.id !== id);
    await savePins(newPins);
    setSelPin(null);
  };

  // Get item count for a pin — use linked location if set, otherwise fall back to room location
  const getPinItemCount = (pin) => {
    if (pin.linked_location_id) {
      return items.filter(it => it.location_id === pin.linked_location_id).length;
    }
    return items.filter(it => it.location_id === loc.id && it.pin_id === pin.id).length;
  };

  const canSave = pinMode === "link" ? !!linkedLocId : !!pinName.trim();
  const photoUrl = loc.map_photo_url;
  const inp = { background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"8px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };
  const typeIcon = (t) => t==="room"?"🗺️":t==="rack"?"🏗️":"📦";

  // Locations not yet placed on this map
  const unplacedLocs = allLocs.filter(l => !pins.find(p => p.linked_location_id === l.id));

  return (
    <div>
      {!photoUrl ? (
        <div style={{ border:"2px dashed var(--border)",borderRadius:10,padding:32,textAlign:"center",cursor:"pointer",background:"var(--parch)" }} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize:32,marginBottom:8 }}>📷</div>
          <div style={{ fontWeight:700,fontSize:14,marginBottom:4 }}>Upload a photo of this room</div>
          <div style={{ fontSize:12,color:"var(--muted)",marginBottom:12 }}>Take a photo on your phone and upload it here</div>
          {uploading ? <div style={{ color:"var(--muted)",fontSize:13 }}>Uploading…</div> : <button className="btn btn-o" onClick={e=>{e.stopPropagation();fileRef.current?.click();}}>Choose Photo</button>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>uploadPhoto(e.target.files[0])} />
        </div>
      ) : (
        <div>
          <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap" }}>
            <button className={`btn ${adding?"btn-g":"btn-o"}`} style={{ fontSize:12 }} onClick={() => { setAdding(!adding); setPending(null); }}>
              {adding ? "✕ Cancel" : "📍 Add Pin"}
            </button>
            <button className="btn btn-o" style={{ fontSize:12 }} onClick={() => fileRef.current?.click()}>🔄 Change Photo</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>uploadPhoto(e.target.files[0])} />
            {adding && <span style={{ fontSize:12,color:"var(--muted)",fontStyle:"italic" }}>Tap anywhere on the photo to drop a pin</span>}
          </div>

          <div style={{ position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)",cursor:adding?"crosshair":"default" }} onClick={onMapClick}>
            <img src={photoUrl} style={{ width:"100%",display:"block",userSelect:"none" }} draggable={false} />
            {pins.map((pin, i) => (
              <div key={pin.id} className="pin-dot" style={{ position:"absolute",left:`${pin.x}%`,top:`${pin.y}%`,transform:"translate(-50%,-100%)",cursor:"pointer",zIndex:10 }} onClick={e=>{ e.stopPropagation(); setSelPin(selPin?.id===pin.id?null:pin); }}>
                <div style={{ background:pin.color,borderRadius:"50% 50% 50% 0",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",transform:"rotate(-45deg)",border:"2px solid rgba(0,0,0,0.2)" }}>
                  <span style={{ transform:"rotate(45deg)",color:"#fff",fontSize:11,fontWeight:700 }}>{i+1}</span>
                </div>
                {selPin?.id===pin.id && (
                  <div style={{ position:"absolute",bottom:34,left:"50%",transform:"translateX(-50%)",background:"var(--dark2)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",minWidth:180,zIndex:20,whiteSpace:"nowrap" }}>
                    <div style={{ fontWeight:700,fontSize:13,color:"var(--gold)",marginBottom:2 }}>{pin.name}</div>
                    {pin.linked_location_id && <div style={{ fontSize:10,color:"var(--muted)",marginBottom:4 }}>🔗 Linked location</div>}
                    {pin.notes && <div style={{ fontSize:11,color:"var(--muted)",marginBottom:6 }}>{pin.notes}</div>}
                    <div style={{ fontSize:11,color:"var(--muted)",marginBottom:6 }}>{getPinItemCount(pin)} items stored here</div>
                    <button onClick={()=>deletePin(pin.id)} style={{ fontSize:11,color:"var(--red)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0 }}>Remove pin</button>
                  </div>
                )}
              </div>
            ))}
            {pending && (
              <div style={{ position:"absolute",left:`${pending.x}%`,top:`${pending.y}%`,transform:"translate(-50%,-100%)",pointerEvents:"none" }}>
                <div style={{ background:"var(--gold)",borderRadius:"50% 50% 50% 0",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",transform:"rotate(-45deg)",border:"2px solid rgba(0,0,0,0.3)" }}>
                  <span style={{ transform:"rotate(45deg)",color:"#1a0f00",fontSize:13 }}>?</span>
                </div>
              </div>
            )}
          </div>

          {pending && (
            <div style={{ marginTop:12,padding:14,background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10 }}>
              <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Place a pin here</div>

              {/* Mode toggle */}
              <div style={{ display:"flex",gap:6,marginBottom:14 }}>
                <button onClick={()=>setPinMode("link")} style={{ flex:1,padding:"7px 0",fontSize:12,borderRadius:7,border:pinMode==="link"?"1.5px solid var(--gold)":"1px solid var(--border)",background:pinMode==="link"?"rgba(212,168,67,.1)":"var(--white)",color:pinMode==="link"?"var(--amber)":"var(--muted)",cursor:"pointer",fontFamily:"inherit",fontWeight:pinMode==="link"?700:400 }}>
                  🔗 Link existing location
                </button>
                <button onClick={()=>setPinMode("new")} style={{ flex:1,padding:"7px 0",fontSize:12,borderRadius:7,border:pinMode==="new"?"1.5px solid var(--gold)":"1px solid var(--border)",background:pinMode==="new"?"rgba(212,168,67,.1)":"var(--white)",color:pinMode==="new"?"var(--amber)":"var(--muted)",cursor:"pointer",fontFamily:"inherit",fontWeight:pinMode==="new"?700:400 }}>
                  ✏️ Create new pin
                </button>
              </div>

              {pinMode === "link" ? (
                <div>
                  <div style={{ fontSize:12,color:"var(--muted)",marginBottom:8 }}>Choose an existing location to place on this map:</div>
                  {!locsLoaded ? (
                    <div style={{ fontSize:12,color:"var(--muted)",padding:"8px 0" }}>Loading locations…</div>
                  ) : unplacedLocs.length === 0 ? (
                    <div style={{ fontSize:12,color:"var(--muted)",padding:"8px 0",fontStyle:"italic" }}>All your locations are already on this map. Use "Create new pin" to add a new one.</div>
                  ) : (
                    <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto" }}>
                      {unplacedLocs.map(l => (
                        <div key={l.id} onClick={() => setLinkedLocId(linkedLocId===l.id?"":l.id)}
                          style={{ padding:"8px 10px",border:linkedLocId===l.id?"1.5px solid var(--gold)":"1px solid var(--border)",borderRadius:8,cursor:"pointer",background:linkedLocId===l.id?"rgba(212,168,67,.1)":"var(--white)",display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:16 }}>{typeIcon(l.location_type)}</span>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:700,fontSize:13,color:linkedLocId===l.id?"var(--amber)":"var(--text)" }}>{l.name}</div>
                            {l.code && <div style={{ fontSize:11,fontFamily:"monospace",color:"var(--muted)" }}>{l.code}</div>}
                          </div>
                          {linkedLocId===l.id && <span style={{ fontSize:16 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input style={{ ...inp,marginBottom:8 }} value={pinName} onChange={e=>setPinName(e.target.value)} placeholder="e.g. Red Costume Tubs, Prop Shelf B" autoFocus onKeyDown={e=>e.key==="Enter"&&savePin()} />
                </div>
              )}

              <textarea style={{ ...inp,minHeight:40,resize:"vertical",marginTop:10,marginBottom:10 }} value={pinNotes} onChange={e=>setPinNotes(e.target.value)} placeholder="Optional notes — row 3, left side, grey metal rack…" />

              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-g" style={{ flex:1 }} onClick={savePin} disabled={!canSave}>
                  {pinMode==="link" ? "Place Pin" : "Save Pin"}
                </button>
                <button className="btn btn-o" onClick={()=>{ setPending(null); setAdding(false); }}>Cancel</button>
              </div>
            </div>
          )}

          {pins.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:6 }}>Pinned locations</div>
              {pins.map((pin, i) => (
                <div key={pin.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"var(--parch)",border:"1px solid var(--border)",borderRadius:8,marginBottom:5,cursor:"pointer" }} onClick={()=>setSelPin(selPin?.id===pin.id?null:pin)}>
                  <div style={{ width:20,height:20,borderRadius:"50%",background:pin.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <span style={{ fontSize:10,fontWeight:700,color:"#fff" }}>{i+1}</span>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {pin.linked_location_id && <span style={{ fontSize:11,marginRight:4 }}>🔗</span>}
                      {pin.name}
                    </div>
                    <div style={{ fontSize:11,color:"var(--muted)" }}>{getPinItemCount(pin)} items</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Storage Rack sub-component ──────────────────────────────────────────────
function StorageRack({ loc, items, onUpdate }) {
  const [rows,     setRows]     = useState(loc.rack_rows     || 3);
  const [cols,     setCols]     = useState(loc.rack_cols     || 4);
  const [slots,    setSlots]    = useState(loc.rack_slots    || {});
  const [rowStyle, setRowStyle] = useState(loc.rack_row_style || "alpha");
  const [colStyle, setColStyle] = useState(loc.rack_col_style || "num");
  const [selSlot,  setSelSlot]  = useState(null);

  const getRLabel = i => (ROW_LABELS[rowStyle] || ROW_LABELS.alpha)[i] || String(i+1);
  const getCLabel = j => (COL_LABELS[colStyle] || COL_LABELS.num)[j]  || "";
  const slotKey   = (i,j) => `${getRLabel(i)}-${j+1}`;

  const saveRack = async (newRows, newCols, newSlots, newRowStyle, newColStyle) => {
    await SB.from("storage_locations").update({ rack_rows:newRows, rack_cols:newCols, rack_slots:newSlots, rack_row_style:newRowStyle, rack_col_style:newColStyle }).eq("id", loc.id);
    onUpdate({ ...loc, rack_rows:newRows, rack_cols:newCols, rack_slots:newSlots, rack_row_style:newRowStyle, rack_col_style:newColStyle });
  };

  const addRow = () => { if(rows<8){ const r=rows+1; setRows(r); saveRack(r,cols,slots,rowStyle,colStyle); } };
  const addCol = () => { if(cols<6){ const c=cols+1; setCols(c); saveRack(rows,c,slots,rowStyle,colStyle); } };
  const removeRow = () => { if(rows>1){ const r=rows-1; setRows(r); saveRack(r,cols,slots,rowStyle,colStyle); } };
  const removeCol = () => { if(cols>1){ const c=cols-1; setCols(c); saveRack(rows,c,slots,rowStyle,colStyle); } };

  const slotItems = selSlot ? items.filter(it => it.location_id===loc.id && it.rack_slot===selSlot) : [];
  const inp = { background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"6px 10px",color:"var(--text)",fontSize:12,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };

  return (
    <div>
      <div style={{ display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center" }}>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={addRow}>+ Row</button>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={removeRow} disabled={rows<=1}>− Row</button>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={addCol}>+ Column</button>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={removeCol} disabled={cols<=1}>− Column</button>
        <select value={rowStyle} onChange={e=>{ setRowStyle(e.target.value); saveRack(rows,cols,slots,e.target.value,colStyle); }} style={{ ...inp,width:"auto",fontSize:11 }}>
          <option value="alpha">Rows: A, B, C</option>
          <option value="num">Rows: 1, 2, 3</option>
          <option value="shelf">Rows: Shelf 1, 2</option>
          <option value="custom">Rows: Top, Middle</option>
        </select>
        <select value={colStyle} onChange={e=>{ setColStyle(e.target.value); saveRack(rows,cols,slots,rowStyle,e.target.value); }} style={{ ...inp,width:"auto",fontSize:11 }}>
          <option value="num">Cols: 1, 2, 3</option>
          <option value="alpha">Cols: A, B, C</option>
          <option value="none">No col labels</option>
        </select>
      </div>

      <div style={{ border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",background:"var(--parch)" }}>
        <div style={{ overflowX:"auto",padding:12 }}>
          {colStyle !== "none" && (
            <div style={{ display:"grid",gridTemplateColumns:`44px repeat(${cols},1fr)`,gap:4,marginBottom:4 }}>
              <div />
              {Array.from({length:cols},(_,j)=>(
                <div key={j} style={{ textAlign:"center",fontSize:11,color:"var(--muted)",fontWeight:700 }}>{getCLabel(j)}</div>
              ))}
            </div>
          )}
          {Array.from({length:rows},(_,i)=>(
            <div key={i} style={{ display:"grid",gridTemplateColumns:`44px repeat(${cols},1fr)`,gap:4,marginBottom:4 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:6,fontSize:11,fontWeight:700,color:"var(--muted)" }}>{getRLabel(i)}</div>
              {Array.from({length:cols},(_,j)=>{
                const key = slotKey(i,j);
                const slotItemList = items.filter(it=>it.location_id===loc.id&&it.rack_slot===key);
                const hasItems = slotItemList.length>0;
                const isSel = selSlot===key;
                return (
                  <div key={j} onClick={()=>setSelSlot(isSel?null:key)}
                    style={{ cursor:"pointer",borderRadius:6,border:isSel?"1.5px solid var(--red)":hasItems?"1px solid var(--gold)":"1px solid var(--border)",background:isSel?"rgba(194,24,91,.1)":hasItems?"rgba(212,168,67,.1)":"var(--white)",padding:"6px 4px",minHeight:48,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transition:"all 0.1s" }}>
                    {hasItems ? (
                      <>
                        <span style={{ fontSize:14 }}>🧥</span>
                        <span style={{ fontSize:10,color:isSel?"var(--red)":"var(--amber)",marginTop:2 }}>{slotItemList.length} item{slotItemList.length>1?"s":""}</span>
                      </>
                    ) : (
                      <span style={{ fontSize:12,color:"var(--border)" }}>+</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selSlot && (
        <div style={{ marginTop:12,padding:12,background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10 }}>
          <div style={{ fontWeight:700,fontSize:13,marginBottom:8,color:"var(--gold)" }}>Slot {selSlot}</div>
          {slotItems.length===0 ? (
            <div style={{ fontSize:12,color:"var(--muted)",textAlign:"center",padding:"12px 0" }}>Empty — assign items to this slot by editing an item and selecting this location + slot.</div>
          ) : (
            slotItems.map(it=>(
              <div key={it.id} style={{ fontSize:12,padding:"6px 0",borderBottom:"1px solid var(--linen)" }}>{it.name}</div>
            ))
          )}
        </div>
      )}

      <div style={{ marginTop:8,fontSize:11,color:"var(--muted)" }}>{rows} rows · {cols} columns · click any slot to see what's stored there</div>
    </div>
  );
}

// ── Main LocationsPanel ─────────────────────────────────────────────────────
function LocationsPanel({ userId, items, onEditItem, onDeleteItem }) {
  const [locations,    setLocations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [active,       setActive]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [browseItems,  setBrowseItems]  = useState([]);
  const [activeRoom,   setActiveRoom]   = useState(null);
  const [msg,          setMsg]          = useState("");

  const flash = m => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from("storage_locations")
      .select("*")
      .eq("org_id", userId)
      .order("sort_order")
      .order("name");
    const locs = data || [];
    setLocations(locs);
    if (locs.length > 0 && !activeRoom) setActiveRoom(locs[0].id);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const saveLocation = async (f) => {
    setSaving(true);
    const payload = { name: f.name.trim(), code: (f.code||"").trim() || null, description: (f.description||"").trim() || null, location_type: f.location_type || "named", updated_at: new Date().toISOString() };
    if (active) {
      const { data, error } = await SB.from("storage_locations").update(payload).eq("id", active.id).select().single();
      if (error) { flash("❌ " + EM.fundingSave.body); }
      else { setLocations(p => p.map(x => x.id === data.id ? data : x)); flash("✓ Location updated"); setModal(null); setActive(null); }
    } else {
      const { data, error } = await SB.from("storage_locations").insert({ org_id: userId, ...payload, map_pins: [], rack_slots: {} }).select().single();
      if (error) { flash("❌ " + EM.fundingSave.body); }
      else { setLocations(p => [...p, data]); setActiveRoom(data.id); flash("✓ Location added"); setModal(null); }
    }
    setSaving(false);
  };

  const deleteLocation = async (id) => {
    if (!window.confirm("Delete this location? Items assigned here will lose their location link, but won't be deleted.")) return;
    await SB.from("storage_locations").delete().eq("id", id);
    const remaining = locations.filter(x => x.id !== id);
    setLocations(remaining);
    if (activeRoom === id) setActiveRoom(remaining[0]?.id || null);
    flash("Location removed");
  };

  const browseLocation = (loc) => {
    setActive(loc);
    const matched = items.filter(i => i.location_id === loc.id || (i.location && i.location.toLowerCase() === loc.name.toLowerCase()));
    setBrowseItems(matched);
    setModal("browse");
  };

  const updateLoc = (updated) => {
    setLocations(p => p.map(x => x.id === updated.id ? updated : x));
  };

  // Print QR label for a location container
  const printLocationQR = async (loc) => {
    const qrUrl = `https://theatre4u.org/#/location/${loc.id}`;
    const qrSrc = await QR.toDataURL(qrUrl, 200);
    if (!qrSrc) return;
    const w = window.open("", "_blank", "width=420,height=540");
    if (!w) return;
    const itemCount = items.filter(i => i.location_id === loc.id || (i.location && i.location.toLowerCase() === loc.name.toLowerCase())).length;
    w.document.write(`<html><head><title>QR – ${loc.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}
      img{margin:12px 0;border:1px solid #eee;border-radius:6px}
      h2{margin-bottom:2px;font-size:20px}.code{font-size:28px;font-weight:900;font-family:monospace;color:#c4761a;margin:4px 0}
      p{color:#666;font-size:13px;margin:3px 0}</style></head>
      <body>
      <p style="font-size:11px;color:#bbb;margin-bottom:4px">📦 Storage Location</p>
      <h2>${loc.name}</h2>
      ${loc.code ? `<div class="code">${loc.code}</div>` : ""}
      ${loc.description ? `<p style="color:#888;font-style:italic">${loc.description}</p>` : ""}
      <p style="font-weight:700;color:#333">${itemCount} item${itemCount !== 1 ? "s" : ""}</p>
      <img src="${qrSrc}" width="180" height="180"/>
      <p style="font-size:11px;margin-top:8px;color:#aaa">Theatre4u™ — Scan to view contents</p>
      <script>setTimeout(function(){window.print()},300)<\/script>
      </body></html>`);
    w.document.close();
  };

  const card = { background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginBottom:10 };
  const inp  = { background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"8px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };
  const lbl  = { fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4 };

  const currentLoc = locations.find(l => l.id === activeRoom) || null;
  const locItems   = currentLoc ? items.filter(i => i.location_id === currentLoc.id) : [];
  const typeIcon   = (t) => t==="room"?"🗺️":t==="rack"?"🏗️":"📦";

  return (
    <div>
      {msg && <div style={{ position:"fixed",top:16,right:16,zIndex:9999,background:"var(--cream)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px",fontSize:13,fontWeight:600,color:msg.startsWith("❌")?"var(--red)":"var(--green)",boxShadow:"0 4px 20px rgba(0,0,0,.4)" }}>{msg}</div>}

      {loading ? (
        <div style={{ textAlign:"center",padding:48,color:"var(--muted)" }}>Loading locations…</div>
      ) : locations.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">📦</div>
          <h3>No locations yet</h3>
          <p>Add your first storage location — a room with a photo map, a costume rack, or a simple named location.</p>
          <button className="btn btn-g" onClick={() => { setActive(null); setModal("add"); }}>+ Add First Location</button>
        </div>
      ) : (
        <div>
          {/* ── Room tab bar ── */}
          <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center" }}>
            {locations.map(loc => (
              <button key={loc.id} onClick={() => setActiveRoom(loc.id)}
                style={{ padding:"5px 12px",fontSize:13,borderRadius:8,border:activeRoom===loc.id?"1.5px solid var(--gold)":"1px solid var(--border)",background:activeRoom===loc.id?"rgba(212,168,67,.1)":"var(--parch)",color:activeRoom===loc.id?"var(--amber)":"var(--muted)",cursor:"pointer",fontFamily:"inherit",fontWeight:activeRoom===loc.id?700:400,whiteSpace:"nowrap" }}>
                {typeIcon(loc.location_type)} {loc.name}
              </button>
            ))}
            <button onClick={() => { setActive(null); setModal("add"); }}
              style={{ padding:"5px 10px",fontSize:13,borderRadius:8,border:"1px dashed var(--border)",background:"transparent",color:"var(--muted)",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap" }}>
              + Add Location
            </button>
          </div>

          {/* ── Active location panel ── */}
          {currentLoc && (
            <div style={card}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:20 }}>{typeIcon(currentLoc.location_type)}</span>
                  <span style={{ fontWeight:700,fontSize:15 }}>{currentLoc.name}</span>
                  {currentLoc.code && <span style={{ fontFamily:"monospace",fontWeight:800,fontSize:13,color:"var(--amber)",background:"rgba(196,118,26,.12)",padding:"2px 8px",borderRadius:4 }}>{currentLoc.code}</span>}
                  <span style={{ fontSize:11,color:"var(--muted)",background:"var(--white)",border:"1px solid var(--border)",padding:"2px 7px",borderRadius:10 }}>
                    {currentLoc.location_type==="room"?"Room map":currentLoc.location_type==="rack"?"Storage rack":"Named location"}
                  </span>
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={() => browseLocation(currentLoc)}>📋 {locItems.length} items</button>
                  <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={() => printLocationQR(currentLoc)}>🖨 QR Label</button>
                  <button className="btn btn-o bsm" onClick={() => { setActive(currentLoc); setModal("edit"); }}>Edit</button>
                  <button className="btn btn-d bsm" onClick={() => deleteLocation(currentLoc.id)}>Delete</button>
                </div>
              </div>

              {currentLoc.description && <div style={{ fontSize:12,color:"var(--muted)",marginBottom:12,fontStyle:"italic" }}>{currentLoc.description}</div>}

              {currentLoc.location_type === "room" && (
                <RoomMap loc={currentLoc} items={items} userId={userId} onUpdate={updateLoc} />
              )}
              {currentLoc.location_type === "rack" && (
                <StorageRack loc={currentLoc} items={items} onUpdate={updateLoc} />
              )}
              {currentLoc.location_type === "named" && (
                <div style={{ fontSize:13,color:"var(--muted)",padding:"16px 0",textAlign:"center" }}>
                  Named location — items are assigned here through the item edit form.<br/>
                  <button className="btn btn-o" style={{ marginTop:10,fontSize:12 }} onClick={() => browseLocation(currentLoc)}>Browse {locItems.length} item{locItems.length!==1?"s":""} in this location</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {(modal === "add" || modal === "edit") && (
        <LocationFormModal
          initial={modal === "edit" ? active : null}
          saving={saving}
          onSave={saveLocation}
          onCancel={() => { setModal(null); setActive(null); }}
          inp={inp} lbl={lbl}
        />
      )}

      {/* ── Browse items modal ── */}
      {modal === "browse" && active && (
        <Modal title={`${typeIcon(active.location_type)} ${active.name}${active.code ? " · " + active.code : ""}`} onClose={() => { setModal(null); setActive(null); setBrowseItems([]); }}>
          <div style={{ marginBottom:12,fontSize:13,color:"var(--muted)" }}>{browseItems.length} item{browseItems.length!==1?"s":""} in this location</div>
          {browseItems.length === 0 ? (
            <div style={{ textAlign:"center",padding:32,color:"var(--muted)" }}>
              <div style={{ fontSize:36,marginBottom:8 }}>📭</div>
              <div>No items assigned to this location yet.</div>
              <div style={{ fontSize:12,marginTop:6 }}>Assign items here by editing them and selecting this location.</div>
            </div>
          ) : (
            browseItems.map(item => {
              const cat = CAT[item.category] || CAT.other;
              return (
                <div key={item.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--linen)" }}>
                  <div style={{ width:36,height:36,background:cat.color+"22",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{cat.icon}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:13 }}>{item.name}</div>
                    <div style={{ fontSize:11,color:"var(--muted)",display:"flex",gap:8 }}>
                      {item.display_id && <span style={{ fontFamily:"monospace",fontWeight:800,color:"var(--amber)" }}>{item.display_id}</span>}
                      <span>{cat.label}</span>
                      <span>{item.condition}</span>
                      <span>×{item.qty}</span>
                    </div>
                  </div>
                  <button className="btn btn-o bsm" onClick={() => { setModal(null); onEditItem(item); }}>Edit</button>
                </div>
              );
            })
          )}
        </Modal>
      )}
    </div>
  );
}

function LocationFormModal({ initial, saving, onSave, onCancel, inp, lbl }) {
  const blank = { name:"", code:"", description:"", location_type: initial?.location_type || "named" };
  const [f, setF] = useState(initial || blank);
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  const types = [
    { id:"named", icon:"📦", label:"Named location", desc:"Simple text location — closet, shelf, container" },
    { id:"room",  icon:"🗺️", label:"Room map",       desc:"Upload a photo and drop pins on it" },
    { id:"rack",  icon:"🏗️", label:"Storage rack",   desc:"Build a virtual rack with rows and slots" },
  ];
  return (
    <Modal title={(initial ? "Edit" : "Add") + " Storage Location"} onClose={onCancel}>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {!initial && (
          <div>
            <label style={lbl}>Location type</label>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {types.map(t => (
                <div key={t.id} onClick={() => upd("location_type", t.id)}
                  style={{ padding:"10px 12px",border:f.location_type===t.id?"1.5px solid var(--gold)":"1px solid var(--border)",borderRadius:8,cursor:"pointer",background:f.location_type===t.id?"rgba(212,168,67,.08)":"var(--parch)",display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontSize:20 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13,color:f.location_type===t.id?"var(--amber)":"var(--text)" }}>{t.label}</div>
                    <div style={{ fontSize:11,color:"var(--muted)" }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <label style={lbl}>Location name *</label>
          <input style={inp} value={f.name} onChange={e=>upd("name",e.target.value)} placeholder={f.location_type==="room"?"e.g. Costume Storage Room":f.location_type==="rack"?"e.g. Costume Rack A":"e.g. Storage Container 1, Prop Room Shelf 3"} autoFocus />
        </div>
        <div>
          <label style={lbl}>Short code <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10 }}>(optional — for labels)</span></label>
          <input style={{ ...inp,fontFamily:"monospace",letterSpacing:2,textTransform:"uppercase" }} value={f.code||""} onChange={e=>upd("code",e.target.value.toUpperCase())} placeholder="e.g. SC1, CCA" maxLength={8} />
        </div>
        <div>
          <label style={lbl}>Description <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10 }}>(optional)</span></label>
          <textarea style={{ ...inp,minHeight:56,resize:"vertical" }} value={f.description||""} onChange={e=>upd("description",e.target.value)} placeholder="Upstage right, blue rolling rack, near loading dock…" />
        </div>
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)" }}>
          <button className="btn btn-o" onClick={onCancel}>Cancel</button>
          <button className="btn btn-g" disabled={!f.name.trim()||saving} style={{ opacity:!f.name.trim()||saving?0.45:1 }} onClick={() => { if(f.name.trim()) onSave(f); }}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Location"}
          </button>
        </div>
      </div>
    </Modal>
  );
}



function ExternalLoans({ userId, org, items=[] }){
  const [loans,   setLoans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [modal,   setModal]   = useState(null);    // "add" | "edit"
  const [active,  setActive]  = useState(null);
  const [tab,     setTab]     = useState("active"); // active | returned | all
  const [msg,     setMsg]     = useState("");
  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),3500); };

  const blank = { direction:"out", counterparty_name:"", counterparty_contact:"", item_name:"", quantity:1, date_out:new Date().toISOString().slice(0,10), due_date:"", notes:"" };
  const [form, setForm] = useState(blank);

  useEffect(()=>{
    if(!userId) return;
    (async()=>{
      setLoading(true);
      const { data } = await SB.from("external_loans").select("*").eq("org_id",userId).order("created_at",{ascending:false});
      if(data) setLoans(data);
      setLoading(false);
    })();
  },[userId]);

  const openAdd  = (dir="out") => { setActive(null); setForm({...blank, direction:dir}); setModal("add"); };
  const openEdit = (l) => { setActive(l); setForm({ direction:l.direction, counterparty_name:l.counterparty_name||"", counterparty_contact:l.counterparty_contact||"", item_name:l.item_name||"", quantity:l.quantity||1, date_out:l.date_out||"", due_date:l.due_date||"", notes:l.notes||"" }); setModal("edit"); };

  const save = async() => {
    if(!form.counterparty_name.trim()){ flash("❌ Add the organization or person's name"); return; }
    if(!form.item_name.trim()){ flash("❌ Add what was borrowed or lent"); return; }
    setSaving(true);
    const payload = {
      direction: form.direction,
      counterparty_name: form.counterparty_name.trim(),
      counterparty_contact: form.counterparty_contact.trim() || null,
      item_name: form.item_name.trim(),
      quantity: parseInt(form.quantity,10) || 1,
      date_out: form.date_out || null,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    if(active){
      const { data, error } = await SB.from("external_loans").update({...payload, updated_at:new Date().toISOString()}).eq("id",active.id).select().single();
      if(error){ flash("❌ Could not save. Try again."); }
      else { setLoans(p=>p.map(x=>x.id===data.id?data:x)); flash("✓ Updated"); setModal(null); setActive(null); }
    } else {
      const { data, error } = await SB.from("external_loans").insert({...payload, org_id:userId}).select().single();
      if(error){ flash("❌ Could not save. Try again."); }
      else { setLoans(p=>[data,...p]); flash("✓ Added"); setModal(null); }
    }
    setSaving(false);
  };

  const markReturned = async(l) => {
    const { data, error } = await SB.from("external_loans").update({ returned:true, returned_at:new Date().toISOString() }).eq("id",l.id).select().single();
    if(!error && data){ setLoans(p=>p.map(x=>x.id===data.id?data:x)); flash("✓ Marked returned"); }
  };
  const reopen = async(l) => {
    const { data, error } = await SB.from("external_loans").update({ returned:false, returned_at:null }).eq("id",l.id).select().single();
    if(!error && data){ setLoans(p=>p.map(x=>x.id===data.id?data:x)); flash("Reopened"); }
  };
  const remove = async(l) => {
    if(!confirm("Delete this record?")) return;
    await SB.from("external_loans").delete().eq("id",l.id);
    setLoans(p=>p.filter(x=>x.id!==l.id));
    flash("Deleted");
  };

  const invite = (l) => {
    const subject = encodeURIComponent("Join us on Theatre4u");
    const body = encodeURIComponent(`Hi ${l.counterparty_name},\n\nWe use Theatre4u to track our theatre inventory and to borrow, lend, and rent items with other programs. It would make sharing between us much easier if you joined too — it's free to start.\n\nYou can sign up here: https://theatre4u.org\n\nThanks!\n${org?.name||""}`);
    const to = (l.counterparty_contact && l.counterparty_contact.includes("@")) ? l.counterparty_contact : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const today = new Date().toISOString().slice(0,10);
  const isOverdue = l => !l.returned && l.due_date && l.due_date < today;
  const visible = loans.filter(l => tab==="all" ? true : tab==="returned" ? l.returned : !l.returned);
  const activeOut = loans.filter(l=>!l.returned && l.direction==="out").length;
  const activeIn  = loans.filter(l=>!l.returned && l.direction==="in").length;
  const overdueN  = loans.filter(isOverdue).length;

  const card  = {background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:16,marginBottom:12};
  const label = {fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4};
  const inp   = {background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"7px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};
  const row2  = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10};

  if(loading) return <div style={{textAlign:"center",padding:60,color:"var(--faint)"}}>Loading…</div>;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {msg&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:"var(--cream)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px",fontSize:13,fontWeight:600,color:msg.startsWith("❌")?"var(--red)":"var(--green)",boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>{msg}</div>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:4}}>Borrowed & Lent</h2>
          <p style={{color:"var(--faint)",fontSize:13,maxWidth:560,lineHeight:1.5}}>Track items you've borrowed from or lent to schools and organizations that aren't on Theatre4u — so you always know who has what and when it's due back.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>openAdd("out")} className="btn btn-g" style={{fontSize:12}}>＋ Lent out</button>
          <button onClick={()=>openAdd("in")} className="btn btn-o" style={{fontSize:12}}>＋ Borrowed</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Lent out",  val:activeOut, color:"var(--gold)"},
          {label:"Borrowed",  val:activeIn,  color:"var(--blue)"},
          {label:"Overdue",   val:overdueN,  color:overdueN>0?"var(--red)":"var(--text)"},
        ].map(s=>(
          <div key={s.label} style={{...card,textAlign:"center",marginBottom:0}}>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"'Playfair Display',serif",color:s.color}}>{s.val}</div>
            <div style={{fontSize:11,color:"var(--faint)",marginTop:4,textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["active","Active"],["returned","Returned"],["all","All"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={tab===t?"btn btn-g btn-sm":"btn btn-o btn-sm"} style={{fontSize:12}}>{l}</button>
        ))}
      </div>

      {visible.length===0 ? (
        <div style={{textAlign:"center",padding:48,color:"var(--faint)",fontSize:14}}>Nothing here yet. Use "Lent out" or "Borrowed" above to add your first record.</div>
      ) : (
        <div>
          {visible.map(l=>(
            <div key={l.id} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:l.direction==="out"?"rgba(212,168,67,.15)":"rgba(66,165,245,.15)",color:l.direction==="out"?"var(--gold)":"var(--blue)"}}>{l.direction==="out"?"Lent out →":"← Borrowed"}</span>
                  {l.returned&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"rgba(76,175,80,.15)",color:"var(--green)"}}>Returned</span>}
                  {isOverdue(l)&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"rgba(229,57,53,.15)",color:"var(--red)"}}>Overdue</span>}
                </div>
                <div style={{fontWeight:700,fontSize:15}}>{l.item_name}{l.quantity>1?` ×${l.quantity}`:""}</div>
                <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>{l.direction==="out"?"To":"From"}: {l.counterparty_name}{l.counterparty_contact?` · ${l.counterparty_contact}`:""}</div>
                <div style={{fontSize:12,color:"var(--faint)",marginTop:2}}>
                  {l.date_out?`Out ${l.date_out}`:""}{l.due_date?` · Due ${l.due_date}`:""}{l.returned&&l.returned_at?` · Returned ${l.returned_at.slice(0,10)}`:""}
                </div>
                {l.notes&&<div style={{fontSize:12,color:"var(--muted)",marginTop:6,fontStyle:"italic"}}>{l.notes}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"stretch"}}>
                {!l.returned ? <button onClick={()=>markReturned(l)} className="btn btn-g btn-sm" style={{fontSize:11}}>Mark returned</button> : <button onClick={()=>reopen(l)} className="btn btn-o btn-sm" style={{fontSize:11}}>Reopen</button>}
                <button onClick={()=>invite(l)} className="btn btn-o btn-sm" style={{fontSize:11}}>✉️ Invite to Theatre4u</button>
                <button onClick={()=>openEdit(l)} className="btn btn-o btn-sm" style={{fontSize:11}}>Edit</button>
                <button onClick={()=>remove(l)} className="btn btn-o btn-sm" style={{fontSize:11,color:"var(--red)"}}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal&&(
        <div onClick={()=>{setModal(null);setActive(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--cream)",border:"1px solid var(--border)",borderRadius:12,padding:20,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:19,marginBottom:14}}>{active?"Edit record":form.direction==="out"?"Item lent out":"Item borrowed"}</h3>
            <div style={{marginBottom:10}}>
              <label style={label}>Type</label>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setForm(f=>({...f,direction:"out"}))} className={form.direction==="out"?"btn btn-g btn-sm":"btn btn-o btn-sm"} style={{flex:1,fontSize:12}}>Lent out</button>
                <button onClick={()=>setForm(f=>({...f,direction:"in"}))} className={form.direction==="in"?"btn btn-g btn-sm":"btn btn-o btn-sm"} style={{flex:1,fontSize:12}}>Borrowed</button>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={label}>{form.direction==="out"?"Lent to (organization or person)":"Borrowed from (organization or person)"}</label>
              <input style={inp} value={form.counterparty_name} onChange={e=>setForm(f=>({...f,counterparty_name:e.target.value}))} placeholder="e.g. Springfield Community Theatre"/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={label}>Their email or phone (optional)</label>
              <input style={inp} value={form.counterparty_contact} onChange={e=>setForm(f=>({...f,counterparty_contact:e.target.value}))} placeholder="name@example.com"/>
            </div>
            <div style={row2}>
              <div>
                <label style={label}>Item</label>
                <input style={inp} list="t4u-my-items" value={form.item_name} onChange={e=>setForm(f=>({...f,item_name:e.target.value}))} placeholder="e.g. Victorian dress"/>
                <datalist id="t4u-my-items">{(items||[]).slice(0,300).map(it=><option key={it.id} value={it.name}/>)}</datalist>
              </div>
              <div>
                <label style={label}>Quantity</label>
                <input style={inp} type="number" min="1" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))}/>
              </div>
            </div>
            <div style={row2}>
              <div>
                <label style={label}>Date out</label>
                <input style={inp} type="date" value={form.date_out} onChange={e=>setForm(f=>({...f,date_out:e.target.value}))}/>
              </div>
              <div>
                <label style={label}>Due back</label>
                <input style={inp} type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={label}>Notes (optional)</label>
              <textarea style={{...inp,minHeight:60,resize:"vertical"}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Condition, who arranged it, etc."/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>{setModal(null);setActive(null);}} className="btn btn-o" style={{fontSize:13}}>Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-g" style={{fontSize:13}}>{saving?"Saving…":active?"Save changes":"Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// PROGRAM IMPACT REPORT
// Print-ready: how funding was used — for principals, boards, districts
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM USAGE REPORT
// How the program uses Theatre4u — for principals and superintendents
// ══════════════════════════════════════════════════════════════════════════════

