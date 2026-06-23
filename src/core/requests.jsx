// RENTAL REQUEST FLOW — extracted from App.jsx (modularization).
// Components: RequestItemModal, TransactionDocForm, DocumentManager, Requests
// (+ DOC_TYPES, NOTIFY_URL, printDocument). Exports the two App.jsx entry points:
// RequestItemModal (rendered by Marketplace) and Requests (main router page).
import React, { useState, useEffect, useCallback } from "react";
import { SB } from "./supabase.js";
import { Modal } from "./ui.jsx";
import { EM } from "./messages.js";
import { fmt$ } from "./helpers.js";
import { BG, usp } from "../lib/backgrounds.js";
import { PLATFORM_FEE_PCT, MILESTONE_POINTS, POINT_EARN_RATES } from "./points-config.js";

// ══════════════════════════════════════════════════════════════════════════════
// RENTAL REQUEST FLOW
// ══════════════════════════════════════════════════════════════════════════════

const NOTIFY_URL = "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/request-notify";

async function notifyRequest(type, requestId) {
  try {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) return;
    fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ type, request_id: requestId })
    });
  } catch {}
}

// ── Request Form Modal ────────────────────────────────────────────────────────
export function RequestItemModal({ item, currentUserId, currentOrgName, currentOrgEmail, onClose, onSuccess, plan="free" }) {
  const today     = new Date().toISOString().slice(0,10);
  const isRent    = item.mkt === "For Rent" || item.mkt === "Rent or Sale";
  const isLoan    = item.mkt === "For Loan";
  const isSale    = item.mkt === "For Sale" || item.mkt === "Rent or Sale";
  const isBoth    = item.mkt === "Rent or Sale";
  const [type,    setType]    = useState(isRent?"rent":isLoan?"loan":"buy");
  const [start,   setStart]   = useState(today);
  const [end,     setEnd]     = useState("");
  const [qty,     setQty]     = useState(1);
  const [msg,     setMsg]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [err,       setErr]       = useState("");
  const [conflict,  setConflict]  = useState(false);
  const [blocks,    setBlocks]    = useState([]);
  const [myCredits, setMyCredits] = useState(0);
  const [useCredits,setUseCredits]= useState(false);
  const [creditAmt, setCreditAmt] = useState(0);
  const needsDates = type !== "buy";

  // Pricing (component scope — used by both the summary render and submit())
  const basePrice   = type==="rent" ? item.rent : type==="loan" ? (item.deposit||0) : item.sale;
  const platformFee = (type==="loan") ? 0 : Math.max(0, parseFloat((((basePrice||0)) * PLATFORM_FEE_PCT).toFixed(2)));

  // Load availability blocks + my point balance
  useEffect(()=>{
    SB.from("availability_blocks").select("*").eq("item_id", item.id)
      .then(({data})=>setBlocks(data||[]));
    SB.rpc("get_my_credit_balance").then(({data})=>setMyCredits(data||0));
  },[item.id]);

  // Recalculate credit amount when toggled (50% cap, whole credits only)
  useEffect(()=>{
    if(!useCredits||type==="loan") { setCreditAmt(0); return; }
    const price = type==="rent" ? (item.rent||0) : (item.sale||0);
    const maxCreditCover = Math.floor(price * 0.5);
    setCreditAmt(Math.min(myCredits, maxCreditCover));
  },[useCredits, type, item.rent, item.sale, myCredits]);

  // Check if selected dates conflict with blocks
  useEffect(()=>{
    if (!start || !end || !needsDates) { setConflict(false); return; }
    const s = new Date(start), e = new Date(end);
    const hasConflict = blocks.some(b => {
      const bs = new Date(b.start_date), be = new Date(b.end_date);
      return s <= be && e >= bs;
    });
    setConflict(hasConflict);
  },[start,end,blocks,needsDates]);

  const submit = async () => {
    if (!msg.trim()) { setErr("Please include a message to the owner."); return; }
    if (needsDates && (!start || !end)) { setErr("Please select start and end dates."); return; }
    if (needsDates && end < start) { setErr("End date must be after start date."); return; }
    setSending(true); setErr("");
    try {
    const finalPrice = Math.max(0, (basePrice||0) - creditAmt);
    // Platform fee (basePrice/platformFee derived at component scope above)
    const platformFeeCents = Math.round(platformFee * 100);

    // Spend credits atomically if using them
    if(creditAmt > 0 && useCredits) {
      const{data:spendResult}=await SB.rpc("spend_credits",{
        p_org_id: currentUserId, p_amount: creditAmt,
        p_type: "spend_rental",
        p_description: `Applied ${creditAmt} credits to ${item.name} ${type}`,
        p_item_id: item.id
      });
      if(!spendResult?.success){ setErr(spendResult?.error||"Could not apply credits."); return; }
    }

    const { data, error } = await SB.from("rental_requests").insert({
      item_id:        item.id,
      item_name:      item.name,
      item_type:      type,
      owner_id:       item.org_id,
      requester_id:   currentUserId,
      requester_name: currentOrgName,
      requester_email:currentOrgEmail,
      start_date:     needsDates ? start : null,
      end_date:       needsDates ? end   : null,
      qty_requested:  qty,
      message:        msg.trim() + (creditAmt>0?`

[${creditAmt} Stage Points applied — cash due: $${finalPrice.toFixed(2)}]`:"") + (platformFee>0?`

[8% platform fee: $${platformFee.toFixed(2)} payable to Theatre4u — instructions will follow by email]`:""),
      agreed_price:        finalPrice,
      platform_fee_cents:  platformFeeCents,
      status:              "pending",
    }).select().single();
    if (error) { setErr(EM.requestSend.body); return; }
    // Award first_request milestone points (one-time, idempotent) — best-effort
    try {
      SB.rpc("award_milestone_points", {
        p_org_id: currentUserId, p_type: "first_request",
        p_amount: MILESTONE_POINTS?.first_request?.pts ?? 10,
        p_desc: "First Exchange request sent"
      }).catch(()=>{});
    } catch {}
    try { notifyRequest("new_request", data?.id); } catch {}
    onSuccess?.();
    onClose();
    } catch (e) {
      console.error("request submit failed:", e);
      setErr((EM.requestSend && EM.requestSend.body) || "Could not send your request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const paymentNote = type === "loan"
    ? null
    : `By submitting this request, you agree that any agreed cash payment will be made directly to the item owner outside of Theatre4u. Artstracker LLC does not process or guarantee payments between organizations.`;

  const typeColor = { rent:"#1554a0", loan:"#00838f", buy:"#27723a" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>

      {plan==="free" ? (
        <div style={{background:"var(--cream)",border:"1px solid var(--border)",
          borderRadius:14,padding:32,maxWidth:420,width:"100%",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,.4)"}}>
          <div style={{fontSize:36,marginBottom:12}}>🔒</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:8,color:"var(--brand-burgundy)"}}>
            Pro Required for Exchange
          </div>
          <p style={{fontSize:14,color:"var(--text)",lineHeight:1.7,marginBottom:20}}>
            Sending and receiving Exchange requests requires a Pro or District plan.
            Upgrade to connect with nearby programs and start sharing resources.
          </p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn btn-g" onClick={()=>{onClose();setTimeout(()=>window.__t4u_nav_upgrade?.(),100);}}>
              Upgrade to Pro →
            </button>
            <button className="btn btn-o" onClick={onClose}>Maybe Later</button>
          </div>
          <p style={{fontSize:11,color:"var(--muted)",marginTop:12}}>
            Pro: $15/mo · Unlimited inventory · Full Exchange access · Stage Points
          </p>
        </div>
      ) : (
        <div style={{width:"100%",maxWidth:500,background:"var(--cream)",border:"1px solid var(--border)",
          borderRadius:14,overflow:"hidden",boxShadow:"0 12px 48px rgba(0,0,0,.4)",animation:"su .2s ease",maxHeight:"90vh",overflowY:"auto"}}>

          {/* Header */}
          <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",
            background:"var(--parch)",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700}}>Request Item</div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{item.name}</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"1px solid var(--border)",
              color:"var(--muted)",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:"inherit",
              fontSize:18,lineHeight:1}}>×</button>
          </div>

          <div style={{padding:18,display:"flex",flexDirection:"column",gap:14}}>
            {/* Type selector */}
            {isBoth && (
              <div>
                <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:6}}>Request Type</label>
                <div style={{display:"flex",gap:8}}>
                  {[["rent","🔑 Rent"],["buy","🛒 Buy"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setType(v)}
                      style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",
                        fontWeight:700,fontSize:13,border:"2px solid",transition:"all .15s",
                        background:type===v?typeColor[v]:"transparent",
                        color:type===v?"#fff":"var(--muted)",
                        borderColor:type===v?typeColor[v]:"var(--border)"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date range */}
            {needsDates && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Start Date</label>
                  <input type="date" value={start} min={today}
                    onChange={e=>setStart(e.target.value)}
                    style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
                      borderRadius:7,padding:"8px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                      color:"var(--ink)",outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>End Date</label>
                  <input type="date" value={end} min={start||today}
                    onChange={e=>setEnd(e.target.value)}
                    style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
                      borderRadius:7,padding:"8px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                      color:"var(--ink)",outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
            )}

            {/* Conflict warning */}
            {conflict && (
              <div style={{background:"rgba(194,24,91,.08)",border:"1px solid rgba(194,24,91,.25)",
                borderRadius:8,padding:"10px 12px",fontSize:12,color:"#c2185b",display:"flex",gap:8}}>
                <span>⚠️</span>
                <span>These dates overlap with an existing booking. The owner may not be able to fulfil your request for these exact dates.</span>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Quantity</label>
              <input type="number" value={qty} min={1} max={item.qty||99}
                onChange={e=>setQty(Math.max(1,parseInt(e.target.value)||1))}
                style={{width:80,background:"var(--parch)",border:"1.5px solid var(--border)",
                  borderRadius:7,padding:"8px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                  color:"var(--ink)",outline:"none"}}/>
              <span style={{fontSize:12,color:"var(--muted)",marginLeft:8}}>{item.qty} available</span>
            </div>

            {/* Pricing summary */}
            {(item.rent>0||item.sale>0||item.deposit>0) && (
              <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",fontSize:13}}>
                {type==="rent"&&item.rent>0&&<div>Rental rate: <strong style={{color:"var(--cog)"}}>{fmt$(item.rent)}/week</strong></div>}
                {type==="buy" &&item.sale>0&&<div>Sale price:  <strong style={{color:"var(--cog)"}}>{fmt$(item.sale)}</strong></div>}
                {type==="loan"&&<div>Free loan{item.deposit>0?` · Deposit: ${fmt$(item.deposit)}`:""}</div>}
                {type==="loan"&&item.loan_period&&<div style={{color:"var(--muted)",fontSize:12,marginTop:2}}>Loan period: {item.loan_period} days</div>}
                {platformFee>0&&<div style={{marginTop:4,fontSize:12,color:"var(--muted)"}}>8% platform fee: <strong>{fmt$(platformFee)}</strong> payable to Theatre4u</div>}
              </div>
            )}

            {/* Stage Points toggle */}
            {myCredits > 0 && type !== "loan" && (item.rent > 0 || item.sale > 0) && (
              <div style={{background:"rgba(212,168,67,.07)",border:"1px solid rgba(212,168,67,.25)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:useCredits&&creditAmt>0?10:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>🪙</span>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"var(--goldink)"}}>Apply Stage Points</div>
                      <div style={{fontSize:11,color:"var(--muted)"}}>You have {myCredits.toLocaleString()} points available</div>
                    </div>
                  </div>
                  <label style={{position:"relative",display:"inline-block",width:42,height:24,cursor:"pointer"}}>
                    <input type="checkbox" checked={useCredits} onChange={e=>setUseCredits(e.target.checked)}
                      style={{opacity:0,width:0,height:0}}/>
                    <span style={{position:"absolute",inset:0,background:useCredits?"var(--green)":"var(--border)",borderRadius:12,transition:".25s"}}>
                      <span style={{position:"absolute",height:18,width:18,left:useCredits?20:3,bottom:3,background:"#fff",borderRadius:"50%",transition:".25s"}}/>
                    </span>
                  </label>
                </div>
                {useCredits && creditAmt > 0 && (
                  <div style={{background:"rgba(0,0,0,.04)",borderRadius:7,padding:"8px 10px",fontSize:13}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{color:"var(--muted)"}}>Original price</span>
                      <span style={{fontWeight:700}}>${type==="rent"?(item.rent||0).toFixed(2):(item.sale||0).toFixed(2)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,color:"var(--green)"}}>
                      <span>Points applied ({creditAmt})</span>
                      <span style={{fontWeight:700}}>−${creditAmt.toFixed(2)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:"1px solid var(--border)"}}>
                      <span style={{fontWeight:800}}>Cash due to owner</span>
                      <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"var(--cog)",fontWeight:700}}>${Math.max(0,(type==="rent"?item.rent:item.sale)-creditAmt).toFixed(2)}</span>
                    </div>
                    <div style={{fontSize:12,color:"var(--red)",fontWeight:600,marginTop:8,padding:"7px 10px",background:"rgba(194,24,91,.06)",borderRadius:6}}>
                      ⚠️ <strong>Payment responsibility:</strong> The cash balance above must be paid <strong>directly to the item owner</strong> outside of Theatre4u. Artstracker LLC does not process or guarantee payments between organizations.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message */}
            <div>
              <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>Message to Owner *</label>
              <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={3}
                placeholder={needsDates
                  ?"Hi! We're interested in this item for our Spring production. Is it available for those dates?"
                  :"Hi! We'd like to purchase this item. Is it still available?"}
                style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",
                  borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"'Raleway',sans-serif",
                  color:"var(--ink)",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
            </div>

            {err && <div style={{color:"var(--red)",fontSize:12,background:"rgba(194,24,91,.06)",
              border:"1px solid rgba(194,24,91,.2)",borderRadius:6,padding:"8px 11px"}}>{err}</div>}

            {paymentNote && (
              <div style={{fontSize:11.5,color:"var(--muted)",lineHeight:1.6,padding:"8px 11px",background:"var(--parch)",border:"1px solid var(--border)",borderRadius:7}}>
                💳 <strong style={{color:"var(--ink)"}}>Payment note:</strong> {paymentNote}
              </div>
            )}

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn btn-o" onClick={onClose}>Cancel</button>
              <button className="btn btn-g" onClick={submit} disabled={sending||!msg.trim()}>
                {sending?"Sending…":"Send Request →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTION DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

const DOC_TYPES = {
  rental_agreement:        { label:"Rental Agreement",          icon:"📄", color:"#1554a0" },
  loan_agreement:          { label:"Loan Agreement",            icon:"🤝", color:"#00838f" },
  bill_of_sale:            { label:"Bill of Sale",              icon:"🧾", color:"#27723a" },
  condition_report_pickup: { label:"Condition Report — Pickup", icon:"🔍", color:"#d35400" },
  condition_report_return: { label:"Condition Report — Return", icon:"📦", color:"#7b1fa2" },
};

// ── Document Form ─────────────────────────────────────────────────────────────
function TransactionDocForm({ req, docType, existing, org, onSave, onCancel }) {
  const dt = DOC_TYPES[docType];
  const isCondition = docType.startsWith("condition_report");
  const isRental    = docType === "rental_agreement";
  const isLoan      = docType === "loan_agreement";
  const isSale      = docType === "bill_of_sale";

  const [f, setF] = useState(() => existing || {
    type:             docType,
    request_id:       req.id,
    lender_name:      req.ownerOrg?.name || "",
    lender_email:     req.ownerOrg?.email || "",
    lender_phone:     "",
    lender_address:   "",
    borrower_name:    req.requesterOrg?.name || req.requester_name || "",
    borrower_email:   req.requesterOrg?.email || req.requester_email || "",
    borrower_phone:   "",
    borrower_address: "",
    item_name:        req.item_name || "",
    item_description: "",
    item_condition:   "",
    item_qty:         req.qty_requested || 1,
    item_value:       "",
    start_date:       req.start_date || "",
    end_date:         req.end_date || "",
    agreed_price:     req.agreed_price || "",
    deposit_amount:   "",
    late_fee_per_day: "",
    payment_method:   "",
    special_terms:    "",
    condition_notes:  "",
    condition_rating: "",
    lender_signed_name:  "",
    borrower_signed_name: "",
    notes: "",
  });

  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onSave(f);
    setSaving(false);
  };

  return (
    <div>
      {/* Header banner */}
      <div style={{ background:`linear-gradient(135deg,${dt.color},${dt.color}cc)`,
        borderRadius:10, padding:"14px 18px", marginBottom:20, display:"flex",
        alignItems:"center", gap:12 }}>
        <span style={{ fontSize:30 }}>{dt.icon}</span>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"#fff" }}>{dt.label}</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:2 }}>
            {req.item_name} · {req.ownerOrg?.name || "Owner"} → {req.requesterOrg?.name || req.requester_name || "Borrower"}
          </div>
        </div>
      </div>

      {!isCondition && <>
        {/* Parties */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
              color:"var(--muted)", marginBottom:8 }}>
              {isSale ? "Seller" : "Lender / Owner"}
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Organization Name</label>
              <input className="fi" value={f.lender_name} onChange={e=>upd("lender_name",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" value={f.lender_email} onChange={e=>upd("lender_email",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Phone</label>
              <input className="fi" value={f.lender_phone} onChange={e=>upd("lender_phone",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Address</label>
              <textarea className="ft" value={f.lender_address} onChange={e=>upd("lender_address",e.target.value)}
                placeholder="Street, City, State, Zip" style={{ minHeight:60 }}/>
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
              color:"var(--muted)", marginBottom:8 }}>
              {isSale ? "Buyer" : "Borrower / Requester"}
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Organization Name</label>
              <input className="fi" value={f.borrower_name} onChange={e=>upd("borrower_name",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Email</label>
              <input className="fi" type="email" value={f.borrower_email} onChange={e=>upd("borrower_email",e.target.value)}/>
            </div>
            <div className="fg" style={{ marginBottom:8 }}>
              <label className="fl">Phone</label>
              <input className="fi" value={f.borrower_phone} onChange={e=>upd("borrower_phone",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Address</label>
              <textarea className="ft" value={f.borrower_address} onChange={e=>upd("borrower_address",e.target.value)}
                placeholder="Street, City, State, Zip" style={{ minHeight:60 }}/>
            </div>
          </div>
        </div>

        {/* Item Details */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:16, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
            color:"var(--muted)", marginBottom:10 }}>Item Details</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Item Name</label>
              <input className="fi" value={f.item_name} onChange={e=>upd("item_name",e.target.value)}/>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Description / Identifying Details</label>
              <textarea className="ft" value={f.item_description} onChange={e=>upd("item_description",e.target.value)}
                placeholder="Color, size, serial number, distinguishing features…" style={{ minHeight:56 }}/>
            </div>
            <div className="fg">
              <label className="fl">Condition at Time of Agreement</label>
              <select className="fs" value={f.item_condition} onChange={e=>upd("item_condition",e.target.value)}>
                <option value="">Select…</option>
                {["Excellent","Good","Fair","Poor"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Quantity</label>
              <input className="fi" type="number" min="1" value={f.item_qty} onChange={e=>upd("item_qty",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Declared Value (for insurance)</label>
              <input className="fi" type="number" min="0" step="0.01" value={f.item_value}
                onChange={e=>upd("item_value",e.target.value)} placeholder="$0.00"/>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:16, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
            color:"var(--muted)", marginBottom:10 }}>Terms</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {(isRental || isLoan) && <>
              <div className="fg">
                <label className="fl">{isLoan ? "Loan Start Date" : "Rental Start Date"}</label>
                <input className="fi" type="date" value={f.start_date} onChange={e=>upd("start_date",e.target.value)}/>
              </div>
              <div className="fg">
                <label className="fl">Return Date</label>
                <input className="fi" type="date" value={f.end_date} onChange={e=>upd("end_date",e.target.value)}/>
              </div>
            </>}
            {(isRental || isSale) && <>
              <div className="fg">
                <label className="fl">{isSale ? "Sale Price" : "Rental Fee (per week)"}</label>
                <input className="fi" type="number" min="0" step="0.01" value={f.agreed_price}
                  onChange={e=>upd("agreed_price",e.target.value)} placeholder="$0.00"/>
              </div>
              <div className="fg">
                <label className="fl">Deposit Amount</label>
                <input className="fi" type="number" min="0" step="0.01" value={f.deposit_amount}
                  onChange={e=>upd("deposit_amount",e.target.value)} placeholder="$0.00"/>
              </div>
            </>}
            {isRental && (
              <div className="fg">
                <label className="fl">Late Fee (per day after return date)</label>
                <input className="fi" type="number" min="0" step="0.01" value={f.late_fee_per_day}
                  onChange={e=>upd("late_fee_per_day",e.target.value)} placeholder="$0.00"/>
              </div>
            )}
            <div className="fg">
              <label className="fl">Payment Method</label>
              <select className="fs" value={f.payment_method} onChange={e=>upd("payment_method",e.target.value)}>
                <option value="">Select…</option>
                {["Check","Venmo","PayPal","Zelle","Cash","School Invoice","Other"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Special Terms / Additional Notes</label>
              <textarea className="ft" value={f.special_terms} onChange={e=>upd("special_terms",e.target.value)}
                placeholder="Any additional terms, pickup/return instructions, or special conditions…"
                style={{ minHeight:60 }}/>
            </div>
          </div>
        </div>

        {/* Standard Clauses preview */}
        <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid var(--border)",
          borderRadius:8, padding:"12px 14px", marginBottom:16, fontSize:12,
          color:"var(--muted)", lineHeight:1.7 }}>
          <div style={{ fontWeight:800, color:"var(--ink)", marginBottom:6, fontSize:13 }}>
            📋 Standard Clauses (included automatically)
          </div>
          {isRental && <>
            <p>• The borrower agrees to return the item(s) in the same condition as received, reasonable wear excepted.</p>
            <p>• The borrower is responsible for any damage, loss, or theft during the rental period.</p>
            <p>• Deposit will be returned within 7 days of item return, less any damage deductions.</p>
            <p>• Payment is due prior to or at the time of pickup unless otherwise agreed in writing.</p>
          </>}
          {isLoan && <>
            <p>• The borrower agrees to return the item(s) in the same condition as received, reasonable wear excepted.</p>
            <p>• The borrower is responsible for any damage, loss, or theft during the loan period.</p>
            <p>• This is a free loan between theatre programs. No monetary exchange is required.</p>
          </>}
          {isSale && <>
            <p>• Item is sold "as-is" in the condition described above. No warranty is expressed or implied.</p>
            <p>• Title and ownership transfer to the buyer upon receipt of full payment.</p>
            <p>• All sales are final unless otherwise agreed in writing between parties.</p>
          </>}
        </div>
      </>}

      {/* Condition Report Fields */}
      {isCondition && (
        <div style={{ marginBottom:18 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div className="fg">
              <label className="fl">Item Name</label>
              <input className="fi" value={f.item_name} onChange={e=>upd("item_name",e.target.value)}/>
            </div>
            <div className="fg">
              <label className="fl">Condition Rating</label>
              <select className="fs" value={f.condition_rating} onChange={e=>upd("condition_rating",e.target.value)}>
                <option value="">Select…</option>
                {["Excellent","Good","Fair","Poor","Damaged"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg" style={{ gridColumn:"1/-1" }}>
              <label className="fl">Condition Notes — describe the item&apos;s state in detail</label>
              <textarea className="ft" value={f.condition_notes} onChange={e=>upd("condition_notes",e.target.value)}
                placeholder="Describe existing scratches, wear, missing parts, working order of electronics, etc.…"
                style={{ minHeight:100 }}/>
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid var(--border)",
            borderRadius:8, padding:"12px 14px", fontSize:12, color:"var(--muted)" }}>
            💡 Tip: Take photos of the item now and upload them via the item detail page. Photo evidence protects both parties in case of disputes.
          </div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1,
          color:"var(--muted)", marginBottom:4 }}>Digital Signatures</div>
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:12, lineHeight:1.5 }}>
          Type your full name to sign. Signing confirms you have read and agree to the terms above. Date and time are recorded automatically.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div className="fg">
            <label className="fl">{isSale ? "Seller Signature" : "Lender / Owner Signature"}</label>
            <input className="fi" value={f.lender_signed_name}
              onChange={e=>upd("lender_signed_name",e.target.value)}
              placeholder="Type full name to sign"/>
            {f.lender_signed_name && (
              <div style={{ fontSize:11, color:"var(--green)", marginTop:3 }}>
                ✓ Signed as: {f.lender_signed_name}
              </div>
            )}
          </div>
          <div className="fg">
            <label className="fl">{isSale ? "Buyer Signature" : "Borrower Signature"}</label>
            <input className="fi" value={f.borrower_signed_name}
              onChange={e=>upd("borrower_signed_name",e.target.value)}
              placeholder="Type full name to sign"/>
            {f.borrower_signed_name && (
              <div style={{ fontSize:11, color:"var(--green)", marginTop:3 }}>
                ✓ Signed as: {f.borrower_signed_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
            {/* Sticky save footer - always visible at bottom */}
      <div style={{ position:"sticky", bottom:0, background:"var(--parch)", 
        borderTop:"2px solid var(--linen)", padding:"14px 0 0",
        display:"flex", gap:8, justifyContent:"flex-end", marginTop:24,
        zIndex:10 }}>
        <button className="btn btn-o" onClick={onCancel}>Cancel</button>
        <button className="btn btn-o btn-sm" onClick={() => onSave({ ...f, status:"draft" })} disabled={saving}>
          💾 Save Draft
        </button>
        <button className="btn btn-g" onClick={submit} disabled={saving}
          style={{ background:`linear-gradient(135deg,${dt.color},${dt.color}cc)`,
            color:"#fff", border:"none" }}>
          {saving ? "Saving…" : (dt.icon+" Finalize "+dt.label)}
        </button>
      </div>
    </div>
  );
}

// ── Document Print / PDF generator ───────────────────────────────────────────
function printDocument(doc, req) {
  const dt    = DOC_TYPES[doc.type] || DOC_TYPES.rental_agreement;
  const today = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const isSale      = doc.type === "bill_of_sale";
  const isCondition = doc.type.startsWith("condition_report");

  const lenderLabel   = isSale ? "Seller" : "Lender / Owner";
  const borrowerLabel = isSale ? "Buyer"  : "Borrower";

  const row = (l,v) => v ? `<tr><td style="width:180px;color:#555;font-size:13px;padding:5px 0;vertical-align:top">${l}</td><td style="font-size:13px;padding:5px 0">${v}</td></tr>` : "";

  const sigBlock = (name, title, signedName, signedAt) => `
    <div style="border:1px solid #ddd;border-radius:8px;padding:16px;flex:1">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">${title}</div>
      ${signedName
        ? `<div style="font-family:Georgia,serif;font-size:18px;color:#1a5c2a;margin-bottom:4px">${signedName}</div>
           <div style="font-size:11px;color:#888">Signed: ${signedAt ? new Date(signedAt).toLocaleString() : today}</div>`
        : `<div style="border-bottom:2px solid #333;margin-top:32px;margin-bottom:6px"></div>
           <div style="font-size:12px;color:#888">Signature &amp; Date</div>`}
      <div style="font-size:12px;color:#555;margin-top:6px">${name||""}</div>
      <div style="font-size:11px;color:#aaa">${title}</div>
    </div>`;

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"/>
    <title>${dt.label} — ${doc.item_name}</title>
    <style>
      body{font-family:'Helvetica Neue',Arial,sans-serif;margin:0;padding:40px;color:#1a1a1a;max-width:780px;margin:0 auto}
      h1{font-family:Georgia,serif;font-size:28px;margin-bottom:4px;color:#1a1a1a}
      .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;
        text-transform:uppercase;letter-spacing:1px;color:#fff;background:${dt.color};margin-bottom:16px}
      .section{margin-bottom:24px}
      .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;
        color:#888;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #eee}
      table{width:100%;border-collapse:collapse}
      .clauses{background:#f9f9f9;border-left:4px solid ${dt.color};padding:14px 18px;
        border-radius:0 8px 8px 0;margin:14px 0;font-size:13px;line-height:1.8;color:#444}
      .sig-row{display:flex;gap:20px;margin-top:32px}
      @media print{body{padding:20px}.no-print{display:none}}
    </style>
  </head><body>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
      <div>
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Theatre4u™</div>
        <h1>${dt.icon} ${dt.label}</h1>
        <span class="badge">${doc.status === "finalized" ? "✓ Finalized" : "Draft"}</span>
      </div>
      <div style="text-align:right;font-size:12px;color:#888;margin-top:8px">
        <div>Generated: ${today}</div>
        <div>Document ID: ${doc.id ? doc.id.slice(0,8).toUpperCase() : "DRAFT"}</div>
      </div>
    </div>
    <hr style="border:none;border-top:2px solid #eee;margin-bottom:24px"/>

    ${!isCondition ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
      <div class="section">
        <div class="section-title">${lenderLabel}</div>
        <table>${row("Organization",doc.lender_name)}${row("Email",doc.lender_email)}${row("Phone",doc.lender_phone)}${row("Address",doc.lender_address)}</table>
      </div>
      <div class="section">
        <div class="section-title">${borrowerLabel}</div>
        <table>${row("Organization",doc.borrower_name)}${row("Email",doc.borrower_email)}${row("Phone",doc.borrower_phone)}${row("Address",doc.borrower_address)}</table>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Item Description</div>
      <table>
        ${row("Item Name",doc.item_name)}
        ${row("Description",doc.item_description)}
        ${row("Condition",doc.item_condition)}
        ${row("Quantity",doc.item_qty)}
        ${row("Declared Value",doc.item_value ? "$"+Number(doc.item_value).toFixed(2) : "")}
      </table>
    </div>

    <div class="section">
      <div class="section-title">Terms</div>
      <table>
        ${row("Start Date", doc.start_date ? new Date(doc.start_date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}) : "")}
        ${row("Return Date", doc.end_date ? new Date(doc.end_date).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}) : "")}
        ${row(isSale ? "Sale Price" : "Rental Fee", doc.agreed_price > 0 ? "$"+Number(doc.agreed_price).toFixed(2)+(doc.type==="rental_agreement"?" per week":"") : "")}
        ${row("Deposit", doc.deposit_amount > 0 ? "$"+Number(doc.deposit_amount).toFixed(2) : "")}
        ${row("Late Fee", doc.late_fee_per_day > 0 ? "$"+Number(doc.late_fee_per_day).toFixed(2)+" per day" : "")}
        ${row("Payment Method", doc.payment_method)}
      </table>
      ${doc.special_terms ? `<div style="margin-top:10px;padding:10px 14px;background:#f5f5f5;border-radius:6px;font-size:13px;line-height:1.6"><strong>Special Terms:</strong> ${doc.special_terms}</div>` : ""}
    </div>

    <div class="section">
      <div class="section-title">Standard Terms &amp; Conditions</div>
      <div class="clauses">
        ${doc.type === "rental_agreement" ? `
          <div>1. The borrower agrees to return all item(s) in the same condition as received, reasonable wear excepted.</div>
          <div>2. The borrower is responsible for any damage, loss, or theft occurring during the rental period.</div>
          <div>3. Deposit will be returned within 7 business days of item return, less deductions for documented damage.</div>
          <div>4. Payment is due prior to or at the time of pickup unless otherwise agreed in writing by both parties.</div>
          <div>5. Late fees apply for each day the item is retained beyond the agreed return date.</div>
          <div>6. This agreement is between the two organizations named above. Artstracker LLC (operating Theatre4u™) serves as the platform facilitating this agreement and is not a party to this transaction.</div>
        ` : doc.type === "loan_agreement" ? `
          <div>1. The borrower agrees to return all item(s) in the same condition as received, reasonable wear excepted.</div>
          <div>2. The borrower is responsible for any damage, loss, or theft occurring during the loan period.</div>
          <div>3. This is a free loan between theatre organizations. No monetary exchange is required or implied.</div>
          <div>4. The borrower agrees to return all item(s) by the agreed return date.</div>
          <div>5. This agreement is between the two organizations named above. Artstracker LLC (operating Theatre4u™) serves as the platform facilitating this agreement and is not a party to this transaction.</div>
        ` : `
          <div>1. Item is sold in "as-is" condition as described above. No warranty is expressed or implied.</div>
          <div>2. Title and ownership transfer to the buyer upon receipt of full payment.</div>
          <div>3. All sales are final unless otherwise agreed in writing between both parties prior to sale.</div>
          <div>4. This agreement is between the two organizations named above. Artstracker LLC (operating Theatre4u™) serves as the platform facilitating this agreement and is not a party to this transaction.</div>
        `}
      </div>
    </div>` : `
    <div class="section">
      <div class="section-title">Item</div>
      <table>${row("Item Name",doc.item_name)}${row("Condition Rating",doc.condition_rating)}</table>
    </div>
    <div class="section">
      <div class="section-title">Condition Notes</div>
      <div style="background:#f9f9f9;padding:14px;border-radius:8px;font-size:13px;line-height:1.7;min-height:80px">${doc.condition_notes||"No notes recorded."}</div>
    </div>`}

    <div class="sig-row">
      ${sigBlock(doc.lender_name, lenderLabel, doc.lender_signed_name, doc.lender_signed_at)}
      ${sigBlock(doc.borrower_name, borrowerLabel, doc.borrower_signed_name, doc.borrower_signed_at)}
    </div>

    <div style="margin-top:32px;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center">
      Generated by Theatre4u™ · Inventory · Backstage Exchange · Community · theatre4u.org · ${today}
    </div>

    <script>window.onload=function(){window.print();}</script>
  </body></html>`;

  const w = window.open("","_blank","width=900,height=700");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Document Manager (shown inside a request card) ────────────────────────────
function DocumentManager({ req, userId, orgName }) {
  const [docs,      setDocs]    = useState([]);
  const [loading,   setLoading] = useState(true);
  const [showForm,  setShowForm]= useState(null); // docType being created/edited
  const [editDoc,   setEditDoc] = useState(null);
  const [expanded,  setExpanded]= useState(false);

  const load = useCallback(async () => {
    const { data } = await SB.from("transaction_documents")
      .select("*").eq("request_id", req.id).order("created_at");
    setDocs(data || []);
    setLoading(false);
  }, [req.id]);

  useEffect(() => { load(); }, [load]);

  const saveDoc = async (f) => {
    const now = new Date().toISOString();
    const payload = {
      ...f,
      request_id: req.id,
      org_id:     userId,
      lender_signed_at:  f.lender_signed_name  && !editDoc?.lender_signed_at  ? now : editDoc?.lender_signed_at  || null,
      borrower_signed_at: f.borrower_signed_name && !editDoc?.borrower_signed_at ? now : editDoc?.borrower_signed_at || null,
    };

    if (editDoc) {
      await SB.from("transaction_documents").update(payload).eq("id", editDoc.id);
    } else {
      await SB.from("transaction_documents").insert(payload);
    }
    await load();
    setShowForm(null);
    setEditDoc(null);
  };

  // Which docs are available based on request type
  const availableDocTypes = req.item_type === "buy"
    ? ["bill_of_sale","condition_report_pickup"]
    : req.item_type === "loan"
    ? ["loan_agreement","condition_report_pickup","condition_report_return"]
    : ["rental_agreement","condition_report_pickup","condition_report_return"];

  const existingTypes = new Set(docs.map(d => d.type));

  if (!expanded) return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)" }}>
      <button className="btn btn-o btn-sm" onClick={() => setExpanded(true)}
        style={{ fontSize:12 }}>
        📄 Documents {docs.length > 0 ? `(${docs.length})` : ""}
      </button>
    </div>
  );

  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--border)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>
          📄 Transaction Documents
        </div>
        <button className="ico-btn" onClick={() => setExpanded(false)} style={{ fontSize:11 }}>
          ↑ Collapse
        </button>
      </div>

      {/* Existing docs */}
      {loading
        ? <div style={{ fontSize:12, color:"var(--muted)" }}>Loading…</div>
        : docs.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {docs.map(doc => {
              const dt = DOC_TYPES[doc.type] || DOC_TYPES.rental_agreement;
              const bothSigned = doc.lender_signed_name && doc.borrower_signed_name;
              return (
                <div key={doc.id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"8px 12px", background:"var(--parch)",
                  border:"1px solid var(--border)", borderRadius:8 }}>
                  <span style={{ fontSize:18 }}>{dt.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{dt.label}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>
                      {doc.status === "finalized" ? "✅ Finalized" : "📝 Draft"}
                      {bothSigned ? " · Both signed" : doc.lender_signed_name ? " · Owner signed" : doc.borrower_signed_name ? " · Borrower signed" : " · Unsigned"}
                      {" · "}{new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button className="btn btn-o btn-sm" style={{ fontSize:11 }}
                    onClick={() => { setEditDoc(doc); setShowForm(doc.type); }}>
                    ✏️ Edit
                  </button>
                  <button className="btn btn-o btn-sm" style={{ fontSize:11,
                    background:dt.color+"18", color:dt.color, borderColor:dt.color+"40" }}
                    onClick={() => printDocument(doc, req)}>
                    🖨️ Print/PDF
                  </button>
                </div>
              );
            })}
          </div>
        )}

      {/* Create new document buttons */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {availableDocTypes.filter(t => !existingTypes.has(t)).map(docType => {
          const dt = DOC_TYPES[docType];
          return (
            <button key={docType} className="btn btn-o btn-sm"
              style={{ fontSize:12, background:dt.color+"12",
                color:dt.color, borderColor:dt.color+"35" }}
              onClick={() => { setEditDoc(null); setShowForm(docType); }}>
              {dt.icon} Create {dt.label}
            </button>
          );
        })}
        {availableDocTypes.every(t => existingTypes.has(t)) && (
          <div style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>
            ✅ All documents created
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <Modal title={`${DOC_TYPES[showForm]?.label || "Document"}`}
          onClose={() => { setShowForm(null); setEditDoc(null); }}>
          <TransactionDocForm
            req={req}
            docType={showForm}
            existing={editDoc}
            org={{ name:orgName }}
            onSave={saveDoc}
            onCancel={() => { setShowForm(null); setEditDoc(null); }}
          />
        </Modal>
      )}
    </div>
  );
}


// ── Requests Page ──────────────────────────────────────────────────────────────
export function Requests({ userId, orgName, orgEmail }) {
  const [tab,       setTab]      = useState("incoming");
  const [requests,  setRequests] = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [acting,    setActing]   = useState(null); // requestId being acted on
  const [declineId, setDeclineId]= useState(null); // showing decline reason form
  const [reason,    setReason]   = useState("");

  const load = useCallback(async () => {
    const col = tab === "incoming" ? "owner_id" : "requester_id";
    const { data } = await SB.from("rental_requests")
      .select("*").eq(col, userId)
      .order("created_at", { ascending: false });

    // Attach org names
    const ids = new Set();
    (data||[]).forEach(r => { ids.add(r.owner_id); ids.add(r.requester_id); });
    const { data: orgs } = await SB.from("orgs").select("id,name,email").in("id",[...ids]);
    const orgMap = {};
    (orgs||[]).forEach(o => orgMap[o.id] = o);

    setRequests((data||[]).map(r => ({
      ...r,
      ownerOrg:     orgMap[r.owner_id],
      requesterOrg: orgMap[r.requester_id],
    })));
    setLoading(false);
  }, [userId, tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Realtime updates
  useEffect(() => {
    const ch = SB.channel("requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rental_requests" },
        () => load())
      .subscribe();
    return () => SB.removeChannel(ch);
  }, [load]);

  const accept = async (req) => {
    setActing(req.id);
    // 1. Block the availability calendar
    let blockId = null;
    if (req.start_date && req.end_date) {
      const { data: block } = await SB.from("availability_blocks").insert({
        item_id:    req.item_id,
        org_id:     userId,
        start_date: req.start_date,
        end_date:   req.end_date,
        label:      `${req.item_type==="loan"?"Loan":"Rental"} — ${req.requesterOrg?.name||req.requester_name||"Requester"}`,
        block_type: "confirmed",
      }).select().single();
      blockId = block?.id;
    }

    // 2. Open or reuse a conversation thread
    let convId = null;
    const { data: existingConv } = await SB.from("conversations")
      .select("id").eq("org_a", userId).eq("org_b", req.requester_id).single();
    if (existingConv) {
      convId = existingConv.id;
    } else {
      const { data: newConv } = await SB.from("conversations").insert({
        item_id:      req.item_id,
        org_a:        userId,
        org_b:        req.requester_id,
        item_name:    req.item_name,
        last_message: `Request accepted for ${req.item_name}`,
        last_at:      new Date().toISOString(),
      }).select().single();
      convId = newConv?.id;
    }

    // Auto-send acceptance message in chat
    if (convId) {
      const dateStr = req.start_date ? ` (${req.start_date} → ${req.end_date})` : "";
      await SB.from("messages").insert({
        conversation_id: convId,
        sender_id:       userId,
        body: `✅ Great news! I've accepted your ${req.item_type} request for "${req.item_name}"${dateStr}. Let's coordinate the details here.`,
      });
      await SB.from("conversations").update({
        last_message: `Request accepted — let's coordinate!`,
        last_at: new Date().toISOString()
      }).eq("id", convId);
    }

    // 3. Update request status
    await SB.from("rental_requests").update({
      status:      "accepted",
      block_id:    blockId,
      conversation_id: convId,
      updated_at:  new Date().toISOString(),
    }).eq("id", req.id);

    notifyRequest("accepted", req.id);
    await load();
    setActing(null);
  };

  const decline = async (req) => {
    setActing(req.id);
    await SB.from("rental_requests").update({
      status:         "declined",
      decline_reason: reason.trim() || null,
      updated_at:     new Date().toISOString(),
    }).eq("id", req.id);
    notifyRequest("declined", req.id);
    setDeclineId(null); setReason("");
    await load();
    setActing(null);
  };

  const markReturned = async (req) => {
    setActing(req.id);
    // Unblock calendar
    if (req.block_id) {
      await SB.from("availability_blocks").delete().eq("id", req.block_id);
    }
    await SB.from("rental_requests").update({
      status:     "returned",
      updated_at: new Date().toISOString(),
    }).eq("id", req.id);
    notifyRequest("returned", req.id);
    await load();
    setActing(null);
  };

  const cancel = async (req) => {
    setActing(req.id);
    await SB.from("rental_requests").update({
      status: "cancelled", updated_at: new Date().toISOString()
    }).eq("id", req.id);
    await load();
    setActing(null);
  };

  // Permanently delete a request (owner/requester only — RLS enforces). For
  // clearing out requests once they've been handled.
  const delRequest = async (req) => {
    if (!window.confirm("Delete this request permanently? This can't be undone.")) return;
    setActing(req.id);
    const { error } = await SB.from("rental_requests").delete().eq("id", req.id);
    if (error) { setActing(null); alert("Couldn't delete this request. Please try again."); return; }
    setRequests(p => p.filter(r => r.id !== req.id));
    setActing(null);
  };

  const statusColor = { pending:"#d35400", accepted:"#27723a", declined:"#c2185b", returned:"#546e7a", cancelled:"#9e9e9e" };
  const statusIcon  = { pending:"⏳", accepted:"✅", declined:"❌", returned:"📦", cancelled:"🚫" };
  const typeLabel   = { rent:"Rental", loan:"Loan", buy:"Purchase" };
  const typeColor   = { rent:"#1554a0", loan:"#00838f", buy:"#27723a" };

  const pending   = requests.filter(r => r.status === "pending").length;
  const accepted  = requests.filter(r => r.status === "accepted").length;

  return (
    <div style={{position:"relative"}}>
      <img src={usp(BG.dashboard,1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:200}}>
          <img src={usp("photo-1503095396549-807759245b35",1100,260)} alt="Requests" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📋 Transaction Centre</div>
            <h1 className="hero-title" style={{fontSize:42}}>Requests</h1>
            <p className="hero-sub">Manage rental, loan, and purchase requests for your items.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        {/* Tabs */}
        <div className="tabs" style={{marginBottom:20}}>
          <button className={`tab ${tab==="incoming"?"on":""}`} onClick={()=>setTab("incoming")}>
            Incoming {pending>0&&<span style={{background:"var(--red)",color:"#fff",borderRadius:8,
              padding:"1px 6px",fontSize:10,fontWeight:800,marginLeft:4}}>{pending}</span>}
          </button>
          <button className={`tab ${tab==="outgoing"?"on":""}`} onClick={()=>setTab("outgoing")}>
            My Requests {accepted>0&&tab==="outgoing"&&<span style={{background:"var(--green)",color:"#fff",borderRadius:8,
              padding:"1px 6px",fontSize:10,fontWeight:800,marginLeft:4}}>{accepted}</span>}
          </button>
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>Loading requests…</div>
        ) : requests.length === 0 ? (
          <div className="empty">
            <div className="empty-ico">{tab==="incoming"?"📬":"📤"}</div>
            <h3>{tab==="incoming"?"No Incoming Requests":"No Outgoing Requests"}</h3>
            <p>{tab==="incoming"
              ?"When other programs request your listed items, they'll appear here."
              :"When you request items from Backstage Exchange, they'll appear here."}</p>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {requests.map(req => {
              const otherOrg = tab==="incoming" ? req.requesterOrg : req.ownerOrg;
              const isActive = acting === req.id;
              return (
                <div key={req.id} className="card" style={{overflow:"hidden"}}>
                  {/* Status bar */}
                  <div style={{height:4,background:statusColor[req.status]||"#ccc"}}/>
                  <div style={{padding:"14px 18px"}}>
                    <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-start",marginBottom:12}}>
                      {/* Left: item info */}
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                          <span style={{fontFamily:"'Lora',serif",fontSize:17,fontWeight:700}}>{req.item_name}</span>
                          <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,
                            background:typeColor[req.item_type]+"18",color:typeColor[req.item_type]}}>
                            {typeLabel[req.item_type]||req.item_type}
                          </span>
                          <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,
                            background:statusColor[req.status]+"18",color:statusColor[req.status]}}>
                            {statusIcon[req.status]} {req.status}
                          </span>
                        </div>
                        <div style={{fontSize:13,color:"var(--muted)"}}>
                          {tab==="incoming"?"From":"To"}: <strong>{otherOrg?.name||"Unknown Program"}</strong>
                        </div>
                      </div>
                      {/* Right: dates + price */}
                      <div style={{textAlign:"right",flexShrink:0}}>
                        {req.start_date&&<div style={{fontSize:13,fontWeight:700,color:"var(--ink)"}}>
                          {req.start_date} → {req.end_date}
                        </div>}
                        {req.agreed_price>0&&<div style={{fontSize:13,color:"var(--cog)",fontWeight:700}}>
                          {req.item_type==="rent"?fmt$(req.agreed_price)+"/wk":fmt$(req.agreed_price)}
                        </div>}
                        <div style={{fontSize:11,color:"var(--faint)",marginTop:2}}>
                          Qty: {req.qty_requested}
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    {req.message&&(
                      <div style={{background:"var(--parch)",border:"1px solid var(--border)",
                        borderRadius:7,padding:"9px 12px",fontSize:13,color:"var(--muted)",
                        lineHeight:1.5,marginBottom:12,fontStyle:"italic"}}>
                        "{req.message}"
                      </div>
                    )}

                    {/* Decline reason */}
                    {req.status==="declined"&&req.decline_reason&&(
                      <div style={{background:"rgba(194,24,91,.06)",border:"1px solid rgba(194,24,91,.15)",
                        borderRadius:7,padding:"8px 12px",fontSize:12,color:"#c2185b",marginBottom:12}}>
                        Reason: {req.decline_reason}
                      </div>
                    )}

                    {/* Decline reason form */}
                    {declineId===req.id&&(
                      <div style={{marginBottom:12}}>
                        <label style={{fontSize:11,fontWeight:800,textTransform:"uppercase",
                          letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4}}>
                          Reason for declining (optional)
                        </label>
                        <input className="fi" value={reason} onChange={e=>setReason(e.target.value)}
                          placeholder="e.g. Already booked for those dates"
                          style={{width:"100%",marginBottom:8}}/>
                        <div style={{display:"flex",gap:6}}>
                          <button className="btn btn-d btn-sm" onClick={()=>decline(req)} disabled={isActive}>
                            {isActive?"…":"Confirm Decline"}
                          </button>
                          <button className="btn btn-o btn-sm" onClick={()=>setDeclineId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                      {/* Incoming pending — owner accepts or declines */}
                      {tab==="incoming"&&req.status==="pending"&&(<>
                        <button className="btn btn-g btn-sm" onClick={()=>accept(req)} disabled={isActive}>
                          {isActive?"Processing…":"✅ Accept"}
                        </button>
                        <button className="btn btn-d btn-sm" onClick={()=>setDeclineId(req.id)} disabled={isActive}>
                          ❌ Decline
                        </button>
                      </>)}

                      {/* Incoming accepted — owner marks returned */}
                      {tab==="incoming"&&req.status==="accepted"&&(
                        <div style={{width:"100%",marginBottom:4}}>
                          {/* Urgent banner if past return date */}
                          {req.end_date&&new Date(req.end_date)<new Date()&&(
                            <div style={{background:"rgba(212,168,67,.12)",border:"1.5px solid rgba(212,168,67,.4)",
                              borderRadius:8,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:18}}>⚠️</span>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:800,fontSize:13,color:"var(--goldink)"}}>Return date has passed</div>
                                <div style={{fontSize:12,color:"var(--muted)"}}>Mark the item returned to release the calendar and earn your Stage Points.</div>
                              </div>
                            </div>
                          )}
                          <button style={{
                            width:"100%",padding:"11px 16px",borderRadius:8,
                            background:"linear-gradient(135deg,var(--green),#2d8a45)",
                            border:"none",color:"#fff",fontFamily:"inherit",fontSize:14,
                            fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",
                            justifyContent:"center",gap:8,letterSpacing:.3,
                            boxShadow:"0 2px 12px rgba(38,94,42,.3)",
                            opacity:isActive?.6:1,
                          }} onClick={()=>markReturned(req)} disabled={isActive}>
                            {isActive?"Processing…":"📦 Mark Item as Returned → Earn Credits"}
                          </button>
                          <div style={{textAlign:"center",fontSize:11,color:"var(--muted)",marginTop:5}}>
                            🪙 You'll earn {POINT_EARN_RATES[req?.item?.category] || 15} Stage Points when you confirm the return
                          </div>
                        </div>
                      )}

                      {/* Outgoing pending — requester can cancel */}
                      {tab==="outgoing"&&req.status==="pending"&&(
                        <button className="btn btn-d btn-sm" onClick={()=>cancel(req)} disabled={isActive}>
                          {isActive?"…":"Cancel Request"}
                        </button>
                      )}

                      {/* Link to conversation if exists */}
                      {req.conversation_id&&(
                        <button className="btn btn-o btn-sm" onClick={()=>window.__t4u_nav_messages&&window.__t4u_nav_messages(req.conversation_id)}>
                          💬 Open Chat
                        </button>
                      )}

                      {/* Delete — clear out a request once it's been dealt with */}
                      {declineId!==req.id&&(
                        <button className="btn btn-o btn-sm" title="Delete this request"
                          onClick={()=>delRequest(req)} disabled={isActive}
                          style={{color:"#c2185b",borderColor:"rgba(194,24,91,.35)"}}>
                          🗑 Delete
                        </button>
                      )}

                      <div style={{marginLeft:"auto",fontSize:11,color:"var(--faint)",
                        display:"flex",alignItems:"center"}}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Transaction Documents — available on accepted requests */}
                    {(req.status==="accepted"||req.status==="returned")&&(
                      <DocumentManager req={req} userId={userId} orgName={orgName}/>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}