// EXTERNAL LOANS (Borrowed & Lent tracker) — extracted from App.jsx.
// Tracks items borrowed from / lent to non-Theatre4u orgs. Rendered as a tab
// inside Inventory and Backstage Exchange.
import React, { useState, useEffect } from "react";
import { APP_NAME } from "./config.js";
import { doorUrl } from "./helpers.js";
import { SB } from "./supabase.js";
import { DEFAULT_LOAN_TERMS, platformNotice } from "./agreements.js";
import { CameraScanner, codeFromScan } from "./rentals.jsx";

export function ExternalLoans({ userId, org, items=[], onItemSync }){
  const [loans,   setLoans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [modal,   setModal]   = useState(null);    // "add" | "edit"
  const [active,  setActive]  = useState(null);
  const [tab,     setTab]     = useState("active"); // active | returned | all
  const [loanTerms, setLoanTerms] = useState("");   // subscriber's saved terms (empty = use default)
  const [showTerms, setShowTerms] = useState(false);
  const [termsDraft, setTermsDraft] = useState("");
  const [pickBrowse, setPickBrowse] = useState(false); // choose the item from inventory
  const [pickQ,      setPickQ]      = useState("");
  const [pickScan,   setPickScan]   = useState(false); // scan an item's QR with the phone camera
  const [msg,     setMsg]     = useState("");
  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),3500); };

  const blank = { direction:"out", counterparty_name:"", counterparty_contact:"", item_name:"", item_ref:null, quantity:1, date_out:new Date().toISOString().slice(0,10), due_date:"", notes:"" };
  const [form, setForm] = useState(blank);

  useEffect(()=>{
    if(!userId) return;
    (async()=>{
      setLoading(true);
      const { data } = await SB.from("external_loans").select("*").eq("org_id",userId).order("created_at",{ascending:false});
      if(data) setLoans(data);
      const { data:o } = await SB.from("orgs").select("loan_terms").eq("id",userId).maybeSingle();
      setLoanTerms((o && o.loan_terms) || "");
      setLoading(false);
    })();
  },[userId]);

  const saveTerms = async() => {
    const t = termsDraft.trim();
    const { error } = await SB.from("orgs").update({ loan_terms: t || null }).eq("id",userId);
    if(error){ flash("❌ Could not save terms"); return; }
    setLoanTerms(t); setShowTerms(false); flash("✓ Loan terms saved");
  };

  // Pick the item straight from your inventory (like rentals) instead of typing it.
  const pickItem = (it) => { setForm(f=>({...f, item_name: it.name, item_ref: it.id })); setPickBrowse(false); };
  const resolveScan = async (raw) => {
    const c = codeFromScan(raw); if(!c) return;
    let it = null;
    const q1 = await SB.from("items").select("id,name,display_id").eq("org_id",userId).eq("id",c).limit(1); it = q1.data && q1.data[0];
    if(!it){ const q2 = await SB.from("items").select("id,name,display_id").eq("org_id",userId).ilike("display_id",c).limit(1); it = q2.data && q2.data[0]; }
    if(!it){ flash("❌ No item found for "+c); return; }
    setForm(f=>({...f, item_name: it.name, item_ref: it.id })); setPickScan(false); flash("✓ Selected "+it.name);
  };

  const openAdd  = (dir="out") => { setActive(null); setForm({...blank, direction:dir}); setModal("add"); };
  const openEdit = (l) => { setActive(l); setForm({ direction:l.direction, counterparty_name:l.counterparty_name||"", counterparty_contact:l.counterparty_contact||"", item_name:l.item_name||"", item_ref:l.item_ref||null, quantity:l.quantity||1, date_out:l.date_out||"", due_date:l.due_date||"", notes:l.notes||"" }); setModal("edit"); };

  // ── Inventory sync for LENT-OUT items (only flips In Stock <-> Checked Out; never
  // touches borrowed items, which aren't ours). Guard checks rentals AND other loans. ──
  const markItemOut = async (itemId) => {
    if(!itemId) return;
    const { data } = await SB.from("items").update({ avail:"Checked Out" }).eq("org_id",userId).eq("id",itemId).eq("avail","In Stock").select("id");
    if(data && data.length && onItemSync) onItemSync(itemId, "Checked Out");
  };
  const itemStillOut = async (itemId, excludeLoanId) => {
    const { data:outLines } = await SB.from("rental_order_items").select("order_id").eq("org_id",userId).eq("item_id",itemId).eq("status","out");
    const orderIds = [...new Set((outLines||[]).map(x=>x.order_id))];
    if(orderIds.length){ const { data:openOnes } = await SB.from("rental_orders").select("id").in("id",orderIds).neq("status","closed"); if(openOnes && openOnes.length) return true; }
    const { data:loanRows } = await SB.from("external_loans").select("id").eq("org_id",userId).eq("item_ref",itemId).eq("direction","out").eq("returned",false);
    const loanIds = (loanRows||[]).map(x=>x.id).filter(id=>id!==excludeLoanId);
    return loanIds.length > 0;
  };
  const markItemInIfClear = async (itemId, excludeLoanId) => {
    if(!itemId) return;
    if(await itemStillOut(itemId, excludeLoanId)) return;
    const { data } = await SB.from("items").update({ avail:"In Stock" }).eq("org_id",userId).eq("id",itemId).eq("avail","Checked Out").select("id");
    if(data && data.length && onItemSync) onItemSync(itemId, "In Stock");
  };

  const save = async() => {
    if(!form.counterparty_name.trim()){ flash("❌ Add the organization or person's name"); return; }
    if(!form.item_name.trim()){ flash("❌ Add what was borrowed or lent"); return; }
    setSaving(true);
    const payload = {
      direction: form.direction,
      counterparty_name: form.counterparty_name.trim(),
      counterparty_contact: form.counterparty_contact.trim() || null,
      item_name: form.item_name.trim(),
      item_ref: form.item_ref || null,
      quantity: parseInt(form.quantity,10) || 1,
      date_out: form.date_out || null,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    if(active){
      const { data, error } = await SB.from("external_loans").update({...payload, updated_at:new Date().toISOString()}).eq("id",active.id).select().single();
      if(error){ flash("❌ Could not save. Try again."); }
      else {
        setLoans(p=>p.map(x=>x.id===data.id?data:x)); flash("✓ Updated"); setModal(null); setActive(null);
        // free the previously linked item if it is no longer held out by this record
        if(active.direction==="out" && !active.returned && active.item_ref && !(data.direction==="out" && !data.returned && data.item_ref===active.item_ref)) await markItemInIfClear(active.item_ref, active.id);
        if(data.direction==="out" && !data.returned && data.item_ref) await markItemOut(data.item_ref);
      }
    } else {
      const { data, error } = await SB.from("external_loans").insert({...payload, org_id:userId}).select().single();
      if(error){ flash("❌ Could not save. Try again."); }
      else { setLoans(p=>[data,...p]); flash("✓ Added"); setModal(null); if(data.direction==="out" && !data.returned && data.item_ref) await markItemOut(data.item_ref); }
    }
    setSaving(false);
  };

  const markReturned = async(l) => {
    const { data, error } = await SB.from("external_loans").update({ returned:true, returned_at:new Date().toISOString() }).eq("id",l.id).select().single();
    if(!error && data){ setLoans(p=>p.map(x=>x.id===data.id?data:x)); flash("✓ Marked returned"); if(l.direction==="out" && l.item_ref) await markItemInIfClear(l.item_ref, l.id); }
  };
  const reopen = async(l) => {
    const { data, error } = await SB.from("external_loans").update({ returned:false, returned_at:null }).eq("id",l.id).select().single();
    if(!error && data){ setLoans(p=>p.map(x=>x.id===data.id?data:x)); flash("Reopened"); if(l.direction==="out" && l.item_ref) await markItemOut(l.item_ref); }
  };
  const remove = async(l) => {
    if(!confirm("Delete this record?")) return;
    await SB.from("external_loans").delete().eq("id",l.id);
    setLoans(p=>p.filter(x=>x.id!==l.id));
    flash("Deleted");
    if(l.direction==="out" && !l.returned && l.item_ref) await markItemInIfClear(l.item_ref, l.id);
  };

  const invite = (l) => {
    const subject = encodeURIComponent("Join us on "+APP_NAME.replace("™",""));
    const body = encodeURIComponent(`Hi ${l.counterparty_name},\n\nWe use ${APP_NAME} to track our program's inventory and to borrow, lend, and rent items with other programs. It would make sharing between us much easier if you joined too — it's free to start.\n\nYou can sign up here: ${doorUrl(org)}\n\nThanks!\n${org?.name||""}`);
    const to = (l.counterparty_contact && l.counterparty_contact.includes("@")) ? l.counterparty_contact : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  // Print a loan agreement for one record. For "Lent out" the counterparty is the borrower;
  // for "Borrowed" your org is the borrower. Same editable terms + protective notice as rentals.
  const printLoan = (l) => {
    const esc = s => String(s==null?"":s).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
    const brand = APP_NAME.replace("™","");
    const bizName = esc(org?.name || brand);
    const bizContact = [org?.email, org?.phone, org?.location].filter(Boolean).map(esc).join(" &middot; ");
    const out = l.direction === "out";
    const lender = out ? bizName : esc(l.counterparty_name);
    const borrower = out ? esc(l.counterparty_name) : bizName;
    const termsText = esc(loanTerms || DEFAULT_LOAN_TERMS).replace(/\n/g,"<br>");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Loan Agreement</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;color:#1a0f00;max-width:720px;margin:24px auto;padding:0 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d4a843;padding-bottom:10px;margin-bottom:16px">
          <div>
            <div style="font-size:22px;font-weight:700">${bizName}</div>
            ${bizContact ? `<div style="font-size:12px;color:#666;margin-top:2px">${bizContact}</div>` : ""}
            <div style="font-size:13px;font-weight:700;color:#8b6914;margin-top:6px">Loan Agreement</div>
          </div>
          <div style="text-align:right;font-size:12px;color:#666">Date ${new Date().toLocaleDateString()}</div>
        </div>
        <table style="width:100%;font-size:13px;margin-bottom:16px">
          <tr><td style="padding:2px 0"><strong>Lender:</strong> ${lender}</td>
          <td style="padding:2px 0"><strong>Borrower:</strong> ${borrower}</td></tr>
          <tr><td style="padding:2px 0"><strong>Contact:</strong> ${esc(l.counterparty_contact || "")}</td>
          <td style="padding:2px 0"></td></tr>
          <tr><td style="padding:2px 0"><strong>Date out:</strong> ${esc(l.date_out || "")}</td>
          <td style="padding:2px 0"><strong>Due back:</strong> ${esc(l.due_date || "")}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f5f0e8">
            <th style="text-align:left;padding:6px 8px">Item</th>
            <th style="text-align:left;padding:6px 8px">Qty</th>
            <th style="text-align:left;padding:6px 8px">Status</th></tr></thead>
          <tbody><tr>
            <td style="padding:6px 8px;border-bottom:1px solid #ddd">${esc(l.item_name)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #ddd">${l.quantity || 1}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #ddd">${l.returned ? "Returned" : "Out"}</td>
          </tr></tbody>
        </table>
        ${l.notes ? `<p style="font-size:12px;color:#555;margin-top:8px">Notes: ${esc(l.notes)}</p>` : ""}

        <div style="margin-top:20px;border-top:1px solid #eee;padding-top:14px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">Terms and Conditions</div>
          <div style="font-size:12px;color:#333;line-height:1.6">${termsText}</div>
        </div>

        <table style="width:100%;font-size:12px;margin-top:34px">
          <tr>
            <td style="width:50%;padding-right:20px"><div style="border-top:1px solid #333;padding-top:4px">Borrower signature</div></td>
            <td style="width:50%"><div style="border-top:1px solid #333;padding-top:4px">Date</div></td>
          </tr>
          <tr>
            <td style="padding-top:26px;padding-right:20px"><div style="border-top:1px solid #333;padding-top:4px">Lender signature</div></td>
            <td style="padding-top:26px"><div style="border-top:1px solid #333;padding-top:4px">Date</div></td>
          </tr>
        </table>

        <p style="font-size:10px;color:#999;margin-top:26px;border-top:1px solid #eee;padding-top:10px;line-height:1.6">
          ${platformNotice(bizName, brand)}
        </p>
      </body></html>`;
    const w = window.open("", "_blank");
    if(!w){ flash("❌ Allow pop-ups to print"); return; }
    w.document.write(html); w.document.close();
    setTimeout(()=>{ try{ w.print(); }catch(_){} }, 300);
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
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>{setTermsDraft(loanTerms||DEFAULT_LOAN_TERMS);setShowTerms(true);}} className="btn btn-o" style={{fontSize:12}}>📝 Edit loan terms</button>
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
                <button onClick={()=>printLoan(l)} className="btn btn-o btn-sm" style={{fontSize:11}}>🖨 Print agreement</button>
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
              <input style={inp} value={form.counterparty_name} onChange={e=>setForm(f=>({...f,counterparty_name:e.target.value}))} placeholder="e.g. August Wilson Community Theatre"/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={label}>Their email or phone (optional)</label>
              <input style={inp} value={form.counterparty_contact} onChange={e=>setForm(f=>({...f,counterparty_contact:e.target.value}))} placeholder="name@example.com"/>
            </div>
            <div style={row2}>
              <div>
                <label style={label}>Item</label>
                <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                  <button type="button" onClick={()=>{setPickBrowse(true);setPickQ("");}} className="btn btn-o btn-sm" style={{fontSize:11}}>📦 Choose from inventory</button>
                  <button type="button" onClick={()=>setPickScan(true)} className="btn btn-o btn-sm" style={{fontSize:11}}>📷 Scan</button>
                </div>
                <input style={inp} list="t4u-my-items" value={form.item_name} onChange={e=>setForm(f=>({...f,item_name:e.target.value,item_ref:null}))} placeholder="Pick from inventory, scan, or type"/>
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

      {pickScan && <CameraScanner onCode={resolveScan} onClose={()=>setPickScan(false)} />}

      {pickBrowse && (
        <div onClick={()=>setPickBrowse(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--cream)",border:"1px solid var(--border)",borderRadius:12,padding:18,width:"100%",maxWidth:560,maxHeight:"86vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Choose from inventory</h3>
              <button onClick={()=>setPickBrowse(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--muted)",lineHeight:1}}>×</button>
            </div>
            <input style={inp} value={pickQ} onChange={e=>setPickQ(e.target.value)} placeholder="Filter by name, ID, or category" autoFocus/>
            <div style={{marginTop:10,overflowY:"auto",flex:1}}>
              {(items||[]).filter(it=>{ const q=pickQ.trim().toLowerCase(); return !q || (it.name||"").toLowerCase().includes(q) || (it.display_id||"").toLowerCase().includes(q) || (it.category||"").toLowerCase().includes(q); }).slice(0,300).map(it=>(
                <div key={it.id} onClick={()=>pickItem(it)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 8px",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14}}>{it.name}</div>
                    <div style={{fontSize:11,color:"var(--faint)"}}>{[it.display_id,it.category,it.location].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="btn btn-g btn-sm" style={{fontSize:11,pointerEvents:"none"}}>Select</span>
                </div>
              ))}
              {(items||[]).length===0 && <div style={{textAlign:"center",padding:30,color:"var(--faint)",fontSize:13}}>No items in your inventory yet.</div>}
            </div>
          </div>
        </div>
      )}

      {showTerms&&(
        <div onClick={()=>setShowTerms(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--cream)",border:"1px solid var(--border)",borderRadius:12,padding:20,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:19,marginBottom:6}}>Loan terms</h3>
            <p style={{fontSize:12,color:"var(--muted)",marginBottom:12,lineHeight:1.5}}>These print on the loan agreement, below the item. Edit them to fit your program. A short notice that {APP_NAME.replace("™","")} is only the software provider, and not a party to the loan, is always added at the bottom to protect both sides.</p>
            <textarea style={{...inp,minHeight:220,resize:"vertical",lineHeight:1.5}} value={termsDraft} onChange={e=>setTermsDraft(e.target.value)}/>
            <div style={{display:"flex",gap:8,justifyContent:"space-between",marginTop:14,flexWrap:"wrap"}}>
              <button onClick={()=>setTermsDraft(DEFAULT_LOAN_TERMS)} className="btn btn-o btn-sm" style={{fontSize:12}}>Reset to default</button>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowTerms(false)} className="btn btn-o" style={{fontSize:13}}>Cancel</button>
                <button onClick={saveTerms} className="btn btn-g" style={{fontSize:13}}>Save terms</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}