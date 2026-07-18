import React, { useState, useEffect, useCallback } from "react";
import { SB, callEdgeFn } from "./supabase.js";
import { EM } from "./messages.js";
import { Modal, CatCard } from "./ui.jsx";
import { CAT, CATS, CONDS } from "./inventory.js";
import { stripeLink } from "./plans.js";
import { usp } from "../lib/backgrounds.js";
import { getVertical } from "../lib/verticals.js";
import { fmt$ } from "./helpers.js";

// Admin module — building-block forms/widgets. The big admin cluster (AdminHub, etc.) will join this file.

export function AddMemberForm({ onAdd, saving }) {
  const [email, setEmail] = useState("");
  const [role,  setRole]  = useState("crew");
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <input value={email} onChange={e=>setEmail(e.target.value)}
        placeholder="their@email.com"
        style={{flex:1,minWidth:180,padding:"8px 12px",borderRadius:8,
          border:"1px solid var(--border)",background:"var(--white)",
          color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
      <select value={role} onChange={e=>setRole(e.target.value)}
        style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",
          background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
        <option value="co_director">Co-Director</option>
        <option value="stage_manager">Stage Manager</option>
        <option value="crew">Crew</option>
        <option value="house">House</option>
      </select>
      <button onClick={()=>{if(email.trim())onAdd(email.trim(),role);setEmail("");}} disabled={saving||!email.trim()}
        style={{padding:"8px 16px",borderRadius:8,border:"none",background:"var(--gold)",
          color:"#1a0f00",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
          opacity:saving||!email.trim()?.6:1}}>
        Add
      </button>
    </div>
  );
}

export function TransferOwnershipForm({ orgName, onTransfer, saving }) {
  const [email, setEmail] = useState("");
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <input value={email} onChange={e=>setEmail(e.target.value)}
        placeholder="newdirector@school.edu"
        style={{flex:1,minWidth:200,padding:"8px 12px",borderRadius:8,
          border:"1px solid rgba(194,24,91,.3)",background:"var(--white)",
          color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
      <button onClick={()=>{if(email.trim())onTransfer(email.trim());setEmail("");}} disabled={saving||!email.trim()}
        style={{padding:"8px 16px",borderRadius:8,border:"none",
          background:"rgba(194,24,91,.8)",color:"#fff",fontWeight:700,
          fontSize:13,cursor:"pointer",fontFamily:"inherit",
          opacity:saving||!email.trim()?.6:1}}>
        Transfer
      </button>
    </div>
  );
}

export function PoolHealthWidget() {
  const [stats, setStats] = useState(null);
  useEffect(()=>{
    Promise.all([
      SB.from("label_pool").select("*",{count:"exact",head:true}).eq("status","available"),
      SB.from("label_pool").select("*",{count:"exact",head:true}).eq("status","assigned"),
      SB.from("label_pool").select("*",{count:"exact",head:true}).eq("status","claimed"),
    ]).then(([a,b,c])=>setStats({available:a.count||0,assigned:b.count||0,claimed:c.count||0}));
  },[]);
  if(!stats) return null;
  const total = stats.available+stats.assigned+stats.claimed;
  const pctLeft = Math.round(stats.available/Math.max(total,1)*100);
  return(
    <div style={{marginTop:20,background:"var(--parch)",border:"1px solid var(--border)",
      borderRadius:10,padding:"14px 16px"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Label Pool Health</div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:10}}>
        {[
          {n:stats.available,label:"Available",color:"#4caf50"},
          {n:stats.assigned, label:"Assigned (ordered)",color:"#2196f3"},
          {n:stats.claimed,  label:"Claimed (in use)",color:"var(--goldink)"},
        ].map(s=>(
          <div key={s.label} style={{textAlign:"center",minWidth:100}}>
            <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.n.toLocaleString()}</div>
            <div style={{fontSize:11,color:"var(--muted)"}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
        <div style={{height:"100%",width:pctLeft+"%",background:"#4caf50",borderRadius:4,transition:"width .4s"}}/>
      </div>
      <div style={{fontSize:11,color:"var(--muted)"}}>
        {pctLeft}% of pool available · {stats.available.toLocaleString()} labels ready to assign
        {stats.available<500&&<span style={{color:"#e53935",fontWeight:700}}> ⚠ Pool getting low — seed more labels in Supabase SQL.</span>}
      </div>
      {stats.available<500&&(
        <div style={{marginTop:8,background:"rgba(229,57,53,.08)",border:"1px solid rgba(229,57,53,.2)",
          borderRadius:6,padding:"8px 10px",fontSize:11,color:"var(--muted)",fontFamily:"monospace",lineHeight:1.5}}>
          Run in Supabase SQL to add 10,000 more labels:<br/>
          {"SELECT seed_label_pool("+(total+1)+", "+(total+10000)+");"}
        </div>
      )}
    </div>
  );
}

export function AdminHub({ currentUser, org }) {
  const [tab, setTab]             = useState("overview");
  const [orgs, setOrgs]           = useState([]);
  const [leads, setLeads]         = useState([]);
  const [feedback, setFeedback]   = useState([]);
  const [analytics, setAnalytics] = useState({ views:0, sessions:0, byPage:[], byDay:[] });
  const [labelOrders, setLabelOrders] = useState([]);
  const [digest, setDigest]       = useState(null);
  const [adminItemCount, setAdminItemCount] = useState(null); // real total from DB
  const [query, setQuery]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState("");
  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""), 3000); };

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (tab === "overview" || tab === "programs" || tab === "users" || tab === "billing") {
        // Use RPC to get item counts per org in one query
        const { data: orgData } = await SB.rpc("get_admin_org_overview");
        if (orgData) setOrgs(orgData);
        else {
          // Fallback to basic query if RPC not available
          const { data } = await SB.from("orgs")
            .select("id,name,email,plan,temp_pro,is_leading_player,director_name,label_prefix,created_at,last_seen,stripe_subscription_id,account_status,city,location,referral_code,vertical,signup_domain")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }).limit(200);
          setOrgs(data || []);
        }
      }
      if (tab === "overview" || tab === "feedback") {
        const { data } = await SB.from("beta_feedback")
          .select("*").order("created_at", { ascending: false }).limit(50);
        setFeedback(data || []);
      }
      if (tab === "overview") {
        // Quick page views count for the overview stat card
        const { count } = await SB.from("page_views").select("*", { count: "exact", head: true });
        setAnalytics(prev => ({ ...prev, views: count || 0 }));
        // Real item count — don't rely on joined data
        const { count: ic } = await SB.from("items").select("*", { count: "exact", head: true });
        setAdminItemCount(ic || 0);
      }
      if (tab === "overview" || tab === "users") {
        const { data } = await SB.from("beta_leads")
          .select("*").order("created_at", { ascending: false }).limit(50);
        setLeads(data || []);
      }
       if (tab === "analytics") {
         const since90 = new Date(Date.now()-90*24*60*60*1000).toISOString();
         const [{ data: pv }, { data: loginEvts }] = await Promise.all([
           SB.from("page_views")
             .select("page,session_id,created_at,utm_source,utm_campaign,referrer,ref_code")
             .order("created_at", { ascending: false }).limit(5000),
           SB.from("login_events")
             .select("org_id,org_name,created_at")
             .gte("created_at", since90)
             .neq("email","theatre4u1@gmail.com")
             .order("created_at", { ascending: false }),
         ]);
         const byPage={}, bySess={}, byDay={}, bySrc={}, byLoginDay={};
         // Page views (landing page traffic)
         (pv||[]).forEach(v => {
           byPage[v.page] = (byPage[v.page]||0) + 1;
           bySess[v.session_id] = true;
           const day = (v.created_at||"").slice(0,10);
           if (day) byDay[day] = (byDay[day]||0) + 1;
           const src = v.utm_source||(v.referrer?.includes("facebook")?"facebook":v.referrer?.includes("google")?"google":v.referrer?.includes("instagram")?"instagram":"direct");
           bySrc[src] = (bySrc[src]||0) + 1;
         });
         // Login events (real daily active users)
         (loginEvts||[]).forEach(v => {
           const day = (v.created_at||"").slice(0,10);
           if (day) byLoginDay[day] = (byLoginDay[day]||0) + 1;
         });
         // Merge last 14 days — show both landing page views and active logins
         const today = new Date().toISOString().slice(0,10);
         if (!byDay[today]) byDay[today] = 0;
         if (!byLoginDay[today]) byLoginDay[today] = 0;
         const allDays = new Set([...Object.keys(byDay), ...Object.keys(byLoginDay)]);
         const dayEntries = [...allDays].sort().slice(-14).map(d => [d, byDay[d]||0, byLoginDay[d]||0]);
         const maxDay = Math.max(1, ...dayEntries.map(([,v,l])=>Math.max(v,l)));
         setAnalytics({
           views: (pv||[]).length,
           sessions: Object.keys(bySess).length,
           activeLogins: (loginEvts||[]).length,
           activeUsers: new Set((loginEvts||[]).map(l=>l.org_id)).size,
           byPage: Object.entries(byPage).sort(([,a],[,b])=>b-a),
           byDay: dayEntries,
           maxDay,
           bySrc: Object.entries(bySrc).sort(([,a],[,b])=>b-a),
         });
      }
      if (tab === "labels") {
        const { data } = await SB.from("label_orders")
          .select("*").order("created_at", { ascending: false });
        setLabelOrders(data || []);
      }
      if (tab === "digest" || tab === "overview") {
        const since = new Date(Date.now()-24*60*60*1000).toISOString();
        const [
          {data:newOrgs},   {data:newItems},  {data:newLeadsToday},
          {data:newEmails}, {data:pvToday},   {data:newMsgs},
          {data:newFeedback24}, {data:loginToday}, {data:missedSignups},
        ] = await Promise.all([
          SB.from("orgs").select("id,name,email,plan,created_at").gte("created_at",since),
          SB.from("items").select("id,name,category,org_id,added").gte("added",since).order("added",{ascending:false}),
          SB.from("beta_leads").select("id,name,email,org,created_at").gte("created_at",since),
          SB.from("email_sequence").select("id,org_id,email_num,sent_at").gte("sent_at",since),
          SB.from("page_views").select("page,session_id,created_at").gte("created_at",since),
          SB.from("messages").select("id,created_at").gte("created_at",since),
          SB.from("beta_feedback").select("id,category,org_name,message,created_at").gte("created_at",since),
          SB.from("login_events").select("org_id,org_name,email,plan,created_at").gte("created_at",since).neq("email","theatre4u1@gmail.com").order("created_at",{ascending:false}),
          SB.from("signup_notifications").select("org_name,org_email,plan,notified,notified_at").eq("notified",false).order("notified_at",{ascending:false}).limit(20),
        ]);
        const orgNames = {};
        (newItems||[]).forEach(i=>{ if(!orgNames[i.org_id]) orgNames[i.org_id]="Unknown"; });
        if((newItems||[]).length>0){
          const ids=[...new Set((newItems||[]).map(i=>i.org_id))];
          const {data:orgData}=await SB.from("orgs").select("id,name").in("id",ids);
          (orgData||[]).forEach(o=>{orgNames[o.id]=o.name;});
        }
        const emailLabels={1:"Welcome",2:"First Item",3:"Tour",4:"Exchange",5:"Funding",6:"Reports",7:"Free Year"};
        const emailsByOrg={};
        (newEmails||[]).forEach(e=>{
          if(!emailsByOrg[e.org_id]) emailsByOrg[e.org_id]={name:"",emails:[]};
          emailsByOrg[e.org_id].emails.push(e.email_num);
        });
        const pvByPage={};
        const sessions=new Set();
        (pvToday||[]).forEach(v=>{
          pvByPage[v.page]=(pvByPage[v.page]||0)+1;
          sessions.add(v.session_id);
        });
        if(Object.keys(emailsByOrg).length>0){
          const {data:orgNames2}=await SB.from("orgs").select("id,name").in("id",Object.keys(emailsByOrg));
          (orgNames2||[]).forEach(o=>{if(emailsByOrg[o.id])emailsByOrg[o.id].name=o.name;});
        }
        setDigest({
          newOrgs:        newOrgs||[],
          newItems:       (newItems||[]).map(i=>({...i,orgName:orgNames[i.org_id]||""})),
          newLeads:       newLeadsToday||[],
          emailsSent:     newEmails||[],
          emailsByOrg,
          emailLabels,
          pageViews:      pvToday?.length||0,
          uniqueSessions: sessions.size,
          pvByPage,
          messages:       newMsgs||[],
          newFeedback:    newFeedback24||[],
          loginToday:     loginToday||[],
          activeUsers:    new Set((loginToday||[]).map(l=>l.org_id)).size,
          missedSignups:  missedSignups||[],
          generatedAt:    new Date().toLocaleString("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}),
        });















      }
      setLoading(false);
    })();
  }, [tab]);

  const upgradeOrg = async (orgId, plan, isLP) => {
    const { error } = await SB.from("orgs").update({ plan, is_leading_player: isLP }).eq("id", orgId);
    if (!error) {
      setOrgs(prev => prev.map(o => o.id===orgId ? {...o, plan, is_leading_player:isLP} : o));
      flash("✓ Updated");
    }
  };

  const updateFeedback = async (id, status) => {
    const { error } = await SB.from("beta_feedback").update({ status }).eq("id", id);
    if (error) {
      flash("❌ Could not save status: " + error.message);
      console.error("updateFeedback error:", error);
      return;
    }
    setFeedback(prev => prev.map(f => f.id===id ? {...f, status} : f));
    flash("✓ Status updated");
  };

  const updateLabelOrder = async (id, updates) => {
    await SB.from("label_orders").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    setLabelOrders(prev => prev.map(o => o.id===id ? {...o,...updates} : o));
    flash("✓ Order updated");
  };

  const filteredOrgs = orgs.filter(o =>
    !query || [o.name,o.email,o.director_name,o.city,o.location]
      .some(v => v?.toLowerCase().includes(query.toLowerCase()))
  );

  const totalOrgs   = orgs.length;
  const paidOrgs    = orgs.filter(o=>o.plan!=="free").length;
  const leadingPlayers = orgs.filter(o=>o.is_leading_player).length;
  const newFeedback = feedback.filter(f=>f.status==="new").length;
  const newLeads    = leads.filter(l=>!l.converted).length;

  const TABS = [
    ["overview",  "🏠 Overview"],
    ["digest",    "📋 Daily Digest"],
    ["users",     "👥 Users & Leads"],
    ["billing",   "💳 Billing & Access"],
    ["payments",  "💰 Payments"],
    ["analytics", "📈 Analytics"],
    ["feedback",  "💬 Feedback"],
    ["labels",    "🏷 Label Orders"],
    ["programs",  "🎭 Programs"],
    ["accounts",  "⚠️ Accounts"],
    ["districts", "🏛 Districts"],
    ["tools",     "🔧 Tools"],
  ];

  return (
    <div style={{padding:"28px 32px 64px",minHeight:"80vh"}}>
      <div style={{marginBottom:22}}>
        <h1 style={{fontFamily:"var(--serif)",fontSize:28,margin:"0 0 4px"}}>🎛 Admin Hub</h1>
        <p style={{fontSize:13,color:"var(--muted)",margin:0}}>Theatre4u™ platform administration — everything in one place.</p>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:24,borderBottom:"1px solid var(--border)",
        paddingBottom:0,overflowX:"auto",WebkitOverflowScrolling:"touch",
        scrollbarWidth:"none",msOverflowStyle:"none"}}>
        {TABS.map(([id,lbl])=>{
          const badge = id==="feedback"&&newFeedback>0?newFeedback
            : id==="users"&&newLeads>0?newLeads
            : id==="labels"&&labelOrders.filter(o=>o.status==="pending").length>0?labelOrders.filter(o=>o.status==="pending").length
            : 0;
          return(
            <button key={id} onClick={()=>setTab(id)}
              style={{padding:"10px 16px",borderRadius:"8px 8px 0 0",border:"none",
                cursor:"pointer",fontSize:14,fontWeight:tab===id?700:500,
                whiteSpace:"nowrap",flexShrink:0,
                background:tab===id?"var(--gold)":"transparent",
                borderBottom:tab===id?"3px solid var(--gold)":"3px solid transparent",
                color:tab===id?"#1a0f00":tab===id?"var(--text)":"var(--muted)",
                fontFamily:"inherit",transition:"all .15s"}}>
              {lbl}{badge>0?" ("+badge+")":""}
            </button>
          );
        })}
      </div>

      {msg&&<div style={{background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.3)",borderRadius:8,padding:"8px 14px",marginBottom:16,fontSize:13,color:"#4caf50"}}>{msg}</div>}
      {loading&&<div style={{color:"var(--muted)",padding:20,textAlign:"center"}}>Loading…</div>}

      {/* ── DAILY DIGEST ── */}
      {tab==="digest"&&<AdminDailyDigest/>}

      {/* ── OVERVIEW ── */}
      {!loading&&tab==="overview"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
            {[
              { n:totalOrgs,                                          label:"Total Programs", color:"var(--goldink)", icon:"🎭" },
              { n:paidOrgs,                                           label:"Paid Plans",     color:"#4caf50",     icon:"💳" },
              { n:orgs.filter(o=>o.founding_member).length,               label:"Founding Members", color:"var(--goldink)", icon:"⭐" },
              { n:orgs.filter(o=>o.temp_pro&&!o.founding_member).length,  label:"Beta Only",        color:"#ce93d8",     icon:"🎭" },
              { n:adminItemCount!==null?adminItemCount:orgs.reduce((s,o)=>s+(Number(o.item_count)||0),0)||"…", label:"Total Items", color:"var(--goldink)", icon:"📦" },
              { n:newLeads,                                           label:"New Leads",      color:"#2196f3",     icon:"📥" },
              { n:newFeedback,                                        label:"New Feedback",   color:"#ff9800",     icon:"💬" },
              { n:analytics.views||0,                                 label:"Page Views",     color:"var(--muted)",icon:"👁" },
            ].map(k=>(
              <div key={k.label} style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:22,marginBottom:4}}>{k.icon}</div>
                <div style={{fontSize:28,fontWeight:800,color:k.color,lineHeight:1}}>{k.n}</div>
                <div style={{fontSize:11,color:"var(--muted)",marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Beta incentive progress */}
          <div style={{marginBottom:24}}>
            <h3 style={{fontFamily:"var(--serif)",fontSize:16,marginBottom:10}}>
              All Programs — Inventory Overview
            </h3>
            <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:"rgba(0,0,0,.1)"}}>
                  {["Program","Plan","Items","Team","Joined","Status"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {orgs.map((o,idx)=>{
                    const items = Number(o.item_count)||0;
                    const team  = Number(o.team_count)||0;
                    const planColor = o.plan==="district"?"#42a5f5":o.plan==="pro"?"#91592c":"var(--muted)";
                    const statusBadge = o.stripe_subscription_id
                      ? {label:"💳 Paying",bg:"rgba(76,175,80,.12)",color:"#4caf50"}
                      : o.founding_member
                      ? {label:"⭐ Founding",bg:"rgba(212,168,67,.15)",color:"var(--goldink)"}
                      : o.temp_pro
                      ? {label:"🎭 Beta Pro",bg:"rgba(156,39,176,.1)",color:"#ce93d8"}
                      : {label:"Free",bg:"rgba(150,150,150,.1)",color:"var(--muted)"};
                    return(
                      <tr key={o.id} style={{borderTop:"1px solid var(--border)",background:idx%2===0?"transparent":"rgba(0,0,0,.02)"}}>
                        <td style={{padding:"8px 12px",fontWeight:600,maxWidth:200}}>
                          <div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.name}</div>
                          <div style={{fontSize:11,color:"var(--muted)",fontWeight:400}}>{o.label_prefix||"—"}</div>
                        </td>
                        <td style={{padding:"8px 12px"}}>
                          <span style={{fontSize:11,fontWeight:700,color:planColor,textTransform:"uppercase"}}>{o.plan}</span>
                        </td>
                        <td style={{padding:"8px 12px"}}>
                          <span style={{fontWeight:700,color:items>0?"var(--text)":"var(--muted)",fontSize:items>0?15:13}}>
                            {items>0?items:"—"}
                          </span>
                        </td>
                        <td style={{padding:"8px 12px",color:team>0?"var(--text)":"var(--muted)"}}>{team>0?team:"—"}</td>
                        <td style={{padding:"8px 12px",color:"var(--muted)",fontSize:12}}>
                          {new Date(o.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"})}
                        </td>
                        <td style={{padding:"8px 12px"}}>
                          <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,
                            background:statusBadge.bg,color:statusBadge.color}}>
                            {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{marginBottom:24}}>
            <h3 style={{fontFamily:"var(--serif)",fontSize:16,marginBottom:10}}>Recent Signups</h3>
            <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:"rgba(0,0,0,.1)"}}>
                  {["Program","Director","Email","Plan","Joined"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {orgs.slice(0,8).map(o=>(
                    <tr key={o.id} style={{borderTop:"1px solid var(--border)"}}>
                      <td style={{padding:"8px 12px",fontWeight:600}}>{o.name}</td>
                      <td style={{padding:"8px 12px",color:"var(--muted)",fontSize:12}}>{o.director_name||"—"}</td>
                      <td style={{padding:"8px 12px"}}><a href={"mailto:"+o.email} style={{color:"var(--goldink)",fontSize:12}}>{o.email}</a></td>
                      <td style={{padding:"8px 12px"}}>
                        <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:6,
                          background:o.plan==="free"?"rgba(100,100,100,.15)":"rgba(76,175,80,.15)",
                          color:o.plan==="free"?"var(--muted)":"#4caf50",textTransform:"capitalize"}}>{o.plan}</span>
                      </td>
                      <td style={{padding:"8px 12px",color:"var(--muted)",fontSize:12}}>{new Date(o.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {feedback.length>0&&(
            <div>
              <h3 style={{fontFamily:"var(--serif)",fontSize:16,marginBottom:10}}>Recent Feedback</h3>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {feedback.slice(0,4).map(f=>(
                  <div key={f.id} style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 14px",display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{fontSize:18,flexShrink:0}}>{f.category==="bug"?"🐛":f.category==="feature"?"✨":f.category==="ux"?"👁":"💬"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:"var(--goldink)",marginBottom:2}}>{f.org_name||"Anonymous"} · {f.category}</div>
                      <div style={{fontSize:13,color:"var(--text)",lineHeight:1.5}}>{f.message||"(no message)"}</div>
                    </div>
                    <span style={{fontSize:10,color:"var(--muted)",flexShrink:0,marginTop:2}}>{new Date(f.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── USERS & LEADS ── */}
      {!loading&&tab==="users"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div>
              <h3 style={{fontFamily:"var(--serif)",fontSize:18,margin:"0 0 2px"}}>Programs & Beta Leads</h3>
              <p style={{fontSize:12,color:"var(--muted)",margin:0}}>{orgs.length} programs · {leads.length} beta leads · {leads.filter(l=>!l.converted).length} not yet converted</p>
            </div>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email, director…"
              style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:8,padding:"7px 12px",fontSize:13,color:"var(--text)",width:260,outline:"none"}}/>
          </div>

          <h4 style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:8}}>Active Accounts</h4>
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:20}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:"rgba(0,0,0,.08)"}}>
                {["Program","Director","Contact","Prefix","Plan","⭐ LP","Actions"].map(h=>(
                  <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredOrgs.map(o=>(
                  <tr key={o.id} style={{borderTop:"1px solid var(--border)"}}>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{fontWeight:700}}>{o.name}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>{o.city||o.location||""}</div>
                      <span style={{display:"inline-block",marginTop:3,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700,background:(o.vertical&&o.vertical!=="theatre")?"rgba(66,165,245,.18)":"rgba(181,23,79,.18)",color:(o.vertical&&o.vertical!=="theatre")?"#42a5f5":"#e91e8c"}}>{getVertical(o.vertical||"theatre").icon} {getVertical(o.vertical||"theatre").label}</span>{o.signup_domain&&<span style={{display:"inline-block",marginTop:3,marginLeft:5,padding:"1px 7px",borderRadius:8,fontSize:10,fontWeight:700,background:"rgba(255,255,255,.08)",color:"var(--muted)"}}>{o.signup_domain==="artstracker.org"?"🎨 ArtsTracker":"🎭 Theatre4u"}</span>}
                    </td>
                    <td style={{padding:"9px 12px",fontSize:12}}>
                      <div>{o.director_name||"—"}</div>
                      {o.director_title&&<div style={{fontSize:11,color:"var(--muted)"}}>{o.director_title}</div>}
                    </td>
                    <td style={{padding:"9px 12px"}}><a href={"mailto:"+o.email} style={{color:"var(--goldink)",fontSize:12}}>{o.email}</a></td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{fontFamily:"monospace",fontSize:11,fontWeight:800,letterSpacing:1,
                        color:o.label_prefix?"var(--gold)":"var(--muted)",
                        background:o.label_prefix?"rgba(212,168,67,.1)":"rgba(0,0,0,.1)",
                        padding:"2px 8px",borderRadius:4,display:"inline-block"}}>
                        {o.label_prefix||"—"}
                      </div>
                    </td>
                    <td style={{padding:"9px 12px"}}>
                      <select value={o.plan} onChange={e=>upgradeOrg(o.id,e.target.value,o.is_leading_player)}
                        style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"3px 7px",fontSize:12,color:"var(--text)",cursor:"pointer"}}>
                        {["free","pro","district","district_m","district_l"].map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center"}}>
                      <button onClick={()=>upgradeOrg(o.id,o.plan,!o.is_leading_player)}
                        style={{background:o.is_leading_player?"rgba(212,168,67,.15)":"transparent",
                          border:"1px solid",borderColor:o.is_leading_player?"var(--gold)":"var(--border)",
                          borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,cursor:"pointer",
                          color:o.is_leading_player?"var(--gold)":"var(--muted)"}}>
                        {o.is_leading_player?"⭐":"○"}
                      </button>
                    </td>
                    <td style={{padding:"9px 12px"}}>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        <a href={"mailto:"+o.email+"?subject=Theatre4u — Following up"}
                          style={{fontSize:11,color:"var(--goldink)",textDecoration:"none",fontWeight:700}}>✉ Email</a>
                        <button onClick={async()=>{
                          const {error}=await SB.from("orgs").update({
                            temp_pro:!o.temp_pro,
                            temp_pro_granted_at:!o.temp_pro?new Date().toISOString():null,
                            temp_pro_note:!o.temp_pro?"Granted via admin hub":"",
                          }).eq("id",o.id);
                          if(!error){setOrgs(prev=>prev.map(x=>x.id===o.id?{...x,temp_pro:!o.temp_pro}:x));flash("✓ Temp Pro "+(o.temp_pro?"removed":"granted"));}
                        }} style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5,
                          border:"1px solid",cursor:"pointer",fontFamily:"inherit",
                          borderColor:o.temp_pro?"var(--gold)":"var(--border)",
                          background:o.temp_pro?"rgba(212,168,67,.12)":"transparent",
                          color:o.temp_pro?"var(--gold)":"var(--muted)"}}>
                          {o.temp_pro?"⭐ Pro":"○ Pro"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:8}}>Beta Leads (beta.html submissions)</h4>
          {leads.length===0
            ?<div style={{color:"var(--muted)",fontSize:13,padding:16,textAlign:"center"}}>No beta leads yet. Share theatre4u.org/beta.html to collect leads.</div>
            :<div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:"rgba(0,0,0,.08)"}}>
                  {["Program","Name","Email","Type","Location","Status","Date"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {leads.filter(l=>!query||[l.org,l.name,l.email].some(v=>v?.toLowerCase().includes(query.toLowerCase()))).map(l=>(
                    <tr key={l.id} style={{borderTop:"1px solid var(--border)"}}>
                      <td style={{padding:"8px 12px",fontWeight:600}}>{l.org}</td>
                      <td style={{padding:"8px 12px"}}>{l.name}</td>
                      <td style={{padding:"8px 12px"}}><a href={"mailto:"+l.email} style={{color:"var(--goldink)",fontSize:12}}>{l.email}</a></td>
                      <td style={{padding:"8px 12px",color:"var(--muted)",fontSize:12}}>{l.type||"—"}</td>
                      <td style={{padding:"8px 12px",color:"var(--muted)",fontSize:12}}>{l.location||"—"}</td>
                      <td style={{padding:"8px 12px"}}>
                        {l.converted
                          ?<span style={{fontSize:11,fontWeight:700,color:"#4caf50"}}>✓ Converted</span>
                          :<span style={{fontSize:11,color:"var(--muted)"}}>Lead only</span>}
                      </td>
                      <td style={{padding:"8px 12px",color:"var(--muted)",fontSize:12}}>{new Date(l.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}

      {/* ── BILLING & ACCESS ── */}
      {!loading&&tab==="billing"&&(
        <div>
          <div style={{marginBottom:24}}>
            <h3 style={{fontFamily:"var(--serif)",fontSize:22,marginBottom:4}}>Billing & Access Management</h3>
            <p style={{fontSize:14,color:"var(--muted)",lineHeight:1.6}}>
              Control who has Pro access and how. Right now everyone is on
              {" "}<strong style={{color:"var(--goldink)"}}>Beta Temp Pro</strong> — free access you granted manually.
              When beta ends, you'll end temp pro here, and programs will need to subscribe through Stripe to keep Pro features.
            </p>
          </div>

          {/* Status summary */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
            {[
              { n: orgs.filter(o=>o.temp_pro).length,                                    label:"Beta Temp Pro",   color:"var(--goldink)",  icon:"⭐", desc:"Free beta access" },
              { n: orgs.filter(o=>o.stripe_subscription_id).length,                      label:"Paying (Stripe)", color:"#4caf50",      icon:"💳", desc:"Active subscriptions" },
              { n: orgs.filter(o=>o.plan==="district"&&!o.temp_pro).length,              label:"District",        color:"#2196f3",      icon:"🏛", desc:"Manually granted" },
              { n: orgs.filter(o=>o.plan==="free"&&!o.temp_pro).length,                  label:"Free",            color:"var(--muted)", icon:"⚪", desc:"Limited access" },
            ].map(k=>(
              <div key={k.label} style={{background:"var(--parch)",border:"1px solid var(--border)",
                borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:4}}>{k.icon}</div>
                <div style={{fontSize:28,fontWeight:800,color:k.color,lineHeight:1}}>{k.n}</div>
                <div style={{fontSize:12,fontWeight:700,color:k.color,marginTop:3}}>{k.label}</div>
                <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{k.desc}</div>
              </div>
            ))}
          </div>

          {/* Bulk group actions */}
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Group Actions</div>
            <p style={{fontSize:13,color:"var(--muted)",marginBottom:16,lineHeight:1.6}}>
              These buttons affect all programs in a group at once. Use with care — there's no undo.
            </p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button onClick={async()=>{
                if(!confirm("Grant temp_pro to ALL free programs that don't have it? This gives them full Pro access.")) return;
                const {error} = await SB.from("orgs")
                  .update({temp_pro:true, temp_pro_granted_at:new Date().toISOString(), temp_pro_note:"Bulk granted via admin hub"})
                  .eq("plan","free").is("temp_pro",false)
                  .is("deleted_at",null);
                if(!error){flash("✓ Temp Pro granted to all free accounts");setOrgs(p=>p.map(o=>o.plan==="free"&&!o.temp_pro?{...o,temp_pro:true}:o));}
              }} style={{padding:"10px 18px",borderRadius:8,fontFamily:"inherit",
                fontSize:14,fontWeight:700,cursor:"pointer",
                background:"rgba(212,168,67,.15)",color:"var(--goldink)",border:"1px solid rgba(212,168,67,.3)"}}>
                ⭐ Grant Temp Pro to all free accounts
              </button>

              <button onClick={async()=>{
                if(!confirm("END BETA: Remove temp_pro from everyone? Programs will need to subscribe through Stripe to keep Pro features. This is a big step — only do this at Artstracker launch.")) return;
                const {error} = await SB.from("orgs")
                  .update({temp_pro:false, temp_pro_note:"Beta ended — subscription required"})
                  .eq("temp_pro",true)
                  .is("stripe_subscription_id",null);
                if(!error){flash("✓ Beta ended — temp_pro removed from all non-paying accounts");
                  setOrgs(p=>p.map(o=>o.temp_pro&&!o.stripe_subscription_id?{...o,temp_pro:false}:o));}
              }} style={{padding:"10px 18px",borderRadius:8,fontFamily:"inherit",
                fontSize:14,fontWeight:700,cursor:"pointer",
                background:"rgba(229,57,53,.08)",color:"#e53935",border:"1px solid rgba(229,57,53,.25)"}}>
                🔴 End Beta (remove temp pro from all non-paying)
              </button>
            </div>
            <div style={{marginTop:12,fontSize:12,color:"var(--muted)",lineHeight:1.6,
              padding:"10px 12px",background:"rgba(0,0,0,.06)",borderRadius:7}}>
              <strong style={{color:"var(--text)"}}>Safe to use now:</strong> Grant Temp Pro.
              {" "}<strong style={{color:"#e53935"}}>End Beta</strong> only at Artstracker launch —
              it removes free access from everyone who hasn't paid. Paying subscribers (Stripe) are unaffected.
            </div>
          </div>

          {/* Per-program access table */}
          <div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>Program Access — Individual Controls</div>
            <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr style={{background:"rgba(0,0,0,.08)"}}>
                  {["Program","Director","Plan","Access","Stripe","Send Stripe Link"].map(h=>(
                    <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,
                      textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {orgs.map(o=>{
                    const accessLabel = o.stripe_subscription_id ? "💳 Paying"
                      : o.temp_pro ? "⭐ Beta Free"
                      : o.plan==="district" ? "🏛 District"
                      : "⚪ Free";
                    const accessColor = o.stripe_subscription_id ? "#4caf50"
                      : o.temp_pro ? "var(--gold)"
                      : o.plan==="district" ? "#2196f3"
                      : "var(--muted)";
                    const stripeLink = "https://billing.stripe.com/p/login/aFa4gydAZ2X1cpZ6UHgA800";
                    const checkoutLink = "https://theatre4u.org?checkout=pro";
                    return(
                      <tr key={o.id} style={{borderTop:"1px solid var(--border)"}}>
                        <td style={{padding:"9px 12px",fontWeight:600,fontSize:13}}>{o.name}</td>
                        <td style={{padding:"9px 12px",fontSize:12,color:"var(--muted)"}}>{o.director_name||"—"}</td>
                        <td style={{padding:"9px 12px"}}>
                          <select value={o.plan}
                            onChange={async e=>{
                              const np=e.target.value;
                              const{error}=await SB.from("orgs").update({plan:np}).eq("id",o.id);
                              if(!error){setOrgs(p=>p.map(x=>x.id===o.id?{...x,plan:np}:x));flash("✓ Plan updated");}
                            }}
                            style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,
                              padding:"3px 7px",fontSize:12,color:"var(--text)",cursor:"pointer"}}>
                            {["free","pro","district","district_m","district_l"].map(p=><option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td style={{padding:"9px 12px"}}>
                          <button onClick={async()=>{
                            const next=!o.temp_pro;
                            const{error}=await SB.from("orgs").update({
                              temp_pro:next,
                              temp_pro_granted_at:next?new Date().toISOString():null,
                              temp_pro_note:next?"Granted via billing tab":"Removed via billing tab"
                            }).eq("id",o.id);
                            if(!error){setOrgs(p=>p.map(x=>x.id===o.id?{...x,temp_pro:next}:x));flash("✓ Access updated");}
                          }} style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:6,
                            border:"1.5px solid",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
                            borderColor:o.temp_pro?"var(--gold)":o.stripe_subscription_id?"#4caf50":"var(--border)",
                            background:o.temp_pro?"rgba(212,168,67,.1)":o.stripe_subscription_id?"rgba(76,175,80,.1)":"transparent",
                            color:accessColor}}>
                            {accessLabel}
                          </button>
                        </td>
                        <td style={{padding:"9px 12px",fontSize:11,color:"var(--muted)",fontFamily:"monospace"}}>
                          {o.stripe_subscription_id
                            ? <span style={{color:"#4caf50"}}>✓ Active</span>
                            : o.stripe_customer_id
                            ? <span style={{color:"var(--goldink)"}}>Customer, no sub</span>
                            : <span>None</span>}
                        </td>
                        <td style={{padding:"9px 12px"}}>
                          {!o.stripe_subscription_id&&(
                            <a href={"mailto:"+o.email
                              +"?subject=Theatre4u™ — Your Beta Access & Subscription Options"
                              +"&body=Hi "+( o.director_name||"there")+","
                              +"%0A%0AThank you for being part of the Theatre4u beta! You've had full Pro access at no charge while we've been building and improving the platform."
                              +"%0A%0AAs a beta program that has been with us from the start, you qualify for our founding member rate: %249.99%2Fmonth (instead of the standard %2415) — locked in for as long as you subscribe."
                              +"%0A%0ATo activate your founding member subscription: https%3A%2F%2Ftheatre4u.org"
                              +"%0A%0AIf you have any questions just reply to this email."
                              +"%0A%0ABob Zick%0AFounder, Theatre4u™%0Ahello%40theatre4u.org"}
                              style={{fontSize:12,color:"var(--goldink)",fontWeight:700,
                                textDecoration:"none",whiteSpace:"nowrap"}}>
                              ✉ Send invite
                            </a>
                          )}
                          {o.stripe_subscription_id&&(
                            <a href={stripeLink} target="_blank" rel="noreferrer"
                              style={{fontSize:12,color:"#4caf50",fontWeight:700,textDecoration:"none"}}>
                              Manage →
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* How automation works */}
          <div style={{marginTop:24,background:"rgba(33,150,243,.05)",border:"1px solid rgba(33,150,243,.15)",
            borderRadius:12,padding:20}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>How billing automation works</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {[
                {n:"1",ico:"📝",t:"Program signs up",b:"They get temp_pro=true automatically. Full Pro features, no charge."},
                {n:"2",ico:"✉️",t:"You send Stripe invite",b:"Click 'Send invite' above to email them a pre-written subscription link."},
                {n:"3",ico:"💳",t:"They subscribe",b:"They pay $15/mo through Stripe checkout. Automatic from there."},
                {n:"4",ico:"⚡",t:"Webhook fires",b:"Stripe tells Theatre4u instantly. plan='pro', stripe IDs stored. No action needed."},
                {n:"5",ico:"🔁",t:"Auto-renewal",b:"Stripe handles monthly/annual renewal. If payment fails, plan downgrades automatically."},
                {n:"6",ico:"❌",t:"They cancel",b:"Stripe webhook downgrades them to free at period end. Automatic."},
              ].map(s=>(
                <div key={s.n} style={{background:"rgba(255,255,255,.5)",borderRadius:8,padding:"12px 14px",
                  display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{background:"#2196f3",color:"#fff",borderRadius:"50%",width:22,height:22,
                    minWidth:22,display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:11,fontWeight:800}}>{s.n}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{s.ico} {s.t}</div>
                    <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>{s.b}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:14,fontSize:12,color:"var(--muted)",lineHeight:1.6,
              borderTop:"1px solid rgba(33,150,243,.15)",paddingTop:12}}>
              <strong style={{color:"#4caf50"}}>✅ Fully automated and live.</strong>
              {" "}Every step above is wired and working. The org's ID is passed to Stripe as
              {" "}<code style={{fontFamily:"monospace",background:"rgba(0,0,0,.06)",padding:"1px 5px",borderRadius:3}}>client_reference_id</code>
              {" "}on every checkout, so the webhook always knows which account to upgrade.
              Subscriptions, renewals, failures, and cancellations are all handled automatically.
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENTS ── */}
      {tab==="payments"&&(
        <AdminPaymentsTab/>
      )}

      {/* ── ANALYTICS ── */}
      {!loading&&tab==="analytics"&&(
        <div>
          {/* Header + controls */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:20}}>
            <div>
              <h3 style={{fontFamily:"var(--serif)",fontSize:18,marginBottom:2}}>Platform Analytics</h3>
              <p style={{fontSize:13,color:"var(--muted)"}}>Live page view data. Last updated: {new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</p>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {/* Time window selector */}
              <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:7,overflow:"hidden"}}>
                {[["7d","7 Days"],["14d","14 Days"],["30d","30 Days"],["all","All Time"]].map(([id,lbl])=>(
                  <button key={id}
                    onClick={async()=>{
                      const days = id==="all"?3650:parseInt(id);
                      const since = new Date(Date.now()-days*24*60*60*1000).toISOString();
                      const {data:pv} = await SB.from("page_views")
                        .select("page,session_id,created_at,utm_source,utm_campaign,referrer,ref_code")
                        .gte("created_at", id==="all"?"2020-01-01":since)
                        .order("created_at",{ascending:false}).limit(5000);
                      if(pv){
                        const byPage={},bySess={},byDay={},bySrc={};
                        pv.forEach(v=>{
                          byPage[v.page]=(byPage[v.page]||0)+1;
                          bySess[v.session_id]=true;
                          const day=(v.created_at||"").slice(0,10);
                          if(day)byDay[day]=(byDay[day]||0)+1;
                          const src=v.utm_source||(v.referrer?.includes("facebook")?"facebook":v.referrer?.includes("google")?"google":v.referrer?.includes("instagram")?"instagram":"direct");
                          bySrc[src]=(bySrc[src]||0)+1;
                        });
                        const windowDays = id==="all"?90:days;
                        const dayEntries=Object.entries(byDay).sort(([a],[b])=>a>b?1:-1).slice(-windowDays);
                        const maxDay=Math.max(1,...dayEntries.map(([,v])=>v));
                        setAnalytics({views:pv.length,sessions:Object.keys(bySess).length,byPage:Object.entries(byPage).sort(([,a],[,b])=>b-a),byDay:dayEntries,maxDay,bySrc:Object.entries(bySrc).sort(([,a],[,b])=>b-a)});
                      }
                    }}
                    style={{background:analytics._win===id?"var(--gold)":"transparent",color:analytics._win===id?"#1a0f00":"var(--muted)",border:"none",padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {lbl}
                  </button>
                ))}
              </div>
              <button onClick={async()=>{
                const since=new Date(Date.now()-14*24*60*60*1000).toISOString();
                const {data:pv}=await SB.from("page_views").select("page,session_id,created_at,utm_source,utm_campaign,referrer,ref_code").gte("created_at",since).order("created_at",{ascending:false}).limit(5000);
                if(pv){
                  const byPage={},bySess={},byDay={},bySrc={};
                  pv.forEach(v=>{
                    byPage[v.page]=(byPage[v.page]||0)+1;
                    bySess[v.session_id]=true;
                    const day=(v.created_at||"").slice(0,10);
                    if(day)byDay[day]=(byDay[day]||0)+1;
                    const src=v.utm_source||(v.referrer?.includes("facebook")?"facebook":v.referrer?.includes("google")?"google":v.referrer?.includes("instagram")?"instagram":"direct");
                    bySrc[src]=(bySrc[src]||0)+1;
                  });
                  const dayEntries=Object.entries(byDay).sort(([a],[b])=>a>b?1:-1).slice(-14);
                  const maxDay=Math.max(1,...dayEntries.map(([,v])=>v));
                  setAnalytics({views:pv.length,sessions:Object.keys(bySess).length,byPage:Object.entries(byPage).sort(([,a],[,b])=>b-a),byDay:dayEntries,maxDay,bySrc:Object.entries(bySrc).sort(([,a],[,b])=>b-a)});
                }
              }} style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:7,padding:"5px 14px",fontSize:12,fontWeight:600,color:"var(--text)",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* KPI tiles */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:24}}>
            {[
              {label:"Page Views",    val:analytics.views,    icon:"👁"},
              {label:"Unique Sessions",val:analytics.sessions, icon:"🧍"},
              {label:"Top Source",    val:(analytics.bySrc||[])[0]?.[0]||"—", icon:"📡"},
              {label:"From Facebook", val:(analytics.bySrc||[]).find(([s])=>s==="facebook")?.[1]||0, icon:"📘"},
            ].map(k=>(
              <div key={k.label} style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:4}}>{k.icon}</div>
                <div style={{fontSize:26,fontWeight:800,color:"var(--goldink)",fontFamily:"var(--serif)",lineHeight:1}}>{k.val}</div>
                <div style={{fontSize:11,color:"var(--muted)",marginTop:4,textTransform:"uppercase",letterSpacing:.8}}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Daily chart — readable */}
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,padding:"16px 16px 8px",marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>
              Daily Page Views
            </div>
            {analytics.byDay.length===0
              ?<div style={{textAlign:"center",color:"var(--muted)",padding:32,fontSize:13}}>No data yet</div>
              :<div style={{overflowX:"auto"}}>
                <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:"var(--gold)",flexShrink:0}}/><span style={{fontSize:11,color:"var(--muted)",marginRight:12}}>Landing page views</span>
                  <div style={{width:10,height:10,borderRadius:2,background:"#4caf50",flexShrink:0}}/><span style={{fontSize:11,color:"var(--muted)"}}>Active logins</span>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"flex-end",minWidth:Math.max(400,analytics.byDay.length*52)+"px",height:160,padding:"0 4px 0"}}>
                  {analytics.byDay.map(([day,count,logins])=>{
                    const barH  = Math.max(4,(count/(analytics.maxDay)*110));
                    const loginH = Math.max(logins>0?4:0,((logins||0)/(analytics.maxDay)*110));
                    const mo = new Date(day+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
                    return(
                      <div key={day} style={{flex:1,minWidth:40,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <div style={{fontSize:10,color:"var(--muted)"}}>{(logins||0)>0?<span style={{color:"#4caf50",fontWeight:700}}>{logins}</span>:""}</div>
                        <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",justifyContent:"center"}}>
                          <div title={`${count} page views`} style={{width:"44%",maxWidth:18,background:"var(--gold)",borderRadius:"3px 3px 0 0",height:barH+"px",transition:"height .3s",opacity:.8}}/>
                          <div title={`${logins||0} logins`} style={{width:"44%",maxWidth:18,background:"#4caf50",borderRadius:"3px 3px 0 0",height:loginH+"px",transition:"height .3s",opacity:.8}}/>
                        </div>
                        <div style={{fontSize:10,color:"var(--muted)",textAlign:"center",lineHeight:1.2,whiteSpace:"nowrap"}}>{mo}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            }
          </div>

          {/* Traffic sources */}
          {(analytics.bySrc||[]).length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Traffic Sources</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {(analytics.bySrc||[]).map(([src,count])=>{
                  const total=analytics.views||1;
                  const pct=Math.round(count/total*100);
                  const srcIcon=src==="facebook"?"📘":src==="google"?"🔍":src==="instagram"?"📷":src==="direct"?"🔗":"🌐";
                  return(
                    <div key={src} style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{fontSize:14,width:20,textAlign:"center"}}>{srcIcon}</div>
                      <div style={{fontSize:13,color:"var(--text)",width:100,textTransform:"capitalize",flexShrink:0}}>{src}</div>
                      <div style={{flex:1,height:18,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{width:pct+"%",height:"100%",background:"var(--gold)",borderRadius:4,opacity:.8,transition:"width .4s"}}/>
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--goldink)",width:50,textAlign:"right"}}>{count}</div>
                      <div style={{fontSize:11,color:"var(--muted)",width:36,textAlign:"right"}}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Views by page */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Views by Page</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {analytics.byPage.map(([page,count])=>(
                <div key={page} style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:13,color:"var(--text)",width:140,textTransform:"capitalize",flexShrink:0}}>{page}</div>
                  <div style={{flex:1,height:18,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:(count/Math.max(...analytics.byPage.map(([,v])=>v))*100)+"%",height:"100%",background:"var(--gold)",borderRadius:4,opacity:.7,transition:"width .4s"}}/>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--goldink)",width:40,textAlign:"right"}}>{count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Facebook ad tracking tip */}
          <div style={{background:"rgba(212,168,67,.06)",border:"1px solid rgba(212,168,67,.2)",borderRadius:8,padding:"14px 16px",fontSize:13,lineHeight:1.7}}>
            <div style={{fontWeight:700,color:"var(--text)",marginBottom:6}}>📘 How to track your Facebook ad visits</div>
            <p style={{color:"var(--muted)",margin:"0 0 10px"}}>
              Right now your Facebook ad links to <strong style={{color:"var(--text)"}}>theatre4u.org</strong> — so when someone clicks it,
              the analytics can't tell if they came from your ad or just typed the address.
              To fix this, change your ad's destination link to:
            </p>
            <code style={{display:"block",background:"var(--parch)",border:"1px solid var(--border)",padding:"8px 12px",borderRadius:6,fontSize:12,wordBreak:"break-all",color:"var(--cog)",fontWeight:700}}>
              theatre4u.org/join.html?utm_source=facebook&utm_medium=paid&utm_campaign=beta-spring26
            </code>
            <p style={{color:"var(--muted)",margin:"10px 0 0",fontSize:12}}>
              After that, every click from your ad will show up as "facebook" in the Traffic Sources above — so you can see exactly how many visitors and signups your ad is generating.
              Change it in Meta Ads Manager → your ad → Edit → Destination URL.
            </p>
          </div>
        </div>
      )}

      {/* ── FEEDBACK ── */}
      {!loading&&tab==="feedback"&&(
        <div>
          <h3 style={{fontFamily:"var(--serif)",fontSize:18,marginBottom:4}}>User Feedback</h3>
          <p style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>Submitted via the feedback button in the app. Use status to track resolution.</p>
          {feedback.length===0
            ?<div style={{color:"var(--muted)",fontSize:13,padding:32,textAlign:"center"}}>No feedback yet.</div>
            :<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {feedback.map(f=>(
                <div key={f.id} style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:18}}>{f.category==="bug"?"🐛":f.category==="feature"?"✨":f.category==="ux"?"👁":"💬"}</span>
                        <span style={{fontWeight:700,fontSize:13}}>{f.org_name||"Anonymous"}</span>
                        <span style={{fontSize:11,color:"var(--muted)",textTransform:"capitalize",background:"var(--border)",padding:"1px 6px",borderRadius:4}}>{f.category}</span>
                        {f.rating&&<span style={{fontSize:11,color:"var(--goldink)"}}>{("★").repeat(f.rating)}{("☆").repeat(5-f.rating)}</span>}
                        <span style={{fontSize:11,color:"var(--muted)"}}>{new Date(f.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                      </div>
                      <div style={{fontSize:13,color:"var(--text)",lineHeight:1.6}}>{f.message||"(no message)"}</div>
                      {f.page_context&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>Page: {f.page_context}</div>}
                    </div>
                    <select value={f.status||"new"} onChange={e=>updateFeedback(f.id,e.target.value)}
                      style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"4px 8px",fontSize:12,color:"var(--text)",cursor:"pointer",flexShrink:0}}>
                      {["new","reviewing","resolved","wont_fix"].map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* ── LABEL ORDERS ── */}
      {!loading&&tab==="labels"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}}>
            <div>
              <h3 style={{fontFamily:"var(--serif)",fontSize:18,margin:"0 0 2px"}}>🏷 Label Orders</h3>
              <p style={{fontSize:13,color:"var(--muted)",margin:0}}>
                {labelOrders.length} orders · {labelOrders.filter(o=>o.status==="pending").length} pending fulfillment
              </p>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-o btn-sm" onClick={async()=>{
                const pending = labelOrders.filter(o=>o.status==="pending"||o.status==="processing");
                if(pending.length===0){alert("No pending orders to export.");return;}
                const orderIds = pending.map(o=>o.id);
                const {data:labels} = await SB.from("label_pool")
                  .select("code,seq,order_id,org_id,label_type,status,item_id,item_name:items(name),item_category:items(category)")
                  .in("order_id",orderIds)
                  .in("status",["assigned","claimed"])
                  .order("seq");
                if(!labels||labels.length===0){alert("No labels found for pending orders.");return;}
                const rows = ["QR_Data,Label_Text,Substrate,Item_Name,Item_Category,Order_ID,Org"];
                labels.forEach(l=>{
                  const order = pending.find(o=>o.id===l.order_id);
                  const url = "https://theatre4u.org/#/item/"+l.code;
                  const substrate = l.label_type||order?.label_type||"sticky";
                  const itemName = l.item_name||"";
                  const itemCat  = l.item_category||"";
                  rows.push('"'+url+'","'+l.code+'","'+substrate+'","'+itemName+'","'+itemCat+'","'+l.order_id+'","'+(order?.org_name||"")+'"');
                });
                const csv = rows.join("\n");
                const blob = new Blob([csv],{type:"text/csv"});
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `theatre4u_labels_${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}>
                ⬇ Export CSV for WePrintBarcodes
              </button>
              <button className="btn btn-o btn-sm" onClick={()=>setTab("labels")}>↺ Refresh</button>
            </div>
          </div>

          <div style={{background:"rgba(33,150,243,.05)",border:"1px solid rgba(33,150,243,.2)",
            borderRadius:10,padding:"14px 16px",marginBottom:20}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"var(--text)"}}>
              📋 Fulfillment Workflow — WePrintBarcodes.com
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {[
                {n:"1",t:"Export CSV",b:'Click "Export CSV for WePrintBarcodes" above. The file contains one row per label with the QR URL and label text.'},
                {n:"2",t:"Go to WePrintBarcodes",b:'Visit weprintbarcodes.com → QR Code Labels. Select your label size (1.5"×1.5" recommended) and material.'},
                {n:"3",t:"Upload CSV",b:'Choose "Variable Data" or "Sequential QR Codes". Upload your CSV file. The QR_Data column becomes the encoded URL.'},
                {n:"4",t:"Proof & order",b:"Review the digital proof. Set ship-to as the program's address from the delivery_addr column. Place order."},
                {n:"5",t:"Update status",b:"Once shipped, paste the tracking number below and change status to Shipped. The program sees this in their Labels tab."},
              ].map(s=>(
                <div key={s.n} style={{background:"var(--white)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--border)"}}>
                  <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div style={{background:"#2196f3",color:"#fff",borderRadius:"50%",width:22,height:22,
                      minWidth:22,display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,fontWeight:800,flexShrink:0}}>{s.n}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:12,marginBottom:3}}>{s.t}</div>
                      <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.4}}>{s.b}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,display:"flex",gap:12,flexWrap:"wrap",fontSize:12,color:"var(--muted)"}}>
              <span>🔗 <a href="https://www.weprintbarcodes.com/qr-code-labels.html" target="_blank" rel="noreferrer" style={{color:"var(--goldink)"}}>WePrintBarcodes QR Labels ↗</a></span>
              <span>📏 Recommended size: 1.5" × 1.5"</span>
              <span>🏷 Material: polyester matte (indoor) or vinyl weatherproof</span>
            </div>
          </div>

          {labelOrders.length===0?(
            <div style={{color:"var(--muted)",fontSize:13,padding:32,textAlign:"center",
              background:"var(--parch)",borderRadius:10,border:"1px solid var(--border)"}}>
              No label orders yet. Once programs order labels from the Labels page, they'll appear here.
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {labelOrders.map(o=>{
                let addr = null;
                try { addr = JSON.parse(o.delivery_addr||"{}"); } catch(e){}
                return(
                  <div key={o.id} style={{background:"var(--parch)",border:"1px solid var(--border)",
                    borderRadius:10,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",
                      alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:10}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15}}>{o.org_name}</div>
                        <div style={{fontSize:12,color:"var(--muted)"}}>
                          <a href={"mailto:"+o.contact_email} style={{color:"var(--goldink)"}}>{o.contact_email}</a>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontWeight:800,fontSize:18,color:"var(--goldink)"}}>{o.item_count}</span>
                        <span style={{fontSize:12,color:"var(--muted)",textTransform:"capitalize"}}>{o.label_type} labels</span>
                        <select value={o.status} onChange={e=>updateLabelOrder(o.id,{status:e.target.value})}
                          style={{background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,
                            padding:"4px 8px",fontSize:12,color:"var(--text)",cursor:"pointer"}}>
                          {["pending","processing","shipped","delivered"].map(s=>(
                            <option key={s} value={s}>
                              {s==="pending"?"⏳ Pending":s==="processing"?"🔄 Processing":s==="shipped"?"✈ Shipped":"✓ Delivered"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {o.code_start&&(
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.5}}>Label range:</span>
                        <code style={{fontSize:12,fontFamily:"monospace",color:"var(--amber)",
                          background:"rgba(196,118,26,.1)",padding:"2px 8px",borderRadius:4}}>
                          {o.code_start} → {o.code_end}
                        </code>
                        <span style={{fontSize:11,color:"var(--muted)"}}>({o.item_count} labels)</span>
                      </div>
                    )}
                    {addr&&addr.street&&(
                      <div style={{fontSize:12,color:"var(--muted)",marginBottom:8,display:"flex",gap:6,alignItems:"flex-start"}}>
                        <span>📦</span>
                        <span>{addr.name} · {addr.street}, {addr.city}, {addr.state} {addr.zip}</span>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <input
                        defaultValue={o.tracking||""}
                        placeholder="Add tracking number…"
                        onBlur={async e=>{
                          const v=e.target.value.trim();
                          if(v&&v!==o.tracking){
                            await updateLabelOrder(o.id,{tracking:v,
                              status:o.status==="pending"||o.status==="processing"?"shipped":o.status});
                          }
                        }}
                        style={{flex:1,minWidth:180,background:"var(--white)",border:"1px solid var(--border)",
                          borderRadius:6,padding:"5px 10px",fontSize:12,color:"var(--text)",fontFamily:"monospace"}}/>
                      <span style={{fontSize:11,color:"var(--faint)"}}>
                        {new Date(o.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                      </span>
                      {o.amount_cents>0&&<span style={{fontSize:12,fontWeight:700,color:"#4caf50"}}>
                        ${(o.amount_cents/100).toFixed(2)}
                      </span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <PoolHealthWidget/>
        </div>
      )}

      {/* ── PROGRAMS (GOD MODE) ── */}
      {!loading&&tab==="programs"&&(
        <AdminProgramsTab orgs={orgs} currentUser={currentUser} flash={flash}/>
      )}

      {!loading&&tab==="accounts"&&(<AdminAccountsTab orgs={orgs} onRestore={(id)=>{ setOrgs(p=>p.map(o=>o.id===id?{...o,account_status:"active"}:o)); flash("✓ Restored"); }}/>)}
      {!loading&&tab==="districts"&&(<AdminDistrictAssignPanel orgs={orgs} onUpdated={()=>{ SB.rpc("get_admin_org_overview").then(({data})=>{ if(data) setOrgs(data); }); flash("✓ Updated"); }}/>)}

      {/* ── TOOLS ── */}
      {!loading&&tab==="tools"&&(
        <div>
          <div style={{marginBottom:28}}>
            <h3 style={{fontFamily:"var(--serif)",fontSize:22,marginBottom:4}}>Quick Actions</h3>
            <p style={{fontSize:14,color:"var(--muted)"}}>
              One-click actions for managing your programs, plus previews of what new users see.
            </p>
          </div>

          {/* ── Preview what new users see ── */}
          <div style={{background:"rgba(33,150,243,.05)",border:"1px solid rgba(33,150,243,.2)",
            borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>
              👁 Preview as a New User
            </div>
            <p style={{fontSize:13,color:"var(--muted)",marginBottom:14,lineHeight:1.6}}>
              Since you're already signed in, you can't experience the signup and onboarding flow
              normally. Use these links to preview exactly what a first-time visitor sees.
            </p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
              {[
                {ico:"🎭",title:"Full Interactive Demo",desc:"The real app with sample data. Shows signup → onboarding → full platform. Opens in a new tab.",
                  url:"/?demo=1",btn:"Open Demo"},
                {ico:"👁",title:"Quick Platform Preview",desc:"The lightweight read-only preview tour. Quick look at inventory and Exchange.",
                  url:"/?preview=1",btn:"Open Preview"},
                {ico:"🏠",title:"Landing Page",desc:"What visitors see before they sign up. Check hero copy, plans, features.",
                  url:"/",btn:"View Landing"},
                {ico:"📝",title:"Signup Form Copy",desc:"Open the demo and click 'Start Free Account' to see the signup form and beta messaging.",
                  url:"/?demo=1",btn:"Open Demo → Sign Up"},
              ].map(p=>(
                <div key={p.title} style={{background:"var(--parch)",border:"1px solid var(--border)",
                  borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:22,marginBottom:6}}>{p.ico}</div>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{p.title}</div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5,marginBottom:12}}>{p.desc}</div>
                  <a href={p.url} target="_blank" rel="noreferrer"
                    style={{display:"inline-block",padding:"6px 14px",borderRadius:7,
                      background:"rgba(33,150,243,.15)",color:"#42a5f5",
                      border:"1px solid rgba(33,150,243,.3)",fontSize:12,fontWeight:700,
                      textDecoration:"none"}}>
                    {p.btn} ↗
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* ── Current beta messaging reference ── */}
          <div style={{background:"rgba(212,168,67,.05)",border:"1px solid rgba(212,168,67,.2)",
            borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:10}}>📋 Current Beta Messaging</div>
            <p style={{fontSize:13,color:"var(--muted)",marginBottom:12,lineHeight:1.6}}>
              This is what new users see when they sign up. Review and update here before pushing changes.
            </p>
            <div style={{background:"rgba(0,0,0,.15)",borderRadius:8,padding:"14px 16px",
              border:"1px solid rgba(212,168,67,.15)"}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--goldink)",marginBottom:6}}>
                ⭐ Free Pro Access During Beta — shown on signup form
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.75)",lineHeight:1.7}}>
                "All programs that sign up during Theatre4u's beta phase get full Pro access at no charge.
                When Theatre4u launches, beta programs that have added 25+ items and shared feedback
                will receive a <strong>founding member rate of $9.99/month</strong> — instead of the standard $15 —
                locked in for as long as you subscribe."
              </div>
            </div>
            <div style={{background:"rgba(0,0,0,.15)",borderRadius:8,padding:"14px 16px",
              border:"1px solid rgba(212,168,67,.15)",marginTop:10}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--goldink)",marginBottom:6}}>
                ⭐ Dashboard banner — shown to all beta users
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.75)",lineHeight:1.7}}>
                "Full Pro access — complimentary during Theatre4u beta.
                Beta programs that add 25+ items and share feedback will receive a
                <strong> founding member discount — $9.99/month instead of $15 — locked in for life.</strong>"
              </div>
            </div>
            <div style={{marginTop:10,fontSize:11,color:"var(--muted)",lineHeight:1.5,
              padding:"8px 12px",background:"rgba(0,0,0,.1)",borderRadius:6}}>
              To change this messaging, update the copy in the Dashboard component (isTempPro banner)
              and the AuthOverlay signup form (beta notice box). Ask to update these any time.
            </div>
          </div>

          {/* Grant / Revoke Temp Pro */}
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,
            padding:20,marginBottom:16}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
              <span style={{fontSize:28,flexShrink:0}}>⭐</span>
              <div>
                <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Grant or Remove Beta Pro Access</div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
                  Use this to give any program full Pro access during the beta — or take it away.
                  Go to the <strong style={{color:"var(--text)"}}>Users &amp; Leads</strong> tab,
                  find the program you want to update, then click the <strong style={{color:"var(--goldink)"}}>⭐ Pro</strong> button
                  next to their name. It toggles on and off instantly.
                </div>
              </div>
            </div>
            <button onClick={()=>setTab("users")} style={{padding:"10px 22px",borderRadius:8,
              background:"var(--gold)",color:"#1a0f00",border:"none",
              fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
              Go to Users &amp; Leads →
            </button>
          </div>

          {/* Email a program */}
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,
            padding:20,marginBottom:16}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
              <span style={{fontSize:28,flexShrink:0}}>✉️</span>
              <div>
                <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Email a Program</div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
                  Go to <strong style={{color:"var(--text)"}}>Users &amp; Leads</strong>, find the program,
                  and click the <strong style={{color:"var(--goldink)"}}>✉ Email</strong> link next to their name.
                  It opens a pre-addressed email in your mail app so you can write to them directly.
                </div>
              </div>
            </div>
            <button onClick={()=>setTab("users")} style={{padding:"10px 22px",borderRadius:8,
              background:"transparent",color:"var(--text)",border:"1px solid var(--border)",
              fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
              Go to Users &amp; Leads →
            </button>
          </div>

          {/* Award Stage Points */}
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,
            padding:20,marginBottom:16}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:4}}>
              <span style={{fontSize:28,flexShrink:0}}>💰</span>
              <div>
                <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Award Stage Points</div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
                  Reward a program for giving great feedback or referring a new school.
                  Go to the <strong style={{color:"var(--text)"}}>Feedback</strong> tab and use
                  the <strong style={{color:"var(--goldink)"}}>🎁 Award Points</strong> button on any feedback entry.
                  The points appear in their account immediately.
                </div>
              </div>
            </div>
          </div>

          {/* Label order fulfillment */}
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,
            padding:20,marginBottom:16}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
              <span style={{fontSize:28,flexShrink:0}}>🏷</span>
              <div>
                <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Process a Label Order</div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
                  When a program requests labels, go to the
                  <strong style={{color:"var(--text)"}}> Label Orders</strong> tab.
                  Export the CSV for WePrintBarcodes, then enter the tracking number
                  when the labels ship. The program sees their order status update automatically.
                </div>
              </div>
            </div>
            <button onClick={()=>setTab("labels")} style={{padding:"10px 22px",borderRadius:8,
              background:"transparent",color:"var(--text)",border:"1px solid var(--border)",
              fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
              Go to Label Orders →
            </button>
          </div>

          {/* Check feedback */}
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,
            padding:20,marginBottom:16}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
              <span style={{fontSize:28,flexShrink:0}}>💬</span>
              <div>
                <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Review User Feedback</div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
                  See everything programs have submitted through the Leading Players feedback button.
                  You can mark items as reviewed, resolved, or won't fix — and award points for great reports.
                </div>
              </div>
            </div>
            <button onClick={()=>setTab("feedback")} style={{padding:"10px 22px",borderRadius:8,
              background:"transparent",color:"var(--text)",border:"1px solid var(--border)",
              fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
              Go to Feedback →
            </button>
          </div>

          {/* Label pricing reference */}
          <div style={{background:"rgba(212,168,67,.06)",border:"1px solid rgba(212,168,67,.2)",
            borderRadius:12,padding:20,marginBottom:16}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:28,flexShrink:0}}>💵</span>
              <div>
                <div style={{fontWeight:700,fontSize:16,marginBottom:8,color:"var(--goldink)"}}>
                  Label Pricing Reference
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    ["Standard sticky vinyl",  "$0.40/label + $6.95 shipping"],
                    ["Iron-on (costumes)",      "$0.56/label + $6.95 shipping"],
                    ["Logo add-on",             "+$5.00 per order"],
                    ["Minimum order",           "25 labels"],
                  ].map(([label,val])=>(
                    <div key={label} style={{background:"rgba(0,0,0,.15)",borderRadius:8,padding:"10px 14px"}}>
                      <div style={{fontSize:12,color:"var(--muted)",marginBottom:3}}>{label}</div>
                      <div style={{fontSize:15,fontWeight:700,color:"var(--text)"}}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:10,lineHeight:1.6}}>
                  These are retail prices charged to programs. Our cost from WePrintBarcodes is approximately
                  $0.12–0.15/label (standard) and $0.22–0.25/label (weatherproof).
                  Confirm exact costs after each WePrintBarcodes call.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DistrictDashboard({ user, plan, onSwitchSchool }) {
  const [district,   setDistrict]   = useState(null);
  const [schools,    setSchools]    = useState([]);
  const [invites,    setInvites]    = useState([]);
  const [itemCounts, setItemCounts] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("schools"); // schools | invites | inventory
  const [distItems,  setDistItems]  = useState([]);
  const [distView,   setDistView]   = useState("grid");
  const [distSchoolF,setDistSchoolF]= useState("all");
  const [distProgF,  setDistProgF]  = useState("all");
  const [distLoading,setDistLoading]= useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail,   setInvEmail]   = useState("");
  const [invSchool,  setInvSchool]  = useState("");
  const [sending,    setSending]    = useState(false);
  const [msg,        setMsg]        = useState("");
  const [dirSchool,  setDirSchool]  = useState(null); // school whose directors modal is open
  const [dirList,    setDirList]    = useState([]);
  const [dirEmail,   setDirEmail]   = useState("");
  const [dirBusy,    setDirBusy]    = useState(false);
  const [dirVertical,setDirVertical]= useState(""); // "" = all programs (whole account)
  const [showFac,    setShowFac]    = useState(false);
  const [facList,    setFacList]    = useState([]);
  const [facEmail,   setFacEmail]   = useState("");
  const [facBusy,    setFacBusy]    = useState(false);
  const [facMsg,     setFacMsg]     = useState("");

  const openDirectors = async (school) => {
    setDirSchool(school); setDirEmail(""); setDirList([]); setDirVertical("");
    const { data } = await SB.from("org_members")
      .select("id,email,role,joined_at,vertical").eq("org_id", school.id).eq("role","program_director");
    setDirList(data || []);
  };
  const addDirector = async () => {
    const email = dirEmail.trim().toLowerCase();
    if (!email || !dirSchool) return;
    setDirBusy(true);
    // The director must already have an account (their org.id = their auth user id)
    const { data: acct } = await SB.from("orgs").select("id").eq("email", email).single();
    if (!acct) { setMsg("❌ No account found for "+email+". Ask them to sign up first, then assign."); setDirBusy(false); return; }
    const { error } = await SB.from("org_members").upsert({
      org_id: dirSchool.id, user_id: acct.id, email, role: "program_director", vertical: dirVertical || null,
      invited_by: user.id, joined_at: new Date().toISOString()
    }, { onConflict: "org_id,user_id" });
    setDirBusy(false);
    if (error) { setMsg("❌ "+error.message); return; }
    setDirList(p => [...p.filter(d=>d.email!==email), { email, role:"program_director", vertical: dirVertical || null, joined_at:new Date().toISOString() }]);
    setDirEmail(""); setDirVertical("");
    setMsg("✅ "+email+" assigned as program director");
  };
  const removeDirector = async (email) => {
    if (!dirSchool) return;
    await SB.from("org_members").delete().eq("org_id", dirSchool.id).eq("email", email).eq("role","program_director");
    setDirList(p => p.filter(d=>d.email!==email));
    setMsg("✅ Director removed");
  };

  // ── District-wide Arts Facilitators (full edit across all schools) ──────────
  const openFacilitators = async () => {
    setShowFac(true); setFacEmail(""); setFacMsg("");
    if (!district) return;
    const { data } = await SB.from("district_members")
      .select("id,email,role,joined_at").eq("district_id", district.id).eq("role","facilitator");
    setFacList(data || []);
  };
  const addFacilitator = async () => {
    const email = facEmail.trim().toLowerCase();
    if (!email || !district) return;
    setFacBusy(true);
    const { data: acct } = await SB.from("orgs").select("id").eq("email", email).single();
    if (!acct) { setFacMsg("❌ No account found for "+email+". Ask them to sign up first, then add them."); setFacBusy(false); return; }
    const { error } = await SB.from("district_members").upsert({
      district_id: district.id, user_id: acct.id, email, role: "facilitator", invited_by: user.id
    }, { onConflict: "district_id,email" });
    setFacBusy(false);
    if (error) { setFacMsg("❌ "+error.message); return; }
    setFacList(p => [...p.filter(f=>f.email!==email), { email, role:"facilitator", joined_at:new Date().toISOString() }]);
    setFacEmail("");
    setFacMsg("✅ "+email+" added as a facilitator");
  };
  const removeFacilitator = async (email) => {
    if (!district) return;
    await SB.from("district_members").delete().eq("district_id", district.id).eq("email", email).eq("role","facilitator");
    setFacList(p => p.filter(f=>f.email!==email));
    setFacMsg("✅ Facilitator removed");
  };

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

  const loadDistInventory = useCallback(async () => {
    if (!district || !schools.length) return;
    setDistLoading(true);
    const ids = schools.map(sc => sc.id);
    const { data } = await SB.from("items")
      .select("id,name,category,condition,qty,avail,location,img,vertical,low_stock_threshold,org_id,orgs(name,vertical)")
      .in("org_id", ids).order("added",{ascending:false}).limit(500);
    setDistItems(data || []);
    setDistLoading(false);
  }, [district, schools]);

  useEffect(() => { if (plan === "district") load(); }, [load, plan]);
  useEffect(() => { if (tab === "inventory") loadDistInventory(); }, [tab, loadDistInventory]);

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
            <div className="hero-eyebrow">🏢 District Plan</div>
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
          {["schools", "invites", "inventory"].map(t => (
            <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}
              style={{ textTransform: "capitalize" }}>
              {t==="schools" ? `🏫 Schools (${slotsUsed})` : t==="invites" ? `📨 Invites (${invites.filter(i=>i.status==="pending").length})` : `📦 Inventory (${distItems.length})`}
            </button>
          ))}
          <button className="btn btn-o btn-sm" style={{ marginLeft: "auto" }}
            onClick={openFacilitators}>
            👥 Facilitators
          </button>
          <button className="btn btn-g btn-sm"
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    <button className="btn btn-g btn-sm" onClick={() => onSwitchSchool(school)}>
                      Enter School →
                    </button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-o btn-sm" style={{ flex: 1, minWidth: 0 }} onClick={() => openDirectors(school)}>
                        👤 Directors
                      </button>
                      <button className="btn btn-o btn-sm" style={{ flex: 1, minWidth: 0, color: "rgba(255,100,100,.7)", borderColor: "rgba(255,100,100,.2)" }}
                        onClick={() => removeSchool(school.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === "invites" ? (
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
        ) : (
          /* Inventory tab */
          <div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
              <select value={distSchoolF} onChange={e=>setDistSchoolF(e.target.value)} style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--linen)",fontSize:13}}>
                <option value="all">All Schools</option>
                {schools.map(sc=><option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
              <select value={distProgF} onChange={e=>setDistProgF(e.target.value)} style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--linen)",fontSize:13}}>
                <option value="all">All Programs</option>
                {[...new Set(schools.map(sc=>sc.vertical||"theatre"))].map(v=><option key={v} value={v}>{getVertical(v).icon} {getVertical(v).label}</option>)}
              </select>
              <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                <button onClick={()=>setDistView("grid")} className={`btn btn-sm ${distView==="grid"?"btn-g":"btn-o"}`}>⊞ Grid</button>
                <button onClick={()=>setDistView("table")} className={`btn btn-sm ${distView==="table"?"btn-g":"btn-o"}`}>≡ Table</button>
              </div>
            </div>
            {distLoading ? (
              <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>Loading inventory…</div>
            ) : (()=>{
              let fi=distItems;
              if(distSchoolF!=="all") fi=fi.filter(i=>i.org_id===distSchoolF);
              if(distProgF!=="all") fi=fi.filter(i=>(i.orgs?.vertical||i.vertical||"theatre")===distProgF);
              if(!fi.length) return(<div className="empty" style={{padding:40}}><div className="empty-ico">📦</div><h3>No items found</h3><p>Adjust your filters or invite more schools.</p></div>);
              if(distView==="table") return(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead><tr style={{borderBottom:"2px solid var(--border)"}}>
                      {["School","Program","Item","Category","Condition","Qty","Availability","Location"].map(h=>(
                        <th key={h} style={{padding:"8px 10px",textAlign:"left",color:"var(--muted)",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{fi.map(item=>(
                      <tr key={item.id} style={{borderBottom:"1px solid var(--border)"}}>
                        <td style={{padding:"8px 10px",whiteSpace:"nowrap",fontSize:12}}>{item.orgs?.name||"—"}</td>
                        <td style={{padding:"8px 10px"}}>{getVertical(item.orgs?.vertical||item.vertical||"theatre").icon}</td>
                        <td style={{padding:"8px 10px",fontWeight:600}}>{item.name}</td>
                        <td style={{padding:"8px 10px",fontSize:12}}>{item.category}</td>
                        <td style={{padding:"8px 10px",fontSize:12}}>{item.condition}</td>
                        <td style={{padding:"8px 10px",textAlign:"center"}}>{item.qty}</td>
                        <td style={{padding:"8px 10px",fontSize:12}}>{item.avail}</td>
                        <td style={{padding:"8px 10px",color:"var(--muted)",fontSize:12}}>{item.location||"—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              );
              return(
                <div className="inv-grid">{fi.map(item=>(
                  <div key={item.id} className="inv-card">
                    <div className="inv-img">
                      {item.img?<img src={item.img} alt={item.name} loading="lazy"/>
                        :<CatCard catId={item.category} vertical={item.orgs?.vertical||item.vertical||"theatre"} width="100%" height={220}><div style={{padding:"0 14px 12px",color:"#fff"}}></div></CatCard>}
                    </div>
                    <div className="inv-info">
                      <div style={{fontSize:10,color:"var(--muted)",fontWeight:600,marginBottom:2}}>{item.orgs?.name||""} · {getVertical(item.orgs?.vertical||item.vertical||"theatre").label}</div>
                      <div className="inv-name">{item.name}</div>
                      <div className="inv-meta">
                        <span className="chip">{item.condition}</span>
                        <span className="chip">×{item.qty}</span>
                        {item.low_stock_threshold>0&&item.qty<=item.low_stock_threshold&&<span className="chip" style={{background:"rgba(230,74,25,.18)",color:"#ff7043",fontWeight:800}}>⚠ Low Stock</span>}
                        <span className="chip">{item.avail}</span>
                      </div>
                    </div>
                  </div>
                ))}</div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Directors Modal */}
      {dirSchool && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={()=>setDirSchool(null)}>
          <div className="card card-p" style={{ maxWidth:460, width:"100%" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontFamily:"var(--serif)", marginBottom:4 }}>Program Directors</h3>
            <p style={{ fontSize:13, color:"var(--muted)", marginBottom:16 }}>
              {dirSchool.name} — directors see only this program's inventory. Assign the same person to several schools to make them a multi-program coordinator.
            </p>
            {dirList.length>0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                {dirList.map(d=>(
                  <div key={d.email} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--parch)", borderRadius:8, border:"1px solid var(--border)" }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{d.email}<span style={{ display:"block", fontSize:11, fontWeight:500, color:"var(--muted)" }}>{d.vertical ? (getVertical(d.vertical).icon+" "+getVertical(d.vertical).label) : "All programs"}</span></div>
                    <button onClick={()=>removeDirector(d.email)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid rgba(194,24,91,.3)", background:"transparent", color:"var(--red)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color:"var(--muted)", fontSize:13, marginBottom:16 }}>No directors assigned yet.</div>
            )}
            <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>Assign a director</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <input className="fi" type="email" placeholder="director@email.com" value={dirEmail}
                onChange={e=>setDirEmail(e.target.value)} style={{ flex:1, minWidth:160 }}/>
              {(() => {
                const dv = (dirSchool.verticals_enabled && dirSchool.verticals_enabled.length) ? dirSchool.verticals_enabled : [dirSchool.vertical||"theatre"];
                return dv.length>1 ? (
                  <select className="fs" value={dirVertical} onChange={e=>setDirVertical(e.target.value)} style={{ flex:"0 0 auto" }}>
                    <option value="">All programs</option>
                    {dv.map(v=><option key={v} value={v}>{getVertical(v).icon} {getVertical(v).label}</option>)}
                  </select>
                ) : null;
              })()}
              <button className="btn btn-g btn-sm" disabled={dirBusy} onClick={addDirector}>{dirBusy?"…":"Assign"}</button>
            </div>
            <p style={{ fontSize:11, color:"var(--muted)", marginTop:8 }}>
              They must have an ArtsTracker account first. They'll see this program's inventory next time they log in.
            </p>
            <button className="btn btn-o btn-sm" style={{ marginTop:16, width:"100%" }} onClick={()=>setDirSchool(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Arts Facilitators Modal (district-wide) */}
      {showFac && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={()=>setShowFac(false)}>
          <div className="card card-p" style={{ maxWidth:460, width:"100%" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontFamily:"var(--serif)", marginBottom:4 }}>Arts Facilitators</h3>
            <p style={{ fontSize:13, color:"var(--muted)", marginBottom:16 }}>
              Facilitators can view and edit inventory across every school in your district. Use this for district arts coordinators who support all programs.
            </p>
            {facList.length>0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                {facList.map(f=>(
                  <div key={f.email} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--parch)", borderRadius:8, border:"1px solid var(--border)" }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{f.email}<span style={{ display:"block", fontSize:11, fontWeight:500, color:"var(--muted)" }}>All schools · full edit</span></div>
                    <button onClick={()=>removeFacilitator(f.email)} style={{ padding:"3px 10px", borderRadius:6, border:"1px solid rgba(194,24,91,.3)", background:"transparent", color:"var(--red)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color:"var(--muted)", fontSize:13, marginBottom:16 }}>No facilitators yet.</div>
            )}
            <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>Add a facilitator</div>
            <div style={{ display:"flex", gap:8 }}>
              <input className="fi" type="email" placeholder="facilitator@email.com" value={facEmail}
                onChange={e=>setFacEmail(e.target.value)} style={{ flex:1 }}/>
              <button className="btn btn-g btn-sm" disabled={facBusy} onClick={addFacilitator}>{facBusy?"…":"Add"}</button>
            </div>
            {facMsg && <p style={{ fontSize:12, color: facMsg.startsWith("✅")?"var(--green)":"var(--red)", marginTop:8 }}>{facMsg}</p>}
            <p style={{ fontSize:11, color:"var(--muted)", marginTop:8 }}>
              They must have an ArtsTracker account first. They'll get district access next time they log in.
            </p>
            <button className="btn btn-o btn-sm" style={{ marginTop:16, width:"100%" }} onClick={()=>setShowFac(false)}>Done</button>
          </div>
        </div>
      )}

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

            <div style={{ marginTop: 16 }}>
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
                Send an invite link by email. The school director can accept by signing into their existing Theatre4u™ account
                or by creating a new one. You have <strong>{slotsTotal - slotsUsed}</strong> slot{slotsTotal - slotsUsed !== 1 ? "s" : ""} remaining.
              </p>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label className="fl">School Director Email *</label>
                <input className="fi" type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)}
                  placeholder="director@school.edu" autoFocus
                  onKeyDown={e => e.key === "Enter" && sendInvite()} />
              </div>
              <div className="fg" style={{ marginBottom: 16 }}>
                <label className="fl">School Name (optional)</label>
                <input className="fi" value={invSchool} onChange={e => setInvSchool(e.target.value)}
                  placeholder="e.g. Coppell Middle School West" />
              </div>
              {msg && <div style={{ color: msg.startsWith("✓") ? "var(--green)" : "var(--red)",
                marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-o" onClick={() => setShowInvite(false)}>Cancel</button>
                <button className="btn btn-g" onClick={sendInvite} disabled={!invEmail.trim() || sending}>
                  {sending ? "Sending…" : "Send Invite →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminEditOrgModal({ org, onClose, onSaved }) {
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
      <div style={{ background:"var(--cream)",border:"1px solid var(--border)",
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

export function AdminCloseOrgModal({ org, currentUser, onClose, onClosed, onHardDeleted }) {
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
      <div style={{ background:"var(--cream)",border:"1.5px solid rgba(194,24,91,.4)",
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

export function AdminAccountsTab({ orgs, onRestore }) {
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

export function AdminDistrictAssignPanel({ orgs, onUpdated }) {
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
              borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--goldink)",
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
              style={{ background: "none", border: "none", color: "var(--goldink)",
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

export function AdminOrgInventoryEditor({ org, onBack }) {
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

export function AdminEditItemModal({ item, onClose, onSaved }) {
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
      low_stock_threshold: parseInt(f.low_stock_threshold) || 0,
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
      <div style={{ background:"var(--cream)",border:"1px solid var(--border)",
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

export function AdminDailyDigest() {
  const [window_, setWindow_] = useState("24h"); // "24h" | "7d" | "30d"
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const WINDOWS = [
    { id:"24h", label:"Last 24h", ms: 24*60*60*1000 },
    { id:"7d",  label:"Last 7d",  ms: 7*24*60*60*1000 },
    { id:"30d", label:"Last 30d", ms: 30*24*60*60*1000 },
  ];

  const load = useCallback(async (win) => {
    setLoading(true);
    const ms   = WINDOWS.find(w=>w.id===win)?.ms || 24*60*60*1000;
    const since = new Date(Date.now() - ms).toISOString();

    const [
      {data:newOrgs},
      {data:newItems},
      {data:newLeads},
      {data:emailsSent},
      {data:pvRows},
      {data:loginRows},
      {data:msgs},
      {data:fbRows},
    ] = await Promise.all([
      SB.from("orgs").select("id,name,email,plan,created_at").gte("created_at",since).order("created_at",{ascending:false}),
      SB.from("items").select("id,name,category,org_id,added").gte("added",since).order("added",{ascending:false}).limit(200),
      SB.from("beta_leads").select("id,name,email,org,created_at").gte("created_at",since).order("created_at",{ascending:false}),
      SB.from("email_sequence").select("id,org_id,email_num,sent_at").gte("sent_at",since).order("sent_at",{ascending:false}),
      SB.from("page_views").select("page,session_id,created_at,utm_source,utm_medium,utm_campaign,referrer").gte("created_at",since),
      SB.from("login_events").select("id,org_id,org_name,email,plan,session_id,user_agent,referrer,utm_source,created_at").gte("created_at",since).neq("email","theatre4u1@gmail.com").order("created_at",{ascending:false}).limit(200),
      SB.from("messages").select("id,created_at").gte("created_at",since),
      SB.from("beta_feedback").select("id,category,org_name,message,created_at").gte("created_at",since).order("created_at",{ascending:false}),
    ]);

    // Enrich items with org names
    const orgNames = {};
    if ((newItems||[]).length > 0) {
      const ids = [...new Set((newItems||[]).map(i=>i.org_id))];
      const {data:orgData} = await SB.from("orgs").select("id,name").in("id",ids);
      (orgData||[]).forEach(o => { orgNames[o.id] = o.name; });
    }

    // Enrich email_sequence with org names
    const emailsByOrg = {};
    const emailLabels = {1:"Welcome",2:"First Item",3:"Tour",4:"Exchange",5:"Funding",6:"Reports",7:"Free Year"};
    (emailsSent||[]).forEach(e => {
      if (!emailsByOrg[e.org_id]) emailsByOrg[e.org_id] = { name:"", emails:[] };
      emailsByOrg[e.org_id].emails.push(e.email_num);
    });
    if (Object.keys(emailsByOrg).length > 0) {
      const {data:orgData2} = await SB.from("orgs").select("id,name").in("id",Object.keys(emailsByOrg));
      (orgData2||[]).forEach(o => { if(emailsByOrg[o.id]) emailsByOrg[o.id].name = o.name; });
    }

    // Page view aggregation
    const pvByPage = {};
    const pvBySource = {};
    const sessions = new Set();
    (pvRows||[]).forEach(v => {
      pvByPage[v.page] = (pvByPage[v.page]||0) + 1;
      sessions.add(v.session_id);
      const src = v.utm_source || (v.referrer ? (v.referrer.includes("facebook")?"facebook":v.referrer.includes("google")?"google":v.referrer.includes("instagram")?"instagram":"referral") : "direct");
      pvBySource[src] = (pvBySource[src]||0) + 1;
    });

    // Login events aggregation
    const loginByOrg = {};
    (loginRows||[]).forEach(l => {
      if (!loginByOrg[l.org_id||l.email]) {
        loginByOrg[l.org_id||l.email] = { orgName: l.org_name||l.email, plan:l.plan, logins:0, lastAt: l.created_at };
      }
      loginByOrg[l.org_id||l.email].logins++;
    });

    setData({
      newOrgs:      newOrgs||[],
      newItems:     (newItems||[]).map(i=>({...i,orgName:orgNames[i.org_id]||""})),
      newLeads:     newLeads||[],
      emailsSent:   emailsSent||[],
      emailsByOrg,
      emailLabels,
      pageViews:    (pvRows||[]).length,
      uniqueSessions: sessions.size,
      pvByPage,
      pvBySource,
      loginRows:    loginRows||[],
      loginByOrg,
      messages:     msgs||[],
      newFeedback:  fbRows||[],
      generatedAt:  new Date().toLocaleString("en-US",{timeZone:"America/Los_Angeles",
        month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}),
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(window_); }, [window_]);

  const card = {background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10};
  const sectionHead = (icon, title, count) => (
    <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",display:"flex",gap:8,alignItems:"center"}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontWeight:700,fontSize:14}}>{title}{count!=null?" ("+count+")":""}</span>
    </div>
  );

  const allQuiet = data && data.newOrgs.length===0 && data.newItems.length===0 &&
    data.newLeads.length===0 && data.emailsSent.length===0 &&
    data.pageViews===0 && data.newFeedback.length===0 && data.loginRows.length===0;

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h3 style={{fontFamily:"var(--serif)",fontSize:20,margin:"0 0 3px"}}>Daily Activity Digest</h3>
          <p style={{fontSize:12,color:"var(--muted)",margin:0}}>
            Platform activity snapshot for Theatre4u™.
            {data?.generatedAt&&<span> · Generated {data.generatedAt}</span>}
          </p>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {/* Time window switcher */}
          <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
            {WINDOWS.map(w=>(
              <button key={w.id} onClick={()=>setWindow_(w.id)}
                style={{padding:"6px 14px",border:"none",cursor:"pointer",fontSize:12,fontWeight:window_===w.id?700:400,
                  background:window_===w.id?"var(--gold)":"transparent",
                  color:window_===w.id?"#1a0f00":"var(--muted)",fontFamily:"inherit",transition:"all .15s"}}>
                {w.label}
              </button>
            ))}
          </div>
          <button className="btn btn-o btn-sm" onClick={()=>load(window_)} disabled={loading}>
            {loading?"…":"↺"} Refresh
          </button>
        </div>
      </div>

      {loading&&<div style={{textAlign:"center",padding:32,color:"var(--muted)",fontSize:13}}>Loading…</div>}

      {!loading&&data&&(
        <>
          {/* Missed signups alert */}
          {(data.missedSignups||[]).length > 0 && (
            <div style={{background:"rgba(194,24,91,.08)",border:"1px solid rgba(194,24,91,.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:10}}>
              <span style={{fontSize:20}}>⚠️</span>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:"var(--red)",marginBottom:4}}>
                  {data.missedSignups.length} signup notification{data.missedSignups.length>1?"s":""} not yet sent
                </div>
                {data.missedSignups.map((s,i)=>(
                  <div key={i} style={{fontSize:12,color:"var(--muted)",marginBottom:2}}>
                    • {s.org_name} — <a href={`mailto:${s.org_email}`} style={{color:"var(--goldink)"}}>{s.org_email}</a> ({s.plan})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:24}}>
            {[
              {icon:"🎭",label:"New Signups",    n:data.newOrgs.length,                         color:"var(--goldink)"},
              {icon:"👥",label:"Active Users",   n:data.activeUsers||0,                         color:"#4caf50"},
              {icon:"🔑",label:"Logins Today",   n:(data.loginToday||[]).length,                color:"#ff9800"},
              {icon:"📦",label:"Items Added",    n:data.newItems.length,                        color:"#4caf50"},
              {icon:"📥",label:"Beta Leads",     n:data.newLeads.length,                        color:"#2196f3"},
              {icon:"✉️",label:"Emails Sent",    n:data.emailsSent.length,                      color:"#9c27b0"},
              {icon:"👁", label:"Page Views",    n:data.pageViews,                              color:"var(--muted)"},
              {icon:"💬",label:"Messages",       n:data.messages.length,                        color:"#ff9800"},
              {icon:"📋",label:"Feedback",       n:data.newFeedback.length,                     color:"#e91e63"},
            ].map(k=>(
              <div key={k.label} style={{...card,padding:"12px 14px",textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:3}}>{k.icon}</div>
                <div style={{fontSize:24,fontWeight:800,color:k.color,lineHeight:1}}>{k.n}</div>
                <div style={{fontSize:10,color:"var(--muted)",marginTop:3,textTransform:"uppercase",letterSpacing:.4}}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Active users today */}
          {(data.loginToday||[]).length > 0 && (
            <div style={{...card,marginBottom:16}}>
              {sectionHead("🔑","Active Today",(data.loginToday||[]).length)}
              <div style={{padding:"8px 14px"}}>
                {(data.loginToday||[]).map((l,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--linen)"}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:13}}>{l.org_name||l.email}</span>
                      {l.plan&&<span style={{fontSize:11,color:"var(--muted)",marginLeft:8}}>{l.plan}</span>}
                    </div>
                    <span style={{fontSize:11,color:"var(--muted)"}}>{new Date(l.created_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allQuiet&&(
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--muted)"}}>
              <div style={{fontSize:40,marginBottom:12}}>🌙</div>
              <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>All quiet for the selected window</div>
              <div style={{fontSize:13}}>No signups, items, leads, logins, or feedback.</div>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* Traffic Sources */}
            {data.pageViews>0&&(
              <div style={card}>
                {sectionHead("👁","Traffic Sources — "+Object.keys(data.pvBySource).length+" sources")}
                <div style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                  {Object.entries(data.pvBySource).sort(([,a],[,b])=>b-a).map(([src,n])=>(
                    <div key={src} style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14}}>
                        {src==="facebook"?"📘":src==="instagram"?"📸":src==="google"?"🔍":src==="direct"?"🔗":"🌐"}
                      </span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,textTransform:"capitalize"}}>{src}</div>
                        <div style={{height:4,background:"var(--border)",borderRadius:2,marginTop:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:(n/Math.max(...Object.values(data.pvBySource))*100)+"%",background:"var(--gold)",borderRadius:2}}/>
                        </div>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:"var(--goldink)",minWidth:24,textAlign:"right"}}>{n}</span>
                    </div>
                  ))}
                </div>
                <div style={{padding:"8px 14px",borderTop:"1px solid var(--border)",fontSize:11,color:"var(--muted)"}}>
                  Page views by page: {Object.entries(data.pvByPage).sort(([,a],[,b])=>b-a).map(([p,n])=>p+" ("+n+")").join(" · ")}
                </div>
              </div>
            )}

            {/* Who Logged In */}
            {data.loginRows.length>0&&(
              <div style={card}>
                {sectionHead("🔑","Who Logged In",data.loginRows.length)}
                {Object.entries(data.loginByOrg).sort(([,a],[,b])=>b.logins-a.logins).map(([key,entry])=>(
                  <div key={key} style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",
                    display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13}}>{entry.orgName}</span>
                    {entry.plan&&<span style={{fontSize:11,padding:"1px 6px",borderRadius:4,
                      background:entry.plan==="free"?"rgba(100,100,100,.1)":"rgba(212,168,67,.12)",
                      color:entry.plan==="free"?"var(--muted)":"var(--gold)",textTransform:"capitalize"}}>{entry.plan}</span>}
                    <span style={{fontSize:11,color:"var(--muted)",marginLeft:"auto"}}>
                      {entry.logins}×  · last {new Date(entry.lastAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* New Signups */}
            {data.newOrgs.length>0&&(
              <div style={card}>
                {sectionHead("🎭","New Signups",data.newOrgs.length)}
                {data.newOrgs.map(o=>(
                  <div key={o.id} style={{padding:"9px 14px",borderBottom:"1px solid var(--border)",
                    display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13}}>{o.name||"Unnamed"}</span>
                    <a href={"mailto:"+o.email} style={{fontSize:12,color:"var(--goldink)"}}>{o.email}</a>
                    <span style={{fontSize:11,padding:"1px 6px",borderRadius:4,
                      background:o.plan==="free"?"rgba(100,100,100,.1)":"rgba(76,175,80,.1)",
                      color:o.plan==="free"?"var(--muted)":"#4caf50",textTransform:"capitalize"}}>{o.plan||"free"}</span>
                    <span style={{fontSize:11,color:"var(--muted)",marginLeft:"auto"}}>
                      {new Date(o.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Items Added */}
            {data.newItems.length>0&&(
              <div style={card}>
                {sectionHead("📦","Items Added",data.newItems.length)}
                {data.newItems.slice(0,30).map(i=>{
                  const cat = CAT[i.category]||CAT.other;
                  return(
                    <div key={i.id} style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",
                      display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:600}}>{i.name}</span>
                      <span style={{fontSize:11,color:cat.color}}>{cat.icon} {cat.label}</span>
                      <span style={{fontSize:11,color:"var(--muted)"}}>by {i.orgName}</span>
                      <span style={{fontSize:11,color:"var(--muted)",marginLeft:"auto"}}>
                        {new Date(i.added).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})}
                      </span>
                    </div>
                  );
                })}
                {data.newItems.length>30&&<div style={{padding:"8px 14px",fontSize:12,color:"var(--muted)"}}>…and {data.newItems.length-30} more</div>}
              </div>
            )}

            {/* New Beta Leads */}
            {data.newLeads.length>0&&(
              <div style={card}>
                {sectionHead("📥","New Beta Leads",data.newLeads.length)}
                {data.newLeads.map(l=>(
                  <div key={l.id} style={{padding:"9px 14px",borderBottom:"1px solid var(--border)",
                    display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13}}>{l.name}</span>
                    <span style={{fontSize:12,color:"var(--muted)"}}>{l.org}</span>
                    <a href={"mailto:"+l.email} style={{fontSize:12,color:"var(--goldink)"}}>{l.email}</a>
                    <span style={{fontSize:11,color:"var(--muted)",marginLeft:"auto"}}>
                      {new Date(l.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Emails Sent */}
            {data.emailsSent.length>0&&(
              <div style={card}>
                {sectionHead("✉️","Emails Sent",data.emailsSent.length)}
                {Object.entries(data.emailsByOrg).map(([orgId,entry])=>(
                  <div key={orgId} style={{padding:"8px 14px",borderBottom:"1px solid var(--border)",
                    display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:600}}>{entry.name||orgId.slice(0,8)}</span>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {entry.emails.map(n=>(
                        <span key={n} style={{fontSize:11,padding:"1px 7px",borderRadius:5,
                          background:"rgba(212,168,67,.12)",color:"var(--goldink)",fontWeight:600}}>
                          #{n} {data.emailLabels[n]||""}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Feedback */}
            {data.newFeedback.length>0&&(
              <div style={card}>
                {sectionHead("📋","New Feedback",data.newFeedback.length)}
                {data.newFeedback.map(f=>(
                  <div key={f.id} style={{padding:"10px 14px",borderBottom:"1px solid var(--border)"}}>
                    <div style={{display:"flex",gap:8,marginBottom:4,alignItems:"center"}}>
                      <span style={{fontSize:14}}>{f.category==="bug"?"🐛":f.category==="feature"?"✨":"💬"}</span>
                      <span style={{fontWeight:600,fontSize:13}}>{f.org_name||"Anonymous"}</span>
                      <span style={{fontSize:11,color:"var(--muted)",textTransform:"capitalize"}}>{f.category}</span>
                      <span style={{fontSize:11,color:"var(--muted)",marginLeft:"auto"}}>
                        {new Date(f.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"})}
                      </span>
                    </div>
                    <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.5}}>{f.message}</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}

export function AdminPaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [year,     setYear]     = useState(new Date().getFullYear());
  const [view,     setView]     = useState("all"); // all | succeeded | failed | refunded

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const { data } = await SB.from("stripe_payments")
        .select("*")
        .gte("stripe_created_at", year+"-01-01")
        .lt("stripe_created_at", (year+1)+"-01-01")
        .order("stripe_created_at",{ascending:false})
        .limit(500);
      setPayments(data||[]);
      setLoading(false);
    })();
  },[year]);

  const years = [new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2];
  const fmt$  = (cents) => cents ? "$"+(cents/100).toFixed(2) : "—";
  const fmtDt = (dt) => dt ? new Date(dt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";

  const filtered = view==="all" ? payments
    : payments.filter(p => view==="refunded" ? p.refunded : p.status===view);

  const totalRevenue  = payments.filter(p=>p.status==="succeeded"&&!p.refunded).reduce((s,p)=>s+(p.amount_cents||0),0);
  const totalRefunded = payments.filter(p=>p.refunded).reduce((s,p)=>s+(p.refund_amount_cents||0),0);
  const totalFailed   = payments.filter(p=>p.status==="failed").length;

  const card = {background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px"};

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h3 style={{fontFamily:"var(--serif)",fontSize:22,marginBottom:4}}>Payment History</h3>
          <p style={{fontSize:13,color:"var(--muted)"}}>
            Every Stripe payment, subscription, and refund — recorded automatically.
          </p>
        </div>
        {/* Year selector for archiving */}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:12,color:"var(--muted)",fontWeight:700}}>Year:</span>
          {years.map(y=>(
            <button key={y} onClick={()=>setYear(y)}
              style={{padding:"5px 12px",borderRadius:6,border:"1px solid",fontFamily:"inherit",
                fontSize:13,fontWeight:700,cursor:"pointer",
                borderColor:year===y?"var(--gold)":"var(--border)",
                background:year===y?"rgba(212,168,67,.12)":"transparent",
                color:year===y?"var(--gold)":"var(--muted)"}}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        {[
          {ico:"💰",label:"Revenue "+year, val:fmt$(totalRevenue), color:"#4caf50"},
          {ico:"↩️",label:"Refunded",      val:fmt$(totalRefunded),color:"#e53935"},
          {ico:"❌",label:"Failed",        val:totalFailed+" payments",color:"var(--muted)"},
          {ico:"📋",label:"Total events",  val:payments.length+" logged",color:"var(--goldink)"},
        ].map(k=>(
          <div key={k.label} style={{...card,textAlign:"center"}}>
            <div style={{fontSize:22,marginBottom:4}}>{k.ico}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.color,lineHeight:1}}>{k.val}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:3,textTransform:"uppercase",letterSpacing:.5}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"1px solid var(--border)",paddingBottom:0}}>
        {[["all","All"],["succeeded","Succeeded"],["failed","Failed"],["refunded","Refunded"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{padding:"8px 14px",borderRadius:"7px 7px 0 0",border:"none",cursor:"pointer",
              fontSize:13,fontWeight:view===v?700:500,fontFamily:"inherit",
              background:view===v?"var(--gold)":"transparent",
              color:view===v?"#1a0f00":"var(--muted)",
              borderBottom:view===v?"3px solid var(--gold)":"3px solid transparent"}}>
            {l}
            {v==="failed"&&totalFailed>0&&<span style={{marginLeft:5,background:"#e53935",color:"#fff",
              borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:800}}>{totalFailed}</span>}
          </button>
        ))}
      </div>

      {loading&&<div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading payments…</div>}

      {!loading&&filtered.length===0&&(
        <div style={{...card,textAlign:"center",padding:40,color:"var(--muted)"}}>
          {payments.length===0
            ? "No payments recorded for "+year+". Stripe events are captured automatically going forward."
            : "No "+view+" payments in "+year+"."}
        </div>
      )}

      {!loading&&filtered.length>0&&(
        <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"rgba(0,0,0,.08)"}}>
              {["Date","Program / Customer","Description","Amount","Status","Linked Org"].map(h=>(
                <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,
                  textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id} style={{borderTop:"1px solid var(--border)",
                  background:p.refunded?"rgba(229,57,53,.03)":p.status==="failed"?"rgba(229,57,53,.04)":""}}>
                  <td style={{padding:"9px 12px",fontSize:12,color:"var(--muted)",whiteSpace:"nowrap"}}>
                    {fmtDt(p.stripe_created_at)}
                  </td>
                  <td style={{padding:"9px 12px"}}>
                    <div style={{fontWeight:600,fontSize:13}}>{p.org_name||p.customer_name||"—"}</div>
                    {p.customer_email&&<div style={{fontSize:11,color:"var(--muted)"}}>{p.customer_email}</div>}
                  </td>
                  <td style={{padding:"9px 12px",fontSize:12,color:"var(--muted)",maxWidth:220}}>
                    {p.description||p.stripe_event_type}
                    {p.plan&&<span style={{marginLeft:6,fontWeight:700,color:"var(--goldink)",fontSize:11}}>
                      {p.plan} {p.plan_interval}
                    </span>}
                  </td>
                  <td style={{padding:"9px 12px",fontWeight:700,whiteSpace:"nowrap",
                    color:p.refunded?"#e53935":p.status==="failed"?"var(--muted)":"var(--text)"}}>
                    {fmt$(p.amount_cents)}
                    {p.refunded&&p.refund_amount_cents&&<div style={{fontSize:10,color:"#e53935"}}>
                      {"-"+fmt$(p.refund_amount_cents)+" refunded"}
                    </div>}
                  </td>
                  <td style={{padding:"9px 12px"}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5,
                      background:p.refunded?"rgba(229,57,53,.12)":
                                 p.status==="succeeded"?"rgba(76,175,80,.12)":"rgba(229,57,53,.1)",
                      color:p.refunded?"#e53935":p.status==="succeeded"?"#4caf50":"#e53935"}}>
                      {p.refunded?"Refunded":p.status==="succeeded"?"✓ Paid":p.status==="failed"?"✗ Failed":p.status}
                    </span>
                  </td>
                  <td style={{padding:"9px 12px",fontSize:12}}>
                    {p.org_id
                      ? <span style={{color:"#4caf50",fontWeight:600}}>✓ Matched</span>
                      : <span style={{color:"var(--muted)"}}>
                          Unmatched
                          <div style={{fontSize:10,color:"#e53935"}}>org_id needed at checkout</div>
                        </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Archive note */}
      <div style={{marginTop:20,fontSize:12,color:"var(--muted)",lineHeight:1.7,
        background:"rgba(0,0,0,.04)",borderRadius:8,padding:"12px 14px"}}>
        <strong style={{color:"var(--text)"}}>Data retention:</strong> Payment records are kept permanently and never deleted,
        even if a program cancels or deletes their account. Use the year buttons above to browse historical years.
        The "Linked Org" column shows whether we could match the payment to a Theatre4u account —
        payments marked "Unmatched" were received but couldn't be connected to an org because
        {" "}<code style={{background:"rgba(0,0,0,.08)",padding:"1px 4px",borderRadius:3,fontSize:11}}>client_reference_id</code>
        {" "}was not set in the Stripe checkout session.
      </div>
    </div>
  );
}

export function AdminProgramsTab({ orgs, currentUser, flash }) {
  const [selected,    setSelected]    = useState(null); // org object
  const [view,        setView]        = useState("overview"); // overview|inventory|team|settings
  const [items,       setItems]       = useState([]);
  const [team,        setTeam]        = useState([]);
  const [invites,     setInvites]     = useState([]);
  const [loadingOrg,  setLoadingOrg]  = useState(false);
  const [search,      setSearch]      = useState("");
  const [editItem,    setEditItem]     = useState(null);
  const [editOrg,     setEditOrg]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState("");
  const [closeTarget, setCloseTarget] = useState(null); // org to close/delete
  const showMsg = m => { setMsg(m); setTimeout(()=>setMsg(""),3000); };

  const filtered = orgs.filter(o =>
    !search || o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.email?.toLowerCase().includes(search.toLowerCase()) ||
    o.director_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.label_prefix?.toLowerCase().includes(search.toLowerCase())
  );

  const selectOrg = async (org) => {
    setSelected(org);
    setView("overview");
    setEditOrg({...org});
    setLoadingOrg(true);
    const [{ data: its }, { data: mems }, { data: invs }] = await Promise.all([
      SB.from("items").select("id,name,category,display_id,location,condition,qty,avail,mkt,img").eq("org_id", org.id).order("display_id"),
      SB.from("org_members").select("user_id,email,role,joined_at").eq("org_id", org.id),
      SB.from("org_invites").select("id,email,role,join_code,token,expires_at,accepted_at,is_permanent").eq("org_id", org.id).order("created_at",{ascending:false}),
    ]);
    setItems(its||[]);
    setTeam(mems||[]);
    setInvites(invs||[]);
    setLoadingOrg(false);
  };

  const saveOrgProfile = async () => {
    if (!editOrg) return;
    setSaving(true);
    const { error } = await SB.from("orgs").update({
      name: editOrg.name, director_name: editOrg.director_name,
      email: editOrg.email, plan: editOrg.plan,
      temp_pro: editOrg.temp_pro, label_prefix: editOrg.label_prefix,
      city: editOrg.city, location: editOrg.location,
      account_status: editOrg.account_status,
      founding_member: editOrg.founding_member,
      beta_end_date: editOrg.beta_end_date,
      founding_rate_plan: editOrg.founding_rate_plan,
      founding_rate_accepted_at: editOrg.founding_rate_accepted_at,
      beta_notes: editOrg.beta_notes,
    }).eq("id", editOrg.id);
    setSaving(false);
    if (error) { showMsg("❌ Save failed: "+error.message); return; }
    setSelected({...selected,...editOrg});
    showMsg("✅ Profile saved");
  };

  const saveItem = async () => {
    if (!editItem) return;
    setSaving(true);
    const { id, org_id, added, ...payload } = editItem;
    const { error } = await SB.from("items").update(payload).eq("id", editItem.id);
    if (!error) { await SB.from("audit_log").insert({ action:"admin_item_edit", org_id:selected.id, detail:`Admin edited item: ${editItem.name}` }); }
    setSaving(false);
    if (error) { showMsg("❌ "+error.message); return; }
    setItems(p => p.map(i => i.id===editItem.id ? editItem : i));
    setEditItem(null);
    showMsg("✅ Item saved");
  };

  const addItem = async (name) => {
    if (!name?.trim() || !selected) return;
    setSaving(true);
    const newItem = { org_id:selected.id, name:name.trim(), category:"other", condition:"Good", size:"N/A", qty:1, avail:"In Stock", mkt:"Not Listed", location:"", notes:"", tags:[], rent:0, sale:0, loan_period:2, deposit:0, vertical:selected.vertical||"theatre" };
    const { data, error } = await SB.from("items").insert(newItem).select().single();
    if (!error && data) {
      await SB.from("audit_log").insert({ action:"admin_item_add", org_id:selected.id, detail:`Admin added item: ${name.trim()}` });
      setItems(p => [data, ...p]);
      showMsg("✅ Item added");
    } else { showMsg("❌ "+(error?.message||"Failed")); }
    setSaving(false);
  };

  const deleteItem = async (itemId) => {
    if (!confirm("Delete this item from "+selected?.name+"?")) return;
    const item = items.find(i=>i.id===itemId);
    const { error } = await SB.from("items").delete().eq("id", itemId);
    if (error) { showMsg("❌ "+error.message); return; }
    await SB.from("audit_log").insert({ action:"admin_item_delete", org_id:selected.id, detail:`Admin deleted item: ${item?.name||itemId}` });
    setItems(p => p.filter(i => i.id !== itemId));
    showMsg("✅ Item deleted");
  };

  const removeMember = async (userId, memberEmail) => {
    if (!confirm(`Remove ${memberEmail} from ${selected?.name}?`)) return;
    const { error } = await SB.from("org_members").delete()
      .eq("org_id", selected.id).eq("user_id", userId);
    if (error) { showMsg("❌ "+error.message); return; }
    setTeam(p => p.filter(m => m.user_id !== userId));
    showMsg("✅ Member removed");
  };

  const addMember = async (email, role) => {
    if (!email.trim()) return;
    setSaving(true);
    // Look up user by email
    const { data: userOrg } = await SB.from("orgs").select("id").eq("email", email.trim()).single();
    if (!userOrg) { showMsg("❌ No Theatre4u account found for "+email); setSaving(false); return; }
    const { error } = await SB.from("org_members").upsert({
      org_id: selected.id, user_id: userOrg.id, email: email.trim(),
      role, invited_by: selected.id, joined_at: new Date().toISOString()
    },{onConflict:"org_id,user_id"});
    setSaving(false);
    if (error) { showMsg("❌ "+error.message); return; }
    setTeam(p => [...p.filter(m=>m.user_id!==userOrg.id), {user_id:userOrg.id,email:email.trim(),role,joined_at:new Date().toISOString()}]);
    showMsg("✅ "+email+" added as "+role);
  };

  const transferOwnership = async (newEmail) => {
    if (!newEmail.trim()) return;
    if (!confirm(`Transfer ownership of "${selected?.name}" to ${newEmail}?\n\nThis will:\n• Change the org's primary email to the new director\n• Keep all inventory and team members\n• The previous director loses owner access`)) return;
    setSaving(true);
    // Find the new owner's auth user
    const { data: newOwnerOrg } = await SB.from("orgs").select("id,name").eq("email", newEmail.trim()).single();
    if (!newOwnerOrg) { showMsg("❌ No account found for "+newEmail+". They need to sign up first."); setSaving(false); return; }
    // Update the org's email to the new director
    const { error } = await SB.from("orgs").update({
      email: newEmail.trim(),
      director_name: editOrg?.director_name || "",
    }).eq("id", selected.id);
    setSaving(false);
    if (error) { showMsg("❌ "+error.message); return; }
    showMsg("✅ Ownership transfer initiated. Note: full transfer may require manual DB steps for auth.users.");
  };

  const planColor = p => p==="district"?"#42a5f5":p==="pro"?"#91592c":p==="free"?"var(--muted)":"var(--muted)";
  const catIcon = c => ({costumes:"👗",props:"🎭",sets:"🏗️",lighting:"💡",sound:"🔊",scripts:"📜",makeup:"💄",furniture:"🪑",fabrics:"🧵",tools:"🔧",effects:"✨"}[c]||"📦");

  return (
    <div style={{display:"flex",gap:16,height:"calc(100vh - 200px)",minHeight:500}}>

      {/* ── Left panel: program list ─────────────────────────────────────── */}
      <div style={{width:260,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>
          🎭 All Programs <span style={{fontWeight:400,fontSize:12,color:"var(--muted)"}}>({orgs.length})</span>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search programs…"
          style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",
            background:"var(--parch)",color:"var(--text)",fontSize:13,
            fontFamily:"inherit",outline:"none",width:"100%"}}/>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {filtered.map(o => (
            <button key={o.id} onClick={()=>selectOrg(o)}
              style={{textAlign:"left",padding:"10px 12px",borderRadius:8,
                border:`1px solid ${selected?.id===o.id?"var(--gold)":"var(--border)"}`,
                background:selected?.id===o.id?"rgba(212,168,67,.1)":"var(--parch)",
                cursor:"pointer",fontFamily:"inherit",width:"100%",transition:"all .15s"}}>
              <div style={{fontWeight:600,fontSize:13,color:"var(--text)",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {o.name||o.email}
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center",marginTop:3}}>
                <span style={{fontSize:10,fontWeight:700,color:planColor(o.plan),
                  background:planColor(o.plan)+"22",padding:"1px 6px",borderRadius:4}}>
                  {o.plan?.toUpperCase()}
                </span>
                {o.temp_pro&&<span style={{fontSize:10,color:"var(--muted)"}}>beta</span>}
                <span style={{fontSize:10,color:"var(--muted)",marginLeft:"auto"}}>
                  {o.label_prefix||"—"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: program detail ──────────────────────────────────── */}
      <div style={{flex:1,overflowY:"auto",minWidth:0}}>
        {!selected&&(
          <div style={{textAlign:"center",padding:"60px 20px",color:"var(--muted)"}}>
            <div style={{fontSize:40,marginBottom:12}}>🎭</div>
            <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Select a program</div>
            <div style={{fontSize:13}}>Click any program on the left to view and manage it.</div>
          </div>
        )}

        {selected&&loadingOrg&&(
          <div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading {selected.name}…</div>
        )}

        {selected&&!loadingOrg&&(<>
          {msg&&<div style={{background:"rgba(76,175,80,.12)",border:"1px solid rgba(76,175,80,.3)",
            borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:12,color:"#81c784"}}>{msg}</div>}

          {/* Program header */}
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:"var(--serif)",fontSize:20,fontWeight:700}}>{selected.name}</div>
              <div style={{fontSize:13,color:"var(--muted)"}}>{selected.email}
                {selected.director_name&&" · "+selected.director_name}
                {" · "}
                <span style={{color:planColor(selected.plan),fontWeight:600}}>
                  {selected.plan?.toUpperCase()}{selected.temp_pro?" (beta pro)":""}
                </span>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>
                {items.length} items · {team.length} team members · {selected.label_prefix||"no prefix"}
                {" · Joined "}{new Date(selected.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"})}
              </div>
            </div>
          </div>

          {/* Sub-navigation */}
          <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid var(--border)",paddingBottom:12}}>
            {[["overview","📊 Overview"],["inventory","📦 Inventory ("+items.length+")"],
              ["team","👥 Team ("+team.length+")"],["settings","⚙️ Settings"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)}
                style={{padding:"6px 14px",borderRadius:8,border:"none",
                  background:view===v?"var(--gold)":"var(--parch)",
                  color:view===v?"#1a0f00":"var(--muted)",
                  fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                {l}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {view==="overview"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
              {[
                {icon:"📦",val:items.length,lbl:"Items"},
                {icon:"🏷️",val:items.filter(i=>i.display_id).length,lbl:"Labeled"},
                {icon:"🎭",val:items.filter(i=>i.mkt!=="Not Listed").length,lbl:"On Exchange"},
                {icon:"👥",val:team.length,lbl:"Team Members"},
                {icon:"✉️",val:invites.filter(i=>!i.accepted_at).length,lbl:"Pending Invites"},
                {icon:"📅",val:new Date(selected.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}),lbl:"Joined"},
              ].map(k=>(
                <div key={k.lbl} style={{background:"var(--parch)",border:"1px solid var(--border)",
                  borderRadius:10,padding:"14px",textAlign:"center"}}>
                  <div style={{fontSize:24,marginBottom:4}}>{k.icon}</div>
                  <div style={{fontSize:22,fontWeight:800,color:"var(--goldink)",
                    fontFamily:"var(--serif)",lineHeight:1}}>{k.val}</div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:4,
                    textTransform:"uppercase",letterSpacing:.8}}>{k.lbl}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── INVENTORY ── */}
          {view==="inventory"&&(
            <div>
              <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"var(--amber)",marginBottom:12}}>🔑 Admin view — changes you make here are logged to the audit trail</div>
              {!editItem&&(<div style={{display:"flex",gap:8,marginBottom:14}}><input id="admin-new-item-name" className="fi" placeholder="New item name…" style={{flex:1}} onKeyDown={e=>{ if(e.key==="Enter"){ addItem(e.target.value); e.target.value=""; }}} /><button className="btn btn-g" disabled={saving} onClick={()=>{ const el=document.getElementById("admin-new-item-name"); if(el?.value.trim()){ addItem(el.value); el.value=""; } }}>+ Add Item</button></div>)}
              {editItem&&(
                <div style={{background:"var(--parch)",border:"1px solid var(--gold)",
                  borderRadius:10,padding:16,marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:"var(--goldink)"}}>
                    ✏️ Editing: {editItem.name}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[["name","Item Name"],["location","Location"],["condition","Condition"],
                      ["avail","Availability"],["qty","Quantity"]].map(([k,lbl])=>(
                      <div key={k}>
                        <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,
                          textTransform:"uppercase",letterSpacing:1}}>{lbl}</div>
                        <input value={editItem[k]||""} onChange={e=>setEditItem(p=>({...p,[k]:e.target.value}))}
                          style={{width:"100%",padding:"7px 10px",borderRadius:7,
                            border:"1px solid var(--border)",background:"var(--white)",
                            color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button onClick={saveItem} disabled={saving}
                      style={{padding:"7px 18px",borderRadius:7,border:"none",
                        background:"var(--gold)",color:"#1a0f00",fontWeight:700,
                        fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                      {saving?"Saving…":"Save Item"}
                    </button>
                    <button onClick={()=>setEditItem(null)}
                      style={{padding:"7px 14px",borderRadius:7,
                        border:"1px solid var(--border)",background:"transparent",
                        color:"var(--muted)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {items.length===0&&(
                  <div style={{textAlign:"center",padding:32,color:"var(--muted)",fontSize:13}}>
                    No items cataloged yet.
                  </div>
                )}
                {items.map(item=>(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,
                    padding:"9px 12px",background:"var(--parch)",borderRadius:8,
                    border:"1px solid var(--border)"}}>
                    <span style={{fontSize:18,width:24,textAlign:"center"}}>{catIcon(item.category)}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",
                        overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>
                        {item.display_id||"unlabeled"} · {item.location||"no location"} · {item.condition}
                      </div>
                    </div>
                    <span style={{fontSize:11,color:"var(--muted)",flexShrink:0}}>×{item.qty||1}</span>
                    <button onClick={()=>setEditItem({...item})}
                      style={{padding:"4px 10px",borderRadius:6,border:"1px solid var(--border)",
                        background:"transparent",color:"var(--muted)",fontSize:12,
                        cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                      Edit
                    </button>
                    <button onClick={()=>deleteItem(item.id)}
                      style={{padding:"4px 8px",borderRadius:6,border:"1px solid rgba(194,24,91,.3)",
                        background:"transparent",color:"var(--red)",fontSize:12,
                        cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TEAM ── */}
          {view==="team"&&(<>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Current Team Members</div>
            {team.length===0&&<div style={{color:"var(--muted)",fontSize:13,marginBottom:16}}>No team members yet.</div>}
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
              {team.map(m=>(
                <div key={m.user_id} style={{display:"flex",alignItems:"center",gap:10,
                  padding:"9px 12px",background:"var(--parch)",borderRadius:8,
                  border:"1px solid var(--border)"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{m.email}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>
                      {m.role?.replace("_"," ")} · joined {new Date(m.joined_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </div>
                  </div>
                  <button onClick={()=>removeMember(m.user_id,m.email)}
                    style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(194,24,91,.3)",
                      background:"transparent",color:"var(--red)",fontSize:12,
                      cursor:"pointer",fontFamily:"inherit"}}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Add member */}
            <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>Add Team Member</div>
            <AddMemberForm onAdd={addMember} saving={saving}/>

            {/* Pending invites */}
            {invites.length>0&&(<>
              <div style={{fontWeight:700,fontSize:14,margin:"16px 0 8px"}}>Pending Invites</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {invites.map(inv=>(
                  <div key={inv.id} style={{padding:"9px 12px",background:"var(--parch)",
                    borderRadius:8,border:"1px solid var(--border)",fontSize:13}}>
                    <span style={{fontWeight:600}}>{inv.email||"Join code"}</span>
                    <span style={{color:"var(--muted)",marginLeft:8}}>{inv.role?.replace("_"," ")}</span>
                    {inv.join_code&&<span style={{fontFamily:"monospace",color:"var(--goldink)",
                      marginLeft:8,fontSize:12}}>code: {inv.join_code}</span>}
                    {inv.accepted_at&&<span style={{color:"var(--grn)",marginLeft:8,fontSize:11}}>✓ accepted</span>}
                    {!inv.accepted_at&&<span style={{color:"var(--muted)",marginLeft:8,fontSize:11}}>
                      expires {new Date(inv.expires_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                    </span>}
                  </div>
                ))}
              </div>
            </>)}
          </>)}

          {/* ── SETTINGS ── */}
          {view==="settings"&&editOrg&&(
            <div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Program Profile</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[
                  ["name","Program Name"],["director_name","Director Name"],
                  ["email","Primary Email"],["label_prefix","Label Prefix"],
                  ["city","City"],["location","Location/State"],
                ].map(([k,lbl])=>(
                  <div key={k}>
                    <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,
                      textTransform:"uppercase",letterSpacing:1}}>{lbl}</div>
                    <input value={editOrg[k]||""} onChange={e=>setEditOrg(p=>({...p,[k]:e.target.value}))}
                      style={{width:"100%",padding:"8px 12px",borderRadius:8,
                        border:"1px solid var(--border)",background:"var(--white)",
                        color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                  </div>
                ))}
              </div>

              {/* Plan and access */}
              <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>Plan & Access</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Plan</div>
                  <select value={editOrg.plan||"free"} onChange={e=>setEditOrg(p=>({...p,plan:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="district">District</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Beta Pro Access</div>
                  <select value={editOrg.temp_pro?"yes":"no"} onChange={e=>setEditOrg(p=>({...p,temp_pro:e.target.value==="yes"}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
                    <option value="yes">Yes — Full beta access</option>
                    <option value="no">No — Plan only</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Account Status</div>
                  <select value={editOrg.account_status||"active"} onChange={e=>setEditOrg(p=>({...p,account_status:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <button onClick={saveOrgProfile} disabled={saving}
                style={{padding:"10px 24px",borderRadius:8,border:"none",
                  background:"var(--gold)",color:"#1a0f00",fontWeight:700,
                  fontSize:14,cursor:"pointer",fontFamily:"inherit",marginBottom:24}}>
                {saving?"Saving…":"💾 Save Changes"}
              </button>

              {/* Founding Member Status */}
              <div style={{fontWeight:700,fontSize:14,marginBottom:8,marginTop:8}}>Founding Member & Beta</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Founding Member</div>
                  <select value={editOrg.founding_member?"yes":"no"} onChange={e=>setEditOrg(p=>({...p,founding_member:e.target.value==="yes"}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
                    <option value="no">No — standard beta access</option>
                    <option value="yes">Yes — 25+ items + feedback ✅</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Beta End Date</div>
                  <input type="date" value={editOrg.beta_end_date||"2026-09-01"} onChange={e=>setEditOrg(p=>({...p,beta_end_date:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Founding Rate Offered</div>
                  <select value={editOrg.founding_rate_plan||""} onChange={e=>setEditOrg(p=>({...p,founding_rate_plan:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
                    <option value="">Not yet offered</option>
                    <option value="pro">Pro — $9.99/mo founding rate</option>
                    <option value="district_s">District S — $39/mo founding rate</option>
                    <option value="district_m">District M — $89/mo founding rate</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Founding Rate Accepted</div>
                  <select value={editOrg.founding_rate_accepted_at?"yes":"no"} onChange={e=>setEditOrg(p=>({...p,founding_rate_accepted_at:e.target.value==="yes"?new Date().toISOString():null}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
                    <option value="no">Not yet accepted</option>
                    <option value="yes">✅ Accepted</option>
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Admin Notes</div>
                  <textarea value={editOrg.beta_notes||""} onChange={e=>setEditOrg(p=>({...p,beta_notes:e.target.value}))}
                    placeholder="Internal notes on this account's beta status, special arrangements, etc."
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit",resize:"vertical",minHeight:60}}/>
                </div>
              </div>
              <div style={{background:"rgba(194,24,91,.06)",border:"1px solid rgba(194,24,91,.2)",
                borderRadius:10,padding:16}}>
                <div style={{fontWeight:700,fontSize:14,color:"var(--red)",marginBottom:6}}>
                  🔄 Transfer Ownership
                </div>
                <div style={{fontSize:13,color:"var(--muted)",marginBottom:10,lineHeight:1.6}}>
                  Move this program to a different director. The new director must already have a Theatre4u account.
                  All inventory, team members, and history will stay with the program.
                </div>
                <TransferOwnershipForm orgName={selected.name} onTransfer={transferOwnership} saving={saving}/>
              </div>

              {/* Close / Delete account */}
              <div style={{background:"rgba(194,24,91,.06)",border:"1px solid rgba(194,24,91,.2)",
                borderRadius:10,padding:16,marginTop:12}}>
                <div style={{fontWeight:700,fontSize:14,color:"var(--red)",marginBottom:6}}>
                  🚫 Close or Delete Account
                </div>
                <div style={{fontSize:13,color:"var(--muted)",marginBottom:10,lineHeight:1.6}}>
                  Soft-close (30-day window, recoverable) or permanently hard-delete this program.
                  Use hard delete for test accounts you want gone for good.
                </div>
                <button className="btn btn-d" onClick={()=>setCloseTarget(selected)}>
                  Close / Delete {selected.name}
                </button>
              </div>
            </div>
          )}
        </>)}
      </div>
      {closeTarget && (
        <AdminCloseOrgModal
          org={closeTarget}
          currentUser={currentUser}
          onClose={()=>setCloseTarget(null)}
          onClosed={(id)=>{ setSelected(s=>s&&s.id===id?{...s,account_status:"closed"}:s); setEditOrg(e=>e&&e.id===id?{...e,account_status:"closed"}:e); setCloseTarget(null); showMsg("✓ Account closed (30-day window)"); }}
          onHardDeleted={(id)=>{ setCloseTarget(null); setSelected(null); setEditOrg(null); showMsg("✓ Account permanently deleted"); }}
        />
      )}
    </div>
  );
}

export function AdminAnalyticsTab({ analytics, loading, onLoad }) {
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
          {icon:"🔥",  label:"Sessions This Week",  val:uniqSessions.toLocaleString(), color:"var(--goldink)"},
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
                color:"var(--goldink)",padding:"1px 8px",borderRadius:6}}>{n} visits</span>
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
