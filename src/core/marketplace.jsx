// BACKSTAGE EXCHANGE (Marketplace) — extracted from App.jsx (modularization).
// Components: Marketplace, NewConversationModal, CSVImport (+ coerce,
// normalizeImageUrl), MarketplaceGate. Exports MarketplaceGate (router page)
// and CSVImport (used by Inventory).
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SB } from "./supabase.js";
import { Modal, Pager, FbShareBtn, HeroImg, CatCard } from "./ui.jsx";
import { Ic } from "./icons.jsx";
import { EM } from "./messages.js";
import { fmt$, itemShareUrl, itemShareText, CSV_FIELDS, parseCSV, autoMatch } from "./helpers.js";
import { CAT, CATS, CONDS, SIZES, AVAIL, MKT } from "./inventory.js";
import { BG, usp } from "../lib/backgrounds.js";
import { getExchangeName } from "../lib/verticals.js";
import { zipToCoords, milesBetween, STATE_NAMES } from "../lib/geo.js";
import { ItemDetail, ItemForm } from "./items.jsx";
import { RequestItemModal } from "./requests.jsx";
import { UpgradePlans } from "./billing.jsx";
import { ExternalLoans } from "./external-loans.jsx";

function Marketplace({items,org,plan="free",activeSchool=null,allSchoolsMode=false,onEdit=null,onDelete=null}){
  const[search,   setSrch]    = useState("");
  const[catF,     setCatF]    = useState("all");
  const[typeF,    setTypeF]   = useState("all");
  const[mktTab,   setMktTab]  = useState("browse"); // "browse" | "mine"
  const[pg,       setPg]      = useState(1);
  const[viewing,   setViewing]   = useState(null);
  const[editingItem,setEditingItem]= useState(null); // editing own item from Exchange
  const[contactItem,setContactItem] = useState(null);
  const[requestItem, setRequestItem]  = useState(null);
  // Location search
  const[zipInput, setZipInput]= useState(org?.zipcode||"");
  const[radius,   setRadius]  = useState("25");   // miles or "state" or "all"
  const[userCoords,setUserCoords]=useState(null); // {lat,lng,state}
  const[geoLoading,setGeoLoading]=useState(false);
  const[geoErr,   setGeoErr]  = useState("");
  // Cross-org listings
  const[allListings, setAllListings] = useState([]); // [{...item, org_name, org_state, org_lat, org_lng, org_zipcode}]
  const[loadingAll,  setLoadingAll]  = useState(false);
  const PP=16;
  const mktCls=m=>m==="For Rent"?"mb-rent":m==="For Sale"?"mb-sale":m==="For Loan"?"mb-loan":"mb-both";

  // Load ALL marketplace listings from ALL orgs (cross-org)
  const loadAllListings = useCallback(async()=>{
    setLoadingAll(true);
    // Join items with org info in one query
    const{data,error}=await SB.from("items")
      .select("*, orgs(name,location,state,zipcode,lat,lng,marketplace_enabled,vertical)")
      .neq("mkt","Not Listed")
      .neq("mkt","Private")
      .eq("avail","In Stock")
      .order("added",{ascending:false});
    if(!error&&data){
      const flat=data
        .filter(i=>i.orgs?.marketplace_enabled !== false)
        .map(i=>({
        ...i,
        org_name:    i.orgs?.name     || "Unknown Program",
        org_location:i.orgs?.location || "",
        org_state:   i.orgs?.state    || "",
        org_zipcode: i.orgs?.zipcode  || "",
        org_lat:     i.orgs?.lat      || null,
        org_lng:     i.orgs?.lng      || null,
        org_vertical:i.orgs?.vertical || "theatre",
      }));
      setAllListings(flat);
    }
    setLoadingAll(false);
  },[]);

  useEffect(()=>{ if(plan!=="free") loadAllListings(); },[plan,loadAllListings]);

  // Geocode zip when user clicks search or changes zip
  const applyZip = useCallback(async(zip)=>{
    if(!zip||zip.length<5){setUserCoords(null);return;}
    setGeoLoading(true);setGeoErr("");
    const coords=await zipToCoords(zip.trim());
    if(coords){ setUserCoords(coords); }
    else { setGeoErr("Zip code not found. Try again."); setUserCoords(null); }
    setGeoLoading(false);
  },[]);

  // Pre-load org zip if set
  useEffect(()=>{ if(org?.zipcode) applyZip(org.zipcode); },[org?.zipcode]);

  // Filter logic
  const filtered = useMemo(()=>{
    // "mine" tab = own items only
    const source = mktTab==="mine"
      ? allListings.filter(i=>i.org_id===org?.id)
      : allListings;

    let f=source;

    // Vertical: only show listings from programs of the same type
    const myVertical = org?.vertical || "theatre";
    f = f.filter(i => (i.vertical || i.org_vertical || "theatre") === myVertical);

    // Text search
    if(search){
      const q=search.toLowerCase();
      f=f.filter(i=>i.name.toLowerCase().includes(q)||
        (i.notes||"").toLowerCase().includes(q)||
        (i.org_name||"").toLowerCase().includes(q)||
        (i.tags||[]).some(t=>t.includes(q)));
    }

    // Category
    if(catF!=="all") f=f.filter(i=>i.category===catF);

    // Type
    if(typeF==="rent") f=f.filter(i=>i.mkt.includes("Rent"));
    if(typeF==="sale") f=f.filter(i=>i.mkt.includes("Sale"));
    if(typeF==="loan") f=f.filter(i=>i.mkt==="For Loan");

    // Location filter
    if(radius==="state"&&userCoords?.state){
      f=f.filter(i=>i.org_state===userCoords.state||!i.org_state);
    } else if(radius!=="all"&&userCoords?.lat&&userCoords?.lng){
      const miles=parseFloat(radius);
      f=f.filter(i=>{
        if(!i.org_lat||!i.org_lng) return true; // orgs without coords shown
        return milesBetween(userCoords.lat,userCoords.lng,i.org_lat,i.org_lng)<=miles;
      });
    }

    // Sort: own items first, then by distance if we have coords
    if(userCoords?.lat&&radius!=="all"&&radius!=="state"){
      f=[...f].sort((a,b)=>{
        const da=a.org_lat?milesBetween(userCoords.lat,userCoords.lng,a.org_lat,a.org_lng):9999;
        const db=b.org_lat?milesBetween(userCoords.lat,userCoords.lng,b.org_lat,b.org_lng):9999;
        return da-db;
      });
    }

    return f;
  },[allListings,mktTab,search,catF,typeF,radius,userCoords,org?.id]);

  const paged=useMemo(()=>filtered.slice((pg-1)*PP,pg*PP),[filtered,pg]);
  useEffect(()=>setPg(1),[search,catF,typeF,radius,userCoords,mktTab]);

  if(plan==="free") return(
    <div style={{padding:"40px 20px",textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:14}}>🏪</div>
      <h2 style={{fontFamily:"'Playfair Display','Georgia',serif",fontSize:22,marginBottom:10}}>{getExchangeName(org?.vertical)} is a Pro Feature</h2>
      <p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 24px",lineHeight:1.6}}>Share selected items with other programs — rent, sell, or loan. Upgrade to Pro to join the {getExchangeName(org?.vertical)}.</p>
      <UpgradePlans compact={true} userId={org?.id} userEmail={org?.email}/>
    </div>
  );

  return(
    <div style={{position:"relative"}}>
      <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1400} h={900} className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:280}}>
          <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1100} h={340} alt="" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🏪 {getExchangeName(org?.vertical)}</div>
            <h1 className="hero-title" style={{fontSize:46}}>{getExchangeName(org?.vertical)}</h1>
            <p className="hero-sub">Rent, sell, or loan items with programs near you. Give your assets a second life.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>

        {/* ── Location Search Bar ── */}
        <div className="card card-p" style={{marginBottom:18,padding:"14px 18px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            <div style={{flex:"0 0 auto"}}>
              <label style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>📍 Your Zip Code</label>
              <div style={{display:"flex",gap:6}}>
                <input
                  value={zipInput}
                  onChange={e=>setZipInput(e.target.value.replace(/[^0-9]/g,"").slice(0,5))}
                  onKeyDown={e=>e.key==="Enter"&&applyZip(zipInput)}
                  placeholder="e.g. 92648"
                  style={{width:110,background:"var(--parch)",border:"1.5px solid var(--border)",borderRadius:6,padding:"7px 10px",fontSize:14,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",outline:"none"}}
                  maxLength={5}
                />
                <button className="btn btn-g btn-sm" onClick={()=>applyZip(zipInput)} disabled={geoLoading}>
                  {geoLoading?"…":"Search"}
                </button>
              </div>
              {geoErr&&<div style={{fontSize:11,color:"var(--red)",marginTop:3}}>{geoErr}</div>}
              {userCoords&&<div style={{fontSize:11,color:"var(--green)",marginTop:3}}>📍 {userCoords.city}, {userCoords.state}</div>}
            </div>
            <div style={{flex:"0 0 auto"}}>
              <label style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Radius</label>
              <div style={{display:"flex",gap:4}}>
                {[["10","10 mi"],["25","25 mi"],["50","50 mi"],["100","100 mi"],["state","Statewide"],["all","All"]].map(([v,l])=>(
                  <button key={v}
                    onClick={()=>setRadius(v)}
                    style={{padding:"6px 10px",fontSize:12,fontWeight:700,borderRadius:6,cursor:"pointer",fontFamily:"'Raleway',sans-serif",border:"1.5px solid",
                      background:radius===v?"var(--ink)":"transparent",
                      color:radius===v?"var(--gold)":"var(--muted)",
                      borderColor:radius===v?"var(--ink)":"var(--border)",
                      transition:"all .15s"}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{flex:1,minWidth:180}}>
              <label style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Search Items</label>
              <div className="srch" style={{width:"100%",maxWidth:"100%"}}>
                {Ic.search}
                <input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Costumes, props, lighting…" style={{width:"100%"}}/>
              </div>
            </div>
          </div>
          {userCoords&&radius!=="all"&&radius!=="state"&&(
            <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>
              Showing listings within <strong>{radius} miles</strong> of {userCoords.city}, {userCoords.state}
              {!userCoords.lat&&" — add your zip to Profile for precise distance filtering"}
            </div>
          )}
          {radius==="state"&&userCoords?.state&&(
            <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>
              Showing listings in <strong>{STATE_NAMES[userCoords.state]||userCoords.state}</strong>
            </div>
          )}
        </div>

        {/* ── Tabs + Filters ── */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
          <div className="vtog">
            <button className={mktTab==="browse"?"on":""} onClick={()=>setMktTab("browse")}>🌐 Browse All</button>
            <button className={mktTab==="mine"?"on":""} onClick={()=>setMktTab("mine")}>🏫 My Listings</button>
            {allSchoolsMode&&<button className={mktTab==="district"?"on":""} onClick={()=>setMktTab("district")}>🏢 District</button>}
            <button className={mktTab==="external"?"on":""} onClick={()=>setMktTab("external")}>🔄 Borrowed & Lent</button>
          </div>
          {mktTab!=="external"&&(<>
          <select style={{background:"rgba(253,246,236,.9)",border:"1.5px solid var(--border)",borderRadius:"var(--r)",padding:"7px 10px",fontSize:13,fontWeight:700,color:"var(--ink)",fontFamily:"'Raleway',sans-serif",outline:"none"}}
            value={catF} onChange={e=>setCatF(e.target.value)}>
            <option value="all">All Categories</option>
            {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="vtog">
            <button className={typeF==="all"?"on":""} onClick={()=>setTypeF("all")}>All</button>
            <button className={typeF==="rent"?"on":""} onClick={()=>setTypeF("rent")}>Rent</button>
            <button className={typeF==="sale"?"on":""} onClick={()=>setTypeF("sale")}>Sale</button>
            <button className={typeF==="loan"?"on":""} onClick={()=>setTypeF("loan")}>Loan</button>
          </div>
          </>)}
        </div>

        {mktTab!=="external" ? (<>
        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>
          {loadingAll?"Loading listings…":(filtered.length+" listing"+(filtered.length!==1?"s":""))}
          {userCoords&&radius!=="all"&&!loadingAll&&(" within "+(radius==="state"?STATE_NAMES[userCoords.state]||userCoords.state:radius+" miles"))}
        </div>

        {/* ── Listings Grid ── */}
        {paged.length===0
          ?<div className="empty">
              <div className="empty-ico">🏪</div>
              <h3>{mktTab==="mine"?"No Active Listings":"No Listings Found"}</h3>
              <p>{mktTab==="mine"
                ?"Mark items as “For Rent” or “For Sale” in Inventory to list them here."
                :radius!=="all"
                  ?"Try expanding your search radius or searching All to see listings everywhere."
                  :"No listings yet — be the first to list items for your community!"}</p>
            </div>
          :<div className="inv-grid">
            {paged.map(item=>{
              const cat=CAT[item.category]||CAT.other;
              const isOwn = item.org_id===org?.id;
              const dist = userCoords?.lat&&item.org_lat
                ? Math.round(milesBetween(userCoords.lat,userCoords.lng,item.org_lat,item.org_lng))
                : null;
              return(
                <div key={item.id} className="inv-card" onClick={()=>setViewing(item)}>
                  {/* Org header */}
                  <div style={{padding:"7px 14px",background:isOwn?"rgba(196,118,26,.12)":"var(--parch)",borderBottom:"1px solid var(--linen)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div style={{fontSize:11,fontWeight:800,color:isOwn?"var(--amber)":"var(--muted)",textTransform:"uppercase",letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {isOwn?"⭐ Your Listing":item.org_name}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
                      {item.org_state&&<span style={{fontSize:10,fontWeight:700,color:"var(--faint)"}}>{item.org_state}</span>}
                      {dist!==null&&!isOwn&&<span style={{fontSize:10,fontWeight:700,color:"var(--amber)",background:"rgba(196,118,26,.1)",padding:"1px 6px",borderRadius:8}}>~{dist}mi</span>}
                    </div>
                  </div>
                  <div className="inv-img">{item.img
                    ?<img src={item.img} alt={item.name} loading="lazy"/>
                    :<CatCard catId={item.category} width="100%" height={220}><div style={{padding:"0 14px 12px",color:"#fff"}}></div></CatCard>}
                  </div>
                  <div className="inv-body">
                    <div className="inv-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</div>
                    <div className="inv-name">{item.name}</div>
                    {item.notes&&<p style={{fontFamily:"'Lora',serif",fontStyle:"italic",fontSize:14,color:"var(--muted)",margin:"3px 0 8px",lineHeight:1.5}}>{item.notes.slice(0,80)}{item.notes.length>80?"…":""}</p>}
                    {item.org_location&&!isOwn&&<div style={{fontSize:11,color:"var(--faint)",marginBottom:4}}>📍 {item.org_location}</div>}
                    <div className="inv-meta"><span className="chip">{item.condition}</span><span className="chip">×{item.qty}</span></div>
                    <div className="inv-foot">
                      <span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span>
                      {item.mkt==="For Loan"?<span style={{fontSize:12,color:"#00838f",fontWeight:700}}>{item.loan_period||2}wk loan{item.deposit>0?" · "+fmt$(item.deposit)+" dep.":""}</span>:<span className="price">{item.rent>0?fmt$(item.rent)+"/wk":""}{item.rent>0&&item.sale>0?" · ":""}{item.sale>0?fmt$(item.sale):""}</span>}
                    </div>
                    {!isOwn&&<div style={{display:"flex",gap:6,marginTop:8}}>
                      <button className="btn btn-g btn-sm" style={{flex:1,fontSize:12}}
                        onClick={e=>{e.stopPropagation();setRequestItem(item);}}>
                        📋 Request
                      </button>
                      <button className="btn btn-o btn-sm" style={{flex:1,fontSize:12}}
                        onClick={e=>{e.stopPropagation();setContactItem(item);}}>
                        💬 Message
                      </button>
                      <FbShareBtn url={itemShareUrl(item)} text={itemShareText(item,item.org_name)} compact={true}/>
                    </div>}
                    {isOwn&&<div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}>
                      <FbShareBtn url={itemShareUrl(item)} text={itemShareText(item,org?.name)} compact={true}
                        label="Share Your Listing"/>
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        }
        <Pager total={filtered.length} page={pg} per={PP} onPage={setPg}/>
        </>) : <div style={{marginTop:4}}><ExternalLoans userId={org?.id} org={org} items={items}/></div>}
      </div>
      {viewing&&<Modal title="Listing Details" onClose={()=>setViewing(null)}>
        <ItemDetail item={viewing}
          onEdit={viewing.org_id===org?.id&&onEdit ? ()=>{setEditingItem(viewing);setViewing(null);} : null}
          onDelete={viewing.org_id===org?.id&&onDelete ? id=>{onDelete(id);setViewing(null);} : null}
          canEdit={viewing.org_id===org?.id}
          canDelete={viewing.org_id===org?.id}
          schoolName={viewing.org_name&&viewing.org_id!==org?.id?viewing.org_name:null}/>
      </Modal>}
      {editingItem&&<Modal title="Edit Item" onClose={()=>setEditingItem(null)}>
        <ItemForm item={editingItem} onSave={async(form)=>{
          if(onEdit){
            // Merge form over base item, then strip any joined org_ fields before saving
            const merged={...editingItem,...form,id:editingItem.id};
            Object.keys(merged).forEach(k=>{ if(k.startsWith('org_')||k==='orgs') delete merged[k]; });
            await onEdit(merged); setEditingItem(null);
          }
        }} onCancel={()=>setEditingItem(null)} userId={org?.id} marketplaceEnabled={!!org?.marketplace_enabled}/>
      </Modal>}
      {contactItem&&<NewConversationModal
        item={contactItem}
        itemOrgId={contactItem.org_id}
        itemOrgName={contactItem.org_name}
        currentUserId={org?.id}
        currentOrgName={org?.name}
        onOpen={convId=>{window.__t4u_nav_messages&&window.__t4u_nav_messages(convId);}}
        onClose={()=>setContactItem(null)}
      />}
      {requestItem&&<RequestItemModal
        item={requestItem}
        currentUserId={org?.id}
        currentOrgName={org?.name}
        currentOrgEmail={org?.email}
        plan={plan}
        onClose={()=>setRequestItem(null)}
        onSuccess={()=>{ window.__t4u_nav_requests&&window.__t4u_nav_requests(); }}
      />}
    </div>
  );
}

function coerce(key, raw) {
  if (!raw && raw!==0) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  switch(key) {
    case "category": {
      const lo = v.toLowerCase();
      const match = CATS.find(c => lo.includes(c.id) || lo.includes(c.label.toLowerCase()) ||
        c.label.toLowerCase().includes(lo));
      return match ? match.id : "other";
    }
    case "condition": {
      const match = CONDS.find(c=>c.toLowerCase()===v.toLowerCase());
      return match || "Good";
    }
    case "size": {
      const match = SIZES.find(s=>s.toLowerCase()===v.toLowerCase());
      return match || "N/A";
    }
    case "avail": {
      const match = AVAIL.find(a=>a.toLowerCase()===v.toLowerCase());
      return match || "In Stock";
    }
    case "mkt": {
      const match = MKT.find(m=>m.toLowerCase()===v.toLowerCase());
      return match || "Not Listed";
    }
    case "qty":        { const n=parseInt(v); return isNaN(n)?1:Math.max(0,n); }
    case "loan_period":{ const n=parseInt(v); return isNaN(n)?2:Math.max(1,n); }
    case "rent":
    case "sale": { const n=parseFloat(v.replace(/[$,]/g,"")); return isNaN(n)?0:Math.max(0,n); }
    case "tags": { return v.split(/[;,|]/).map(t=>t.trim().toLowerCase()).filter(Boolean); }
    case "img":  { return normalizeImageUrl(v); }
    default:     return v;
  }
}

function NewConversationModal({ item, itemOrgId, itemOrgName, currentUserId, currentOrgName, onOpen, onClose }) {
  const [body,    setBody]    = useState("");
  const [sending, setSending] = useState(false);
  const [err,     setErr]     = useState("");

  const send = async () => {
    if (!body.trim()) return;
    setSending(true); setErr("");
    try {
      // Check for existing conversation about this item
      let convId = null;
      const { data: existing } = await SB.from("conversations")
        .select("id")
        .eq("item_id", item?.id || null)
        .eq("org_a", currentUserId)
        .eq("org_b", itemOrgId)
        .single();

      if (existing) {
        convId = existing.id;
      } else {
        const { data: newConv, error: convErr } = await SB.from("conversations").insert({
          item_id:      item?.id   || null,
          org_a:        currentUserId,
          org_b:        itemOrgId,
          item_name:    item?.name || null,
          last_message: body.trim(),
          last_at:      new Date().toISOString(),
        }).select().single();
        if (convErr) throw convErr;
        convId = newConv.id;
      }

      // Insert message
      const { error: msgErr } = await SB.from("messages").insert({
        conversation_id: convId,
        sender_id:       currentUserId,
        body:            body.trim(),
      });
      if (msgErr) throw msgErr;

      // Update conversation last_message
      await SB.from("conversations").update({ last_message: body.trim(), last_at: new Date().toISOString() }).eq("id", convId);

      // Email notification (non-blocking)
      const { data: { session } } = await SB.auth.getSession();
      fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/message-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          conversation_id: convId,
          recipient_id:    itemOrgId,
          message_preview: body.trim().slice(0, 200),
          item_name:       item?.name || null,
          sender_name:     currentOrgName || "A theatre program",
        })
      }).catch(() => {});

      onOpen(convId);
      onClose();
    } catch(e) {
      setErr(EM.msgSend.body);
    }
    setSending(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:460,background:"#fdf6ec",border:"1px solid var(--border)",
        borderRadius:14,overflow:"hidden",boxShadow:"0 12px 48px rgba(0,0,0,.4)",animation:"su .2s ease"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",display:"flex",
          alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700}}>
              Contact {itemOrgName || "Program"}
            </div>
            {item?.name && <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>Re: {item.name}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid var(--border)",
            color:"var(--muted)",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
        </div>
        <div style={{padding:18}}>
          <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,
            color:"var(--muted)",display:"block",marginBottom:6}}>Your Message</label>
          <textarea
            value={body}
            onChange={e=>setBody(e.target.value)}
            placeholder={item
              ? `Hi! I saw your listing for "${item.name}" on Theatre4u. Is it available for our production running March 15–22?`
              : `Hi! I found your organization on Theatre4u and wanted to reach out…`}
            autoFocus
            rows={5}
            style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
              borderRadius:8,padding:"10px 12px",fontSize:14,fontFamily:"'Raleway',sans-serif",
              color:"var(--ink)",outline:"none",resize:"vertical",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor="var(--gold)"}
            onBlur={e=>e.target.style.borderColor="var(--border)"}
          />
          {err && <div style={{color:"var(--red)",fontSize:12,marginTop:6}}>{err}</div>}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
            <button className="btn btn-o" onClick={onClose}>Cancel</button>
            <button className="btn btn-g" onClick={send} disabled={!body.trim()||sending}>
              {sending ? "Sending…" : "Send Message →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeImageUrl(url) {
  if (!url) return null;
  const u = url.trim();
  if (!u.startsWith("http")) return null;
  const gD=u.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if(gD) return `https://drive.google.com/thumbnail?id=${gD[1]}&sz=w800`;
  const gO=u.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if(gO) return `https://drive.google.com/thumbnail?id=${gO[1]}&sz=w800`;
  const gU=u.match(/drive\.google\.com\/uc[^?]*\?.*[?&]id=([^&]+)/);
  if(gU) return `https://drive.google.com/thumbnail?id=${gU[1]}&sz=w800`;
  if(u.includes("dropbox.com")) return u.replace("www.dropbox.com","dl.dropboxusercontent.com").replace(/[?&]dl=0/,"").replace(/[?&]raw=0/,"")+(u.includes("?")?"&":"?")+"raw=1";
  if(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u)) return u;
  return u;
}

export function CSVImport({ onImport, onClose, userId }) {
  const [step,    setStep]    = useState("upload");   // upload → map → preview → done
  const [headers, setHeaders] = useState([]);
  const [rows,    setRows]    = useState([]);
  const [mapping, setMapping] = useState({});         // csvCol → fieldKey
  const [parsed,  setParsed]  = useState([]);
  const [errors,  setErrors]  = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result,  setResult]  = useState(null);
  const fileRef = useRef();

  // ── Step 1: Upload & parse ───────────────────────────────────────────────
  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const allRows = parseCSV(ev.target.result);
      if (allRows.length < 2) { alert(EM.csvFormat.title+"\n\n"+EM.csvFormat.body); return; }
      const hdrs = allRows[0];
      const dataRows = allRows.slice(1).filter(r => r.some(c=>c));
      setHeaders(hdrs);
      setRows(dataRows);
      // Auto-detect mapping
      const auto = {};
      hdrs.forEach((h,i) => { const match = autoMatch(h); if (match) auto[i] = match; });
      setMapping(auto);
      setStep("map");
    };
    reader.readAsText(file);
  };

  // Download our template
  const downloadTemplate = () => {
    const h = ["Name","Category","Condition","Size","Qty","Location","Availability","Market","Rent","Sale","Tags","Image URL","Notes"];
    const ex = [
      ["Victorian Ball Gown","costumes","Good","M","1","Costume Closet A","In Stock","For Rent","25","0","period;formal","Used in A Christmas Carol"],
      ["Fog Machine 1000W","effects","Excellent","N/A","2","Effects Cage","In Stock","For Rent","20","0","atmosphere","Includes remote"],
      ["Romeo & Juliet Scripts","scripts","Fair","N/A","30","Library","In Stock","For Sale","0","5","shakespeare","Director annotated"],
    ];
    const csv = [h,...ex].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "theatre4u_import_template.csv";
    a.click();
  };

  // ── Step 2: Column mapping → build preview ───────────────────────────────
  const buildPreview = () => {
    const errs = [];
    const nameCol = Object.entries(mapping).find(([,v])=>v==="name");
    if (!nameCol) { errs.push(EM.csvNoName.body); setErrors(errs); return; }

    const items = rows.map((row, ri) => {
      const item = {
        category: "other", condition: "Good", size: "N/A",
        qty: 1, avail: "In Stock", mkt: "Not Listed",
        rent: 0, sale: 0, tags: [], notes: "", location: "", img: null, description: ""
      };
      Object.entries(mapping).forEach(([colIdx, fieldKey]) => {
        const raw = row[parseInt(colIdx)];
        const val = coerce(fieldKey, raw);
        if (val !== undefined) item[fieldKey] = val;
      });
      if (!item.name?.trim()) errs.push(`Row ${ri+2}: Item name is blank — row will be skipped.`);
      return item;
    }).filter(i => i.name?.trim());

    setErrors(errs);
    setParsed(items);
    setStep("preview");
  };

  // ── Step 3: Import ────────────────────────────────────────────────────────
  const doImport = async () => {
    setImporting(true);
    setProgress(0);
    const BATCH = 50;
    let imported = 0, failed = 0;
    const now = new Date().toISOString();

    for (let i=0; i<parsed.length; i+=BATCH) {
      const batch = parsed.slice(i, i+BATCH).map(item => ({
        ...item,
        org_id: userId,
        added: now,
      }));
      const { error } = await SB.from("items").insert(batch);
      if (error) { failed += batch.length; console.error("Import batch error:", error); }
      else { imported += batch.length; }
      setProgress(Math.round(((i+BATCH)/parsed.length)*100));
    }
    setResult({ imported, failed, total: parsed.length });
    setImporting(false);
    setStep("done");
    if (imported > 0) onImport(); // trigger reload
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const W = { maxWidth:680, width:"100%" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(18,6,0,.78)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fi .15s ease"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...W,background:"#fdf6ec",border:"1px solid var(--border)",borderRadius:14,
        maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 56px rgba(0,0,0,.5)",
        animation:"su .2s ease"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 22px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          <div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:2}}>Import from CSV</h2>
            <div style={{display:"flex",gap:12,marginTop:6}}>
              {["upload","map","preview","done"].map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,
                  color:step===s?"var(--gold)":["upload","map","preview","done"].indexOf(step)>i?"var(--green)":"var(--muted)",
                  fontWeight:step===s?700:400}}>
                  <div style={{width:18,height:18,borderRadius:"50%",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:9,fontWeight:800,
                    background:step===s?"var(--gold)":["upload","map","preview","done"].indexOf(step)>i?"var(--green)":"rgba(18,6,0,.1)",
                    color:step===s||["upload","map","preview","done"].indexOf(step)>i?"#1a0f00":"var(--muted)"}}>
                    {["upload","map","preview","done"].indexOf(step)>i?"✓":i+1}
                  </div>
                  {s[0].toUpperCase()+s.slice(1)}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid var(--border)",
            color:"var(--muted)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>✕</button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 22px"}}>

          {/* ── STEP 1: UPLOAD ── */}
          {step==="upload" && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",
                borderRadius:10,padding:16}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:6,color:"var(--goldink)"}}>💡 Two ways to import</div>
                <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,marginBottom:10}}>
                  <strong style={{color:"var(--ink)"}}>Option A</strong> — Download our template, fill it in, upload it back.<br/>
                  <strong style={{color:"var(--ink)"}}>Option B</strong> — Upload any spreadsheet you already have. We'll help you match your columns to ours.
                </p>
                <button onClick={downloadTemplate} style={{background:"none",border:"1px solid var(--border)",
                  color:"var(--ink)",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12,
                  fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                  ⬇ Download Template CSV
                </button>
              </div>

              <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                gap:10,border:"2px dashed var(--border)",borderRadius:12,padding:"36px 20px",
                cursor:"pointer",transition:"border-color .2s",textAlign:"center"}}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--gold)"}}
                onDragLeave={e=>{e.currentTarget.style.borderColor="var(--border)"}}
                onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--border)";
                  const f=e.dataTransfer.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);fileRef.current.files=dt.files;handleFile({target:{files:[f]}})}}}>
                <div style={{fontSize:40}}>📂</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18}}>Drop your CSV here</div>
                <div style={{fontSize:12,color:"var(--muted)"}}>or click to browse — .csv files only</div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile}/>
              </label>

              <div style={{background:"rgba(66,165,245,.06)",border:"1px solid rgba(66,165,245,.18)",borderRadius:9,padding:"11px 14px",fontSize:12,color:"var(--muted)",lineHeight:1.65}}><strong style={{color:"#42a5f5"}}>📷 Adding Photos via Image URL</strong> — Add a column called <strong style={{color:"var(--ink)"}}>Image URL</strong> with a public Google Drive or Dropbox share link. Google Drive: right-click → Share → "Anyone with the link" → Copy link → paste in CSV.</div>
              <div style={{fontSize:11,color:"var(--muted)",textAlign:"center"}}>
                Supports exports from Google Sheets, Excel, Airtable, and most inventory apps.
              </div>
            </div>
          )}

          {/* ── STEP 2: MAP COLUMNS ── */}
          {step==="map" && (
            <div>
              <p style={{fontSize:13,color:"var(--muted)",marginBottom:16,lineHeight:1.5}}>
                We found <strong style={{color:"var(--ink)"}}>{headers.length} columns</strong> and <strong style={{color:"var(--ink)"}}>{rows.length} rows</strong> in your file.
                Match each column to a Theatre4u field. We've auto-detected what we can — check and adjust below.
              </p>

              <div style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 28px 1fr",gap:0,
                  background:"rgba(18,6,0,.06)",padding:"8px 14px",fontSize:10,
                  textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",fontWeight:700}}>
                  <span>Your Column</span><span/>
                  <span>Maps To</span>
                </div>
                {headers.map((h,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 28px 1fr",
                    alignItems:"center",gap:0,padding:"8px 14px",
                    borderTop:"1px solid var(--border)",background:i%2===0?"transparent":"rgba(255,255,255,.02)"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{h||"(blank)"}</div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>
                        e.g. {rows[0]?.[i]||"—"}
                      </div>
                    </div>
                    <div style={{textAlign:"center",color:"var(--muted)",fontSize:16}}>→</div>
                    <select value={mapping[i]||""} onChange={e=>{
                        const v=e.target.value;
                        setMapping(p=>{const n={...p};if(v)n[i]=v;else delete n[i];return n;});
                      }}
                      style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:6,
                        padding:"5px 8px",color:mapping[i]?"var(--ink)":"var(--muted)",
                        fontSize:12,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
                      <option value="">— skip this column —</option>
                      {CSV_FIELDS.map(f=>(
                        <option key={f.key} value={f.key}>{f.label}{f.required?" *":""}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {errors.length>0&&<div style={{background:"rgba(194,24,91,.1)",border:"1px solid rgba(194,24,91,.25)",
                borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"var(--red)"}}>
                {errors.map((e,i)=><div key={i}>⚠ {e}</div>)}
              </div>}

              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setStep("upload")} style={{background:"none",border:"1px solid var(--border)",
                  color:"var(--muted)",padding:"7px 16px",borderRadius:7,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
                  ← Back
                </button>
                <button onClick={buildPreview} className="btn btn-g" style={{padding:"7px 20px"}}>
                  Preview Import →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: PREVIEW ── */}
          {step==="preview" && (
            <div>
              {(()=>{const withImg=parsed.filter(i=>i.img).length;return withImg>0&&(<div style={{background:"rgba(66,165,245,.08)",border:"1px solid rgba(66,165,245,.2)",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"var(--muted)"}}>📷 <strong style={{color:"#42a5f5"}}>{withImg}</strong> of {parsed.length} items have image URLs.</div>);})()} 
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
                <div style={{flex:1,background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.2)",
                  borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:800,color:"var(--green)"}}>{parsed.length}</div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Items Ready</div>
                </div>
                {errors.length>0&&<div style={{flex:2,background:"rgba(255,167,38,.08)",border:"1px solid rgba(255,167,38,.2)",
                  borderRadius:8,padding:"10px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#ffa726",marginBottom:4}}>⚠ {errors.length} warning{errors.length!==1?"s":""}</div>
                  {errors.slice(0,3).map((e,i)=><div key={i} style={{fontSize:11,color:"var(--muted)"}}>{e}</div>)}
                  {errors.length>3&&<div style={{fontSize:11,color:"var(--muted)"}}>+{errors.length-3} more…</div>}
                </div>}
              </div>

              <div style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
                <div style={{overflowX:"auto",maxHeight:320}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:"rgba(18,6,0,.07)",position:"sticky",top:0}}>
                        {["#","Photo","Name","Category","Cond.","Qty","Location","Market","Notes"].map(h=>(
                          <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,
                            textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)",fontWeight:700,
                            whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.slice(0,100).map((item,i)=>{
                        const cat=CAT[item.category]||CAT.other;
                        return(
                          <tr key={i} style={{borderTop:"1px solid var(--border)",
                            background:i%2===0?"transparent":"rgba(18,6,0,.03)"}}>
                            <td style={{padding:"6px 10px",color:"var(--muted)"}}>{i+1}</td>
                            <td style={{padding:"6px 10px",fontWeight:600,maxWidth:160,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</td>
                            <td style={{padding:"6px 10px",whiteSpace:"nowrap"}}>{cat.icon} {cat.label}</td>
                            <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.condition}</td>
                            <td style={{padding:"6px 10px"}}>{item.qty}</td>
                            <td style={{padding:"6px 10px",color:"var(--muted)",maxWidth:120,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.location||"—"}</td>
                            <td style={{padding:"6px 10px"}}>
                              <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:3,
                                background:item.mkt==="Not Listed"?"rgba(255,255,255,.07)":"rgba(212,168,67,.15)",
                                color:item.mkt==="Not Listed"?"var(--muted)":"var(--gold)"}}>{item.mkt}</span>
                            </td>
                            <td style={{padding:"6px 10px",color:"var(--muted)",maxWidth:140,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.notes||"—"}</td>
                          </tr>
                        );
                      })}
                      {parsed.length>100&&(
                        <tr><td colSpan={9} style={{padding:"8px 10px",textAlign:"center",
                          color:"var(--muted)",fontSize:11,borderTop:"1px solid var(--border)"}}>
                          + {parsed.length-100} more rows not shown in preview
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>
                <button onClick={()=>setStep("map")} style={{background:"none",border:"1px solid var(--border)",
                  color:"var(--muted)",padding:"7px 16px",borderRadius:7,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>
                  ← Back
                </button>
                <button onClick={doImport} className="btn btn-g"
                  style={{padding:"8px 22px",fontSize:14,fontWeight:800}} disabled={parsed.length===0||importing}>
                  {importing
                    ? <span style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",
                          borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>
                        Importing… {progress}%
                      </span>
                    : `Import ${parsed.length} Item${parsed.length!==1?"s":""} →`}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: DONE ── */}
          {step==="done" && result && (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:56,marginBottom:16}}>{result.failed===0?"🎉":"⚠️"}</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:24,marginBottom:8}}>
                {result.failed===0?"Import Complete!":"Import Finished with Errors"}
              </h3>
              <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:20,flexWrap:"wrap"}}>
                <div style={{background:"rgba(76,175,80,.1)",border:"1px solid rgba(76,175,80,.2)",
                  borderRadius:10,padding:"12px 24px",textAlign:"center"}}>
                  <div style={{fontSize:28,fontWeight:800,color:"var(--green)"}}>{result.imported}</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>Items Imported</div>
                </div>
                {result.failed>0&&<div style={{background:"rgba(194,24,91,.1)",border:"1px solid rgba(194,24,91,.2)",
                  borderRadius:10,padding:"12px 24px",textAlign:"center"}}>
                  <div style={{fontSize:28,fontWeight:800,color:"var(--red)"}}>{result.failed}</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>Failed</div>
                </div>}
              </div>
              <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>
                {result.imported>0
                  ? "Your items are now in your Inventory. You can edit any of them individually to add photos or refine details."
                  : "Something went wrong. Please check your CSV file and try again."}
              </p>
              <button onClick={onClose} className="btn btn-g" style={{padding:"9px 28px"}}>
                Go to Inventory →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MarketplaceGate({items, org, setOrg, plan, userId, activeSchool, allSchoolsMode, onEdit=null, onDelete=null}) {
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    const updated = {...org, marketplace_enabled: true};
    setOrg(updated);
    await SB.from("orgs").update({marketplace_enabled: true}).eq("id", userId);
  };

  // Free plan users see the upgrade prompt (Marketplace handles that internally)
  // Pro/District users who haven't opted in see the gate
  if (org?.marketplace_enabled || plan === "free") {
    return <Marketplace items={items} org={org} plan={plan} activeSchool={activeSchool} allSchoolsMode={allSchoolsMode} onEdit={onEdit} onDelete={onDelete}/>;
  }

  return (
    <div style={{position:"relative",minHeight:"70vh"}}>
      <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1400} h={900} className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:280}}>
          <HeroImg vertical={(org?.vertical&&org.vertical!=="theatre")?org.vertical:null} photoId={BG.marketplace} w={1100} h={340} alt="" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🏪 {getExchangeName(org?.vertical)}</div>
            <h1 className="hero-title" style={{fontSize:46}}>{getExchangeName(org?.vertical)}</h1>
            <p className="hero-sub">Rent, buy, or loan theatre assets from programs near you.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"40px 36px 64px",position:"relative",zIndex:1,maxWidth:720}}>
        <div className="card card-p" style={{borderColor:"rgba(212,168,67,.3)",background:"linear-gradient(135deg,rgba(212,168,67,.06),rgba(212,168,67,.02))"}}>
          <div style={{fontSize:44,marginBottom:16,textAlign:"center"}}>🏪</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,marginBottom:12,textAlign:"center"}}>Join the {getExchangeName(org?.vertical)}</h2>
          <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.7,marginBottom:24,textAlign:"center",maxWidth:520,margin:"0 auto 24px"}}>
            The {getExchangeName(org?.vertical)} is an optional resource-sharing network. You choose exactly which items to share — your full inventory stays completely private. Browse what other programs near you have available.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
            {[
              ["🔍","Browse Nearby","Find costumes, props, lighting and sound from programs in your area."],
              ["💰","Earn Revenue","List items for rent or sale and earn income for your program."],
              ["🤝","Share Resources","Loan items to other programs and earn Stage Points in return."],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{padding:"14px",background:"var(--parch)",borderRadius:10,border:"1px solid var(--linen)",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
                <div style={{fontWeight:700,fontSize:13,marginBottom:5}}>{title}</div>
                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:"var(--muted)",lineHeight:1.6}}>
            🏷️ <strong>What becomes visible:</strong> your organization name, city, and any items you've marked "For Rent", "For Sale", or "For Loan" in Inventory. Your full item list and private notes are never shared. You can leave the {getExchangeName(org?.vertical)} at any time from <strong>Settings</strong>.
          </div>
          <div style={{textAlign:"center"}}>
            <button className="btn btn-g" style={{fontSize:15,padding:"11px 32px"}}
              disabled={joining} onClick={join}>
              {joining ? "Joining…" : "Join the "+getExchangeName(org?.vertical)+" →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}