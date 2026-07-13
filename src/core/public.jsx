// PUBLIC / UNAUTHENTICATED PAGES — extracted from App.jsx (modularization).
// LandingPage, PublicOrgPage, PublicItemPage (+ UnassignedLabelAssigner, internal).
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { APP_NAME, LOGO_ICON, LOGO_FULL, IS_ARTSTRACKER } from "./config.js";
import { getRefCode } from "./helpers.js";
import { CAT_MAP } from "./inventory.js";
import { QR } from "./qr.js";
import { CSS } from "./styles.js";
import { usp } from "../lib/backgrounds.js";

// ── Visit tracking (used by the public landing page) ─────────────────────────
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
        ref_code:     getRefCode(),
        ...extra
      })
    }).catch(() => {});
  } catch(e) {}
}

export function LandingPage({onSignIn, onSignUp, onTakeTour=null}){
  const[scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",h,{passive:true});
    trackVisit("landing");
    return()=>window.removeEventListener("scroll",h);
  },[]);
  // Editable marketing content (site_content) + brand theme (site_theme) for this door — falls back to defaults if unset.
  const[content,setContent]=useState({});
  const[theme,setTheme]=useState({});
  useEffect(()=>{
    const vertical = IS_ARTSTRACKER ? "artstracker" : "theatre4u";
    SB.from("site_content").select("ckey,cvalue").eq("vertical",vertical)
      .then(({data})=>{ if(data){ const m={}; data.forEach(r=>{ m[r.ckey]=r.cvalue||""; }); setContent(m); } })
      .catch(()=>{});
    SB.from("site_theme").select("theme").eq("vertical",vertical).maybeSingle()
      .then(({data})=>{ if(data&&data.theme) setTheme(data.theme); })
      .catch(()=>{});
  },[]);
  const c=(k,fb)=>{ const v=content[k]; return (v&&String(v).trim())?v:fb; };
  // Brand color overrides — only set the CSS var when the admin has published a value; else the defaults apply.
  const themeVars={};
  if(theme.accent&&String(theme.accent).trim()) themeVars["--gold"]=theme.accent;
  if(theme.primary&&String(theme.primary).trim()) themeVars["--goldd"]=theme.primary;
  // Landing section order + visibility (set in the admin Content editor → Page layout).
  const DEFAULT_SECTION_ORDER=["hero","social","features","howitworks","pricing","finalcta","story"];
  const savedOrder=(content["landing.layout.order"]||"").split(",").map(s=>s.trim()).filter(Boolean);
  const sectionOrder=[...savedOrder.filter(id=>DEFAULT_SECTION_ORDER.includes(id)), ...DEFAULT_SECTION_ORDER.filter(id=>!savedOrder.includes(id))];
  const ord=(id)=>{const i=sectionOrder.indexOf(id);return i<0?90:i;};
  const vis=(id)=>content["landing.section."+id+".show"]!=="0";

  const features = IS_ARTSTRACKER ? [
    {icon:"📦",title:"Inventory That Actually Works",desc:"Catalog every costume, instrument, prop, light, art supply, uniform, or piece of equipment your program owns. Add photos, tag by show or unit, print QR labels for storage. Always know exactly what you have and where it lives."},
    {icon:"🎭",title:"Productions & Events",desc:"Create a folder for each show, concert, exhibition, or event. Pull items straight from your inventory, track what's checked out, and see what each one still needs."},
    {icon:"📱",title:"Mobile-Ready",desc:"Add items by taking a photo. Scan QR labels with your phone's camera — instantly. Works on iPhone and Android — no app store required."},
    {icon:"💰",title:"Funding Tracker",desc:"Track grants, district allocations, booster funds, and donations. Log expenditures against each source, generate reports, and export to CSV. California programs can track Prop 28 spending here too."},
    {icon:"🔄",title:"The Exchange",desc:"Opt in to share selected items with other programs — across theatre, music, dance, and art. You choose exactly what to post; your full inventory stays private. Browse what others near you have, then rent, buy, or borrow."},
    {icon:"🎪",title:"Community Board",desc:"Post calls and auditions, share upcoming dates, upload event photos, and find what you need. A regional bulletin board for the whole arts community."},
  ] : [
    {icon:"📦",title:"Inventory That Actually Works",desc:"Catalog every costume, prop, light, and sound item your program owns. Add photos, tag by production, print QR labels for storage bins. Always know exactly what you have and where it lives."},
    {icon:"🎭",title:"Productions Tracker",desc:"Create a folder for each show. Assign items from your inventory, track what's checked out, and see at a glance what every production needs from wishlist to opening night."},
    {icon:"📱",title:"Mobile-Ready Backstage",desc:"Add items by taking a photo. Scan QR labels with your phone's camera — the iPhone Camera app reads Theatre4u labels instantly. Available on iPhone and Android — no app store required."},
    {icon:"💰",title:"Funding Tracker",desc:"Track grants, district allocations, booster funds, earned income, and donations. Log expenditures against each source, generate reports, and export to CSV — for your records."},
    {icon:"🏪",title:"Backstage Exchange",desc:"When you're ready, opt in to share selected items with other programs. You choose exactly which items to post — your full inventory stays completely private. Browse what others near you have available, rent, purchase, or arrange a loan."},
    {icon:"🎪",title:"Community Board",desc:"Post audition notices, share upcoming show dates, upload production photos, and find items you need. A regional bulletin board for the performing arts community."},
  ];

  // ArtsTracker door renames: "Backstage Exchange" → "The Exchange", "Stage Points" → "ArtsPoints".
  const XCHG = IS_ARTSTRACKER ? "The Exchange" : "Backstage Exchange";
  const PTS  = IS_ARTSTRACKER ? "ArtsPoints" : "Stage Points";
  const singlePlans=[
    {name:"Free",price:"$0",period:"forever",color:"rgba(255,255,255,.15)",textColor:"rgba(255,255,255,.7)",features:["Up to 25 inventory items","QR labels & photos","Productions tracking","Browse "+XCHG,"Community Board"],cta:"Get Started",primary:false},
    {name:"Pro",price:"$15",period:"/month",annual:"$150/year",color:"linear-gradient(135deg,var(--gold),var(--goldd))",textColor:"#1a0f00",features:["Unlimited inventory","Full "+XCHG+" access",PTS,"Reports & CSV export","Funding Tracker","Mobile app","Messages & requests"],cta:"Start Pro",primary:true},
    {name:"District",price:"$49",period:"/month",annual:"$500/year",color:"linear-gradient(135deg,#1565c0,#0d47a1)",textColor:"#fff",features:["Everything in Pro","Up to 6 school sites","District dashboard","Shared "+XCHG,"District funding rollup","Email support"],cta:"Start District",primary:false},
  ];
  const atPlans=[
    {name:"ArtsTracker Pro",price:"$59",period:"/month",annual:"$590/year",color:"linear-gradient(135deg,#841C56,#4C1035)",textColor:"#fff",features:["Every department — Theatre, Music, Dance, Art & Organizations","Unlimited inventory in each department","Full Exchange access + ArtsPoints","Per-department funding & storage","Reports, CSV export & mobile"],cta:"Go All-Departments",primary:false},
    {name:"ArtsTracker District",price:"from $199",period:"/month",annual:"annual plans available",color:"linear-gradient(135deg,#4C1035,#2b0a1e)",textColor:"#fff",features:["All departments at every school","S — $199/mo (up to 6 schools)","M — $399/mo (up to 15) · L — $699/mo (up to 30)","District dashboards & funding rollup","Purchase orders accepted · Email support"],cta:"Start District",primary:false},
  ];
  // ArtsTracker door shows both tracks; Theatre4u door keeps the single-department ladder.
  const planGroups = IS_ARTSTRACKER
    ? [{label:"One department — pick the program you run", plans:singlePlans},
       {label:"All departments — the full ArtsTracker", plans:atPlans}]
    : [{label:null, plans:singlePlans}];

  const steps = IS_ARTSTRACKER ? [
    {n:"1",title:"Create your free account",desc:"Sign up in 60 seconds. No credit card needed. Your first 25 items are always free."},
    {n:"2",title:"Build your inventory",desc:"Photograph costumes, instruments, props, or supplies on your phone, or upload from your computer. Add name, category, condition, and location. Print QR labels."},
    {n:"3",title:"Track your shows, concerts & events",desc:"Create a folder and pull items straight from your inventory. See what's assigned, checked out, and still needed."},
    {n:"4",title:"Optionally join the Exchange",desc:"Share items for rent, loan, or sale, and browse what other programs near you have available."},
  ] : [
    {n:"1",title:"Create your free account",desc:"Sign up in 60 seconds. No credit card needed. Your first 25 items are always free."},
    {n:"2",title:"Build your inventory",desc:"Take photos on your phone or upload from your computer. Add name, category, condition, and location. Print QR labels for bins and racks."},
    {n:"3",title:"Track your productions",desc:"Create a show folder and pull items straight from your inventory. See what's assigned, what's checked out, and what you still need."},
    {n:"4",title:"Optionally join Backstage Exchange",desc:"When you're ready, opt in to Backstage Exchange. Post selected items for rent, loan, or sale. Browse what other programs near you have available."},
  ];

  return(<div style={{background:"var(--ink)",minHeight:"100vh",color:"var(--linen)",fontFamily:"'DM Sans',sans-serif",...themeVars}}>
    
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

    {/* ── Reorderable / hideable sections (order + visibility from admin Page-layout) ── */}
    <div style={{display:"flex",flexDirection:"column"}}>

    {/* ── Hero ── */}
    <div style={{order:ord("hero"),position:"relative",minHeight:"100vh",display:vis("hero")?"flex":"none",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"120px 24px 80px",overflow:"hidden"}}>
      {/* Background image */}
      <img src={c("landing.hero.bg_image", usp("photo-1503095396549-807759245b35",1600,900))} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.2,pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(13,10,8,.7) 0%,rgba(13,10,8,.5) 50%,rgba(13,10,8,.95) 100%)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,maxWidth:760}}>
        <div style={{position:"relative",display:"flex",justifyContent:"center",alignItems:"center",margin:"0 auto 56px",minHeight:210}}>
          <div aria-hidden="true" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(780px,97vw)",height:300,borderRadius:"50%",pointerEvents:"none",background:"radial-gradient(ellipse at 50% 50%, rgba(250,244,232,.97) 0%, rgba(249,242,227,.95) 70%, rgba(243,221,165,.45) 82%, rgba(234,193,108,.15) 89%, transparent 94%)",filter:"blur(2px)"}}/>
          <img src={LOGO_FULL} alt={APP_NAME} style={{position:"relative",zIndex:1,width:"min(520px,88vw)",height:"auto",display:"block"}}/>
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"4px 14px",background:"rgba(212,168,67,.15)",border:"1px solid rgba(212,168,67,.3)",borderRadius:20,fontSize:12,fontWeight:700,color:"var(--gold)",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>
          {c("landing.hero.eyebrow", IS_ARTSTRACKER ? "🎨 The Platform for Arts & Activity Programs" : "🎭 The Platform for Theatre Programs")}
        </div>
        {/* Announcement (beta) ribbon — editable in the admin Content editor; clear the "Show" toggle to hide it (e.g. at Sept 1 launch). */}
        {content["landing.announcement.show"]!=="0" && (
        <div style={{marginBottom:20}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:8,padding:"7px 18px",background:"rgba(76,175,80,.13)",border:"1px solid rgba(76,175,80,.4)",borderRadius:22,fontSize:13.5,fontWeight:700,color:"#82d68c"}}>
            {c("landing.announcement.text", "⭐ Free during our beta — paid plans begin September 1")}
          </span>
        </div>
        )}
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(42px,7vw,76px)",lineHeight:1.05,marginBottom:20,color:"#fff"}}>
          {content["landing.hero.headline"]&&String(content["landing.hero.headline"]).trim()
            ? content["landing.hero.headline"]
            : <>{IS_ARTSTRACKER ? "Everything your program needs —" : "Everything your theatre program needs —"}{" "}<span style={{color:"var(--gold)"}}>in one place</span></>}
        </h1>
        <p style={{fontSize:"clamp(16px,2.5vw,20px)",color:"rgba(255,255,255,.7)",lineHeight:1.7,marginBottom:36,maxWidth:600,margin:"0 auto 36px"}}>
          {c("landing.hero.subhead", IS_ARTSTRACKER ? "For theatre, music, dance, and visual arts — and any program that needs to keep track of what it owns. Know what you have, find what you need, and share with programs near you." : "Know what you have. Find what you need. Built specifically for theatre programs of every size.")}
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={onSignUp} style={{background:"linear-gradient(135deg,var(--gold),var(--goldd))",border:"none",color:"#1a0f00",padding:"14px 32px",borderRadius:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:16,fontWeight:800,boxShadow:"0 4px 24px rgba(212,168,67,.4)"}}>
            {c("landing.hero.cta_label", "Get Started Free — No credit card →")}
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
    <div style={{order:ord("social"),background:"rgba(212,168,67,.08)",borderTop:"1px solid rgba(212,168,67,.15)",borderBottom:"1px solid rgba(212,168,67,.15)",padding:"16px 32px",display:vis("social")?"flex":"none",flexWrap:"wrap",gap:24,justifyContent:"center",alignItems:"center"}}>
      {(IS_ARTSTRACKER ? [["📦","Inventory management"],["🎭","Productions & events"],["📱","Mobile-ready"],["💰","Funding Tracker"],["🔄","The Exchange"],["🎪","Community board"]] : [["📦","Inventory management"],["🎭","Productions tracker"],["📱","Mobile-ready"],["💰","Funding Tracker"],["🏪","Backstage Exchange"],["🎪","Community board"]]).map(([ico,lbl])=>(
        <div key={lbl} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,color:"rgba(255,255,255,.7)"}}>
          <span style={{fontSize:16}}>{ico}</span>{lbl}
        </div>
      ))}
    </div>

    {/* ── Features ── */}
    <div style={{order:ord("features"),display:vis("features")?"block":"none",padding:"80px 32px",maxWidth:1100,margin:"0 auto",width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:52}}>
        <div style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",marginBottom:10}}>What {APP_NAME} does</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(32px,5vw,48px)",color:"#fff",lineHeight:1.15}}>{IS_ARTSTRACKER ? "Built for busy program directors" : "Built for busy drama directors"}</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,.55)",marginTop:12,maxWidth:520,margin:"12px auto 0"}}>{IS_ARTSTRACKER ? "Not a generic inventory app. Built for theatre, music, dance, and visual arts programs — and any group with equipment to track — by someone who has lived it." : "Not a generic inventory app. Built specifically for theatre programs, schools, and the broader performing arts community — by someone who has lived it."}</p>
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
    <div style={{order:ord("howitworks"),display:vis("howitworks")?"block":"none",background:"rgba(255,255,255,.03)",borderTop:"1px solid rgba(255,255,255,.06)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"72px 32px"}}>
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
    <div style={{order:ord("pricing"),display:vis("pricing")?"block":"none",padding:"80px 32px",maxWidth:1000,margin:"0 auto",width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:48}}>
        <div style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",marginBottom:10}}>Simple, honest pricing</div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(28px,4vw,42px)",color:"#fff"}}>Plans for every program</h2>
        <div style={{marginTop:14,marginBottom:4}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:8,padding:"7px 18px",background:"rgba(76,175,80,.13)",border:"1px solid rgba(76,175,80,.4)",borderRadius:22,fontSize:13.5,fontWeight:700,color:"#82d68c"}}>
            ⭐ Everything is free during our beta — these prices begin September 1
          </span>
        </div>
        <p style={{fontSize:14,color:"rgba(255,255,255,.45)",marginTop:10}}>Annual plans available — save up to 2 months free</p>
      </div>
      {planGroups.map((g,gi)=>(
        <div key={gi} style={{marginBottom: gi<planGroups.length-1 ? 44 : 0}}>
          {g.label&&<div style={{textAlign:"center",fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",margin:"0 0 18px"}}>{g.label}</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20,maxWidth:g.plans.length<3?700:undefined,margin:g.plans.length<3?"0 auto":undefined}}>
            {g.plans.map(p=>(
              <div key={p.name} style={{borderRadius:16,overflow:"hidden",border:p.primary?"1px solid rgba(212,168,67,.4)":"1px solid rgba(255,255,255,.1)",position:"relative",boxShadow:p.primary?"0 8px 40px rgba(212,168,67,.2)":"none"}}>
                {p.primary&&<div style={{position:"absolute",top:14,right:14,background:"var(--gold)",color:"#1a0f00",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:10,textTransform:"uppercase",letterSpacing:.5}}>Most Popular</div>}
                <div style={{background:p.color,padding:"28px 24px 20px"}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:p.textColor,marginBottom:4}}>{p.name}</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:42,color:p.textColor}}>{p.price}</span>
                    <span style={{fontSize:14,color:p.textColor,opacity:.7}}>{p.period}</span>
                  </div>
                  {p.annual&&<div style={{fontSize:11,color:p.textColor,opacity:.6,marginTop:3}}>{p.annual}{p.annual.includes("/year")?" · save 2 months":""}</div>}
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
      ))}
      {!IS_ARTSTRACKER&&(
        <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,.45)",marginTop:28}}>
          Also running music, dance, or visual art?{" "}
          <a href="https://artstracker.org" style={{color:"var(--gold)",textDecoration:"underline"}}>ArtsTracker</a>
          {" "}unlocks every department — from $59/month.
        </p>
      )}
    </div>

    {/* ── Final CTA ── */}
    <div style={{order:ord("finalcta"),display:vis("finalcta")?"block":"none",textAlign:"center",padding:"72px 32px 96px",borderTop:"1px solid rgba(255,255,255,.06)"}}>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(28px,5vw,52px)",color:"#fff",marginBottom:16,lineHeight:1.15}}>
        {c("landing.cta.headline1","Ready to get your")}<br/><span style={{color:"var(--gold)"}}>{c("landing.cta.headline2", IS_ARTSTRACKER ? "program organized?" : "theatre organized?")}</span>
      </h2>
      <p style={{fontSize:16,color:"rgba(255,255,255,.5)",marginBottom:32,maxWidth:440,margin:"0 auto 32px"}}>{c("landing.cta.subtext", IS_ARTSTRACKER ? "Join programs already using ArtsTracker to get their inventory under control, track their events, and connect with their community." : "Join theatre programs already using Theatre4u™ to get their inventory under control, track their shows, and connect with their community.")}</p>
      <button onClick={onSignUp} style={{background:"linear-gradient(135deg,var(--gold),var(--goldd))",border:"none",color:"#1a0f00",padding:"16px 40px",borderRadius:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:18,fontWeight:800,boxShadow:"0 4px 32px rgba(212,168,67,.45)"}}>
        {c("landing.cta.button","Start Free — No credit card required →")}
      </button>
      <div style={{marginTop:14,fontSize:12,color:"rgba(255,255,255,.3)"}}>{c("landing.cta.fineprint","Free plan · No contracts · Cancel anytime")}</div>
    </div>

    {/* Our Story */}
    <div style={{order:ord("story"),display:vis("story")?"block":"none",padding:"80px 32px",maxWidth:900,margin:"0 auto",textAlign:"center",width:"100%"}}>
      <div style={{display:"inline-block",padding:"4px 14px",background:"rgba(212,168,67,.1)",border:"1px solid rgba(212,168,67,.2)",borderRadius:20,fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:2,color:"var(--gold)",marginBottom:20}}>
        Our Story
      </div>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(26px,4vw,40px)",marginBottom:24,lineHeight:1.2}}>
        {IS_ARTSTRACKER ? <>Built by an Arts Educator,<br/><span style={{color:"var(--gold)"}}>For Arts Programs.</span></> : <>Built by a Theatre Person,<br/><span style={{color:"var(--gold)"}}>For Theatre People.</span></>}
      </h2>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,textAlign:"left",marginBottom:48}}>
        <div>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)",marginBottom:16}}>
            After spending over 30 years in the theatre and 18+ years in the classroom, I know how quickly props and costumes can seem to explode out of control. As theatre artists moving from one production to the next, we need to know which box that magic wand for Puffs lives in.
          </p>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)"}}>
            And we need a chance to connect with other {IS_ARTSTRACKER ? "programs" : "theatre programs"} that may have something we need, or need something we have. This is why {IS_ARTSTRACKER ? "this platform" : "Theatre4u"} was started.
          </p>
        </div>
        <div>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)",marginBottom:16}}>
            {APP_NAME} keeps track of everything your program owns — and opens the door to a community of programs ready to share resources, collaborate, and support each other.
          </p>
          <p style={{fontSize:16,lineHeight:1.85,color:"rgba(255,255,255,.75)"}}>
            <strong style={{color:"#fff"}}>{IS_ARTSTRACKER ? "The arts are always better together." : "Theatre is always better together."}</strong> This platform was built to help make that connection easier — {IS_ARTSTRACKER ? "from the classroom to the whole community." : "from the wings to the whole community."}
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

    </div>{/* ── end reorderable sections ── */}

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
export function PublicOrgPage({ slug }) {
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


export function PublicItemPage({ itemId }) {
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