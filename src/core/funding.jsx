import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { EM } from "./messages.js";
import { Modal } from "./ui.jsx";
import { fmt$ } from "./helpers.js";

const FUND_TYPES = [
  {id:"grant",      label:"Grant",           icon:"🏛️"},
  {id:"allocation", label:"District Allocation", icon:"🏫"},
  {id:"earned",     label:"Earned Income",   icon:"🎟️"},
  {id:"donation",   label:"Donation",        icon:"🤝"},
  {id:"booster",    label:"Booster/PTA",     icon:"⭐"},
  {id:"other",      label:"Other",           icon:"📋"},
];
const FUND_CATS = ["Equipment","Instruments","Supplies","Instruction","Personnel","Travel","Production","Technology","Other"];

// Funding tracker page (+ source/expenditure modals + impact report) — extracted from App.jsx.

export function FundingPage({userId, org, plan}){
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

export function SourceModal({initial, saving, onSave, onCancel}){
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

export function ExpModal({initial, sources, saving, onSave, onCancel}){
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

export function ProgramImpactReport({ sources, exps, org }) {
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
