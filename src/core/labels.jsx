import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { CAT } from "./inventory.js";
import { QR } from "./qr.js";
import { APP_NAME, APP_EMAIL, APP_HOST } from "./config.js";

const LABEL_PACKS = [
  { qty:25,  type:"standard",    label:"25 Standard",     retail:1000, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:50,  type:"standard",    label:"50 Standard",     retail:1500, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:100, type:"standard",    label:"100 Standard",    retail:2300, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:200, type:"standard",    label:"200 Standard",    retail:3900, desc:"Indoor use · polyester matte · water-resistant" },
  { qty:25,  type:"weatherproof",label:"25 Weatherproof", retail:1400, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
  { qty:50,  type:"weatherproof",label:"50 Weatherproof", retail:2100, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
  { qty:100, type:"weatherproof",label:"100 Weatherproof",retail:3600, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
  { qty:200, type:"weatherproof",label:"200 Weatherproof",retail:6500, desc:"Scene shop · outdoor storage · heavy-duty vinyl" },
];
const LOGO_ADDON_CENTS = 500; // $5 to include program logo on labels



// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DAILY DIGEST — standalone component used as first tab in AdminHub
// Time windows: 24h | 7d | 30d
// Sources: orgs, items, beta_leads, email_sequence, page_views (UTM),

// QR label printing page — extracted from App.jsx.

export function LabelsPage({ org, userId, items=[], isAdmin=false }) {
  const [tab, setTab]           = useState("print");
  const [myItems, setMyItems]   = useState([]);
  const [orders, setOrders]     = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Print tab state
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState([]);
  const [printing, setPrinting] = useState(false);

  // Assign tab state
  const [assignCode, setAssignCode] = useState("");
  const [assignItem, setAssignItem] = useState("");
  const [assignMsg, setAssignMsg]   = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  // Order tab state
  const [selPack, setSelPack]     = useState(null);   // index into LABEL_PACKS
  const [includeLogo, setIncludeLogo] = useState(false);
  const [logoUrl, setLogoUrl]     = useState(org?.logo_url||"");
  const [orderName, setOrderName] = useState(org?.director_name||"");
  const [orderAddrLine, setOrderAddrLine] = useState("");
  const [orderCity, setOrderCity] = useState("");
  const [orderState, setOrderState] = useState("");
  const [orderZip, setOrderZip]   = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [orderMsg, setOrderMsg]   = useState("");
  const [extraSticky, setExtraSticky] = useState(0);
  const [extraIronOn, setExtraIronOn] = useState(0);

  useEffect(()=>{
    (async()=>{
      setLoadingItems(true);
      const {data} = await SB.from("items")
        .select("id,name,category,location,display_id,added,condition,qty")
        .eq("org_id",userId).order("added",{ascending:false}).limit(500);

      // Also load claimed labels so we know which items already have a physical label
      const {data:claimed} = await SB.from("label_pool")
        .select("code,item_id")
        .eq("org_id",userId)
        .eq("status","claimed");

      // Build a map: item_id → label code
      const labelMap = {};
      (claimed||[]).forEach(l => { if(l.item_id) labelMap[l.item_id] = l.code; });

      // Attach label_code to each item
      setMyItems((data||[]).map(i => ({ ...i, label_code: labelMap[i.id] || null })));

      const {data:ords} = await SB.from("label_orders")
        .select("id,item_count,assigned_count,blank_count,costume_count,equipment_count,label_type,status,created_at,tracking,code_start,code_end,amount_cents,include_logo,vendor,vendor_order_ref,notes,reorder_of")
        .eq("org_id",userId).order("created_at",{ascending:false});
      setOrders(ords||[]);
      setLoadingItems(false);
    })();
  },[userId]);

  // ── PRINT TAB ────────────────────────────────────────────────────────────
  const filtered = myItems.filter(i=>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.location||"").toLowerCase().includes(search.toLowerCase()) ||
    (i.display_id||"").toLowerCase().includes(search.toLowerCase())
  );
  const toggleSel = id => setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const selAll    = () => setSelected(filtered.map(i=>i.id));
  const clearSel  = () => setSelected([]);

  const printSelected = async () => {
    const toPrint = myItems.filter(i=>selected.includes(i.id));
    if(!toPrint.length) return;
    setPrinting(true);
    try {
      const srcs = await Promise.all(toPrint.map(i=>
        QR.toDataURL("https://theatre4u.org/#/item/"+i.id, 160)
      ));
      const w = window.open("","_blank","width=900,height=700");
      if(!w){setPrinting(false);return;}
      const labels = toPrint.map((item,n)=>{
        const cat = CAT[item.category]||CAT.other;
        const dispId = item.display_id||item.id.slice(0,8).toUpperCase();
        return `<div class="lbl">
          <div class="lbl-cat" style="color:${cat.color||"#888"}">${cat.icon} ${cat.label}</div>
          <div class="lbl-name">${item.name}</div>
          ${item.location?`<div class="lbl-loc">📍 ${item.location}</div>`:""}
          <div class="lbl-id">${dispId}</div>
          ${srcs[n]?`<img src="${srcs[n]}" class="lbl-qr"/>`:""}
          <div class="lbl-brand">${APP_HOST}</div>
        </div>`;
      }).join("");
      w.document.write(`<!DOCTYPE html><html><head><title>QR Labels — ${org?.name||APP_NAME}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;background:#fff;padding:12px}
        .controls{text-align:center;margin-bottom:12px;font-size:13px}
        .grid{display:flex;flex-wrap:wrap;gap:8px}
        .lbl{width:160px;height:160px;border:1.5px solid #222;border-radius:6px;padding:8px;
          display:flex;flex-direction:column;gap:2px;page-break-inside:avoid;background:#fff}
        .lbl-cat{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
        .lbl-name{font-size:10px;font-weight:700;color:#111;line-height:1.2;flex:1;overflow:hidden;word-break:break-word}
        .lbl-loc{font-size:8px;color:#555}
        .lbl-id{font-size:9px;font-weight:800;color:#c4761a;font-family:monospace;letter-spacing:.5px}
        .lbl-qr{width:56px;height:56px;margin-top:auto}
        .lbl-brand{font-size:7px;color:#aaa}
        @media print{.controls{display:none}.grid{gap:6px}.lbl{width:150px;height:150px}}
      </style></head><body>
      <div class="controls">
        <strong>${org?.name||APP_NAME}</strong> — ${toPrint.length} label${toPrint.length!==1?"s":""}
        <button onclick="window.print()" style="margin-left:16px;padding:5px 14px;background:#d4a843;border:none;border-radius:5px;font-weight:700;cursor:pointer">🖨 Print</button>
        <button onclick="window.close()" style="margin-left:6px;padding:5px 14px;border:1px solid #ccc;border-radius:5px;cursor:pointer">Close</button>
        <span style="margin-left:12px;color:#888;font-size:12px">Tip: In print dialog choose "Fit to page" or "No scaling" for best results</span>
      </div>
      <div class="grid">${labels}</div>
      <script>setTimeout(function(){window.print()},600)<\/script>
      </body></html>`);
      w.document.close();
    } finally { setPrinting(false); }
  };

  // ── ASSIGN TAB ───────────────────────────────────────────────────────────
  const doAssign = async () => {
    const code = assignCode.trim().toUpperCase();
    const itemId = assignItem;
    if(!code||!itemId){ setAssignMsg("⚠ Please enter a label code and select an item."); return; }
    setAssignSaving(true);
    setAssignMsg("");
    try {
      // Only update label_pool — do NOT touch display_id (that's the human-readable ID)
      const { error } = await SB.from("label_pool")
        .update({
          status:     "claimed",
          item_id:    itemId,
          claimed_at: new Date().toISOString()
        })
        .eq("code", code)
        .eq("org_id", userId);
      if(error) throw error;
      setMyItems(p => p.map(i => i.id === itemId ? { ...i, label_code: code } : i));
      setAssignMsg("✅ Label " + code + " linked! Scanning it will now pull up that item.");
      setAssignCode(""); setAssignItem("");
    } catch(e) {
      setAssignMsg("❌ " + (e.message || "Label not found. Check the code matches your T4U pool."));
    }
    setAssignSaving(false);
  };

  // Unassign a label from an item
  const doUnassign = async (item) => {
    if(!confirm("Unlink label from \"" + item.name + "\"? The code goes back to unassigned.")) return;
    const { error } = await SB.from("label_pool")
      .update({ status:"assigned", item_id:null, claimed_at:null })
      .eq("item_id", item.id)
      .eq("org_id", userId);
    if(!error) setMyItems(p => p.map(i => i.id === item.id ? { ...i, label_code: null } : i));
  };


  // ── ORDER TAB ────────────────────────────────────────────────────────────
  const pack = selPack != null ? LABEL_PACKS[selPack] : null;
  const totalCents = pack ? pack.retail + (includeLogo ? LOGO_ADDON_CENTS : 0) : 0;

  const submitOrder = async () => {
    if(!pack){ setOrderMsg("⚠ Please select a label pack."); return; }
    const addr = [orderAddrLine, orderCity, orderState, orderZip].filter(Boolean).join(", ");
    if(!addr.trim()){ setOrderMsg("⚠ Please enter a shipping address."); return; }
    setOrderSubmitting(true);
    setOrderMsg("");
    try {
      await SB.from("label_orders").insert({
        org_id:        userId,
        org_name:      org?.name||"",
        contact_email: org?.email||"",
        contact_name:  orderName||"",
        item_count:    pack.qty,
        label_type:    pack.type,
        include_logo:  includeLogo,
        logo_url:      includeLogo ? (logoUrl||org?.logo_url||"") : null,
        delivery_addr: JSON.stringify({
          name:  orderName||org?.director_name||"",
          street:orderAddrLine,
          city:  orderCity,
          state: orderState,
          zip:   orderZip,
        }),
        notes:    orderNotes||"",
        amount_cents: totalCents,
        status:   "pending",
      });
      setOrders(p=>[{
        item_count:pack.qty, label_type:pack.type, status:"pending",
        created_at:new Date().toISOString(), amount_cents:totalCents, include_logo:includeLogo
      },...p]);
      setOrderDone(true);
    } catch(e) {
      setOrderMsg("❌ "+e.message);
    }
    setOrderSubmitting(false);
  };

  const card = {background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10};
  const inputStyle = {
    width:"100%",background:"var(--white)",border:"1.5px solid var(--border)",
    borderRadius:7,padding:"8px 12px",fontSize:13,color:"var(--text)",outline:"none",fontFamily:"inherit"
  };
  const labelStyle = {
    fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,
    color:"var(--muted)",display:"block",marginBottom:5
  };

  return (
    <div style={{padding:"24px 28px 80px",maxWidth:900}}>
      {/* Header */}
      <div style={{marginBottom:18}}>
        <h1 style={{fontFamily:"var(--serif)",fontSize:26,margin:"0 0 4px"}}>🏷 QR Label Manager</h1>
        <p style={{fontSize:13,color:"var(--muted)",margin:0}}>
          Print labels instantly from your browser · Assign pre-ordered labels to inventory items · Order durable physical labels by mail
        </p>
      </div>

      {/* How it works — 3 steps */}
      <div style={{...card,padding:"14px 18px",marginBottom:20,
        background:"linear-gradient(135deg,rgba(212,168,67,.07),rgba(212,168,67,.02))"}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>How {APP_NAME} QR labels work</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
          {[
            {n:"1",ico:"🖨",t:"Print now — free",
              b:"Use the Print tab to instantly generate and print QR code labels for any items. Works from any home or school printer. Best for getting started quickly."},
            {n:"2",ico:"📬",t:"Order durable labels",
              b:"Order professional polyester or weatherproof vinyl labels printed by WePrintBarcodes and mailed to your school. Pre-coded — stick them on bins now, assign to items anytime."},
            {n:"3",ico:"🔗",t:"Assign codes to items",
              b:"Got physical labels? Use the Assign tab to link any label code to any inventory item — current or future. Scan the label with any phone camera to pull up the item instantly."},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{background:"var(--gold)",color:"#1a0f00",borderRadius:"50%",width:22,height:22,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>
                {s.n}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,marginBottom:2}}>{s.ico} {s.t}</div>
                <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.6}}>{s.b}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:3,marginBottom:22,borderBottom:"1px solid var(--border)",paddingBottom:10}}>
        {[["print","🖨 Print Labels"],["assign","🔗 Assign a Label"],["order","📬 Order Physical Labels"]].filter(([id])=>id!=="order"||isAdmin).map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:"7px 16px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontSize:13,
              fontWeight:tab===id?700:500,background:tab===id?"var(--gold)":"transparent",
              color:tab===id?"#1a0f00":"var(--muted)",fontFamily:"inherit",transition:"all .15s"}}>
            {lbl}{id==="order"&&orders.length>0?" ("+orders.length+")":""}
          </button>
        ))}
      </div>

      {/* ══ PRINT TAB ══ */}
      {tab==="print"&&(
        <div>
          <p style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>
            Select items and click Print — your browser generates QR code labels you can print on any printer.
            Each label includes the item name, category, location, ID code, and scannable QR code.
            Any phone camera (no app needed) scans the code and pulls up the item instantly.
          </p>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items, locations, codes…"
              style={{flex:1,minWidth:200,...inputStyle,width:"auto"}}/>
            <button onClick={selAll} style={{padding:"7px 13px",borderRadius:7,border:"1px solid var(--border)",
              background:"transparent",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
              Select All ({filtered.length})
            </button>
            <button onClick={clearSel} style={{padding:"7px 13px",borderRadius:7,border:"1px solid var(--border)",
              background:"transparent",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
              Clear
            </button>
            <button onClick={printSelected} disabled={selected.length===0||printing}
              style={{padding:"8px 20px",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:13,fontWeight:700,
                cursor:selected.length&&!printing?"pointer":"not-allowed",
                background:selected.length&&!printing?"var(--gold)":"var(--border)",
                color:selected.length&&!printing?"#1a0f00":"var(--muted)"}}>
              {printing?"Generating…":selected.length?("🖨 Print "+selected.length+" Label"+(selected.length!==1?"s":"")):"Select items to print"}
            </button>
          </div>

          {loadingItems?(
            <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>Loading inventory…</div>
          ):(
            <div style={{...card,overflow:"hidden",marginBottom:10}}>
              {filtered.length===0?(
                <div style={{padding:32,textAlign:"center",color:"var(--muted)",fontSize:13}}>
                  {myItems.length===0
                    ?"Add items to your inventory first — then print labels here."
                    :"No items match your search."}
                </div>
              ):(
                filtered.map(item=>{
                  const cat = CAT[item.category]||CAT.other;
                  const isSel = selected.includes(item.id);
                  return(
                    <div key={item.id} onClick={()=>toggleSel(item.id)}
                      style={{display:"flex",alignItems:"center",gap:12,padding:"9px 14px",
                        borderBottom:"1px solid var(--border)",cursor:"pointer",
                        background:isSel?"rgba(212,168,67,.07)":"transparent",transition:"background .1s"}}>
                      <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid",
                        borderColor:isSel?"var(--gold)":"var(--border)",
                        background:isSel?"var(--gold)":"transparent",flexShrink:0,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {isSel&&<span style={{color:"#1a0f00",fontSize:12,fontWeight:900}}>✓</span>}
                      </div>
                      <span style={{fontSize:16,flexShrink:0}}>{cat.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {item.name}
                        </div>
                        <div style={{fontSize:11,color:"var(--muted)"}}>
                          {cat.label}{item.location?" · "+item.location:""}
                        </div>
                      </div>
                      {item.display_id&&(
                        <span style={{fontSize:11,fontFamily:"monospace",fontWeight:700,
                          color:"var(--amber)",background:"rgba(196,118,26,.1)",
                          padding:"2px 7px",borderRadius:4,flexShrink:0}}>
                          {item.display_id}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
          <div style={{fontSize:12,color:"var(--muted)"}}>
            {selected.length} of {myItems.length} item{myItems.length!==1?"s":""} selected ·{" "}
            Labels print at ~2" × 2" · 4 per row · PDF or print dialog from your browser
          </div>
        </div>
      )}

      {/* ══ ASSIGN TAB ══ */}
      {tab==="assign"&&(
        <div>
          <p style={{fontSize:13,color:"var(--muted)",marginBottom:20}}>
            Physical labels from your order each have a unique pre-printed code (like <strong style={{fontFamily:"monospace",color:"var(--amber)"}}>T4U-00142</strong>).
            Enter the code and select the inventory item you want it to track.
            You can also assign labels to items you haven't cataloged yet — add them later.
          </p>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
            {/* Link form */}
            <div style={{...card,padding:"20px 22px"}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>🔗 Link a Label to an Item</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div>
                  <label style={labelStyle}>Label Code (from the sticker)</label>
                  <input value={assignCode} onChange={e=>setAssignCode(e.target.value.toUpperCase())}
                    placeholder="e.g. T4U-00142"
                    style={{...inputStyle,fontFamily:"monospace",fontWeight:700,fontSize:15,
                      color:"var(--amber)",letterSpacing:1}}/>
                </div>
                <div>
                  <label style={labelStyle}>Inventory Item</label>
                  <select value={assignItem} onChange={e=>setAssignItem(e.target.value)} style={inputStyle}>
                    <option value="">— Choose an item —</option>
                    {myItems.map(i=>(
                      <option key={i.id} value={i.id}>
                        {i.name}{i.location?" ("+i.location+")":""}{i.display_id?" ["+i.display_id+"]":""}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={doAssign} disabled={assignSaving||!assignCode||!assignItem}
                  style={{padding:"10px 20px",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:13,
                    fontWeight:700,cursor:assignCode&&assignItem&&!assignSaving?"pointer":"not-allowed",
                    background:assignCode&&assignItem?"var(--gold)":"var(--border)",
                    color:assignCode&&assignItem?"#1a0f00":"var(--muted)"}}>
                  {assignSaving?"Saving…":"🔗 Assign Label"}
                </button>
                {assignMsg&&(
                  <div style={{fontSize:13,padding:"8px 12px",borderRadius:7,
                    background:assignMsg.startsWith("✅")?"rgba(76,175,80,.1)":"rgba(229,57,53,.08)",
                    border:"1px solid",borderColor:assignMsg.startsWith("✅")?"rgba(76,175,80,.3)":"rgba(229,57,53,.2)",
                    color:assignMsg.startsWith("✅")?"#4caf50":"#e53935"}}>
                    {assignMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Tips panel */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{...card,padding:"14px 16px",background:"rgba(33,150,243,.04)",borderColor:"rgba(33,150,243,.2)"}}>
                <div style={{fontWeight:700,fontSize:12,marginBottom:6}}>💡 How to find label codes</div>
                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
                  Your physical labels arrive with unique codes pre-printed (e.g. <code style={{fontFamily:"monospace",color:"var(--amber)"}}>T4U-00142</code>).
                  Your code range is shown in your order history below — or check the email confirmation.
                  You can assign any code from your range to any item at any time.
                </div>
              </div>
              <div style={{...card,padding:"14px 16px",background:"rgba(76,175,80,.04)",borderColor:"rgba(76,175,80,.2)"}}>
                <div style={{fontWeight:700,fontSize:12,marginBottom:6}}>📋 Assign labels in bulk</div>
                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
                  Strategy: stick a label on a bin or rack, then walk through your inventory room and assign each code to the item or container it's on.
                  You don't need to catalog items first — assign the label, add item details later.
                </div>
              </div>
            </div>
          </div>

          {/* Items with assigned labels */}
          {myItems.filter(i=>i.label_code).length>0&&(
            <div>
              <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>
                Items with assigned labels ({myItems.filter(i=>i.label_code).length})
              </div>
              <div style={{...card,overflow:"hidden"}}>
                {myItems.filter(i=>i.label_code).map(item=>{
                  const cat = CAT[item.category]||CAT.other;
                  return(
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,
                      padding:"9px 14px",borderBottom:"1px solid var(--border)"}}>
                      <span style={{fontSize:15,flexShrink:0}}>{cat.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600}}>{item.name}</div>
                        {item.location&&<div style={{fontSize:11,color:"var(--muted)"}}>📍 {item.location}</div>}
                      </div>
                      <span style={{fontFamily:"monospace",fontSize:12,fontWeight:800,
                        color:"var(--amber)",background:"rgba(196,118,26,.1)",
                        padding:"3px 9px",borderRadius:5,flexShrink:0}}>
                        {item.label_code||item.display_id}
                      </span>
                      <button onClick={()=>doUnassign(item)}
                        style={{background:"none",border:"1px solid var(--border)",borderRadius:6,
                          padding:"2px 8px",fontSize:11,color:"var(--muted)",cursor:"pointer",flexShrink:0}}>
                        ✕ Unlink
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Code ranges from orders */}
          {orders.filter(o=>o.code_start).length>0&&(
            <div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Your label code ranges</div>
              <div style={{...card,overflow:"hidden"}}>
                {orders.filter(o=>o.code_start).map((o,i)=>(
                  <div key={i} style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",
                    display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{o.item_count} {o.label_type} labels</div>
                      <div style={{fontSize:12,fontFamily:"monospace",color:"var(--amber)",marginTop:2}}>
                        {o.code_start} → {o.code_end}
                      </div>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,textTransform:"capitalize",
                      background:o.status==="shipped"||o.status==="delivered"?"rgba(76,175,80,.12)":"rgba(212,168,67,.1)",
                      color:o.status==="shipped"||o.status==="delivered"?"#4caf50":"var(--gold)"}}>
                      {o.status==="pending"?"⏳ Pending":o.status==="processing"?"🔄 Processing":
                       o.status==="shipped"?"✈ Shipped":"✓ Delivered"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ORDER TAB ══ */}
      {tab==="order"&&!isAdmin&&(
        <div style={{maxWidth:560}}>
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,
            padding:"40px 32px",textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:16}}>🏷</div>
            <div style={{fontFamily:"var(--serif)",fontSize:22,marginBottom:10,fontWeight:700}}>
              Physical Label Ordering — Coming Soon
            </div>
            <p style={{fontSize:14,color:"var(--muted)",lineHeight:1.8,marginBottom:12,maxWidth:420,margin:"0 auto 12px"}}>
              We are finalizing our label printing partnership. Soon you will be able to order
              professional pre-coded QR label stickers — sticky vinyl for props and equipment,
              iron-on for costumes — mailed directly to your school.
            </p>
            <p style={{fontSize:14,color:"var(--muted)",lineHeight:1.8,marginBottom:24,maxWidth:420,margin:"0 auto 24px"}}>
              In the meantime, use the <strong style={{color:"var(--text)"}}>Print Labels</strong> tab
              to generate and print QR labels instantly from any printer.
            </p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={()=>setTab("print")}
                style={{padding:"11px 24px",borderRadius:8,border:"none",fontFamily:"inherit",
                  fontSize:14,fontWeight:700,cursor:"pointer",
                  background:"var(--gold)",color:"#1a0f00"}}>
                🖨 Print Labels Now
              </button>
              <a href={"mailto:"+APP_EMAIL+"?subject=Label Ordering Interest"}
                style={{padding:"11px 24px",borderRadius:8,border:"1px solid var(--border)",
                  fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer",
                  background:"transparent",color:"var(--text)",textDecoration:"none",
                  display:"inline-flex",alignItems:"center"}}>
                ✉ Notify Me When Ready
              </a>
            </div>
            <div style={{marginTop:24,paddingTop:20,borderTop:"1px solid var(--border)",
              fontSize:13,color:"var(--muted)"}}>
              Questions? Email{" "}
              <a href={"mailto:"+APP_EMAIL} style={{color:"var(--goldink)",fontWeight:600}}>
                {APP_EMAIL}
              </a>
            </div>
          </div>

          {/* Show previous orders if any exist */}
          {orders.length>0&&(
            <div style={{marginTop:28}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Your Label Orders</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {orders.map((o,i)=>(
                  <div key={i} style={{background:"var(--parch)",border:"1px solid var(--border)",
                    borderRadius:10,padding:"14px 16px"}}>
                    {/* Header row */}
                    <div style={{display:"flex",gap:10,alignItems:"flex-start",
                      flexWrap:"wrap",marginBottom:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:700}}>
                          {o.item_count} labels
                          {o.assigned_count>0&&o.blank_count>0
                            ? ` (${o.assigned_count} assigned + ${o.blank_count} blank)`
                            : o.assigned_count>0 ? ` (${o.assigned_count} assigned)`
                            : o.blank_count>0    ? ` (${o.blank_count} blank)` : ""}
                        </div>
                        <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>
                          {new Date(o.created_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
                          {o.vendor&&" · "+o.vendor}
                        </div>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:6,
                        background:o.status==="delivered"?"rgba(76,175,80,.12)":
                                   o.status==="shipped"?"rgba(66,165,245,.12)":
                                   o.status==="processing"?"rgba(33,150,243,.12)":"rgba(212,168,67,.1)",
                        color:o.status==="delivered"?"#4caf50":
                              o.status==="shipped"?"#42a5f5":
                              o.status==="processing"?"#2196f3":"var(--gold)"}}>
                        {o.status==="pending"?"⏳ Pending":o.status==="processing"?"🔄 Processing":
                         o.status==="shipped"?"✈️ Shipped":"✅ Delivered"}
                      </span>
                    </div>

                    {/* Detail rows */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",
                      gap:6,fontSize:12,color:"var(--muted)",marginBottom:o.tracking||o.vendor_order_ref?8:0}}>
                      {o.code_start&&(
                        <div>
                          <span style={{fontFamily:"monospace",color:"var(--amber)"}}>
                            {o.code_start}
                          </span>
                          {o.code_end&&o.code_end!==o.code_start&&(
                            <span style={{fontFamily:"monospace",color:"var(--amber)"}}>
                              {" → "+o.code_end}
                            </span>
                          )}
                        </div>
                      )}
                      {o.costume_count>0&&(
                        <div>👗 {o.costume_count} iron-on (costumes)</div>
                      )}
                      {o.equipment_count>0&&(
                        <div>🏷️ {o.equipment_count} polypropylene (equipment)</div>
                      )}
                    </div>

                    {(o.tracking||o.vendor_order_ref)&&(
                      <div style={{fontSize:12,color:"var(--muted)",marginBottom:8}}>
                        {o.vendor_order_ref&&<div>📋 Order ref: <strong style={{color:"var(--text)"}}>{o.vendor_order_ref}</strong></div>}
                        {o.tracking&&<div>📦 Tracking: <strong style={{color:"var(--text)"}}>{o.tracking}</strong></div>}
                      </div>
                    )}

                    {/* Reorder button */}
                    <button
                      onClick={async()=>{
                        const sum = await SB.rpc("get_label_order_summary",{p_org_id:userId});
                        const s = sum?.data;
                        if(!s)return;
                        const msg = [
                          `Based on your current inventory:`,
                          `• ${s.unlabeled_items} items need labels`,
                          `• ${s.pool_blank} blank labels still available`,
                          `• Next blank codes start at: ${org?.label_prefix||"?"}-${String(s.next_blank_start).padStart(4,"0")}`,
                          ``,
                          `To request a new order, email ${APP_EMAIL} with:`,
                          `  - How many assigned labels (for specific items)`,
                          `  - How many blank labels you want`,
                          `  - Shipping address`,
                        ].join("\n");
                        alert(msg);
                      }}
                      style={{fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:6,
                        border:"1px solid var(--border)",background:"var(--parch)",
                        color:"var(--muted)",cursor:"pointer",fontFamily:"inherit",
                        marginTop:4}}>
                      🔄 Reorder / Request New Labels
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==="order"&&isAdmin&&(
        <div>
          <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.3)",
            borderRadius:10,padding:"10px 16px",marginBottom:20,display:"flex",
            gap:10,alignItems:"center"}}>
            <span style={{fontSize:16}}>🔧</span>
            <span style={{fontSize:13,fontWeight:700,color:"var(--goldink)"}}>Admin preview</span>
            <span style={{fontSize:13,color:"var(--muted)"}}>
              This order UI is visible only to you. Other programs see a Coming Soon page.
            </span>
          </div>
          <p style={{fontSize:14,color:"var(--muted)",marginBottom:18,lineHeight:1.7}}>
            Full order flow is accessible here for testing and development.
            Tag each inventory item with a label type, add blank extras for future items,
            then submit to generate an order in the database.
          </p>
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Order flow is in development</div>
            <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
              The complete order UI (item tagging, blank label extras, shipping address, cost summary)
              will appear here once WePrintBarcodes pricing and CSV format are confirmed.
              For now, use the Admin Hub Label Orders tab to manage orders manually.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
