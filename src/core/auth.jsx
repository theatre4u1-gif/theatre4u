import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { EM } from "./messages.js";
import { CSS } from "./styles.js";
import { APP_NAME, IS_ARTSTRACKER } from "./config.js";
import { LegalModal } from "./ui.jsx";
import { TERMS_CONTENT, PRIVACY_CONTENT } from "./legal.js";
import { authErrKey, getRefCode, isDemoMode } from "./helpers.js";
import { BG, usp } from "../lib/backgrounds.js";
import { VERTICALS_LIST } from "../lib/verticals.js";

// Auth screens (sign-in / sign-up overlay + full-page login) — extracted from App.jsx.

export function AuthOverlay({onAuth, pendingInvite, inviteInfo}){
  const[visible,setVisible]=useState(false);
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState(()=>{ try { return sessionStorage.getItem("t4u_prefill_email")||""; } catch{return "";} });
  const[pass,setPass]=useState("");
  const[orgName,setOrgName]=useState(()=>{ try { return sessionStorage.getItem("t4u_prefill_org")||""; } catch{return "";} });
  const[ownerName,setOwnerName]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[done,setDone]=useState(false);
  const[legal,setLegal]=useState(null);
  const[showPass,setShowPass]=useState(false);
  const[ageConfirmed,setAgeConfirmed]=useState(false);
  const[vertical,setVertical]=useState("theatre");

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
    if(mode==="signup"&&!ageConfirmed){setErr("Please confirm you are 13 years of age or older.");return;}
    setLoading(true);

      // ── Demo mode fast-path ───────────────────────────────────────────────
      if(isDemoMode()){
        const demoUser = { id:"demo-user-id", email, created_at:new Date().toISOString() };
        if(mode==="signup"){
          if(!orgName.trim()){setErr("Please enter your organization name.");setLoading(false);return;}
          await SB.from("orgs").upsert({
            id:demoUser.id, name:orgName, email,
            type:"", phone:"", location:"", bio:"",
            temp_pro:true, onboarding_step:0,
            plan:"pro", created_at:new Date().toISOString(),
          },{onConflict:"id",ignoreDuplicates:false});
          if(window.__demoStore) window.__demoStore.seedItems();
        }
        onAuth(demoUser);
        close();
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

    try{
      if(mode==="signup"){
        if(!ownerName.trim()){setErr("Please enter your name.");setLoading(false);return;}
        if(!orgName.trim()){setErr("Please enter your organization name.");setLoading(false);return;}
        // All signups during beta get temp_pro — no access code needed
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
          // Team members arrive via invite.html — they join an existing org, no new org needed
          const isTeamMember = data.user.user_metadata?.is_team_member === true;
          if (isTeamMember) {
            const pendingCode = localStorage.getItem("t4u_pending_join_code");
            if (pendingCode) {
              localStorage.removeItem("t4u_pending_join_code");
              await SB.rpc("accept_team_invite_by_code", { p_code: pendingCode }).catch(()=>{});
            }
            setDone(true);
            return;
          }
          // Track signup conversion with UTM attribution
          const _sid = window.__t4u_sid || sessionStorage.getItem("t4u_sid") || null;
          const _utm = window.__t4u_utm || JSON.parse(sessionStorage.getItem("t4u_utm")||"{}");
          await SB.from("signup_events").insert({
            session_id: _sid, org_id: data.user.id,
            utm_source: _utm.source||null, utm_medium: _utm.medium||null, utm_campaign: _utm.campaign||null,
            referrer: document.referrer||null
          }).then(()=>{}).catch(()=>{}); // fire and forget
          await SB.from("orgs").upsert({
            id:data.user.id, name:orgName, email, director_name: ownerName.trim()||null,
            type:"", phone:"", location:"", bio:"",
            vertical: vertical, verticals_enabled: [vertical],
            signup_domain: (typeof window!=="undefined" && window.location && window.location.hostname.includes("artstracker")) ? "artstracker.org" : "theatre4u.org",
            // All beta signups get temp_pro — full Pro access during beta period
            temp_pro: true,
            temp_pro_granted_at: new Date().toISOString(),
            temp_pro_note: "Beta signup — auto-granted",
          },{onConflict:"id",ignoreDuplicates:false});
          // Notify admin of new signup — called directly from app to avoid pg_net timeout
          try {
            fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/signup-notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                org_id:       data.user.id,
                org_email:    email,
                is_team_member: false,
              }),
            }).catch(()=>{}); // fire and forget — never block signup
          } catch(e) {}

          // Look up referrer by ref code and link them
          const refCode = getRefCode();
          if (refCode) {
            const { data: referrer } = await SB.from("orgs")
              .select("id").eq("referral_code", refCode).single();
            if (referrer?.id && referrer.id !== data.user.id) {
              await SB.from("orgs").update({ referred_by_org: referrer.id })
                .eq("id", data.user.id);
              // Award 50 Stage Points to referrer immediately
              await SB.rpc("award_referral_points", { p_new_org_id: data.user.id });
              try { sessionStorage.removeItem("t4u_ref"); } catch(e) {}
            }
          }
          // Auto-generate label prefix
          try {
            const { data: pfxData } = await SB.rpc("generate_label_prefix", { p_name: orgName });
            if (pfxData) await SB.from("orgs").update({ label_prefix: pfxData }).eq("id", data.user.id);
          } catch(e) { /* non-fatal */ }
          // Clear any demo pre-fill data
          try { sessionStorage.removeItem("t4u_prefill_org"); sessionStorage.removeItem("t4u_prefill_email"); } catch(e) {}
          // Process any pending join code (user arrived via ?code=XYZ before signing up)
          const pendingCode = localStorage.getItem("t4u_pending_join_code");
          if (pendingCode) {
            localStorage.removeItem("t4u_pending_join_code");
            try {
              await SB.rpc("accept_team_invite_by_code", { p_code: pendingCode });
            } catch(e) { /* non-fatal */ }
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
        // Track login — one consistent path for owners AND members (see record_login RPC).
        // Stamps last_seen on the owner's org and every org the user is a member of, and logs
        // a login_event, so districts / multi-member programs are counted correctly.
        try {
          const sid = window.__t4u_sid || sessionStorage.getItem("t4u_sid") || "";
          await SB.rpc("record_login", { p_session: sid, p_user_agent: navigator.userAgent, p_referrer: document.referrer || null, p_utm_source: window.__t4u_utm?.source || null });
        } catch(_) {}
        onAuth(data.user);
        close();
      }
    }catch(e){const k=authErrKey(e.message);setErr(k?EM[k].body:EM.generic.body);}
    setLoading(false);
  };

  const resetPass=async()=>{
    if(!email){setErr("Enter your email above first.");return;}
    const{error:re}=await SB.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
    if(re){setErr(EM.resetPass.body);return;}
    setErr("✓ Password reset email sent — check your inbox.");
  };

  const googleSignIn=async()=>{
    setErr("");
    if(isDemoMode()){setErr("Google sign-in isn't available in the demo. Use the demo button instead.");return;}
    try{ sessionStorage.setItem("t4u_oauth_flow","1"); }catch(e){}
    const{error}=await SB.auth.signInWithOAuth({
      provider:"google",
      options:{
        redirectTo: window.location.origin,
        // Always show Google's account picker — teachers often share computers
        // and Google otherwise silently reuses the remembered account.
        queryParams:{ prompt:"select_account" },
      },
    });
    if(error){ setErr("Couldn't start Google sign-in. Please try again."); }
    // On success the browser redirects to Google — nothing more to do here.
  };

  const overlayStyle={position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"};
  const cardStyle={background:"#15121b",border:"1px solid #282333",borderRadius:16,width:"100%",maxWidth:440,padding:"36px 36px 32px",boxShadow:"0 16px 56px rgba(0,0,0,.6)",animation:"lp-rise .2s ease",fontFamily:"'DM Sans',sans-serif",color:"#ede8df",maxHeight:"92vh",overflowY:"auto"};
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
            <div style={{fontSize:12,color:"#685f76",marginTop:3}}>{mode==="login"?("Sign in to your "+APP_NAME+" account"):("Create your free "+APP_NAME+" account")}</div>
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
                  {inviteInfo.district_name?<>Join <strong style={{color:"#ede8df"}}>{inviteInfo.district_name}</strong> on {APP_NAME}.</>:"You've been invited to join a district on Theatre4u™."}
                  {inviteInfo.school_name&&<> School: <strong style={{color:"#ede8df"}}>{inviteInfo.school_name}</strong>.</>}
                </div>
              </div>
            </div>
            <div style={{background:"rgba(0,0,0,.25)",borderRadius:7,padding:"9px 11px",fontSize:12,color:"#9b93a8",lineHeight:1.6}}>
              <strong style={{color:"#ede8df"}}>Already have a {APP_NAME} account?</strong> Sign in below — your existing inventory and data will be linked to the district automatically.<br/>
              <strong style={{color:"#ede8df"}}>New to {APP_NAME}?</strong> Switch to Create Account to set up a new school account.
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
        {/* Continue with Google */}
        <button onClick={googleSignIn} disabled={loading}
          style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            background:"#fff",color:"#1f1f1f",border:"1px solid #282333",borderRadius:6,
            padding:"11px",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",
            fontFamily:"'DM Sans',sans-serif",marginBottom:16,opacity:loading?.7:1}}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{flex:1,height:1,background:"#282333"}}/>
          <span style={{fontSize:11,color:"#685f76",textTransform:"uppercase",letterSpacing:1}}>or</span>
          <div style={{flex:1,height:1,background:"#282333"}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {mode==="signup"&&(<>
            {IS_ARTSTRACKER&&(
              <div><label style={labelStyle}>Program Type *</label>
                <select value={vertical} onChange={e=>setVertical(e.target.value)} style={inputStyle} onFocus={e=>e.target.style.borderColor="#d4a843"} onBlur={e=>e.target.style.borderColor="#282333"}>
                  {VERTICALS_LIST.map(v=><option key={v.id} value={v.id}>{v.icon} {v.label}</option>)}
                </select>
              </div>
            )}
            <div><label style={labelStyle}>Your Name *</label>
              <input value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="e.g. Jane Smith" style={inputStyle} onFocus={e=>e.target.style.borderColor="#d4a843"} onBlur={e=>e.target.style.borderColor="#282333"}/>
            </div>
            <div><label style={labelStyle}>Program / Organization Name *</label>
              <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Lincoln High School Drama" style={inputStyle} onFocus={e=>e.target.style.borderColor="#d4a843"} onBlur={e=>e.target.style.borderColor="#282333"}/>
            </div>
            {/* Beta access notice */}
            <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.25)",
              borderRadius:9,padding:"12px 14px"}}>
              <div style={{fontWeight:700,fontSize:13,color:"#d4a843",marginBottom:6}}>
                ⭐ Free Pro Access During Beta
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",lineHeight:1.7}}>
                All programs that sign up during {APP_NAME}'s beta phase get full Pro access at no charge.
                When {APP_NAME} launches, beta programs that have added 25+ items and shared feedback
                will receive a{" "}
                <strong style={{color:"rgba(255,255,255,.85)"}}>founding member rate of $9.99/month</strong>
                {" "}— instead of the standard $15 — locked in for as long as you subscribe.
              </div>
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
        {mode==="signup"&&(
          <label style={{display:"flex",alignItems:"flex-start",gap:8,marginTop:14,cursor:"pointer"}}>
            <input type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}
              style={{marginTop:2,accentColor:"#d4a843",flexShrink:0,width:15,height:15}}/>
            <span style={{fontSize:12,color:"rgba(255,255,255,.55)",lineHeight:1.5}}>
              I confirm I am <strong style={{color:"rgba(255,255,255,.75)"}}>13 years of age or older</strong>.
              If you are under 13, please have a parent or guardian create this account on your behalf.
            </span>
          </label>
        )}
        {mode==="signup"&&<p style={{fontSize:11,color:"rgba(255,255,255,.4)",textAlign:"center",marginTop:16,lineHeight:1.6}}>
          By creating an account you agree to our{" "}
          <span style={{color:"var(--goldink)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setLegal("terms")}>Terms of Service</span>
          {" "}and{" "}
          <span style={{color:"var(--goldink)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setLegal("privacy")}>Privacy Policy</span>,
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
            Full Pro access during beta · No credit card required · Cancel anytime
          </p>
        )}
      </div>
      {legal==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegal(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legal==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegal(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
    </div>
  );
}

// ── Post-OAuth profile completion ─────────────────────────────────────────────
// Shown when a signed-in user (Google sign-in) has no org row, no org_members
// membership, and isn't a team member / facilitator. Collects the same required
// info as normal signup (name, program, vertical on ArtsTracker, 13+ confirm)
// and creates the org exactly like the email/password signup path.
export function GoogleProfileSetup({user, onDone}){
  const[ownerName,setOwnerName]=useState(user?.user_metadata?.full_name||user?.user_metadata?.name||"");
  const[orgName,setOrgName]=useState("");
  const[vertical,setVertical]=useState("theatre");
  const[ageConfirmed,setAgeConfirmed]=useState(false);
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[legal,setLegal]=useState(null);
  const[checkingInvite,setCheckingInvite]=useState(true);

  // A pending team-invite code means this user joins an EXISTING org — no new org.
  useEffect(()=>{
    (async()=>{
      try{
        const pendingCode = localStorage.getItem("t4u_pending_join_code");
        if(pendingCode){
          localStorage.removeItem("t4u_pending_join_code");
          const{error}=await SB.rpc("accept_team_invite_by_code",{p_code:pendingCode});
          if(!error){ onDone(); return; }
        }
      }catch(e){}
      setCheckingInvite(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const submit=async()=>{
    setErr("");
    if(!ownerName.trim()){setErr("Please enter your name.");return;}
    if(!orgName.trim()){setErr("Please enter your program or organization name.");return;}
    if(!ageConfirmed){setErr("Please confirm you are 13 years of age or older.");return;}
    setLoading(true);
    try{
      const email = user?.email || "";
      await SB.from("orgs").upsert({
        id:user.id, name:orgName, email, director_name: ownerName.trim()||null,
        type:"", phone:"", location:"", bio:"",
        vertical: vertical, verticals_enabled: [vertical],
        signup_domain: (typeof window!=="undefined" && window.location && window.location.hostname.includes("artstracker")) ? "artstracker.org" : "theatre4u.org",
        temp_pro: true,
        temp_pro_granted_at: new Date().toISOString(),
        temp_pro_note: "Beta signup — auto-granted (Google sign-in)",
      },{onConflict:"id",ignoreDuplicates:false});
      // Track signup conversion with UTM attribution (same as password signup)
      const _sid = window.__t4u_sid || sessionStorage.getItem("t4u_sid") || null;
      const _utm = window.__t4u_utm || JSON.parse(sessionStorage.getItem("t4u_utm")||"{}");
      await SB.from("signup_events").insert({
        session_id:_sid, org_id:user.id,
        utm_source:_utm.source||null, utm_medium:_utm.medium||null, utm_campaign:_utm.campaign||null,
        referrer:document.referrer||null
      }).then(()=>{}).catch(()=>{});
      // Notify admin of new signup
      try{
        fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/signup-notify",{
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({org_id:user.id, org_email:email, is_team_member:false}),
        }).catch(()=>{});
      }catch(e){}
      // Referral link-up (same as password signup)
      const refCode = getRefCode();
      if(refCode){
        const{data:referrer}=await SB.from("orgs").select("id").eq("referral_code",refCode).single();
        if(referrer?.id && referrer.id!==user.id){
          await SB.from("orgs").update({referred_by_org:referrer.id}).eq("id",user.id);
          await SB.rpc("award_referral_points",{p_new_org_id:user.id});
          try{ sessionStorage.removeItem("t4u_ref"); }catch(e){}
        }
      }
      // Auto-generate label prefix
      try{
        const{data:pfxData}=await SB.rpc("generate_label_prefix",{p_name:orgName});
        if(pfxData) await SB.from("orgs").update({label_prefix:pfxData}).eq("id",user.id);
      }catch(e){ /* non-fatal */ }
      try{ sessionStorage.removeItem("t4u_oauth_flow"); }catch(e){}
      onDone();
    }catch(e){
      console.error("Profile setup failed",e);
      setErr("Something went wrong saving your program. Please try again.");
    }
    setLoading(false);
  };

  const useDifferentAccount=async()=>{ try{ await SB.auth.signOut(); }catch(e){} };

  const overlayStyle={position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"};
  const cardStyle={background:"#15121b",border:"1px solid #282333",borderRadius:16,width:"100%",maxWidth:440,padding:"36px 36px 32px",boxShadow:"0 16px 56px rgba(0,0,0,.6)",fontFamily:"'DM Sans',sans-serif",color:"#ede8df",maxHeight:"92vh",overflowY:"auto"};
  const inputStyle={width:"100%",background:"#110f18",border:"1px solid #282333",borderRadius:6,padding:"10px 12px",color:"#ede8df",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"};
  const labelStyle={fontSize:11,fontWeight:600,color:"#9b93a8",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4};

  if(checkingInvite) return(
    <div style={overlayStyle}><div style={{...cardStyle,textAlign:"center",color:"#9b93a8",fontSize:14}}>One moment…</div></div>
  );

  return(
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#ede8df"}}>Almost there!</div>
        <div style={{fontSize:12.5,color:"#9b93a8",marginTop:4,marginBottom:22,lineHeight:1.6}}>
          You&apos;re signed in as <strong style={{color:"#ede8df"}}>{user?.email}</strong>. Tell us about your program to finish setting up your free {APP_NAME} account.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {IS_ARTSTRACKER&&(
            <div><label style={labelStyle}>Program Type *</label>
              <select value={vertical} onChange={e=>setVertical(e.target.value)} style={inputStyle}>
                {VERTICALS_LIST.map(v=><option key={v.id} value={v.id}>{v.icon} {v.label}</option>)}
              </select>
            </div>
          )}
          <div><label style={labelStyle}>Your Name *</label>
            <input value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="e.g. Jane Smith" style={inputStyle}/>
          </div>
          <div><label style={labelStyle}>Program / Organization Name *</label>
            <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Lincoln High School Drama" style={inputStyle} onKeyDown={e=>e.key==="Enter"&&submit()}/>
          </div>
        </div>
        {err&&<div style={{marginTop:12,padding:"9px 12px",background:"rgba(194,24,91,.1)",border:"1px solid rgba(194,24,91,.25)",borderRadius:7,fontSize:13,color:"#e57373"}}>{err}</div>}
        <label style={{display:"flex",alignItems:"flex-start",gap:8,marginTop:14,cursor:"pointer"}}>
          <input type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}
            style={{marginTop:2,accentColor:"#d4a843",flexShrink:0,width:15,height:15}}/>
          <span style={{fontSize:12,color:"rgba(255,255,255,.55)",lineHeight:1.5}}>
            I confirm I am <strong style={{color:"rgba(255,255,255,.75)"}}>13 years of age or older</strong>.
            If you are under 13, please have a parent or guardian create this account on your behalf.
          </span>
        </label>
        <p style={{fontSize:11,color:"rgba(255,255,255,.4)",textAlign:"center",marginTop:16,lineHeight:1.6}}>
          By continuing you agree to our{" "}
          <span style={{color:"var(--goldink)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setLegal("terms")}>Terms of Service</span>
          {" "}and{" "}
          <span style={{color:"var(--goldink)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setLegal("privacy")}>Privacy Policy</span>,
          including the grant of a perpetual license to content you upload.
        </p>
        <button onClick={submit} disabled={loading} style={{marginTop:12,width:"100%",background:"linear-gradient(135deg,#d4a843,#a37f2c)",color:"#1a0f00",border:"none",borderRadius:6,padding:"12px",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",opacity:loading?.7:1}}>
          {loading?"Setting up…":"Finish Setup →"}
        </button>
        <button onClick={useDifferentAccount} style={{display:"block",margin:"12px auto 0",background:"none",border:"none",color:"#685f76",fontSize:12.5,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textDecoration:"underline"}}>
          Use a different account
        </button>
      </div>
      {legal==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegal(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legal==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegal(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
    </div>
  );
}

export function AuthScreen({onAuth}){
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

      // ── Demo mode fast-path ───────────────────────────────────────────────
      if(isDemoMode()){
        const demoUser = { id:"demo-user-id", email, created_at:new Date().toISOString() };
        if(mode==="signup"){
          if(!orgName.trim()){setErr("Please enter your organization name.");setLoading(false);return;}
          await SB.from("orgs").upsert({
            id:demoUser.id, name:orgName, email,
            type:"", phone:"", location:"", bio:"",
            temp_pro:true, onboarding_step:0,
            plan:"pro", created_at:new Date().toISOString(),
          },{onConflict:"id",ignoreDuplicates:false});
          if(window.__demoStore) window.__demoStore.seedItems();
        }
        onAuth(demoUser);
        close();
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

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
            if(typeof onAuth==="function") onAuth(data.user);
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
    const{error:re}=await SB.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
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
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,color:"var(--goldink)",letterSpacing:1}}>{APP_NAME}</div>
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
          {mode==="signup"&&<p style={{fontSize:12,color:"var(--faint)",textAlign:"center",marginTop:14,lineHeight:1.6}}>Free to start — no credit card needed. By creating an account you agree to our{" "}<span onClick={()=>setLegal("terms")} style={{color:"var(--goldink)",textDecoration:"underline",cursor:"pointer"}}>Terms of Service</span>{" "}and{" "}<span onClick={()=>setLegal("privacy")} style={{color:"var(--goldink)",textDecoration:"underline",cursor:"pointer"}}>Privacy Policy</span>.</p>}
        </div>
        <p style={{textAlign:"center",color:"rgba(255,255,255,.25)",fontSize:12,marginTop:20}}>Theatre4u™ · Artstracker LLC · theatre4u.org</p>
      </div>
      {legal==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegal(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legal==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegal(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
    </div>
  );
}
