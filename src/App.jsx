// Theatre4u — built 2026-03-26 17:02
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Supabase ──────────────────────────────────────────────────────────────────

// ── Geocoding (OpenStreetMap Nominatim — free, no key needed) ─────────────────
async function geocodeLocation(locationText) {
  if (!locationText || locationText.trim().length < 3) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5 second hard timeout
  try {
    const q = encodeURIComponent(locationText.trim() + ", USA");
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { "User-Agent": "Theatre4u/1.0 (hello@theatre4u.org)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await r.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    clearTimeout(timeout);
    // Timeout or network error — return null so caller continues without coordinates
  }
  return null;
}

// Get browser geolocation as a Promise
function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve(null),
      { timeout: 5000, maximumAge: 300000 }
    );
  });
}

const SB = createClient(
  "https://ldmmphwivnnboyhlxipl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbW1waHdpdm5uYm95aGx4aXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODA2MDUsImV4cCI6MjA3OTc1NjYwNX0.U2acfM5Ew7leACj4TWEy7EKwHi92270B1lt78dEjEfA"
);

// Edge function caller helper
const callEdgeFn = async (name, body, token) => {
  const res = await fetch(`https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

// ══════════════════════════════════════════════════════════════════════════════
// ERROR MESSAGE LIBRARY — friendly user-facing messages, no raw DB errors
// Usage: EM.itemSave.title / EM.itemSave.body / EM.itemSave.cta
// ══════════════════════════════════════════════════════════════════════════════
const EM = {
  itemSave:            { title:"Couldn't Save Item",          body:"Your changes couldn't be saved right now. Check your internet connection and try again — if the problem persists, refresh the page.",                                                                cta:"Try Again" },
  csvFormat:           { title:"File Not Recognized",         body:"This file doesn't look like a CSV spreadsheet. In Excel or Google Sheets, use File > Save As > Comma Separated Values (.csv) and try again.",                                                      cta:"Choose a Different File" },
  csvNoName:           { title:"Name Column Required",        body:"Your spreadsheet must have an Item Name column. Drag one of your columns to 'Item Name' in the column mapping step before importing.",                                                              cta:"Go Back and Fix" },
  csvZeroImported:     { title:"Nothing Was Imported",        body:"Every row in your file failed to import. Make sure each item has a name, and that the file has data below the header row.",                                                                        cta:"Try Again" },
  photoTooLarge:       { title:"Photo Is Too Large",          body:"That photo is too large to upload. Try a file under 10 MB — photos taken on a phone and shared directly are usually a perfect size.",                                                              cta:"Choose a Smaller Photo" },
  photoWrongType:      { title:"Unsupported File Type",       body:"Only JPEG, PNG, and WebP photos can be uploaded. Convert your file to one of those formats and try again.",                                                                                         cta:"Choose a Different File" },
  loginBadPassword:    { title:"Password Didn't Match",       body:"That password isn't right for this account. Double-check for typos, or use 'Forgot password' to set a new one.",                                                                                   cta:"Reset Password" },
  loginNoEmail:        { title:"Account Not Found",           body:"There's no Theatre4u account for that email address. Check for typos, or sign up to create a new account.",                                                                                        cta:"Create an Account" },
  sessionExpired:      { title:"Session Expired",             body:"You've been signed out after a period of inactivity. Sign back in to continue where you left off.",                                                                                                cta:"Sign In" },
  deleteCheckedOut:    { title:"Item Is Currently Out",       body:"This item is marked as Checked Out or On Loan and can't be deleted right now. Change its availability to 'In Stock' first, then delete it.",                                                       cta:"OK" },
  marketplaceNotJoined:{ title:"Not in Backstage Exchange",   body:"Your program hasn't joined Backstage Exchange yet. Go to the Exchange page to opt in and start sharing items with other programs.",                                                                 cta:"Go to Backstage Exchange" },
  communityNotJoined:  { title:"Not in Community Board",      body:"Your program hasn't joined the Community Board yet. Go to the Community page to opt in and start posting.",                                                                                         cta:"Go to Community" },
  fundingHasExps:      { title:"Source Has Expenditures",     body:"This funding source has expenditures attached and can't be deleted. Remove all expenditures from it first, then delete the source.",                                                               cta:"OK" },
  planItemLimit:       { title:"Item Limit Reached",          body:"Your free plan includes up to 50 items. Upgrade to Pro for unlimited inventory and the full feature set your program deserves.",                                                                    cta:"Upgrade to Pro" },
  generic:             { title:"Something Went Wrong",        body:"An unexpected error occurred. Check your internet connection and try again. If this keeps happening, contact support at theatre4u.org.",                                                            cta:"Try Again" },
  sendInvite:          { title:"Invite Couldn't Send",        body:"The invite email couldn't be sent right now. Check your connection and try again in a moment.",                                                                                                     cta:"Try Again" },
  msgSend:             { title:"Message Not Sent",            body:"Your message couldn't be sent right now. Check your connection and try again.",                                                                                                                     cta:"Try Again" },
  fundingSave:         { title:"Couldn't Save",               body:"Your funding entry couldn't be saved right now. Check your connection and try again.",                                                                                                              cta:"Try Again" },
  sampleLoad:          { title:"Samples Didn't Load",         body:"The sample items couldn't be loaded right now. Check your connection and try again.",                                                                                                               cta:"Try Again" },
  requestSend:         { title:"Request Not Sent",            body:"Your request couldn't be submitted right now. Check your connection and try again.",                                                                                                                cta:"Try Again" },
  resetPass:           { title:"Reset Email Not Sent",        body:"We couldn't send a password reset email right now. Check that your email address is correct and try again.",                                                                                       cta:"Try Again" },
};

// Map Supabase auth error text to friendly EM keys
function authErrKey(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("email not confirmed") || m.includes("wrong password") || m.includes("incorrect password")) return "loginBadPassword";
  if (m.includes("user not found") || m.includes("no user") || m.includes("email not found") || m.includes("no account")) return "loginNoEmail";
  if (m.includes("expired") || m.includes("jwt") || m.includes("refresh_token")) return "sessionExpired";
  return null;
}

// Show a simple friendly error alert using the EM library
function errAlert(key) {
  const e = EM[key] || EM.generic;
  alert(e.title + "\n\n" + e.body);
}


const uid  = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const fmt$ = n  => "$" + Number(n || 0).toFixed(2);
const itemNum = n  => n != null ? "#" + String(n).padStart(4, "0") : "";
// Page background images — 5 confirmed-working Unsplash IDs only
const usp=(id,w=900,h=500)=>`https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=82`;
const BG = {
  dashboard:   "photo-1503095396549-807759245b35", // red curtain + silhouettes — main brand image
  inventory:   "photo-1489987707025-afc232f7ea0f", // rows of hanging garments on racks
  marketplace: "photo-1503095396549-807759245b35", // red curtain + silhouettes
  reports:     "photo-1503095396549-807759245b35", // red curtain + silhouettes
  settings:    "photo-1497366216548-37526070297c", // organized office / workspace
};

// Category visual identity — CSS gradients, always works, never breaks
const CAT_GFX = {
  costumes:  {grad:"linear-gradient(135deg,#7b1560,#c2185b,#e91e8c)",    icon:"👗"},
  props:     {grad:"linear-gradient(135deg,#4a148c,#7b1fa2,#9c27b0)",    icon:"🎭"},
  sets:      {grad:"linear-gradient(135deg,#0d2b6e,#1565c0,#1976d2)",    icon:"🏛️"},
  lighting:  {grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)",    icon:"💡"},
  sound:     {grad:"linear-gradient(135deg,#1b5e20,#2e7d32,#43a047)",    icon:"🔊"},
  scripts:   {grad:"linear-gradient(135deg,#bf360c,#d84315,#e64a19)",    icon:"📜"},
  makeup:    {grad:"linear-gradient(135deg,#880e4f,#ad1457,#e91e63)",    icon:"💄"},
  furniture: {grad:"linear-gradient(135deg,#3e2723,#5d4037,#795548)",    icon:"🪑"},
  fabrics:   {grad:"linear-gradient(135deg,#4a148c,#6a1b9a,#8e24aa)",    icon:"🧵"},
  tools:     {grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)",    icon:"🔧"},
  effects:   {grad:"linear-gradient(135deg,#006064,#00838f,#00acc1)",    icon:"✨"},
  other:     {grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)",    icon:"📦"},
};

// CatCard — renders a category tile using gradient instead of photo
function CatCard({catId,label,icon,width=300,height=160,children}){
  const g=CAT_GFX[catId]||CAT_GFX.other;
  return(
    <div style={{width,height,background:g.grad,borderRadius:8,position:"relative",overflow:"hidden",display:"flex",alignItems:"flex-end"}}>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(height*0.38),opacity:.25,userSelect:"none"}}>{g.icon}</div>
      <div style={{position:"relative",zIndex:1,width:"100%"}}>{children}</div>
    </div>
  );
}

// CatThumb — small square thumbnail for item cards/lists
function CatThumb({catId,size=56}){
  const g=CAT_GFX[catId]||CAT_GFX.other;
  return(
    <div style={{width:size,height:size,background:g.grad,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*0.44),flexShrink:0}}>
      {g.icon}
    </div>
  );
}

const SHOWCASE = [
  {cat:"costumes", name:"Victorian Ball Gown",   price:"$25/wk", badge:"For Rent"},
  {cat:"fabrics",  name:"Grand Stage Drape",     price:"$60/wk", badge:"For Rent"},
  {cat:"effects",  name:"Fog Machine Pro",       price:"$20/wk", badge:"For Rent"},
  {cat:"props",    name:"Period Prop Set",        price:"$45",    badge:"For Sale"},
  {cat:"sets",     name:"Victorian Drawing Room",  price:"2wk loan",badge:"For Loan"},
  {cat:"lighting", name:"LED Par Can Array",     price:"$12/wk", badge:"Rent or Sale"},
  {cat:"sound",    name:"Shure Wireless Mic",    price:"$18/wk", badge:"For Rent"},
];

const CATS = [
  {id:"costumes", label:"Costumes",       icon:"👗",color:"#b5174f"},
  {id:"props",    label:"Props",           icon:"🎭",color:"#6a1b8a"},
  {id:"sets",     label:"Sets & Scenery",  icon:"🏛️",color:"#1554a0"},
  {id:"lighting", label:"Lighting",        icon:"💡",color:"#d35400"},
  {id:"sound",    label:"Sound",           icon:"🔊",color:"#27723a"},
  {id:"scripts",  label:"Scripts & Music", icon:"📜",color:"#b83208"},
  {id:"makeup",   label:"Makeup & Wigs",   icon:"💄",color:"#a0144e"},
  {id:"furniture",label:"Stage Furniture", icon:"🪑",color:"#5d3a1a"},
  {id:"fabrics",  label:"Fabrics & Drapes",icon:"🧵",color:"#5c1a8a"},
  {id:"tools",    label:"Tools",           icon:"🔧",color:"#374549"},
  {id:"effects",  label:"Special Effects", icon:"✨",color:"#00695c"},
  {id:"other",    label:"Other",           icon:"📦",color:"#4a2e1a"},
];
const CAT   = Object.fromEntries(CATS.map(c=>[c.id,c]));
const CAT_MAP = CAT; // alias used by PublicItemPage
const CONDS = ["New","Excellent","Good","Fair","Poor","For Parts"];

// ── Point earn rates by category (mirrors point_earn_rates DB table) ──────────
const POINT_EARN_RATES = {
  lighting: 50, sound: 50, sets: 40, costumes: 25, props: 20,
  furniture: 20, effects: 20, fabrics: 15, makeup: 15,
  scripts: 10, tools: 10, other: 15,
};
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
const SIZES = ["XS","S","M","L","XL","XXL","One Size","N/A"];
const AVAIL = ["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"];
const MKT   = ["Not Listed","For Rent","For Sale","Rent or Sale","For Loan"];

// ── Logo Components — simple emoji mark, always reliable ────────────────────
// LogoMarkDark and LogoMarkLight render the theatre masks emoji in a styled box
// These are intentionally simple until logo integration is ready
const LogoMarkDark = ({size=40}) => (
  <div style={{width:size,height:size,background:"linear-gradient(135deg,#2a1a0c,#1a0c06)",borderRadius:Math.round(size*0.22),display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*0.55),flexShrink:0,border:"1px solid rgba(232,184,93,.25)"}}>🎭</div>
);
const LogoMarkLight = ({size=40}) => (
  <div style={{width:size,height:size,background:"linear-gradient(135deg,#f5ede3,#ede0cf)",borderRadius:Math.round(size*0.22),display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*0.55),flexShrink:0,border:"1px solid rgba(59,42,31,.2)"}}>🎭</div>
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

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Lora:ital,wght@0,500;0,600;1,400;1,500&family=Raleway:wght@500;600;700;800&display=swap');
:root{
  --ink:#1a0c06;--deep:#2a0f09;--cog:#8b5a0f;--amber:#c49a30;--gold:#e8b85d;--gilt:#f5cc70;
  --cream:#f5ede3;--parch:#ede0cf;--linen:#ddd0ba;--sand:#c8b895;
  --text:#3b2a1f;--muted:#7a5538;--faint:#b09060;--border:#d4c09a;
  --white:#ffffff;--red:#8b1a2a;--green:#265e2a;--blue:#1a3570;
  --sh1:0 2px 14px rgba(18,6,0,.1);--sh2:0 6px 28px rgba(18,6,0,.17);--sh3:0 14px 52px rgba(18,6,0,.25);
  --r:5px;--rm:12px;--rl:18px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;background:var(--cream);color:var(--text);font-size:15px}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--parch)}::-webkit-scrollbar-thumb{background:var(--sand);border-radius:3px}
body{font-family:'Raleway',sans-serif;-webkit-font-smoothing:antialiased}

.shell{display:flex;height:100vh;overflow:hidden}
.sidebar{width:244px;min-width:244px;display:flex;flex-direction:column;z-index:200;transition:transform .28s cubic-bezier(.4,0,.2,1)}
.sidebar.hidden{transform:translateX(-100%);position:absolute;height:100%}
.sidebar.open{transform:translateX(0);position:absolute;height:100%}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.scroll-area{flex:1;overflow-y:auto}

/* Sidebar */
.sb-root{position:relative;height:100%;display:flex;flex-direction:column;background:var(--ink)}
.sb-photo{position:absolute;inset:0;overflow:hidden}
.sb-photo img{width:100%;height:100%;object-fit:cover;opacity:.14;filter:sepia(.5) brightness(.7)}
.sb-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(175deg,rgba(18,6,0,.5) 0%,rgba(18,6,0,.9) 60%,rgba(18,6,0,.97) 100%)}
.sb-inner{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;overflow-y:auto}
.sb-logo{padding:28px 20px 20px;border-bottom:1px solid rgba(212,168,67,.15)}
.sb-glyph{display:none}
.sb-name{font-family:'Cormorant Garamond','Playfair Display',serif;font-size:27px;color:var(--gold);letter-spacing:.8px;line-height:1;font-weight:700}
.sb-sub{font-size:9.5px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:3px;margin-top:6px;font-weight:700}
.sb-nav{padding:14px 10px;flex:1}
.sb-section{font-size:9px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,.2);padding:14px 12px 5px;font-weight:800}
.sb-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:6px;color:rgba(255,255,255,.82);cursor:pointer;font-size:13.5px;font-weight:600;margin-bottom:1px;transition:all .15s;border-left:3px solid transparent}
.sb-item:hover{background:rgba(255,255,255,.08);color:#fff}
.sb-item.on{background:rgba(212,168,67,.16);color:var(--gilt);border-left-color:var(--gold);padding-left:9px;font-weight:700}
.sb-ico{width:16px;height:16px;flex-shrink:0}
.sb-badge{margin-left:auto;background:rgba(255,255,255,.12);color:rgba(255,255,255,.65);font-size:11px;padding:1px 8px;border-radius:10px;font-weight:800}
.sb-item.on .sb-badge{background:rgba(212,168,67,.22);color:var(--gilt)}
.sb-foot{padding:16px 14px;border-top:1px solid rgba(212,168,67,.12)}

/* Topbar */
.topbar{display:flex;align-items:center;gap:14px;padding:14px 36px;border-bottom:1px solid var(--border);background:var(--cream);flex-shrink:0;position:relative}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--gold),var(--amber),var(--gilt) 50%,transparent 80%)}
.topbar-title{font-family:'Cormorant Garamond','Playfair Display',serif;font-size:27px;color:var(--ink);letter-spacing:.5px}
.menu-btn{display:none;background:none;border:none;cursor:pointer;color:var(--muted);padding:4px}
.menu-btn svg{width:22px;height:22px}

/* Page bg watermark */
.page-bg-img{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:.06;filter:sepia(.5) blur(2px);pointer-events:none;z-index:0}
.page-layer{position:relative;z-index:1}

/* Hero */
.hero-wrap{position:relative;overflow:hidden;border-radius:var(--rl)}
.hero-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 9s ease}
.hero-wrap:hover img{transform:scale(1.04)}
.hero-fade{position:absolute;inset:0;background:linear-gradient(135deg,rgba(18,6,0,.88) 0%,rgba(18,6,0,.5) 55%,rgba(18,6,0,.08) 100%)}
.hero-body{position:absolute;bottom:0;left:0;right:0;z-index:1;padding:42px 50px;display:flex;flex-direction:column}
.hero-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:4.5px;color:var(--gold);margin-bottom:10px}
.hero-title{font-family:'Playfair Display',serif;font-size:52px;color:var(--white);line-height:1.05;margin-bottom:10px;text-shadow:0 3px 24px rgba(0,0,0,.45);white-space:pre-line}
.hero-sub{font-family:'Lora',serif;font-size:17px;font-style:italic;color:rgba(255,255,255,.72);max-width:520px;line-height:1.65}
.hero-bar{position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--gold),var(--gilt),transparent 75%)}

/* Section heading */
.sh{margin-bottom:22px}
.sh h2{font-family:'Playfair Display',serif;font-size:32px;color:var(--ink);line-height:1.1;margin-bottom:3px}
.sh p{font-family:'Lora',serif;font-size:15.5px;font-style:italic;color:var(--muted)}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:32px}
.stat{background:rgba(253,246,236,.9);border:1px solid var(--border);border-radius:var(--rm);padding:20px 18px;box-shadow:var(--sh1);backdrop-filter:blur(8px);position:relative;overflow:hidden;transition:box-shadow .18s,transform .18s}
.stat:hover{box-shadow:var(--sh2);transform:translateY(-2px)}
.stat-ico{font-size:26px;margin-bottom:9px}
.stat-val{font-family:'Playfair Display',serif;font-size:38px;color:var(--ink);line-height:1}
.stat-lbl{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-top:5px}

/* Mosaic */
.mosaic{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,155px);gap:10px;border-radius:var(--rm);overflow:hidden}
.mc{overflow:hidden;position:relative;cursor:pointer}
.mc>div:first-child{width:100%;height:100%;object-fit:cover;transition:transform .55s ease}
.mc:hover>div:first-child{transform:scale(1.04)}
.mc.big{grid-column:span 2;grid-row:span 2}
.mc-lbl{position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(transparent,rgba(18,6,0,.8));font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--white)}

/* Image divider */
.img-div{height:180px;border-radius:var(--rm);overflow:hidden;position:relative}
.img-div img{width:100%;height:100%;object-fit:cover;display:block}
.img-div-fade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,6,0,.83) 0%,rgba(18,6,0,.35) 60%,transparent 100%)}
.img-div-text{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;justify-content:center;padding:0 42px}
.img-div-text h3{font-family:'Playfair Display',serif;font-size:30px;color:var(--white);margin-bottom:5px}
.img-div-text p{font-family:'Lora',serif;font-size:15px;font-style:italic;color:rgba(255,255,255,.7)}

/* Showcase */
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(224px,1fr));gap:16px}
.sc-card{border-radius:var(--rm);overflow:hidden;border:1px solid var(--border);background:var(--white);box-shadow:var(--sh1);transition:all .22s;cursor:pointer}
.sc-card:hover{box-shadow:var(--sh3);transform:translateY(-4px)}
.sc-img{height:170px;overflow:hidden;position:relative}
.sc-img img{width:100%;height:100%;object-fit:cover;transition:transform .55s}
.sc-card:hover .sc-img img{transform:scale(1.09)}
.sc-img-fade{position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(18,6,0,.6))}
.sc-badge{position:absolute;top:11px;right:11px;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
.bd-rent{background:var(--gold);color:var(--ink)}
.bd-sale{background:var(--green);color:#fff}
.bd-both{background:var(--ink);color:var(--gold)}
.sc-body{padding:14px 16px}
.sc-cat{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--amber);margin-bottom:4px}
.sc-name{font-family:'Lora',serif;font-size:17px;font-weight:600;color:var(--ink);margin-bottom:5px;line-height:1.3}
.sc-price{font-family:'Playfair Display',serif;font-size:19px;color:var(--cog)}

/* Category tiles */
.cat-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px}
.cat-tile{border-radius:var(--rm);overflow:hidden;cursor:pointer;position:relative;height:122px;box-shadow:var(--sh1);transition:all .2s}
.cat-tile:hover{box-shadow:var(--sh2);transform:translateY(-3px)}
.cat-tile>div{width:100%;height:100%!important;border-radius:0!important;transition:transform .55s}
.cat-tile:hover>div{transform:scale(1.06)}
.cat-tile::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 20%,rgba(18,6,0,.78))}
.cat-info{position:absolute;bottom:0;left:0;right:0;padding:10px 12px;z-index:1}
.cat-emo{font-size:18px;display:block;margin-bottom:2px}
.cat-name{font-size:12px;font-weight:800;color:var(--white);text-transform:uppercase;letter-spacing:.8px;line-height:1.2}
.cat-cnt{font-size:11px;color:rgba(255,255,255,.6);font-weight:600}

/* Inventory cards */
.inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(266px,1fr));gap:16px}
.inv-card{background:rgba(253,246,236,.93);border:1px solid var(--border);border-radius:var(--rm);overflow:hidden;cursor:pointer;transition:all .2s;box-shadow:var(--sh1);backdrop-filter:blur(4px)}
.inv-card:hover{box-shadow:var(--sh2);transform:translateY(-3px)}
.inv-img{height:170px;overflow:hidden}
.inv-img img{width:100%;height:100%;object-fit:cover;transition:transform .55s}
.inv-card:hover .inv-img img{transform:scale(1.07)}
.inv-body{padding:14px 16px}
.inv-cat{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
.inv-name{font-family:'Lora',serif;font-size:18px;font-weight:600;color:var(--ink);margin-bottom:8px;line-height:1.25}
.inv-meta{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
.chip{padding:3px 9px;border-radius:3px;font-size:11.5px;font-weight:700;background:var(--parch);color:var(--muted)}
.inv-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--linen)}
.mkt-badge{padding:3px 9px;border-radius:3px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
.mb-rent{background:rgba(26,53,112,.1);color:var(--blue)}
.mb-sale{background:rgba(38,94,42,.1);color:var(--green)}
.mb-both{background:rgba(196,118,26,.12);color:var(--cog)}
.mb-none{background:var(--parch);color:var(--faint)}
.mb-loan{background:rgba(0,131,143,.1);color:#00838f}
.price{font-family:'Playfair Display',serif;font-size:18px;color:var(--cog)}

/* Bar charts */
.bar-row{display:flex;align-items:center;gap:12px;padding:7px 0}
.bar-ico{font-size:17px;width:24px;text-align:center}
.bar-lbl{width:142px;font-size:13.5px;font-weight:700;color:var(--muted);flex-shrink:0}
.bar-track{flex:1;height:7px;background:var(--linen);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width .75s cubic-bezier(.4,0,.2,1)}
.bar-cnt{width:30px;text-align:right;font-size:14px;font-weight:800;color:var(--text)}

/* Card */
.card{background:rgba(253,246,236,.9);border:1px solid var(--border);border-radius:var(--rm);box-shadow:var(--sh1);backdrop-filter:blur(6px)}
.card-p{padding:26px}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 21px;border-radius:var(--r);font-size:14px;font-weight:800;cursor:pointer;border:1.5px solid transparent;font-family:'Raleway',sans-serif;letter-spacing:.3px;transition:all .15s;white-space:nowrap}
.btn:disabled{opacity:.42;cursor:not-allowed}
.btn-p{background:var(--ink);color:var(--gold);border-color:var(--ink)}
.btn-p:hover:not(:disabled){background:var(--deep)}
.btn-g{background:linear-gradient(135deg,var(--gold),var(--amber));color:var(--ink);border:none;font-weight:800;box-shadow:0 3px 12px rgba(196,118,26,.38)}
.btn-g:hover:not(:disabled){filter:brightness(1.09);transform:translateY(-1px);box-shadow:0 6px 20px rgba(196,118,26,.48)}
.btn-o{background:transparent;color:var(--text);border-color:var(--border)}
.btn-o:hover:not(:disabled){background:var(--parch);border-color:var(--sand)}
.btn-d{background:rgba(139,26,42,.07);color:var(--red);border-color:rgba(139,26,42,.2)}
.btn-d:hover:not(:disabled){background:rgba(139,26,42,.14)}
.btn-sm{padding:5px 13px;font-size:12.5px}
.btn-full{width:100%;justify-content:center}
.ico-btn{padding:7px;background:transparent;border:1.5px solid var(--border);border-radius:var(--r);cursor:pointer;color:var(--muted);display:inline-flex;align-items:center;transition:all .15s}
.ico-btn:hover{border-color:var(--sand);color:var(--text);background:var(--parch)}
.ico-btn svg{width:15px;height:15px}

/* Modal */
.overlay{position:fixed;inset:0;background:rgba(18,6,0,.76);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:fi .15s}
.modal{background:var(--cream);border-radius:var(--rl);width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;box-shadow:var(--sh3);animation:su .22s}
.modal-hd{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);background:var(--parch);border-radius:var(--rl) var(--rl) 0 0}
.modal-hd h2{font-family:'Playfair Display',serif;font-size:23px;color:var(--ink)}
.modal-bd{padding:24px;overflow-y:auto;flex:1}
.modal-ft{padding:16px 24px;border-top:2px solid var(--linen);background:var(--parch);border-radius:0 0 var(--rl) var(--rl);display:flex;gap:8px;justify-content:flex-end;flex-shrink:0}

/* Form */
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:15px}
.fg{display:flex;flex-direction:column;gap:5px}
.fg.fu{grid-column:1/-1}
.fl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.3px;color:var(--muted)}
.fi,.fs,.ft{background:var(--parch);border:1.5px solid var(--border);border-radius:var(--r);padding:9px 12px;font-size:14px;color:var(--text);font-family:'Raleway',sans-serif;font-weight:600;outline:none;transition:border .15s,box-shadow .15s;width:100%}
.fi:focus,.fs:focus,.ft:focus{border-color:var(--gold);background:var(--white);box-shadow:0 0 0 3px rgba(212,168,67,.14)}
.ft{resize:vertical;min-height:72px}
.sdiv{grid-column:1/-1;border-top:1.5px solid var(--border);padding-top:16px;margin-top:6px}
.slbl{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--amber);margin-bottom:12px}
.tc{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;background:var(--linen);border-radius:3px;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .12s}
.tc:hover{background:rgba(139,26,42,.1);color:var(--red)}
.ph-wrap{width:76px;height:76px;border-radius:var(--r);overflow:hidden;position:relative;border:1.5px solid var(--border)}
.ph-wrap img{width:100%;height:100%;object-fit:cover}
.ph-rm{position:absolute;top:2px;right:2px;width:20px;height:20px;background:rgba(18,6,0,.72);border:none;color:#fff;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
.ph-wrap:hover .ph-rm{opacity:1}
.ph-add{width:76px;height:76px;border:2px dashed var(--border);border-radius:var(--r);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--faint);font-size:11.5px;font-weight:800;gap:4px;transition:all .15s}
.ph-add:hover{border-color:var(--gold);color:var(--gold);background:rgba(212,168,67,.06)}
.ph-add svg{width:20px;height:20px}

/* Detail */
.dt-sec{margin-bottom:22px}
.dt-sec h3{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--linen)}
.dt-row{display:flex;padding:6px 0;font-size:14.5px}
.dt-lbl{width:136px;color:var(--faint);flex-shrink:0;font-size:13px;font-weight:700}
.dt-img{border-radius:var(--rm);overflow:hidden;margin-bottom:20px;position:relative;cursor:zoom-in;height:240px}
.dt-img img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.dt-img:hover img{transform:scale(1.03)}

/* Table */
.tw{overflow-x:auto;border:1px solid var(--border);border-radius:var(--rm);background:rgba(253,246,236,.9);backdrop-filter:blur(6px)}
table{width:100%;border-collapse:collapse}
th{padding:11px 15px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--faint);font-weight:800;text-align:left;background:var(--parch);border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:11px 15px;border-bottom:1px solid var(--linen);font-size:14px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(243,230,204,.55)}

/* Filters */
.fbar{background:rgba(253,246,236,.9);border:1px solid var(--border);border-radius:var(--rm);padding:14px 18px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;backdrop-filter:blur(6px)}
.fbar label{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:1.3px;color:var(--faint);margin-bottom:4px;font-weight:800}
.fbar select{background:var(--parch);border:1.5px solid var(--border);border-radius:var(--r);padding:6px 10px;font-size:13px;font-weight:700;color:var(--text);font-family:'Raleway',sans-serif;outline:none}

/* Pagination */
.pgn{display:flex;align-items:center;justify-content:center;gap:5px;padding:20px 0}
.pgn button{background:rgba(253,246,236,.9);border:1.5px solid var(--border);color:var(--muted);padding:6px 14px;border-radius:var(--r);cursor:pointer;font-size:13.5px;font-family:'Raleway',sans-serif;font-weight:800;transition:all .15s}
.pgn button:hover:not(:disabled){border-color:var(--gold);color:var(--cog)}
.pgn button.on{background:var(--ink);color:var(--gold);border-color:var(--ink)}
.pgn button:disabled{opacity:.3;cursor:not-allowed}

/* View toggle */
.vtog{display:flex;border:1.5px solid var(--border);border-radius:var(--r);overflow:hidden}
.vtog button{background:none;border:none;color:var(--muted);padding:7px 15px;cursor:pointer;font-size:13.5px;font-family:'Raleway',sans-serif;font-weight:800;transition:all .15s}
.vtog button.on{background:var(--ink);color:var(--gold)}
.vtog button:not(.on):hover{background:var(--parch);color:var(--text)}

/* Search */
.srch{position:relative;display:flex;align-items:center}
.srch svg{position:absolute;left:11px;width:15px;height:15px;color:var(--faint);pointer-events:none}
.srch input{background:rgba(253,246,236,.9);border:1.5px solid var(--border);border-radius:22px;padding:8px 14px 8px 34px;font-size:14px;font-weight:700;color:var(--text);font-family:'Raleway',sans-serif;outline:none;width:240px;transition:border .15s,box-shadow .15s;backdrop-filter:blur(4px)}
.srch input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,168,67,.13);background:var(--white)}
.srch input::placeholder{color:var(--faint);font-weight:500}

/* Tabs */
.tabs{display:flex;gap:2px;border-bottom:1.5px solid var(--border);margin-bottom:22px}
.tab{background:none;border:none;padding:10px 20px;font-size:14.5px;font-weight:800;color:var(--faint);cursor:pointer;border-bottom:3px solid transparent;font-family:'Raleway',sans-serif;transition:all .15s}
.tab.on{color:var(--cog);border-bottom-color:var(--gold)}
.tab:hover:not(.on){color:var(--muted)}

/* Lightbox */
.lb{position:fixed;inset:0;background:rgba(18,6,0,.93);z-index:2000;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
.lb img{max-width:90vw;max-height:90vh;border-radius:var(--rm);box-shadow:var(--sh3)}

/* Empty */
.empty{text-align:center;padding:66px 20px}
.empty-ico{font-size:58px;margin-bottom:16px;opacity:.3}
.empty h3{font-family:'Playfair Display',serif;font-size:28px;color:var(--ink);margin-bottom:8px}
.empty p{font-family:'Lora',serif;font-style:italic;color:var(--muted);font-size:16px;margin-bottom:20px}

/* Pricing */
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:16px}
.pricing-card{background:#1e1208;border:1.5px solid rgba(212,168,67,.2);border-radius:var(--rm);padding:22px;transition:all .2s;color:#f0e6d3}
.pricing-card:hover{box-shadow:var(--sh2)}
.pricing-card.hot{background:#241808;border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,168,67,.2)}
.pname{font-family:'Playfair Display',serif;font-size:23px;color:var(--ink);margin-bottom:4px}
.pprice{font-family:'Playfair Display',serif;font-size:36px;color:var(--cog)}
.pprice span{font-size:14px;color:var(--muted);font-family:'Raleway',sans-serif;font-weight:600}
.pdesc{font-family:'Lora',serif;font-style:italic;font-size:14px;color:var(--muted);margin:8px 0 16px}
.pfeat{display:flex;align-items:flex-start;gap:7px;font-size:13.5px;font-weight:700;margin-bottom:7px;color:var(--text)}
.pfeat svg{width:14px;height:14px;color:var(--green);flex-shrink:0;margin-top:2px}

.mob-overlay{position:fixed;inset:0;background:rgba(18,6,0,.55);z-index:190}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes mkt-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.fin{animation:fi .35s ease}

@media(max-width:900px){
  .sidebar{position:absolute;height:100%}
  .menu-btn{display:flex}
  .srch input{width:170px}
  .fg2{grid-template-columns:1fr}
  .topbar{padding:10px 18px}
  .hero-title{font-size:34px}
  .hero-body{padding:28px 26px}
  .mosaic{grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,130px)}
  .mc.big{grid-column:span 2;grid-row:span 1}
}
@media(max-width:600px){
  .inv-grid{grid-template-columns:1fr}
  .stats{grid-template-columns:repeat(2,1fr)}
  .cat-gallery{grid-template-columns:repeat(2,1fr)}
  .srch input{width:140px}
  .pricing-grid{grid-template-columns:1fr}
  .hero-title{font-size:26px}
  .sc-grid{grid-template-columns:1fr 1fr}
}

/* ── FLOATING CTA ─────────────────────────────────────────────── */
/* FAB removed — Upgrade button is now in sidebar */

/* ── Landing Page ─────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
:root{--bg:#0d0b11;--bg2:#15121b;--bg3:#1d1925;--bg3h:#252131;--bgi:#110f18;--bd:#282333;--bdl:#38324a;--t1:#ede8df;--t2:#9b93a8;--t3:#685f76;--goldd:#a37f2c;--grn:#4caf50;--blu:#42a5f5;--sh:0 4px 24px rgba(0,0,0,.4);--r:10px;--rs:6px;--tr:.2s ease}
.lp{min-height:100vh;background:var(--bg);color:var(--t1);overflow-x:hidden;font-family:'DM Sans',sans-serif}
.lp *{box-sizing:border-box;margin:0;padding:0}
.lp-grain{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)'/%3E%3C/svg%3E")}
.lpn{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 52px;transition:background .4s,border .4s}
.lpn.lpns{background:rgba(13,11,17,.94);border-bottom:1px solid rgba(212,168,67,.1);backdrop-filter:blur(14px)}
.lpnl{display:flex;align-items:center;gap:10px;cursor:pointer}
.lpni{width:34px;height:34px;background:linear-gradient(135deg,var(--gold),var(--goldd));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:17px}
.lpnt{font-family:'Playfair Display',serif;font-size:19px;font-weight:700;color:var(--gold)}
.lpnr{display:flex;align-items:center;gap:10px}
.lph{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:130px 24px 90px;position:relative;overflow:hidden}
.lph::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(212,168,67,.07) 0%,transparent 70%)}
.lph-curtl,.lph-curtr{position:absolute;top:0;bottom:0;width:clamp(40px,8vw,140px);pointer-events:none}
.lph-curtl{left:0;background:linear-gradient(to right,rgba(100,20,20,.28),transparent)}
.lph-curtr{right:0;background:linear-gradient(to left,rgba(100,20,20,.28),transparent)}
.lph-line{position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(to right,transparent 0%,rgba(212,168,67,.3) 40%,rgba(212,168,67,.3) 60%,transparent 100%)}
.lph-ew{font-size:10px;font-weight:600;letter-spacing:5px;text-transform:uppercase;color:var(--gold);margin-bottom:28px;display:flex;align-items:center;gap:14px;opacity:0;animation:lp-rise .9s ease .1s forwards}
.lph-ew::before,.lph-ew::after{content:'';flex:1;max-width:48px;height:1px;background:rgba(212,168,67,.4)}
.lph-h{font-family:'Cormorant Garamond',serif;font-size:clamp(54px,9vw,118px);font-weight:300;line-height:.9;letter-spacing:-.01em;margin-bottom:0;opacity:0;animation:lp-rise .9s ease .25s forwards}
.lph-h em{font-style:italic;color:var(--gold)}
.lph-h b{display:block;font-weight:700;color:var(--gold);font-size:clamp(46px,7.5vw,100px)}
.lph-sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(18px,2.4vw,26px);color:var(--t1);opacity:.8;max-width:520px;line-height:1.5;margin:32px auto 48px;opacity:0;animation:lp-rise .9s ease .4s forwards}
.lph-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;opacity:0;animation:lp-rise .9s ease .55s forwards}
.lp-btnp{display:inline-flex;align-items:center;gap:8px;padding:14px 34px;background:linear-gradient(135deg,var(--gold),var(--goldd));color:#1a0f00;border:none;border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:700;cursor:pointer;letter-spacing:.02em;transition:all .25s;box-shadow:0 0 36px rgba(212,168,67,.18)}
.lp-btnp:hover{transform:translateY(-2px);box-shadow:0 6px 44px rgba(212,168,67,.32);filter:brightness(1.08)}
.lp-btns2{display:inline-flex;align-items:center;gap:8px;padding:14px 30px;background:transparent;color:var(--t1);border:1px solid rgba(212,168,67,.22);border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:500;cursor:pointer;transition:all .25s}
.lp-btns2:hover{border-color:rgba(212,168,67,.5);background:rgba(212,168,67,.05)}
.lph-stats{display:flex;gap:52px;margin-top:80px;opacity:0;animation:lp-rise .9s ease .7s forwards;flex-wrap:wrap;justify-content:center}
.lph-sn{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:600;color:var(--gold);line-height:1}
.lph-sl{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--t3);margin-top:5px}
.lps{padding:100px 24px;max-width:1120px;margin:0 auto}
.lps-lbl{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--goldd);font-weight:600;margin-bottom:14px}
.lps-title{font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4.5vw,56px);font-weight:300;line-height:1.1;margin-bottom:20px}
.lps-title em{font-style:italic;color:var(--gold)}
.lps-sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:20px;color:var(--t2);max-width:560px;line-height:1.55}
.lp-divider{border:none;height:1px;background:linear-gradient(to right,transparent,var(--bd),transparent);margin:0}
.lpf-row{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;margin-bottom:96px}
.lpf-row.rev{direction:rtl}.lpf-row.rev>*{direction:ltr}
.lpf-vis{border-radius:14px;overflow:hidden;background:var(--bg2);border:1px solid var(--bd);aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;position:relative}
.lpf-vis::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(212,168,67,.04),transparent 55%)}
.lpf-demo{padding:20px;width:100%;font-size:12px}
.lpf-n{font-family:'Cormorant Garamond',serif;font-size:80px;font-weight:700;color:rgba(212,168,67,.06);line-height:1;margin-bottom:-10px}
.lpf-title{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,3.5vw,42px);font-weight:300;line-height:1.1;margin-bottom:14px}
.lpf-title em{font-style:italic;color:var(--gold)}
.lpf-body{font-size:14px;color:var(--t2);line-height:1.75;margin-bottom:22px}
.lpf-ul{list-style:none;display:flex;flex-direction:column;gap:9px}
.lpf-ul li{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--t2);line-height:1.5}
.lpf-ul li::before{content:'\u25C6';color:var(--goldd);font-size:7px;margin-top:6px;flex-shrink:0}
.lp-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:48px}
.lp-cat{background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:18px 14px;text-align:center;cursor:pointer;transition:all .25s}
.lp-cat:hover{border-color:rgba(212,168,67,.3);background:rgba(212,168,67,.04);transform:translateY(-3px)}
.lp-cat-ico{font-size:26px;margin-bottom:8px}
.lp-cat-lbl{font-size:12px;font-weight:500;color:var(--t2)}
.lp-tg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:48px}
.lp-tc{background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:28px}
.lp-tt{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:var(--t1);line-height:1.6;margin-bottom:20px}
.lp-tn{font-size:12.5px;font-weight:600;color:var(--gold)}
.lp-tr{font-size:11.5px;color:var(--t3);margin-top:2px}
.lp-pg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:52px}
.lp-pc{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:36px 28px;text-align:center;transition:all .3s}
.lp-pc:hover{transform:translateY(-4px)}
.lp-pc.feat{background:linear-gradient(145deg,#1c1108,var(--bg2));border-color:rgba(212,168,67,.45)}
.lp-pp{font-size:10px;text-transform:uppercase;letter-spacing:2.5px;color:var(--gold);font-weight:600;margin-bottom:14px}
.lp-pa{font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:600;color:var(--t1);line-height:1}
.lp-pper{font-size:13px;color:var(--t3);margin-bottom:28px}
.lp-pul{list-style:none;text-align:left;display:flex;flex-direction:column;gap:9px;margin-bottom:32px}
.lp-pul li{font-size:13px;color:var(--t2);display:flex;gap:9px;align-items:flex-start}
.lp-pul li::before{content:'\u2713';color:var(--gold);font-weight:700;flex-shrink:0}
.lp-cta{background:var(--bg2);border-top:1px solid rgba(212,168,67,.08);text-align:center;padding:120px 24px;position:relative;overflow:hidden}
.lp-cta::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:800px;background:radial-gradient(ellipse,rgba(212,168,67,.06),transparent 70%);pointer-events:none}
.lp-ft{background:var(--bg);border-top:1px solid var(--bd);padding:44px 52px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
.lp-fc{font-size:12px;color:var(--t3)}
.lp-fl{display:flex;gap:22px}
.lp-fl button{background:none;border:none;color:var(--t3);font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color .2s}
.lp-fl button:hover{color:var(--gold)}
.lp-ct{position:fixed;inset:0;z-index:9000;display:flex;pointer-events:none}
.lp-ctl,.lp-ctr{flex:1;background:var(--bg2);transition:transform .7s cubic-bezier(.77,0,.18,1)}
.lp-ctl{border-right:1px solid rgba(212,168,67,.35)}
.lp-ctr{border-left:1px solid rgba(212,168,67,.35)}
.lp-ct.open .lp-ctl{transform:translateX(-100%)}
.lp-ct.open .lp-ctr{transform:translateX(100%)}
@keyframes lp-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:900px){.lpn{padding:16px 20px}.lpf-row{grid-template-columns:1fr;gap:32px}.lpf-row.rev{direction:ltr}.lp-tg{grid-template-columns:1fr}.lp-pg{grid-template-columns:1fr}.lph-curtl,.lph-curtr{width:40px}.lp-ft{padding:32px 20px 20px}}
@media(max-width:600px){.lp-cats{grid-template-columns:repeat(3,1fr)}.lph-btns{flex-direction:column;align-items:stretch}.lph-btns button{justify-content:center}}
`;

const Ic = {
  search:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  plus:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  edit:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  x:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  menu:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  home:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  box:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  store:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>,
  chart:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  settings:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  filter:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  check:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  dl:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  cam:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
};

function Modal({title,onClose,children,footer}){
  useEffect(()=>{const h=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[onClose]);
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hd"><h2>{title}</h2><button className="ico-btn" onClick={onClose}>{Ic.x}</button></div>
        <div className="modal-bd">{children}</div>
        {footer&&<div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
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


function ItemForm({item,onSave,onCancel,userId,marketplaceEnabled=false}){
  const blank={name:"",category:"costumes",condition:"Good",size:"N/A",qty:1,location:"",notes:"",mkt:"Not Listed",rent:0,sale:0,loan_period:2,deposit:0,avail:"In Stock",img:null,tags:[],purchase_cost:"",purchase_date:"",purchase_vendor:"",funding_source_id:""};
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
    SB.from("storage_locations").select("id,name,code").eq("org_id",userId).order("name")
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
      <div className="fg"><label className="fl">Category</label><select className="fs" value={f.category} onChange={e=>upd("category",e.target.value)}>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
      <div className="fg"><label className="fl">Condition</label><select className="fs" value={f.condition} onChange={e=>upd("condition",e.target.value)}>{CONDS.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"><label className="fl">Size</label><select className="fs" value={f.size} onChange={e=>upd("size",e.target.value)}>{SIZES.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="0" step="1" placeholder="1" value={f.qty||""} onChange={e=>upd("qty",parseInt(e.target.value)||0)}/></div>
      <div className="fg"><label className="fl">Availability</label><select className="fs" value={f.avail} onChange={e=>upd("avail",e.target.value)}>{AVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
      <div className="fg"><label className="fl">Location</label><input className="fi" value={f.location} onChange={e=>upd("location",e.target.value)} placeholder="e.g. Costume Closet A"/></div>
      <div className="fg fu">
        <label className="fl">Storage Location</label>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <select className="fs" style={{flex:1}} value={f.location_id||""} onChange={e=>{
            upd("location_id",e.target.value||null);
            const loc=storLocs.find(l=>l.id===e.target.value);
            if(loc)upd("location",loc.name);
          }}>
            <option value="">— None —</option>
            {storLocs.map(l=><option key={l.id} value={l.id}>{l.name}{l.code?" ("+l.code+")":""}</option>)}
          </select>
          <button type="button" className="btn btn-o btn-sm" style={{whiteSpace:"nowrap",flexShrink:0}}
            onClick={()=>{setQloc(v=>!v);setQfund(false);}}>+ New</button>
        </div>
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
    QR.toDataURL("https://theatre4u.org/#/item/"+item.id, 200).then(url=>{if(url)setQr(url);});
  },[item.id, item.name]);

  const printQR=async()=>{
    const qrSrc=await QR.toDataURL("https://theatre4u.org/#/item/"+item.id,200);
    if(!qrSrc)return;
    const w=window.open("","_blank","width=420,height=520");if(!w)return;
    const loc=item.location?"Location: "+item.location:"";
    const itemUrl="theatre4u.org/#/item/"+item.id;
    const numStr = item.display_id || (item.item_number != null ? itemNum(item.item_number) : "");
    w.document.write(`<html><head><title>QR – ${item.name}</title><style>body{font-family:sans-serif;text-align:center;padding:40px}img{margin:12px 0;border:1px solid #eee;border-radius:6px}h2{margin-bottom:4px;font-size:18px}.num{font-size:22px;font-weight:900;font-family:monospace;color:#c4761a;margin:2px 0 6px}p{color:#666;font-size:13px;margin:3px 0}</style></head><body><h2>${item.name}</h2>${numStr?`<div class="num">${numStr}</div>`:""}<p>${cat.label} · ${item.condition}</p>${loc?`<p style="font-weight:700;color:#333">${loc}</p>`:""}<img src="${qrSrc}" width="200" height="200"/><p style="font-size:11px;margin-top:8px;color:#888">${itemUrl}</p><p style="font-size:11px;color:#bbb">Theatre4u™ · theatre4u.org</p><script>setTimeout(function(){window.print()},300)<\/script></body></html>`);
    w.document.close();
  };

  const dlQR=async()=>{const u=await QR.toDataURL("https://theatre4u.org/#/item/"+item.id,300);if(!u)return;const a=document.createElement("a");a.href=u;a.download="T4U-"+item.id+".png";a.click();};

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
      <div style={{display:"flex",gap:8,marginTop:16}}>
        {canEdit&&onEdit&&<button className="btn btn-p btn-sm" onClick={onEdit}><span style={{width:14,height:14,display:"flex"}}>{Ic.edit}</span>Edit</button>}
        {canDelete&&onDelete&&<button className="btn btn-d btn-sm" onClick={()=>{if(window.confirm("Delete this item?"))onDelete(item.id)}}><span style={{width:14,height:14,display:"flex"}}>{Ic.trash}</span>Delete</button>}
        {userId && <button className="btn btn-o btn-sm" onClick={()=>setShowAddToProd(true)}>🎭 Add to Production</button>}
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

function Pager({total,page,per,onPage}){
  const pages=Math.ceil(total/per);if(pages<=1)return null;
  const s=Math.max(1,page-2),e=Math.min(pages,page+2),nums=[];
  for(let i=s;i<=e;i++)nums.push(i);
  return(
    <div className="pgn">
      <button disabled={page<=1} onClick={()=>onPage(page-1)}>‹</button>
      {s>1&&<><button onClick={()=>onPage(1)}>1</button><span style={{color:"var(--faint)"}}>…</span></>}
      {nums.map(n=><button key={n} className={n===page?"on":""} onClick={()=>onPage(n)}>{n}</button>)}
      {e<pages&&<><span style={{color:"var(--faint)"}}>…</span><button onClick={()=>onPage(pages)}>{pages}</button></>}
      <button disabled={page>=pages} onClick={()=>onPage(page+1)}>›</button>
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

function Dashboard({items,org,plan="free",pointBalance=0,goInventory,goMarketplace,goCommunity,goProfile,goPoints}){
  const totalQty=items.reduce((s,i)=>s+(i.qty||1),0);
  const listed=items.filter(i=>i.mkt!=="Not Listed").length;
  const withImg=items.filter(i=>i.img).length;
  const totalVal=items.reduce((s,i)=>s+((i.sale||0)*(i.qty||1)),0);
  const cc={};items.forEach(i=>{cc[i.category]=(cc[i.category]||0)+(i.qty||1)});
  const maxC=Math.max(1,...Object.values(cc));
  const [highlights, setHighlights] = useState([]);
  useEffect(()=>{
    (async()=>{
      const{data}=await SB.from("items")
        .select("*, orgs(name,location)")
        .neq("mkt","Not Listed")
        .eq("avail","In Stock")
        .order("added",{ascending:false})
        .limit(6);
      setHighlights(data||[]);
    })();
  },[]);
  return(
    <div style={{position:"relative",padding:"32px 36px 56px"}}>
      <img src={usp(BG.dashboard,1400,900)} alt="" className="page-bg-img"/>
      <div className="page-layer">
        {/* Hero */}
        <div className="hero-wrap" style={{height:380,marginBottom:32}}>
          <img src={usp(BG.dashboard,1200,480)} alt="Grand Theatre" loading="eager"/>
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
                <div style={{fontWeight:800,fontSize:15,color:"var(--gold)"}}>Stage Points</div>
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
        <div className="sh"><h2>🎪 Community Board</h2><p>Upcoming shows, auditions, and announcements from your theatre network.</p></div>
        <CommunitySpotlight onViewAll={goCommunity}/>
        {/* Divider 1 */}
        <div className="img-div" style={{marginBottom:32}}>
          <img src={usp("photo-1503095396549-807759245b35",1000,240)} alt="Stage" loading="lazy"/>
          <div className="img-div-fade"/>
          <div className="img-div-text">
            <h3>Backstage Exchange</h3>
            <p>Browse items posted by other programs — rent, borrow, or purchase. Share your own when you're ready.</p>
          </div>
        </div>
        {/* Marketplace Highlights — auto-scrolling carousel */}
        <div className="sh"><h2>Backstage Exchange — Highlights</h2><p>Items posted for rent, sale, or loan by theatre programs in your community.</p></div>
        {highlights.length===0?(
          <div style={{background:"var(--parch)",border:"2px dashed var(--border)",borderRadius:"var(--rl)",padding:"40px 32px",textAlign:"center",marginBottom:36}}>
            <div style={{fontSize:44,marginBottom:12}}>🏪</div>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:8}}>No Listings Yet</h3>
            <p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 18px"}}>When you or other programs post items to Backstage Exchange, they'll be showcased here for the whole community to discover.</p>
            <button className="btn btn-g" onClick={()=>goMarketplace&&goMarketplace()}>Browse Backstage Exchange</button>
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
                              background:CAT_GFX[item.category]?.grad||CAT_GFX.other.grad,
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
          {CATS.map(cat=>{
            const count=items.filter(it=>it.category===cat.id).length;
            return(
              <div key={cat.id} className="cat-tile" onClick={()=>goInventory&&goInventory()}>
                <CatCard catId={cat.id} label={cat.label} icon={cat.icon} width="100%" height={160}>
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
            {CATS.map(cat=>{const c=cc[cat.id]||0;if(!c)return null;return(
              <div key={cat.id} className="bar-row">
                <span className="bar-ico">{cat.icon}</span>
                <span className="bar-lbl">{cat.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(c/maxC)*100}%`,background:cat.color}}/></div>
                <span className="bar-cnt">{c}</span>
              </div>
            );})}
          </div>
        ):(
          <div className="empty"><div className="empty-ico">🎭</div><h3>Your Stage Awaits</h3><p>Load sample data from Settings, or add your first item to begin.</p></div>
        )}
      </div>
    </div>
  );
}

function Inventory({items,onAdd,onEdit,onDelete,userId, memberRole="director",plan="free",headerNote=null,schoolName=null,org=null, deepLinkLocationId=null, onDeepLinkConsumed=null}){
    const[upgradeReason,setUpgradeReason]=useState(null);
  // Role-based permissions
  const canEdit   = memberRole !== "house";
  const canAdd    = memberRole !== "house";
  const canDelete = memberRole === "director" || memberRole === "stage_manager";

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

  const[search,setSrch]=useState("");const[catF,setCatF]=useState("all");
  const[condF,setCondF]=useState("all");const[availF,setAvailF]=useState("all");
  const[mktF,setMktF]=useState("all");const[view,setView]=useState("grid"); // grid | table | locations
  const[showF,setShowF]=useState(false);const[pg,setPg]=useState(1);
  const[modal,setModal]=useState(null);const[active,setActive]=useState(null);
  const[showImport,setShowImport]=useState(false);
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
  const maxItems = PLANS_DEF[plan]?.maxItems ?? 50;
  const nearLimit = plan==="free" && items.length >= 40 && items.length < 50;
  const atLimit   = plan==="free" && items.length >= 50;

  return(<>
    {upgradeReason&&<UpgradePrompt reason={upgradeReason} onClose={()=>setUpgradeReason(null)}/>}
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
          {atLimit?"⚠️ Item limit reached — upgrade to add more items.":"⚡ "+items.length+"/50 items used on free plan."}
        </span>
        <button className="btn btn-g" style={{padding:"5px 14px",fontSize:12}} onClick={()=>setUpgradeReason("Upgrade to Pro for unlimited inventory, Backstage Exchange access, Stage Points, and more.")}>Upgrade →</button>
      </div>
    )}
    <div style={{position:"relative"}}>
      <img src={usp(BG.inventory,1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:240}}>
          <img src={usp(BG.inventory,1100,300)} alt="Stage" loading="lazy"/>
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
          <div style={{marginLeft:"auto",display:"flex",gap:7}}>
            <button className="btn btn-o" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setShowImport(true)}
              title="Import from CSV">⬆ Import CSV</button>
            {canAdd&&<button className="btn btn-g" onClick={()=>{
              const max=PLANS_DEF[plan]?.maxItems??50;
              if(items.length>=max){setUpgradeReason(EM.planItemLimit.body);return;}
              setActive(null);setModal("a");
            }}><span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add Item</button>}
          </div>
        </div>
        {showF&&(
          <div className="fbar fin">
            <div><label>Category</label><select value={catF} onChange={e=>setCatF(e.target.value)}><option value="all">All</option>{CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label>Condition</label><select value={condF} onChange={e=>setCondF(e.target.value)}><option value="all">All</option>{CONDS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label>Availability</label><select value={availF} onChange={e=>setAvailF(e.target.value)}><option value="all">All</option>{AVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
            <div><label>Exchange Status</label><select value={mktF} onChange={e=>setMktF(e.target.value)}><option value="all">All</option>{MKT.map(s=><option key={s}>{s}</option>)}</select></div>
            <button className="btn btn-o btn-sm" onClick={()=>{setCatF("all");setCondF("all");setAvailF("all");setMktF("all")}}>Clear</button>
          </div>
        )}
        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>{filtered.length} item{filtered.length!==1?"s":""}</div>
        {view==="grid"&&(paged.length===0
          ?<div className="empty"><div className="empty-ico">🎭</div><h3>No Items Found</h3><p>{items.length===0?"Add your first item to build your catalog.":"Try adjusting search or filters."}</p>{items.length===0&&<button className="btn btn-g" onClick={()=>{setActive(null);setModal("a")}}><span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add First Item</button>}</div>
          :<div className="inv-grid">
              {paged.map(item=>{
                const cat=CAT[item.category]||CAT.other;
                return(
                  <div key={item.id} className="inv-card" onClick={()=>openD(item)}>
                    <div className="inv-img">{item.img?<img src={item.img} alt={item.name} loading="lazy"/>:<CatCard catId={item.category} width="100%" height={220}><div style={{padding:"0 14px 12px",color:"#fff"}}></div></CatCard>}</div>
                    <div className="inv-body">
                      {schoolName&&<div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:"#42a5f5",marginBottom:4,display:"flex",alignItems:"center",gap:4}}><span>🏫</span>{schoolName}</div>}
                      <div className="inv-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</div>
                      <div className="inv-name">{item.name}</div>
                      {item.location&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:4,display:"flex",alignItems:"center",gap:3}}>📍 {item.location}</div>}
                      <div className="inv-meta">{item.display_id&&<span className="chip" style={{fontFamily:"monospace",fontWeight:800,color:"var(--amber)",letterSpacing:.5}}>{item.display_id}</span>}<span className="chip">{item.condition}</span><span className="chip">×{item.qty}</span>{item.size!=="N/A"&&<span className="chip">{item.size}</span>}<span className="chip">{item.avail}</span></div>
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
              <thead><tr><th style={{width:60}}>#</th><th></th><th>Item</th><th>Category</th><th>Cond.</th><th>Qty</th><th>Location</th><th>Avail.</th><th>Market</th><th></th></tr></thead>
              <tbody>
                {paged.map(item=>{
                  const cat=CAT[item.category]||CAT.other;
                  return(
                    <tr key={item.id}>
                      <td style={{padding:"4px 10px",fontFamily:"monospace",fontSize:12,fontWeight:800,color:"var(--amber)",whiteSpace:"nowrap"}}>{item.display_id||""}</td>
                      <td style={{width:40,padding:"4px 8px"}}>{item.img?<img src={item.img} alt="" style={{width:32,height:32,borderRadius:4,objectFit:"cover"}}/>:<CatThumb catId={item.category} size={32}/>}</td>
                      <td style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:15,cursor:"pointer",color:"var(--ink)"}} onClick={()=>openD(item)}>{item.name}</td>
                      <td style={{fontWeight:700,color:"var(--muted)"}}>{cat.icon} {cat.label}</td>
                      <td>{item.condition}</td><td style={{fontWeight:800}}>{item.qty}</td>
                      <td style={{color:"var(--muted)"}}>
                        {schoolName&&<div style={{fontSize:10,fontWeight:800,color:"#42a5f5",marginBottom:2}}>🏫 {schoolName}</div>}
                        {item.location||"—"}
                      </td>
                      <td>{item.avail}</td>
                      <td><span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span></td>
                      <td><div style={{display:"flex",gap:4}}>
                        <button className="ico-btn" onClick={e=>{e.stopPropagation();openE(item)}}>{Ic.edit}</button>
                        {canDelete&&<button className="ico-btn" style={{color:"var(--red)"}} onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))onDelete(item.id)}}>{Ic.trash}</button>}
                      </div></td>
                    </tr>
                  );
                })}
                {paged.length===0&&<tr><td colSpan={9} style={{textAlign:"center",color:"var(--faint)",padding:40,fontFamily:"'Lora',serif",fontStyle:"italic"}}>No items found</td></tr>}
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
          <ItemForm onSave={handleSave} onCancel={()=>setModal(null)} userId={userId} marketplaceEnabled={!!org?.marketplace_enabled}/>
        </Modal>)}
      {modal==="e"&&active&&(<Modal title="Edit Item" onClose={()=>setModal(null)}
         >
          <ItemForm item={active} onSave={handleSave} onCancel={()=>setModal(null)} userId={userId} marketplaceEnabled={!!org?.marketplace_enabled}/>
        </Modal>)}
      {modal==="d"&&active&&<Modal title="Item Details" onClose={()=>{setModal(null);setActive(null)}}><ItemDetail item={active} userId={userId} schoolName={schoolName} onEdit={canEdit?()=>setModal("e"):null} onDelete={canDelete?(id=>{onDelete(id);setModal(null);setActive(null)}):null} canEdit={canEdit} canDelete={canDelete}/></Modal>}
      {showImport&&<CSVImport userId={userId} onClose={()=>setShowImport(false)} onImport={async()=>{setShowImport(false);const{data}=await SB.from("items").select("*").eq("org_id",user?.id).order("added",{ascending:false});if(data)setItems(data);}}/>}
    </div>
  </>
  );
}
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"Washington DC"};

// Free zip code lookup — no API key needed
async function zipToCoords(zip) {
  // Try zippopotam.us first (fast, reliable for most zips)
  try {
    const zc1 = new AbortController();
    setTimeout(()=>zc1.abort(),5000);
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`,{signal:zc1.signal});
    if (res.ok) {
      const d = await res.json();
      const place = d.places?.[0];
      if (place) return {
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        city: place["place name"],
        state: place["state abbreviation"],
      };
    }
  } catch { /* fall through */ }

  // Fallback 1: Nominatim postal code search
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
      { headers: { "User-Agent": "Theatre4u/1.0 (hello@theatre4u.org)" } }
    );
    const data = await r.json();
    if (data?.[0]) return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      city: data[0].display_name?.split(",")[0] || zip,
      state: "CA",
    };
  } catch { /* fall through */ }

  // Fallback 2: US Census Bureau geocoder (no key, authoritative)
  try {
    const r = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/address?street=&city=&state=&zip=${zip}&benchmark=Public_AR_Current&format=json`
    );
    const d = await r.json();
    const match = d?.result?.addressMatches?.[0];
    if (match) return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      city: match.addressComponents?.city || zip,
      state: match.addressComponents?.state || "",
    };
  } catch { /* fall through */ }

  return null;
}

// Haversine distance in miles (client-side for instant filtering)
function milesBetween(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
      .select("*, orgs(name,location,state,zipcode,lat,lng,marketplace_enabled)")
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
    <div style={{position:"relative",minHeight:"80vh",overflow:"hidden"}}>
      {/* Blurred background preview of the Exchange */}
      <div style={{filter:"blur(3px)",opacity:.45,pointerEvents:"none",userSelect:"none"}}>
        <img src={usp(BG.marketplace,1400,900)} alt="" className="page-bg-img"/>
        <div style={{padding:"32px 36px 0"}}>
          <div className="hero-wrap" style={{height:280}}>
            <img src={usp(BG.marketplace,1100,340)} alt="Backstage Exchange" loading="eager"/>
            <div className="hero-fade"/>
            <div className="hero-body">
              <div className="hero-eyebrow">🏪 Backstage Exchange</div>
              <h1 className="hero-title" style={{fontSize:46}}>Backstage Exchange</h1>
              <p className="hero-sub">Rent, buy, or loan theatre assets from programs near you.</p>
            </div>
            <div className="hero-bar"/>
          </div>
        </div>
        <div style={{padding:"24px 36px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {["Victorian Ball Gown — Blue","LED Par Can RGBW 54×3W","Fog Machine 1000W","Wireless Mic Pack","Forest Backdrop 8×12ft","Foam Rubber Swords (8pc)"].map(n=>(
            <div key={n} className="card card-p" style={{opacity:.8}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>{n}</div>
              <div style={{fontSize:12,color:"var(--muted)"}}>Ocean View Drama · For Rent</div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--gold)",marginTop:8}}>$20–45/wk</div>
            </div>
          ))}
        </div>
      </div>
      {/* Upgrade overlay */}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",
        background:"rgba(10,7,18,.65)",backdropFilter:"blur(2px)",zIndex:10,
        padding:"clamp(12px,4vw,40px)",overflowY:"auto"}}>
        <div className="card card-p" style={{maxWidth:420,width:"100%",textAlign:"center",
          background:"linear-gradient(135deg,#1e1208,#150f1f)",
          border:"1.5px solid rgba(212,168,67,.4)",boxShadow:"0 12px 48px rgba(0,0,0,.6)",
          margin:"auto"}}>
          <div style={{fontSize:36,marginBottom:8}}>🏪</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:8,color:"var(--linen)"}}>
            Backstage Exchange
          </h2>
          <p style={{color:"var(--muted)",fontSize:13,margin:"0 auto 16px",lineHeight:1.6}}>
            Browse props, costumes, lighting, and sound equipment from nearby programs. Rent, loan, or buy — and list your own items to earn Stage Points.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18,textAlign:"left"}}>
            {[["🔍","Browse nearby inventory"],["📦","Request rent or loan"],["🪙","Earn Stage Points"],["🎭","Free district loans"]].map(([icon,text])=>(
              <div key={text} style={{display:"flex",gap:6,alignItems:"flex-start",padding:"7px 9px",
                background:"rgba(255,255,255,.04)",borderRadius:8,border:"1px solid rgba(255,255,255,.06)"}}>
                <span style={{fontSize:15,flexShrink:0}}>{icon}</span>
                <span style={{fontSize:11,color:"var(--muted)",lineHeight:1.4}}>{text}</span>
              </div>
            ))}
          </div>
          <UpgradePlans compact={true}/>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.marketplace,1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:280}}>
          <img src={usp(BG.marketplace,1100,340)} alt="Backstage Exchange" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🏪 Backstage Exchange</div>
            <h1 className="hero-title" style={{fontSize:46}}>Backstage Exchange</h1>
            <p className="hero-sub">Rent or buy costumes, props, lighting, sound and more from programs near you. Give assets a second life.</p>
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
          </div>
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
        </div>

        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>
          {loadingAll?"Loading listings…":`${filtered.length} listing${filtered.length!==1?"s":""}`}
          {userCoords&&radius!=="all"&&!loadingAll&&` within ${radius==="state"?STATE_NAMES[userCoords.state]||userCoords.state:radius+" miles"}`}
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
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        }
        <Pager total={filtered.length} page={pg} per={PP} onPage={setPg}/>
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
          {saving ? "Saving…" : `${dt.icon} Finalize ${dt.label}`}
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
      @media print{.shell,.lpn,.overlay-backdrop{display:none!important}#t4u-qr-poster-inner{display:block!important}}
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

function Reports({ items, plan="free", org=null }) {
  const [tab,setTab] = useState("overview");
  const totalQty  = items.reduce((s,i)=>s+(i.qty||1),0);
  const catData   = CATS.map(cat=>{const ci=items.filter(i=>i.category===cat.id);return{...cat,count:ci.length,qty:ci.reduce((s,i)=>s+(i.qty||1),0),val:ci.reduce((s,i)=>s+((i.sale||0)*(i.qty||1)),0)}}).filter(c=>c.count>0);
  const condData  = CONDS.map(c=>({l:c,n:items.filter(i=>i.condition===c).length})).filter(c=>c.n>0);
  const availData = AVAIL.map(a=>({l:a,n:items.filter(i=>i.avail===a).length})).filter(a=>a.n>0);
  const mktData   = MKT.map(s=>({l:s,n:items.filter(i=>i.mkt===s).length})).filter(m=>m.n>0);
  const maxN = n => Math.max(1,n);
  const locData = Object.entries(
    items.reduce((acc,i)=>{
      const loc=i.location||"Unassigned";
      if(!acc[loc]) acc[loc]={count:0,qty:0,items:[]};
      acc[loc].count++;
      acc[loc].qty+=(i.qty||1);
      acc[loc].items.push(i);
      return acc;
    },{})
  ).sort((a,b)=>b[1].qty-a[1].qty);

  const csv = () => {
    const h=["Name","Category","Condition","Size","Qty","Location","Availability","Market","Rent","Sale","Loan Period (wks)","Deposit","Tags","Image URL","Notes","ID","Added"];
    const rows=items.map(i=>[i.name,i.category,i.condition,i.size,i.qty,i.location,i.avail,i.mkt,i.rent,i.sale,i.loan_period||"",i.deposit||"",(i.tags||[]).join(";"),i.img||"",`"${(i.notes||"").replace(/"/g,'""')}"`,i.id,i.added]);
    const csv=[h,...rows].map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="theatre4u_inventory.csv";a.click();
  };

  const printAllQR = async () => {
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<html><head><title>Theatre4u™ QR Labels</title></head><body style="font-family:sans-serif;padding:16px"><h2 style="font-size:14px;margin-bottom:16px;color:#333">Theatre4u™ — QR Labels (${items.length} items)</h2><div id="lbl">Generating…</div></body></html>`);w.document.close();
    const srcs=await Promise.all(items.map(i=>QR.toDataURL("https://theatre4u.org/#/item/"+i.id,140)));
    const labels=items.map((i,n)=>`<div style="display:inline-block;text-align:center;padding:10px;border:1px dashed #ccc;margin:5px;width:160px;vertical-align:top"><img src="${srcs[n]||""}" width="100" height="100"/><div style="font-size:10px;font-weight:700;margin-top:5px;word-break:break-word">${i.name}</div><div style="font-size:8px;color:#888;margin-top:2px">${i.category} · ${i.id.slice(0,8)}</div></div>`).join("");
    const el=w.document.getElementById("lbl");if(el){el.outerHTML=labels;setTimeout(()=>w.print(),400);}
  };

  if(plan==="free") return(
    <div style={{padding:"40px 20px",textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:14}}>📊</div>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:10}}>Reports is a Pro Feature</h2>
      <p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 24px",lineHeight:1.6}}>Get detailed analytics, condition reports, location breakdowns, and CSV export. Upgrade to Pro to unlock Reports.</p>
      <UpgradePlans compact={true}/>
    </div>
  );

  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.reports,1400,900)} alt="" className="page-bg-img"/>

      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:230}}>
          <img src={usp(BG.reports,1100,290)} alt="Reports" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📊 Analytics</div>
            <h1 className="hero-title" style={{fontSize:44}}>Reports</h1>
            <p className="hero-sub">Breakdowns, condition tracking, and data exports for your program.</p>
          </div>
          <div style={{position:"absolute",bottom:24,right:30,zIndex:2,display:"flex",gap:8}}>
            <button className="btn" style={{background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.55)",color:"#fff",backdropFilter:"blur(6px)",fontWeight:600}} onClick={printAllQR}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              Print All QR
            </button>
            <button className="btn btn-g" onClick={csv}><span style={{width:14,height:14,display:"flex"}}>{Ic.dl}</span>Export CSV</button>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 48px",position:"relative",zIndex:1}}>
        <div className="tabs">
          {[["overview","Overview"],["condition","Condition"],["availability","Availability"],["market","Backstage Exchange"],["location","Locations"],["usage","📊 Platform Usage"]].map(([t,l])=>(
            <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {tab==="overview"&&(
          <div className="card card-p">
            <div className="sh"><h2>Category Breakdown</h2></div>
            <div className="tw">
              <table>
                <thead><tr><th>Category</th><th>Entries</th><th>Total Qty</th><th>Est. Value</th></tr></thead>
                <tbody>
                  {catData.map(c=>(
                    <tr key={c.id}>
                      <td style={{fontWeight:700}}>{c.icon} {c.label}</td>
                      <td>{c.count}</td>
                      <td style={{fontWeight:800}}>{c.qty}</td>
                      <td style={{fontFamily:"'Playfair Display',serif",color:"var(--cog)",fontSize:16}}>{c.val>0?fmt$(c.val):"—"}</td>
                    </tr>
                  ))}
                  <tr style={{background:"var(--parch)"}}>
                    <td style={{fontFamily:"'Playfair Display',serif",fontSize:17}}>Total</td>
                    <td style={{fontWeight:800}}>{items.length}</td>
                    <td style={{fontWeight:800}}>{totalQty}</td>
                    <td style={{fontFamily:"'Playfair Display',serif",color:"var(--cog)",fontSize:18}}>{fmt$(catData.reduce((s,c)=>s+c.val,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="condition"&&(
          <div className="card card-p">
            <div className="sh"><h2>Condition Report</h2></div>
            {condData.map(c=>(
              <div className="bar-row" key={c.l}>
                <span className="bar-lbl" style={{width:110}}>{c.l}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(c.n/maxN(items.length))*100}%`,background:c.l==="New"?"#4caf50":c.l==="Excellent"?"#66bb6a":c.l==="Good"?"#42a5f5":"#ffa726"}}/></div>
                <span className="bar-cnt">{c.n}</span>
              </div>
            ))}
            {condData.length===0&&<p style={{color:"var(--faint)",fontStyle:"italic",fontFamily:"'Lora',serif"}}>No data yet.</p>}
          </div>
        )}

        {tab==="availability"&&(
          <div className="card card-p">
            <div className="sh"><h2>Availability</h2></div>
            {availData.map(a=>(
              <div className="bar-row" key={a.l}>
                <span className="bar-lbl" style={{width:130}}>{a.l}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(a.n/maxN(items.length))*100}%`,background:a.l==="In Stock"?"#4caf50":a.l==="In Use"?"#42a5f5":"#ffa726"}}/></div>
                <span className="bar-cnt">{a.n}</span>
              </div>
            ))}
          </div>
        )}

        {tab==="market"&&(
          <div className="card card-p">
            <div className="sh"><h2>Exchange Status</h2></div>
            {mktData.map(m=>(
              <div className="bar-row" key={m.l}>
                <span className="bar-lbl" style={{width:130}}>{m.l}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(m.n/maxN(items.length))*100}%`,background:m.l.includes("Rent")?"#42a5f5":m.l.includes("Sale")?"#4caf50":m.l==="Rent or Sale"?"#d4a843":"#aaa"}}/></div>
                <span className="bar-cnt">{m.n}</span>
              </div>
            ))}
          </div>
        )}

        {tab==="location"&&(
          <div className="card card-p">
            <div className="sh"><h2>Items by Location</h2><p>Where everything is stored across your facility.</p></div>
            {locData.length===0
              ? <p style={{color:"var(--muted)",textAlign:"center",padding:24}}>No items yet.</p>
              : locData.map(([loc,data])=>(
                <div key={loc} style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
                    <span style={{fontSize:18}}>📍</span>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:17}}>{loc}</span>
                    <span style={{marginLeft:"auto",background:"var(--linen)",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700,color:"var(--muted)"}}>{data.qty} item{data.qty!==1?"s":""}</span>
                  </div>
                  <div className="tw">
                    <table>
                      <thead><tr><th>Item</th><th>Category</th><th>Condition</th><th>Qty</th><th>Availability</th></tr></thead>
                      <tbody>
                        {data.items.map(item=>{
                          const cat=CAT[item.category]||CAT.other;
                          return(
                            <tr key={item.id}>
                              <td style={{fontWeight:700}}>{item.name}</td>
                              <td>{cat.icon} {cat.label}</td>
                              <td>{item.condition}</td>
                              <td style={{fontWeight:800}}>{item.qty}</td>
                              <td><span style={{padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,background:item.avail==="In Stock"?"rgba(76,175,80,.15)":"rgba(66,165,245,.15)",color:item.avail==="In Stock"?"#2e7d32":"#1565c0"}}>{item.avail}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            }
          </div>
        )}
        {tab==="usage"&&(
          <PlatformUsageReport items={items} org={org} plan={plan}/>
        )}

      </div>
    </div>
  );
}

// ── Upgrade prompt modal ─────────────────────────────────────────────────────
function UpgradePrompt({ reason, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fdf6ec",border:"1px solid var(--gold)",borderRadius:14,width:"100%",maxWidth:520,padding:28,boxShadow:"0 8px 48px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:36,marginBottom:10}}>⭐</div>
          <h2 style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:22,marginBottom:8}}>Upgrade to Continue</h2>
          <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.6}}>{reason}</p>
        </div>
        <UpgradePlans compact={true}/>
        <button onClick={onClose} style={{display:"block",margin:"16px auto 0",background:"none",border:"none",color:"var(--faint)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Maybe later</button>
      </div>
    </div>
  );
}

// ── Shared upgrade/pricing component — used in Settings + any upsell modal ────
const STRIPE_LINKS = {
  pro:        { monthly:"https://buy.stripe.com/fZu4gyeF39lpdu31AngA808", annual:"https://buy.stripe.com/fZu3cu40p2X11Ll5QDgA809" },
  district:   { monthly:"https://buy.stripe.com/aFa4gydAZ2X1cpZ6UHgA800", annual:"https://buy.stripe.com/eVqdR88gF1SX9dN0wjgA802" },
  district_m: { monthly:"https://buy.stripe.com/5kQ00ieF3aptahRbaXgA806", annual:"https://buy.stripe.com/6oU7sK68x41575F5QDgA807" },
  district_l: { monthly:"https://buy.stripe.com/6oU28q2Wl8hlgGfdj5gA804", annual:"https://buy.stripe.com/eVq00ieF37dhahR2ErgA805" },
};
function stripeLink(baseUrl, userId, userEmail) {
  if (!baseUrl || baseUrl === "#") return "#";
  try {
    const url = new URL(baseUrl);
    if (userId)    url.searchParams.set("client_reference_id", userId);
    if (userEmail) url.searchParams.set("prefilled_email", userEmail);
    return url.toString();
  } catch { return baseUrl; }
}
// ── Plan definitions ─────────────────────────────────────────────────────────
const PLANS_DEF = {
  free:     { label:"Free",     maxItems:50,  marketplace:false, reports:false, monthlyPrice:0,  annualPrice:0   },
  pro:      { label:"Pro",      maxItems:Infinity, marketplace:true,  reports:true,  monthlyPrice:12, annualPrice:120 },
  district: { label:"District", maxItems:Infinity, marketplace:true,  reports:true,  monthlyPrice:49, annualPrice:500 },
};
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
const UPGRADE_PLANS = [
  { id:"free",     name:"Free",     monthlyPrice:"$0",  annualPrice:"Free",   per:"/forever", annualNote:null,       desc:"Perfect for getting started.",     hot:false,
    feats:["Up to 50 items","QR code labels","Photo uploads","CSV export"] },
  { id:"pro",      name:"Pro",      monthlyPrice:"$15", annualPrice:"$12.50",  annualTotal:"$150/yr", per:"/month", annualNote:"save $30", desc:"For active programs & companies.", hot:true,
    feats:["Unlimited inventory","Full Backstage Exchange access","Photo storage 5GB","Analytics dashboard","Email support"] },
  { id:"district", name:"District S", monthlyPrice:"$49", annualPrice:"$42",  annualTotal:"$500/yr", per:"/month", annualNote:"save $88", desc:"Up to 6 schools — all Pro features.", hot:false,
    feats:["Multiple organizations","District dashboard","Bulk import","Dedicated support","Everything in Pro"] },
  { id:"district_m", name:"District M", monthlyPrice:"$99", annualPrice:"$83",  annualTotal:"$999/yr",   per:"/month", annualNote:"save $189", desc:"Up to 15 schools — 54% savings.", hot:false,
    feats:["Everything in District S","Up to 15 school sites","District dashboard","Priority support","Dedicated onboarding"] },
  { id:"district_l", name:"District L", monthlyPrice:"$179", annualPrice:"$150", annualTotal:"$1,799/yr", per:"/month", annualNote:"save $349", desc:"Up to 30 schools — 58% savings.", hot:false,
    feats:["Everything in District M","Up to 30 school sites","District dashboard","Training webinar","Custom reporting"] },
  { id:"enterprise",  name:"Enterprise", monthlyPrice:"Custom", annualPrice:"Custom", per:"", annualNote:null, desc:"Large districts — custom contract.", hot:false,
    feats:["Everything in District L","Unlimited schools","Custom PO/invoicing","Data Processing Agreement","Dedicated support","Custom pricing"] },
];


// ── Invoice Request Form — sends automated invoice via edge function ──────────
function InvoiceRequestForm({ orgName, userEmail }) {
  const [form, setForm] = useState({ name: orgName||"", email: userEmail||"", plan: "pro", period: "annual", contact: "", po: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState("");
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const submit = async () => {
    if(!form.name.trim()||!form.email.trim()||!form.contact.trim()) { setErr("Please fill in Organization, Email, and Contact Name."); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/invoice-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if(json.success) setDone(true);
      else setErr(json.error || "Something went wrong. Please email hello@theatre4u.org directly.");
    } catch(e) {
      setErr("Connection error. Please email hello@theatre4u.org directly.");
    }
    setSending(false);
  };

  if(done) return (
    <div style={{marginTop:16,padding:16,background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.3)",borderRadius:10,textAlign:"center"}}>
      <div style={{fontSize:28,marginBottom:8}}>✅</div>
      <div style={{fontWeight:700,fontSize:15,color:"var(--text)",marginBottom:4}}>Invoice request sent!</div>
      <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>Check your inbox — we sent a copy to <strong>{form.email}</strong> and will follow up within one business day. Questions? Email <a href="mailto:hello@theatre4u.org" style={{color:"var(--gold)"}}>hello@theatre4u.org</a>.</div>
    </div>
  );

  const inputStyle = { width:"100%", background:"var(--bgi,#110f18)", border:"1px solid var(--border,#282333)", borderRadius:6, padding:"8px 10px", color:"var(--text,#ede8df)", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", boxSizing:"border-box" };
  const labelStyle = { fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:3 };

  return (
    <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <label style={labelStyle}>Organization Name *</label>
          <input style={inputStyle} value={form.name} onChange={e=>upd("name",e.target.value)} placeholder="Lincoln High Drama Dept."/>
        </div>
        <div>
          <label style={labelStyle}>Contact Email *</label>
          <input style={inputStyle} type="email" value={form.email} onChange={e=>upd("email",e.target.value)} placeholder="you@school.edu"/>
        </div>
        <div>
          <label style={labelStyle}>Contact Name *</label>
          <input style={inputStyle} value={form.contact} onChange={e=>upd("contact",e.target.value)} placeholder="Jane Smith, AP Coordinator"/>
        </div>
        <div>
          <label style={labelStyle}>PO Number (if available)</label>
          <input style={inputStyle} value={form.po} onChange={e=>upd("po",e.target.value)} placeholder="PO-2026-XXXX or leave blank"/>
        </div>
        <div>
          <label style={labelStyle}>Plan</label>
          <select style={{...inputStyle,cursor:"pointer"}} value={form.plan} onChange={e=>upd("plan",e.target.value)}>
            <option value="pro">Pro — $15/month or $150/year</option>
            <option value="district">District — $49/month or $500/year</option>
            <option value="enterprise">Enterprise — Custom (district will contact)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Billing Period</label>
          <select style={{...inputStyle,cursor:"pointer"}} value={form.period} onChange={e=>upd("period",e.target.value)}>
            <option value="annual">Annual (best value)</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      {err && <div style={{fontSize:12.5,color:"#e57373",padding:"8px 10px",background:"rgba(194,24,91,.08)",borderRadius:6,border:"1px solid rgba(194,24,91,.2)"}}>{err}</div>}
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-g" style={{flex:1}} onClick={submit} disabled={sending}>
          {sending ? "Sending…" : "✉️ Send Me an Invoice"}
        </button>
        <a href="mailto:hello@theatre4u.org?subject=District Enterprise Inquiry" className="btn btn-o" style={{flex:1,textDecoration:"none",display:"flex",justifyContent:"center"}}>
          🏫 Enterprise / PO Inquiry
        </a>
      </div>
      <div style={{fontSize:11,color:"var(--faint)",lineHeight:1.6}}>
        We will email a formal invoice to you within one business day. Payment by check payable to <strong>Artstracker LLC</strong>. Net-30 available for districts.
      </div>
    </div>
  );
}

function UpgradePlans({ compact = false, userId = null, userEmail = null }) {
  const [billing, setBilling] = useState("monthly");
  return (
    <div>
      {/* Toggle */}
      <div style={{display:"flex",alignItems:"center",background:"var(--parch)",border:"1px solid var(--border)",borderRadius:8,padding:3,width:"fit-content",margin:compact?"0 0 16px":"0 auto 20px"}}>
        <button onClick={()=>setBilling("monthly")} style={{background:billing==="monthly"?"var(--gold)":"transparent",color:billing==="monthly"?"#1a0f00":"var(--muted)",border:"none",borderRadius:5,padding:"6px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
          Monthly
        </button>
        <button onClick={()=>setBilling("annual")} style={{background:billing==="annual"?"var(--gold)":"transparent",color:billing==="annual"?"#1a0f00":"var(--muted)",border:"none",borderRadius:5,padding:"6px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s",display:"flex",alignItems:"center",gap:6}}>
          Annual <span style={{fontSize:10,padding:"1px 6px",background:billing==="annual"?"rgba(0,0,0,.15)":"rgba(212,168,67,.15)",color:billing==="annual"?"#1a0f00":"var(--gold)",borderRadius:9,fontWeight:700}}>Save 17%</span>
        </button>
        <button onClick={()=>setBilling("invoice")} style={{background:billing==="invoice"?"var(--gold)":"transparent",color:billing==="invoice"?"#1a0f00":"var(--muted)",border:"none",borderRadius:5,padding:"6px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s",display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:11}}>🏛️</span> Check / PO
        </button>
      </div>
      {/* Cards */}
      <div style={{display:"grid",gridTemplateColumns:compact?"1fr":"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
        {UPGRADE_PLANS.map(p=>{
          const price   = billing==="annual" ? p.annualPrice : p.monthlyPrice;
          const note    = billing==="annual" ? p.annualNote  : null;
          const link    = stripeLink(STRIPE_LINKS[p.id]?.[billing], userId, userEmail);
          const isFree  = p.id==="free";
          return (
            <div key={p.id} style={{border:"1.5px solid "+(p.hot?"var(--gold)":"rgba(212,168,67,.2)"),borderRadius:10,padding:16,background:p.hot?"#241808":"#1e1208",position:"relative",display:"flex",flexDirection:"column",color:"#f0e6d3"}}>
              {p.hot && <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:"var(--gold)",color:"#1a0f00",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"2px 10px",borderRadius:9,whiteSpace:"nowrap"}}>Most Popular</div>}
              <div style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:16,fontWeight:700,marginBottom:4,color:"#f0e6d3"}}>{p.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:2}}>
                <span style={{fontSize:26,fontWeight:800,color:"var(--gold)"}}>{price}</span>
                {!isFree && <span style={{fontSize:12,color:"rgba(240,230,211,.5)"}}>{p.per}</span>}
              </div>
              {billing==="annual" && !isFree && p.annualTotal && <div style={{fontSize:11,color:"rgba(240,230,211,.45)",marginBottom:2}}>billed {p.annualTotal}</div>}
              {note && <div style={{fontSize:11,color:"var(--grn,#4caf50)",fontWeight:600,marginBottom:6}}>{note}</div>}
              <div style={{fontSize:12,color:"rgba(240,230,211,.65)",marginBottom:10}}>{p.desc}</div>
              <ul style={{listStyle:"none",padding:0,margin:"0 0 14px",flex:1}}>
                {p.feats.map(f=>(
                  <li key={f} style={{display:"flex",alignItems:"flex-start",gap:6,fontSize:12,color:"rgba(240,230,211,.75)",marginBottom:4}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" style={{flexShrink:0,marginTop:1}}><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              {isFree
                ? <button className="btn btn-full" style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"rgba(240,230,211,.6)",cursor:"default",fontWeight:600,fontSize:13}} disabled>✓ Current Free Plan</button>
                : p.id==="enterprise"
                  ? <a href="mailto:hello@theatre4u.org?subject=Enterprise District Inquiry" className="btn btn-full" style={{textDecoration:"none",display:"flex",justifyContent:"center",marginTop:"auto",background:"linear-gradient(135deg,#1565c0,#0d47a1)",border:"1px solid rgba(66,133,244,.4)",color:"#fff",fontWeight:700,boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>Contact Us →</a>
                  : (!link || link === "undefined" || link.endsWith("undefined"))
                    ? <a href="mailto:hello@theatre4u.org?subject=District Plan Inquiry" className="btn btn-full" style={{textDecoration:"none",display:"flex",justifyContent:"center",marginTop:"auto",background:"linear-gradient(135deg,#b8952a,#8a6e1e)",border:"1px solid rgba(212,168,67,.4)",color:"#fff",fontWeight:700,boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>Contact Us →</a>
                    : <a href={link} target="_blank" rel="noreferrer" className={"btn btn-full "+(p.hot?"btn-g":"")} style={{textDecoration:"none",display:"flex",justifyContent:"center",marginTop:"auto",...(!p.hot?{background:"linear-gradient(135deg,#b8952a,#8a6e1e)",border:"1px solid rgba(212,168,67,.4)",color:"#fff",fontWeight:700,boxShadow:"0 2px 8px rgba(0,0,0,.3)"}:{})}}>
                    {billing==="annual" ? "Get "+p.name+" Annual →" : "Get "+p.name+" →"}
                  </a>
              }
            </div>
          );
        })}
      </div>
      {billing === "invoice" ? (
        <div style={{marginTop:16,background:"rgba(212,168,67,.06)",border:"1.5px solid rgba(212,168,67,.25)",borderRadius:12,padding:20}}>
          <div style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:17,fontWeight:700,color:"var(--gold)",marginBottom:6}}>🏛️ Pay by Check or Purchase Order</div>
          <p style={{fontSize:13,color:"var(--text)",lineHeight:1.7,marginBottom:14}}>
            School districts and organizations that cannot pay by credit card can subscribe via check or purchase order.
            We will issue a formal invoice and accept payment by school check, district PO, or ACH transfer.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div style={{background:"rgba(0,0,0,.2)",borderRadius:8,padding:12}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",marginBottom:6}}>Pro Plan</div>
              <div style={{fontSize:20,fontWeight:800,color:"#f0e6d3",marginBottom:2}}>$12<span style={{fontSize:12,color:"rgba(240,230,211,.5)"}}>/month</span></div>
              <div style={{fontSize:11,color:"rgba(240,230,211,.5)",marginBottom:8}}>or $120/year (billed annually)</div>
              <div style={{fontSize:12,color:"rgba(240,230,211,.7)"}}>Unlimited inventory · Backstage Exchange · Funding Tracker · Team sharing</div>
            </div>
            <div style={{background:"rgba(0,0,0,.2)",borderRadius:8,padding:12}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",marginBottom:6}}>District Plan</div>
              <div style={{fontSize:20,fontWeight:800,color:"#f0e6d3",marginBottom:2}}>$49<span style={{fontSize:12,color:"rgba(240,230,211,.5)"}}>/month</span></div>
              <div style={{fontSize:11,color:"rgba(240,230,211,.5)",marginBottom:8}}>or $500/year (billed annually)</div>
              <div style={{fontSize:12,color:"rgba(240,230,211,.7)"}}>All Pro features · Multiple schools · District dashboard</div>
            </div>
          </div>
          <div style={{fontSize:12.5,color:"var(--muted)",lineHeight:1.7,marginBottom:14}}>
            <strong style={{color:"var(--text)"}}>To get started:</strong> Email us at{" "}
            <a href="mailto:hello@theatre4u.org?subject=Check/PO Subscription Request&body=Hi, I would like to subscribe to Theatre4u via check/purchase order.%0A%0AOrganization name:%0APlan requested (Pro / District):%0ABilling period (monthly / annual):%0AContact name:%0APO number (if applicable):%0AAccounts payable email:" style={{color:"var(--gold)"}}>hello@theatre4u.org</a>
            {" "}with your organization name, plan, and billing period. We will send a formal invoice within one business day.
          </div>
          <InvoiceRequestForm orgName={userId||""} userEmail={userEmail||""} />
          <div style={{marginTop:12,fontSize:11,color:"var(--faint)",lineHeight:1.6}}>
            Payment by check should be made payable to <strong style={{color:"var(--text)"}}>Artstracker LLC</strong>.
            Purchase orders are accepted from accredited educational institutions.
            Net-30 terms available for district accounts. Questions? Call or email — we respond personally.
          </div>
        </div>
      ) : (
        <p style={{textAlign:compact?"left":"center",marginTop:12,fontSize:11.5,color:"var(--faint)"}}>All paid plans include a 14-day free trial · No credit card required to start · Cancel any time</p>
      )}
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// DISTRICT DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function DistrictDashboard({ user, plan, onSwitchSchool }) {
  const [district,   setDistrict]   = useState(null);
  const [schools,    setSchools]    = useState([]);
  const [invites,    setInvites]    = useState([]);
  const [itemCounts, setItemCounts] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("schools"); // schools | invites
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail,   setInvEmail]   = useState("");
  const [invSchool,  setInvSchool]  = useState("");
  const [sending,    setSending]    = useState(false);
  const [msg,        setMsg]        = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Load or create district record for this user
    let { data: dist } = await SB.from("districts").select("*").eq("owner_id", user.id).single();
    if (!dist) {
      // Auto-create district on first visit
      const { data: newDist } = await SB.from("districts")
        .insert({ owner_id: user.id, name: "", max_schools: 6 })
        .select().single();
      dist = newDist;
    }
    setDistrict(dist);

    // Load schools in this district
    const { data: schoolData } = await SB.from("orgs")
      .select("*").eq("district_id", dist.id).order("name");
    setSchools(schoolData || []);

    // Load item counts per school
    const ids = (schoolData || []).map(s => s.id);
    if (ids.length > 0) {
      const { data: itemData } = await SB.from("items")
        .select("org_id").in("org_id", ids);
      const c = {};
      (itemData || []).forEach(i => { c[i.org_id] = (c[i.org_id] || 0) + 1; });
      setItemCounts(c);
    }

    // Load pending invites
    const { data: invData } = await SB.from("district_invites")
      .select("*").eq("district_id", dist.id).order("created_at", { ascending: false });
    setInvites(invData || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (plan === "district") load(); }, [load, plan]);

  const [assignMode,   setAssignMode]   = useState("invite"); // "invite" | "existing"
  const [allOrgs,      setAllOrgs]      = useState([]);
  const [assignOrgId,  setAssignOrgId]  = useState("");
  const [assigning,    setAssigning]    = useState(false);

  // Load all unassigned orgs for direct assignment
  const loadAllOrgs = async () => {
    const { data } = await SB.from("orgs")
      .select("id,name,email,plan,district_id")
      .is("district_id", null)
      .order("name");
    setAllOrgs(data || []);
  };

  const sendInvite = async () => {
    if (!invEmail.trim()) return;
    setSending(true); setMsg("");
    try {
      const { data: { session } } = await SB.auth.getSession();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(
        "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/district-invite",
        { method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
          body: JSON.stringify({ email: invEmail.trim(), school_name: invSchool.trim() }) }
      );
      clearTimeout(timeout);
      const result = await res.json();
      if (result.success) {
        setMsg("✓ Invite sent to " + invEmail + " — check Invites tab to copy the link if email doesn't arrive.");
        setInvEmail(""); setInvSchool("");
        setShowInvite(false);
        load();
      } else {
        setMsg(EM.sendInvite.body);
      }
    } catch (e) {
      setMsg(e.name === "AbortError" ? "Request timed out — check your connection and try again." : EM.sendInvite.body);
    } finally {
      setSending(false);
    }
  };

  const assignExisting = async () => {
    if (!assignOrgId || !district?.id) return;
    setAssigning(true);
    const { error } = await SB.from("orgs").update({
      district_id: district.id,
      role: "school_admin",
    }).eq("id", assignOrgId);
    if (!error) {
      setMsg("✓ School added to district");
      setAssignOrgId(""); setShowInvite(false);
      load();
    } else {
      setMsg("Error: " + error.message);
    }
    setAssigning(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const revokeInvite = async (id) => {
    await SB.from("district_invites").update({ status: "expired" }).eq("id", id);
    load();
  };

  const removeSchool = async (schoolId) => {
    if (!window.confirm("Remove this school from your district? Their account and data will remain, but they will no longer be linked to your district.")) return;
    await SB.from("orgs").update({ district_id: null, role: "school_admin" }).eq("id", schoolId);
    load();
  };

  const saveDistrict = async (updates) => {
    await SB.from("districts").update(updates).eq("id", district.id);
    setDistrict(p => ({ ...p, ...updates }));
    setMsg("✓ Saved");
    setTimeout(() => setMsg(""), 2000);
  };

  const totalItems = Object.values(itemCounts).reduce((s, c) => s + c, 0);
  const slotsUsed  = schools.length;
  const slotsTotal = district?.max_schools || 6;

  if (plan !== "district") return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
      <h2 style={{ fontFamily: "var(--serif)", marginBottom: 8 }}>District Plan Required</h2>
      <p style={{ color: "var(--muted)" }}>Upgrade to District to manage multiple schools from one dashboard.</p>
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <img src={usp("photo-1503095396549-807759245b35", 1400, 900)} alt="" className="page-bg-img" />
      <div style={{ padding: "32px 36px 0" }}>
        <div className="hero-wrap" style={{ height: 210 }}>
          <img src={usp("photo-1503095396549-807759245b35", 1100, 260)} alt="District" loading="eager" />
          <div className="hero-fade" />
          <div className="hero-body">
            <div className="hero-eyebrow">🏢 District S Plan</div>
            <h1 className="hero-title" style={{ fontSize: 44 }}>
              {district?.name || "Your District"}
            </h1>
            <p className="hero-sub">Manage all your schools from one place.</p>
          </div>
          <div className="hero-bar" />
        </div>
      </div>

      <div style={{ padding: "24px 36px 48px", position: "relative", zIndex: 1 }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { icon: "🏫", label: "Schools",     val: `${slotsUsed} / ${slotsTotal}` },
            { icon: "📦", label: "Total Items",  val: totalItems },
            { icon: "📨", label: "Pending Invites", val: invites.filter(i => i.status === "pending").length },
            { icon: "🎭", label: "Plan",         val: "District", color: "#42a5f5" },
          ].map(s => (
            <div key={s.label} className="card card-p" style={{ textAlign: "center", padding: "14px 10px" }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 700, color: s.color || "var(--linen)" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* District Name */}
        <div className="card card-p" style={{ marginBottom: 20 }}>
          <div className="sh"><h2>District Profile</h2><p>This name appears on all school Exchange listings.</p></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="fg" style={{ flex: 1, minWidth: 200 }}>
              <label className="fl">District Name</label>
              <input className="fi" defaultValue={district?.name || ""} id="dist-name-input"
                placeholder="e.g. Huntington Beach Union High School District" />
            </div>
            <div className="fg" style={{ flex: 1, minWidth: 180 }}>
              <label className="fl">Location</label>
              <input className="fi" defaultValue={district?.location || ""} id="dist-loc-input"
                placeholder="Huntington Beach, CA" />
            </div>
            <button className="btn btn-g btn-sm" onClick={() => saveDistrict({
              name: document.getElementById("dist-name-input").value,
              location: document.getElementById("dist-loc-input").value
            })}>Save</button>
            {msg && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 13 }}>{msg}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          {["schools", "invites"].map(t => (
            <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}
              style={{ textTransform: "capitalize" }}>
              {t === "schools" ? `🏫 Schools (${slotsUsed})` : `📨 Invites (${invites.filter(i=>i.status==="pending").length})`}
            </button>
          ))}
          <button className="btn btn-g btn-sm" style={{ marginLeft: "auto" }}
            onClick={() => setShowInvite(true)}
            disabled={slotsUsed >= slotsTotal}>
            + Add School
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Loading…</div>
        ) : tab === "schools" ? (
          schools.length === 0 ? (
            <div className="card card-p" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏫</div>
              <h3 style={{ fontFamily: "var(--serif)", marginBottom: 6 }}>No Schools Yet</h3>
              <p style={{ color: "var(--muted)", marginBottom: 16 }}>
                Invite up to {slotsTotal} schools to your district. Each school gets their own login and inventory.
              </p>
              <button className="btn btn-g" onClick={() => setShowInvite(true)}>+ Invite First School</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
              {schools.map(school => (
                <div key={school.id} className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 40, height: 40, background: "rgba(212,168,67,.15)", borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏫</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{school.name || "Unnamed School"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{school.location || school.email || "—"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 8px", background: "rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11, color: "var(--muted)" }}>
                      📦 {itemCounts[school.id] || 0} items
                    </span>
                    <span style={{ padding: "2px 8px", background: "rgba(66,165,245,.12)", color: "#42a5f5", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                      {school.type || "School"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    <button className="btn btn-g btn-sm" style={{ flex: 1 }}
                      onClick={() => onSwitchSchool(school)}>
                      Enter School →
                    </button>
                    <button className="btn btn-o btn-sm" style={{ color: "rgba(255,100,100,.7)", borderColor: "rgba(255,100,100,.2)" }}
                      onClick={() => removeSchool(school.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Invites tab */
          <div className="card" style={{ overflow: "hidden" }}>
            {invites.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No invites sent yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,.2)" }}>
                    {["Email", "School", "Status", "Sent", ""].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invites.map(inv => {
                    const inviteUrl = `https://theatre4u.org?invite=${inv.token}`;
                    const copyLink = () => {
                      navigator.clipboard.writeText(inviteUrl);
                      alert("Invite link copied! Send it to " + inv.email);
                    };
                    return (
                    <tr key={inv.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 14px", fontSize: 13 }}>{inv.email}</td>
                      <td style={{ padding: "9px 14px", fontSize: 13, color: "var(--muted)" }}>{inv.school_name || "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: inv.status === "accepted" ? "rgba(76,175,80,.15)" : inv.status === "pending" ? "rgba(212,168,67,.15)" : "rgba(255,255,255,.07)",
                          color: inv.status === "accepted" ? "var(--green)" : inv.status === "pending" ? "var(--gold)" : "var(--muted)" }}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--muted)" }}>
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {inv.status === "pending" && (<>
                            <button className="btn btn-o btn-sm" style={{ fontSize: 11 }}
                              onClick={copyLink}>📋 Copy Link</button>
                            <button className="btn btn-o btn-sm" style={{ fontSize: 11, color: "var(--red)" }}
                              onClick={() => revokeInvite(inv.id)}>Revoke</button>
                          </>)}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="card card-p" style={{ width: "100%", maxWidth: 480, animation: "su .2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 0 }}>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 20 }}>Add School to District</h2>
              <button className="btn btn-o btn-sm" onClick={() => setShowInvite(false)}>✕</button>
            </div>

            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", margin: "12px -18px 0", padding: "0 18px" }}>
              {[["invite","📨 Send Invite Email"],["existing","🔗 Add Existing Account"]].map(([m, l]) => (
                <button key={m}
                  onClick={() => { setAssignMode(m); if(m==="existing") loadAllOrgs(); }}
                  style={{ padding: "8px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", background: "none", border: "none",
                    borderBottom: assignMode === m ? "2px solid var(--gold)" : "2px solid transparent",
                    color: assignMode === m ? "var(--ink)" : "var(--muted)", marginBottom: -1 }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              {assignMode === "invite" ? (<>
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
                  Send an invite link by email. They can accept by signing into their existing Theatre4u™ account
                  or by creating a new one. You have <strong>{slotsTotal - slotsUsed}</strong> slot{slotsTotal - slotsUsed !== 1 ? "s" : ""} remaining.
                </p>
                <div className="fg" style={{ marginBottom: 12 }}>
                  <label className="fl">School Admin Email *</label>
                  <input className="fi" type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)}
                    placeholder="principal@school.edu" autoFocus
                    onKeyDown={e => e.key === "Enter" && sendInvite()} />
                </div>
                <div className="fg" style={{ marginBottom: 16 }}>
                  <label className="fl">School Name (optional)</label>
                  <input className="fi" value={invSchool} onChange={e => setInvSchool(e.target.value)}
                    placeholder="e.g. Ocean View High School" />
                </div>
                {msg && <div style={{ color: msg.startsWith("✓") ? "var(--green)" : "var(--red)",
                  marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn btn-o" onClick={() => setShowInvite(false)}>Cancel</button>
                  <button className="btn btn-g" onClick={sendInvite} disabled={!invEmail.trim() || sending}>
                    {sending ? "Sending…" : "Send Invite →"}
                  </button>
                </div>
              </>) : (<>
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
                  Add a school that already has a Theatre4u account. Their inventory moves with them immediately —
                  no email needed.
                </p>
                <div className="fg" style={{ marginBottom: 16 }}>
                  <label className="fl">Select School Account</label>
                  <select className="fs" value={assignOrgId} onChange={e => setAssignOrgId(e.target.value)}>
                    <option value="">— Choose an account —</option>
                    {allOrgs.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name || "Unnamed"} — {o.email} ({o.plan})
                      </option>
                    ))}
                  </select>
                  {allOrgs.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      No unassigned accounts found.
                    </div>
                  )}
                </div>
                {msg && <div style={{ color: msg.startsWith("✓") ? "var(--green)" : "var(--red)",
                  marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn btn-o" onClick={() => setShowInvite(false)}>Cancel</button>
                  <button className="btn btn-g" onClick={assignExisting}
                    disabled={assigning || !assignOrgId} style={{ opacity: !assignOrgId ? .5 : 1 }}>
                    {assigning ? "Adding…" : "Add to District →"}
                  </button>
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN INVENTORY VIEW — Browse any org's inventory for support/QA
// All access is logged to audit_log
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: EDIT ORG MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AdminEditOrgModal({ org, onClose, onSaved }) {
  const [f, setF] = useState({
    name:        org.name        || "",
    email:       org.email       || "",
    type:        org.type        || "",
    location:    org.location    || "",
    bio:         org.bio         || "",
    plan:        org.plan        || "free",
    admin_notes: org.admin_notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr("");
    const { error } = await SB.from("orgs").update({
      name:        f.name.trim(),
      email:       f.email.trim(),
      type:        f.type,
      location:    f.location,
      bio:         f.bio,
      plan:        f.plan,
      admin_notes: f.admin_notes,
    }).eq("id", org.id);
    if (error) { setErr("Save failed: " + error.message); setSaving(false); return; }
    onSaved({ ...org, ...f });
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:4000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"var(--bg2,#15121b)",border:"1px solid var(--border)",
        borderRadius:14,width:"100%",maxWidth:560,maxHeight:"88vh",
        display:"flex",flexDirection:"column",boxShadow:"0 8px 48px rgba(0,0,0,.5)" }}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 20px",borderBottom:"1px solid var(--border)" }}>
          <div>
            <div style={{ fontFamily:"var(--serif)",fontSize:18,fontWeight:700 }}>
              ✏️ Edit Organization
            </div>
            <div style={{ fontSize:12,color:"var(--muted)",marginTop:2 }}>
              {org.name || org.email} · ID: {org.id?.slice(0,8)}…
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"1px solid var(--border)",
            color:"var(--muted)",borderRadius:6,padding:"4px 10px",cursor:"pointer",
            fontFamily:"inherit",fontSize:18 }}>×</button>
        </div>

        <div style={{ padding:20,overflowY:"auto",display:"flex",flexDirection:"column",gap:14 }}>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div className="fg">
              <label className="fl">Organization Name</label>
              <input className="fi" value={f.name} onChange={e=>upd("name",e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">Email</label>
              <input className="fi" type="email" value={f.email} onChange={e=>upd("email",e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">Type</label>
              <select className="fs" value={f.type} onChange={e=>upd("type",e.target.value)}>
                {["","school","district","community","college","professional","other"].map(t=>(
                  <option key={t} value={t}>{t||"— Select —"}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Plan</label>
              <select className="fs" value={f.plan} onChange={e=>upd("plan",e.target.value)}>
                {["free","pro","district","district_m","district_l"].map(p=>(
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Location (City, State)</label>
              <input className="fi" value={f.location} onChange={e=>upd("location",e.target.value)} />
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Bio / About</label>
              <textarea className="ft" value={f.bio} onChange={e=>upd("bio",e.target.value)} rows={2} />
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl" style={{ color:"var(--red)" }}>Admin Notes (internal only)</label>
              <textarea className="ft" value={f.admin_notes}
                onChange={e=>upd("admin_notes",e.target.value)}
                placeholder="Grandfathered pricing, support history, flags…"
                rows={2}
                style={{ borderColor:"rgba(194,24,91,.3)" }} />
            </div>
          </div>

          {err && <div style={{ color:"var(--red)",fontSize:13,background:"rgba(194,24,91,.06)",
            border:"1px solid rgba(194,24,91,.2)",borderRadius:7,padding:"8px 12px" }}>{err}</div>}

          <div style={{ display:"flex",gap:8,justifyContent:"flex-end",
            paddingTop:12,borderTop:"1px solid var(--border)" }}>
            <button className="btn btn-o" onClick={onClose}>Cancel</button>
            <button className="btn btn-g" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "✓ Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: CLOSE / DELETE ORG MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AdminCloseOrgModal({ org, currentUser, onClose, onClosed, onHardDeleted }) {
  const [reason,      setReason]      = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [hardConfirm, setHardConfirm] = useState("");
  const [working,     setWorking]     = useState(false);
  const [err,         setErr]         = useState("");
  const orgName = org.name || org.email || "this organization";
  const CLOSE_WORD  = "CLOSE";
  const DELETE_WORD = "DELETE";

  const softClose = async () => {
    if (confirm !== CLOSE_WORD) { setErr(`Type ${CLOSE_WORD} to confirm`); return; }
    setWorking(true); setErr("");
    const { data: { session } } = await SB.auth.getSession();
    const result = await callEdgeFn("close-org", {
      org_id: org.id, reason, action: "close", is_admin_action: true
    }, session?.access_token);
    if (result?.success) { onClosed(org.id); }
    else { setErr(result?.error || "Close failed — check logs"); setWorking(false); }
  };

  const hardDelete = async () => {
    if (hardConfirm !== DELETE_WORD) { setErr(`Type ${DELETE_WORD} to confirm hard delete`); return; }
    setWorking(true); setErr("");
    const { data: { session } } = await SB.auth.getSession();
    const result = await callEdgeFn("close-org", {
      org_id: org.id, reason, action: "hard_delete", is_admin_action: true
    }, session?.access_token);
    if (result?.success) { onHardDeleted(org.id); }
    else { setErr(result?.error || "Delete failed — check logs"); setWorking(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:4000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"var(--bg2,#15121b)",border:"1.5px solid rgba(194,24,91,.4)",
        borderRadius:14,width:"100%",maxWidth:520,maxHeight:"88vh",
        display:"flex",flexDirection:"column",boxShadow:"0 8px 48px rgba(0,0,0,.6)" }}>

        <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--border)",
          display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ fontFamily:"var(--serif)",fontSize:18,fontWeight:700,color:"#ff6b6b" }}>
            ⚠️ Close or Delete Account
          </div>
          <button onClick={onClose} style={{ background:"none",border:"1px solid var(--border)",
            color:"var(--muted)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:18 }}>×</button>
        </div>

        <div style={{ padding:20,overflowY:"auto",display:"flex",flexDirection:"column",gap:16 }}>

          <div style={{ background:"rgba(194,24,91,.06)",border:"1px solid rgba(194,24,91,.2)",
            borderRadius:9,padding:"12px 14px" }}>
            <div style={{ fontWeight:700,fontSize:14,marginBottom:4,color:"#f0ebe0" }}>{orgName}</div>
            <div style={{ fontSize:12,color:"#b0a8b8" }}>{org.email} · Plan: {org.plan||"free"}</div>
            {org.stripe_subscription_id && (
              <div style={{ fontSize:12,color:"#e8c46a",marginTop:4 }}>
                ⚡ Active Stripe subscription — will be canceled automatically
              </div>
            )}
          </div>

          <div className="fg">
            <label className="fl">Reason (shown in confirmation email)</label>
            <textarea className="ft" value={reason} onChange={e=>setReason(e.target.value)}
              placeholder="Duplicate account, abuse, admin request…" rows={2} />
          </div>

          {/* Soft close section */}
          <div style={{ background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",
            borderRadius:10,padding:"14px 16px" }}>
            <div style={{ fontWeight:700,fontSize:14,marginBottom:4,color:"#f0ebe0" }}>Option 1 — Soft Close (Recommended)</div>
            <div style={{ fontSize:12,color:"#b0a8b8",marginBottom:10,lineHeight:1.6 }}>
              Cancels their Stripe subscription. Downgrades to Free. Data is preserved for 30 days.
              Owner receives a confirmation email. Recoverable within 30 days.
            </div>
            <div className="fg" style={{ marginBottom:10 }}>
              <label className="fl" style={{color:"#c8bfd4"}}>Type <strong style={{color:"#ff6b6b"}}>{CLOSE_WORD}</strong> to confirm</label>
              <input className="fi" value={confirm} onChange={e=>setConfirm(e.target.value.toUpperCase())}
                placeholder={CLOSE_WORD} style={{ fontFamily:"monospace",letterSpacing:2 }} />
            </div>
            <button className="btn btn-d" onClick={softClose}
              disabled={working || confirm !== CLOSE_WORD} style={{ width:"100%" }}>
              {working ? "Processing…" : "🚫 Close Account (30-day window)"}
            </button>
          </div>

          {/* Hard delete section */}
          <div style={{ background:"rgba(194,24,91,.04)",border:"1px solid rgba(194,24,91,.3)",
            borderRadius:10,padding:"14px 16px" }}>
            <div style={{ fontWeight:700,fontSize:14,marginBottom:4,color:"#ff6b6b" }}>
              Option 2 — Hard Delete (Irreversible)
            </div>
            <div style={{ fontSize:12,color:"#c8a0a0",marginBottom:10,lineHeight:1.6 }}>
              ⚠️ Permanently deletes ALL data immediately. Cannot be undone.
              Cancels Stripe subscription. Removes auth account. Use only for fraud/abuse or explicit verified request.
            </div>
            <div className="fg" style={{ marginBottom:10 }}>
              <label className="fl" style={{color:"#c8bfd4"}}>Type <strong style={{color:"#ff6b6b"}}>{DELETE_WORD}</strong> to confirm permanent deletion</label>
              <input className="fi" value={hardConfirm} onChange={e=>setHardConfirm(e.target.value.toUpperCase())}
                placeholder={DELETE_WORD} style={{ fontFamily:"monospace",letterSpacing:2,borderColor:"rgba(194,24,91,.4)" }} />
            </div>
            <button onClick={hardDelete}
              disabled={working || hardConfirm !== DELETE_WORD}
              style={{ width:"100%",padding:"9px",borderRadius:7,fontFamily:"inherit",
                fontWeight:800,fontSize:13,cursor:working||hardConfirm!==DELETE_WORD?"not-allowed":"pointer",
                background:hardConfirm===DELETE_WORD?"rgba(194,24,91,.85)":"rgba(194,24,91,.15)",
                color:hardConfirm===DELETE_WORD?"#fff":"var(--red)",
                border:"1px solid rgba(194,24,91,.4)",opacity:working?.5:1 }}>
              {working ? "Deleting…" : "💀 Permanently Delete All Data"}
            </button>
          </div>

          {err && <div style={{ color:"#ff9999",fontSize:13,background:"rgba(194,24,91,.15)",
            border:"1px solid rgba(194,24,91,.4)",borderRadius:7,padding:"8px 12px" }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: ACCOUNTS TAB (closed / pending deletion list)
// ══════════════════════════════════════════════════════════════════════════════
function AdminAccountsTab({ orgs, onRestore }) {
  const closed = orgs.filter(o => o.account_status === "closed");
  const daysLeft = (d) => {
    if (!d) return "—";
    const diff = new Date(d) - new Date();
    return Math.max(0, Math.ceil(diff / 86400000)) + " days";
  };

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h3 style={{ fontFamily:"var(--serif)",fontSize:18,marginBottom:4 }}>⚠️ Closed Accounts</h3>
        <p style={{ fontSize:13,color:"var(--muted)" }}>
          {closed.length} closed account{closed.length !== 1 ? "s" : ""} pending permanent deletion.
          Restore within 30 days of closing to recover data.
        </p>
      </div>
      {closed.length === 0 ? (
        <div style={{ textAlign:"center",padding:"48px 0",color:"var(--muted)" }}>
          <div style={{ fontSize:40,marginBottom:12 }}>✅</div>
          <div>No closed accounts — all organizations are active.</div>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {closed.map(o => (
            <div key={o.id} className="card card-p"
              style={{ borderLeft:"3px solid var(--red)",display:"flex",
                alignItems:"center",gap:16,flexWrap:"wrap" }}>
              <div style={{ flex:1,minWidth:200 }}>
                <div style={{ fontWeight:700,fontSize:14 }}>{o.name || "Unnamed"}</div>
                <div style={{ fontSize:12,color:"var(--muted)",marginTop:2 }}>{o.email}</div>
                <div style={{ fontSize:11,color:"var(--muted)",marginTop:4 }}>
                  Closed: {o.deleted_at ? new Date(o.deleted_at).toLocaleDateString() : "—"}
                  {" · "}{o.closed_by === "admin" ? "by Admin" : "by Owner"}
                  {o.cancellation_reason && <span> · "{o.cancellation_reason}"</span>}
                </div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontSize:11,color:"var(--muted)",marginBottom:6 }}>
                  Hard delete in
                </div>
                <div style={{ fontFamily:"var(--serif)",fontSize:22,fontWeight:700,
                  color: parseInt(daysLeft(o.deletion_scheduled_at)) <= 7 ? "var(--red)" : "var(--gold)" }}>
                  {daysLeft(o.deletion_scheduled_at)}
                </div>
              </div>
              <button onClick={() => onRestore(o.id)}
                style={{ padding:"7px 16px",borderRadius:8,fontFamily:"inherit",fontWeight:700,
                  fontSize:13,cursor:"pointer",background:"rgba(76,175,80,.12)",
                  border:"1px solid rgba(76,175,80,.3)",color:"#4caf50" }}>
                ↩ Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: DISTRICT ASSIGNMENT PANEL
// Lets admin bulk-assign orgs to districts or remove them
// ══════════════════════════════════════════════════════════════════════════════
function AdminDistrictAssignPanel({ orgs, onUpdated }) {
  const [districts,    setDistricts]    = useState([]);
  const [selDistrict,  setSelDistrict]  = useState("");
  const [selOrgs,      setSelOrgs]      = useState([]);   // array of org IDs
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState("");
  const [removeMode,   setRemoveMode]   = useState(false);

  // Load districts once
  useEffect(() => {
    SB.from("districts").select("id,name,max_schools,owner_id").order("name")
      .then(({ data }) => setDistricts(data || []));
  }, []);

  // How many schools are already in selected district
  const districtSchoolCount = selDistrict
    ? orgs.filter(o => o.district_id === selDistrict).length
    : 0;
  const selDist = districts.find(d => d.id === selDistrict);
  const atCapacity = selDist && districtSchoolCount >= selDist.max_schools;

  // Orgs not yet in selected district (for assign mode)
  const unassignedOrgs = selDistrict
    ? orgs.filter(o => o.district_id !== selDistrict && o.account_status !== "closed")
    : [];
  // Orgs already in district (for remove mode)
  const assignedOrgs = selDistrict
    ? orgs.filter(o => o.district_id === selDistrict)
    : [];

  const toggleOrg = (id) =>
    setSelOrgs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const apply = async () => {
    if (!selDistrict || selOrgs.length === 0) return;
    setSaving(true); setMsg("");
    const updates = selOrgs.map(id =>
      SB.from("orgs").update({
        district_id: removeMode ? null : selDistrict,
        role: removeMode ? "school_admin" : "school_admin",
      }).eq("id", id)
    );
    await Promise.all(updates);
    onUpdated();
    setMsg(`✓ ${selOrgs.length} school${selOrgs.length !== 1 ? "s" : ""} ${removeMode ? "removed from" : "added to"} ${selDist?.name || "district"}`);
    setSelOrgs([]);
    setSaving(false);
    setTimeout(() => setMsg(""), 4000);
  };

  const displayOrgs = removeMode ? assignedOrgs : unassignedOrgs;

  return (
    <div className="card card-p" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 700 }}>
            🏛️ District Assignment
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Assign or remove schools from a district in bulk
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setRemoveMode(false); setSelOrgs([]); }}
            style={{ padding: "5px 14px", borderRadius: 7, fontFamily: "inherit",
              fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)",
              background: !removeMode ? "rgba(76,175,80,.15)" : "transparent",
              color: !removeMode ? "#4caf50" : "var(--muted)" }}>
            + Assign to District
          </button>
          <button onClick={() => { setRemoveMode(true); setSelOrgs([]); }}
            style={{ padding: "5px 14px", borderRadius: 7, fontFamily: "inherit",
              fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)",
              background: removeMode ? "rgba(194,24,91,.12)" : "transparent",
              color: removeMode ? "var(--red)" : "var(--muted)" }}>
            − Remove from District
          </button>
        </div>
      </div>

      {/* District selector */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: 1, color: "var(--muted)", display: "block", marginBottom: 6 }}>
          Select District
        </label>
        <select className="fs" value={selDistrict} onChange={e => { setSelDistrict(e.target.value); setSelOrgs([]); }}
          style={{ maxWidth: 400 }}>
          <option value="">— Choose a district —</option>
          {districts.map(d => (
            <option key={d.id} value={d.id}>
              {d.name || "Unnamed District"} ({orgs.filter(o => o.district_id === d.id).length}/{d.max_schools} schools)
            </option>
          ))}
        </select>
      </div>

      {selDistrict && (
        <>
          {/* Capacity warning */}
          {!removeMode && atCapacity && (
            <div style={{ background: "rgba(212,168,67,.1)", border: "1px solid rgba(212,168,67,.3)",
              borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--gold)",
              marginBottom: 12 }}>
              ⚠️ This district is at capacity ({districtSchoolCount}/{selDist?.max_schools} schools).
              Upgrade the district plan to add more schools.
            </div>
          )}

          {/* School list */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 1, color: "var(--muted)", marginBottom: 8 }}>
            {removeMode ? "Schools Currently in District" : "Schools to Add"}
            {" — "}<button onClick={() => setSelOrgs(displayOrgs.map(o => o.id))}
              style={{ background: "none", border: "none", color: "var(--gold)",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              Select All
            </button>
            {" · "}
            <button onClick={() => setSelOrgs([])}
              style={{ background: "none", border: "none", color: "var(--muted)",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              Clear
            </button>
          </div>

          {displayOrgs.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", padding: "12px 0" }}>
              {removeMode ? "No schools in this district." : "All schools are already in this district."}
            </div>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: 10,
              overflow: "hidden", marginBottom: 14 }}>
              {displayOrgs.map((o, i) => (
                <label key={o.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", cursor: "pointer",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  background: selOrgs.includes(o.id)
                    ? removeMode ? "rgba(194,24,91,.06)" : "rgba(76,175,80,.06)"
                    : i % 2 === 0 ? "rgba(255,255,255,.01)" : "transparent",
                }}>
                  <input type="checkbox" checked={selOrgs.includes(o.id)}
                    onChange={() => toggleOrg(o.id)}
                    style={{ width: 16, height: 16, accentColor: removeMode ? "var(--red)" : "#4caf50", cursor: "pointer" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{o.name || "Unnamed"}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{o.email}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
                    <div style={{ fontWeight: 600 }}>{o.type || "—"}</div>
                    <div>{o.plan}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Apply button */}
          {selOrgs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button onClick={apply} disabled={saving}
                style={{ padding: "9px 20px", borderRadius: 8, fontFamily: "inherit",
                  fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
                  background: removeMode ? "rgba(194,24,91,.8)" : "rgba(76,175,80,.85)",
                  color: "#fff", border: "none", opacity: saving ? .6 : 1 }}>
                {saving ? "Saving…"
                  : removeMode
                    ? `Remove ${selOrgs.length} school${selOrgs.length !== 1 ? "s" : ""} from district`
                    : `Add ${selOrgs.length} school${selOrgs.length !== 1 ? "s" : ""} to ${selDist?.name || "district"}`}
              </button>
              {msg && <span style={{ fontSize: 13, fontWeight: 700, color: "#4caf50" }}>{msg}</span>}
            </div>
          )}
          {msg && selOrgs.length === 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#4caf50" }}>{msg}</span>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: ORG INVENTORY EDITOR (admin edits any org's items)
// ══════════════════════════════════════════════════════════════════════════════
function AdminOrgInventoryEditor({ org, onBack }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [msg,     setMsg]     = useState("");

  useEffect(() => {
    SB.from("items").select("*").eq("org_id", org.id)
      .order("added", { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, [org.id]);

  const filtered = items.filter(i =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase()) ||
    (i.location||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:18 }}>
        <button onClick={onBack} className="btn btn-o btn-sm">← Back</button>
        <div>
          <div style={{ fontFamily:"var(--serif)",fontSize:20,fontWeight:700 }}>
            📦 {org.name || "Org"} Inventory
          </div>
          <div style={{ fontSize:12,color:"var(--muted)" }}>{org.email} · {items.length} items</div>
        </div>
      </div>

      <div style={{ display:"flex",gap:10,marginBottom:14,alignItems:"center" }}>
        <input className="fi" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search items…" style={{ maxWidth:300 }} />
        {msg && <span style={{ fontSize:13,fontWeight:700,color:"var(--green)" }}>{msg}</span>}
      </div>

      {loading ? (
        <div style={{ textAlign:"center",padding:40,color:"var(--muted)" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center",padding:40,color:"var(--muted)" }}>No items found.</div>
      ) : (
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"rgba(0,0,0,.25)" }}>
                  {["Item","Category","Condition","Qty","Location","Avail","Market","Edit"].map(h=>(
                    <th key={h} style={{ padding:"9px 12px",textAlign:"left",fontSize:10,
                      textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",fontWeight:700,whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={item.id} style={{ borderTop:"1px solid var(--border)",
                    background: i%2===0?"rgba(255,255,255,.01)":"transparent" }}>
                    <td style={{ padding:"9px 12px",fontWeight:600,fontSize:13 }}>{item.name}</td>
                    <td style={{ padding:"9px 12px",fontSize:12,color:"var(--muted)" }}>{item.category}</td>
                    <td style={{ padding:"9px 12px",fontSize:12,color:"var(--muted)" }}>{item.condition}</td>
                    <td style={{ padding:"9px 12px",fontSize:13 }}>{item.qty||1}</td>
                    <td style={{ padding:"9px 12px",fontSize:12,color:"var(--muted)" }}>{item.location||"—"}</td>
                    <td style={{ padding:"9px 12px",fontSize:12,color:"var(--muted)" }}>{item.avail}</td>
                    <td style={{ padding:"9px 12px",fontSize:12,color:"var(--muted)" }}>{item.mkt}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <button onClick={() => setEditingItem(item)}
                        style={{ padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
                          borderRadius:6,border:"1px solid var(--border)",background:"rgba(66,165,245,.1)",
                          color:"#42a5f5",fontFamily:"inherit" }}>
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inline item edit modal */}
      {editingItem && (
        <AdminEditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={(updated) => {
            setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
            setEditingItem(null);
            setMsg("✓ " + (updated.name || "Item") + " updated");
            setTimeout(() => setMsg(""), 3000);
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: EDIT ITEM MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AdminEditItemModal({ item, onClose, onSaved }) {
  const [f, setF] = useState({
    name:      item.name      || "",
    category:  item.category  || "other",
    condition: item.condition || "Good",
    location:  item.location  || "",
    qty:       item.qty       || 1,
    notes:     item.notes     || "",
    avail:     item.avail     || "In Stock",
    mkt:       item.mkt       || "Not Listed",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr("");
    const { error } = await SB.from("items").update({
      name:      f.name.trim(),
      category:  f.category,
      condition: f.condition,
      location:  f.location,
      qty:       parseInt(f.qty) || 1,
      notes:     f.notes,
      avail:     f.avail,
      mkt:       f.mkt,
    }).eq("id", item.id);
    if (error) { setErr("Save failed: " + error.message); setSaving(false); return; }
    onSaved({ ...item, ...f });
    setSaving(false);
  };

  const deleteItem = async () => {
    if (!confirm("Permanently delete this item? Cannot be undone.")) return;
    setSaving(true);
    await SB.from("items").delete().eq("id", item.id);
    onSaved({ ...item, _deleted: true });
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:5000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"var(--bg2,#15121b)",border:"1px solid var(--border)",
        borderRadius:14,width:"100%",maxWidth:520,maxHeight:"88vh",
        display:"flex",flexDirection:"column",boxShadow:"0 8px 48px rgba(0,0,0,.5)" }}>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"15px 20px",borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontFamily:"var(--serif)",fontSize:17,fontWeight:700 }}>
            ✏️ Edit Item (Admin)
          </div>
          <button onClick={onClose} style={{ background:"none",border:"1px solid var(--border)",
            color:"var(--muted)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:18 }}>×</button>
        </div>

        <div style={{ padding:20,overflowY:"auto",display:"flex",flexDirection:"column",gap:13 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Item Name</label>
              <input className="fi" value={f.name} onChange={e=>upd("name",e.target.value)} autoFocus />
            </div>
            <div className="fg">
              <label className="fl">Category</label>
              <select className="fs" value={f.category} onChange={e=>upd("category",e.target.value)}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Condition</label>
              <select className="fs" value={f.condition} onChange={e=>upd("condition",e.target.value)}>
                {CONDS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Availability</label>
              <select className="fs" value={f.avail} onChange={e=>upd("avail",e.target.value)}>
                {["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"].map(a=>(
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Qty</label>
              <input className="fi" type="number" min="0" value={f.qty}
                onChange={e=>upd("qty",e.target.value)} />
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Location</label>
              <input className="fi" value={f.location} onChange={e=>upd("location",e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">Market Status</label>
              <select className="fs" value={f.mkt} onChange={e=>upd("mkt",e.target.value)}>
                {["Not Listed","For Rent","For Sale","Rent or Sale","For Loan"].map(m=>(
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Notes</label>
              <textarea className="ft" value={f.notes} onChange={e=>upd("notes",e.target.value)} rows={2} />
            </div>
          </div>

          {err && <div style={{ color:"var(--red)",fontSize:13,padding:"8px 12px",
            background:"rgba(194,24,91,.06)",border:"1px solid rgba(194,24,91,.2)",borderRadius:7 }}>{err}</div>}

          <div style={{ display:"flex",gap:8,justifyContent:"space-between",
            paddingTop:12,borderTop:"1px solid var(--border)" }}>
            <button onClick={deleteItem} className="btn btn-d btn-sm">🗑 Delete Item</button>
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn btn-o" onClick={onClose}>Cancel</button>
              <button className="btn btn-g" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "✓ Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminInventoryView() {
  const [orgs,        setOrgs]        = useState([]);
  const [selOrg,      setSelOrg]      = useState(null);
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [search,      setSearch]      = useState("");
  const [catF,        setCatF]        = useState("all");
  const [modal,       setModal]       = useState(null); // "add"|"edit"|"csv"
  const [actItem,     setActItem]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState("");

  const CATS = ["costumes","props","sets","lighting","sound","scripts","makeup","furniture","fabrics","tools","effects","other"];
  const CAT_ICONS = {costumes:"👗",props:"🎭",sets:"🏗️",lighting:"💡",sound:"🔊",scripts:"📜",makeup:"💄",furniture:"🪑",fabrics:"🧵",tools:"🔧",effects:"✨",other:"📦"};
  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),3000); };



  // Load all orgs
  useEffect(()=>{
    (async()=>{
      const{data}=await SB.from("orgs").select("id,name,email,plan,is_leading_player").order("name");
      setOrgs(data||[]);
      setLoadingOrgs(false);
    })();
  },[]);

  const loadOrgInventory = async(org)=>{
    setSelOrg(org); setItems([]); setSearch(""); setCatF("all"); setLoading(true);
    const{data}=await SB.from("items").select("*").eq("org_id",org.id).order("added",{ascending:false});
    setItems(data||[]);
    // Audit log this access
    SB.from("audit_log").insert({action:"admin_inventory_view",org_id:org.id,
      detail:{entity_type:"org",entity_id:org.id,org_name:org.name,item_count:(data||[]).length}}).then(()=>{});
    setLoading(false);
  };

  const filtered = items.filter(i=>{
    const q=search.toLowerCase();
    return(!q||i.name?.toLowerCase().includes(q)||(i.location||"").toLowerCase().includes(q)||(i.tags||[]).some(t=>t.includes(q)))
      &&(catF==="all"||i.category===catF);
  });

  // Add item to selected org
  const handleAdd = async(f)=>{
    setSaving(true);
    const row={...f, org_id:selOrg.id, added:new Date().toISOString(),
      start_date:f.start_date||null, end_date:f.end_date||null};
    const{data,error}=await SB.from("items").insert(row).select().single();
    if(error){console.error("handleAdd error:",error);alert(EM.itemSave.title+"\n\n"+EM.itemSave.body);}
    else{
      setItems(p=>[data,...p]);
      SB.from("audit_log").insert({action:"admin_item_add",org_id:selOrg.id,
        detail:{item_id:data.id,org_name:selOrg.name,item_name:data.name}}).then(()=>{});
      flash("✓ Item added to "+selOrg.name);
      setModal(null);setActItem(null);
    }
    setSaving(false);
  };

  // Edit item
  const handleEdit = async(f)=>{
    setSaving(true);
    // Strip immutable fields before update
    const payload = {...f};
    delete payload.id;
    delete payload.org_id;
    delete payload.added;
    const{data,error}=await SB.from("items")
      .update(payload)
      .eq("id", actItem.id)
      .eq("org_id", selOrg.id)
      .select().single();
    if(error){
      console.error("Edit error:", error);
      alert(EM.itemSave.title+"\n\n"+EM.itemSave.body);
    } else {
      setItems(p=>p.map(x=>x.id===data.id?data:x));
      SB.from("audit_log").insert({action:"admin_item_edit",org_id:selOrg.id,
        detail:{item_id:data.id,org_name:selOrg.name,item_name:data.name}}).then(()=>{});
      flash("✓ Item updated");
      setModal(null);setActItem(null);
    }
    setSaving(false);
  };

  // Delete item
  const handleDelete = async(id,name)=>{
    if(!confirm("Delete "+name+" from "+selOrg.name+"?"))return;
    await SB.from("items").delete().eq("id",id);
    setItems(p=>p.filter(x=>x.id!==id));
    SB.from("audit_log").insert({action:"admin_item_delete",org_id:selOrg.id,
      detail:{item_id:id,org_name:selOrg.name,item_name:name}}).then(()=>{});
    flash("✓ Item deleted");
  };

  // CSV Import

  const btnStyle = (col="#d4a843")=>({
    background:`linear-gradient(135deg,${col},${col}cc)`,border:"none",
    color:col==="#d4a843"?"#1a1200":"#fff",padding:"6px 14px",borderRadius:6,
    fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
    display:"flex",alignItems:"center",gap:5,
  });

  return(
    <div>
      <div style={{display:"flex",alignItems:"flex-start",gap:24,flexWrap:"wrap"}}>
        {/* Left: Org list */}
        <div style={{width:260,flexShrink:0}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:10}}>Select Organization</div>
          {loadingOrgs?<div style={{color:"var(--muted)",fontSize:13}}>Loading…</div>:(
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:520,overflowY:"auto"}}>
              {orgs.map(o=>(
                <button key={o.id} onClick={()=>loadOrgInventory(o)}
                  style={{background:selOrg?.id===o.id?"linear-gradient(135deg,rgba(212,168,67,.15),rgba(212,168,67,.05))":"var(--parch)",
                    border:selOrg?.id===o.id?"1px solid rgba(212,168,67,.4)":"1px solid var(--border)",
                    borderRadius:8,padding:"9px 12px",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {o.is_leading_player&&<span style={{color:"var(--gold)"}}>⭐ </span>}{o.name||o.email}
                      </div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>{o.email}</div>
                    </div>
                    <span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:o.plan==="pro"?"rgba(212,168,67,.15)":o.plan==="district"?"rgba(66,165,245,.15)":"rgba(255,255,255,.06)",color:o.plan==="pro"?"var(--gold)":o.plan==="district"?"#42a5f5":"var(--muted)",fontWeight:700}}>{o.plan}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Inventory panel */}
        <div style={{flex:1,minWidth:0}}>
          {!selOrg?(
            <div style={{textAlign:"center",padding:"48px 24px",color:"var(--muted)"}}>
              <div style={{fontSize:40,marginBottom:12}}>📦</div>
              <div style={{fontFamily:"var(--serif)",fontSize:18,marginBottom:6}}>Select an organization</div>
              <div style={{fontSize:13}}>Choose a program on the left to view and manage their inventory.</div>
              <div style={{fontSize:11,marginTop:16,color:"#c2185b",background:"rgba(194,24,91,.08)",border:"1px solid rgba(194,24,91,.2)",borderRadius:8,padding:"8px 14px",display:"inline-block"}}>
                🔒 Admin access — all actions are logged
              </div>
            </div>
          ):loading?(
            <div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading {selOrg.name}…</div>
          ):(
            <>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <div style={{fontFamily:"var(--serif)",fontSize:18,fontWeight:700,flex:1}}>
                  {selOrg.name||selOrg.email}
                  <span style={{fontFamily:"inherit",fontSize:13,fontWeight:400,color:"var(--muted)",marginLeft:8}}>{items.length} items</span>
                </div>
                <span style={{fontSize:10,padding:"3px 9px",borderRadius:6,fontWeight:700,background:"rgba(194,24,91,.12)",color:"#f48fb1"}}>🔒 Logged</span>
              </div>

              {/* Action buttons */}
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                <button style={btnStyle()} onClick={()=>{setActItem(null);setModal("add");}}>
                  ＋ Add Item
                </button>
                <button style={btnStyle("#42a5f5")} onClick={()=>setModal("csv")}>
                  📥 CSV Import
                </button>
                <button style={{...btnStyle("#555"),marginLeft:"auto"}} onClick={()=>loadOrgInventory(selOrg)}>
                  ↻ Refresh
                </button>
              </div>

              {/* Search + filter */}
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…"
                  style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:6,padding:"6px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",flex:"1 1 160px"}}/>
                <select value={catF} onChange={e=>setCatF(e.target.value)}
                  style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:6,padding:"6px 8px",color:"var(--text)",fontSize:12,fontFamily:"inherit"}}>
                  <option value="all">All Categories</option>
                  {CATS.map(c=><option key={c} value={c}>{CAT_ICONS[c]} {c[0].toUpperCase()+c.slice(1)}</option>)}
                </select>
              </div>

              {msg&&<div style={{marginBottom:10,fontSize:13,fontWeight:700,color:msg.startsWith("❌")?"var(--red)":"var(--green)"}}>{msg}</div>}

              {/* Items table */}
              {filtered.length===0?(
                <div style={{textAlign:"center",padding:32,color:"var(--muted)",fontSize:13}}>
                  {items.length===0?"No items yet — add one above or import a CSV.":"No items match your search."}
                </div>
              ):(
                <div style={{overflowX:"auto",border:"1px solid var(--border)",borderRadius:10}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"rgba(0,0,0,.2)"}}>
                        {["Item","Category","Condition","Qty","Location","Market",""].map(h=>(
                          <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(item=>(
                        <tr key={item.id} style={{borderTop:"1px solid var(--border)"}}>
                          <td style={{padding:"8px 12px",fontWeight:600,fontSize:13}}>
                            {item.name}
                            {item.tags?.length>0&&<div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{item.tags.map(t=>"#"+t).join(" ")}</div>}
                          </td>
                          <td style={{padding:"8px 12px",fontSize:12,color:"var(--muted)"}}>{CAT_ICONS[item.category]} {item.category}</td>
                          <td style={{padding:"8px 12px",fontSize:12}}>{item.condition}</td>
                          <td style={{padding:"8px 12px",fontSize:13,fontWeight:600}}>{item.quantity||item.qty||1}</td>
                          <td style={{padding:"8px 12px",fontSize:12,color:"var(--muted)"}}>{item.location||"—"}</td>
                          <td style={{padding:"8px 12px",fontSize:11}}>
                            <span style={{padding:"2px 7px",borderRadius:10,background:item.mkt==="Not Listed"?"rgba(255,255,255,.06)":"rgba(212,168,67,.15)",
                              color:item.mkt==="Not Listed"?"var(--muted)":"var(--gold)",fontWeight:600}}>
                              {item.mkt||"Not Listed"}
                            </span>
                          </td>
                          <td style={{padding:"8px 8px"}}>
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>{setActItem(item);setModal("edit");}}
                                style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"var(--muted)",fontFamily:"inherit"}}>Edit</button>
                              <button onClick={()=>handleDelete(item.id,item.name)}
                                style={{background:"rgba(194,24,91,.1)",border:"1px solid rgba(194,24,91,.2)",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#f48fb1",fontFamily:"inherit"}}>Del</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Item Modal */}
      {(modal==="add"||modal==="edit")&&(
        <Modal title={(modal==="add"?"Add Item to ":"Edit Item — ")+selOrg?.name} onClose={()=>{setModal(null);setActItem(null);}}>
          <ItemForm item={modal==="edit"?actItem:null} onSave={modal==="add"?handleAdd:handleEdit} onCancel={()=>{setModal(null);setActItem(null);}} saving={saving}/>
        </Modal>
      )}

      {/* CSV Import Modal */}
      {modal==="csv"&&selOrg&&(
        <CSVImport
          userId={selOrg.id}
          onClose={()=>{setModal(null);}}
          onImport={async()=>{
            setModal(null);
            await loadOrgInventory(selOrg);
            flash("✓ Import complete — inventory refreshed for "+selOrg.name);
          }}
        />
      )}
    </div>
  );
}


// ── Admin Analytics Tab ───────────────────────────────────────────────────────
function AdminAnalyticsTab({ analytics, loading, onLoad }) {
  React.useEffect(() => { if (!analytics && !loading) onLoad(); }, []);

  const card = { background:"var(--parch)", border:"1px solid var(--border)", borderRadius:10, padding:16 };

  if (loading) return <div style={{textAlign:"center",padding:60,color:"var(--muted)"}}>Loading analytics…</div>;
  if (!analytics) return null;

  const { pvDay, pvWeek, recentOrgs, totalViews, totalSessions } = analytics;

  // Aggregate by page
  const byPage = {};
  pvWeek.forEach(v => { byPage[v.page] = (byPage[v.page]||0) + 1; });

  // Unique sessions this week
  const uniqSessions = new Set(pvWeek.map(v => v.session_id)).size;

  // Sessions by day (last 14 days)
  const dayMap = {};
  pvDay.forEach(v => {
    const d = v.created_at.slice(0,10);
    dayMap[d] = (dayMap[d]||0) + 1;
  });
  const dayEntries = Object.entries(dayMap).sort((a,b) => a[0].localeCompare(b[0])).slice(-14);
  const maxDay = Math.max(...dayEntries.map(d=>d[1]), 1);

  // UTM sources this week
  const srcMap = {};
  pvWeek.filter(v=>v.utm_source).forEach(v => { srcMap[v.utm_source] = (srcMap[v.utm_source]||0)+1; });
  const srcEntries = Object.entries(srcMap).sort((a,b)=>b[1]-a[1]);

  return (
    <div>
      {/* Summary tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        {[
          {icon:"👁",  label:"Total Pageviews",    val:(totalViews||0).toLocaleString()},
          {icon:"🧑",  label:"Unique Sessions",     val:(totalSessions||0).toLocaleString()},
          {icon:"📅",  label:"Views This Week",     val:pvWeek.length.toLocaleString()},
          {icon:"🔥",  label:"Sessions This Week",  val:uniqSessions.toLocaleString(), color:"var(--gold)"},
        ].map(s=>(
          <div key={s.label} style={{...card,textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
            <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:800,color:s.color||"var(--linen)"}}>{s.val}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {/* Views by page */}
        <div style={card}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Views by Page (7 days)</div>
          {Object.keys(byPage).length === 0
            ? <div style={{fontSize:12,color:"var(--muted)"}}>No data yet — visits will appear here once users land on the site.</div>
            : Object.entries(byPage).sort((a,b)=>b[1]-a[1]).map(([page,n])=>(
            <div key={page} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
              <div style={{width:80,fontSize:12,color:"var(--muted)",flexShrink:0,textTransform:"capitalize"}}>{page}</div>
              <div style={{flex:1,height:6,background:"var(--white)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(n/Math.max(...Object.values(byPage))*100)+"%",
                  background:"var(--gold)",borderRadius:3}}/>
              </div>
              <div style={{fontSize:12,fontWeight:700,width:28,textAlign:"right",flexShrink:0}}>{n}</div>
            </div>
          ))}
        </div>

        {/* Traffic sources */}
        <div style={card}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Traffic Sources (7 days)</div>
          {srcEntries.length === 0
            ? <div style={{fontSize:12,color:"var(--muted)"}}>No UTM-tagged traffic yet. Add <code>?utm_source=facebook</code> to your ad links to track sources.</div>
            : srcEntries.map(([src,n])=>(
            <div key={src} style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
              <div style={{flex:1,fontSize:12,color:"var(--muted)"}}>{src}</div>
              <span style={{fontSize:12,fontWeight:700,background:"rgba(212,168,67,.12)",
                color:"var(--gold)",padding:"1px 8px",borderRadius:6}}>{n} visits</span>
            </div>
          ))}
          <div style={{marginTop:12,fontSize:11,color:"var(--muted)",lineHeight:1.5,borderTop:"1px solid var(--border)",paddingTop:8}}>
            Tag your Facebook ad URLs:<br/>
            <code style={{fontSize:10}}>theatre4u.org?utm_source=facebook&utm_campaign=beta</code>
          </div>
        </div>
      </div>

      {/* Daily chart */}
      <div style={{...card,marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:16}}>Daily Pageviews (last 14 days)</div>
        {dayEntries.length === 0
          ? <div style={{fontSize:12,color:"var(--muted)"}}>No data yet.</div>
          : (
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80,overflowX:"auto"}}>
            {dayEntries.map(([day,n])=>(
              <div key={day} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flex:1,minWidth:28}}>
                <div style={{fontSize:9,color:"var(--muted)",fontWeight:700}}>{n}</div>
                <div style={{width:"100%",background:"var(--gold)",borderRadius:"3px 3px 0 0",
                  height:Math.max(4,n/maxDay*60)+"px",minHeight:4}}/>
                <div style={{fontSize:8,color:"var(--muted)",whiteSpace:"nowrap"}}>
                  {new Date(day+"T12:00").toLocaleDateString("en-US",{month:"numeric",day:"numeric"})}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent signups */}
      <div style={card}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Recent Signups</div>
        {recentOrgs.length === 0
          ? <div style={{fontSize:12,color:"var(--muted)"}}>No signups yet.</div>
          : recentOrgs.map(org=>(
          <div key={org.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",
            borderBottom:"1px solid var(--border)"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13}}>{org.name||"Unnamed"}</div>
              <div style={{fontSize:11,color:"var(--muted)"}}>{org.email}</div>
            </div>
            <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:8,
              background:org.plan==="free"?"rgba(255,255,255,.08)":"rgba(212,168,67,.15)",
              color:org.plan==="free"?"var(--muted)":"var(--gold)"}}>
              {org.plan||"free"}
            </span>
            <div style={{fontSize:11,color:"var(--muted)",whiteSpace:"nowrap",flexShrink:0}}>
              {new Date(org.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:12,display:"flex",justifyContent:"flex-end"}}>
        <button onClick={onLoad} className="btn btn-o btn-sm">↺ Refresh</button>
      </div>
    </div>
  );
}

function AdminDashboard({ currentUser }) {
  const [orgs,      setOrgs]      = useState([]);
  const [counts,    setCounts]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [planF,     setPlanF]     = useState("all");
  const [saving,    setSaving]    = useState(null);
  const [msg,       setMsg]       = useState("");
  const [adminTab,  setAdminTab]  = useState("orgs");
  const [betaLeads, setBetaLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [feedback,  setFeedback]  = useState([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [codes,     setCodes]     = useState([]);
  const [editingOrg,          setEditingOrg]          = useState(null);
  const [editingInventoryOrg, setEditingInventoryOrg] = useState(null);
  const [closingOrg,          setClosingOrg]          = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Load all orgs
    const { data: orgData, error } = await SB.from("orgs").select("*").order("created_at", { ascending: false });
    if (error) { setLoading(false); return; }
    setOrgs(orgData || []);
    // Load feedback + beta codes
    const { data: fbData } = await SB.from("beta_feedback")
      .select("*").order("created_at", { ascending: false }).limit(200);
    setFeedback(fbData || []);
    const { data: codesData } = await SB.from("beta_codes").select("*").order("created_at");
    setCodes(codesData || []);
    // Load ALL item counts per org (total inventory, not just listed)
    const { data: itemData } = await SB.from("items").select("org_id");
    const c = {};
    (itemData || []).forEach(i => { c[i.org_id] = (c[i.org_id] || 0) + 1; });
    setCounts(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setPlanFor = async (orgId, newPlan) => {
    setSaving(orgId);
    const { error } = await SB.rpc("admin_set_plan", {
      target_org_id: orgId,
      new_plan: newPlan
    });
    if (!error) {
      setOrgs(p => p.map(o => o.id === orgId ? { ...o, plan: newPlan } : o));
      setMsg("✓ Plan updated to " + newPlan + "!");
      setTimeout(() => setMsg(""), 3000);
    } else {
      setMsg(EM.generic.body);
      setTimeout(() => setMsg(""), 4000);
    }
    setSaving(null);
  };

  const filtered = useMemo(() => {
    let f = orgs;
    if (planF !== "all") f = f.filter(o => (o.plan || "free") === planF);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(o => (o.name || "").toLowerCase().includes(q) || (o.email || "").toLowerCase().includes(q));
    }
    return f;
  }, [orgs, planF, search]);

  // Stats
  const totalOrgs  = orgs.length;
  const totalItems = Object.values(counts).reduce((s, c) => s + c, 0);
  const byPlan     = { free: 0, pro: 0, district: 0 };
  orgs.forEach(o => { const p = o.plan || "free"; byPlan[p] = (byPlan[p] || 0) + 1; });
  const mrr = (byPlan.pro * 12) + (byPlan.district * 49);

  const planColor = { free: "rgba(255,255,255,.2)", pro: "var(--gold)", district: "#42a5f5" };
  const planLabel = { free: "Free", pro: "Pro", district: "District S", district_m: "District M", district_l: "District L" };

  return (
    <div style={{ position: "relative" }}>
      <img src={usp("photo-1503095396549-807759245b35", 1400, 900)} alt="" className="page-bg-img" />

      <div style={{ padding: "32px 36px 0" }}>
        <div className="hero-wrap" style={{ height: 210 }}>
          <img src={usp("photo-1503095396549-807759245b35", 1100, 260)} alt="Admin" loading="eager" />
          <div className="hero-fade" />
          <div className="hero-body">
            <div className="hero-eyebrow">🔧 Admin Only</div>
            <h1 className="hero-title" style={{ fontSize: 44 }}>Admin Dashboard</h1>
            <p className="hero-sub">Platform overview — all organizations, plans, and data.</p>
          </div>
          <div className="hero-bar" />
        </div>
      </div>

      <div style={{ padding: "24px 36px 48px", position: "relative", zIndex: 1 }}>

        {/* Tab nav */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          {[["orgs","🏛 Organizations"],["analytics","📈 Analytics"],["leads","🎟 Beta Leads"],["inventory","📦 Inventories"],["accounts","⚠️ Accounts"],["feedback","💬 Feedback"],["codes","🎟 Beta Codes"]].map(([id,lbl])=>(
            <button key={id} className={`tab ${adminTab===id?"on":""}`} onClick={()=>{ setAdminTab(id); if(id==="leads"&&betaLeads.length===0){ setLeadsLoading(true); SB.from("beta_leads").select("*").order("created_at",{ascending:false}).then(({data})=>{ setBetaLeads(data||[]); setLeadsLoading(false); }); } }}>{lbl}
              {id==="feedback"&&feedback.filter(f=>f.status==="new").length>0&&(
                <span style={{background:"var(--red)",color:"#fff",borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:800,marginLeft:5}}>
                  {feedback.filter(f=>f.status==="new").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {adminTab==="analytics"&&(
          <AdminAnalyticsTab analytics={analytics} loading={analyticsLoading}
            onLoad={async()=>{
              setAnalyticsLoading(true);
              // Page views by day and page
              const { data: pvDay } = await SB.from("page_views")
                .select("page,created_at")
                .gte("created_at", new Date(Date.now()-30*864e5).toISOString())
                .order("created_at");
              // Unique sessions last 7 days
              const { data: pvWeek } = await SB.from("page_views")
                .select("session_id,page,utm_source,created_at")
                .gte("created_at", new Date(Date.now()-7*864e5).toISOString());
              // Recent signups
              const { data: recentOrgs } = await SB.from("orgs")
                .select("id,name,email,plan,created_at")
                .order("created_at", { ascending:false }).limit(20);
              // Total counts
              const { count: totalViews } = await SB.from("page_views").select("*",{count:"exact",head:true});
              const { count: totalSessions } = await SB.from("page_views").select("session_id",{count:"exact",head:true});
              setAnalytics({ pvDay: pvDay||[], pvWeek: pvWeek||[], recentOrgs: recentOrgs||[], totalViews, totalSessions });
              setAnalyticsLoading(false);
            }}
          />
        )}

        {adminTab==="leads"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <h3 style={{fontFamily:"var(--serif)",fontSize:18,marginBottom:4}}>Beta Leads — Opening Night Signups</h3>
                <p style={{fontSize:13,color:"var(--muted)"}}>Everyone who submitted the beta.html form. "Converted" = they created a Theatre4u account.</p>
              </div>
              <button className="btn btn-o btn-sm" onClick={async()=>{
                setLeadsLoading(true);
                const{data}=await SB.from("beta_leads").select("*").order("created_at",{ascending:false});
                setBetaLeads(data||[]);
                setLeadsLoading(false);
              }}>↺ Refresh</button>
            </div>
            {leadsLoading&&<div style={{color:"var(--muted)",padding:20}}>Loading…</div>}
            {!leadsLoading&&betaLeads.length===0&&(
              <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:24,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>🎟</div>
                <div style={{fontWeight:700,marginBottom:6}}>No beta leads yet</div>
                <div style={{fontSize:13,color:"var(--muted)"}}>Submissions from theatre4u.org/beta.html will appear here. Share that link to start collecting leads.</div>
              </div>
            )}
            {!leadsLoading&&betaLeads.length>0&&(
              <div>
                <div style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>{betaLeads.length} total · {betaLeads.filter(l=>l.converted).length} converted to accounts</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{background:"var(--parch)"}}>
                    {["Program","Name","Email","Type","Location","Source","Date","Status"].map(h=>(
                      <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",borderBottom:"1px solid var(--border)"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {betaLeads.map(lead=>(
                      <tr key={lead.id} style={{borderBottom:"1px solid var(--border)"}}>
                        <td style={{padding:"8px 10px",fontWeight:600}}>{lead.org}</td>
                        <td style={{padding:"8px 10px"}}>{lead.name}</td>
                        <td style={{padding:"8px 10px"}}><a href={"mailto:"+lead.email} style={{color:"var(--gold)"}}>{lead.email}</a></td>
                        <td style={{padding:"8px 10px",color:"var(--muted)",fontSize:12}}>{lead.type||"—"}</td>
                        <td style={{padding:"8px 10px",color:"var(--muted)",fontSize:12}}>{lead.location||"—"}</td>
                        <td style={{padding:"8px 10px",color:"var(--muted)",fontSize:12}}>{lead.source||"—"}</td>
                        <td style={{padding:"8px 10px",color:"var(--muted)",fontSize:12}}>{new Date(lead.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                        <td style={{padding:"8px 10px"}}>
                          {lead.converted
                            ?<span style={{fontSize:11,fontWeight:700,color:"#4caf50",background:"rgba(76,175,80,.1)",padding:"2px 8px",borderRadius:8}}>✓ Account Created</span>
                            :<span style={{fontSize:11,color:"var(--muted)",background:"var(--parch)",padding:"2px 8px",borderRadius:8}}>Lead Only</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {adminTab==="orgs"&&(<>
        {/* District Assignment Panel */}
        <AdminDistrictAssignPanel orgs={orgs} onUpdated={load} />
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { icon: "🏛",  label: "Organizations", val: totalOrgs },
            { icon: "📦",  label: "Total Items",    val: totalItems },
            { icon: "🆓",  label: "Free Accounts",  val: byPlan.free },
            { icon: "⭐",  label: "Pro Accounts",   val: byPlan.pro,      color: "var(--gold)" },
            { icon: "🏢",  label: "District Accts", val: byPlan.district, color: "#42a5f5" },
            { icon: "💰",  label: "Est. MRR",       val: "$" + mrr,       color: "var(--green)" },
          ].map(s => (
            <div key={s.label} className="card card-p" style={{ textAlign: "center", padding: "16px 12px" }}>
              <div style={{ fontSize: 26, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 700, color: s.color || "var(--linen)" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Admin emails */}
        <div className="card card-p" style={{ marginBottom: 20, borderColor: "rgba(212,168,67,.3)", background: "rgba(212,168,67,.04)" }}>
          <div className="sh"><h2 style={{ color: "var(--gold)" }}>🔑 Admin Accounts</h2><p>These emails have free District access and see this dashboard. Edit the ADMIN_EMAILS array in the source to add more.</p></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ADMIN_EMAILS.map(e => (
              <div key={e} style={{ padding: "4px 12px", background: "rgba(212,168,67,.15)", border: "1px solid rgba(212,168,67,.3)", borderRadius: 20, fontSize: 12.5, color: "var(--gold)", fontWeight: 600 }}>
                {e}{e === currentUser?.email ? " (you)" : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div className="srch-wrap" style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none", display: "flex" }}>{Ic.search}</span>
            <input className="fi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search org name or email…" style={{ paddingLeft: 34, width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            {["all","free","pro","district"].map(p => (
              <button key={p} onClick={() => setPlanF(p)} style={{ background: planF === p ? "var(--gold)" : "transparent", color: planF === p ? "#1a0f00" : "var(--muted)", border: "none", padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>
                {p === "all" ? "All" : planLabel[p]}
              </button>
            ))}
          </div>
          <button className="btn btn-g btn-sm" onClick={load} style={{minWidth:90}}>↻ Refresh</button>
          {msg && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 13 }}>✓ {msg}</span>}
        </div>

        {/* Orgs table */}
        <div className="card" style={{ overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading organizations…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No organizations found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,.25)" }}>
                    {[
                      ["Organization", 200],
                      ["Email",        180],
                      ["Type",          90],
                      ["Plan",          70],
                      ["Inventory",     80],
                      ["Joined",        90],
                      ["Change Plan",  130],
                      ["Actions",      160],
                    ].map(([h, w]) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10,
                        textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)",
                        fontWeight: 700, whiteSpace: "nowrap", minWidth: w }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o, i) => {
                    const p = o.plan || "free";
                    const isAdmin = isAdminEmail(o.email);
                    return (
                      <tr key={o.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "rgba(255,255,255,.01)" : "transparent" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13.5 }}>
                          {o.name || <span style={{ color: "var(--faint)", fontStyle: "italic" }}>Unnamed</span>}
                          {isAdmin && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", background: "rgba(212,168,67,.2)", color: "var(--gold)", borderRadius: 8, fontWeight: 700 }}>ADMIN</span>}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--muted)" }}>{o.email || "—"}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--muted)" }}>{o.type || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "3px 9px", borderRadius: 10, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, background: p === "pro" ? "rgba(212,168,67,.2)" : p === "district" ? "rgba(66,165,245,.2)" : "rgba(255,255,255,.07)", color: planColor[p] }}>
                            {planLabel[p]}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>{counts[o.id] || 0}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {["free","pro","district"].map(np => (
                              <button key={np} onClick={() => np !== p && setPlanFor(o.id, np)} disabled={np === p || saving === o.id}
                                style={{ padding: "3px 9px", fontSize: 11, fontWeight: 700, textTransform: "capitalize", cursor: np === p ? "default" : "pointer", borderRadius: 6, border: "1px solid", background: np === p ? (np === "pro" ? "rgba(212,168,67,.25)" : np === "district" ? "rgba(66,165,245,.25)" : "rgba(255,255,255,.1)") : "transparent", color: np === p ? planColor[np] : "var(--muted)", opacity: saving === o.id ? .5 : 1, fontFamily: "inherit" }}>
                                {saving === o.id ? "…" : np}
                              </button>
                            ))}
                          </div>
                        </td>
                        {/* ── Actions column — LP toggle + Edit/Items/Close ── */}
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {/* Leading Player toggle */}
                            <button
                              onClick={async () => {
                                const next = !o.is_leading_player;
                                await SB.from("orgs").update({ is_leading_player: next }).eq("id", o.id);
                                setOrgs(prev => prev.map(x => x.id === o.id ? { ...x, is_leading_player: next } : x));
                                setMsg(next ? o.name + " is now a Leading Player" : o.name + " removed from Leading Players");
                                setTimeout(() => setMsg(""), 3000);
                              }}
                              style={{
                                background: o.is_leading_player ? "linear-gradient(135deg,var(--gold2),var(--gold))" : "rgba(255,255,255,.06)",
                                border: "1px solid var(--border)",
                                color: o.is_leading_player ? "#1a1000" : "var(--muted)",
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                whiteSpace: "nowrap",
                              }}>
                              {o.is_leading_player ? "⭐ LP" : "○ LP"}
                            </button>
                            {/* Edit Org */}
                            <button onClick={() => setEditingOrg(o)}
                              style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                                borderRadius: 6, border: "1px solid var(--border)", background: "rgba(66,165,245,.1)",
                                color: "#42a5f5", fontFamily: "inherit" }}>
                              ✏️ Edit
                            </button>
                            {/* Edit Inventory */}
                            <button onClick={() => { setEditingInventoryOrg(o); setAdminTab("inventory"); }}
                              style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                                borderRadius: 6, border: "1px solid var(--border)", background: "rgba(76,175,80,.1)",
                                color: "#4caf50", fontFamily: "inherit" }}>
                              📦 Items
                            </button>
                            {/* Close/Delete — never show for admin accounts */}
                            {!isAdmin && o.account_status !== "closed" && (
                              <button onClick={() => setClosingOrg(o)}
                                style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                                  borderRadius: 6, border: "1px solid rgba(194,24,91,.3)", background: "rgba(194,24,91,.08)",
                                  color: "var(--red)", fontFamily: "inherit" }}>
                                🚫 Close
                              </button>
                            )}
                            {/* Restore closed account */}
                            {o.account_status === "closed" && (
                              <button onClick={async () => {
                                  const { data } = await SB.rpc("restore_org", { p_org_id: o.id });
                                  if (data?.success) {
                                    setOrgs(prev => prev.map(x => x.id === o.id ? {...x, account_status:"active", deleted_at:null} : x));
                                    setMsg("✓ " + o.name + " restored");
                                    setTimeout(() => setMsg(""), 3000);
                                  }
                                }}
                                style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                                  borderRadius: 6, border: "1px solid rgba(76,175,80,.3)", background: "rgba(76,175,80,.1)",
                                  color: "#4caf50", fontFamily: "inherit" }}>
                                ↩ Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "var(--faint)" }}>
          {filtered.length} of {orgs.length} organizations · Data live from Supabase
        </div>
        </>)}

        {/* ── FEEDBACK TAB ── */}
        {/* ── ADMIN INVENTORY VIEW TAB ── */}
        {adminTab==="inventory" && (
          editingInventoryOrg
            ? <AdminOrgInventoryEditor org={editingInventoryOrg} onBack={()=>setEditingInventoryOrg(null)} />
            : <AdminInventoryView />
        )}

        {/* ── ACCOUNTS TAB: closed/pending deletion ── */}
        {adminTab==="accounts" && <AdminAccountsTab orgs={orgs} onRestore={(id)=>{
          SB.rpc("restore_org",{p_org_id:id}).then(()=>{
            setOrgs(prev=>prev.map(o=>o.id===id?{...o,account_status:"active",deleted_at:null,deletion_scheduled_at:null}:o));
            setMsg("✓ Account restored"); setTimeout(()=>setMsg(""),3000);
          });
        }}/>}

        {adminTab==="feedback"&&(<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:13,color:"var(--muted)"}}>
              {feedback.length} responses · {feedback.filter(f=>f.status==="new").length} unread
            </div>
          </div>
          {feedback.length===0
            ?<div className="empty"><div className="empty-ico">💬</div><h3>No feedback yet</h3><p>Share the app with leading players and check back here.</p></div>
            :<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {feedback.map(fb=>{
                const catColor={bug:"#c2185b",feature:"#1554a0",praise:"#27723a",confusion:"#d35400",other:"#546e7a"}[fb.category]||"#546e7a";
                return(
                  <div key={fb.id} className="card card-p" style={{borderLeft:`3px solid ${catColor}`}}>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                          <span style={{padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:800,background:catColor+"22",color:catColor,textTransform:"uppercase"}}>
                            {fb.category}
                          </span>
                          <span style={{fontSize:12,fontWeight:700,color:"var(--ink)"}}>{fb.org_name||"Unknown"}</span>
                          <span style={{fontSize:11,color:"var(--muted)"}}>{new Date(fb.created_at).toLocaleDateString()}</span>
                          {fb.rating&&<span style={{fontSize:13,color:"#f9a825"}}>{"★".repeat(fb.rating)}{"☆".repeat(5-fb.rating)}</span>}
                          {fb.status==="new"&&<span style={{padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:800,background:"rgba(194,24,91,.15)",color:"var(--red)"}}>NEW</span>}
                        </div>
                        {fb.message&&<p style={{fontSize:13,color:"var(--text)",marginBottom:6,lineHeight:1.6}}>"{fb.message}"</p>}
                        {fb.hardest_inventory&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:3}}>🗂 Hardest inventory: <strong>{fb.hardest_inventory}</strong></div>}
                        {fb.prop28_pain_score&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:3}}>📋 Prop 28 pain: <strong>{fb.prop28_pain_score}/10</strong></div>}
                        {fb.lending_barrier&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:3}}>🤝 Lending barrier: <strong>{{fear_damage:"Fear of damage",logistics:"Logistics",no_agreement:"No agreement/paperwork",trust:"Don't know the program",admin_approval:"Needs admin approval",never_thought:"Never thought about it",other:"Other"}[fb.lending_barrier]||fb.lending_barrier}</strong></div>}
                        {fb.wishlist_hour&&<div style={{fontSize:12,color:"var(--muted)"}}>⏱ Save an hour: <strong>{fb.wishlist_hour}</strong></div>}
                      </div>
                      <button onClick={async()=>{
                        const nextStatus=fb.status==="new"?"read":"new";
                        await SB.from("beta_feedback").update({status:nextStatus}).eq("id",fb.id);
                        setFeedback(p=>p.map(x=>x.id===fb.id?{...x,status:nextStatus}:x));
                      }} className="btn btn-o btn-sm" style={{flexShrink:0,fontSize:11}}>
                        {fb.status==="new"?"Mark Read":"Mark Unread"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </>)}

        {/* ── BETA CODES TAB ── */}
        {adminTab==="codes"&&(<>
          <div style={{marginBottom:16}}>
            <div className="card card-p">
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:12}}>🎟 Beta Access Codes</h3>
              <div className="tw">
                <table>
                  <thead><tr>
                    <th>Code</th><th>Label</th><th>Used</th><th>Max</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {codes.map(c=>(
                      <tr key={c.code}>
                        <td style={{fontFamily:"monospace",fontWeight:800,letterSpacing:1,color:"var(--gold)"}}>{c.code}</td>
                        <td style={{fontSize:12,color:"var(--muted)"}}>{c.label}</td>
                        <td style={{fontWeight:700,color:c.used_count>0?"var(--green)":"var(--muted)"}}>{c.used_count}</td>
                        <td>{c.max_uses}</td>
                        <td><span style={{padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:800,
                          background:c.active?"rgba(38,94,42,.15)":"rgba(194,24,91,.12)",
                          color:c.active?"var(--green)":"var(--red)"}}>{c.active?"Active":"Inactive"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:14,fontSize:12,color:"var(--muted)"}}>
                Share <strong style={{color:"var(--gold)"}}>FOUNDING2026</strong> with your initial outreach group. Create additional codes in Supabase for different batches.
              </div>
            </div>
          </div>

          {/* Leading Players list */}
          <div className="card card-p">
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:12}}>🎭 Leading Players</h3>
            {orgs.filter(o=>o.is_leading_player).length===0
              ?<p style={{fontSize:13,color:"var(--muted)"}}>No leading players yet — share the code and check back.</p>
              :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {orgs.filter(o=>o.is_leading_player).map(o=>(
                  <div key={o.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"var(--parch)",borderRadius:8,border:"1px solid var(--border)"}}>
                    <span style={{fontSize:20}}>🎭</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>{o.name}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>{o.email} · Joined {new Date(o.created_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{padding:"2px 8px",borderRadius:6,fontSize:10,fontWeight:800,background:"rgba(212,168,67,.15)",color:"var(--gold)"}}>LEADING PLAYER</span>
                  </div>
                ))}
              </div>
            }
          </div>
        </>)}

      </div>

      {/* ── Edit Org Modal ── */}
      {editingOrg && (
        <AdminEditOrgModal
          org={editingOrg}
          onClose={() => setEditingOrg(null)}
          onSaved={(updated) => {
            setOrgs(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
            setEditingOrg(null);
            setMsg("✓ " + (updated.name || "Org") + " updated");
            setTimeout(() => setMsg(""), 3000);
          }}
        />
      )}

      {/* ── Close/Delete Org Modal ── */}
      {closingOrg && (
        <AdminCloseOrgModal
          org={closingOrg}
          currentUser={currentUser}
          onClose={() => setClosingOrg(null)}
          onClosed={(orgId) => {
            setOrgs(prev => prev.map(o => o.id === orgId
              ? { ...o, account_status: "closed", deleted_at: new Date().toISOString() }
              : o));
            setClosingOrg(null);
            setMsg("✓ Account closed — data deleted in 30 days");
            setTimeout(() => setMsg(""), 5000);
          }}
          onHardDeleted={(orgId) => {
            setOrgs(prev => prev.filter(o => o.id !== orgId));
            setClosingOrg(null);
            setMsg("✓ Account permanently deleted");
            setTimeout(() => setMsg(""), 5000);
          }}
        />
      )}

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// CSV IMPORT
// ══════════════════════════════════════════════════════════════════════════════

// Our canonical fields and how to auto-detect them from messy column names
const CSV_FIELDS = [
  { key:"name",      label:"Item Name",    required:true,  hints:["name","item","title","item name"] },
  { key:"category",  label:"Category",     required:false, hints:["category","cat","type","kind"] },
  { key:"condition", label:"Condition",    required:false, hints:["condition","cond","quality","state"] },
  { key:"size",      label:"Size",         required:false, hints:["size","sz"] },
  { key:"qty",       label:"Quantity",     required:false, hints:["qty","quantity","count","amount","num","number"] },
  { key:"location",  label:"Location",     required:false, hints:["location","loc","storage","bin","room","where","place"] },
  { key:"avail",     label:"Availability", required:false, hints:["availability","avail","available","status"] },
  { key:"mkt",       label:"Market Status",required:false, hints:["market","mkt","listing","listed","for rent","for sale"] },
  { key:"rent",       label:"Rental Price", required:false, hints:["rent","rental","rate","per week","weekly"] },
  { key:"loan_period",label:"Loan Period",  required:false, hints:["loan period","loan weeks","borrow period","lending period","weeks"] },
  { key:"deposit",    label:"Deposit",      required:false, hints:["deposit","security","refundable"] },
  { key:"sale",      label:"Sale Price",   required:false, hints:["sale","sell","price","cost","value"] },
  { key:"tags",      label:"Tags",         required:false, hints:["tags","tag","keywords","labels"] },
  { key:"description",label:"Description", required:false, hints:["description","desc","item description","about","overview"] },
  { key:"img",       label:"Image URL",    required:false, hints:["image","image url","photo","photo url","img","picture","url","photo link","image link"] },
  { key:"notes",     label:"Notes",        required:false, hints:["notes","note","comments","comment","remarks","details"] },
];

// Fuzzy match a CSV column header to one of our fields
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

// ── Production Detail (the folder view) ────────────────────────────────────
function ProductionDetail({ prod, allItems, userId, onEdit, onDelete, onClose }) {
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
    await SB.from("production_items").update({ status }).eq("id", piId);
    setProdItems(p => p.map(x => x.id === piId ? { ...x, status } : x));
  };

  const removeItem = async (piId) => {
    await SB.from("production_items").delete().eq("id", piId);
    setProdItems(p => p.filter(x => x.id !== piId));
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
                  ? `Opens in ${daysUntil} day${daysUntil!==1?"s":""}`
                  : daysUntil === 0 ? "Opens today!"
                  : `Opened ${new Date(prod.opening_date).toLocaleDateString()}`}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button className="btn btn-o btn-sm" onClick={onEdit}>Edit</button>
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
                          {pi.qty_needed > 1 ? ` · Need ${pi.qty_needed}` : ""}
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
    </div>
  );
}

// ── Productions Page ───────────────────────────────────────────────────────
function Productions({ userId, allItems }) {
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
    if (active && modal === "edit") {
      const { data } = await SB.from("productions")
        .update(form).eq("id", active.id).select().single();
      if (data) setProductions(p => p.map(x => x.id === data.id ? { ...x, ...data } : x));
    } else {
      const { data } = await SB.from("productions")
        .insert({ ...form, org_id: userId }).select().single();
      if (data) setProductions(p => [data, ...p]);
    }
    setModal(null); setActive(null);
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
              {filter==="all" ? "No Productions Yet" : `No ${filter} productions`}
            </h3>
            <p style={{ color:"var(--muted)", fontSize:13, maxWidth:380, margin:"0 auto 20px", lineHeight:1.6 }}>
              {filter==="all"
                ? "Create a production folder for each show. Save items from your inventory to track exactly what you need."
                : `No shows in ${filter} status.`}
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
                          ? `Opens in ${daysUntil}d`
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
function ChatWindow({ convId, currentUserId, orgNames, onClose, onUnreadChange }) {
  const [messages,  setMessages]  = useState([]);
  const [conv,      setConv]      = useState(null);
  const [body,      setBody]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const bottomRef = useRef();
  const inputRef  = useRef();

  // Load conversation + messages
  const load = useCallback(async () => {
    const { data: convData } = await SB.from("conversations").select("*").eq("id", convId).single();
    setConv(convData);
    const { data: msgs } = await SB.from("messages")
      .select("*").eq("conversation_id", convId).order("created_at");
    setMessages(msgs || []);
    setLoading(false);
    // Mark messages as read
    await SB.from("messages").update({ read: true })
      .eq("conversation_id", convId)
      .neq("sender_id", currentUserId)
      .eq("read", false);
    onUnreadChange?.();
  }, [convId, currentUserId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = SB.channel(`conv-${convId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${convId}`
      }, payload => {
        // Deduplicate — only add if this message ID isn't already in state
        setMessages(p => p.some(m => m.id === payload.new.id) ? p : [...p, payload.new]);
        if (payload.new.sender_id !== currentUserId) {
          SB.from("messages").update({ read: true }).eq("id", payload.new.id);
          onUnreadChange?.();
        }
      }).subscribe();
    return () => SB.removeChannel(channel);
  }, [convId, currentUserId]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { data: msg } = await SB.from("messages").insert({
      conversation_id: convId,
      sender_id:       currentUserId,
      body:            text,
    }).select().single();
    // Don't add to state here — realtime subscription handles it
    // This prevents the duplicate message bug
    await SB.from("conversations").update({ last_message: text, last_at: new Date().toISOString() }).eq("id", convId);

    // Notify recipient
    const otherId = conv?.org_a === currentUserId ? conv?.org_b : conv?.org_a;
    if (otherId) {
      const { data: { session } } = await SB.auth.getSession();
      fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/message-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          conversation_id: convId,
          recipient_id:    otherId,
          message_preview: text.slice(0, 200),
          item_name:       conv?.item_name || null,
          sender_name:     orgNames?.[currentUserId] || "A theatre program",
        })
      }).catch(() => {});
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const otherId = conv ? (conv.org_a === currentUserId ? conv.org_b : conv.org_a) : null;
  const otherName = otherId ? (orgNames?.[otherId] || "Unknown Program") : "…";

  const fmt = ts => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : d.toLocaleDateString([], {month:"short",day:"numeric"}) + " " + d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",
        background:"var(--parch)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--amber))",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🎭</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{otherName}</div>
            {conv?.item_name && <div style={{fontSize:11,color:"var(--muted)"}}>Re: {conv.item_name}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",
            cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
        {loading ? (
          <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>
            <div style={{fontSize:32,marginBottom:8}}>💬</div>
            <div style={{fontSize:13}}>Start the conversation!</div>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} style={{display:"flex",flexDirection:"column",
                alignItems:isMe?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"80%",padding:"9px 13px",borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background:isMe?"var(--ink)":"var(--parch)",
                  color:isMe?"var(--gold)":"var(--ink)",
                  border:isMe?"none":"1px solid var(--border)",
                  fontSize:14,lineHeight:1.5}}>
                  {msg.body}
                </div>
                <div style={{fontSize:10,color:"var(--faint)",marginTop:3,paddingLeft:4,paddingRight:4}}>
                  {fmt(msg.created_at)}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"12px",borderTop:"1px solid var(--border)",flexShrink:0,background:"var(--cream)"}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea
            ref={inputRef}
            value={body}
            onChange={e=>setBody(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
            placeholder="Type a message… (Enter to send)"
            rows={2}
            style={{flex:1,background:"var(--parch)",border:"1.5px solid var(--border)",borderRadius:8,
              padding:"8px 11px",fontSize:13,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",
              outline:"none",resize:"none",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor="var(--gold)"}
            onBlur={e=>e.target.style.borderColor="var(--border)"}
          />
          <button className="btn btn-g" onClick={send} disabled={!body.trim()||sending}
            style={{padding:"10px 16px",fontSize:13,flexShrink:0}}>
            {sending?"…":"Send"}
          </button>
        </div>
        <div style={{fontSize:10,color:"var(--faint)",marginTop:4}}>Shift+Enter for new line</div>
      </div>
    </div>
  );
}

// ── Messages Page ──────────────────────────────────────────────────────────────
function Messages({ userId, orgName, openConvId, onClearOpenConv }) {
  const [conversations, setConversations] = useState([]);
  const [orgNames,      setOrgNames]      = useState({});
  const [activeConv,    setActiveConv]    = useState(openConvId || null);
  const [loading,       setLoading]       = useState(true);
  const [showNew,       setShowNew]       = useState(false);
  const [searchOrg,     setSearchOrg]     = useState("");
  const [foundOrgs,     setFoundOrgs]     = useState([]);
  const [unreadCounts,  setUnreadCounts]  = useState({});

  const loadConvs = useCallback(async () => {
    const { data } = await SB.from("conversations")
      .select("*")
      .or(`org_a.eq.${userId},org_b.eq.${userId}`)
      .order("last_at", { ascending: false });
    setConversations(data || []);

    // Load org names for all participants
    const ids = new Set();
    (data||[]).forEach(c => { ids.add(c.org_a); ids.add(c.org_b); });
    ids.delete(userId);
    if (ids.size > 0) {
      const { data: orgs } = await SB.from("orgs").select("id,name").in("id", [...ids]);
      const map = {};
      (orgs||[]).forEach(o => map[o.id] = o.name);
      map[userId] = orgName || "You";
      setOrgNames(map);
    }

    // Count unread per conversation
    const { data: unread } = await SB.from("messages")
      .select("conversation_id")
      .eq("read", false)
      .neq("sender_id", userId);
    const counts = {};
    (unread||[]).forEach(m => { counts[m.conversation_id] = (counts[m.conversation_id]||0)+1; });
    setUnreadCounts(counts);

    setLoading(false);
  }, [userId, orgName]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  // Handle externally-opened conv (from marketplace contact button)
  useEffect(() => {
    if (openConvId) { setActiveConv(openConvId); onClearOpenConv?.(); }
  }, [openConvId]);

  // Realtime: new conversations
  useEffect(() => {
    const ch = SB.channel("convs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" },
        () => loadConvs())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        () => loadConvs())
      .subscribe();
    return () => SB.removeChannel(ch);
  }, [loadConvs]);

  // Search orgs for new general conversation
  const searchOrgs = async (q) => {
    if (q.length < 2) { setFoundOrgs([]); return; }
    const { data } = await SB.from("orgs").select("id,name,location")
      .ilike("name", `%${q}%`).neq("id", userId).limit(8);
    setFoundOrgs(data || []);
  };

  const startGeneralConv = async (targetOrg) => {
    setSearchOrg(""); setFoundOrgs([]); setShowNew(false);
    // Check for existing general conv
    const { data: existing } = await SB.from("conversations")
      .select("id")
      .is("item_id", null)
      .eq("org_a", userId)
      .eq("org_b", targetOrg.id)
      .single();
    if (existing) { setActiveConv(existing.id); return; }
    const { data: newConv } = await SB.from("conversations").insert({
      item_id: null, org_a: userId, org_b: targetOrg.id,
      item_name: null, last_message: "", last_at: new Date().toISOString(),
    }).select().single();
    if (newConv) { await loadConvs(); setActiveConv(newConv.id); }
  };

  const totalUnread = Object.values(unreadCounts).reduce((s,n)=>s+n,0);

  return (
    <div style={{display:"flex",height:"calc(100vh - 60px)",background:"var(--cream)"}}>

      {/* ── Conversation List (left panel) ── */}
      <div style={{width:320,minWidth:280,borderRight:"1px solid var(--border)",
        display:"flex",flexDirection:"column",background:"var(--cream)"}}>
        {/* Header */}
        <div style={{padding:"16px 16px 10px",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>
              Messages {totalUnread>0&&<span style={{fontSize:13,background:"var(--ink)",color:"var(--gold)",borderRadius:9,padding:"1px 7px",marginLeft:6}}>{totalUnread}</span>}
            </div>
            <button className="btn btn-g btn-sm" onClick={()=>setShowNew(!showNew)}>+ New</button>
          </div>
          {/* Search to start new general conversation */}
          {showNew && (
            <div style={{marginBottom:8}}>
              <input
                value={searchOrg}
                onChange={e=>{ setSearchOrg(e.target.value); searchOrgs(e.target.value); }}
                placeholder="Search organizations…"
                style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",borderRadius:7,
                  padding:"7px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",
                  outline:"none",boxSizing:"border-box"}}
                autoFocus
              />
              {foundOrgs.length > 0 && (
                <div style={{border:"1px solid var(--border)",borderRadius:7,marginTop:4,background:"#fff",overflow:"hidden"}}>
                  {foundOrgs.map(o => (
                    <div key={o.id} onClick={()=>startGeneralConv(o)}
                      style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid var(--border)",fontSize:13}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--parch)"}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <div style={{fontWeight:600}}>{o.name}</div>
                      {o.location&&<div style={{fontSize:11,color:"var(--muted)"}}>📍 {o.location}</div>}
                    </div>
                  ))}
                </div>
              )}
              {searchOrg.length>=2&&foundOrgs.length===0&&(
                <div style={{fontSize:12,color:"var(--muted)",marginTop:4,textAlign:"center"}}>No organizations found</div>
              )}
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div style={{flex:1,overflowY:"auto"}}>
          {loading ? (
            <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:36,marginBottom:10}}>💬</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:6}}>No messages yet</div>
              <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>
                Start a conversation by finding a program in Backstage Exchange, or wait for someone to reach out to you here.
              </div>
            </div>
          ) : (
            conversations.map(conv => {
              const otherId = conv.org_a === userId ? conv.org_b : conv.org_a;
              const otherName = orgNames[otherId] || "Unknown Program";
              const isActive = activeConv === conv.id;
              const unread = unreadCounts[conv.id] || 0;
              const lastAt = conv.last_at ? new Date(conv.last_at).toLocaleDateString([], {month:"short",day:"numeric"}) : "";
              return (
                <div key={conv.id} onClick={()=>setActiveConv(conv.id)}
                  style={{padding:"12px 16px",cursor:"pointer",borderBottom:"1px solid var(--border)",
                    background:isActive?"rgba(212,168,67,.08)":"transparent",
                    borderLeft:isActive?"3px solid var(--gold)":"3px solid transparent",
                    transition:"all .15s"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <div style={{width:38,height:38,borderRadius:"50%",
                      background:"linear-gradient(135deg,var(--gold),var(--amber))",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🎭</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <div style={{fontWeight:unread>0?800:600,fontSize:13,overflow:"hidden",
                          textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{otherName}</div>
                        <div style={{fontSize:10,color:"var(--faint)",marginLeft:6,flexShrink:0}}>{lastAt}</div>
                      </div>
                      {conv.item_name && (
                        <div style={{fontSize:11,color:"var(--amber)",marginBottom:2,fontWeight:600}}>
                          📦 {conv.item_name}
                        </div>
                      )}
                      <div style={{fontSize:12,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis"}}>{conv.last_message || "No messages yet"}</span>
                        {unread > 0 && (
                          <span style={{background:"var(--ink)",color:"var(--gold)",borderRadius:"50%",
                            width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:10,fontWeight:800,flexShrink:0,marginLeft:6}}>{unread}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat Window (right panel) ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",background:"var(--cream)"}}>
        {activeConv ? (
          <ChatWindow
            convId={activeConv}
            currentUserId={userId}
            orgNames={{...orgNames, [userId]: orgName||"You"}}
            onClose={()=>setActiveConv(null)}
            onUnreadChange={loadConvs}
          />
        ) : (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",gap:12,color:"var(--muted)"}}>
            <div style={{fontSize:56}}>💬</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--ink)"}}>Your Messages</div>
            <div style={{fontSize:14,color:"var(--muted)",maxWidth:340,textAlign:"center",lineHeight:1.6}}>
              Select a conversation on the left, or click "+ New" to message any organization. You can also contact programs directly from Backstage Exchange.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



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
  { id:"show",         label:"Upcoming Show",    icon:"🎭", color:"#7b1fa2", desc:"Share your production dates and ticket info" },
  { id:"audition",     label:"Audition Notice",  icon:"🎤", color:"#1565c0", desc:"Looking for cast or crew members" },
  { id:"photo",        label:"Production Photos", icon:"📸", color:"#c2185b", desc:"Share photos from your recent shows" },
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
            {[["all","All"],["show","🎭 Shows"],["audition","🎤 Auditions"],["photo","📸 Photos"],["wanted","🔍 Wanted"],["announcement","📢 News"]].map(([id,label])=>(
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

  // Free plan — show page blurred with upgrade overlay
  if (plan === "free" && !org?.community_enabled) {
    return (
      <div style={{position:"relative",minHeight:"80vh",overflow:"hidden"}}>
        {/* Blurred background preview */}
        <div style={{filter:"blur(3px)",opacity:.45,pointerEvents:"none",userSelect:"none"}}>
          <img src={usp("photo-1503095396549-807759245b35",1400,900)} alt="" className="page-bg-img"/>
          <div style={{padding:"32px 36px 0"}}>
            <div className="hero-wrap" style={{height:230}}>
              <img src={usp("photo-1503095396549-807759245b35",1100,290)} alt="Community" loading="eager"/>
              <div className="hero-fade"/>
              <div className="hero-body">
                <div className="hero-eyebrow">🎪 Theatre Community</div>
                <h1 className="hero-title" style={{fontSize:44}}>Community Board</h1>
              </div>
              <div className="hero-bar"/>
            </div>
          </div>
          <div style={{padding:"24px 36px",display:"flex",flexDirection:"column",gap:12}}>
            {["Opening Night — The Wizard of Oz · Ocean View Drama","Fall Musical Auditions Open — Lakewood Drama","Seeking: Fog machine for June · Edison Arts","Free to good home: 30 costume pieces · Valley PAC"].map(p=>(
              <div key={p} className="card card-p" style={{opacity:.8}}>
                <div style={{fontSize:13,fontWeight:600}}>{p}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Upgrade overlay */}
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-start",justifyContent:"center",
          background:"rgba(10,7,18,.65)",backdropFilter:"blur(2px)",zIndex:10,
          padding:"clamp(12px,4vw,40px)",overflowY:"auto"}}>
          <div className="card card-p" style={{maxWidth:420,width:"100%",textAlign:"center",
            background:"linear-gradient(135deg,#1e1208,#150f1f)",
            border:"1.5px solid rgba(212,168,67,.4)",boxShadow:"0 12px 48px rgba(0,0,0,.6)",
            margin:"auto"}}>
            <div style={{fontSize:36,marginBottom:8}}>🎪</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:8,color:"var(--linen)"}}>
              Community Board
            </h2>
            <p style={{color:"var(--muted)",fontSize:13,margin:"0 auto 16px",lineHeight:1.6}}>
              Connect with theatre programs in your area. Post show announcements, audition notices, wanted items, and production photos.
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18,textAlign:"left"}}>
              {[["🎭","Show announcements"],["🎤","Audition notices"],["📸","Production photos"],["🔍","Wanted items"]].map(([icon,text])=>(
                <div key={text} style={{display:"flex",gap:6,alignItems:"flex-start",padding:"7px 9px",
                  background:"rgba(255,255,255,.04)",borderRadius:8,border:"1px solid rgba(255,255,255,.06)"}}>
                  <span style={{fontSize:15,flexShrink:0}}>{icon}</span>
                  <span style={{fontSize:11,color:"var(--muted)",lineHeight:1.4}}>{text}</span>
                </div>
              ))}
            </div>
            <UpgradePlans compact={true}/>
          </div>
        </div>
      </div>
    );
  }

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
      <img src={usp(BG.marketplace,1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:280}}>
          <img src={usp(BG.marketplace,1100,340)} alt="Backstage Exchange" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🏪 Backstage Exchange</div>
            <h1 className="hero-title" style={{fontSize:46}}>Backstage Exchange</h1>
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
            <h1 className="hero-title" style={{ fontSize: 44 }}>Stage Points</h1>
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
            { icon: "👋", title: "Refer a Program",     earn: "+50 pts",      note: "Per program that creates an account." },
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
  const [joinCode,  setJoinCode]  = useState(null);
  // qrPoster/qrDataUrl removed — QR poster feature pending redesign
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
    const loadedCode = code?.join_code || null;
    setJoinCode(loadedCode);
    // QR pre-generation removed with poster feature
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
      expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
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
      // QR pre-generation removed
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

  const joinUrl = joinCode ? `theatre4u.org/join.html?code=${joinCode}` : null;

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
                const url = `https://theatre4u.org/join.html?token=${inv.token}`;
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
          <div style={{ background: "var(--parch)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "16px 20px" }}>

            {/* Code + link row */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>Share this code</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 900,
                  letterSpacing: 4, color: "var(--gold)" }}>{joinCode}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>Or share this link</div>
                <div style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
                  theatre4u.org/join.html?code={joinCode}
                </div>
              </div>
              <button className="btn bs bsm" onClick={() => {
                navigator.clipboard?.writeText(`https://theatre4u.org/join.html?code=${joinCode}`)
                  .then(() => flash("✓ Link copied!"))
                  .catch(() => flash("Link: https://theatre4u.org/join.html?code=" + joinCode));
              }}>Copy Link</button>
            </div>

            {/* Action buttons */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
              <button className="btn btn-g btn-sm" onClick={() => {
                const url = `https://theatre4u.org/join.html?code=${joinCode}`;
                navigator.clipboard?.writeText(url)
                  .then(() => flash("✓ Join link copied!"))
                  .catch(() => flash("Link: " + url));
              }}>📋 Copy Join Link</button>
              <button className="btn bs bsm" onClick={() => {
                const url = `https://theatre4u.org/join.html?code=${joinCode}`;
                const text = `Join ${org?.name||"our"} team on Theatre4u: ${url}`;
                if (navigator.share) {
                  navigator.share({ title:"Join our Theatre4u team", text, url }).catch(()=>{});
                } else {
                  navigator.clipboard?.writeText(text).then(()=>flash("✓ Copied!"));
                }
              }}>📤 Share via Text / Email</button>
            </div>

            <div style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.6 }}>
              Anyone with this code or link joins as <strong>Crew</strong> and can view and scan inventory.
              Copy the link and paste it in a group text, email, or post it on your callboard.
              This code never expires — revoke it anytime from this page.
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
          <UpgradePlans userId={userId} userEmail={userEmail}/>
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
              <strong>Free:</strong> 50 item cap, no Backstage Exchange access · <strong>Pro:</strong> unlimited items, Backstage Exchange · <strong>District:</strong> all Pro features + multi-org (future)
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
function LegalModal({title, onClose, children}){
  useEffect(()=>{const h=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[onClose]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"var(--bg2,#15121b)",border:"1px solid rgba(212,168,67,.2)",borderRadius:14,width:"100%",maxWidth:680,maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 8px 48px rgba(0,0,0,.6)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
          <h2 style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:18,color:"#ede8df"}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"1px solid rgba(255,255,255,.15)",borderRadius:6,color:"#9b93a8",cursor:"pointer",padding:"4px 8px",fontSize:13}}>✕ Close</button>
        </div>
        <div style={{padding:"20px 24px",overflowY:"auto",flex:1,color:"#c8c0d4",fontSize:13.5,lineHeight:1.75}}>
          {children}
        </div>
      </div>
    </div>
  );
}

const TERMS_CONTENT = [
  ["1. Acceptance of Terms","By accessing or using Theatre4u at theatre4u.org, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service. Theatre4u™ is a product of Artstracker LLC, a California limited liability company (theatre4u.org)."],
  ["2. Description of Service","Theatre4u™ is a cloud-based inventory management, resource-sharing, and community platform for theatre programs, schools, community theatres, and performing arts organizations. We reserve the right to modify or discontinue the Service at any time with reasonable notice."],
  ["3. Account Registration","You must create an account with accurate information and are responsible for maintaining confidentiality of your credentials. You must be at least 18 years old, or have authorization of a parent, guardian, or school administrator if a minor acting on behalf of an organization."],
  ["4. Subscription Plans and Payments","Theatre4u offers Free, Pro ($15/month or $150/year), and District ($49/month or $500/year) plans billed via Stripe. Subscriptions auto-renew unless cancelled. We may change pricing with 30 days notice to current subscribers."],
  ["4a. Cancellation Policy","You may cancel your subscription at any time through Settings → Plans → Manage Billing, or by emailing hello@theatre4u.org. Upon cancellation, your access continues until the end of the current billing period — no partial refunds are issued for unused time. For annual plans, a full refund is available within 30 days of purchase if you have added fewer than 10 items. After 30 days, annual plan fees are non-refundable. Your inventory data is preserved for 90 days after your plan downgrades to Free; you may export a full CSV backup at any time from the Reports page. Leading Players have guaranteed free Pro access through April 9, 2027 and are not affected by this policy."],
  ["5. User Content & License Grant","You retain all ownership of content you upload to Theatre4u™, including text, photos, images, and other materials ('User Content'). By uploading User Content, you grant Theatre4u a worldwide, non-exclusive, royalty-free, perpetual, irrevocable license to store, display, reproduce, and use that content to operate, improve, and promote the Service. This license persists even if you later remove the content or close your account. You represent that you have all necessary rights to grant this license, that your content does not infringe any third-party rights, and that you have obtained appropriate permissions for any photographs or images of identifiable individuals. Theatre4u may remove any content that violates these Terms or applicable law."],
  ["6. Exchange Transactions","Theatre4u™ provides the Backstage Exchange platform for listing items for rent, sale, or loan. We are not a party to any transaction between users. All agreements are solely between listing users and interested parties. We do not handle payments between users."],
  ["7. Prohibited Conduct","You agree not to: use the Service unlawfully; upload false or fraudulent content; attempt unauthorized access; interfere with the Service; use automated scraping tools; impersonate others; or transmit spam or malware. Violations may result in immediate account termination."],
  ["8. Intellectual Property","The Theatre4u™ name, logo, design, software, and all platform content are owned by Artstracker LLC and protected by United States and international intellectual property laws. Theatre4u™ is a trademark of Artstracker LLC. Nothing in these Terms grants you any right to use our trademarks, trade names, or other intellectual property without prior written consent. All rights not expressly granted are reserved."],
  ["9. Disclaimer of Warranties","THE SERVICE IS PROVIDED AS IS WITHOUT WARRANTIES OF ANY KIND. We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components."],
  ["10. Limitation of Liability","TO THE FULLEST EXTENT PERMITTED BY CALIFORNIA LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. Our total liability shall not exceed amounts paid by you in the three months preceding the claim."],
  ["11. Governing Law","These Terms are governed by California law. Disputes shall be resolved through binding arbitration in California under AAA rules, except either party may seek injunctive relief in court. You waive the right to class action."],
  ["12. Changes & Contact","We may modify these Terms with 14 days notice. Continued use constitutes acceptance. Questions: hello@theatre4u.org | Artstracker LLC, California, USA"],
];

const PRIVACY_CONTENT = [
  ["1. Introduction", "Theatre4u™ (theatre4u.org) is a product of Artstracker LLC, a California limited liability company. We are committed to protecting the privacy and security of all users, with special attention to the requirements applicable to educational institutions and school districts. This Privacy Policy complies with the California Consumer Privacy Act (CCPA), CalOPPA, the Family Educational Rights and Privacy Act (FERPA), and the Children's Online Privacy Protection Act (COPPA)."],
  ["2. Who Uses Theatre4u", "Theatre4u is designed for use by theatre educators, school drama departments, community theatre organizations, and district administrators. Users must be 18 years or older to create an account. Theatre4u is not intended for direct use by students under 18. School administrators and teachers are responsible for ensuring appropriate use within their programs."],
  ["3. Information We Collect", "Account Information: organization name, email address, password (encrypted via Supabase Auth — we never see plaintext passwords), and optional profile details including phone, city, and bio. Inventory Data: item names, descriptions, photos, locations, and condition notes you add to your account. Communication Data: messages sent between organizations on the platform. Usage Data: pages visited and features used, to improve the platform. We do NOT collect student personally identifiable information (PII). All data belongs to your organization."],
  ["4. How We Use Your Information", "To provide and operate the Theatre4u platform. To facilitate Backstage Exchange listings and rental/loan requests between theatre programs. To send transactional emails (request notifications, account confirmation) via Resend from hello@theatre4u.org. To improve the platform based on anonymized usage patterns. We do NOT sell your data. We do NOT use your data for advertising. We do NOT share your data with third parties except as described in section 5."],
  ["5. Data Sharing & Third Parties", "Supabase (supabase.com): Our database and authentication provider, hosted in AWS us-east-1. All data is encrypted at rest and in transit. Supabase is SOC 2 Type II certified. Resend (resend.com): Transactional email delivery only. Vercel (vercel.com): Web hosting and CDN. No user data is stored by Vercel. Stripe (stripe.com): Payment processing for subscriptions only. Stripe does not receive inventory or student data. Other Theatre Programs: When you post items to Backstage Exchange, your organization name, location, and listed items are visible to other logged-in Theatre4u members. No other sharing occurs."],
  ["6. FERPA Compliance", "Theatre4u acknowledges its role as a service provider to educational institutions subject to FERPA. Theatre4u does not collect, store, or process student education records as defined by FERPA. All inventory and operational data belongs to the subscribing organization (the school or district), not to individual students. School administrators retain full control over their organizational data and may request complete data deletion at any time. Theatre4u will not disclose organizational data to third parties without the written consent of the institution's authorized representative, except as required by law."],
  ["7. Student Privacy (COPPA)", "Theatre4u accounts are for adults only (18+). If you believe a minor has created an account without authorization, contact hello@theatre4u.org immediately and we will delete the account and all associated data within 48 hours. Theatre4u does not knowingly collect personal information from children under 13."],
  ["8. Data Security", "All data is encrypted in transit via TLS 1.2+. Database data is encrypted at rest via AES-256 (Supabase/AWS). Passwords are hashed using bcrypt — we cannot access your password. Authentication tokens expire automatically. Row-Level Security (RLS) is enforced on all database tables — each organization can only access its own data. Security headers (HSTS, CSP, X-Frame-Options) are enforced on all pages. The anon key exposed in the client is restricted by RLS policies and cannot access other organizations' private data."],
  ["9. Data Retention & Deletion", "Your data is retained as long as your account is active. You may request complete deletion of your account and all associated data at any time by emailing hello@theatre4u.org. We will complete deletion within 30 days. Deleted data is not recoverable. Anonymized aggregate statistics (total item counts, etc.) may be retained. Backup snapshots are retained for 7 days before permanent deletion."],
  ["10. Your Rights (CCPA)", "California residents have the right to: know what personal data we collect and how it is used; request deletion of your data; opt out of sale of personal data (we do not sell data); non-discrimination for exercising privacy rights. To exercise any right: email hello@theatre4u.org with 'Privacy Request' in the subject line."],
  ["11. District Data Agreements", "For school district subscribers (District plan), Artstracker LLC will execute a Data Processing Agreement (DPA) upon request. Contact hello@theatre4u.org. We will cooperate with district IT security reviews and questionnaires. Theatre4u's infrastructure (Supabase/Vercel) can provide SOC 2 and ISO 27001 documentation upon request for your district's vendor review process."],
  ["12. Changes & Contact", "We will notify users of material changes to this policy with at least 14 days notice via email. Questions, data requests, or security concerns: hello@theatre4u.org | theatre4u.org | Artstracker LLC, California, USA. For security vulnerabilities, please email hello@theatre4u.org with 'Security' in the subject line."],
];
// ── Landing Page ──────────────────────────────────────────────────────────────
function LandingPage({onSignIn, onSignUp, onTakeTour=null}){
  const[scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",h,{passive:true});
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
        <div style={{width:34,height:34,background:"linear-gradient(135deg,var(--gold),var(--goldd))",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎭</div>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"var(--gold)"}}>Theatre4u™</span>
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
            <button onClick={onTakeTour} style={{background:"transparent",border:"1px solid rgba(212,168,67,.5)",color:"rgba(212,168,67,.9)",padding:"14px 24px",borderRadius:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:600,transition:"all .2s"}}>
              👁 Preview the Platform
            </button>
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
        Thirty Years in the Theatre,<br/><span style={{color:"var(--gold)"}}>Building Something Better.</span>
      </h2>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,textAlign:"left",marginBottom:40}}>
        <div>
          <p style={{fontSize:16,lineHeight:1.8,color:"rgba(255,255,255,.7)",marginBottom:16}}>
            Theatre4u™ was built by someone who found theatre in high school and never looked back. Over thirty years — studying the craft, performing in New Hampshire, San Francisco, New York City, and finally Southern California — the stage has always been home.
          </p>
          <p style={{fontSize:16,lineHeight:1.8,color:"rgba(255,255,255,.7)"}}>
            That journey led to the classroom and to a simple realization: theatre programs everywhere are filled with talented, dedicated people doing extraordinary work — and they deserve tools that help them do even more of it.
          </p>
        </div>
        <div>
          <p style={{fontSize:16,lineHeight:1.8,color:"rgba(255,255,255,.7)",marginBottom:16}}>
            Theatre4u™ keeps track of everything your program owns — and opens the door to a community of programs ready to share resources, collaborate, and support each other across the region.
          </p>
          <p style={{fontSize:16,lineHeight:1.8,color:"rgba(255,255,255,.7)"}}>
            <strong style={{color:"#fff"}}>Theatre is always better together.</strong> This platform was built to help make that connection easier — from the wings to the whole community.
          </p>
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
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"var(--gold)"}}>Theatre4u™</span>
        <span style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>© 2026 Artstracker LLC</span>
      </div>
      <div style={{display:"flex",gap:18,fontSize:12,color:"rgba(255,255,255,.35)"}}>
        <a href="/help.html" target="_blank" style={{color:"rgba(255,255,255,.35)",textDecoration:"none"}} onMouseEnter={e=>e.target.style.color="var(--gold)"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.35)"}>Help Center</a>
        <span style={{cursor:"pointer"}} onClick={onSignIn}>Sign In</span>
        <span style={{cursor:"pointer"}} onClick={onSignUp}>Sign Up</span>
        <span>hello@theatre4u.org</span>
      </div>
    </div>
  </div>);
}


function AuthOverlay({onAuth, pendingInvite, inviteInfo}){
  const[visible,setVisible]=useState(false);
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[orgName,setOrgName]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[done,setDone]=useState(false);
  const[legal,setLegal]=useState(null);
  const[betaCode,setBetaCode]=useState("");
  const[betaValid,setBetaValid]=useState(null); // null=unchecked, true=valid, false=invalid
  const[showPass,setShowPass]=useState(false);

  useEffect(()=>{
    window.__t4u_show_auth=(m)=>{setMode(m||"login");setErr("");setVisible(true);};
    return()=>{delete window.__t4u_show_auth;};
  },[]);

  useEffect(()=>{
    if(pendingInvite&&!visible){
      // Default to login — existing accounts are the common case for district invites
      setMode("login");setVisible(true);
      if(inviteInfo?.email) setEmail(inviteInfo.email);
      if(inviteInfo?.school_name) setOrgName(inviteInfo.school_name);
    }
  },[pendingInvite,inviteInfo]);

  if(!visible) return null;

  const close=()=>{setVisible(false);setErr("");setEmail("");setPass("");setOrgName("");setDone(false);};

  const submit=async()=>{
    setErr("");
    if(!email.trim()){setErr("Please enter your email address.");return;}
    if(!pass){setErr("Please enter a password.");return;}
    if(mode==="signup"&&pass.length<6){setErr("Password must be at least 6 characters.");return;}
    setLoading(true);
    try{
      if(mode==="signup"){
        if(!orgName.trim()){setErr("Please enter your organization name.");setLoading(false);return;}
        // Validate beta code before signup
        const code = betaCode.trim().toUpperCase();
        if(code){
          const{data:codeData,error:codeErr}=await SB.from("beta_codes")
            .select("code,max_uses,used_count,active")
            .eq("code",code).eq("active",true).single();
          if(codeErr||!codeData){throw new Error("Invalid or expired access code. Please check with your contact.");}
          if(codeData.used_count>=codeData.max_uses){throw new Error("This access code has reached its limit. Contact hello@theatre4u.org.");}
        }
        const{data,error}=await SB.auth.signUp({email,password:pass,options:{data:{org_name:orgName},emailRedirectTo:"https://theatre4u.org"}});
        if(error){
          if(error.message?.toLowerCase().includes('already registered')||error.message?.toLowerCase().includes('already exists')){
            setMode("login");
            setErr("An account with this email already exists — switching you to Sign In. Use Forgot password if needed.");
            setLoading(false); return;
          }
          throw error;
        }
        if(data.user){
          const isLeadingPlayer = !!betaCode.trim(); // any valid beta code = Leading Player
          // Track signup conversion with UTM attribution
          const _sid = window.__t4u_sid || sessionStorage.getItem("t4u_sid") || null;
          const _utm = window.__t4u_utm || JSON.parse(sessionStorage.getItem("t4u_utm")||"{}");
          await SB.from("signup_events").insert({
            session_id: _sid, org_id: data.user.id,
            beta_code: betaCode.trim().toUpperCase()||null,
            utm_source: _utm.source||null, utm_medium: _utm.medium||null, utm_campaign: _utm.campaign||null,
            referrer: document.referrer||null
          }).then(()=>{}).catch(()=>{}); // fire and forget
          await SB.from("orgs").upsert({
            id:data.user.id,name:orgName,email,type:"",phone:"",location:"",bio:"",
            beta_code:betaCode.trim().toUpperCase()||null,
            is_leading_player:isLeadingPlayer,
          },{onConflict:"id",ignoreDuplicates:false});
          // Increment code usage
          if(betaCode.trim()){
            await SB.from("beta_codes").update({used_count:codeData.used_count+1}).eq("code",betaCode.trim().toUpperCase());
          }
          setDone(true);
        }
      } else {
        const{data,error}=await SB.auth.signInWithPassword({email,password:pass});
        if(error){
          // If credentials invalid — could be wrong password OR no account yet
          if(error.message?.toLowerCase().includes("invalid")||error.message?.toLowerCase().includes("credentials")){
            throw new Error("Incorrect email or password. If you don't have an account yet, click Create Account above. Or use Forgot password to reset.");
          }
          throw error;
        }
        onAuth(data.user);
        close();
      }
    }catch(e){const k=authErrKey(e.message);setErr(k?EM[k].body:EM.generic.body);}
    setLoading(false);
  };

  const resetPass=async()=>{
    if(!email){setErr("Enter your email above first.");return;}
    const{error:re}=await SB.auth.resetPasswordForEmail(email,{redirectTo:"https://theatre4u.org"});
    if(re){setErr(EM.resetPass.body);return;}
    setErr("✓ Password reset email sent — check your inbox.");
  };

  const overlayStyle={position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"};
  const cardStyle={background:"#15121b",border:"1px solid #282333",borderRadius:16,width:"100%",maxWidth:440,padding:"36px 36px 32px",boxShadow:"0 16px 56px rgba(0,0,0,.6)",animation:"lp-rise .2s ease",fontFamily:"'DM Sans',sans-serif",color:"#ede8df"};
  const inputStyle={width:"100%",background:"#110f18",border:"1px solid #282333",borderRadius:6,padding:"10px 12px",color:"#ede8df",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"};
  const labelStyle={fontSize:11,fontWeight:600,color:"#9b93a8",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4};

  if(done) return(
    <div style={overlayStyle}>
      <div style={{...cardStyle,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:12}}>🎭</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"#d4a843",marginBottom:8}}>{inviteInfo?"Almost there!":"Check your email!"}</h2>
        <p style={{color:"#9b93a8",fontSize:14,lineHeight:1.6,marginBottom:24}}>{inviteInfo?<>We sent a confirmation link to <strong style={{color:"#ede8df"}}>{email}</strong>. Click it to activate and you'll be linked to {inviteInfo.district_name||"your district"}.</>:<>We sent a confirmation link to <strong style={{color:"#ede8df"}}>{email}</strong>. Click it to activate your account.</>}</p>
        <button onClick={()=>{setDone(false);setMode("login");}} style={{background:"#1d1925",border:"1px solid #282333",color:"#ede8df",padding:"10px 24px",borderRadius:6,cursor:"pointer",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>Back to Sign In</button>
      </div>
    </div>
  );

  return(
    <div style={overlayStyle} onClick={e=>{if(!loading&&e.target===e.currentTarget)close();}}>
      <div style={cardStyle} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#ede8df"}}>{mode==="login"?"Welcome back":"Get started free"}</div>
            <div style={{fontSize:12,color:"#685f76",marginTop:3}}>{mode==="login"?"Sign in to your Theatre4u™ account":"Create your free Theatre4u™ account"}</div>
          </div>
          <button onClick={close} style={{background:"none",border:"1px solid #282333",borderRadius:6,color:"#9b93a8",cursor:"pointer",padding:"4px 9px",fontSize:14,lineHeight:1}}>×</button>
        </div>
        {pendingInvite&&inviteInfo&&(
          <div style={{background:"rgba(212,168,67,.1)",border:"1px solid rgba(212,168,67,.28)",borderRadius:10,padding:"12px 14px",marginBottom:18}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
              <span style={{fontSize:20,flexShrink:0}}>🎭</span>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:"#d4a843",marginBottom:2}}>District Invite</div>
                <div style={{fontSize:12.5,color:"#c8c0d4",lineHeight:1.5}}>
                  {inviteInfo.district_name?<>Join <strong style={{color:"#ede8df"}}>{inviteInfo.district_name}</strong> on Theatre4u™.</>:"You've been invited to join a district on Theatre4u™."}
                  {inviteInfo.school_name&&<> School: <strong style={{color:"#ede8df"}}>{inviteInfo.school_name}</strong>.</>}
                </div>
              </div>
            </div>
            <div style={{background:"rgba(0,0,0,.25)",borderRadius:7,padding:"9px 11px",fontSize:12,color:"#9b93a8",lineHeight:1.6}}>
              <strong style={{color:"#ede8df"}}>Already have a Theatre4u™ account?</strong> Sign in below — your existing inventory and data will be linked to the district automatically.<br/>
              <strong style={{color:"#ede8df"}}>New to Theatre4u™?</strong> Switch to Create Account to set up a new school account.
            </div>
          </div>
        )}
        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"2px solid #282333",marginBottom:22,gap:2}}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");setShowPass(false);}} style={{flex:1,background:"none",border:"none",borderBottom:`3px solid ${mode===m?"#d4a843":"transparent"}`,padding:"7px 0 9px",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,color:mode===m?"#d4a843":"#685f76",cursor:"pointer",textTransform:"uppercase",letterSpacing:1,marginBottom:-2,transition:"all .2s"}}>
              {m==="login"?"Sign In":"Create Account"}
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {mode==="signup"&&(<>
            <div><label style={labelStyle}>Organization Name</label>
              <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Lincoln High Drama Dept." style={inputStyle} onFocus={e=>e.target.style.borderColor="#d4a843"} onBlur={e=>e.target.style.borderColor="#282333"}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Access Code <span style={{fontWeight:400,color:"rgba(255,255,255,.35)",fontSize:11}}>(optional — leave blank if you don't have one)</span></label>
              <input value={betaCode} onChange={e=>setBetaCode(e.target.value.toUpperCase())}
                placeholder="e.g. LEADINGPLAYER"
                style={{...inputStyle,letterSpacing:2,fontFamily:"monospace",fontSize:14}}
                onFocus={e=>e.target.style.borderColor="#d4a843"} onBlur={e=>e.target.style.borderColor="#282333"}/>
              {betaCode.trim()&&<div style={{fontSize:11,color:"rgba(212,168,67,.7)",marginTop:4}}>
                🎭 Leading Player access — you'll be part of shaping Theatre4u™ from the ground up.
              </div>}
            </div>
          </>)}
          <div><label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@school.edu" style={inputStyle} onFocus={e=>e.target.style.borderColor="#d4a843"} onBlur={e=>e.target.style.borderColor="#282333"} onKeyDown={e=>e.key==="Enter"&&submit()}/>
          </div>
          <div><label style={labelStyle}>Password</label>
            <div style={{position:"relative"}}>
              <input type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)}
                placeholder={mode==="signup"?"Min. 6 characters":"••••••••"}
                style={{...inputStyle,paddingRight:42}}
                onFocus={e=>e.target.style.borderColor="#d4a843"}
                onBlur={e=>e.target.style.borderColor="#282333"}
                onKeyDown={e=>e.key==="Enter"&&submit()}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)}
                style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",cursor:"pointer",color:"#685f76",
                  fontSize:13,fontFamily:"'DM Sans',sans-serif",padding:"2px 4px",
                  fontWeight:600,userSelect:"none"}}
                title={showPass?"Hide password":"Show password"}>
                {showPass?"Hide":"Show"}
              </button>
            </div>
          </div>
        </div>
        {err&&<div style={{marginTop:12,padding:"9px 12px",background:err.includes("sent")?"rgba(76,175,80,.1)":"rgba(194,24,91,.1)",border:`1px solid ${err.includes("sent")?"rgba(76,175,80,.3)":"rgba(194,24,91,.25)"}`,borderRadius:7,fontSize:13,color:err.includes("sent")?"#4caf50":"#e57373"}}>{err}</div>}
        {mode==="signup"&&<p style={{fontSize:11,color:"rgba(255,255,255,.4)",textAlign:"center",marginTop:16,lineHeight:1.6}}>
          By creating an account you agree to our{" "}
          <span style={{color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setLegal("terms")}>Terms of Service</span>
          {" "}and{" "}
          <span style={{color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setLegal("privacy")}>Privacy Policy</span>,
          including the grant of a perpetual license to content you upload.
        </p>}
        <button onClick={submit} disabled={loading} style={{marginTop:12,width:"100%",background:"linear-gradient(135deg,#d4a843,#a37f2c)",color:"#1a0f00",border:"none",borderRadius:6,padding:"12px",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",opacity:loading?.7:1}}>
          {loading?"Please wait…":mode==="login"?"Sign In →":"Create Free Account →"}
        </button>

        {mode==="login"&&<button onClick={resetPass} style={{display:"block",margin:"12px auto 0",background:"none",border:"none",color:"#685f76",fontSize:12.5,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textDecoration:"underline"}}>Forgot password?</button>}
        <div style={{textAlign:"center",marginTop:14,fontSize:12.5,color:"#685f76"}}>
          {mode==="login"?<>Don&apos;t have an account? <button onClick={()=>{setMode("signup");setErr("");}} style={{background:"none",border:"none",color:"#d4a843",cursor:"pointer",fontSize:12.5,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Sign up free</button></>:<>Already have an account? <button onClick={()=>{setMode("login");setErr("");}} style={{background:"none",border:"none",color:"#d4a843",cursor:"pointer",fontSize:12.5,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Sign in</button></>}
        </div>
        {mode==="signup"&&(
          <p style={{textAlign:"center",fontSize:11,color:"#685f76",marginTop:14,lineHeight:1.5}}>
            Free plan includes 50 items. No credit card required.
          </p>
        )}
      </div>
      {legal==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegal(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legal==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegal(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
    </div>
  );
}

function AuthScreen({onAuth}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[orgName,setOrgName]=useState("");
  const[betaCode,setBetaCode]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[done,setDone]=useState(false);
  const[legal,setLegal]=useState(null);

  const submit=async()=>{
    setErr("");
    if(!email.trim()){setErr("Please enter your email address.");return;}
    if(!pass){setErr("Please enter a password.");return;}
    if(mode==="signup"&&pass.length<6){setErr("Password must be at least 6 characters.");return;}
    setLoading(true);
    try{
      if(mode==="signup"){
        if(!orgName.trim()){setErr("Please enter your organization name.");setLoading(false);return;}
        // Validate beta code if provided
        let codeData = null;
        const code = betaCode.trim().toUpperCase();
        if(code){
          const{data:cd,error:codeErr}=await SB.from("beta_codes").select("code,max_uses,used_count,active").eq("code",code).eq("active",true).single();
          if(codeErr||!cd){throw new Error("Invalid or expired access code. Please check with your contact.");}
          if(cd.used_count>=cd.max_uses){throw new Error("This access code has reached its limit. Contact hello@theatre4u.org.");}
          codeData = cd;
        }
        const{data,error}=await SB.auth.signUp({email,password:pass,options:{data:{org_name:orgName},emailRedirectTo:"https://theatre4u.org"}});
        if(error)throw error;
        if(data.user){
          const isLeadingPlayer = !!code;
          await SB.from("orgs").upsert({id:data.user.id,name:orgName,email,type:"",phone:"",location:"",bio:"",beta_code:code||null,is_leading_player:isLeadingPlayer},{onConflict:"id",ignoreDuplicates:false});
          if(code&&codeData){
            await SB.from("beta_codes").update({used_count:codeData.used_count+1}).eq("code",code);
          }
          if(data.session){
            // Email confirmation is OFF — user is already logged in
            if(typeof onAuth==="function") onAuth(data.user, true); // true = new signup
          } else {
            setDone(true);
          }
        }
      } else {
        const{data,error}=await SB.auth.signInWithPassword({email,password:pass});
        if(error)throw error;
        onAuth(data.user);
      }
    }catch(e){const k=authErrKey(e.message);setErr(k?EM[k].body:EM.generic.body);}
    setLoading(false);
  };

  const resetPass=async()=>{
    if(!email){setErr("Enter your email above first.");return;}
    const{error:re}=await SB.auth.resetPasswordForEmail(email,{redirectTo:"https://theatre4u.org"});
    if(re){setErr(EM.resetPass.body);return;}
    setErr("✓ Password reset email sent — check your inbox.");
  };

  if(done) return(
    <div style={{minHeight:"100vh",background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{CSS}</style>
      <div style={{background:"var(--cream)",borderRadius:16,padding:"48px 40px",maxWidth:440,width:"100%",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,.4)"}}>
        <div style={{fontSize:52,marginBottom:12}}>🎭</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:"var(--ink)",marginBottom:8}}>Check your email!</h2>
        <p style={{color:"var(--muted)",fontSize:15,lineHeight:1.6,marginBottom:24}}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and get started.</p>
        <button className="btn btn-o" onClick={()=>{setDone(false);setMode("login");}}>Back to Login</button>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <img src={usp(BG.dashboard,1400,900)} alt="" style={{position:"fixed",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.18,filter:"sepia(.6)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:440}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:6}}>🎭</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,color:"var(--gold)",letterSpacing:1}}>Theatre4u™</div>
          <div style={{fontFamily:"'Lora',serif",fontStyle:"italic",fontSize:15,color:"rgba(255,255,255,.5)",marginTop:2}}>Inventory · Backstage Exchange · Community</div>
        </div>
        {/* Card */}
        <div style={{background:"var(--cream)",borderRadius:16,padding:"36px 36px 32px",boxShadow:"0 16px 56px rgba(0,0,0,.5)"}}>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"2px solid var(--linen)",marginBottom:24,gap:2}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setErr("");}} style={{flex:1,background:"none",border:"none",borderBottom:`3px solid ${mode===m?"var(--gold)":"transparent"}`,padding:"8px 0 10px",fontFamily:"'Raleway',sans-serif",fontWeight:800,fontSize:14,color:mode===m?"var(--amber)":"var(--faint)",cursor:"pointer",textTransform:"uppercase",letterSpacing:1,marginBottom:-2,transition:"all .2s"}}>
                {m==="login"?"Sign In":"Create Account"}
              </button>
            ))}
          </div>
          {/* Fields */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {mode==="signup"&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Organization Name</label>
                  <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Lincoln High Drama Dept." style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--linen)",borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",outline:"none",boxSizing:"border-box"}}
                    onFocus={e=>e.target.style.borderColor="var(--gold)"} onBlur={e=>e.target.style.borderColor="var(--linen)"}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Access Code <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>(optional — leave blank if you don't have one)</span></label>
                  <input value={betaCode} onChange={e=>setBetaCode(e.target.value.toUpperCase())}
                    placeholder="e.g. LEADINGPLAYER"
                    style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--linen)",borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"monospace",letterSpacing:2,color:"var(--ink)",outline:"none",boxSizing:"border-box"}}
                    onFocus={e=>e.target.style.borderColor="var(--gold)"} onBlur={e=>e.target.style.borderColor="var(--linen)"}/>
                  {betaCode.trim()&&<div style={{fontSize:11,color:"var(--amber)",marginTop:4}}>🎭 Leading Player access — you'll be part of shaping Theatre4u™ from the ground up.</div>}
                </div>
              </div>
            )}
            <div>
              <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@school.edu" style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--linen)",borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",outline:"none",boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor="var(--gold)"} onBlur={e=>e.target.style.borderColor="var(--linen)"}
                onKeyDown={e=>e.key==="Enter"&&submit()}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Password</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder={mode==="signup"?"Min. 6 characters":"••••••••"} style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--linen)",borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",outline:"none",boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor="var(--gold)"} onBlur={e=>e.target.style.borderColor="var(--linen)"}
                onKeyDown={e=>e.key==="Enter"&&submit()}/>
            </div>
          </div>
          {err&&<div style={{marginTop:12,padding:"9px 12px",background:err.includes("sent")?"rgba(38,94,42,.1)":"rgba(139,26,42,.08)",border:`1px solid ${err.includes("sent")?"rgba(38,94,42,.3)":"rgba(139,26,42,.2)"}`,borderRadius:7,fontSize:13,color:err.includes("sent")?"var(--green)":"var(--red)"}}>{err}</div>}
          <button className="btn btn-g btn-full" style={{marginTop:20,padding:"12px",fontSize:15,letterSpacing:.3}} onClick={submit} disabled={loading}>
            {loading?"Please wait…":mode==="login"?"Sign In →":"Create Free Account →"}
          </button>
          {mode==="login"&&<button onClick={resetPass} style={{display:"block",margin:"12px auto 0",background:"none",border:"none",color:"var(--faint)",fontSize:12.5,cursor:"pointer",fontFamily:"'Raleway',sans-serif",textDecoration:"underline"}}>Forgot password?</button>}
          {mode==="signup"&&<p style={{fontSize:12,color:"var(--faint)",textAlign:"center",marginTop:14,lineHeight:1.6}}>Free to start — no credit card needed. By creating an account you agree to our{" "}<span onClick={()=>setLegal("terms")} style={{color:"var(--gold)",textDecoration:"underline",cursor:"pointer"}}>Terms of Service</span>{" "}and{" "}<span onClick={()=>setLegal("privacy")} style={{color:"var(--gold)",textDecoration:"underline",cursor:"pointer"}}>Privacy Policy</span>.</p>}
        </div>
        <p style={{textAlign:"center",color:"rgba(255,255,255,.25)",fontSize:12,marginTop:20}}>Theatre4u™ · Artstracker LLC · theatre4u.org</p>
      </div>
      {legal==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegal(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legal==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegal(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════════

// ── Public Item Page (no login required) ─────────────────────────────────────
function PublicItemPage({ itemId }) {
  const [item,    setItem]    = useState(null);
  const [org,     setOrg]     = useState(null);
  const [err,     setErr]     = useState(null);
  const [legacy,  setLegacy]  = useState(false);
  const [lb,      setLb]      = useState(null);
  const [access,  setAccess]  = useState("full");  // "full" | "contact"
  const [contact, setContact] = useState(null);    // org contact fields

  useEffect(()=>{
    (async()=>{
      const cleanId = (itemId || "").trim();
      if(!cleanId) return;
      try {
        // Pass auth token so edge function can check org membership
        const { data: { session } } = await SB.auth.getSession();
        const token = session?.access_token;
        const headers = token ? { "x-t4u-token": token } : {};
        const res  = await fetch(
          "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/public-item?id=" + encodeURIComponent(cleanId),
          { headers }
        );
        const json = await res.json();
        if (!res.ok || !json.item) {
          setLegacy(!!json.legacy);
          setErr("Item not found.");
          return;
        }
        setAccess(json.access || "full");
        if (json.contact) setContact(json.contact);
        if (json.access === "contact") {
          setItem(json.item); // minimal item (name + display_id only)
          return;
        }
        // Full access: map column names to UI field names
        const raw = json.item;
        setItem({
          ...raw,
          quantity:     raw.qty,
          availability: raw.avail,
          images:       raw.img ? [raw.img] : [],
        });
        if (json.org) setOrg(json.org);
      } catch(e) {
        console.error("public-item fetch:", e);
        setErr("Item not found.");
      }
    })();
  }, [itemId]);

  const cat = item ? (CAT_MAP[item.category] || CAT_MAP.other) : null;
  const mkt = item?.mkt || item?.market_status || item?.marketStatus || "Not Listed";
  const rentalPrice = item?.rent || item?.rental_price || item?.rentalPrice || 0;
  const salePrice   = item?.sale || item?.sale_price  || item?.salePrice   || 0;
  const mB  = mkt==="For Rent"?"r":mkt==="For Sale"?"s":mkt==="Rent or Sale"?"b":"n";
  const imgs = item?.images || [];

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:"var(--ink)",color:"var(--linen)",fontFamily:"'DM Sans',sans-serif",padding:"0 0 60px"}}>
      {lb && <div className="lightbox" onClick={()=>setLb(null)}><img src={lb} alt=""/></div>}

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1a0d2e,#0d1829)",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:26}}>🎭</span>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"var(--gold)",lineHeight:1}}>Theatre4u™</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>Inventory · Backstage Exchange · Community</div>
        </div>
        <a href="https://theatre4u.org" style={{marginLeft:"auto",fontSize:12,color:"var(--gold)",textDecoration:"none",border:"1px solid rgba(212,168,67,.3)",borderRadius:6,padding:"5px 12px"}}>Visit Site →</a>
      </div>

      <div style={{maxWidth:640,margin:"0 auto",padding:"24px 16px"}}>
        {!item && !err && (
          <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,.4)"}}>
            <div style={{fontSize:42,marginBottom:12}}>🎭</div>
            <div>Loading item…</div>
          </div>
        )}

        {err && (
          <div style={{textAlign:"center",padding:"40px 16px"}}>
            <div style={{fontSize:42,marginBottom:12}}>🔍</div>
            <div style={{fontSize:20,fontFamily:"'Playfair Display',serif",marginBottom:10,color:"var(--gold)"}}>Item Not Found</div>
            {legacy ? (<>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:14,lineHeight:1.7,marginBottom:20}}>
                This QR label was printed with an older format and can no longer be looked up automatically.<br/>
                <span style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>The item owner needs to reprint the label from their Theatre4u inventory.</span>
              </div>
            </>) : (<>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:14,lineHeight:1.7,marginBottom:20}}>
                This item may have been deleted or the QR label may be damaged.<br/>
                <span style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>If you own this item, check your inventory and reprint the label.</span>
              </div>
            </>)}
            <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
              <a href="https://theatre4u.org?signin=1" style={{display:"inline-block",padding:"10px 24px",background:"linear-gradient(135deg,#c4922a,#8b6914)",borderRadius:8,color:"#1a0f00",fontWeight:700,textDecoration:"none",fontSize:14}}>
                Sign In to Theatre4u →
              </a>
              <a href="mailto:hello@theatre4u.org" style={{display:"inline-block",padding:"8px 18px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,color:"rgba(255,255,255,.6)",textDecoration:"none",fontSize:13}}>
                Contact Support
              </a>
            </div>
          </div>
        )}

        {item && access === "contact" && (
          <div style={{padding:"28px 0"}}>
            <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:20,marginBottom:16}}>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:4}}>Item Scanned</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:4}}>{item.name}</div>
              {item.display_id && <div style={{fontSize:12,color:"var(--gold)",fontWeight:700}}>{item.display_id}</div>}
            </div>
            <div style={{background:"rgba(212,168,67,.06)",border:"1px solid rgba(212,168,67,.2)",borderRadius:12,padding:20,marginBottom:16}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"var(--gold)",marginBottom:12}}>🔒 Private Inventory</div>
              <p style={{fontSize:13.5,color:"rgba(255,255,255,.65)",lineHeight:1.7,marginBottom:0}}>This item belongs to a private inventory. To view full details you must be a team member of this program, or contact the owner to request access.</p>
            </div>
            {contact && Object.keys(contact).length > 0 && (
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:20,marginBottom:16}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:10}}>Program Contact</div>
                {contact.name     && <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{contact.name}</div>}
                {contact.location && <div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:8}}>📍 {contact.location}</div>}
                {contact.bio      && <div style={{fontSize:13,color:"rgba(255,255,255,.55)",lineHeight:1.6,marginBottom:10}}>{contact.bio}</div>}
                {contact.email && (
                  <a href={"mailto:"+contact.email+"?subject=Item Inquiry: "+encodeURIComponent(item.name||"")+"&body=Hi, I scanned a QR code for the item "+encodeURIComponent(item.name||"")+" (ID: "+(item.display_id||item.id)+") and would like to learn more or request access."}
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
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <a href={"https://theatre4u.org?signin=1&next="+encodeURIComponent("#/item/"+itemId)}
                onClick={()=>{ try{ localStorage.setItem("t4u_post_auth_hash","#/item/"+itemId); }catch(e){} }}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,#c4922a,#8b6914)",color:"#1a0f00",padding:"12px 16px",borderRadius:8,textDecoration:"none",fontSize:14,fontWeight:700}}>
                🎭 Sign In — Team Members Click Here
              </a>
              <p style={{fontSize:11.5,color:"rgba(255,255,255,.3)",textAlign:"center",lineHeight:1.5}}>If you are a Stage Manager, Crew, or House member of this program, sign in to view full item details.</p>
            </div>
          </div>
        )}

        {item && access === "full" && (<>
          {/* Photos */}
          {imgs.length > 0 && (
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
              {imgs.map((src,i)=>(
                <img key={i} src={src} alt="" onClick={()=>setLb(src)}
                  style={{width:i===0?"100%":"calc(33% - 6px)",height:i===0?260:90,objectFit:"cover",borderRadius:i===0?10:6,cursor:"pointer",border:"1px solid rgba(255,255,255,.08)"}}/>
              ))}
            </div>
          )}

          {/* Title row */}
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16}}>
            <div style={{width:44,height:44,borderRadius:8,background:cat.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{cat.icon}</div>
            <div>
              <div style={{fontSize:11,color:cat.color,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{cat.label}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,lineHeight:1.2}}>{item.name}</div>
            </div>
          </div>

          {/* Tags */}
          {(item.tags||[]).length>0 && (
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
              {item.tags.map(t=><span key={t} style={{padding:"2px 8px",background:"rgba(212,168,67,.12)",color:"var(--gold)",borderRadius:4,fontSize:11}}>#{t}</span>)}
            </div>
          )}

          {/* Details card */}
          <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:16,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"rgba(255,255,255,.4)",marginBottom:10}}>Item Details</div>
            {[
              ["Condition",   item.condition],
              ["Size",        item.size!=="N/A"?item.size:null],
              ["Quantity",    item.quantity],
              ["Location",    item.location],
              ["Availability",item.availability],
              item.notes && ["Notes", item.notes],
            ].filter(r=>r&&r[1]).map(([l,v])=>(
              <div key={l} style={{display:"flex",padding:"5px 0",borderTop:"1px solid rgba(255,255,255,.05)"}}>
                <span style={{width:120,color:"rgba(255,255,255,.4)",fontSize:12,flexShrink:0}}>{l}</span>
                <span style={{fontSize:13}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Backstage Exchange */}
          {mkt !== "Not Listed" && (
            <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"rgba(255,255,255,.4)",marginBottom:10}}>Backstage Exchange</div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span className={"badge "+mB}>{mkt}</span>
                {rentalPrice>0 && <span style={{color:"var(--gold)",fontWeight:700}}>{fmt$(rentalPrice)}/week</span>}
                {salePrice>0 && <span style={{color:"var(--gold)",fontWeight:700}}>{fmt$(salePrice)} to buy</span>}
              </div>
            </div>
          )}

          {/* Org contact */}
          {org && (
            <div style={{background:"rgba(212,168,67,.06)",border:"1px solid rgba(212,168,67,.15)",borderRadius:10,padding:16}}>
              <div style={{fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",marginBottom:8}}>Listed by</div>
              <div style={{fontSize:15,fontWeight:600,marginBottom:3}}>{org.name||"Theatre Organization"}</div>
              {org.location && <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:6}}>📍 {org.location}</div>}
              {org.email && (
                <a href={"mailto:"+org.email} style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:4,background:"var(--gold)",color:"#1a1200",padding:"7px 14px",borderRadius:6,fontSize:13,fontWeight:700,textDecoration:"none"}}>
                  ✉️ Contact about this item
                </a>
              )}
            </div>
          )}

          {/* Sign-in CTA for anyone scanning */}
          <div style={{marginTop:16,background:"rgba(196,146,42,.08)",border:"1px solid rgba(196,146,42,.2)",borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--gold)",marginBottom:4}}>Manage your theatre inventory with Theatre4u™</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.45)",marginBottom:12,lineHeight:1.5}}>Track costumes, props, sets and more. Print QR labels. Share on the Backstage Exchange.</div>
            <a href="https://theatre4u.org" style={{display:"inline-block",padding:"9px 22px",background:"linear-gradient(135deg,#c4922a,#8b6914)",borderRadius:8,color:"#1a0f00",fontWeight:700,textDecoration:"none",fontSize:13}}>
              Sign In or Create Free Account →
            </a>
          </div>
          <div style={{marginTop:16,textAlign:"center",fontSize:11,color:"rgba(255,255,255,.2)"}}>
            Item ID: {item.display_id||item.id} · Powered by <a href="https://theatre4u.org" style={{color:"var(--gold)",textDecoration:"none"}}>Theatre4u</a>
          </div>
        </>)}
      </div>
    </div>
    </>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ORG PROFILE
// ══════════════════════════════════════════════════════════════════════════════

// ── Profile page (embedded in app, accessible via sidebar) ───────────────────
function OrgProfilePage({ userId, org, setOrg, plan, items }) {
  const [editing, setEditing]     = useState(false);
  const [f, setF]                  = useState(null);
  const [saving, setSaving]        = useState(false);
  const [msg, setMsg]              = useState("");
  const [copied, setCopied]        = useState(false);

  useEffect(() => {
    // Load fresh org data including new profile fields
    (async () => {
      const { data } = await SB.from("orgs").select("*").eq("id", userId).single();
      if (data) {
        setOrg(o => ({ ...o, ...data }));
        setF(data);
      }
    })();
  }, [userId]);

  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f) return;
    setSaving(true);
    // Auto-generate slug if empty
    let slug = f.slug;
    if (!slug && f.name) {
      const base = f.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 50);
      slug = base;
    }
    // Geocode location once on profile save — stored permanently, no repeated network calls
    let latLng = {};
    if (f.location && f.location.trim().length > 2) {
      try {
        const geo = await geocodeLocation(f.location);
        if (geo) latLng = { lat: geo.lat, lng: geo.lng };
      } catch { /* geocoding optional */ }
    }
    const { data, error } = await SB.from("orgs").update({
      name: f.name, type: f.type, email: f.email, phone: f.phone,
      location: f.location, bio: f.bio, website: f.website,
      facebook: f.facebook, instagram: f.instagram,
      logo_url: f.logo_url, founded_year: f.founded_year,
      student_count: f.student_count, profile_public: f.profile_public,
      slug, ...latLng,
    }).eq("id", userId).select().single();
    if (data) {
      setOrg(o => ({ ...o, ...data }));
      setF(data);
      setMsg("✓ Profile saved");
      setTimeout(() => setMsg(""), 2500);
    }
    setSaving(false);
    setEditing(false);
  };

  const profileUrl = org?.slug
    ? `https://theatre4u.org/org/${org.slug}`
    : null;

  const copyUrl = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const listed = items.filter(i => i.marketStatus && i.marketStatus !== "Not Listed").length;

  if (!f) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;

  return (
    <div style={{ position: "relative" }}>
      <img src={usp(BG.dashboard, 1400, 900)} alt="" className="page-bg-img" />

      <div style={{ padding: "32px 36px 0" }}>
        <div className="hero-wrap" style={{ height: 200 }}>
          <img src={usp("photo-1503095396549-807759245b35", 1100, 260)} alt="Profile" loading="eager" />
          <div className="hero-fade" />
          <div className="hero-body">
            <div className="hero-eyebrow">👤 Your Organization</div>
            <h1 className="hero-title" style={{ fontSize: 40 }}>Public Profile</h1>
            <p className="hero-sub">Your shareable page for other programs and the public to discover you.</p>
          </div>
          <div className="hero-bar" />
        </div>
      </div>

      <div style={{ padding: "24px 36px 56px", position: "relative", zIndex: 1 }}>

        {/* Public URL card */}
        <div className="card card-p" style={{ marginBottom: 20, borderColor: profileUrl ? "rgba(82,199,132,.3)" : "var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 4 }}>
                Your Public Profile URL
              </div>
              {profileUrl
                ? <div style={{ fontFamily: "monospace", fontSize: 15, color: "var(--green)", fontWeight: 700 }}>{profileUrl}</div>
                : <div style={{ fontSize: 13, color: "var(--muted)" }}>Save your profile to generate your URL.</div>
              }
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Share this link so other programs, parents, and community members can discover your inventory listings.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {profileUrl && <>
                <button className="btn btn-o btn-sm" onClick={copyUrl}>
                  {copied ? "✓ Copied!" : "📋 Copy Link"}
                </button>
                <a href={profileUrl} target="_blank" rel="noreferrer" className="btn btn-o btn-sm">
                  🔗 Preview
                </a>
              </>}
            </div>
          </div>
        </div>

        {/* Visibility toggle */}
        <div className="card card-p" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Profile Visibility</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              {f.profile_public ? "Your profile is public — anyone with the link can see it." : "Your profile is private — only you can see it."}
            </div>
          </div>
          <button onClick={async () => {
            const next = !f.profile_public;
            upd("profile_public", next);
            await SB.from("orgs").update({ profile_public: next }).eq("id", userId);
            setMsg(next ? "✓ Profile is now public" : "✓ Profile is now private");
            setTimeout(() => setMsg(""), 2000);
          }} style={{
            padding: "8px 18px", borderRadius: 8, border: "1.5px solid",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: f.profile_public ? "rgba(82,199,132,.15)" : "var(--parch)",
            color: f.profile_public ? "var(--green)" : "var(--muted)",
            borderColor: f.profile_public ? "var(--green)" : "var(--border)",
          }}>
            {f.profile_public ? "🌐 Public" : "🔒 Private"}
          </button>
        </div>

        {/* Profile preview card */}
        {!editing && (
          <div className="card card-p" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>Profile Preview</h3>
              <button className="btn btn-o btn-sm" onClick={() => setEditing(true)}>✏️ Edit Profile</button>
            </div>

            {/* Preview of what public sees */}
            <div style={{ background: "var(--white)", borderRadius: 10, padding: 20, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 12, background: "linear-gradient(135deg,var(--gold2),var(--gold))",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0
                }}>
                  {f.logo_url ? <img src={f.logo_url} alt="" style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} /> : "🎭"}
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22 }}>{f.name || "Your Program Name"}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    {[f.type, f.location].filter(Boolean).join(" · ") || "Location not set"}
                  </div>
                </div>
              </div>
              {f.bio && <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 12 }}>{f.bio}</p>}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {f.founded_year && <span style={{ padding: "3px 10px", background: "rgba(212,168,67,.1)", color: "var(--gold)", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>Est. {f.founded_year}</span>}
                {f.student_count && <span style={{ padding: "3px 10px", background: "rgba(82,199,132,.1)", color: "var(--green)", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{f.student_count.toLocaleString()} students</span>}
                {listed > 0 && <span style={{ padding: "3px 10px", background: "rgba(66,165,245,.1)", color: "#42a5f5", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{listed} items listed</span>}
                {plan !== "free" && <span style={{ padding: "3px 10px", background: "rgba(212,168,67,.15)", color: "var(--gold)", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>🪙 Accepts Stage Points</span>}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 12, color: "var(--amber)" }}>✉️ {f.email}</a>}
                {f.phone && <span style={{ fontSize: 12, color: "var(--muted)" }}>📞 {f.phone}</span>}
                {f.website && <a href={f.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--amber)" }}>🌐 Website</a>}
                {f.instagram && <a href={`https://instagram.com/${f.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--amber)" }}>📸 Instagram</a>}
              </div>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="card card-p" style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 16 }}>Edit Profile</h3>
            <div className="fg2">
              <div className="fg fu"><label className="fl">Organization Name</label>
                <input className="fi" value={f.name || ""} onChange={e => upd("name", e.target.value)} placeholder="Lincoln High Drama Dept." /></div>

              <div className="fg fu">
                <label className="fl">Profile Photo / Logo URL</label>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  {f.logo_url && <img src={f.logo_url} alt="Logo preview" style={{width:52,height:52,borderRadius:8,objectFit:"cover",border:"1px solid var(--border)",flexShrink:0}}/>}
                  <div style={{flex:1}}>
                    <input className="fi" value={f.logo_url || ""} onChange={e => upd("logo_url", e.target.value)}
                      placeholder="Paste an image URL (Google Drive, Dropbox, etc.)" />
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>
                      Paste any direct image URL. For Google Drive: share the image → Copy link → replace /view with nothing and add &sz=w400 to the end.
                    </div>
                  </div>
                </div>
              </div>

              <div className="fg"><label className="fl">Type</label>
                <select className="fs" value={f.type || ""} onChange={e => upd("type", e.target.value)}>
                  <option value="">Select…</option>
                  {["School","Community Theatre","College","District","Professional","Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="fg"><label className="fl">City / Location</label>
                <input className="fi" value={f.location || ""} onChange={e => upd("location", e.target.value)} placeholder="Portland, OR" /></div>

              <div className="fg"><label className="fl">Contact Email</label>
                <input className="fi" type="email" value={f.email || ""} onChange={e => upd("email", e.target.value)} placeholder="drama@school.edu" /></div>

              <div className="fg"><label className="fl">Phone</label>
                <input className="fi" value={f.phone || ""} onChange={e => upd("phone", e.target.value)} placeholder="(555) 123-4567" /></div>

              <div className="fg"><label className="fl">Year Founded</label>
                <input className="fi" type="number" min="1800" max="2026" value={f.founded_year || ""} onChange={e => upd("founded_year", parseInt(e.target.value) || null)} placeholder="e.g. 1998" /></div>

              <div className="fg"><label className="fl">Students Served (approx.)</label>
                <input className="fi" type="number" min="0" value={f.student_count || ""} onChange={e => upd("student_count", parseInt(e.target.value) || null)} placeholder="e.g. 350" /></div>

              <div className="fg fu"><label className="fl">About Your Program</label>
                <textarea className="ft" value={f.bio || ""} onChange={e => upd("bio", e.target.value)}
                  placeholder="Tell other programs and the community about your theatre program…" style={{ minHeight: 80 }} /></div>

              <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 12 }}>Links & Social</div>
              </div>

              <div className="fg"><label className="fl">Website URL</label>
                <input className="fi" value={f.website || ""} onChange={e => upd("website", e.target.value)} placeholder="https://yourschool.edu/drama" /></div>

              <div className="fg"><label className="fl">Instagram Handle</label>
                <input className="fi" value={f.instagram || ""} onChange={e => upd("instagram", e.target.value)} placeholder="@lincolnhighdrama" /></div>

              <div className="fg fu"><label className="fl">Logo Image URL (optional)</label>
                <input className="fi" value={f.logo_url || ""} onChange={e => upd("logo_url", e.target.value)} placeholder="https://drive.google.com/… or direct image URL" />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Paste a public image URL for your program's logo. Shown on your public profile.</div>
              </div>

              <div className="fg fu"><label className="fl">Profile URL Slug</label>
                <input className="fi" value={f.slug || ""} onChange={e => upd("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="lincoln-high-drama" />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Your profile will be at: theatre4u.org/org/<strong>{f.slug || "your-slug-here"}</strong></div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-o" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-g" onClick={save} disabled={saving}>{saving ? "Saving…" : "✓ Save Profile"}</button>
              {msg && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 13, alignSelf: "center" }}>{msg}</span>}
            </div>
          </div>
        )}

        {/* Listed items preview */}
        {listed > 0 && (
          <div className="card card-p">
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 4 }}>Backstage Exchange — Your Listings</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>These items appear on your public profile. Anyone can browse them without logging in.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
              {items.filter(i => i.market_status && i.market_status !== "Not Listed" && i.market_status !== "Private").slice(0, 6).map(item => {
                const catColor = { costumes: "#c2185b", props: "#7b1fa2", sets: "#1565c0", lighting: "#f9a825", sound: "#2e7d32", scripts: "#d84315", makeup: "#ad1457", furniture: "#4e342e", fabrics: "#6a1b9a", tools: "#546e7a", effects: "#00838f", other: "#757575" }[item.category] || "#757575";
                return (
                  <div key={item.id} style={{ background: "var(--white)", borderRadius: 8, padding: 12, border: "1px solid var(--border)" }}>
                    {item.img
                      ? <img src={item.img} alt={item.name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 8 }} />
                      : <div style={{ height: 80, borderRadius: 6, background: catColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 8 }}>📦</div>}
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.market_status}</div>
                    {item.rental_price > 0 && <div style={{ fontSize: 13, color: "var(--green)", fontWeight: 700, marginTop: 2 }}>${item.rental_price}/wk</div>}
                    {item.sale_price > 0 && <div style={{ fontSize: 13, color: "var(--green)", fontWeight: 700, marginTop: 2 }}>${item.sale_price}</div>}
                  </div>
                );
              })}
            </div>
            {listed > 6 && <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "var(--muted)" }}>+{listed - 6} more items on your public profile</div>}
          </div>
        )}
      </div>
    </div>
  );
}


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

// Wrap App with ErrorBoundary for export
const AppWithBoundary = ()=><ErrorBoundary><AppRoot/></ErrorBoundary>;
export default AppWithBoundary;


// ══════════════════════════════════════════════════════════════════════════════
// ── AI Help Bubble ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function AIHelpBubble({ user = null }) {
  const [open, setOpen]       = useState(false);
  const greeting = user
    ? "Hi! Ask me anything about Theatre4u — inventory, QR labels, Exchange, Funding Tracker, or any feature!"
    : "Hi! Ask me anything about Theatre4u, or visit theatre4u.org/help.html for our full Help Center.";
  const [msgs, setMsgs]       = useState([{role:"assistant",content:greeting}]);
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

// ── PREVIEW MODE — sample data for guest exploration ─────────────────────────
const PREVIEW_ITEMS = [
  { id:"p1",  name:"Victorian Ball Gown — Blue",      category:"costumes",  condition:"Good",      qty:1,  location:"Costume Closet A",  notes:"Used in A Christmas Carol 2024", mkt:"For Rent",    avail:"In Stock", sale:0,  rent:25 },
  { id:"p2",  name:"Pirate Hat Collection (6pc)",     category:"costumes",  condition:"Fair",      qty:6,  location:"Costume Closet B",  notes:"Assorted styles",               mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0  },
  { id:"p3",  name:"Wireless Handheld Mic — Shure",  category:"sound",     condition:"Excellent", qty:4,  location:"Sound Booth",       notes:"SM58 compatible, 4 channels",   mkt:"For Rent",    avail:"In Stock", sale:0,  rent:15 },
  { id:"p4",  name:"LED Par Can RGBW 54x3W",          category:"lighting",  condition:"New",       qty:12, location:"Lighting Storage",  notes:"DMX controllable",              mkt:"Rent or Sale",avail:"In Stock", sale:85, rent:10 },
  { id:"p5",  name:"Wooden Throne Chair",             category:"furniture", condition:"Good",      qty:1,  location:"Scene Shop",        notes:"Gold painted, red velvet",      mkt:"For Rent",    avail:"In Stock", sale:0,  rent:30 },
  { id:"p6",  name:"Fog Machine 1000W",               category:"effects",   condition:"Good",      qty:2,  location:"Effects Cage",      notes:"Includes remote",               mkt:"For Rent",    avail:"In Stock", sale:0,  rent:20 },
  { id:"p7",  name:"Romeo and Juliet Scripts (30)",   category:"scripts",   condition:"Fair",      qty:30, location:"Library",           notes:"Director annotated",            mkt:"For Sale",    avail:"In Stock", sale:5,  rent:0  },
  { id:"p8",  name:"Ben Nye Master Makeup Kit",       category:"makeup",    condition:"Good",      qty:3,  location:"Dressing Room 1",   notes:"Full spectrum",                 mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0  },
  { id:"p9",  name:"Forest Backdrop Flat 8x12ft",     category:"sets",      condition:"Good",      qty:2,  location:"Scene Shop",        notes:"Painted muslin on frame",       mkt:"For Rent",    avail:"In Stock", sale:0,  rent:40 },
  { id:"p10", name:"DeWalt Cordless Drill 20V",       category:"tools",     condition:"Good",      qty:2,  location:"Tool Cabinet",      notes:"With charger and bits",         mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0  },
  { id:"p11", name:"Foam Rubber Swords (8pc)",        category:"props",     condition:"Fair",      qty:8,  location:"Props Table",       notes:"Safe for stage combat",         mkt:"For Sale",    avail:"In Stock", sale:12, rent:0  },
  { id:"p12", name:"Black Velvet Main Drape 20x40",   category:"fabrics",   condition:"Excellent", qty:1,  location:"Fly Loft",          notes:"Flame retardant",               mkt:"Not Listed",  avail:"In Use",   sale:0,  rent:0  },
];
const PREVIEW_CATS = {
  costumes:"🥻", props:"🎭", sets:"🏗️", lighting:"💡", sound:"🔊",
  scripts:"📜", makeup:"💄", furniture:"🪑", fabrics:"🧵", tools:"🔧", effects:"✨", other:"📦"
};

function PreviewMode({ onSignUp }) {
  const [tab,     setTab]     = React.useState("inventory");
  const [search,  setSearch]  = React.useState("");
  const [catF,    setCatF]    = React.useState("all");
  const [detail,  setDetail]  = React.useState(null);
  const [showCTA, setShowCTA] = React.useState(false);

  React.useEffect(() => { const t = setTimeout(() => setShowCTA(true), 20000); return () => clearTimeout(t); }, []);

  const filtered = PREVIEW_ITEMS.filter(i => {
    if (catF !== "all" && i.category !== catF) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !(i.location||"").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalItems = PREVIEW_ITEMS.length;
  const listed     = PREVIEW_ITEMS.filter(i => i.mkt !== "Not Listed").length;
  const totalQty   = PREVIEW_ITEMS.reduce((s, i) => s + i.qty, 0);
  const estValue   = PREVIEW_ITEMS.reduce((s, i) => s + (i.sale * i.qty), 0);

  const gold = "#d4a843", dark = "#1a0f00", bg = "#0d0b11", bg2 = "#15121b", bd = "#282333", t1 = "#ede8df", t2 = "#9b93a8", t3 = "#685f76";

  const navs = [
    { id:"dashboard",   label:"Dashboard",         icon:"⌂"  },
    { id:"inventory",   label:"Inventory",          icon:"📦" },
    { id:"marketplace", label:"Backstage Exchange", icon:"🏪" },
    { id:"community",   label:"Community Board",    icon:"🎪" },
    { id:"messages",    label:"Messages",           icon:"💬" },
    { id:"requests",    label:"Requests",           icon:"📋" },
    { id:"productions", label:"Productions",        icon:"🎭" },
    { id:"reports",     label:"Reports",            icon:"📊" },
    { id:"funding",     label:"Funding Tracker",    icon:"💰" },
  ];

  const GoldBtn = ({ label, onClick, style = {} }) => (
    <button onClick={onClick} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
      padding:"9px 20px", borderRadius:8, fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700,
      cursor:"pointer", border:"none", background:`linear-gradient(135deg,${gold},#a37f2c)`, color:dark, ...style }}>{label}</button>
  );

  const mktColor = mkt => mkt === "Not Listed" ? "rgba(107,100,120,.5)" : mkt.includes("Rent") ? "rgba(66,165,245,.8)" : "rgba(76,175,80,.8)";

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:bg, color:t1, fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>

      {/* Gold preview banner */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:9999,
        background:"linear-gradient(135deg,rgba(212,168,67,.97),rgba(163,127,44,.97))",
        padding:"9px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap",
        boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>🎭</span>
          <span style={{ fontWeight:800, color:dark, fontSize:14 }}>Preview Mode</span>
          <span style={{ color:"rgba(26,15,0,.65)", fontSize:12 }}>— Explore Theatre4u with sample data. No account needed.</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => window.location.href = "https://theatre4u.org"}
            style={{ padding:"6px 14px", borderRadius:6, fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600,
              cursor:"pointer", background:"rgba(0,0,0,.15)", border:"1px solid rgba(0,0,0,.2)", color:dark }}>Sign In</button>
          <GoldBtn label="Start Free Account →" onClick={onSignUp} style={{ padding:"6px 18px", fontSize:13 }}/>
        </div>
      </div>

      {/* Sidebar */}
      <aside style={{ width:224, minWidth:224, background:bg2, borderRight:`1px solid ${bd}`, display:"flex",
        flexDirection:"column", paddingTop:48, overflowY:"auto", zIndex:100 }}>
        <div style={{ padding:"18px 14px", borderBottom:`1px solid ${bd}`, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:8, fontSize:20, background:`linear-gradient(135deg,${gold},#a37f2c)`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>🎭</div>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, color:gold }}>Theatre4u™</div>
            <div style={{ fontSize:9, color:t3, textTransform:"uppercase", letterSpacing:2 }}>Ocean View Drama</div>
          </div>
        </div>
        <nav style={{ padding:"12px 8px", flex:1 }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:2, color:t3, padding:"8px 10px 4px" }}>Main</div>
          {navs.map(n => (
            <div key={n.id} onClick={() => setTab(n.id)} style={{ display:"flex", alignItems:"center", gap:8,
              padding:"8px 10px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:500, marginBottom:1,
              color: tab === n.id ? gold : t2,
              background: tab === n.id ? "linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04))" : "transparent",
              border: `1px solid ${tab === n.id ? "rgba(212,168,67,.2)" : "transparent"}` }}>
              <span style={{ fontSize:15 }}>{n.icon}</span>
              {n.label}
              {n.id === "inventory" && <span style={{ marginLeft:"auto", background:bg, padding:"1px 6px", borderRadius:9, fontSize:10, color:t3 }}>{totalItems}</span>}
            </div>
          ))}
        </nav>
        <div style={{ padding:12, borderTop:`1px solid ${bd}` }}>
          <div style={{ background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)", borderRadius:10, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:gold, marginBottom:4 }}>🎟 Join for Free</div>
            <div style={{ fontSize:11, color:t2, lineHeight:1.5, marginBottom:8 }}>Create your program's inventory, earn Stage Points, and share with nearby schools.</div>
            <GoldBtn label="Start Free →" onClick={onSignUp} style={{ width:"100%", fontSize:12, padding:"8px 12px" }}/>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", paddingTop:42 }}>
        <div style={{ padding:"12px 24px", borderBottom:`1px solid ${bd}`, background:bg2,
          display:"flex", alignItems:"center", gap:12 }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700 }}>
            {navs.find(n => n.id === tab)?.label}
          </h1>
          <span style={{ marginLeft:"auto", fontSize:11, color:gold, fontWeight:600,
            background:"rgba(212,168,67,.1)", border:"1px solid rgba(212,168,67,.2)", padding:"3px 10px", borderRadius:12 }}>
            👁 Preview — sample data only
          </span>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Welcome to Ocean View Drama</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Your theatre inventory at a glance. (Sample data)</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:20 }}>
                {[{icon:"📦",label:"Cataloged Items",val:totalItems},{icon:"🔢",label:"Total Quantity",val:totalQty},
                  {icon:"🏪",label:"Listed / Shared",val:listed},{icon:"💰",label:"Est. Sale Value",val:"$"+estValue.toLocaleString()}].map(s => (
                  <div key={s.label} style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16, textAlign:"center" }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:gold }}>{s.val}</div>
                    <div style={{ fontSize:11, color:t3, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16, marginBottom:20 }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:16, marginBottom:12 }}>What Theatre4u™ Does</h3>
                {[["📦","Inventory Management","Catalog every costume, prop, light, and piece of gear with photos, QR labels, and condition tracking."],
                  ["🔲","QR Code Labels","Print scannable labels for any item. Any phone camera looks it up instantly — no app download needed."],
                  ["🏪","Backstage Exchange","Share items with other theatre programs near you — rent, loan, or sell gear."],
                  ["🪙","Stage Points","Earn points for cataloging and sharing inventory. Redeem for free months or Exchange discounts."],
                  ["💰","Funding Tracker","Track grants, Prop 28 funds, and spending. Generate accountability reports for boards."]].map(([icon,title,desc]) => (
                  <div key={title} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom:`1px solid rgba(255,255,255,.05)` }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
                    <div><div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{title}</div>
                      <div style={{ fontSize:12, color:t2, lineHeight:1.5 }}>{desc}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <GoldBtn label="🎟 Create Your Free Account →" onClick={onSignUp} style={{ fontSize:15, padding:"12px 32px" }}/>
                <div style={{ fontSize:12, color:t3, marginTop:8 }}>No credit card required · Free forever for basic use</div>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div>
              <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ position:"relative" }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
                    style={{ background:"#110f18", border:`1px solid ${bd}`, borderRadius:8, padding:"7px 10px 7px 32px",
                      color:t1, fontSize:13, width:220, outline:"none" }}/>
                  <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:t3 }}>🔍</span>
                </div>
                <select value={catF} onChange={e => setCatF(e.target.value)}
                  style={{ background:"#110f18", border:`1px solid ${bd}`, borderRadius:8, padding:"7px 10px", color:t1, fontSize:13, outline:"none" }}>
                  <option value="all">All Categories</option>
                  {Object.keys(PREVIEW_CATS).map(c => <option key={c} value={c}>{PREVIEW_CATS[c]} {c[0].toUpperCase()+c.slice(1)}</option>)}
                </select>
                <span style={{ fontSize:12, color:t3 }}>{filtered.length} items</span>
                <button onClick={() => setShowCTA(true)} style={{ marginLeft:"auto", padding:"7px 14px", borderRadius:8,
                  fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, cursor:"pointer",
                  background:"rgba(212,168,67,.12)", border:"1px solid rgba(212,168,67,.25)", color:gold }}>
                  + Add Item (sign up first)
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
                {filtered.map(item => (
                  <div key={item.id} onClick={() => setDetail(item)}
                    style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:14, cursor:"pointer", transition:"border-color .2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(212,168,67,.4)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = bd}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
                      <div style={{ fontSize:24, flexShrink:0 }}>{PREVIEW_CATS[item.category]||"📦"}</div>
                      <div><div style={{ fontWeight:700, fontSize:14, lineHeight:1.3 }}>{item.name}</div>
                        <div style={{ fontSize:11, color:t3, marginTop:2 }}>{item.location}</div></div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                      {[item.condition, `x${item.qty}`, item.avail].map(tag => (
                        <span key={tag} style={{ fontSize:10, padding:"2px 7px", background:"rgba(255,255,255,.05)", borderRadius:4, color:t2 }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background: mktColor(item.mkt)+"22", color: mktColor(item.mkt) }}>{item.mkt}</span>
                      {(item.rent > 0 || item.sale > 0) && (
                        <span style={{ fontSize:12, fontWeight:700, color:gold }}>
                          {item.rent>0?`$${item.rent}/wk`:""}
                          {item.rent>0&&item.sale>0?" · ":""}
                          {item.sale>0?`$${item.sale}`:""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {detail && (
                <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:3000,
                  display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
                  onClick={e => e.target === e.currentTarget && setDetail(null)}>
                  <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:14, width:"100%", maxWidth:520,
                    padding:24, boxShadow:"0 8px 48px rgba(0,0,0,.5)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                        <div style={{ fontSize:32 }}>{PREVIEW_CATS[detail.category]||"📦"}</div>
                        <div><div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700 }}>{detail.name}</div>
                          <div style={{ fontSize:12, color:t3, marginTop:2 }}>{detail.category} · {detail.condition}</div></div>
                      </div>
                      <button onClick={() => setDetail(null)} style={{ background:"none", border:`1px solid ${bd}`, color:t2,
                        borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:16,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                    </div>
                    {[["Location",detail.location||"—"],["Quantity",detail.qty],["Availability",detail.avail],["Market Status",detail.mkt],
                      ...(detail.rent>0?[["Rental Price",`$${detail.rent}/week`]]:[]),
                      ...(detail.sale>0?[["Sale Price",`$${detail.sale}`]]:[]),
                      ...(detail.notes?[["Notes",detail.notes]]:[])
                    ].map(([l,v]) => (
                      <div key={l} style={{ display:"flex", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                        <span style={{ width:130, color:t3, fontSize:12, flexShrink:0 }}>{l}</span>
                        <span style={{ fontSize:13 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop:16, padding:12, background:"rgba(212,168,67,.06)", border:"1px solid rgba(212,168,67,.15)", borderRadius:9, textAlign:"center" }}>
                      <div style={{ fontSize:12, color:t2, marginBottom:8 }}>Sign up to manage your own inventory, add photos, and print QR labels.</div>
                      <GoldBtn label="🎟 Start Free Account →" onClick={onSignUp} style={{ width:"100%" }}/>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BACKSTAGE EXCHANGE */}
          {tab === "marketplace" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Backstage Exchange</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Browse and request gear from theatre programs nearby. (Sample listings)</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14, marginBottom:24 }}>
                {[{title:"LED Par Cans (set of 8)",prog:"Edison Arts Academy",type:"For Rent",price:"$80/wk",icon:"💡"},
                  {title:"Victorian Costume Collection (12pc)",prog:"Lakewood Drama",type:"For Loan",price:"Free loan",icon:"🥻"},
                  {title:"Fog Machine + Fluid (2gal)",prog:"Valley Performing Arts",type:"For Rent",price:"$20/wk",icon:"🌫️"},
                  {title:"Romeo & Juliet Script Sets (25)",prog:"Ocean View Drama",type:"For Sale",price:"$5 each",icon:"📜"},
                  {title:"Wireless Mic Pack (4ch)",prog:"Sunset High Theatre",type:"For Rent",price:"$45/wk",icon:"🎤"},
                  {title:"12ft Forest Backdrop Flat",prog:"Riverside High Drama",type:"For Rent",price:"$40/wk",icon:"🌲"},
                ].map((item, i) => (
                  <div key={i} style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ fontSize:28 }}>{item.icon}</div>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background: item.type.includes("Loan")?"rgba(76,175,80,.15)":item.type.includes("Sale")?"rgba(156,39,176,.15)":"rgba(66,165,245,.15)",
                        color: item.type.includes("Loan")?"#81c784":item.type.includes("Sale")?"#ce93d8":"#64b5f6" }}>{item.type}</span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{item.title}</div>
                    <div style={{ fontSize:12, color:t3, marginBottom:8 }}>{item.prog}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontWeight:700, color:gold, fontSize:13 }}>{item.price}</span>
                      <button onClick={() => setShowCTA(true)} style={{ padding:"5px 12px", borderRadius:6,
                        fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, cursor:"pointer",
                        background:"rgba(212,168,67,.12)", border:"1px solid rgba(212,168,67,.25)", color:gold }}>Request →</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <GoldBtn label="🎟 Join to Browse All Listings →" onClick={onSignUp} style={{ fontSize:14 }}/>
                <div style={{ fontSize:12, color:t3, marginTop:8 }}>Free loans between district schools · No platform fee on intra-district transactions</div>
              </div>
            </div>
          )}

          {/* COMMUNITY BOARD */}
          {tab === "community" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Community Board</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Announcements, auditions, and show postings from your theatre network. (Sample posts)</p>
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:24 }}>
                {[{type:"🎭 Show Announcement",author:"Ocean View Drama",time:"2 hours ago",title:"Opening Night — The Wizard of Oz",body:"Join us May 17–19 at the Ocean View PAC. Tickets $8 students / $12 general. Featuring a cast of 42 students and a live pit orchestra."},
                  {type:"🎤 Auditions",author:"Lakewood Drama",time:"Yesterday",title:"Fall Musical Auditions Open — Mamma Mia!",body:"Auditions June 3–4 at Lakewood High. All students welcome. No experience required. Callbacks June 6."},
                  {type:"📢 Wanted",author:"Edison Arts Academy",time:"3 days ago",title:"Seeking: Fog machine rental for 2 weeks in June",body:"We're looking to rent a 1000W fog machine for our June production. Happy to trade — we have LED par cans available for loan."},
                  {type:"📦 Free Items",author:"Valley Performing Arts",time:"Last week",title:"Free to good home: 30 assorted costume pieces",body:"Clearing space — 30+ costume pieces available for pickup. Period, contemporary, and fantasy. First come first served."},
                ].map((post, i) => (
                  <div key={i} style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:gold, textTransform:"uppercase", letterSpacing:1 }}>{post.type}</span>
                      <span style={{ fontSize:11, color:t3 }}>{post.time}</span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{post.title}</div>
                    <div style={{ fontSize:12, color:t3, marginBottom:6 }}>Posted by {post.author}</div>
                    <div style={{ fontSize:13, color:t2, lineHeight:1.6 }}>{post.body}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <GoldBtn label="🎟 Join to Post & Comment →" onClick={onSignUp} style={{ fontSize:14 }}/>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {tab === "messages" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Messages</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Direct conversations with other theatre programs. (Sample)</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8, maxWidth:600, marginBottom:24 }}>
                {[{from:"Lakewood Drama",preview:"Hi! We saw your LED par cans listed — are they available the week of June 10?",time:"10:24 AM",unread:true},
                  {from:"Edison Arts Academy",preview:"Thanks for the quick turnaround on the costumes. Our cast loved them!",time:"Yesterday",unread:false},
                  {from:"Sunset High Theatre",preview:"We have fog machines available if you still need them for your spring show.",time:"Mon",unread:false},
                ].map((msg, i) => (
                  <div key={i} onClick={() => setShowCTA(true)} style={{ background:msg.unread?"rgba(212,168,67,.06)":bg2,
                    border:`1px solid ${msg.unread?"rgba(212,168,67,.25)":bd}`, borderRadius:10, padding:"12px 14px",
                    cursor:"pointer", display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, fontSize:18,
                      background:`linear-gradient(135deg,${gold},#a37f2c)`, display:"flex", alignItems:"center", justifyContent:"center" }}>🎭</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                        <span style={{ fontWeight:msg.unread?800:600, fontSize:14 }}>{msg.from}</span>
                        <span style={{ fontSize:11, color:t3 }}>{msg.time}</span>
                      </div>
                      <div style={{ fontSize:12, color:t2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{msg.preview}</div>
                    </div>
                    {msg.unread && <div style={{ width:8, height:8, borderRadius:"50%", background:gold, flexShrink:0 }}/>}
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <GoldBtn label="🎟 Join to Send Messages →" onClick={onSignUp} style={{ fontSize:14 }}/>
              </div>
            </div>
          )}

          {/* REQUESTS */}
          {tab === "requests" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Requests</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Manage incoming and outgoing Exchange requests. (Sample)</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
                {[{item:"Victorian Ball Gown — Blue",from:"Lakewood Drama",type:"Rental",status:"pending",price:"$25/wk",date:"Requested Apr 22"},
                  {item:"LED Par Can RGBW (4 units)",from:"Edison Arts Academy",type:"Loan",status:"accepted",price:"Free",date:"Accepted Apr 20"},
                ].map((req, i) => (
                  <div key={i} style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{req.item}</div>
                        <div style={{ fontSize:12, color:t3 }}>from {req.from} · {req.type} · {req.date}</div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:8,
                          background:req.status==="accepted"?"rgba(76,175,80,.15)":"rgba(212,168,67,.15)",
                          color:req.status==="accepted"?"#81c784":gold }}>{req.status}</span>
                        <div style={{ fontSize:12, fontWeight:700, color:gold, marginTop:4 }}>{req.price}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      {["Accept","Decline","Message"].map(a => (
                        <button key={a} onClick={() => setShowCTA(true)} style={{ padding:"6px 14px", borderRadius:6,
                          fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, cursor:"pointer",
                          background:"rgba(107,100,120,.1)", border:`1px solid ${bd}`, color:t2 }}>{a}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <GoldBtn label="🎟 Join to Manage Requests →" onClick={onSignUp} style={{ fontSize:14 }}/>
              </div>
            </div>
          )}

          {/* PRODUCTIONS */}
          {tab === "productions" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Productions</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Track items assigned to each show. (Sample productions)</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14, marginBottom:24 }}>
                {[{title:"The Wizard of Oz",date:"May 17–19, 2026",status:"In Production",items:34,icon:"🌈"},
                  {title:"Mamma Mia!",date:"Fall 2026",status:"Planning",items:8,icon:"🎵"},
                  {title:"A Christmas Carol",date:"Dec 2025",status:"Archived",items:67,icon:"🎄"},
                ].map((prod, i) => (
                  <div key={i} style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:18 }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>{prod.icon}</div>
                    <div style={{ fontWeight:800, fontSize:16, marginBottom:3 }}>{prod.title}</div>
                    <div style={{ fontSize:12, color:t3, marginBottom:10 }}>{prod.date}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:8,
                        background:prod.status==="In Production"?"rgba(212,168,67,.2)":prod.status==="Planning"?"rgba(66,165,245,.15)":"rgba(107,100,120,.15)",
                        color:prod.status==="In Production"?gold:prod.status==="Planning"?"#64b5f6":t3 }}>{prod.status}</span>
                      <span style={{ fontSize:12, color:t2 }}>📦 {prod.items} items</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <GoldBtn label="🎟 Join to Track Productions →" onClick={onSignUp} style={{ fontSize:14 }}/>
              </div>
            </div>
          )}

          {/* REPORTS */}
          {tab === "reports" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Reports & Analytics</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Inventory breakdowns and reports for administrators. (Sample data)</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
                {[{icon:"📦",label:"Total Items",val:"12"},{icon:"💰",label:"Est. Value",val:"$1,240"},
                  {icon:"🏪",label:"Items Shared",val:"7"},{icon:"📊",label:"Categories",val:"9"}].map(s => (
                  <div key={s.label} style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16, textAlign:"center" }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:800, color:gold }}>{s.val}</div>
                    <div style={{ fontSize:12, fontWeight:700, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16, marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Inventory by Category</div>
                {[["Costumes",3],["Lighting",12],["Sound",4],["Props",8],["Sets",2]].map(([cat,n]) => (
                  <div key={cat} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <div style={{ width:100, fontSize:12, color:t2, flexShrink:0 }}>{cat}</div>
                    <div style={{ flex:1, height:6, background:"rgba(255,255,255,.05)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:(n/12*100)+"%", background:gold, borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, width:24, textAlign:"right" }}>{n}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <GoldBtn label="🎟 Join for Full Reports →" onClick={onSignUp} style={{ fontSize:14 }}/>
              </div>
            </div>
          )}

          {/* FUNDING TRACKER */}
          {tab === "funding" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>Funding Tracker</h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>Track grants, Prop 28, and program spending. (Sample data)</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:20 }}>
                {[{label:"Total Allocated",val:"$18,400",color:gold},{label:"Total Spent",val:"$11,250",color:"#64b5f6"},
                  {label:"Remaining",val:"$7,150",color:"#81c784"},{label:"Sources",val:"3",color:t1}].map(s => (
                  <div key={s.label} style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:14, textAlign:"center" }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:10, color:t3, marginTop:3, textTransform:"uppercase", letterSpacing:1 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, overflow:"hidden", marginBottom:20 }}>
                {[{name:"Prop 28 — Arts",alloc:"$12,000",spent:"$8,400",bal:"$3,600"},
                  {name:"Booster Donations",alloc:"$4,400",spent:"$2,850",bal:"$1,550"},
                  {name:"Drama Dept Budget",alloc:"$2,000",spent:"$0",bal:"$2,000"}].map((r,i) => (
                  <div key={i} style={{ padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr 80px 80px 80px", gap:8,
                    borderTop:i===0?"none":`1px solid ${bd}`, background:i%2===0?"rgba(255,255,255,.01)":"transparent" }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{r.name}</div>
                    <div style={{ fontSize:13, color:gold, fontWeight:700 }}>{r.alloc}</div>
                    <div style={{ fontSize:13 }}>{r.spent}</div>
                    <div style={{ fontSize:13, color:"#81c784", fontWeight:700 }}>{r.bal}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center" }}>
                <GoldBtn label="🎟 Join to Track Your Funding →" onClick={onSignUp} style={{ fontSize:14 }}/>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Floating CTA after 20s */}
      {showCTA && (
        <div style={{ position:"fixed", bottom:20, right:20, zIndex:9998, background:bg2,
          border:"1px solid rgba(212,168,67,.4)", borderRadius:14, padding:"16px 18px", maxWidth:280,
          boxShadow:"0 8px 32px rgba(0,0,0,.5)" }}>
          <button onClick={() => setShowCTA(false)} style={{ position:"absolute", top:8, right:10,
            background:"none", border:"none", color:t3, cursor:"pointer", fontSize:16 }}>×</button>
          <div style={{ fontSize:24, marginBottom:8 }}>🎟</div>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:4, color:t1 }}>Ready to try it for your program?</div>
          <div style={{ fontSize:12, color:t2, lineHeight:1.5, marginBottom:12 }}>Free to start. No credit card. Your inventory, QR labels, and Backstage Exchange in under 5 minutes.</div>
          <GoldBtn label="Start Free Account →" onClick={onSignUp} style={{ width:"100%", fontSize:13 }}/>
        </div>
      )}
      <AIHelpBubble user={null} />
    </div>
  );
}

// ── Visit tracking helper ────────────────────────────────────────────────────
const TRACK_URL = "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/track-visit";
function getSessionId() {
  let sid = sessionStorage.getItem("t4u_sid");
  if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("t4u_sid", sid); }
  return sid;
}
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
        ...extra
      })
    }).catch(() => {});
  } catch(e) {}
}

function AppRoot(){
  const [user,setUser]     = useState(null);
  // ── Hash routing — handles #/item/:id for public QR scans ─────────────────
  // ── Hash routing: #/item/:id and #/location/:id (storage location QR codes) ──
  const _parseHash = (h) => ({
    itemId:     (h.match(/^#\/item\/(.+)$/)     || [])[1] || null,
    locationId: (h.match(/^#\/location\/(.+)$/) || [])[1] || null,
  });
  const [publicItemId,     setPublicItemId]     = useState(() => _parseHash(window.location.hash).itemId);
  const [deepLinkLocation, setDeepLinkLocation] = useState(() => _parseHash(window.location.hash).locationId);
  useEffect(()=>{
    const onHash = () => {
      const { itemId, locationId } = _parseHash(window.location.hash);
      setPublicItemId(itemId);
      setDeepLinkLocation(locationId);
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
  // Preview mode -- ?preview=1 lets anyone explore with sample data before signing up
  const [previewMode, setPreviewMode] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1"
  );
  // Track page visit — must be here at top with all hooks, never after a return
  useEffect(() => { trackVisit("landing"); }, []);
  // District: activeSchool = null means "own account", otherwise = school org object
  const [activeSchool,setActiveSchool]   = useState(null);
  const [memberRole,  setMemberRole]    = useState(null); // null=owner/director, or stage_manager/crew/house
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [openConvId,    setOpenConvId]    = useState(null);
  const [pendingReqCount, setPendingReqCount] = useState(0);
  const [creditBalance, setCreditBalance] = useState(0);
  const [onboardingStep, setOnboardingStep] = useState(null); // null=loading, 0-4
  const [schoolItems,setSchoolItems]     = useState([]);
  const [schoolLoading,setSchoolLoading] = useState(false);
  // Invite token from URL — persisted in localStorage so it survives
  // Supabase's email confirmation redirect (which strips query params)
  const [pendingInvite,setPendingInvite] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const fromUrl = p.get("invite") || p.get("token"); // team invites use 'token'
    if (fromUrl) {
      localStorage.setItem("t4u_pending_invite", fromUrl);
      // Also detect if it's a team token vs district token
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
    SB.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user||null);
      setAuthChk(true);
      // If no valid session but stale tokens exist, clear them
      // This prevents the "signed out after inactivity" message on fresh visits
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
        // Ensure data reloads whenever a new session starts
        // (covers: email confirmation redirect, returning user, invite accept)
        setLoaded(false);
      }
    });
    return()=>subscription.unsubscribe();
  },[]);

  // ── On load: if ?signin=1 in URL, open sign-in modal immediately ─────────────
  useEffect(()=>{
    try {
      const params = new URLSearchParams(window.location.search);
      if(params.get("signin") === "1") {
        // Remove the param from URL cleanly
        const nextHash = params.get("next") || "";
        const cleanUrl = window.location.pathname + (nextHash ? nextHash : "");
        window.history.replaceState({}, "", cleanUrl);
        // Store next hash if provided
        if(nextHash && nextHash.startsWith("#/item/")) {
          try { localStorage.setItem("t4u_post_auth_hash", nextHash); } catch(e) {}
        }
        // Open sign-in — use the global auth trigger registered by the AuthForm component
        // Delay to allow AuthForm to mount and register window.__t4u_show_auth
        setTimeout(()=>{
          if(typeof window.__t4u_show_auth === "function") {
            window.__t4u_show_auth("login");
          }
        }, 400);
      }
    } catch(e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── After sign-in: redirect to item if user came from a QR scan ─────────────
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
      // Check if user is a team member of another org first
      const { data: memberData } = await SB.from("org_members")
        .select("org_id, role, orgs(*)")
        .eq("user_id", user.id)
        .single();

      // Use member's org if they're a team member, otherwise use own org
      const targetOrgId = memberData ? memberData.org_id : user.id;
      const memberRole  = memberData ? memberData.role : null;

      const{data:orgData}=await SB.from("orgs").select("*").eq("id",targetOrgId).single();
      // Admin emails always get District plan regardless of what is stored
      const effectivePlan = isAdminEmail(user?.email) ? "district" : (orgData?.plan || "free");
      if(orgData){
        setOrg({...orgData, _memberRole: memberRole, _isMember: !!memberData});
        setMemberRole(memberRole);
        setPlanState(effectivePlan);
        // Load onboarding step — 0 = brand new user
        setOnboardingStep(orgData.onboarding_step ?? 0);
      } else { setPlanState(effectivePlan); }
      const{data:itemData}=await SB.from("items").select("*").eq("org_id",targetOrgId).order("added",{ascending:false}).limit(2000);
      if(itemData) setItems(itemData);
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
    // Free plan users CAN navigate to community/marketplace — they see the upgrade overlay
    if(page==="community"  && !org?.community_enabled && plan !== "free")   setPage("dashboard");
    if(page==="marketplace"&& !org?.marketplace_enabled && plan !== "free") setPage("dashboard");
  },[org?.community_enabled, org?.marketplace_enabled, page]);
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
      ...(!isCrew ? [{ id:"marketplace", label:"Backstage Exchange", ico:Ic.store,   enabled:!!org?.marketplace_enabled }] : []),
      ...(!isCrew ? [{ id:"community",   label:"Community Board",    ico:"🎪",        enabled:!!org?.community_enabled, community:true }] : []),
      ...(!isCrew  ? [{ id:"productions", label:"Productions", ico:"🎭"       }] : []),
      ...(!isMember? [{ id:"reports",     label:"Reports",     ico:Ic.chart   }] : []),
      ...(!isMember? [{ id:"funding",     label:"Funding Tracker", ico:"💰"  }] : []),
      // Prop 28 nav hidden — legacy data accessible via Funding Tracker migration banner
      { id:"profile",     label:"My Profile",  ico:"👤"       },
      ...(!isMember ? [{ id:"points", label:"Stage Points", ico:"🪙" }] : []),
      ...(!isMember && plan === "district" ? [{ id:"district", label:"District", ico:"🏢", district:true }] : []),
      ...(!isMember && isAdmin ? [{ id:"admin", label:"Admin", ico:Ic.settings, admin:true }] : []),
    ];
  })();
  const TITLES = { messages:"Messages", prop28:"Prop 28", requests:"Requests", dashboard:"Dashboard", inventory: activeSchool ? `📦 ${activeSchool.name}` : "Inventory", marketplace:"Backstage Exchange", productions:"Productions", reports:"Reports", settings:"Settings", admin:"Admin Dashboard", district:"District", credits:"Stage Points", points:"Stage Points", community:"Community Board" };

  // ── Public item page — no auth required ─────────────────────────────────────
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

  // Show preview mode if ?preview=1 and not logged in
  if (!user && previewMode) return (
    <PreviewMode onSignUp={() => { setPreviewMode(false); window.__t4u_show_auth && window.__t4u_show_auth("signup"); }}/>
  );

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
      <AuthOverlay onAuth={(u, isNew=false)=>{
        setUser(u);
        trackVisit("app", { org_id: u.id });
        // Always call signup-notify — server deduplicates, only emails once per org
        fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/signup-notify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: u.id })
        }).catch(() => {});
      }} pendingInvite={pendingInvite} inviteInfo={inviteInfo}/>
      {user && <FeedbackWidget userId={user.id} orgName={org?.name||""} isLeadingPlayer={org?.is_leading_player||false}/>}
      <AIHelpBubble user={user} />
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
                  <LogoMarkDark size={44}/>
                  <div>
                    <div className="sb-name">Theatre4u™</div>
                    <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"rgba(212,168,67,.5)",marginTop:2,fontFamily:"'Raleway',sans-serif",fontWeight:700}}>Inventory · Exchange</div>
                  </div>
                </div>
                <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{padding:"2px 8px",background:plan==="free"?"rgba(255,255,255,.08)":plan==="pro"?"rgba(212,168,67,.2)":"rgba(66,165,245,.2)",color:plan==="free"?"rgba(255,255,255,.35)":plan==="pro"?"var(--gold)":"#42a5f5",borderRadius:9,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>
                    {plan==="free"?"Free Plan":plan==="pro"?"Pro":"District"}
                  </span>

                </div>
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
                     memberRole==="house"?"🎟 House":"Team Member"}
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
                    <button onClick={() => { setActiveSchool(null); setPage("district"); }}
                      style={{ fontSize: 11, color: "rgba(255,255,255,.6)", background: "none", border: "1px solid rgba(255,255,255,.2)", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                      ← Back to District
                    </button>
                  </div>
                )}
                {NAV.map(n=>(
                  <div key={n.id}
                    className={`sb-item ${page===n.id?"on":""}`}
                    onClick={()=>{
                      // Disabled community/marketplace on paid plan → go to Settings to enable
                      if ((n.id==="marketplace"||n.id==="community") && !n.enabled && plan!=="free") {
                        nav("settings"); return;
                      }
                      nav(n.id);
                    }}
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
                    {n.id==="marketplace" && listed>0 && n.enabled && <span className="sb-badge">{listed}</span>}
                {(n.id==="marketplace"||n.id==="community") && !n.enabled && plan==="free" && (
                  <span style={{marginLeft:"auto",fontSize:10,color:"rgba(212,168,67,.5)",
                    background:"rgba(212,168,67,.08)",padding:"1px 6px",borderRadius:6,flexShrink:0}}>
                    Pro
                  </span>
                )}
                {(n.id==="marketplace"||n.id==="community") && !n.enabled && plan!=="free" && (
                  <span style={{marginLeft:"auto",fontSize:9,color:"rgba(255,255,255,.3)",
                    background:"rgba(255,255,255,.06)",padding:"1px 6px",borderRadius:6,flexShrink:0}}>
                    Off
                  </span>
                )}
                    {n.id==="productions"&& <span className="sb-badge" style={{background:"rgba(212,168,67,.2)",color:"var(--gold)"}}>🎭</span>}
                    
                    {n.id==="points"    && creditBalance>0 && <span className="sb-badge" style={{background:"rgba(212,168,67,.2)",color:"var(--gold)"}}>{creditBalance}</span>}
                  </div>
                ))}
              </nav>

              <div className="sb-foot">
                <div style={{display:"flex",gap:5,flexDirection:"column"}}>
                  {/* Mobile App — all plans */}
                  <a href="/app.html" target="_blank" rel="noreferrer" className="btn btn-o btn-sm btn-full"
                    style={{color:"var(--gold)",borderColor:"rgba(212,168,67,.3)",fontSize:12,padding:"7px 12px",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                    📱 Mobile App
                  </a>
                  {/* Help & Tutorials — all plans */}
                  <a href="/help.html" target="_blank" rel="noreferrer" className="btn btn-o btn-sm btn-full"
                    style={{color:"rgba(255,255,255,.6)",borderColor:"rgba(255,255,255,.12)",fontSize:12,padding:"7px 12px",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                    ❓ Help & Tutorials
                  </a>
                  {/* Upgrade prompt — free plan only */}
                  {plan==="free"&&!isAdmin&&(
                    <button className="btn btn-sm btn-full" style={{background:"linear-gradient(135deg,var(--gold),var(--amber))",border:"none",color:"#1a0f00",fontSize:13,fontWeight:800,padding:"9px 12px",letterSpacing:.2}} onClick={()=>nav("settings")}>
                      ⭐ Upgrade Plan
                    </button>
                  )}
                  <button className="btn btn-o btn-sm btn-full" style={{color:"rgba(255,255,255,.85)",borderColor:"rgba(255,255,255,.28)",fontSize:13,padding:"8px 12px"}} onClick={()=>nav("settings")}>
                    <span style={{width:13,height:13,display:"flex"}}>{Ic.settings}</span>Settings
                  </button>
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
                  {page==="dashboard"   && <Dashboard   items={items} org={org} plan={plan} pointBalance={creditBalance} goInventory={()=>nav("inventory")} goMarketplace={()=>nav("marketplace")} goCommunity={()=>nav("community")} goProfile={()=>nav("profile")} goPoints={()=>nav("points")}/>}
                  {page==="inventory"   && !activeSchool && <Inventory   items={items} onAdd={add} onEdit={edit} onDelete={del} userId={user?.id} plan={plan} memberRole={memberRole} org={org} deepLinkLocationId={deepLinkLocation} onDeepLinkConsumed={()=>setDeepLinkLocation(null)}/>}
                  {page==="inventory"   && activeSchool && (
                    schoolLoading
                      ? <div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>Loading {activeSchool.name}…</div>
                      : <Inventory items={schoolItems}
                          onAdd={async(item)=>{ const row={...item,org_id:activeSchool.id}; const{data}=await SB.from("items").insert(row).select().single(); if(data) setSchoolItems(p=>[data,...p]); }}
                          onEdit={async(item)=>{ const pl={...item}; delete pl.id; delete pl.org_id; delete pl.added; const{data,error}=await SB.from("items").update(pl).eq("id",item.id).select().single(); if(error){alert("Could not update item: "+error.message);console.error(error);}else if(data) setSchoolItems(p=>p.map(x=>x.id===item.id?data:x)); }}
                          onDelete={async(id)=>{ await SB.from("items").delete().eq("id",id); setSchoolItems(p=>p.filter(x=>x.id!==id)); }}
                          userId={activeSchool.id} plan={plan}
                          schoolName={activeSchool.name}
                          headerNote={<div style={{padding:"8px 12px",background:"rgba(66,165,245,.1)",border:"1px solid rgba(66,165,245,.2)",borderRadius:7,marginBottom:12,fontSize:12,color:"#42a5f5"}}>🏫 Editing inventory for <strong>{activeSchool.name}</strong></div>}
                        />
                  )}
                  {page==="marketplace" && <MarketplaceGate items={items} org={org} setOrg={setOrg} plan={plan} userId={user?.id} activeSchool={activeSchool} allSchoolsMode={plan==="district"} onEdit={edit} onDelete={del}/>}
                  {page==="productions" && <Productions userId={user?.id} allItems={items}/>}
                  {page==="reports"     && <Reports     items={activeSchool ? schoolItems : items} plan={plan} org={org}/>}
                  {page==="funding"     && <FundingPage userId={user?.id} org={org} plan={plan}/>}
                  {page==="prop28"      && <Prop28Page  userId={user?.id} org={org} onNav={nav}/>}
                  {page==="profile"     && <OrgProfilePage userId={user?.id} org={org} setOrg={saveOrg} plan={plan} items={items}/>}
              {page==="settings"    && <Settings    org={org} setOrg={saveOrg} onSeed={seed} user={user} userId={user?.id} items={items} setItems={setItems} plan={plan} userEmail={user?.email} setPlan={setPlan} memberRole={memberRole}/>}
                  {page==="district"    && plan==="district" && <DistrictDashboard user={user} plan={plan} onSwitchSchool={switchSchool}/>}
                  {page==="community"   && <CommunityGate userId={user?.id} org={org} setOrg={setOrg} plan={plan}/>}
                  {page==="points"     && (plan!=="free"||isAdmin) && <CreditsPage userId={user?.id} org={org} plan={plan} balance={creditBalance} onBalanceChange={setCreditBalance}/>}
                  {page==="points"     && plan==="free"&&!isAdmin && <div style={{padding:40,textAlign:"center"}}><div style={{fontSize:44,marginBottom:14}}>🪙</div><h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:10}}>Stage Points is a Pro Feature</h2><p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 24px",lineHeight:1.6}}>Earn credits by lending and renting your items. Spend them when you borrow. Upgrade to unlock.</p><UpgradePlans compact={true}/></div>}


                  {page==="admin"       && isAdmin && <AdminDashboard currentUser={user}/>}
                </div>
            }
          </div>
        </div>
      </div>

      {/* ── Legal Modals ── */}
      {legalPage==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegalPage(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legalPage==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegalPage(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {user && <FeedbackWidget userId={user.id} orgName={org?.name||""} isLeadingPlayer={org?.is_leading_player||false}/>}
      {user && <AIHelpBubble user={user} />}
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
    name:     org?.name     || "",
    type:     org?.type     || "",
    location: org?.location || "",
    bio:      org?.bio      || "",
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
      name:     pf.name.trim()     || org.name,
      type:     pf.type            || org.type,
      location: pf.location.trim() || org.location,
      bio:      pf.bio.trim()      || org.bio,
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
            {org?.name ? `${org.name} now has` : "You now have"} {items.length} item{items.length!==1?"s":""} in Theatre4u™. Here's what to do next:
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
function LocationsPanel({ userId, items, onEditItem, onDeleteItem }) {
  const [locations,    setLocations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null); // "add"|"edit"|"browse"
  const [active,       setActive]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [browseItems,  setBrowseItems]  = useState([]);
  const [msg,          setMsg]          = useState("");

  const flash = m => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  // Load locations with item counts
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from("storage_locations")
      .select("*")
      .eq("org_id", userId)
      .order("name");
    setLocations(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Save location (add or edit)
  const saveLocation = async (f) => {
    setSaving(true);
    if (active) {
      const { data, error } = await SB.from("storage_locations")
        .update({ name: f.name.trim(), code: f.code.trim() || null, description: f.description.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", active.id).select().single();
      if (error) { flash("❌ " + EM.fundingSave.body); }
      else { setLocations(p => p.map(x => x.id === data.id ? data : x)); flash("✓ Location updated"); setModal(null); setActive(null); }
    } else {
      const { data, error } = await SB.from("storage_locations")
        .insert({ org_id: userId, name: f.name.trim(), code: f.code.trim() || null, description: f.description.trim() || null })
        .select().single();
      if (error) { flash("❌ " + EM.fundingSave.body); }
      else { setLocations(p => [...p, data]); flash("✓ Location added"); setModal(null); }
    }
    setSaving(false);
  };

  const deleteLocation = async (id) => {
    if (!window.confirm("Delete this location? Items assigned here will lose their location link, but won't be deleted.")) return;
    await SB.from("storage_locations").delete().eq("id", id);
    setLocations(p => p.filter(x => x.id !== id));
    flash("Location removed");
  };

  const browseLocation = (loc) => {
    setActive(loc);
    // Find items with this location_id OR whose free-text location matches the name
    const matched = items.filter(i =>
      i.location_id === loc.id ||
      (i.location && i.location.toLowerCase() === loc.name.toLowerCase())
    );
    setBrowseItems(matched);
    setModal("browse");
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

  const card = { background: "var(--parch)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 10 };
  const inp  = { background: "var(--white)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl  = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", display: "block", marginBottom: 4 };

  return (
    <div>
      {msg && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: msg.startsWith("❌") ? "var(--red)" : "var(--green)", boxShadow: "0 4px 20px rgba(0,0,0,.4)" }}>{msg}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            Define named storage locations — rooms, closets, containers, racks. Assign items to a location and browse by container. Each location gets its own printable QR label.
          </p>
        </div>
        <button className="btn btn-g" style={{ flexShrink: 0 }} onClick={() => { setActive(null); setModal("add"); }}>
          + Add Location
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading locations…</div>
      ) : locations.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">📦</div>
          <h3>No locations yet</h3>
          <p>Add your first storage location — a closet, a container, a room — and start assigning items to it.</p>
          <button className="btn btn-g" onClick={() => setModal("add")}>+ Add First Location</button>
        </div>
      ) : (
        locations.map(loc => {
          const count = items.filter(i =>
            i.location_id === loc.id ||
            (i.location && i.location.toLowerCase() === loc.name.toLowerCase())
          ).length;
          return (
            <div key={loc.id} style={card}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 22 }}>📦</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{loc.name}</span>
                    {loc.code && (
                      <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "var(--amber)", background: "rgba(196,118,26,.12)", padding: "2px 8px", borderRadius: 4 }}>{loc.code}</span>
                    )}
                  </div>
                  {loc.description && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontStyle: "italic" }}>{loc.description}</div>
                  )}
                  <button onClick={() => browseLocation(loc)}
                    style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    {count} item{count !== 1 ? "s" : ""} →
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn btn-o bsm" style={{ fontSize: 11 }} onClick={() => printLocationQR(loc)}>
                    🖨 QR Label
                  </button>
                  <button className="btn btn-o bsm" onClick={() => { setActive(loc); setModal("edit"); }}>Edit</button>
                  <button className="btn btn-d bsm" onClick={() => deleteLocation(loc.id)}>Delete</button>
                </div>
              </div>
            </div>
          );
        })
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

      {/* ── Browse items in location ── */}
      {modal === "browse" && active && (
        <Modal title={`📦 ${active.name}${active.code ? " · " + active.code : ""}`} onClose={() => { setModal(null); setActive(null); setBrowseItems([]); }}>
          <div style={{ marginBottom: 12, fontSize: 13, color: "var(--muted)" }}>
            {browseItems.length} item{browseItems.length !== 1 ? "s" : ""} in this location
          </div>
          {browseItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div>No items assigned to this location yet.</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Assign items here by editing them and selecting this location.</div>
            </div>
          ) : (
            browseItems.map(item => {
              const cat = CAT[item.category] || CAT.other;
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--linen)" }}>
                  <div style={{ width: 36, height: 36, background: cat.color + "22", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 8 }}>
                      {item.display_id && <span style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--amber)" }}>{item.display_id}</span>}
                      <span>{cat.label}</span>
                      <span>{item.condition}</span>
                      <span>×{item.qty}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button className="btn btn-o bsm" onClick={() => { setModal(null); onEditItem(item); }}>Edit</button>
                  </div>
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
  const blank = { name: "", code: "", description: "" };
  const [f, setF] = useState(initial || blank);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal title={(initial ? "Edit" : "Add") + " Storage Location"} onClose={onCancel}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={lbl}>Location Name *</label>
          <input style={inp} value={f.name} onChange={e => upd("name", e.target.value)}
            placeholder="e.g. Storage Container 1, Costume Closet A, Prop Room Shelf 3" autoFocus />
        </div>
        <div>
          <label style={lbl}>Short Code <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(optional — for labels)</span></label>
          <input style={{ ...inp, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}
            value={f.code} onChange={e => upd("code", e.target.value.toUpperCase())}
            placeholder="e.g. SC1, CCA, PS3" maxLength={8} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Appears large on the printed QR label for quick visual ID.</div>
        </div>
        <div>
          <label style={lbl}>Description <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(optional)</span></label>
          <textarea style={{ ...inp, minHeight: 56, resize: "vertical" }}
            value={f.description} onChange={e => upd("description", e.target.value)}
            placeholder="Upstage right, blue rolling rack, near loading dock…" />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-o" onClick={onCancel}>Cancel</button>
          <button className="btn btn-g" disabled={!f.name.trim() || saving}
            style={{ opacity: !f.name.trim() || saving ? 0.45 : 1 }}
            onClick={() => { if (f.name.trim()) onSave(f); }}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Location"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Prop28Page({userId, org, onNav}) {
  const [purchases,   setPurchases]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [migrating,   setMigrating]   = useState(false);
  const [migrated,    setMigrated]    = useState(false);
  const [migrateMsg,  setMigrateMsg]  = useState("");
  const [alreadyMigrated, setAlreadyMigrated] = useState(false);

  useEffect(()=>{
    if(!userId) return;
    (async()=>{
      setLoading(true);
      const [pr, sr] = await Promise.all([
        SB.from("prop28_purchases").select("*").eq("org_id", userId).order("date_purchased", {ascending:false}),
        SB.from("funding_sources").select("id,name").eq("org_id", userId).ilike("name", "%prop 28%"),
      ]);
      setPurchases(pr.data || []);
      if (sr.data && sr.data.length > 0) setAlreadyMigrated(true);
      setLoading(false);
    })();
  }, [userId]);

  const handleMigrate = async () => {
    if (!window.confirm(
      "This will create a \"Prop 28\" funding source in your Funding Tracker and copy your " +
      purchases.length + " purchase record" + (purchases.length !== 1 ? "s" : "") +
      " as expenditures. Your original Prop 28 records are preserved. Continue?"
    )) return;

    setMigrating(true);
    setMigrateMsg("");

    try {
      // 1. Create the funding source
      const totalCost = purchases.reduce((a, p) => a + (parseFloat(p.cost) || 0), 0);
      const years = [...new Set(purchases.map(p => p.school_year).filter(Boolean))];
      const fiscalYear = years.length === 1 ? years[0] : years.join(", ");

      const { data: src, error: srcErr } = await SB.from("funding_sources").insert({
        org_id:       userId,
        name:         "Prop 28",
        source_type:  "state_grant",
        funder:       "California Department of Education",
        total_amount: totalCost || null,
        fiscal_year:  fiscalYear || null,
        notes:        "Migrated from Prop 28 tracker. Arts and music education funding per AB 30 (2022).",
        is_active:    true,
      }).select().single();

      if (srcErr) throw new Error("Could not create funding source: " + srcErr.message);

      // 2. Insert each purchase as an expenditure
      let imported = 0, failed = 0;
      for (const p of purchases) {
        const { error: expErr } = await SB.from("funding_expenditures").insert({
          org_id:            userId,
          funding_source_id: src.id,
          description:       p.item_description || "Prop 28 purchase",
          amount:            parseFloat(p.cost) || 0,
          purchase_date:     p.date_purchased || null,
          vendor:            p.vendor || null,
          category:          p.arts_discipline ? "Arts — " + p.arts_discipline : "Arts & Music",
          notes:             [
            p.school_year    ? "School year: " + p.school_year : null,
            p.grade_levels?.length ? "Grades: " + p.grade_levels.join(", ") : null,
            p.students_served ? "Students served: " + p.students_served : null,
            p.supplement_not_supplant ? "Supplement not supplant: Yes" : null,
            p.notes          ? p.notes : null,
          ].filter(Boolean).join(" | ") || null,
        });
        if (expErr) { failed++; console.error("Exp insert error:", expErr); }
        else imported++;
      }

      setMigrated(true);
      setMigrateMsg(
        imported + " record" + (imported !== 1 ? "s" : "") + " copied to Funding Tracker" +
        (failed > 0 ? " (" + failed + " failed — check console)" : "") + "."
      );
    } catch(err) {
      setMigrateMsg("Migration failed: " + (err.message || "Unknown error. Please try again."));
    } finally {
      setMigrating(false);
    }
  };

  const card = {background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:16,marginBottom:12};

  if (loading) return <div style={{textAlign:"center",padding:60,color:"var(--faint)"}}>Loading Prop 28 records…</div>;

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>

      {/* Header */}
      <div style={{marginBottom:20}}>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:4}}>Prop 28 Records</h2>
        <p style={{color:"var(--faint)",fontSize:13,lineHeight:1.6}}>
          Your Prop 28 (AB 30) arts and music education purchase records.
        </p>
      </div>

      {/* Migration banner */}
      <div style={{...card, background:"linear-gradient(135deg,rgba(212,168,67,.10),rgba(212,168,67,.04))",
        borderColor:"rgba(212,168,67,.3)", marginBottom:20}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div style={{fontSize:32,flexShrink:0}}>📋</div>
          <div style={{flex:1,minWidth:260}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>
              Prop 28 tracking has moved to the Funding Tracker
            </div>
            <p style={{fontSize:13,color:"var(--faint)",lineHeight:1.6,marginBottom:10}}>
              Your existing Prop 28 data is preserved below. Use the Funding Tracker to record
              and organize all your program funding — grants, district allocations, booster funds,
              and Prop 28 — in one place.
            </p>
            {alreadyMigrated && !migrated ? (
              <div style={{fontSize:13,color:"var(--green)",fontWeight:600}}>
                ✓ Already migrated — a "Prop 28" source exists in your Funding Tracker.
                {" "}<button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",
                  fontFamily:"inherit",fontSize:13,fontWeight:700,padding:0}}
                  onClick={()=>onNav("funding")}>Go to Funding Tracker →</button>
              </div>
            ) : migrated ? (
              <div>
                <div style={{fontSize:13,color:"var(--green)",fontWeight:600,marginBottom:8}}>
                  ✓ {migrateMsg}
                </div>
                <button className="btn btn-g" style={{fontSize:13}}
                  onClick={()=>onNav("funding")}>
                  Open Funding Tracker →
                </button>
              </div>
            ) : purchases.length === 0 ? (
              <div style={{fontSize:13,color:"var(--faint)"}}>
                No Prop 28 records to migrate.{" "}
                <button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",
                  fontFamily:"inherit",fontSize:13,fontWeight:700,padding:0}}
                  onClick={()=>onNav("funding")}>Go to Funding Tracker →</button>
              </div>
            ) : (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <button className="btn btn-g" style={{fontSize:13}}
                  disabled={migrating} onClick={handleMigrate}>
                  {migrating ? "Migrating…" : "Migrate " + purchases.length + " Record" + (purchases.length !== 1 ? "s" : "") + " to Funding Tracker"}
                </button>
                <button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",
                  fontFamily:"inherit",fontSize:13,fontWeight:700,padding:0}}
                  onClick={()=>onNav("funding")}>
                  Go to Funding Tracker →
                </button>
              </div>
            )}
            {migrateMsg && !migrated && (
              <div style={{fontSize:13,color:"var(--red)",marginTop:8}}>{migrateMsg}</div>
            )}
          </div>
        </div>
      </div>

      {/* Existing records */}
      {purchases.length === 0 ? (
        <div style={{textAlign:"center",padding:48,color:"var(--faint)"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:8}}>No Prop 28 records</div>
          <div style={{fontSize:13,marginBottom:16}}>
            Use the Funding Tracker to record and organize your Prop 28 spending.
          </div>
          <button className="btn btn-g" onClick={()=>onNav("funding")}>Go to Funding Tracker</button>
        </div>
      ) : (
        <div>
          <div style={{fontSize:12,color:"var(--faint)",marginBottom:12,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>
            {purchases.length} purchase record{purchases.length !== 1 ? "s" : ""}
          </div>
          {purchases.map(p => (
            <div key={p.id} style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{p.item_description || "—"}</div>
                  <div style={{fontSize:12,color:"var(--faint)",display:"flex",flexWrap:"wrap",gap:10,marginBottom:p.notes?6:0}}>
                    {p.school_year      && <span>📅 {p.school_year}</span>}
                    {p.arts_discipline  && <span>🎨 {p.arts_discipline}</span>}
                    {p.vendor           && <span>🏪 {p.vendor}</span>}
                    {p.students_served  && <span>👥 {p.students_served} students</span>}
                    {p.date_purchased   && <span>{new Date(p.date_purchased + "T00:00:00").toLocaleDateString()}</span>}
                  </div>
                  {p.notes && <div style={{fontSize:12,color:"var(--faint)",fontStyle:"italic"}}>{p.notes}</div>}
                </div>
                <div style={{fontWeight:800,fontSize:18,color:"var(--gold)",fontFamily:"'Playfair Display',serif",flexShrink:0}}>
                  {p.cost != null ? "$" + parseFloat(p.cost).toLocaleString("en-US",{minimumFractionDigits:2}) : "—"}
                </div>
              </div>
            </div>
          ))}
          <div style={{fontSize:12,color:"var(--faint)",marginTop:8,padding:"10px 14px",
            background:"rgba(255,255,255,.03)",borderRadius:8,border:"1px solid var(--border)"}}>
            <strong>Note:</strong> These records are read-only here. To add or edit Prop 28 spending records,
            use the Funding Tracker and select your Prop 28 funding source.
          </div>
        </div>
      )}
    </div>
  );
}


function FundingPage({userId, org, plan}){
  const[sources,   setSources]   = useState([]);
  const[exps,      setExps]      = useState([]);
  const[tab,       setTab]       = useState("sources");   // sources | spending | reports
  const[modal,     setModal]     = useState(null);        // "add-source"|"edit-source"|"add-exp"|"edit-exp"
  const[active,    setActive]    = useState(null);
  const[loading,   setLoading]   = useState(true);
  const[saving,    setSaving]    = useState(false);
  const[msg,       setMsg]       = useState("");
  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),3500); };

  // ── load ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!userId) return;
    (async()=>{
      setLoading(true);
      const [sr, er] = await Promise.all([
        SB.from("funding_sources").select("*").eq("org_id",userId).order("created_at",{ascending:false}),
        SB.from("funding_expenditures").select("*").eq("org_id",userId).order("purchase_date",{ascending:false}),
      ]);
      if(sr.data) setSources(sr.data);
      if(er.data) setExps(er.data);
      setLoading(false);
    })();
  },[userId]);

  // ── source CRUD ───────────────────────────────────────────────────────────
  const saveSource = async(f) => {
    setSaving(true);
    if(active){
      const{data,error}=await SB.from("funding_sources").update({...f,updated_at:new Date().toISOString()}).eq("id",active.id).select().single();
      if(error){ flash("❌ "+EM.fundingSave.body); }
      else{ setSources(p=>p.map(x=>x.id===data.id?data:x)); flash("✓ Source updated"); setModal(null); setActive(null); }
    } else {
      const{data,error}=await SB.from("funding_sources").insert({...f,org_id:userId}).select().single();
      if(error){ flash("❌ "+EM.fundingSave.body); }
      else{ setSources(p=>[data,...p]); flash("✓ Source added"); setModal(null); }
    }
    setSaving(false);
  };

  const deleteSource = async(id) => {
    if(!confirm("Delete this funding source? All associated expenditures will also be removed.")) return;
    await SB.from("funding_sources").delete().eq("id",id);
    setSources(p=>p.filter(x=>x.id!==id));
    setExps(p=>p.filter(x=>x.funding_source_id!==id));
    flash("Source removed");
  };

  // ── expenditure CRUD ──────────────────────────────────────────────────────
  const saveExp = async(f) => {
    setSaving(true);
    if(active){
      const{data,error}=await SB.from("funding_expenditures").update({...f,updated_at:new Date().toISOString()}).eq("id",active.id).select().single();
      if(error){ flash("❌ "+EM.fundingSave.body); }
      else{ setExps(p=>p.map(x=>x.id===data.id?data:x)); flash("✓ Expenditure updated"); setModal(null); setActive(null); }
    } else {
      const{data,error}=await SB.from("funding_expenditures").insert({...f,org_id:userId}).select().single();
      if(error){ flash("❌ "+EM.fundingSave.body); }
      else{ setExps(p=>[data,...p]); flash("✓ Expenditure added"); setModal(null); }
    }
    setSaving(false);
  };

  const deleteExp = async(id) => {
    if(!confirm("Remove this expenditure?")) return;
    await SB.from("funding_expenditures").delete().eq("id",id);
    setExps(p=>p.filter(x=>x.id!==id));
    flash("Expenditure removed");
  };

  // ── derived stats ─────────────────────────────────────────────────────────
  const totalAllocated = sources.filter(s=>s.is_active).reduce((a,s)=>a+(parseFloat(s.total_amount)||0),0);
  const totalSpent     = exps.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
  const remaining      = totalAllocated - totalSpent;

  // ── export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["Source","Type","Funder","Fiscal Year","Date","Category","Description","Vendor","Amount"],
      ...exps.map(e => {
        const src = sources.find(s=>s.id===e.funding_source_id);
        return [
          src?.name||"",
          src?.source_type||"",
          src?.funder||"",
          src?.fiscal_year||"",
          e.purchase_date||"",
          e.category||"",
          e.description||"",
          e.vendor||"",
          e.amount||0,
        ];
      }),
    ].map(r=>r.map(v=>typeof v==="string"&&v.includes(",")?`"${v}"`:v).join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([rows],{type:"text/csv"}));
    a.download=`funding-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const card  = {background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:16,marginBottom:12};
  const label = {fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4};
  const inp   = {background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"7px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"};
  const row2  = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10};

  if(loading) return <div style={{textAlign:"center",padding:60,color:"var(--faint)"}}>Loading funding data…</div>;

  return(
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* Flash message */}
      {msg&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:"var(--cream)",
        border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px",
        fontSize:13,fontWeight:600,color:msg.startsWith("❌")?"var(--red)":"var(--green)",
        boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>{msg}</div>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:4}}>Funding Tracker</h2>
          <p style={{color:"var(--faint)",fontSize:13}}>Track, record, and report funding sources and expenditures for your own records.</p>
          <p style={{fontSize:12,color:"var(--faint)",marginTop:4,fontStyle:"italic",lineHeight:1.5}}>
            Theatre4u helps you organize and report funding data for your own records. Consult your district’s business office for compliance determinations.
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={exportCSV} className="btn btn-o" style={{fontSize:12}}>
            ↓ Export CSV
          </button>
          <button onClick={()=>setTab("impact")} className="btn btn-g" style={{fontSize:12}}>
            📋 Impact Report
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:24}}>
        {[
          {label:"Total Allocated",  val:"$"+totalAllocated.toLocaleString("en-US",{minimumFractionDigits:2}), color:"var(--gold)"},
          {label:"Total Spent",      val:"$"+totalSpent.toLocaleString("en-US",{minimumFractionDigits:2}),     color:"var(--blue)"},
          {label:"Remaining",        val:"$"+remaining.toLocaleString("en-US",{minimumFractionDigits:2}),      color:remaining>=0?"var(--green)":"var(--red)"},
          {label:"Active Sources",   val:sources.filter(s=>s.is_active).length,                                color:"var(--text)"},
          {label:"Expenditures",     val:exps.length,                                                          color:"var(--text)"},
        ].map(s=>(
          <div key={s.label} style={{...card,textAlign:"center",marginBottom:0}}>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"'Playfair Display',serif",color:s.color}}>{s.val}</div>
            <div style={{fontSize:11,color:"var(--faint)",marginTop:4,textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,borderBottom:"1px solid var(--border)",marginBottom:20}}>
        {[["sources","Funding Sources"],["spending","Expenditures"],["reports","By Source"],["impact","📋 Impact Report"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{background:"none",border:"none",padding:"8px 16px",fontSize:13,fontWeight:600,
              color:tab===id?"var(--gold)":"var(--faint)",
              borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent",
              cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── SOURCES TAB ───────────────────────────────────────────────────── */}
      {tab==="sources"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
            <button className="btn btn-g" onClick={()=>{setActive(null);setModal("add-source");}}>
              + Add Funding Source
            </button>
          </div>
          {sources.length===0&&(
            <div style={{textAlign:"center",padding:48,color:"var(--faint)"}}>
              <div style={{fontSize:40,marginBottom:12}}>💰</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:8}}>No funding sources yet</div>
              <div style={{fontSize:13,marginBottom:16}}>Add a source to start tracking — grants, allocations, booster funds, and more.</div>
              <button className="btn btn-g" onClick={()=>setModal("add-source")}>+ Add First Source</button>
            </div>
          )}
          {sources.map(s=>{
            const spent = exps.filter(e=>e.funding_source_id===s.id).reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
            const alloc = parseFloat(s.total_amount)||0;
            const pct   = alloc>0 ? Math.min(100, (spent/alloc)*100) : 0;
            const ft    = FUND_TYPES.find(f=>f.id===s.source_type)||FUND_TYPES[FUND_TYPES.length-1];
            return(
              <div key={s.id} style={{...card,opacity:s.is_active?1:0.55}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:18}}>{ft.icon}</span>
                      <span style={{fontWeight:700,fontSize:15}}>{s.name}</span>
                      {!s.is_active&&<span style={{fontSize:10,background:"var(--white)",padding:"1px 6px",borderRadius:10,color:"var(--faint)"}}>Inactive</span>}
                    </div>
                    <div style={{fontSize:12,color:"var(--faint)",marginBottom:8}}>
                      {ft.label}{s.funder?" · "+s.funder:""}{s.fiscal_year?" · FY "+s.fiscal_year:""}
                    </div>
                    {alloc>0&&(
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--faint)",marginBottom:4}}>
                          <span>${spent.toLocaleString("en-US",{minimumFractionDigits:2})} spent</span>
                          <span>${alloc.toLocaleString("en-US",{minimumFractionDigits:2})} allocated</span>
                        </div>
                        <div style={{height:6,background:"var(--white)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:pct+"%",background:pct>90?"var(--red)":pct>70?"var(--gold)":"var(--green)",borderRadius:3,transition:"width .4s"}}/>
                        </div>
                        <div style={{fontSize:11,color:pct>90?"var(--red)":"var(--faint)",marginTop:3}}>
                          ${Math.max(0,alloc-spent).toLocaleString("en-US",{minimumFractionDigits:2})} remaining
                        </div>
                      </div>
                    )}
                    {s.notes&&<div style={{fontSize:12,color:"var(--faint)",marginTop:6,fontStyle:"italic"}}>{s.notes}</div>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-o bsm" onClick={()=>{setActive(s);setModal("edit-source");}}>Edit</button>
                    <button className="btn btn-d bsm" onClick={()=>deleteSource(s.id)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SPENDING TAB ──────────────────────────────────────────────────── */}
      {tab==="spending"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:13,color:"var(--faint)"}}>{exps.length} expenditure{exps.length!==1?"s":""}</span>
            <button className="btn btn-g" disabled={sources.length===0}
              style={{opacity:sources.length===0?0.45:1}}
              title={sources.length===0?"Add a funding source first":""}
              onClick={()=>{setActive(null);setModal("add-exp");}}>
              + Add Expenditure
            </button>
          </div>
          {exps.length===0&&(
            <div style={{textAlign:"center",padding:48,color:"var(--faint)"}}>
              <div style={{fontSize:40,marginBottom:12}}>🧾</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:8}}>No expenditures recorded</div>
              <div style={{fontSize:13}}>Track purchases, services, and other spending against your funding sources.</div>
            </div>
          )}
          {exps.map(e=>{
            const src = sources.find(s=>s.id===e.funding_source_id);
            const ft  = FUND_TYPES.find(f=>f.id===src?.source_type)||FUND_TYPES[FUND_TYPES.length-1];
            return(
              <div key={e.id} style={{...card,display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{e.description}</div>
                  <div style={{fontSize:12,color:"var(--faint)",marginBottom:4}}>
                    {src&&<span style={{background:"var(--white)",padding:"1px 7px",borderRadius:10,marginRight:6}}>{ft.icon} {src.name}</span>}
                    {e.category&&<span>{e.category}</span>}
                    {e.vendor&&<span style={{marginLeft:6}}>· {e.vendor}</span>}
                    {e.purchase_date&&<span style={{marginLeft:6}}>· {new Date(e.purchase_date+"T00:00:00").toLocaleDateString()}</span>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontWeight:800,fontSize:16,color:"var(--gold)",fontFamily:"'Playfair Display',serif"}}>
                    ${parseFloat(e.amount).toLocaleString("en-US",{minimumFractionDigits:2})}
                  </div>
                  <button className="btn btn-o bsm" onClick={()=>{setActive(e);setModal("edit-exp");}}>Edit</button>
                  <button className="btn btn-d bsm" onClick={()=>deleteExp(e.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BY SOURCE REPORT TAB ──────────────────────────────────────────── */}
      {tab==="reports"&&(
        <div>
          <div style={{marginBottom:12,fontSize:12,color:"var(--faint)",fontStyle:"italic"}}>
            Summary of spending per funding source. Export to CSV for your records.
          </div>
          {sources.length===0&&(
            <div style={{textAlign:"center",padding:48,color:"var(--faint)"}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>No sources to report on yet</div>
            </div>
          )}
          {sources.map(s=>{
            const sExps = exps.filter(e=>e.funding_source_id===s.id);
            const spent = sExps.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
            const alloc = parseFloat(s.total_amount)||0;
            const byCat = {};
            sExps.forEach(e=>{ const c=e.category||"Uncategorized"; byCat[c]=(byCat[c]||0)+(parseFloat(e.amount)||0); });
            const ft = FUND_TYPES.find(f=>f.id===s.source_type)||FUND_TYPES[FUND_TYPES.length-1];
            return(
              <div key={s.id} style={{...card}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div>
                    <span style={{fontSize:16}}>{ft.icon}</span>
                    <span style={{fontWeight:700,fontSize:15,marginLeft:6}}>{s.name}</span>
                    {s.fiscal_year&&<span style={{fontSize:12,color:"var(--faint)",marginLeft:8}}>FY {s.fiscal_year}</span>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:800,color:"var(--gold)",fontFamily:"'Playfair Display',serif"}}>
                      ${spent.toLocaleString("en-US",{minimumFractionDigits:2})}
                      {alloc>0&&<span style={{fontSize:12,fontWeight:400,color:"var(--faint)"}}> of ${alloc.toLocaleString("en-US",{minimumFractionDigits:2})}</span>}
                    </div>
                    <div style={{fontSize:11,color:"var(--faint)"}}>{sExps.length} expenditure{sExps.length!==1?"s":""}</div>
                  </div>
                </div>
                {Object.keys(byCat).length>0&&(
                  <div style={{borderTop:"1px solid var(--border)",paddingTop:10}}>
                    {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                      <div key={cat} style={{display:"flex",justifyContent:"space-between",
                        fontSize:12,color:"var(--faint)",padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                        <span>{cat}</span>
                        <span style={{fontWeight:600}}>${amt.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                      </div>
                    ))}
                  </div>
                )}
                {sExps.length===0&&<div style={{fontSize:12,color:"var(--faint)",paddingTop:4}}>No expenditures recorded against this source.</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PROGRAM IMPACT REPORT TAB ──────────────────────────────────── */}
      {tab==="impact"&&(
        <ProgramImpactReport sources={sources} exps={exps} org={org}/>
      )}

      {/* ── SOURCE MODAL ─────────────────────────────────────────────────── */}
      {(modal==="add-source"||modal==="edit-source")&&(
        <SourceModal
          initial={modal==="edit-source"?active:null}
          saving={saving}
          onSave={saveSource}
          onCancel={()=>{setModal(null);setActive(null);}}
        />
      )}

      {/* ── EXPENDITURE MODAL ────────────────────────────────────────────── */}
      {(modal==="add-exp"||modal==="edit-exp")&&(
        <ExpModal
          initial={modal==="edit-exp"?active:null}
          sources={sources}
          saving={saving}
          onSave={saveExp}
          onCancel={()=>{setModal(null);setActive(null);}}
        />
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PROGRAM IMPACT REPORT
// Print-ready: how funding was used — for principals, boards, districts
// ══════════════════════════════════════════════════════════════════════════════
function ProgramImpactReport({ sources, exps, org }) {
  const [filterYear,   setFilterYear]   = React.useState("all");
  const [filterSource, setFilterSource] = React.useState("all");

  const years = [...new Set(sources.map(s=>s.fiscal_year).filter(Boolean))].sort().reverse();

  const filteredSources = sources.filter(s => {
    if (!s.is_active) return false;
    if (filterYear !== "all" && s.fiscal_year !== filterYear) return false;
    if (filterSource !== "all" && s.id !== filterSource) return false;
    return true;
  });
  const filteredExps = exps.filter(e => {
    const src = sources.find(s=>s.id===e.funding_source_id);
    if (!src || !src.is_active) return false;
    if (filterYear !== "all" && src.fiscal_year !== filterYear) return false;
    if (filterSource !== "all" && e.funding_source_id !== filterSource) return false;
    return true;
  });

  const totalAllocated = filteredSources.reduce((a,s)=>a+(parseFloat(s.total_amount)||0),0);
  const totalSpent     = filteredExps.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
  const totalRemaining = totalAllocated - totalSpent;

  const byCat = {};
  filteredExps.forEach(e=>{
    const c = e.category||"Uncategorized";
    byCat[c] = (byCat[c]||0) + (parseFloat(e.amount)||0);
  });

  const today   = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const orgName = org?.name || "Theatre Program";
  const fmt$    = n => "$"+n.toLocaleString("en-US",{minimumFractionDigits:2});

  const printReport = () => {
    const w = window.open("","_blank","width=900,height=700");
    if(!w) return;
    const sourcesHTML = filteredSources.map(src=>{
      const srcExps  = filteredExps.filter(e=>e.funding_source_id===src.id);
      const srcSpent = srcExps.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
      const srcAlloc = parseFloat(src.total_amount)||0;
      return `
        <div style="margin-bottom:28px;break-inside:avoid">
          <table style="width:100%;border-collapse:collapse">
            <tr style="background:#1a0f00">
              <th style="padding:10px 14px;text-align:left;color:#d4a843;font-size:14px">${src.name}${src.funder?" — "+src.funder:""}${src.fiscal_year?" · FY "+src.fiscal_year:""}</th>
              <th style="padding:10px 14px;text-align:right;color:#d4a843;font-size:14px">${fmt$(srcSpent)} of ${fmt$(srcAlloc)} allocated</th>
            </tr>
          </table>
          ${srcExps.length===0?'<p style="font-size:12px;color:#888;padding:8px 14px;font-style:italic">No expenditures recorded.</p>':`
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#f5f0e8">
              <th style="padding:7px 14px;text-align:left;border-bottom:1px solid #ddd">Date</th>
              <th style="padding:7px 14px;text-align:left;border-bottom:1px solid #ddd">Description</th>
              <th style="padding:7px 14px;text-align:left;border-bottom:1px solid #ddd">Category</th>
              <th style="padding:7px 14px;text-align:left;border-bottom:1px solid #ddd">Vendor</th>
              <th style="padding:7px 14px;text-align:right;border-bottom:1px solid #ddd">Amount</th>
            </tr></thead>
            <tbody>
              ${srcExps.map((e,i)=>`<tr style="background:${i%2===0?"#fff":"#faf7f2"}">
                <td style="padding:6px 14px;border-bottom:1px solid #eee">${e.purchase_date?new Date(e.purchase_date+"T00:00").toLocaleDateString():"—"}</td>
                <td style="padding:6px 14px;border-bottom:1px solid #eee">${e.description||"—"}</td>
                <td style="padding:6px 14px;border-bottom:1px solid #eee">${e.category||"—"}</td>
                <td style="padding:6px 14px;border-bottom:1px solid #eee">${e.vendor||"—"}</td>
                <td style="padding:6px 14px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${fmt$(parseFloat(e.amount)||0)}</td>
              </tr>`).join("")}
              <tr style="background:#f5f0e8;font-weight:700">
                <td colspan="4" style="padding:8px 14px;border-top:2px solid #d4a843">Source Total</td>
                <td style="padding:8px 14px;border-top:2px solid #d4a843;text-align:right;color:#1a0f00">${fmt$(srcSpent)}</td>
              </tr>
            </tbody>
          </table>`}
          ${srcAlloc>0?`<div style="font-size:11px;color:#888;padding:4px 14px">Remaining balance: ${fmt$(Math.max(0,srcAlloc-srcSpent))}</div>`:""}
        </div>`;
    }).join("");

    const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>
      `<tr><td style="padding:6px 14px">${cat}</td>
       <td style="padding:6px 14px;text-align:right;font-weight:700">${fmt$(amt)}</td>
       <td style="padding:6px 14px;text-align:right;color:#888">${totalSpent>0?Math.round(amt/totalSpent*100):0}%</td></tr>`
    ).join("");

    const html=`<!DOCTYPE html><html><head><title>Program Impact Report — ${orgName}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1a1200;margin:0;padding:0;font-size:13px}
      .page{max-width:820px;margin:0 auto;padding:40px}
      h1{font-family:Georgia,serif;font-size:28px;margin:0 0 4px;color:#1a0f00}
      h2{font-family:Georgia,serif;font-size:16px;color:#1a0f00;margin:24px 0 10px;border-bottom:2px solid #d4a843;padding-bottom:6px}
      .meta{font-size:12px;color:#888;margin-bottom:32px}
      .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
      .stat-box{background:#f5f0e8;border:1px solid #e0d5c0;border-radius:6px;padding:14px;text-align:center}
      .stat-val{font-family:Georgia,serif;font-size:24px;font-weight:700;color:#d4a843}
      .stat-lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
      @media print{button{display:none!important}.page{padding:24px}}
    </style></head><body><div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#d4a843;margin-bottom:6px">🎭 Theatre4u™</div>
          <h1>Program Impact Report</h1>
          <div class="meta">${orgName}${filterYear!=="all"?" · Fiscal Year "+filterYear:""} · Generated ${today}</div>
        </div>
        <button onclick="window.print()" style="padding:8px 18px;background:#1a0f00;color:#d4a843;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:700">🖨 Print / Save PDF</button>
      </div>
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-val">${fmt$(totalAllocated)}</div><div class="stat-lbl">Total Allocated</div></div>
        <div class="stat-box"><div class="stat-val">${fmt$(totalSpent)}</div><div class="stat-lbl">Total Spent</div></div>
        <div class="stat-box"><div class="stat-val" style="color:${totalRemaining>=0?"#2e7d32":"#c62828"}">${fmt$(Math.abs(totalRemaining))}</div><div class="stat-lbl">${totalRemaining>=0?"Remaining":"Over Budget"}</div></div>
      </div>
      <h2>Spending by Category</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;font-size:12px">
        <thead><tr style="background:#f5f0e8">
          <th style="padding:7px 14px;text-align:left">Category</th>
          <th style="padding:7px 14px;text-align:right">Amount</th>
          <th style="padding:7px 14px;text-align:right">% of Total</th>
        </tr></thead>
        <tbody>${catRows}</tbody>
        <tfoot><tr style="background:#1a0f00;color:#d4a843;font-weight:700">
          <td style="padding:8px 14px">TOTAL</td>
          <td style="padding:8px 14px;text-align:right">${fmt$(totalSpent)}</td>
          <td style="padding:8px 14px;text-align:right">100%</td>
        </tr></tfoot>
      </table>
      <h2>Expenditures by Funding Source</h2>
      ${sourcesHTML||'<p style="color:#888;font-style:italic">No sources match your current filters.</p>'}
      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e0d5c0;font-size:10px;color:#aaa;text-align:center">
        Theatre4u™ — Artstracker LLC · theatre4u.org · For program records — consult your district's business office for compliance determinations.
      </div>
    </div></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const card={background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:16,marginBottom:12};
  const fmt=n=>"$"+n.toLocaleString("en-US",{minimumFractionDigits:2});

  return(
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:3}}>Program Impact Report</div>
          <div style={{fontSize:12,color:"var(--faint)"}}>A funding accountability report for principals, arts directors, and board members.</div>
        </div>
        <button onClick={printReport} className="btn btn-g">🖨 Generate &amp; Print Report</button>
      </div>

      {/* Filters */}
      <div style={{...card,display:"flex",gap:14,alignItems:"flex-end",flexWrap:"wrap",padding:14,marginBottom:20}}>
        <div>
          <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--faint)",display:"block",marginBottom:4}}>Fiscal Year</label>
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)}
            style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"6px 10px",fontSize:13,color:"var(--text)",fontFamily:"inherit"}}>
            <option value="all">All Years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--faint)",display:"block",marginBottom:4}}>Funding Source</label>
          <select value={filterSource} onChange={e=>setFilterSource(e.target.value)}
            style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"6px 10px",fontSize:13,color:"var(--text)",fontFamily:"inherit"}}>
            <option value="all">All Sources</option>
            {sources.filter(s=>s.is_active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{fontSize:12,color:"var(--faint)",paddingBottom:2}}>
          {filteredExps.length} expenditure{filteredExps.length!==1?"s":""} · {fmt(filteredExps.reduce((a,e)=>a+(parseFloat(e.amount)||0),0))} total
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Total Allocated",val:fmt(totalAllocated),          color:"var(--gold)"},
          {label:"Total Spent",    val:fmt(totalSpent),              color:"var(--blue)"},
          {label:"Remaining",      val:fmt(totalRemaining),           color:totalRemaining>=0?"var(--green)":"var(--red)"},
          {label:"Sources",        val:filteredSources.length,        color:"var(--text)"},
          {label:"Expenditures",   val:filteredExps.length,           color:"var(--text)"},
        ].map(s=>(
          <div key={s.label} style={{...card,textAlign:"center",marginBottom:0,padding:14}}>
            <div style={{fontSize:20,fontWeight:800,fontFamily:"'Playfair Display',serif",color:s.color}}>{s.val}</div>
            <div style={{fontSize:10,color:"var(--faint)",marginTop:3,textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {Object.keys(byCat).length>0&&(
        <div style={{...card,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Spending by Category</div>
          {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:130,fontSize:12,color:"var(--faint)",flexShrink:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat}</div>
              <div style={{flex:1,height:6,background:"var(--white)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(totalSpent>0?amt/totalSpent*100:0)+"%",background:"var(--gold)",borderRadius:3,transition:"width .4s"}}/>
              </div>
              <div style={{fontSize:12,fontWeight:700,width:90,textAlign:"right",flexShrink:0}}>{fmt(amt)}</div>
              <div style={{fontSize:11,color:"var(--faint)",width:36,textAlign:"right",flexShrink:0}}>{totalSpent>0?Math.round(amt/totalSpent*100):0}%</div>
            </div>
          ))}
        </div>
      )}

      {/* Per-source breakdown */}
      {filteredSources.length===0?(
        <div style={{textAlign:"center",padding:40,color:"var(--faint)"}}>
          <div style={{fontSize:36,marginBottom:10}}>📋</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:6}}>No data to report</div>
          <div style={{fontSize:13}}>Add funding sources and expenditures, then generate a report.</div>
        </div>
      ):filteredSources.map(src=>{
        const srcExps  = filteredExps.filter(e=>e.funding_source_id===src.id);
        const srcSpent = srcExps.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
        const srcAlloc = parseFloat(src.total_amount)||0;
        const srcCats  = {};
        srcExps.forEach(e=>{const c=e.category||"Uncategorized";srcCats[c]=(srcCats[c]||0)+(parseFloat(e.amount)||0);});
        return(
          <div key={src.id} style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>
                  {src.name}{src.funder&&<span style={{fontWeight:400,color:"var(--faint)"}}> — {src.funder}</span>}
                </div>
                <div style={{fontSize:11,color:"var(--faint)"}}>
                  {src.source_type?.replace("_"," ")?.toUpperCase()}
                  {src.fiscal_year?" · FY "+src.fiscal_year:""}
                  {src.start_date?" · "+new Date(src.start_date+"T00:00").toLocaleDateString()+(src.end_date?" – "+new Date(src.end_date+"T00:00").toLocaleDateString():" – ongoing"):""}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"var(--gold)"}}>
                  {fmt(srcSpent)}{srcAlloc>0&&<span style={{fontSize:12,fontWeight:400,color:"var(--faint)"}}> / {fmt(srcAlloc)}</span>}
                </div>
                {srcAlloc>0&&<div style={{fontSize:11,color:srcAlloc-srcSpent<0?"var(--red)":"var(--faint)"}}>{fmt(Math.max(0,srcAlloc-srcSpent))} remaining</div>}
              </div>
            </div>
            {Object.keys(srcCats).length>0&&(
              <div style={{borderTop:"1px solid var(--border)",paddingTop:8}}>
                {Object.entries(srcCats).sort((a,b)=>b[1]-a[1]).map(([c,a])=>(
                  <div key={c} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--faint)",padding:"3px 0",borderBottom:"1px solid rgba(0,0,0,.04)"}}>
                    <span>{c}</span><span style={{fontWeight:600}}>{fmt(a)}</span>
                  </div>
                ))}
              </div>
            )}
            {srcExps.length===0&&<div style={{fontSize:12,color:"var(--faint)",fontStyle:"italic",paddingTop:4}}>No expenditures recorded.</div>}
          </div>
        );
      })}

      <div style={{fontSize:11,color:"var(--faint)",fontStyle:"italic",marginTop:12,lineHeight:1.5}}>
        Click "Generate &amp; Print Report" for a print-ready formatted version suitable for principals, arts directors, or board presentations.
        For program records only — consult your district's business office for compliance determinations.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM USAGE REPORT
// How the program uses Theatre4u — for principals and superintendents
// ══════════════════════════════════════════════════════════════════════════════
function PlatformUsageReport({ items, org, plan }) {
  const today      = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const orgName    = org?.name || "Theatre Program";
  const totalItems = items.length;
  const totalQty   = items.reduce((s,i)=>s+(i.qty||1),0);
  const withPhotos = items.filter(i=>i.img).length;
  const listed     = items.filter(i=>i.mkt!=="Not Listed").length;
  const inStock    = items.filter(i=>i.avail==="In Stock").length;
  const totalValue = items.reduce((s,i)=>s+((parseFloat(i.sale)||0)*(i.qty||1)),0);
  const memberSince= org?.created_at?new Date(org.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long"}):"N/A";

  const catCounts = items.reduce((a,i)=>{a[i.category]=(a[i.category]||0)+1;return a},{});
  const topCats   = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const CAT_LABELS = {costumes:"Costumes",props:"Props",sets:"Sets & Scenery",lighting:"Lighting",sound:"Sound Equipment",scripts:"Scripts & Music",makeup:"Makeup & Wigs",furniture:"Stage Furniture",fabrics:"Fabrics & Drapes",tools:"Tools & Hardware",effects:"Special Effects",other:"Other"};

  const printReport = () => {
    const w = window.open("","_blank","width=900,height=700");
    if(!w) return;
    const catRows = topCats.map(([cat,n])=>`<tr><td style="padding:6px 14px">${CAT_LABELS[cat]||cat}</td><td style="padding:6px 14px;text-align:right;font-weight:700">${n}</td></tr>`).join("");
    const html=`<!DOCTYPE html><html><head><title>Platform Utilization Report — ${orgName}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1a1200;margin:0;padding:0}
      .page{max-width:820px;margin:0 auto;padding:40px}
      h1{font-family:Georgia,serif;font-size:28px;margin:0 0 4px;color:#1a0f00}
      h2{font-family:Georgia,serif;font-size:16px;color:#1a0f00;margin:24px 0 10px;border-bottom:2px solid #d4a843;padding-bottom:6px}
      .meta{font-size:12px;color:#888;margin-bottom:32px}
      .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
      .stat-box{background:#f5f0e8;border:1px solid #e0d5c0;border-radius:6px;padding:14px;text-align:center}
      .stat-val{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#d4a843}
      .stat-lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
      .callout{background:#fff8e6;border-left:4px solid #d4a843;padding:14px 18px;margin:20px 0;font-size:13px;line-height:1.6}
      table{width:100%;border-collapse:collapse}
      th{background:#f5f0e8;padding:8px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px}
      td{padding:6px 14px;border-bottom:1px solid #eee;font-size:13px}
      @media print{button{display:none!important}}
    </style></head><body><div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#d4a843;margin-bottom:6px">🎭 Theatre4u™</div>
          <h1>Platform Utilization Report</h1>
          <div class="meta">${orgName} · Generated ${today} · Member since ${memberSince}</div>
        </div>
        <button onclick="window.print()" style="padding:8px 18px;background:#1a0f00;color:#d4a843;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:700">🖨 Print / Save PDF</button>
      </div>
      <div class="callout"><strong>${orgName}</strong> uses Theatre4u™ to manage, catalog, and share their theatre program's physical inventory — costumes, props, lighting, sound equipment, sets, and more. This report summarizes how the platform is being utilized to protect and maximize the value of district arts assets.</div>
      <h2>Inventory Summary</h2>
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-val">${totalItems}</div><div class="stat-lbl">Cataloged Items</div></div>
        <div class="stat-box"><div class="stat-val">${totalQty.toLocaleString()}</div><div class="stat-lbl">Total Inventory Qty</div></div>
        <div class="stat-box"><div class="stat-val">${totalValue>0?"$"+totalValue.toLocaleString("en-US",{maximumFractionDigits:0}):"—"}</div><div class="stat-lbl">Est. Inventory Value</div></div>
        <div class="stat-box"><div class="stat-val">${withPhotos}</div><div class="stat-lbl">Items with Photos</div></div>
        <div class="stat-box"><div class="stat-val">${inStock}</div><div class="stat-lbl">Currently Available</div></div>
        <div class="stat-box"><div class="stat-val">${listed}</div><div class="stat-lbl">Shared with Other Programs</div></div>
      </div>
      <h2>Inventory by Category</h2>
      <table><thead><tr><th>Category</th><th style="text-align:right">Items</th></tr></thead><tbody>${catRows}</tbody></table>
      <h2>Asset Management</h2>
      <table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody>
        <tr><td>QR Code Labels</td><td>✅ Every item gets a scannable label for instant identification</td></tr>
        <tr><td>Photo Documentation</td><td>${withPhotos>0?`✅ ${withPhotos} items documented with photos`:"○ No photos yet — recommended for high-value items"}</td></tr>
        <tr><td>Storage Location Tracking</td><td>✅ Items tracked by physical location within the program</td></tr>
        <tr><td>Condition Tracking</td><td>✅ Each item's condition recorded for maintenance planning</td></tr>
        <tr><td>Backstage Exchange</td><td>${listed>0?`✅ ${listed} item${listed!==1?"s":""} shared with neighboring programs — reducing costs for district schools`:"○ No items shared yet"}</td></tr>
      </tbody></table>
      <h2>Why This Matters</h2>
      <p style="font-size:13px;line-height:1.8;color:#444">Theatre programs typically manage hundreds of thousands of dollars in physical assets — costumes, lighting equipment, sound systems, and set materials — with no formal inventory system. Items go missing, get double-purchased, or sit unused while neighboring schools pay commercial rental rates for the same gear.</p>
      <p style="font-size:13px;line-height:1.8;color:#444">Theatre4u™ gives <strong>${orgName}</strong> a permanent, searchable record of every item the program owns. QR labels allow any staff member to instantly look up any item with their phone camera. The Backstage Exchange enables schools within the district to share resources freely — reducing program expenses and maximizing the return on arts investment.</p>
      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e0d5c0;font-size:10px;color:#aaa;text-align:center">Theatre4u™ — Artstracker LLC · theatre4u.org · Report generated ${today}</div>
    </div></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const card={background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:16,marginBottom:12};
  const fmt=n=>"$"+n.toLocaleString("en-US",{minimumFractionDigits:2});

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:3}}>Platform Utilization Report</div>
          <div style={{fontSize:12,color:"var(--faint)"}}>A report for principals, arts directors, and board members showing how Theatre4u is being used to protect and maximize arts program assets.</div>
        </div>
        <button onClick={printReport} className="btn btn-g">🖨 Generate &amp; Print Report</button>
      </div>

      <div style={{...card,background:"rgba(212,168,67,.06)",borderColor:"rgba(212,168,67,.25)",marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>What this report shows</div>
        <div style={{fontSize:13,color:"var(--faint)",lineHeight:1.6}}>This report is designed to hand to a principal or superintendent. It shows the size and value of the program's cataloged inventory, how many items are documented with photos and QR labels, and how many assets are being shared with other programs through Backstage Exchange. Click "Generate &amp; Print Report" for the formatted, print-ready version.</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Cataloged Items",val:totalItems,                        color:"var(--gold)"},
          {label:"Total Qty",      val:totalQty.toLocaleString(),          color:"var(--text)"},
          {label:"Est. Value",     val:totalValue>0?"$"+totalValue.toLocaleString("en-US",{maximumFractionDigits:0}):"—",color:"var(--green)"},
          {label:"With Photos",   val:withPhotos,                          color:"var(--text)"},
          {label:"Shared",         val:listed,                            color:"var(--blue)"},
          {label:"In Stock",       val:inStock,                           color:"var(--text)"},
        ].map(s=>(
          <div key={s.label} style={{...card,textAlign:"center",marginBottom:0,padding:14}}>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"'Playfair Display',serif",color:s.color}}>{s.val}</div>
            <div style={{fontSize:10,color:"var(--faint)",marginTop:3,textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {topCats.length>0&&(
        <div style={card}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Inventory by Category</div>
          {topCats.map(([cat,n])=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:130,fontSize:12,color:"var(--faint)",flexShrink:0}}>{CAT_LABELS[cat]||cat}</div>
              <div style={{flex:1,height:6,background:"var(--white)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(totalItems>0?n/totalItems*100:0)+"%",background:"var(--gold)",borderRadius:3,transition:"width .4s"}}/>
              </div>
              <div style={{fontSize:12,fontWeight:700,width:30,textAlign:"right",flexShrink:0}}>{n}</div>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Asset Management Checklist</div>
        {[
          {label:"QR Code Labels",       done:true,         note:"Every item gets a scannable label for instant lookup"},
          {label:"Photo Documentation",  done:withPhotos>0, note:`${withPhotos} of ${totalItems} items have photos`},
          {label:"Location Tracking",    done:items.some(i=>i.location), note:"Items tracked by storage location"},
          {label:"Condition Records",    done:true,         note:"Each item's condition documented for maintenance planning"},
          {label:"Backstage Exchange",   done:listed>0,     note:listed>0?`${listed} items shared with neighboring programs`:"Enable to share with district schools"},
        ].map(row=>(
          <div key={row.label} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:18,flexShrink:0}}>{row.done?"✅":"○"}</div>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{row.label}</div>
              <div style={{fontSize:11,color:"var(--faint)",marginTop:1}}>{row.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{fontSize:11,color:"var(--faint)",fontStyle:"italic",marginTop:12,lineHeight:1.5}}>
        Click "Generate &amp; Print Report" for a fully formatted print-ready version suitable for principals, arts directors, or board presentations.
      </div>
    </div>
  );
}
function SourceModal({initial, saving, onSave, onCancel}){
  const blank = {name:"",source_type:"grant",funder:"",total_amount:"",fiscal_year:"",start_date:"",end_date:"",notes:"",is_active:true};
  const[f,setF] = useState(initial||blank);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));
  const inp = {background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"7px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"};
  return(
    <Modal title={(initial?"Edit":"Add")+" Funding Source"} onClose={onCancel}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Source Name *</label>
              <input style={inp} value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="e.g. Prop 28, Title IV-A, Booster Club" autoFocus/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Type</label>
              <select style={inp} value={f.source_type} onChange={e=>upd("source_type",e.target.value)}>
                {FUND_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Funder / Organization</label>
              <input style={inp} value={f.funder} onChange={e=>upd("funder",e.target.value)} placeholder="e.g. CA Dept of Education"/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Total Amount ($)</label>
              <input style={inp} type="number" min="0" step="0.01" value={f.total_amount} onChange={e=>upd("total_amount",e.target.value)} placeholder="0.00"/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Fiscal Year</label>
              <input style={inp} value={f.fiscal_year} onChange={e=>upd("fiscal_year",e.target.value)} placeholder="e.g. 2024-25"/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Start Date</label>
              <input style={inp} type="date" value={f.start_date||""} onChange={e=>upd("start_date",e.target.value||null)}/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>End Date</label>
              <input style={inp} type="date" value={f.end_date||""} onChange={e=>upd("end_date",e.target.value||null)}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Notes</label>
              <textarea style={{...inp,minHeight:60,resize:"vertical"}} value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Any relevant details about this funding source…"/>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" id="is_active" checked={f.is_active} onChange={e=>upd("is_active",e.target.checked)}/>
              <label htmlFor="is_active" style={{fontSize:13,color:"var(--faint)",cursor:"pointer"}}>Active source (shows in spending tracker)</label>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)"}}>
            <button className="btn btn-o" onClick={onCancel}>Cancel</button>
            <button className="btn btn-g" disabled={!f.name.trim()||saving} style={{opacity:!f.name.trim()||saving?0.45:1}}
              onClick={()=>{ if(f.name.trim()) onSave({...f, total_amount:parseFloat(f.total_amount)||null, start_date:f.start_date||null, end_date:f.end_date||null}); }}>
              {saving?"Saving…":initial?"Save Changes":"Add Source"}
            </button>
          </div>
      </div>
    </Modal>
  );
}

function ExpModal({initial, sources, saving, onSave, onCancel}){
  const activeSources = sources.filter(s=>s.is_active);
  const blank = {funding_source_id:activeSources[0]?.id||"",amount:"",category:"",description:"",vendor:"",purchase_date:new Date().toISOString().slice(0,10)};
  const[f,setF] = useState(initial||blank);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));
  const inp = {background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"7px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"};
  return(
    <Modal title={(initial?"Edit":"Add")+" Expenditure"} onClose={onCancel}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Funding Source *</label>
              <select style={inp} value={f.funding_source_id} onChange={e=>upd("funding_source_id",e.target.value)}>
                <option value="">Select a source…</option>
                {activeSources.map(s=>{
                  const ft=FUND_TYPES.find(t=>t.id===s.source_type)||FUND_TYPES[FUND_TYPES.length-1];
                  return <option key={s.id} value={s.id}>{ft.icon} {s.name}{s.fiscal_year?" (FY "+s.fiscal_year+")":""}</option>;
                })}
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Description *</label>
              <input style={inp} value={f.description} onChange={e=>upd("description",e.target.value)} placeholder="What was purchased or paid for?"/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Amount ($) *</label>
              <input style={inp} type="number" min="0" step="0.01" value={f.amount} onChange={e=>upd("amount",e.target.value)} placeholder="0.00"/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Date</label>
              <input style={inp} type="date" value={f.purchase_date||""} onChange={e=>upd("purchase_date",e.target.value||null)}/>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Category</label>
              <select style={inp} value={f.category||""} onChange={e=>upd("category",e.target.value)}>
                <option value="">Select…</option>
                {FUND_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:"var(--faint)",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4}}>Vendor / Payee</label>
              <input style={inp} value={f.vendor||""} onChange={e=>upd("vendor",e.target.value)} placeholder="Store, company, or person"/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)"}}>
            <button className="btn btn-o" onClick={onCancel}>Cancel</button>
            <button className="btn btn-g"
              disabled={!f.funding_source_id||!f.description.trim()||!f.amount||saving}
              style={{opacity:!f.funding_source_id||!f.description.trim()||!f.amount||saving?0.45:1}}
              onClick={()=>{ if(f.funding_source_id&&f.description.trim()&&f.amount) onSave({...f, amount:parseFloat(f.amount), purchase_date:f.purchase_date||null}); }}>
              {saving?"Saving…":initial?"Save Changes":"Add Expenditure"}
            </button>
          </div>
      </div>
    </Modal>
  );
}
