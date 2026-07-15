import React, { useState, useEffect } from "react";
import { STRIPE_LINKS, stripeLink, UPGRADE_PLANS } from "./plans.js";
import { APP_NAME, APP_URL, APP_EMAIL } from "./config.js";
import { SB, callEdgeFn } from "./supabase.js";

// Billing UI: upgrade prompt, plans/pricing cards, invoice request — extracted from App.jsx.

export function UpgradePrompt({ reason, onClose, userId=null, userEmail=null }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fdf6ec",border:"1px solid var(--gold)",borderRadius:14,width:"100%",maxWidth:520,padding:28,boxShadow:"0 8px 48px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:36,marginBottom:10}}>⭐</div>
          <h2 style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:22,marginBottom:8}}>Upgrade to Continue</h2>
          <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.6}}>{reason}</p>
        </div>
        <UpgradePlans compact={true} userId={userId} userEmail={userEmail}/>
        <button onClick={onClose} style={{display:"block",margin:"16px auto 0",background:"none",border:"none",color:"var(--faint)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Maybe later</button>
      </div>
    </div>
  );
}

export function InvoiceRequestForm({ orgName, userEmail }) {
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
        body: JSON.stringify({ ...form, brand: APP_NAME.replace(/™/g,""), brandUrl: APP_URL })
      });
      const json = await res.json();
      if(json.success) setDone(true);
      else setErr(json.error || "Something went wrong. Please email "+APP_EMAIL+" directly.");
    } catch(e) {
      setErr("Connection error. Please email "+APP_EMAIL+" directly.");
    }
    setSending(false);
  };

  if(done) return (
    <div style={{marginTop:16,padding:16,background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.3)",borderRadius:10,textAlign:"center"}}>
      <div style={{fontSize:28,marginBottom:8}}>✅</div>
      <div style={{fontWeight:700,fontSize:15,color:"#ede8df",marginBottom:4}}>Invoice request sent!</div>
      <div style={{fontSize:13,color:"#b0a8c0",lineHeight:1.6}}>Check your inbox — we sent a copy to <strong>{form.email}</strong> and will follow up within one business day. Questions? Email <a href={"mailto:"+APP_EMAIL} style={{color:"var(--goldink)"}}>{APP_EMAIL}</a>.</div>
    </div>
  );

  const inputStyle = { width:"100%", background:"#110f18", border:"1px solid #3a3050", borderRadius:6, padding:"9px 11px", color:"#ede8df", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", boxSizing:"border-box" };
  const labelStyle = { fontSize:10.5, fontWeight:700, color:"#b0a8c0", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 };
  // labelStyle defined above with inputStyle

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
            <optgroup label="Single Department">
              <option value="pro">Pro — $15/month or $150/year</option>
              <option value="district">District S — $49/month or $500/year (up to 6 schools)</option>
              <option value="district_m">District M — $99/month or $999/year (up to 15 schools)</option>
              <option value="district_l">District L — $179/month or $1,799/year (up to 30 schools)</option>
            </optgroup>
            <optgroup label="ArtsTracker — All Departments">
              <option value="at_pro">ArtsTracker Pro — $59/month or $590/year (1 school)</option>
              <option value="at_district_s">ArtsTracker District S — $199/month or $1,990/year (up to 6 schools)</option>
              <option value="at_district_m">ArtsTracker District M — $399/month or $3,990/year (up to 15 schools)</option>
              <option value="at_district_l">ArtsTracker District L — $699/month or $6,990/year (up to 30 schools)</option>
            </optgroup>
            <option value="enterprise">Enterprise — Custom pricing (contact us)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Billing Period</label>
          <select style={{...inputStyle,cursor:"pointer"}} value={form.period} onChange={e=>upd("period",e.target.value)}>
            <option value="annual">Annual (best value)</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label style={labelStyle}>Accounts Payable Mailing Address (for PO)</label>
          <input style={inputStyle} value={form.address||""} onChange={e=>upd("address",e.target.value)} placeholder="123 School Blvd, City, CA 90000 (leave blank if paying by check)"/>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label style={labelStyle}>Notes / Special Instructions</label>
          <input style={inputStyle} value={form.notes||""} onChange={e=>upd("notes",e.target.value)} placeholder="Required vendor forms, W-9 request, payment terms, etc."/>
        </div>
      </div>
      {err && <div style={{fontSize:12.5,color:"#e57373",padding:"8px 10px",background:"rgba(194,24,91,.08)",borderRadius:6,border:"1px solid rgba(194,24,91,.2)"}}>{err}</div>}
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-g" style={{flex:1}} onClick={submit} disabled={sending}>
          {sending ? "Sending…" : "✉️ Send Me an Invoice"}
        </button>
        <a href={"mailto:"+APP_EMAIL+"?subject=District Enterprise Inquiry"} className="btn btn-o" style={{flex:1,textDecoration:"none",display:"flex",justifyContent:"center"}}>
          🏫 Enterprise / PO Inquiry
        </a>
      </div>
      <div style={{fontSize:11,color:"var(--faint)",lineHeight:1.6}}>
        We will email a formal invoice to you within one business day. Payment by check payable to <strong>Artstracker LLC</strong>. Net-30 available for districts.
      </div>
    </div>
  );
}

