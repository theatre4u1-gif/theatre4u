import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";

// Admin module — building-block forms/widgets. The big admin cluster (AdminHub, etc.) will join this file.

export function AddMemberForm({ onAdd, saving }) {
  const [email, setEmail] = useState("");
  const [role,  setRole]  = useState("crew");
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <input value={email} onChange={e=>setEmail(e.target.value)}
        placeholder="their@email.com"
        style={{flex:1,minWidth:180,padding:"8px 12px",borderRadius:8,
          border:"1px solid var(--border)",background:"var(--ink)",
          color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
      <select value={role} onChange={e=>setRole(e.target.value)}
        style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--border)",
          background:"var(--ink)",color:"var(--text)",fontSize:13,fontFamily:"inherit"}}>
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
          border:"1px solid rgba(194,24,91,.3)",background:"var(--ink)",
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
          {n:stats.claimed,  label:"Claimed (in use)",color:"var(--gold)"},
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
