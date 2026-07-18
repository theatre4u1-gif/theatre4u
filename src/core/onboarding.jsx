// ONBOARDING OVERLAY — extracted from App.jsx (modularization).
import React, { useState } from "react";
import { APP_NAME } from "./config.js";
import { SB } from "./supabase.js";
import { getVertical, getTerm, getExchangeName } from "../lib/verticals.js";
import { getPointsName } from "./helpers.js";

export function OnboardingOverlay({ step, org, userId, items, onUpdate, onNav }) {
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
      director_title: (org?.vertical && org.vertical !== "theatre") ? "Director" : "Theatre Director",
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
          <div style={{fontSize:52, marginBottom:12}}>{getVertical(org?.vertical).icon}</div>
          <h2 style={{fontFamily:"'Playfair Display',serif", fontSize:26, marginBottom:8, color:"var(--ink,#1a0f00)"}}>
            Welcome to {APP_NAME}
          </h2>
          <p style={{fontSize:14, color:"var(--muted,#685f76)", lineHeight:1.7, marginBottom:4}}>
            Your inventory command center is ready. Let's get started — pick how you'd like to begin:
          </p>
        </div>
        <div style={bod}>
          <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:20}}>
            {[
              ["📝", "Add items one by one",    "Start with a few key pieces from your inventory.",    "inventory"],
              ["📥", "Import from a spreadsheet","Already have a list? Upload a CSV and we'll map the columns.","inventory-csv"],
              ["🎪", "Load sample data",         "See how the app looks with a full inventory loaded in.",   "sample"],
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
                placeholder="A line or two about what your program does…"/>
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
            {org?.name ? (org.name+" now has") : "You now have"} {items.length} item{items.length!==1?"s":""} in {APP_NAME}. Here's what to do next:
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
            Want to connect with other {getVertical(org?.vertical).label.toLowerCase()} programs?
          </h2>
          <p style={{fontSize:13, color:"var(--muted,#685f76)", lineHeight:1.65, marginBottom:0}}>
            {APP_NAME} has two optional community features. Both are completely opt-in — nothing is shared until you say so.
          </p>
        </div>
        <div style={bod}>
          {[
            {
              key:  "community",
              ico:  "🎭",
              title:"Community Board",
              desc: `Post your upcoming ${getTerm(org?.vertical,'productions').toLowerCase()}, share notices, and see what other programs are up to nearby. Your program name and city appear on posts you make. Your inventory stays private.`,
              val:  joinCommunity,
              set:  setJoinCommunity,
            },
            {
              key:  "exchange",
              ico:  "🏪",
              title:getExchangeName(org?.vertical),
              desc: `Browse items other programs are renting, selling, or loaning. List your own items to earn revenue or ${getPointsName(org?.vertical)}. You control exactly which items appear — everything else stays invisible.`,
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