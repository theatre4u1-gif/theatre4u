// ITEMS — ItemForm, ItemDetail, AvailabilityCalendar (+ date helpers).
// Extracted from App.jsx (modularization). ItemForm/ItemDetail are the keystone
// item components rendered by Inventory and Marketplace. uploadPhoto moved in
// (used only here).
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { APP_HOST, APP_URL, APP_NAME } from "./config.js";
import { SB } from "./supabase.js";
import { EM } from "./messages.js";
import { Ic } from "./icons.jsx";
import { FbShareBtn } from "./ui.jsx";
import { resizeImg, itemShareUrl, itemShareText, fmt$ } from "./helpers.js";
import { CAT, CAT_GFX, MKT, customCatsFor } from "./inventory.js";
import { QR } from "./qr.js";
import { ROW_LABELS, COL_LABELS } from "./storage-map.js";
import { AddToProductionPicker } from "./productions.jsx";
import { getVertical, getExchangeName, getTerm } from "../lib/verticals.js";

// Format an item number as "#0001" (moved from App.jsx — only ItemDetail uses it)
const itemNum = n => n != null ? "#" + String(n).padStart(4, "0") : "";

// Live in-app camera (desktop webcam): snap a series of photos, each uploaded and
// attached to the item up to its cap. Falls back to Add Photo if the camera is blocked.
export function CameraCapture({ max, current, onCapture, onClose, noun = "photos", unlimited = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState(false);
  const [shots, setShots] = useState([]); // {id,url,status:'up'|'ok'|'err'}
  const stopCam = () => { const s = streamRef.current; if (s) { s.getTracks().forEach(t => t.stop()); streamRef.current = null; } };
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setErr(true); return; }
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        const v = videoRef.current;
        if (v) { v.srcObject = s; v.play().catch(() => {}); }
      } catch (e) { setErr(true); }
    })();
    return () => { active = false; stopCam(); };
  }, []);
  // Only count shots still uploading; finished ones are already reflected in `current`
  // (attached photos / bulk rows), so counting both would double-count.
  const pending = shots.filter(s => s.status === "up").length;
  const remaining = unlimited ? 999 : (max - current - pending);
  const canSnap = remaining > 0 && !err;
  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || remaining <= 0) return;
    const cv = document.createElement("canvas");
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
    const id = String(Date.now()) + Math.random().toString(36).slice(2);
    const preview = cv.toDataURL("image/jpeg", 0.5);
    setShots(p => [...p, { id, url: preview, status: "up" }]);
    cv.toBlob(async blob => {
      if (!blob) { setShots(p => p.map(s => s.id === id ? { ...s, status: "err" } : s)); return; }
      const file = new File([blob], "camera-" + id + ".jpg", { type: "image/jpeg" });
      let ok = false; try { ok = await onCapture(file); } catch (_) {}
      setShots(p => p.map(s => s.id === id ? { ...s, status: ok ? "ok" : "err" } : s));
    }, "image/jpeg", 0.9);
  };
  const done = () => { stopCam(); onClose(); };
  const ov = { position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const panel = { width: "min(640px,96vw)", background: "#0c0c0c", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" };
  if (err) return (
    <div style={ov} onClick={e => e.target === e.currentTarget && done()}>
      <div style={{ ...panel, padding: 28, alignItems: "center", textAlign: "center", color: "#fff", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Camera unavailable</div>
        <div style={{ fontSize: 13, opacity: .8, maxWidth: 320, lineHeight: 1.5 }}>Allow camera access in your browser, or use Add Photo / Google Drive instead.</div>
        <button className="btn btn-g btn-sm" onClick={done} style={{ marginTop: 6 }}>Close</button>
      </div>
    </div>
  );
  return (
    <div style={ov} onClick={e => e.target === e.currentTarget && done()}>
      <div style={panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", color: "#fff" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{unlimited ? current + " " + noun + " added" : (current + pending) + " / " + max + " " + noun}</span>
          <button type="button" onClick={done} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ position: "relative", background: "#000", aspectRatio: "4 / 3" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          {!unlimited && remaining <= 0 && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.55)", color: "#fff", fontWeight: 700, fontSize: 15, textAlign: "center", padding: 20 }}>All {max} photo slots filled — click Done.</div>}
        </div>
        {shots.length > 0 && <div style={{ display: "flex", gap: 8, padding: "10px 12px", overflowX: "auto", background: "#111" }}>
          {shots.map(s => <div key={s.id} style={{ position: "relative", flex: "0 0 auto" }}>
            <img src={s.url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, opacity: s.status === "up" ? .5 : 1, border: s.status === "err" ? "2px solid #e53935" : "2px solid transparent" }} />
          </div>)}
        </div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 20px", background: "#111" }}>
          <span style={{ color: "#fff", opacity: .7, fontSize: 12 }}>{canSnap ? "Click the shutter for each shot" : ""}</span>
          <button type="button" disabled={!canSnap} aria-label="Take photo" onClick={snap} style={{ width: 66, height: 66, borderRadius: "50%", border: "5px solid rgba(255,255,255,.5)", background: canSnap ? "#fff" : "rgba(255,255,255,.35)", cursor: canSnap ? "pointer" : "not-allowed" }} />
          <button type="button" className="btn btn-g btn-sm" onClick={done} style={{ minWidth: 70 }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// Upload a file to Supabase Storage and return the public URL
export async function uploadPhoto(file, userId) {
  try {
    const dataUrl = await resizeImg(file, 800, 0.82);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const path = userId + "/" + Date.now() + ".jpg";
    const { error } = await SB.storage.from("item-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = SB.storage.from("item-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch(e) { console.error("uploadPhoto failed:", e); return null; }
}

export function ItemForm({item,onSave,onCancel,userId,marketplaceEnabled=false,vertical="theatre",plan="free"}){
  const vConfig = getVertical(vertical);
  // Per-vertical example text (QA-4, 2026-07-04)
  const EX_ITEM = {theatre:"Victorian Ball Gown", music:"Yamaha Trumpet", dance:"Ballet Slippers (Pair)", art:"Acrylic Paint Set", booster:"Folding Table"}[vertical] || "Storage Bin";
  const EX_LOC  = {theatre:"Costume Closet A", music:"Instrument Room, Shelf 2", dance:"Costume Rack B", art:"Supply Cabinet 3", booster:"Storage Room A"}[vertical] || "Storage Room A";
  const vCATS   = [...vConfig.categories, ...customCatsFor(vertical)];
  const vCONDS  = vConfig.conditions;
  const vSIZES  = vConfig.sizes;
  const vAVAIL  = vConfig.availability;
  const vMKT    = vConfig.marketOptions;
  const defaultCat = vCATS[0]?.id || "costumes";
  const blank={name:"",category:defaultCat,condition:vCONDS[2]||"Good",size:vSIZES.includes("N/A")?"N/A":vSIZES[0],qty:1,location:"",notes:"",mkt:"Not Listed",rent:0,sale:0,loan_period:2,deposit:0,avail:"In Stock",img:null,images:[],tags:[],purchase_cost:"",purchase_date:"",purchase_vendor:"",funding_source_id:"",low_stock_threshold:0};
  const[f,setF]=useState(item||blank);
  const[ti,setTi]=useState("");
  const[upl,setUpl]=useState(false);
  const[svng,setSvng]=useState(false);
  const[showCam,setShowCam]=useState(false);
  const fr=useRef();
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  // Keep a ref always pointing at latest form state so the footer button works

  const showRent=f.mkt==="For Rent"||f.mkt==="Rent or Sale";
  const showSale=f.mkt==="For Sale"||f.mkt==="Rent or Sale";
  const showLoan=f.mkt==="For Loan";
  const maxImg = plan==="free" ? 1 : 5;
  const imgsOf = (o)=> (o.images && o.images.length ? o.images : (o.img ? [o.img] : []));
  const addImage = (url)=> setF(p=>{ const cur=imgsOf(p); if(cur.length>=maxImg) return p; const next=[...cur,url]; return {...p, images:next, img:next[0]}; });
  const removeImage = (idx)=> setF(p=>{ const cur=imgsOf(p); const next=cur.filter((_,i)=>i!==idx); return {...p, images:next, img:next[0]||null}; });
  const makeCover = (idx)=> setF(p=>{ const cur=imgsOf(p); if(idx<=0||idx>=cur.length) return p; const next=[cur[idx],...cur.filter((_,i)=>i!==idx)]; return {...p, images:next, img:next[0]}; });
  const processPhoto=async file=>{
    if(!file)return;
    if(imgsOf(f).length>=maxImg){ alert(maxImg===1?"The free plan includes 1 photo per item. Upgrade to Pro for up to 5 photos.":"You can add up to "+maxImg+" photos per item."); return; }
    setUpl(true);
    const url = userId ? await uploadPhoto(file, userId) : await resizeImg(file);
    if(url) addImage(url);
    if(!url){console.error("Photo upload failed"); alert(EM.photoTooLarge.title+"\n\n"+EM.photoTooLarge.body);}
    setUpl(false);
    if(fr.current)fr.current.value="";
  };
  const handlePhoto=e=>processPhoto(e.target.files?.[0]);
  const handleDrive=()=>{ if(window.t4uPickFromDrive){window.t4uPickFromDrive(processPhoto);} else {alert("Google Drive import isn't ready yet — please refresh the page and try again.");} };
  const capturePhoto=async file=>{ if(!file) return false; const url = userId ? await uploadPhoto(file, userId) : await resizeImg(file); if(!url) return false; addImage(url); return true; };
  const addTag=()=>{const t=ti.trim().toLowerCase();if(t&&!(f.tags||[]).includes(t))upd("tags",[...(f.tags||[]),t]);setTi("");};
  // Load active funding sources for the "charge to fund" dropdown
  const[fundSources,setFundSources]=useState([]);
  const[storLocs,setStorLocs]=useState([]);
  useEffect(()=>{
    if(!userId)return;
    SB.from("funding_sources").select("id,name,source_type").eq("org_id",userId).eq("vertical",vertical).eq("is_active",true).order("name")
      .then(({data})=>{ if(data) setFundSources(data); });
    SB.from("storage_locations").select("id,name,code,location_type,map_pins,rack_rows,rack_cols,rack_row_style,rack_col_style").eq("org_id",userId).eq("vertical",vertical).order("name")
      .then(({data})=>{ if(data) setStorLocs(data); });
  },[userId,vertical]);

  // Quick-add state — inline creation of new location or funding source
  const[qloc, setQloc] = useState(false);  // showing new-location mini-form
  const[qfund,setQfund]= useState(false);  // showing new-fund-source mini-form
  const[qlocName, setQlocName] = useState("");
  const[qlocCode, setQlocCode] = useState("");
  const[qfundName, setQfundName] = useState("");
  const[qfundType, setQfundType] = useState("grant");
  const[qsaving,  setQsaving]   = useState(false);

  const addLocation = async()=>{
    if(!qlocName.trim()||qsaving) return;
    setQsaving(true);
    const{data,error}=await SB.from("storage_locations").insert({
      org_id:userId, vertical, name:qlocName.trim(), code:qlocCode.trim()||null
    }).select("id,name,code").single();
    setQsaving(false);
    if(error){alert("Could not create location: "+error.message);return;}
    if(data){
      setStorLocs(p=>[...p,data]);
      upd("location_id",data.id);
      upd("location",data.name);
    }
    setQlocName("");setQlocCode("");setQloc(false);
  };

  const addFundSource = async()=>{
    if(!qfundName.trim()||qsaving) return;
    setQsaving(true);
    const{data,error}=await SB.from("funding_sources").insert({
      org_id:userId, vertical, name:qfundName.trim(), source_type:qfundType, is_active:true
    }).select("id,name,source_type").single();
    setQsaving(false);
    if(error){alert("Could not create funding source: "+error.message);return;}
    if(data){
      setFundSources(p=>[...p,data]);
      upd("funding_source_id",data.id);
    }
    setQfundName("");setQfund(false);
  };

  return(
    <div className="fg2">
      <div className="fg fu"><label className="fl">Item Name *</label><input className="fi" value={f.name} onChange={e=>upd("name",e.target.value)} placeholder={"e.g. "+EX_ITEM} autoFocus/></div>
      <div className="fg"><label className="fl">Category</label><select className="fs" value={f.category} onChange={e=>upd("category",e.target.value)}>{vCATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
      <div className="fg"><label className="fl">Condition</label><select className="fs" value={f.condition} onChange={e=>upd("condition",e.target.value)}>{vCONDS.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"><label className="fl">Size</label><select className="fs" value={f.size} onChange={e=>upd("size",e.target.value)}>{vSIZES.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="0" step="1" placeholder="1" value={f.qty||""} onChange={e=>upd("qty",parseInt(e.target.value)||0)}/></div>
      {(vertical==="art"||vertical==="booster") && (
        <div className="fg"><label className="fl">Low-stock alert at <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10,color:"var(--muted)"}}>(0 = off)</span></label><input className="fi" type="number" min="0" step="1" placeholder="0" value={f.low_stock_threshold||""} onChange={e=>upd("low_stock_threshold",parseInt(e.target.value)||0)}/></div>
      )}
      <div className="fg"><label className="fl">Availability</label><select className="fs" value={f.avail} onChange={e=>upd("avail",e.target.value)}>{vAVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
      <div className="fg"><label className="fl">Location</label><input className="fi" value={f.location} onChange={e=>upd("location",e.target.value)} placeholder={"e.g. "+EX_LOC}/></div>
      <div className="fg fu">
        <label className="fl">Storage Location</label>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <select className="fs" style={{flex:1}} value={f.location_id||""} onChange={e=>{
            upd("location_id",e.target.value||null);
            upd("rack_slot",null);
            upd("pin_id",null);
            const loc=storLocs.find(l=>l.id===e.target.value);
            if(loc)upd("location",loc.name);
          }}>
            <option value="">— None —</option>
            {storLocs.map(l=>{
              const icon=l.location_type==="room"?"🗺️":l.location_type==="rack"?"🏗️":"📦";
              return <option key={l.id} value={l.id}>{icon} {l.name}{l.code?" ("+l.code+")":""}</option>;
            })}
          </select>
          <button type="button" className="btn btn-o btn-sm" style={{whiteSpace:"nowrap",flexShrink:0}}
            onClick={()=>{setQloc(v=>!v);setQfund(false);}}>+ New</button>
        </div>

        {/* ── Pin sub-picker for room maps ── */}
        {(()=>{
          const selLoc = storLocs.find(l=>l.id===f.location_id);
          if(!selLoc||selLoc.location_type!=="room") return null;
          const pins = selLoc.map_pins||[];
          if(pins.length===0) return <div style={{fontSize:11,color:"var(--muted)",marginTop:6,fontStyle:"italic"}}>No pins on this room map yet — add pins in Inventory → Locations tab.</div>;
          return (
            <div style={{marginTop:8}}>
              <label className="fl" style={{fontSize:10}}>Pin / spot in this room <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
              <select className="fs" value={f.pin_id||""} onChange={e=>upd("pin_id",e.target.value||null)}>
                <option value="">— No specific pin —</option>
                {pins.map((pin,i)=>(
                  <option key={pin.id} value={pin.id}>📍 {i+1}. {pin.name}{pin.notes?" — "+pin.notes:""}</option>
                ))}
              </select>
            </div>
          );
        })()}

        {/* ── Slot sub-picker for storage racks ── */}
        {(()=>{
          const selLoc = storLocs.find(l=>l.id===f.location_id);
          if(!selLoc||selLoc.location_type!=="rack") return null;
          const rows = selLoc.rack_rows||3;
          const cols = selLoc.rack_cols||4;
          const rowLabels = (ROW_LABELS[selLoc.rack_row_style]||ROW_LABELS.alpha);
          const colLabels = (COL_LABELS[selLoc.rack_col_style]||COL_LABELS.num);
          const slots = [];
          for(let i=0;i<rows;i++){
            for(let j=0;j<cols;j++){
              const key=`${rowLabels[i]||String(i+1)}-${j+1}`;
              const colLabel=colLabels[j]||"";
              slots.push({key, label:colLabel?`Row ${rowLabels[i]||i+1}, Slot ${colLabel}`:`Row ${rowLabels[i]||i+1}, Position ${j+1}`});
            }
          }
          return (
            <div style={{marginTop:8}}>
              <label className="fl" style={{fontSize:10}}>Rack slot <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10}}>(optional)</span></label>
              <select className="fs" value={f.rack_slot||""} onChange={e=>upd("rack_slot",e.target.value||null)}>
                <option value="">— No specific slot —</option>
                {slots.map(s=>(
                  <option key={s.key} value={s.key}>🏗️ {s.label} ({s.key})</option>
                ))}
              </select>
            </div>
          );
        })()}
        {qloc&&(
          <div style={{marginTop:8,padding:"12px 14px",background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.25)",borderRadius:8}}>
            <div style={{fontWeight:700,fontSize:12,color:"var(--goldink)",marginBottom:8}}>New Storage Location</div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input className="fi" style={{flex:1}} placeholder={"Name (e.g. "+EX_LOC+")"} value={qlocName}
                onChange={e=>setQlocName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addLocation()}/>
              <input className="fi" style={{width:80}} placeholder="Code" value={qlocCode}
                onChange={e=>setQlocCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addLocation()}/>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button type="button" className="btn btn-g btn-sm" onClick={addLocation}
                disabled={!qlocName.trim()||qsaving}>{qsaving?"Saving…":"Create & Select"}</button>
              <button type="button" className="btn btn-o btn-sm" onClick={()=>{setQloc(false);setQlocName("");setQlocCode("");}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="fg fu sdiv">
        <div className="slbl">📷 {maxImg>1?"Photos":"Photo"} {maxImg>1&&<span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10,color:"var(--muted)"}}>({imgsOf(f).length}/{maxImg})</span>}</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          {imgsOf(f).map((u,i)=>(
            <div key={u+"_"+i} className="ph-wrap" style={{position:"relative"}}>
              <img src={u} alt=""/>
              <button type="button" className="ph-rm" onClick={()=>removeImage(i)} title="Remove">×</button>
              {i===0
                ? <span style={{position:"absolute",bottom:2,left:2,background:"rgba(18,6,0,.72)",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3}}>Cover</span>
                : <button type="button" onClick={()=>makeCover(i)} title="Make cover photo" style={{position:"absolute",bottom:2,left:2,background:"rgba(18,6,0,.72)",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,border:"none",cursor:"pointer"}}>Set cover</button>}
            </div>
          ))}
          {imgsOf(f).length<maxImg&&<><label className="ph-add" style={{opacity:upl?.5:1}}>{Ic.cam}<span>{upl?"Uploading…":"Add Photo"}</span><input ref={fr} type="file" accept="image/*" hidden onChange={handlePhoto} disabled={upl}/></label>
                <button type="button" className="ph-add" onClick={handleDrive} disabled={upl} style={{opacity:upl?.5:1,cursor:upl?"default":"pointer"}}><span>📁 Google Drive</span></button><button type="button" className="ph-add" onClick={()=>setShowCam(true)} disabled={upl} style={{opacity:upl?.5:1,cursor:upl?"default":"pointer"}}><span>📸 Camera</span></button></>}
        </div>
        {showCam&&<CameraCapture max={maxImg} current={imgsOf(f).length} onCapture={capturePhoto} onClose={()=>setShowCam(false)}/>}
        {maxImg===1&&<div style={{fontSize:11,color:"var(--muted)",marginTop:6}}>Free plan: 1 photo per item. Upgrade to Pro for up to 5 photos.</div>}
      </div>
      <div className="fg fu">
        <div className="slbl">🏷 Tags</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{(f.tags||[]).map(t=><span key={t} className="tc" onClick={()=>upd("tags",f.tags.filter(x=>x!==t))}>#{t} ×</span>)}</div>
        <div style={{display:"flex",gap:7}}><input className="fi" style={{flex:1}} value={ti} onChange={e=>setTi(e.target.value)} placeholder="Add tag…" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag()}}}/><button className="btn btn-o btn-sm" onClick={addTag}>Add</button></div>
      </div>
      <div className="fg fu"><label className="fl">Notes</label><textarea className="ft" value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Usage history, care instructions…"/></div>
      <div className="fg fu sdiv"><div className="slbl">🏪 {getExchangeName(vertical)}</div></div>
      <div className="fg"><label className="fl">Listing Status</label><select className="fs" value={f.mkt} onChange={e=>upd("mkt",e.target.value)}>{MKT.map(s=><option key={s}>{s}</option>)}</select></div>
      {f.mkt!=="Not Listed"&&f.mkt!=="Private"&&!marketplaceEnabled&&(
        <div className="fg fu" style={{marginTop:-4}}>
          <div style={{background:"rgba(212,168,67,.1)",border:"1px solid rgba(212,168,67,.3)",borderRadius:7,padding:"9px 12px",fontSize:12,color:"var(--amber)",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}>
            <span style={{flexShrink:0}}>⚠️</span>
            <span>This item won't appear in Backstage Exchange until your program joins. Go to <strong>Backstage Exchange</strong> in the nav to opt in — it only takes one click.</span>
          </div>
        </div>
      )}
      <div className="fg"/>
      {showRent&&<div className="fg"><label className="fl">Rental / week ($)</label><input className="fi" type="number" min="0" step="any" placeholder="e.g. 25" value={f.rent||""} onChange={e=>upd("rent",parseFloat(e.target.value)||0)}/></div>}
      {showSale&&<div className="fg"><label className="fl">Sale Price ($)</label><input className="fi" type="number" min="0" step="any" placeholder="e.g. 50" value={f.sale||""} onChange={e=>upd("sale",parseFloat(e.target.value)||0)}/></div>}
      {showLoan&&<div className="fg"><label className="fl">Loan Period (weeks)</label><input className="fi" type="number" min="1" step="1" placeholder="e.g. 2" value={f.loan_period||""} onChange={e=>upd("loan_period",parseInt(e.target.value)||2)}/></div>}
      {showLoan&&<div className="fg"><label className="fl">Refundable Deposit ($)</label><input className="fi" type="number" min="0" step="any" placeholder="0 = free loan" value={f.deposit||""} onChange={e=>upd("deposit",parseFloat(e.target.value)||0)}/></div>}

      {/* Purchase & Funding Source — optional, links item to Funding Tracker */}
      <div className="fg fu sdiv">
        <div className="slbl">💰 Purchase & Funding</div>
      </div>
      <div className="fg">
        <label className="fl">Item Cost ($)</label>
        <input className="fi" type="number" min="0" step="any" placeholder="e.g. 49.99"
          value={f.purchase_cost||""} onChange={e=>upd("purchase_cost",e.target.value)}/>
      </div>
      <div className="fg">
        <label className="fl">Purchase Date</label>
        <input className="fi" type="date" value={f.purchase_date||""}
          onChange={e=>upd("purchase_date",e.target.value)}/>
      </div>
      <div className="fg fu">
        <label className="fl">Vendor / Supplier</label>
        <input className="fi" placeholder="e.g. Goodwill, Amazon, Drama Bookshop"
          value={f.purchase_vendor||""} onChange={e=>upd("purchase_vendor",e.target.value)}/>
      </div>
      <div className="fg fu">
        <label className="fl">Charge to Funding Source</label>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <select className="fs" style={{flex:1}} value={f.funding_source_id||""} onChange={e=>upd("funding_source_id",e.target.value)}>
            <option value="">— None —</option>
            {fundSources.map(s=><option key={s.id} value={s.id}>{s.name}{s.source_type?" ("+s.source_type+")":""}</option>)}
          </select>
          <button type="button" className="btn btn-o btn-sm" style={{whiteSpace:"nowrap",flexShrink:0}}
            onClick={()=>{setQfund(v=>!v);setQloc(false);}}>+ New</button>
        </div>
        {f.funding_source_id&&f.purchase_cost&&parseFloat(f.purchase_cost)>0&&(
          <div style={{fontSize:11.5,color:"var(--amber)",marginTop:5,lineHeight:1.5}}>
            ✓ A ${parseFloat(f.purchase_cost||0).toFixed(2)} expenditure will be added to this fund automatically.
          </div>
        )}
        {f.funding_source_id&&(!f.purchase_cost||parseFloat(f.purchase_cost)===0)&&(
          <div style={{fontSize:11.5,color:"var(--t3)",marginTop:5}}>
            Enter an item cost above to log an expenditure to this fund.
          </div>
        )}
        {fundSources.length===0&&!qfund&&(
          <div style={{fontSize:12,color:"var(--t3)",marginTop:4,fontStyle:"italic"}}>
            No active funding sources yet — click "+ New" to create one.
          </div>
        )}
        {qfund&&(
          <div style={{marginTop:8,padding:"12px 14px",background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.25)",borderRadius:8}}>
            <div style={{fontWeight:700,fontSize:12,color:"var(--goldink)",marginBottom:8}}>New Funding Source</div>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input className="fi" style={{flex:1}} placeholder="Name (e.g. Prop 28, Booster Fund)"
                value={qfundName} onChange={e=>setQfundName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addFundSource()}/>
              <select className="fs" style={{width:140}} value={qfundType} onChange={e=>setQfundType(e.target.value)}>
                <option value="grant">Grant</option>
                <option value="district">District Allocation</option>
                <option value="booster">Booster/Fundraising</option>
                <option value="earned">Earned Income</option>
                <option value="donation">Donation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button type="button" className="btn btn-g btn-sm" onClick={addFundSource}
                disabled={!qfundName.trim()||qsaving}>{qsaving?"Saving…":"Create & Select"}</button>
              <button type="button" className="btn btn-o btn-sm" onClick={()=>{setQfund(false);setQfundName("");}}>Cancel</button>
            </div>
          </div>
        )}
      </div>

    {/* Save / Cancel — always visible at bottom of form */}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",
      marginTop:20,paddingTop:16,borderTop:"1px solid var(--border)"}}>
      <button type="button" className="btn btn-o" onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-g"
        disabled={!f.name.trim()||upl||svng}
        style={{opacity:!f.name.trim()||upl||svng?0.45:1}}
        onClick={async()=>{if(!f.name.trim()||svng)return;setSvng(true);try{await onSave(f);}finally{setSvng(false);}}}>
        {upl?"Uploading…":svng?"Saving…":item?"Save Changes":"Add Item"}
      </button>
    </div>

    </div>
  );
}

export function ItemDetail({item,onEdit,onDelete,userId=null,schoolName=null, canEdit=true, canDelete=true}){
  const cat=CAT[item.category]||CAT.other;
  const[lb,setLb]=useState(false);
  const[qr,setQr]=useState(null);
  const[showAddToProd,setShowAddToProd]=useState(false);
  const[showCal,setShowCal]=useState(false);
  const gfx=CAT_GFX[item.category]||CAT_GFX.other;
  const mktCls=item.mkt==="For Rent"?"mb-rent":item.mkt==="For Sale"?"mb-sale":item.mkt==="Rent or Sale"?"mb-both":item.mkt==="For Loan"?"mb-loan":"mb-none";

  useEffect(()=>{
    QR.toDataURL(APP_URL+"/#/item/"+(item.display_id||item.id), 200).then(url=>{if(url)setQr(url);});
  },[item.id, item.name]);

  const printQR=async()=>{
    // QR encodes the display_id if available — it's human-readable, unique per org,
    // and the public-item edge function resolves it correctly.
    // Fall back to item.id for items that predate the display_id system.
    const qrIdentifier = item.display_id || item.id;
    const qrUrl = APP_URL+"/#/item/" + qrIdentifier;
    const qrSrc=await QR.toDataURL(qrUrl,200);
    if(!qrSrc)return;
    const w=window.open("","_blank","width=420,height=520");if(!w)return;
    const loc=item.location?"Location: "+item.location:"";
    const itemUrl=APP_HOST+"/#/item/"+qrIdentifier;
    const numStr = item.display_id || (item.item_number != null ? itemNum(item.item_number) : "");
    w.document.write(`<html><head><title>QR – ${item.name}</title><style>body{font-family:sans-serif;text-align:center;padding:40px}img{margin:12px 0;border:1px solid #eee;border-radius:6px}h2{margin-bottom:4px;font-size:18px}.num{font-size:22px;font-weight:900;font-family:monospace;color:#c4761a;margin:2px 0 6px}p{color:#666;font-size:13px;margin:3px 0}</style></head><body><h2>${item.name}</h2>${numStr?`<div class="num">${numStr}</div>`:""}<p>${cat.label} · ${item.condition}</p>${loc?`<p style="font-weight:700;color:#333">${loc}</p>`:""}<img src="${qrSrc}" width="200" height="200"/><p style="font-size:11px;margin-top:8px;color:#888">${itemUrl}</p><p style="font-size:11px;color:#bbb">${APP_NAME} · ${APP_HOST}</p><script>setTimeout(function(){window.print()},300)<\/script></body></html>`);
    w.document.close();
  };

  const dlQR=async()=>{const qId=item.display_id||item.id;const u=await QR.toDataURL("https://theatre4u.org/#/item/"+qId,300);if(!u)return;const a=document.createElement("a");a.href=u;a.download="T4U-"+(item.display_id||item.id)+".png";a.click();};

  return(
    <>
      {lb&&item.img&&<div className="lb" onClick={()=>setLb(false)}><img src={item.img} alt=""/></div>}
      <div className="dt-img" onClick={()=>item.img&&setLb(true)} style={{cursor:item.img?"zoom-in":"default"}}>
        {item.img
          ?<img src={item.img} alt={item.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<div style={{width:"100%",height:"100%",background:gfx.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:72,opacity:.85}}>{gfx.icon}</div>
        }
        {/* Always-visible hint (not just hover cursor) so touch/mobile users know the
            thumbnail is cropped and tapping opens the full, uncropped photo. */}
        {item.img&&<div style={{position:"absolute",bottom:8,right:8,display:"flex",alignItems:"center",gap:5,
          background:"rgba(18,6,0,.6)",color:"#fff",fontSize:11,fontWeight:700,padding:"4px 9px",
          borderRadius:20,pointerEvents:"none",letterSpacing:.2}}>
          <span style={{fontSize:12}}>⤢</span> View full photo
        </div>}
      </div>
      {(item.images&&item.images.length>1)&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {item.images.map((u,i)=><img key={u+"_"+i} src={u} alt="" onClick={()=>window.open(u,"_blank")} title="Open full size" style={{width:52,height:52,objectFit:"cover",borderRadius:6,cursor:"pointer",border:u===item.img?"2px solid var(--gold)":"1px solid var(--border)"}}/>)}
      </div>}
      <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:16}}>
        <div style={{width:50,height:50,background:cat.color+"22",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,border:`1.5px solid ${cat.color}44`}}>{cat.icon}</div>
        <div>
          <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:cat.color}}>{cat.label}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"var(--ink)",lineHeight:1.1}}>{item.name}</div>
        </div>
      </div>
      {(item.tags||[]).length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{item.tags.map(t=><span key={t} style={{background:"rgba(196,118,26,.12)",color:"var(--cog)",fontSize:12.5,fontWeight:700,padding:"3px 9px",borderRadius:3}}>#{t}</span>)}</div>}
      <div className="dt-sec"><h3>Details</h3>
        {[...(schoolName?[["School Site",<span style={{fontWeight:700,color:"#42a5f5"}}>🏫 {schoolName}</span>]]:[]),["Condition",item.condition],["Size",item.size],["Quantity",item.qty],["Availability",item.avail],["Location",item.location||"—"],["Notes",item.notes||"—"],["Added",item.added?new Date(item.added).toLocaleDateString():"—"],...(item.display_id?[["Item ID",<span style={{fontWeight:800,fontSize:14,color:"var(--amber)",fontFamily:"monospace",letterSpacing:1}}>{item.display_id}</span>]]:[]),["UUID",<span style={{fontFamily:"monospace",fontSize:11,color:"var(--faint)"}}>{item.id}</span>]].map(([l,v])=>(
          <div className="dt-row" key={l}><span className="dt-lbl">{l}</span><span>{v}</span></div>
        ))}
      </div>
      <div className="dt-sec"><h3>Backstage Exchange</h3>
        <div className="dt-row"><span className="dt-lbl">Status</span><span className={`mkt-badge ${mktCls}`}>{item.mkt}</span></div>
        {(item.mkt==="For Rent"||item.mkt==="Rent or Sale")&&<div className="dt-row"><span className="dt-lbl">Rental/week</span><span className="price">{fmt$(item.rent)}</span></div>}
        {(item.mkt==="For Sale"||item.mkt==="Rent or Sale")&&<div className="dt-row"><span className="dt-lbl">Sale Price</span><span className="price">{fmt$(item.sale)}</span></div>}
        {item.mkt==="For Loan"&&<div className="dt-row"><span className="dt-lbl">Loan Period</span><span style={{fontWeight:700,color:"#00838f"}}>{item.loan_period||2} week{(item.loan_period||2)!==1?"s":""}</span></div>}
        {item.mkt==="For Loan"&&<div className="dt-row"><span className="dt-lbl">Deposit</span><span className="price">{item.deposit>0?fmt$(item.deposit):"None (free loan)"}</span></div>}
      </div>
      <div className="dt-sec">
        <h3 style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{display:"flex",alignItems:"center",gap:7}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Availability
          </span>
          <button className="btn btn-o btn-sm" style={{fontSize:11}} onClick={()=>setShowCal(c=>!c)}>
            {showCal?"Hide":"Show"} Calendar
          </button>
        </h3>
        {showCal && (
          <div style={{marginTop:8}}>
            <AvailabilityCalendar
              itemId={item.id}
              isOwner={!!userId}
              userId={userId}
            />
          </div>
        )}
      </div>
      <div className="dt-sec">
        <h3 style={{display:"flex",alignItems:"center",gap:7}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><path d="M21 14h-3v3"/><path d="M21 21h-3v-3"/></svg>
          QR Code Label
        </h3>
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px",background:"var(--parch)",borderRadius:10,border:"1px solid var(--border)"}}>
          <img src={qr||""} alt="QR Code" width={110} height={110} style={{borderRadius:6,flexShrink:0,border:"1px solid var(--linen)"}}/>
          <div>
            <div style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:14,marginBottom:2}}>{item.name}</div>
            {item.display_id&&<div style={{fontSize:12,fontWeight:800,color:"var(--amber)",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>{item.display_id}</div>}
            <p style={{fontSize:12,color:"var(--muted)",lineHeight:1.5,marginBottom:10}}>Print and attach to the item or storage bin. Anyone can scan it to look up details instantly.</p>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <button className="btn btn-o btn-sm" onClick={printQR}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button className="btn btn-o btn-sm" onClick={dlQR}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Save PNG
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
        {canEdit&&onEdit&&<button className="btn btn-p btn-sm" onClick={onEdit}><span style={{width:14,height:14,display:"flex"}}>{Ic.edit}</span>Edit</button>}
        {canDelete&&onDelete&&<button className="btn btn-d btn-sm" onClick={()=>{if(window.confirm("Delete this item?"))onDelete(item.id)}}><span style={{width:14,height:14,display:"flex"}}>{Ic.trash}</span>Delete</button>}
        {userId && <button className="btn btn-o btn-sm" onClick={()=>setShowAddToProd(true)}>🎭 {getTerm(item.vertical,"addToProduction")}</button>}
        {item.mkt!=="Not Listed"&&<FbShareBtn
          url={itemShareUrl(item)}
          text={itemShareText(item, schoolName)}
          compact={true}
          label="Share on Facebook"
        />}
      </div>
      {showAddToProd && userId && (
        <AddToProductionPicker item={item} userId={userId} onClose={()=>setShowAddToProd(false)}/>
      )}
    </>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// AVAILABILITY CALENDAR
// ══════════════════════════════════════════════════════════════════════════════

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// Returns all dates a block covers as "YYYY-MM-DD" strings
function blockDates(b) {
  const dates = new Set();
  const d = new Date(b.start_date + "T00:00:00");
  const end = new Date(b.end_date + "T00:00:00");
  while (d <= end) {
    dates.add(d.toISOString().slice(0,10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function toYMD(d) {
  return d.toISOString().slice(0,10);
}

// ── AvailabilityCalendar ───────────────────────────────────────────────────────
// isOwner = true  → owner can add/remove blocks
// isOwner = false → read-only, shows availability to potential renters
function AvailabilityCalendar({ itemId, isOwner, userId }) {
  const today = new Date();
  const [year,  setYear]   = useState(today.getFullYear());
  const [month, setMonth]  = useState(today.getMonth());
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Selection state (owner only)
  const [selStart, setSelStart] = useState(null);
  const [selEnd,   setSelEnd]   = useState(null);
  const [selHover, setSelHover] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [label,    setLabel]    = useState("");
  const [blockType,setBlockType]= useState("blocked");
  const [saving,   setSaving]   = useState(false);

  const loadBlocks = useCallback(async () => {
    const { data } = await SB.from("availability_blocks")
      .select("*").eq("item_id", itemId).order("start_date");
    setBlocks(data || []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // All blocked dates as a map: "YYYY-MM-DD" → block object
  const blockedMap = useMemo(() => {
    const m = {};
    blocks.forEach(b => {
      blockDates(b).forEach(d => { m[d] = b; });
    });
    return m;
  }, [blocks]);

  // Calendar grid for current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const ymd = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // Determine if a date is in current selection range
  const inSelection = (d) => {
    if (!selStart) return false;
    const anchor = selEnd || selHover;
    if (!anchor) return ymd(d) === selStart;
    const a = selStart < anchor ? selStart : anchor;
    const b = selStart < anchor ? anchor : selStart;
    return ymd(d) >= a && ymd(d) <= b;
  };

  const handleDayClick = (d) => {
    if (!isOwner) return;
    const dateStr = ymd(d);
    if (!selStart || selEnd) {
      setSelStart(dateStr); setSelEnd(null); setSelHover(null); setShowForm(false);
    } else {
      const a = selStart < dateStr ? selStart : dateStr;
      const b = selStart < dateStr ? dateStr : selStart;
      setSelStart(a); setSelEnd(b);
      setShowForm(true);
    }
  };

  const saveBlock = async () => {
    if (!selStart || !selEnd) return;
    setSaving(true);
    const { error } = await SB.from("availability_blocks").insert({
      item_id: itemId, org_id: userId,
      start_date: selStart, end_date: selEnd,
      label: label.trim() || null, block_type: blockType,
    });
    if (!error) {
      await loadBlocks();
      setSelStart(null); setSelEnd(null); setSelHover(null);
      setShowForm(false); setLabel(""); setBlockType("blocked");
    }
    setSaving(false);
  };

  const deleteBlock = async (blockId) => {
    await SB.from("availability_blocks").delete().eq("id", blockId);
    setBlocks(p => p.filter(b => b.id !== blockId));
  };

  const blockColor = (type) =>
    type === "confirmed" ? "#c2185b" :
    type === "pending"   ? "#d35400" : "#546e7a";

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const isToday = (d) => {
    return year===today.getFullYear() && month===today.getMonth() && d===today.getDate();
  };
  const isPast = (d) => {
    const dt = new Date(year, month, d);
    dt.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return dt < t;
  };

  return (
    <div>
      {/* Calendar header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <button onClick={prevMonth} className="btn btn-o btn-sm" style={{padding:"4px 10px"}}>‹</button>
        <div style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:15}}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button onClick={nextMonth} className="btn btn-o btn-sm" style={{padding:"4px 10px"}}>›</button>
      </div>

      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DAY_NAMES.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:800,
            color:"var(--muted)",padding:"2px 0",textTransform:"uppercase",letterSpacing:.5}}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`}/>;
          const dateStr = ymd(d);
          const block = blockedMap[dateStr];
          const sel   = inSelection(d);
          const past  = isPast(d);
          const todayCell = isToday(d);

          const bg = block
            ? blockColor(block.block_type) + (past?"44":"88")
            : sel ? "rgba(196,118,26,.35)"
            : "transparent";

          return (
            <div key={d}
              onClick={() => !past && handleDayClick(d)}
              onMouseEnter={() => isOwner && selStart && !selEnd && setSelHover(dateStr)}
              title={block?.label || (block ? "Unavailable" : "Available")}
              style={{
                aspectRatio:"1",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:todayCell?800:400,
                borderRadius:5,
                background:bg,
                color: block ? "#fff" : past ? "var(--faint)" : sel ? "var(--ink)" : "var(--ink)",
                cursor: past ? "default" : isOwner ? "pointer" : "default",
                border: todayCell ? "2px solid var(--gold)" : "2px solid transparent",
                transition:"background .1s",
                opacity: past ? .5 : 1,
                position:"relative",
              }}>
              {d}
              {block && block.block_type === "confirmed" && (
                <div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",
                  width:4,height:4,borderRadius:"50%",background:"#fff"}}/>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:10,fontSize:11,color:"var(--muted)"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,background:"#546e7a88",display:"inline-block"}}/>Blocked
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,background:"#d3540088",display:"inline-block"}}/>Pending
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,background:"#c2185b88",display:"inline-block"}}/>Confirmed
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:12,height:12,borderRadius:3,border:"2px solid var(--gold)",display:"inline-block"}}/>Today
        </span>
      </div>

      {/* Owner: add block form */}
      {isOwner && (
        <div style={{marginTop:14}}>
          {!selStart && !showForm && (
            <p style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>
              Click a start date, then an end date to block a range.
            </p>
          )}
          {selStart && !selEnd && (
            <p style={{fontSize:12,color:"var(--amber)",fontWeight:600}}>
              Start: {selStart} — now click an end date
              <button onClick={()=>setSelStart(null)} style={{marginLeft:8,background:"none",border:"none",
                color:"var(--muted)",cursor:"pointer",fontSize:11}}>cancel</button>
            </p>
          )}
          {showForm && selStart && selEnd && (
            <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,
              padding:14,marginTop:8,animation:"su .2s ease"}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>
                Block {selStart} → {selEnd}
              </div>
              <div className="fg2">
                <div className="fg">
                  <label className="fl">Type</label>
                  <select className="fs" value={blockType} onChange={e=>setBlockType(e.target.value)}>
                    <option value="blocked">Blocked / Unavailable</option>
                    <option value="pending">Pending Request</option>
                    <option value="confirmed">Confirmed Booking</option>
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Label (optional)</label>
                  <input className="fi" value={label} onChange={e=>setLabel(e.target.value)}
                    placeholder="e.g. Spring Musical 2026"/>
                </div>
              </div>
              <div style={{display:"flex",gap:7,marginTop:12}}>
                <button className="btn btn-o btn-sm" onClick={()=>{setShowForm(false);setSelStart(null);setSelEnd(null);}}>Cancel</button>
                <button className="btn btn-g btn-sm" onClick={saveBlock} disabled={saving}>
                  {saving?"Saving…":"Block These Dates"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing blocks list */}
      {blocks.length > 0 && (
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,
            color:"var(--muted)",marginBottom:8}}>Blocked Periods</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {blocks.map(b => (
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",
                borderRadius:7,background:"var(--parch)",border:"1px solid var(--border)"}}>
                <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,
                  background:blockColor(b.block_type)}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700}}>{b.start_date} → {b.end_date}</div>
                  {b.label&&<div style={{fontSize:11,color:"var(--muted)"}}>{b.label}</div>}
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:6,
                  background:blockColor(b.block_type)+"22",color:blockColor(b.block_type)}}>
                  {b.block_type}
                </span>
                {isOwner && (
                  <button onClick={()=>deleteBlock(b.id)}
                    style={{background:"none",border:"none",color:"var(--muted)",
                      cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div style={{textAlign:"center",padding:20,color:"var(--muted)",fontSize:12}}>Loading availability…</div>
      )}
    </div>
  );
}