export function UpgradePlans({ compact = false, userId = null, userEmail = null, plan = "free" }) {
  const [billing, setBilling] = useState("monthly");
  const [track, setTrack] = useState("single");
  // Founding members (flagged in orgs.founding_member) get a one-click $9.99 Pro checkout
  // with the forever coupon pre-applied (leak-proof server-side check in the founding-checkout fn).
  const [founding, setFounding] = useState(false);
  const [foundingBusy, setFoundingBusy] = useState(false);
  // Billing begins Sept 1, 2026 (midnight PT). Until then, no standard credit-card charge — the
  // paid subscribe buttons are gated so no beta program can be billed early. The deferred founding
  // claim and Check/PO path stay available. After Sept 1 this auto-lifts and the links work normally.
  const beforeLaunch = Date.now() < Date.parse("2026-09-01T07:00:00Z");
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    SB.from("orgs").select("founding_member").eq("id", userId).single()
      .then(({ data }) => { if (alive && data?.founding_member) setFounding(true); });
    return () => { alive = false; };
  }, [userId]);
  const claimFounding = async () => {
    setFoundingBusy(true);
    try {
      const { data } = await SB.auth.getSession();
      const r = await callEdgeFn("founding-checkout", { org_id: userId, origin: window.location.origin }, data?.session?.access_token);
      if (r?.checkout_url) { window.location.href = r.checkout_url; return; }
      alert(r?.error === "not_founding"
        ? "This program isn't marked as a founding member yet."
        : "Couldn't start founding checkout — please try again or email " + APP_EMAIL + ".");
    } catch (e) { alert("Couldn't start founding checkout — please try again."); }
    setFoundingBusy(false);
  };
  return (
    <div>
      {/* Track toggle — one art area vs all-departments ArtsTracker */}
      <div style={{display:"flex",alignItems:"center",background:"var(--parch)",border:"1px solid var(--border)",borderRadius:8,padding:3,width:"fit-content",margin:compact?"0 0 10px":"0 auto 14px"}}>
        <button onClick={()=>setTrack("single")} style={{background:track==="single"?"var(--gold)":"transparent",color:track==="single"?"#1a0f00":"var(--muted)",border:"none",borderRadius:5,padding:"6px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>One Department</button>
        <button onClick={()=>setTrack("artstracker")} style={{background:track==="artstracker"?"var(--gold)":"transparent",color:track==="artstracker"?"#1a0f00":"var(--muted)",border:"none",borderRadius:5,padding:"6px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>ArtsTracker · All 5</button>
      </div>
      {track==="artstracker" && <p style={{textAlign:compact?"left":"center",margin:"0 0 14px",fontSize:12,color:"var(--muted)"}}>One subscription opens all five departments — Theatre, Music, Dance, Visual Art, and Boosters.</p>}
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
        {UPGRADE_PLANS.filter(p=>(p.track||"single")===track).map(p=>{
          const price   = billing==="annual" ? p.annualPrice : p.monthlyPrice;
          const note    = billing==="annual" ? p.annualNote  : null;
          const link    = stripeLink(STRIPE_LINKS[p.id]?.[billing], userId, userEmail);
          const isFree  = p.id==="free";
          const isCurrentPlan = p.id === (plan || "free");
          return (
            <div key={p.id} style={{border:"1.5px solid "+(p.hot?"var(--gold)":"rgba(212,168,67,.2)"),borderRadius:10,padding:16,background:p.hot?"#241808":"#1e1208",position:"relative",display:"flex",flexDirection:"column",color:"#f0e6d3"}}>
              {p.hot && <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:"var(--gold)",color:"#1a0f00",fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"2px 10px",borderRadius:9,whiteSpace:"nowrap"}}>Most Popular</div>}
              <div style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:16,fontWeight:700,marginBottom:4,color:"#f0e6d3"}}>{p.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:2}}>
                <span style={{fontSize:26,fontWeight:800,color:"var(--goldink)"}}>{price}</span>
                {!isFree && <span style={{fontSize:12,color:"rgba(240,230,211,.5)"}}>{p.per}</span>}
              </div>
              {billing==="annual" && !isFree && p.annualTotal && <div style={{fontSize:11,color:"rgba(240,230,211,.45)",marginBottom:2}}>billed {p.annualTotal}</div>}
              {note && <div style={{fontSize:11,color:"var(--grn,#4caf50)",fontWeight:600,marginBottom:6}}>{note}</div>}
              <div style={{fontSize:13,color:"rgba(240,230,211,.9)",marginBottom:10}}>{p.desc}</div>
              <ul style={{listStyle:"none",padding:0,margin:"0 0 14px",flex:1}}>
                {p.feats.map(f=>(
                  <li key={f} style={{display:"flex",alignItems:"flex-start",gap:6,fontSize:12,color:"rgba(240,230,211,.9)",marginBottom:4}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" style={{flexShrink:0,marginTop:1}}><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrentPlan
                ? <button className="btn btn-full" style={{background:"rgba(212,168,67,.22)",border:"1.5px solid #d4a843",color:"#f5dd9b",cursor:"default",fontWeight:800,fontSize:13.5,letterSpacing:".02em"}} disabled>✓ Current Plan</button>
                : isFree
                ? null
                : (founding && p.id==="pro" && billing!=="invoice")
                ? <button className="btn btn-full btn-g" onClick={claimFounding} disabled={foundingBusy} style={{marginTop:"auto",fontWeight:800,whiteSpace:"normal",textAlign:"center",lineHeight:1.25}}>{foundingBusy?"Starting…":"⭐ Claim your $9.99 founding rate →"}</button>
                : p.id.endsWith("enterprise")
                  ? <a href={"mailto:"+APP_EMAIL+"?subject=Enterprise District Inquiry"} className="btn btn-full" style={{textDecoration:"none",display:"flex",justifyContent:"center",marginTop:"auto",background:"linear-gradient(135deg,#1565c0,#0d47a1)",border:"1px solid rgba(66,133,244,.4)",color:"#fff",fontWeight:700,boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>Contact Us →</a>
                  : billing === "invoice"
                    ? <button className="btn btn-full" onClick={()=>document.getElementById("t4u-invoice-form")?.scrollIntoView({behavior:"smooth",block:"start"})}
                        style={{background:"linear-gradient(135deg,#b8952a,#8a6e1e)",border:"1px solid rgba(212,168,67,.4)",color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        🏛️ Request Invoice →
                      </button>
                    : beforeLaunch
                      ? <button className="btn btn-full" disabled title="Billing begins September 1, 2026" style={{marginTop:"auto",background:"rgba(240,230,211,.08)",border:"1px solid rgba(212,168,67,.35)",color:"rgba(240,230,211,.72)",fontWeight:700,cursor:"default",fontFamily:"inherit",whiteSpace:"normal",textAlign:"center",lineHeight:1.3,fontSize:12.5}}>Free during beta · billing begins Sept 1</button>
                    : (!link || link === "undefined" || link.endsWith("undefined"))
                      ? <a href={"mailto:"+APP_EMAIL+"?subject=District Plan Inquiry"} className="btn btn-full" style={{textDecoration:"none",display:"flex",justifyContent:"center",marginTop:"auto",background:"linear-gradient(135deg,#b8952a,#8a6e1e)",border:"1px solid rgba(212,168,67,.4)",color:"#fff",fontWeight:700,boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>Contact Us →</a>
                      : <a href={link} target="_blank" rel="noreferrer" className={"btn btn-full "+(p.hot?"btn-g":"")} style={{textDecoration:"none",display:"flex",justifyContent:"center",alignItems:"center",marginTop:"auto",whiteSpace:"normal",textAlign:"center",lineHeight:1.25,...(!p.hot?{background:"linear-gradient(135deg,#b8952a,#8a6e1e)",border:"1px solid rgba(212,168,67,.4)",color:"#fff",fontWeight:700,boxShadow:"0 2px 8px rgba(0,0,0,.3)"}:{})}}>
                        {"Get "+p.name.replace("ArtsTracker ","")+(billing==="annual"?" Annual":"")+" →"}
                      </a>
              }
            </div>
          );
        })}
      </div>
      {billing === "invoice" ? (
        <div id="t4u-invoice-form" style={{marginTop:16,background:"rgba(15,10,25,.85)",border:"1.5px solid rgba(212,168,67,.3)",borderRadius:12,padding:20,scrollMarginTop:20}}>
          <div style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:17,fontWeight:700,color:"var(--goldink)",marginBottom:6}}>🏛️ Pay by Check or Purchase Order</div>
          <p style={{fontSize:13,color:"#c8bfd0",lineHeight:1.7,marginBottom:14}}>
            School districts and organizations that cannot pay by credit card can subscribe via check or purchase order.
            We will issue a formal invoice and accept payment by school check, district PO, or ACH transfer.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div style={{background:"#1e1208",border:"1px solid rgba(212,168,67,.3)",borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--goldink)",marginBottom:6}}>Pro Plan</div>
              <div style={{fontSize:22,fontWeight:800,color:"#f0e6d3",marginBottom:2}}>$15<span style={{fontSize:12,color:"rgba(240,230,211,.6)"}}>/month</span></div>
              <div style={{fontSize:11,color:"rgba(240,230,211,.65)",marginBottom:8}}>or $150/year (billed annually)</div>
              <div style={{fontSize:12,color:"rgba(240,230,211,.8)",lineHeight:1.5}}>Unlimited inventory · Backstage Exchange · Funding Tracker · Team sharing</div>
            </div>
            <div style={{background:"#1e1208",border:"1px solid rgba(212,168,67,.3)",borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--goldink)",marginBottom:6}}>District Plan</div>
              <div style={{fontSize:22,fontWeight:800,color:"#f0e6d3",marginBottom:2}}>$49<span style={{fontSize:12,color:"rgba(240,230,211,.6)"}}>/month</span></div>
              <div style={{fontSize:11,color:"rgba(240,230,211,.65)",marginBottom:8}}>or $500/year (billed annually)</div>
              <div style={{fontSize:12,color:"rgba(240,230,211,.8)",lineHeight:1.5}}>All Pro features · Multiple schools · District dashboard</div>
            </div>
          </div>
          <div style={{fontSize:12.5,color:"#b0a8c0",lineHeight:1.7,marginBottom:14}}>
            <strong style={{color:"#ede8df"}}>To get started:</strong> Email us at{" "}
            <a href={"mailto:"+APP_EMAIL+"?subject=Check/PO Subscription Request&body=Hi, I would like to subscribe to "+APP_NAME+" via check/purchase order.%0A%0AOrganization name:%0APlan requested (Pro / District):%0ABilling period (monthly / annual):%0AContact name:%0APO number (if applicable):%0AAccounts payable email:"} style={{color:"var(--goldink)"}}>{APP_EMAIL}</a>
            {" "}with your organization name, plan, and billing period. We will send a formal invoice within one business day.
          </div>
          <InvoiceRequestForm orgName={userId||""} userEmail={userEmail||""} />
          <div style={{marginTop:12,fontSize:11,color:"#9890a8",lineHeight:1.6}}>
            Payment by check should be made payable to <strong style={{color:"#d4c8e0"}}>Artstracker LLC</strong>.
            Purchase orders are accepted from accredited educational institutions.
            Net-30 terms available for district accounts. Questions? Call or email — we respond personally.
          </div>
        </div>
      ) : (
        <p style={{textAlign:compact?"left":"center",marginTop:12,fontSize:11.5,color:"var(--faint)"}}>Start free — your first 25 items are free forever, no credit card · Upgrade when you're ready · Cancel any time</p>
      )}
    </div>
  );
}
