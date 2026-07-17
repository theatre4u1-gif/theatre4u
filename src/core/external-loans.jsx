// EXTERNAL LOANS (Borrowed & Lent tracker) — extracted from App.jsx.
// Tracks items borrowed from / lent to non-Theatre4u orgs. Rendered as a tab
// inside Inventory and Backstage Exchange.
import React, { useState, useEffect } from "react";
import { APP_NAME } from "./config.js";
import { doorUrl } from "./helpers.js";
import { SB } from "./supabase.js";

export function ExternalLoans({ userId, org, items=[] }){
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
    const subject = encodeURIComponent("Join us on "+APP_NAME.replace("™",""));
    const body = encodeURIComponent(`Hi ${l.counterparty_name},\n\nWe use ${APP_NAME} to track our program's inventory and to borrow, lend, and rent items with other programs. It would make sharing between us much easier if you joined too — it's free to start.\n\nYou can sign up here: ${doorUrl(org)}\n\nThanks!\n${org?.name||""}`);
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
          <p style={{color:"var(--faint)",fontSize:13,maxWidth:560,lineHeight:1.5}}>Track items you've borrowed from or lent to schools and organizations that aren't on {APP_NAME} — so you always know who has what and when it's due back.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>openAdd("out")} className="btn btn-g" style={{fontSize:12}}>＋ Lent out</button>
          <button onClick={()=>openAdd("in")} className="btn btn-o" style={{fontSize:12}}>＋ Borrowed</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Lent out",  val:activeOut, color:"var(--goldink)"},
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
                <button onClick={()=>invite(l)} className="btn btn-o btn-sm" style={{fontSize:11}}>✉️ Invite to {APP_NAME}</button>
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