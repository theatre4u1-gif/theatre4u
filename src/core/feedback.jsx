import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { APP_NAME } from "./config.js";

// Beta feedback widget — floating trigger + panel. Slated for removal at launch (Sept 1, 2026).
export function FeedbackWidget({ userId, orgName, isLeadingPlayer }) {
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
                <div style={{fontSize:13,color:"var(--muted)",marginTop:4}}>Your feedback is making {APP_NAME} better.</div>
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
                    placeholder="e.g. items or supplies you're looking for…"
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
