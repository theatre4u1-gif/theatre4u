// INVENTORY PAGE — extracted from App.jsx (modularization).
import React, { useState, useEffect, useMemo } from "react";
import { SB } from "./supabase.js";
import { Modal, Pager, HeroImg, CatCard, CatThumb } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { EM } from "./messages.js";
import { fmt$, uid } from "./helpers.js";
import { CAT, CATS, CAT_GFX, CONDS, SIZES, AVAIL, MKT, getCatsMerged, customCatsFor } from "./inventory.js";
import { QR } from "./qr.js";
import { PLANS_DEF } from "./plans.js";
import { BG, usp } from "../lib/backgrounds.js";
import { getExchangeName, getVertical, getCatGfx, getCats, getTerm } from "../lib/verticals.js";
import { CSVImport } from "./marketplace.jsx";
import { ItemForm, ItemDetail } from "./items.jsx";
import { BulkPhotoAdd } from "./bulk-photo-add.jsx";
import { LocationsPanel } from "./locations.jsx";
import { ExternalLoans } from "./external-loans.jsx";
import { UpgradePrompt } from "./billing.jsx";

export function Inventory({items,onAdd,onEdit,onDelete,userId, memberRole="director",plan="free",headerNote=null,schoolName=null,org=null, deepLinkLocationId=null, onDeepLinkConsumed=null, deepLinkCategory=null, onDeepLinkCategoryConsumed=null, enableLoans=false, onImported=null}){
    const[upgradeReason,setUpgradeReason]=useState(null);
  const vVertical=org?.vertical||"theatre";
  const vCATS=getCatsMerged(vVertical);
  const vCfg=getVertical(vVertical);
  const vCONDS=vCfg.conditions, vAVAIL=vCfg.availability, vMKT=vCfg.marketOptions;
  const vCAT=Object.fromEntries(vCATS.map(c=>[c.id,c]));
  // Role-based permissions
  const canEdit   = memberRole !== "house";
  const canAdd    = memberRole !== "house";
  const canDelete = memberRole === null || memberRole === "director" || memberRole === "stage_manager";

  // ── Storage location deep link — filter items when QR scanned ────────────────
  const [locFilter,     setLocFilter]     = useState(deepLinkLocationId || "all");
  const [locFilterName, setLocFilterName] = useState(null);
  useEffect(()=>{
    if (!deepLinkLocationId) return;
    setLocFilter(deepLinkLocationId);
    (async()=>{
      try {
        const {data} = await SB.from("storage_locations")
          .select("name,code,description").eq("id", deepLinkLocationId).single();
        if (data) setLocFilterName(data);
      } catch(e){}
      if (onDeepLinkConsumed) onDeepLinkConsumed();
    })();
  }, [deepLinkLocationId]);

  // Consume category deep link from dashboard Browse by Category
  useEffect(()=>{
    if (!deepLinkCategory) return;
    setCatF(deepLinkCategory);
    setView("grid");
    if (onDeepLinkCategoryConsumed) onDeepLinkCategoryConsumed();
  }, [deepLinkCategory]);

  const[search,setSrch]=useState("");const[catF,setCatF]=useState("all");
  const[condF,setCondF]=useState("all");const[availF,setAvailF]=useState("all");
  const[mktF,setMktF]=useState("all");const[view,setView]=useState("grid"); // grid | table | locations
  const[showF,setShowF]=useState(false);const[pg,setPg]=useState(1);
  const[modal,setModal]=useState(null);const[active,setActive]=useState(null);
  const[showImport,setShowImport]=useState(false);
  const[showBulk,setShowBulk]=useState(false);
  const[addMenu,setAddMenu]=useState(false);
  const[invView,setInvView]=useState("items"); // items | loans (Borrowed & Lent tab)

  // ── Bulk / mass edit state ───────────────────────────────────────────────
  const[selectMode, setSelectMode] = useState(false);
  const[selected,   setSelected]   = useState(new Set()); // Set of item ids
  const[bulkSaving, setBulkSaving] = useState(false);
  const[bulkMsg,    setBulkMsg]    = useState("");
  const[bulkField,  setBulkField]  = useState(""); // which field to bulk-update
  const[bulkValue,  setBulkValue]  = useState("");  // what value
  const[autoCatRunning, setAutoCatRunning] = useState(false);
  const[autoCatMsg,     setAutoCatMsg]     = useState("");

  // Auto-categorize selected items using Claude AI
  const autoCategorizeSel = async () => {
    if (selected.size === 0) return;
    setAutoCatRunning(true);
    setAutoCatMsg("Analyzing items…");
    const ids = [...selected];
    const toProcess = items.filter(i => ids.includes(i.id));
    let updated = 0, failed = 0;

    for (const item of toProcess) {
      try {
        const vCatIds = getCats(vVertical).map(c=>c.id);
        const prompt = "You are categorizing " + vCfg.label + " program inventory items. "
          + "Given the item name and notes, return ONLY the single best category ID from this list: "
          + vCatIds.join(", ") + ". "
          + "Return only the category ID, nothing else. "
          + "Item name: " + item.name + ". "
          + (item.notes ? "Notes: " + item.notes + "." : "");

        const res = await fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/ai-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prompt, context: "categorize" }),
        });
        const json = await res.json();
        const raw  = (json.reply || json.response || json.content || "").trim().toLowerCase();
        const VALID = getCats(vVertical).map(c=>c.id);
        const cat   = VALID.find(c => raw.includes(c));
        if (cat && cat !== item.category) {
          const { error } = await SB.from("items").update({ category: cat }).eq("id", item.id);
          if (!error) { onEdit({ ...item, category: cat }); updated++; }
          else failed++;
        } else {
          updated++; // already correct or no change needed
        }
        setAutoCatMsg("Analyzing… " + (updated + failed) + "/" + toProcess.length);
      } catch(e) { failed++; }
    }

    setAutoCatMsg("✅ Done — " + updated + " item" + (updated!==1?"s":"") + " categorized"
      + (failed > 0 ? ", " + failed + " failed" : ""));
    setAutoCatRunning(false);
    setSelected(new Set());
    setTimeout(() => setAutoCatMsg(""), 4000);
  };

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const selectAll  = () => setSelected(new Set(filtered.map(i=>i.id)));
  const clearSelect = () => { setSelected(new Set()); };

  const applyBulkEdit = async () => {
    if (!bulkField || !bulkValue || selected.size === 0) return;
    setBulkSaving(true);
    setBulkMsg("");
    const ids = [...selected];
    const colMap = {
      category:   "category",
      location:   "location",
      condition:  "condition",
      avail:      "avail",
      mkt:        "mkt",
    };
    const col = colMap[bulkField];
    if (!col) { setBulkSaving(false); return; }
    const { error } = await SB.from("items")
      .update({ [col]: bulkValue })
      .in("id", ids)
      .eq("org_id", userId);
    if (error) {
      setBulkMsg("❌ Update failed: " + error.message);
    } else {
      ids.forEach(id => onEdit({ ...items.find(i=>i.id===id), [col]: bulkValue }));
      setBulkMsg("✅ Updated " + ids.length + " item" + (ids.length!==1?"s":""));
      setSelected(new Set());
      setBulkField("");
      setBulkValue("");
      setTimeout(()=>setBulkMsg(""), 3000);
    }
    setBulkSaving(false);
  };
  const PP=20;
  const mktCls=m=>m==="For Rent"?"mb-rent":m==="For Sale"?"mb-sale":m==="Rent or Sale"?"mb-both":m==="For Loan"?"mb-loan":"mb-none";
  const filtered=useMemo(()=>{
    let f=items;
    if(search){const q=search.toLowerCase();f=f.filter(i=>i.name.toLowerCase().includes(q)||(i.notes||"").toLowerCase().includes(q)||(i.location||"").toLowerCase().includes(q)||(i.display_id||"").toLowerCase().includes(q)||(i.tags||[]).some(t=>t.includes(q)))}
    if(catF!=="all")f=f.filter(i=>i.category===catF);
    if(condF!=="all")f=f.filter(i=>i.condition===condF);
    if(availF!=="all")f=f.filter(i=>i.avail===availF);
    if(mktF!=="all")f=f.filter(i=>i.mkt===mktF);
    if(locFilter!=="all")f=f.filter(i=>
      i.location_id===locFilter ||
      (i.location&&locFilterName&&i.location.toLowerCase()===locFilterName.name.toLowerCase())
    );
    return f;
  },[items,search,catF,condF,availF,mktF,locFilter,locFilterName]);
  const paged=useMemo(()=>filtered.slice((pg-1)*PP,pg*PP),[filtered,pg]);
  useEffect(()=>setPg(1),[search,catF,condF,availF,mktF]);
  const openD=item=>{setActive(item);setModal("d")};
  const openE=item=>{setActive(item);setModal("e")};
  const handleSave=async form=>{
    if(active&&modal==="e"){
      await onEdit({...active,...form,id:active.id});
    } else {
      await onAdd({...form,id:uid(),added:new Date().toISOString()});
    }
    setModal(null);setActive(null);
  };
  const maxItems = PLANS_DEF[plan]?.maxItems ?? 25;
  const nearLimit = plan==="free" && items.length >= 20 && items.length < 25;

  const [printingQR, setPrintingQR] = useState(false);

  const printQRFiltered = async () => {
    const toPrint = filtered.length > 0 ? filtered : items;
    if (!toPrint.length) { alert("No items to print."); return; }
    setPrintingQR(true);
    try {
      const w = window.open("", "_blank", "width=950,height=720");
      if (!w) { alert("Pop-up blocked — please allow pop-ups for theatre4u.org and try again."); setPrintingQR(false); return; }
      w.document.write(`<html><head><title>QR Labels</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;background:#fff;padding:14px}
        .controls{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
        .controls h2{font-size:14px;color:#333;flex:1}
        .btn{padding:6px 16px;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px}
        .btn-p{background:#d4a843;color:#1a0800}
        .btn-c{background:#eee;color:#333;border:1px solid #ccc}
        .grid{display:flex;flex-wrap:wrap;gap:8px}
        .lbl{width:170px;height:170px;border:1.5px solid #222;border-radius:7px;padding:9px;display:flex;flex-direction:column;gap:2px;page-break-inside:avoid;background:#fff}
        .lbl-cat{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;overflow:hidden;white-space:nowrap}
        .lbl-name{font-size:10px;font-weight:700;color:#111;line-height:1.25;flex:1;overflow:hidden;word-break:break-word}
        .lbl-loc{font-size:8.5px;color:#444;font-weight:600}
        .lbl-id{font-size:9px;font-weight:800;color:#c4761a;font-family:monospace;letter-spacing:.5px}
        .lbl-row{display:flex;align-items:flex-end;justify-content:space-between;margin-top:auto}
        .lbl-brand{font-size:7px;color:#bbb}
        .lbl-qr{width:62px;height:62px}
        @media print{.controls{display:none!important}.grid{gap:7px}.lbl{width:162px;height:162px}}
      </style></head><body>
      <div class="controls">
        <h2>${toPrint.length} label${toPrint.length!==1?"s":""}</h2>
        <button class="btn btn-p" onclick="window.print()">Print</button>
        <button class="btn btn-c" onclick="window.close()">Close</button>
        <span style="font-size:11px;color:#888">Tip: set margins to None in print dialog</span>
      </div>
      <div class="grid" id="lbl">Generating labels…</div>
      </body></html>`);
      w.document.close();
      const srcs = await Promise.all(toPrint.map(i => QR.toDataURL("https://theatre4u.org/#/item/" + i.id, 140)));
      const labels = toPrint.map((item, n) => {
        const cat = CAT[item.category] || CAT.other;
        const dispId = item.display_id || item.id.slice(0,8).toUpperCase();
        return "<div class=\"lbl\">"
          + "<div class=\"lbl-cat\" style=\"color:"+( cat.color||"#888")+"\">" + cat.icon + " " + cat.label + "</div>"
          + "<div class=\"lbl-name\">" + item.name + "</div>"
          + (item.location ? "<div class=\"lbl-loc\">📍 " + item.location + "</div>" : "")
          + "<div class=\"lbl-id\">" + dispId + "</div>"
          + "<div class=\"lbl-row\"><div><div class=\"lbl-brand\">theatre4u.org</div></div>"
          + (srcs[n] ? "<img class=\"lbl-qr\" src=\"" + srcs[n] + "\" alt=\"QR\"/>" : "")
          + "</div></div>";
      }).join("");
      const el = w.document.getElementById("lbl");
      if (el) { el.outerHTML = "<div class=\"grid\">" + labels + "</div>"; setTimeout(() => w.print(), 500); }
    } finally { setPrintingQR(false); }
  };

  const atLimit   = plan==="free" && items.length >= 25;

  return(<>
    {enableLoans&&(
      <div className="vtog" style={{margin:"0 0 14px"}}>
        <button className={invView==="items"?"on":""} onClick={()=>setInvView("items")}>📦 Inventory</button>
        <button className={invView==="loans"?"on":""} onClick={()=>setInvView("loans")}>🔄 Borrowed & Lent</button>
      </div>
    )}
    {enableLoans&&invView==="loans" ? (
      <div style={{padding:"8px 0 56px"}}><ExternalLoans userId={userId} org={org} items={items}/></div>
    ) : (<>
    {upgradeReason&&<UpgradePrompt reason={upgradeReason} onClose={()=>setUpgradeReason(null)} userId={userId} userEmail={org?.email}/>}
    {locFilter!=="all"&&locFilterName&&(
      <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(232,184,93,.1)",border:"1px solid rgba(232,184,93,.3)",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
        <span style={{fontSize:20}}>📦</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14,color:"var(--goldink)"}}>{locFilterName.name}{locFilterName.code?` · ${locFilterName.code}`:""}</div>
          <div style={{fontSize:12,color:"var(--t2)",marginTop:1}}>{filtered.length} item{filtered.length!==1?"s":""} in this location</div>
          {locFilterName.description&&<div style={{fontSize:11,color:"var(--t3)",marginTop:1,fontStyle:"italic"}}>{locFilterName.description}</div>}
        </div>
        <button onClick={()=>{setLocFilter("all");setLocFilterName(null);}} style={{background:"none",border:"1px solid rgba(232,184,93,.3)",borderRadius:6,color:"var(--t2)",padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit",whiteSpace:"nowrap"}}>Show All</button>
      </div>
    )}
    {headerNote}
    {(nearLimit||atLimit)&&(
      <div style={{background:atLimit?"rgba(194,24,91,.12)":"rgba(212,168,67,.1)",border:"1px solid "+(atLimit?"rgba(194,24,91,.3)":"rgba(212,168,67,.25)"),borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:13,color:atLimit?"var(--red)":"var(--gold)",fontWeight:600}}>
          {atLimit?"⚠️ Item limit reached — upgrade to add more items.":"⚡ "+items.length+"/25 items used on free plan."}
        </span>
        <button className="btn btn-g" style={{padding:"5px 14px",fontSize:12}} onClick={()=>setUpgradeReason("Upgrade to Pro for unlimited inventory, Backstage Exchange access, Stage Points, and more.")}>Upgrade →</button>
      </div>
    )}
    <div style={{position:"relative"}}>
      <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.inventory} w={1400} h={900} className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:240}}>
          <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.inventory} w={1100} h={300} alt="" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📦 Your Collection</div>
            <h1 className="hero-title" style={{fontSize:46}}>Inventory</h1>
            <p className="hero-sub">{getTerm(vVertical,"inventorySub")}</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>
      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
          <div className="srch">{Ic.search}<input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search items, tags, location…"/></div>
          <button className="ico-btn" style={showF?{borderColor:"var(--gold)",color:"var(--cog)"}:{}} onClick={()=>setShowF(!showF)}>{Ic.filter}</button>
          <div className="vtog"><button className={view==="grid"?"on":""} onClick={()=>setView("grid")}>Grid</button><button className={view==="table"?"on":""} onClick={()=>setView("table")}>Table</button><button className={view==="locations"?"on":""} onClick={()=>setView("locations")}>📦 Locations</button></div>
          {canEdit&&<button
            onClick={()=>{ setSelectMode(m=>!m); setSelected(new Set()); setBulkField(""); setBulkValue(""); setBulkMsg(""); }}
            style={{padding:"6px 13px",borderRadius:7,border:"1.5px solid",fontSize:13,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
              borderColor: selectMode?"var(--gold)":"var(--border)",
              background:  selectMode?"rgba(212,168,67,.12)":"transparent",
              color:       selectMode?"var(--gold)":"var(--muted)"}}>
            {selectMode ? ("✓ Selecting "+(selected.size>0?"("+selected.size+")":"")) : "☐ Select"}
          </button>}
          <div style={{marginLeft:"auto",display:"flex",gap:7}}>
            <button className="btn btn-o" style={{fontSize:12,padding:"6px 12px"}} disabled={printingQR}
              onClick={printQRFiltered} title="Print QR labels for visible items">
              {printingQR ? "Generating…" : ("🖨 Print QR" + (filtered.length < items.length ? " ("+filtered.length+")" : ""))}
            </button>
            {canAdd&&<div style={{position:"relative"}}>
              <button className="btn btn-g" onClick={()=>setAddMenu(m=>!m)} title="Add items">
                <span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add <span style={{fontSize:10,marginLeft:2}}>▾</span>
              </button>
              {addMenu&&<>
                <div onClick={()=>setAddMenu(false)} style={{position:"fixed",inset:0,zIndex:40}}/>
                <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",zIndex:41,background:"var(--cream)",border:"1px solid var(--border)",borderRadius:"var(--rm)",boxShadow:"var(--sh2)",minWidth:236,overflow:"hidden"}}>
                  <button className="addmenu-item" onClick={()=>{setAddMenu(false);const max=PLANS_DEF[plan]?.maxItems??25;if(items.length>=max){setUpgradeReason(EM.planItemLimit.body);return;}setActive(null);setModal("a");}}>✚&nbsp;&nbsp;Add one item</button>
                  <button className="addmenu-item" onClick={()=>{setAddMenu(false);setShowBulk(true);}}>📸&nbsp;&nbsp;Bulk add from photos</button>
                  <button className="addmenu-item" onClick={()=>{setAddMenu(false);setShowImport(true);}}>⬆&nbsp;&nbsp;Import from CSV</button>
                </div>
              </>}
            </div>}
          </div>
        </div>

        {/* ── Bulk Edit Action Bar — shown when Select Mode is active ── */}
        {selectMode&&canEdit&&(
          <div style={{background:"linear-gradient(135deg,rgba(212,168,67,.1),rgba(212,168,67,.04))",
            border:"1px solid rgba(212,168,67,.35)",borderRadius:10,padding:"12px 16px",
            marginBottom:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            {/* Selection controls */}
            <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
              <button onClick={selectAll}
                style={{padding:"5px 11px",borderRadius:6,border:"1px solid var(--border)",
                  background:"transparent",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                Select All ({filtered.length})
              </button>
              {selected.size>0&&<button onClick={clearSelect}
                style={{padding:"5px 11px",borderRadius:6,border:"1px solid var(--border)",
                  background:"transparent",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                Clear
              </button>}
              {selected.size>0&&<span style={{fontSize:13,fontWeight:700,color:"var(--goldink)"}}>
                {selected.size} selected
              </span>}
            </div>

            {/* Auto-categorize — shown when items are selected */}
            {selected.size>0&&(
              <button onClick={autoCategorizeSel} disabled={autoCatRunning}
                title="Use AI to suggest the best category for each selected item based on its name and description"
                style={{padding:"5px 13px",borderRadius:6,border:"1px solid rgba(212,168,67,.4)",
                  background:"rgba(212,168,67,.1)",color:"var(--goldink)",fontSize:12,fontWeight:700,
                  cursor:autoCatRunning?"not-allowed":"pointer",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                {autoCatRunning ? "✨ Analyzing…" : "✨ Auto-categorize"}
              </button>
            )}
            {autoCatMsg&&<span style={{fontSize:12,fontWeight:700,
              color:autoCatMsg.startsWith("✅")?"#4caf50":"var(--gold)"}}>{autoCatMsg}</span>}

            {/* Field + value pickers — only show when items are selected */}
            {selected.size>0&&(<>
              <div style={{display:"flex",gap:6,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:700,color:"var(--muted)",whiteSpace:"nowrap"}}>
                  Change:
                </span>
                <select value={bulkField} onChange={e=>{setBulkField(e.target.value);setBulkValue("");}}
                  style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                    background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  <option value="">— pick a field —</option>
                  <option value="category">Category</option>
                  <option value="location">Location</option>
                  <option value="condition">Condition</option>
                  <option value="avail">Availability</option>
                  <option value="mkt">Exchange Status</option>
                </select>

                {bulkField==="category"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick category —</option>
                    {vCATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                  </select>
                )}
                {bulkField==="location"&&(
                  <input value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    placeholder="e.g. Storage Bin 4A"
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,fontFamily:"inherit",
                      outline:"none",minWidth:160}}/>
                )}
                {bulkField==="condition"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick condition —</option>
                    {vCONDS.map(c=><option key={c}>{c}</option>)}
                  </select>
                )}
                {bulkField==="avail"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick availability —</option>
                    {vAVAIL.map(a=><option key={a}>{a}</option>)}
                  </select>
                )}
                {bulkField==="mkt"&&(
                  <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:7,border:"1px solid var(--border)",
                      background:"var(--white)",color:"var(--text)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    <option value="">— pick status —</option>
                    {vMKT.map(s=><option key={s}>{s}</option>)}
                  </select>
                )}

                {bulkField&&bulkValue&&(
                  <button onClick={applyBulkEdit} disabled={bulkSaving}
                    style={{padding:"6px 16px",borderRadius:7,border:"none",fontFamily:"inherit",
                      fontSize:13,fontWeight:700,cursor:bulkSaving?"not-allowed":"pointer",
                      background:"var(--gold)",color:"#1a0f00"}}>
                    {bulkSaving?"Saving…":"Apply to "+selected.size+" item"+(selected.size!==1?"s":"")}
                  </button>
                )}
              </div>
            </>)}

            {bulkMsg&&<div style={{fontSize:13,fontWeight:700,
              color:bulkMsg.startsWith("✅")?"#4caf50":"#e53935",
              padding:"4px 10px",borderRadius:6,
              background:bulkMsg.startsWith("✅")?"rgba(76,175,80,.1)":"rgba(229,57,53,.08)"}}>
              {bulkMsg}
            </div>}
          </div>
        )}
        {showF&&(
          <div className="fbar fin">
            <div><label>Category</label><select value={catF} onChange={e=>setCatF(e.target.value)}><option value="all">All</option>{vCATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label>Condition</label><select value={condF} onChange={e=>setCondF(e.target.value)}><option value="all">All</option>{vCONDS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label>Availability</label><select value={availF} onChange={e=>setAvailF(e.target.value)}><option value="all">All</option>{vAVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
            <div><label>Exchange Status</label><select value={mktF} onChange={e=>setMktF(e.target.value)}><option value="all">All</option>{vMKT.map(s=><option key={s}>{s}</option>)}</select></div>
            <button className="btn btn-o btn-sm" onClick={()=>{setCatF("all");setCondF("all");setAvailF("all");setMktF("all")}}>Clear</button>
          </div>
        )}
        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>{filtered.length} item{filtered.length!==1?"s":""}</div>
        {view==="grid"&&(paged.length===0
          ?<div className="empty"><div className="empty-ico">{vCfg.icon}</div><h3>No Items Found</h3><p>{items.length===0?"Add your first item to build your catalog.":"Try adjusting search or filters."}</p>{items.length===0&&<button className="btn btn-g" onClick={()=>{setActive(null);setModal("a")}}><span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add First Item</button>}</div>
          :<div className="inv-grid">
              {paged.map(item=>{
                const cat=vCAT[item.category]||vCAT.other||CAT.other;
                return(
                  <div key={item.id} className="inv-card"
                    onClick={()=>selectMode ? toggleSelect(item.id) : openD(item)}
                    style={{position:"relative",...(selectMode?{cursor:"pointer",outline:selected.has(item.id)?"2px solid var(--gold)":"2px solid transparent",outlineOffset:2,background:selected.has(item.id)?"rgba(212,168,67,.06)":""}:{})}}>
                    {selectMode&&<div style={{position:"absolute",top:10,left:10,zIndex:10,width:24,height:24,borderRadius:6,border:"2px solid",borderColor:selected.has(item.id)?"var(--gold)":"rgba(255,255,255,.6)",background:selected.has(item.id)?"var(--gold)":"rgba(0,0,0,.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#1a0f00"}}>{selected.has(item.id)?"✓":""}</div>}
                    <div className="inv-img">{item.img?<img src={item.img} alt={item.name} loading="lazy"/>:<CatCard catId={item.category} width="100%" height={220} vertical={vVertical}><div style={{padding:"0 14px 12px",color:"#fff"}}></div></CatCard>}</div>
                    <div className="inv-body">
                      {schoolName&&<div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:"#42a5f5",marginBottom:4,display:"flex",alignItems:"center",gap:4}}><span>🏫</span>{schoolName}</div>}
                      <div className="inv-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</div>
                      <div className="inv-name">{item.name}</div>
                      {item.location&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:4,display:"flex",alignItems:"center",gap:3}}>📍 {item.location}</div>}
                      <div className="inv-meta">{item.display_id&&<span className="chip" style={{fontFamily:"monospace",fontWeight:800,color:"var(--amber)",letterSpacing:.5}}>{item.display_id}</span>}<span className="chip">{item.condition}</span><span className="chip">×{item.qty}</span>{item.low_stock_threshold>0&&item.qty<=item.low_stock_threshold&&<span className="chip" style={{background:"rgba(230,74,25,.18)",color:"#ff7043",fontWeight:800}}>⚠ Low Stock</span>}{item.size!=="N/A"&&<span className="chip">{item.size}</span>}<span className="chip">{item.avail}</span></div>
                      <div className="inv-foot"><span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span>{item.mkt==="For Loan"?<span style={{fontSize:12,color:"#00838f",fontWeight:700}}>{item.loan_period||2}wk loan{item.deposit>0?" · "+fmt$(item.deposit)+" dep.":""}</span>:item.mkt!=="Not Listed"&&<span className="price">{item.rent>0?fmt$(item.rent)+"/wk":""}{item.rent>0&&item.sale>0?" · ":""}{item.sale>0?fmt$(item.sale):""}</span>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
        )}
        {view==="table"&&(
          <div className="tw">
            <table>
              <thead><tr>
                {selectMode&&<th style={{width:36}}></th>}
                <th style={{width:60}}>#</th><th></th><th>Item</th><th>Category</th><th>Cond.</th><th>Qty</th><th>Location</th><th>Avail.</th><th>Market</th><th></th>
              </tr></thead>
              <tbody>
                {paged.map(item=>{
                  const cat=vCAT[item.category]||vCAT.other||CAT.other;
                  const isSel = selectMode && selected.has(item.id);
                  return(
                    <tr key={item.id} style={isSel?{background:"rgba(212,168,67,.06)"}:{}}
                      onClick={selectMode?()=>toggleSelect(item.id):undefined}
                      className={selectMode?"select-row":""}>
                      {selectMode&&<td style={{width:36,padding:"4px 8px",textAlign:"center"}}>
                        <div style={{width:20,height:20,borderRadius:5,border:"1.5px solid",
                          borderColor:isSel?"var(--gold)":"var(--border)",
                          background:isSel?"var(--gold)":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:12,fontWeight:900,color:"#1a0f00",margin:"0 auto"}}>
                          {isSel?"✓":""}
                        </div>
                      </td>}
                      <td style={{padding:"4px 10px",fontFamily:"monospace",fontSize:12,fontWeight:800,color:"var(--amber)",whiteSpace:"nowrap"}}>{item.display_id||""}</td>
                      <td style={{width:40,padding:"4px 8px"}}>{item.img?<img src={item.img} alt="" style={{width:32,height:32,borderRadius:4,objectFit:"cover"}}/>:<CatThumb catId={item.category} size={32} vertical={vVertical}/>}</td>
                      <td style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:15,cursor:"pointer",color:"var(--ink)"}} onClick={selectMode?undefined:()=>openD(item)}>{item.name}</td>
                      <td style={{fontWeight:700,color:"var(--muted)"}}>{cat.icon} {cat.label}</td>
                      <td>{item.condition}</td><td style={{fontWeight:800}}>{item.qty}</td>
                      <td style={{color:"var(--muted)"}}>
                        {schoolName&&<div style={{fontSize:10,fontWeight:800,color:"#42a5f5",marginBottom:2}}>🏫 {schoolName}</div>}
                        {item.location||"—"}
                      </td>
                      <td>{item.avail}</td>
                      <td><span className={"mkt-badge "+mktCls(item.mkt)}>{item.mkt}</span></td>
                      <td><div style={{display:"flex",gap:4}}>
                        {!selectMode&&<button className="ico-btn" onClick={e=>{e.stopPropagation();openE(item)}}>{Ic.edit}</button>}
                        {!selectMode&&canDelete&&<button className="ico-btn" style={{color:"var(--red)"}} onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))onDelete(item.id)}}>{Ic.trash}</button>}
                      </div></td>
                    </tr>
                  );
                })}
                {paged.length===0&&<tr><td colSpan={selectMode?10:9} style={{textAlign:"center",color:"var(--faint)",padding:40,fontFamily:"'Lora',serif",fontStyle:"italic"}}>No items found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pager total={filtered.length} page={pg} per={PP} onPage={setPg}/>
      </div>
      {view==="locations"&&<LocationsPanel
        userId={userId}
        items={items}
        vertical={vVertical}
        onEditItem={item=>{setActive(item);setModal("e");}}
        onDeleteItem={id=>{onDelete(id);}}
      />}
      {modal==="a"&&(<Modal title="Add New Item" onClose={()=>setModal(null)}
         >
          <ItemForm onSave={handleSave} onCancel={()=>setModal(null)} userId={userId} marketplaceEnabled={!!org?.marketplace_enabled} vertical={org?.vertical||"theatre"}/>
        </Modal>)}
      {modal==="e"&&active&&(<Modal title="Edit Item" onClose={()=>setModal(null)}
         >
          <ItemForm item={active} onSave={handleSave} onCancel={()=>setModal(null)} userId={userId} marketplaceEnabled={!!org?.marketplace_enabled} vertical={org?.vertical||"theatre"}/>
        </Modal>)}
      {modal==="d"&&active&&<Modal title="Item Details" onClose={()=>{setModal(null);setActive(null)}}><ItemDetail item={active} userId={userId} schoolName={schoolName} onEdit={canEdit?()=>setModal("e"):null} onDelete={canDelete?(id=>{onDelete(id);setModal(null);setActive(null)}):null} canEdit={canEdit} canDelete={canDelete}/></Modal>}
      {showImport&&<CSVImport userId={userId} onClose={()=>setShowImport(false)} onImport={async()=>{setShowImport(false);const{data}=await SB.from("items").select("*").eq("org_id",userId).order("added",{ascending:false});if(data&&onImported)onImported(data);}}/>}
      {showBulk&&<BulkPhotoAdd userId={userId} vertical={vVertical} cats={vCATS} onClose={()=>setShowBulk(false)} onImport={(data)=>{if(onImported)onImported(data);}}/>}
    </div>
    </>)}
  </>
  );
}