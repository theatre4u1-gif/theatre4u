import React, { useState, useEffect } from "react";
import { APP_NAME, IS_ARTSTRACKER } from "./config.js";
import { SB } from "./supabase.js";
import { CAT, CATS, CONDS, AVAIL, MKT } from "./inventory.js";
import { BG, usp } from "../lib/backgrounds.js";
import { Ic } from "./icons.jsx";
import { UpgradePlans } from "./billing.jsx";
import { fmt$, doorUrl, doorHost } from "./helpers.js";
import { QR } from "./qr.js";
import { printProductionReport } from "./productions.jsx";
import { getExchangeName, getTerm } from "../lib/verticals.js";

// Reports page (+ platform-usage + production-report tabs) — extracted from App.jsx.

export function Reports({ items, plan="free", org=null, userId=null, userEmail=null }) {
  const [tab,setTab] = useState("overview");
  const totalQty  = items.reduce((s,i)=>s+(i.qty||1),0);
  const catData   = CATS.map(cat=>{const ci=items.filter(i=>i.category===cat.id);return{...cat,count:ci.length,qty:ci.reduce((s,i)=>s+(i.qty||1),0),val:ci.reduce((s,i)=>s+((i.sale||0)*(i.qty||1)),0)}}).filter(c=>c.count>0);
  const condData  = CONDS.map(c=>({l:c,n:items.filter(i=>i.condition===c).length})).filter(c=>c.n>0);
  const availData = AVAIL.map(a=>({l:a,n:items.filter(i=>i.avail===a).length})).filter(a=>a.n>0);
  const mktData   = MKT.map(s=>({l:s,n:items.filter(i=>i.mkt===s).length})).filter(m=>m.n>0);
  const maxN = n => Math.max(1,n);
  const locData = Object.entries(
    items.reduce((acc,i)=>{
      const loc=i.location||"Unassigned";
      if(!acc[loc]) acc[loc]={count:0,qty:0,items:[]};
      acc[loc].count++;
      acc[loc].qty+=(i.qty||1);
      acc[loc].items.push(i);
      return acc;
    },{})
  ).sort((a,b)=>b[1].qty-a[1].qty);

  const csv = () => {
    const h=["Name","Category","Condition","Size","Qty","Location","Availability","Market","Rent","Sale","Loan Period (wks)","Deposit","Tags","Image URL","Notes","ID","Added"];
    const rows=items.map(i=>[i.name,i.category,i.condition,i.size,i.qty,i.location,i.avail,i.mkt,i.rent,i.sale,i.loan_period||"",i.deposit||"",(i.tags||[]).join(";"),i.img||"",`"${(i.notes||"").replace(/"/g,'""')}"`,i.id,i.added]);
    const csv=[h,...rows].map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=(IS_ARTSTRACKER?"artstracker":"theatre4u")+"_inventory.csv";a.click();
  };

  const printAllQR = async () => {
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<html><head><title>${APP_NAME} QR Labels</title></head><body style="font-family:sans-serif;padding:16px"><h2 style="font-size:14px;margin-bottom:16px;color:#333">Theatre4u™ — QR Labels (${items.length} items)</h2><div id="lbl">Generating…</div></body></html>`);w.document.close();
    const srcs=await Promise.all(items.map(i=>QR.toDataURL(doorUrl(org)+"/#/item/"+i.id,140)));
    const labels=items.map((i,n)=>`<div style="display:inline-block;text-align:center;padding:10px;border:1px dashed #ccc;margin:5px;width:160px;vertical-align:top"><img src="${srcs[n]||""}" width="100" height="100"/><div style="font-size:10px;font-weight:700;margin-top:5px;word-break:break-word">${i.name}</div><div style="font-size:8px;color:#888;margin-top:2px">${i.category} · ${i.id.slice(0,8)}</div></div>`).join("");
    const el=w.document.getElementById("lbl");if(el){el.outerHTML=labels;setTimeout(()=>w.print(),400);}
  };

  if(plan==="free") return(
    <div style={{padding:"40px 20px",textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:14}}>📊</div>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:10}}>Reports require a Pro account</h2>
      <p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 24px",lineHeight:1.6}}>Get detailed analytics, condition reports, location breakdowns, and CSV export. Upgrade to Pro to unlock Reports.</p>
      <UpgradePlans compact={true} userId={userId} userEmail={userEmail}/>
    </div>
  );

  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.reports,1400,900)} alt="" className="page-bg-img"/>

      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:230}}>
          <img src={usp(BG.reports,1100,290)} alt="Reports" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📊 Analytics</div>
            <h1 className="hero-title" style={{fontSize:44}}>Reports</h1>
            <p className="hero-sub">Breakdowns, condition tracking, and data exports for your program.</p>
          </div>
          <div style={{position:"absolute",bottom:24,right:30,zIndex:2,display:"flex",gap:8}}>
            <button className="btn" style={{background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.55)",color:"#fff",backdropFilter:"blur(6px)",fontWeight:600}} onClick={printAllQR}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              Print All QR
            </button>
            <button className="btn btn-g" onClick={csv}><span style={{width:14,height:14,display:"flex"}}>{Ic.dl}</span>Export CSV</button>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 48px",position:"relative",zIndex:1}}>
        <div className="tabs">
          {[["overview","Overview"],["condition","Condition"],["availability","Availability"],["market",getExchangeName(org?.vertical)],["location","Locations"],["productions","🎭 "+getTerm(org?.vertical,"productions")],["usage","📊 Platform Usage"]].map(([t,l])=>(
            <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {tab==="overview"&&(
          <div className="card card-p">
            <div className="sh"><h2>Category Breakdown</h2></div>
            <div className="tw">
              <table>
                <thead><tr><th>Category</th><th>Entries</th><th>Total Qty</th><th>Est. Value</th></tr></thead>
                <tbody>
                  {catData.map(c=>(
                    <tr key={c.id}>
                      <td style={{fontWeight:700}}>{c.icon} {c.label}</td>
                      <td>{c.count}</td>
                      <td style={{fontWeight:800}}>{c.qty}</td>
                      <td style={{fontFamily:"'Playfair Display',serif",color:"var(--cog)",fontSize:16}}>{c.val>0?fmt$(c.val):"—"}</td>
                    </tr>
                  ))}
                  <tr style={{background:"var(--parch)"}}>
                    <td style={{fontFamily:"'Playfair Display',serif",fontSize:17}}>Total</td>
                    <td style={{fontWeight:800}}>{items.length}</td>
                    <td style={{fontWeight:800}}>{totalQty}</td>
                    <td style={{fontFamily:"'Playfair Display',serif",color:"var(--cog)",fontSize:18}}>{fmt$(catData.reduce((s,c)=>s+c.val,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="condition"&&(
          <div className="card card-p">
            <div className="sh"><h2>Condition Report</h2></div>
            {condData.map(c=>(
              <div className="bar-row" key={c.l}>
                <span className="bar-lbl" style={{width:110}}>{c.l}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(c.n/maxN(items.length))*100}%`,background:c.l==="New"?"#4caf50":c.l==="Excellent"?"#66bb6a":c.l==="Good"?"#42a5f5":"#ffa726"}}/></div>
                <span className="bar-cnt">{c.n}</span>
              </div>
            ))}
            {condData.length===0&&<p style={{color:"var(--faint)",fontStyle:"italic",fontFamily:"'Lora',serif"}}>No data yet.</p>}
          </div>
        )}

        {tab==="availability"&&(
          <div className="card card-p">
            <div className="sh"><h2>Availability</h2></div>
            {availData.map(a=>(
              <div className="bar-row" key={a.l}>
                <span className="bar-lbl" style={{width:130}}>{a.l}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(a.n/maxN(items.length))*100}%`,background:a.l==="In Stock"?"#4caf50":a.l==="In Use"?"#42a5f5":"#ffa726"}}/></div>
                <span className="bar-cnt">{a.n}</span>
              </div>
            ))}
          </div>
        )}

        {tab==="market"&&(
          <div className="card card-p">
            <div className="sh"><h2>Exchange Status</h2></div>
            {mktData.map(m=>(
              <div className="bar-row" key={m.l}>
                <span className="bar-lbl" style={{width:130}}>{m.l}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(m.n/maxN(items.length))*100}%`,background:m.l.includes("Rent")?"#42a5f5":m.l.includes("Sale")?"#4caf50":m.l==="Rent or Sale"?"#d4a843":"#aaa"}}/></div>
                <span className="bar-cnt">{m.n}</span>
              </div>
            ))}
          </div>
        )}

        {tab==="location"&&(
          <div className="card card-p">
            <div className="sh"><h2>Items by Location</h2><p>Where everything is stored across your facility.</p></div>
            {locData.length===0
              ? <p style={{color:"var(--muted)",textAlign:"center",padding:24}}>No items yet.</p>
              : locData.map(([loc,data])=>(
                <div key={loc} style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
                    <span style={{fontSize:18}}>📍</span>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:17}}>{loc}</span>
                    <span style={{marginLeft:"auto",background:"var(--linen)",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700,color:"var(--muted)"}}>{data.qty} item{data.qty!==1?"s":""}</span>
                  </div>
                  <div className="tw">
                    <table>
                      <thead><tr><th>Item</th><th>Category</th><th>Condition</th><th>Qty</th><th>Availability</th></tr></thead>
                      <tbody>
                        {data.items.map(item=>{
                          const cat=CAT[item.category]||CAT.other;
                          return(
                            <tr key={item.id}>
                              <td style={{fontWeight:700}}>{item.name}</td>
                              <td>{cat.icon} {cat.label}</td>
                              <td>{item.condition}</td>
                              <td style={{fontWeight:800}}>{item.qty}</td>
                              <td><span style={{padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,background:item.avail==="In Stock"?"rgba(76,175,80,.15)":"rgba(66,165,245,.15)",color:item.avail==="In Stock"?"#2e7d32":"#1565c0"}}>{item.avail}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            }
          </div>
        )}
        {tab==="usage"&&(
          <PlatformUsageReport items={items} org={org} plan={plan}/>
        )}

        {tab==="productions"&&(
          <ProductionReportTab org={org} allItems={items}/>
        )}

      </div>
    </div>
  );
}

export function PlatformUsageReport({ items, org, plan }) {
  const today      = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const orgName    = org?.name || "Theatre Program";
  const totalItems = items.length;
  const totalQty   = items.reduce((s,i)=>s+(i.qty||1),0);
  const withPhotos = items.filter(i=>i.img).length;
  const listed     = items.filter(i=>i.mkt!=="Not Listed").length;
  const inStock    = items.filter(i=>i.avail==="In Stock").length;
  const totalValue = items.reduce((s,i)=>s+((parseFloat(i.sale)||0)*(i.qty||1)),0);
  const memberSince= org?.created_at?new Date(org.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long"}):"N/A";

  const catCounts = items.reduce((a,i)=>{a[i.category]=(a[i.category]||0)+1;return a},{});
  const topCats   = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const CAT_LABELS = {costumes:"Costumes",props:"Props",sets:"Sets & Scenery",lighting:"Lighting",sound:"Sound Equipment",scripts:"Scripts & Music",makeup:"Makeup & Wigs",furniture:"Stage Furniture",fabrics:"Fabrics & Drapes",tools:"Tools & Hardware",effects:"Special Effects",other:"Other"};

  const printReport = () => {
    const w = window.open("","_blank","width=900,height=700");
    if(!w) return;
    const catRows = topCats.map(([cat,n])=>`<tr><td style="padding:6px 14px">${CAT_LABELS[cat]||cat}</td><td style="padding:6px 14px;text-align:right;font-weight:700">${n}</td></tr>`).join("");
    const html=`<!DOCTYPE html><html><head><title>Platform Utilization Report — ${orgName}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1a1200;margin:0;padding:0}
      .page{max-width:820px;margin:0 auto;padding:40px}
      h1{font-family:Georgia,serif;font-size:28px;margin:0 0 4px;color:#1a0f00}
      h2{font-family:Georgia,serif;font-size:16px;color:#1a0f00;margin:24px 0 10px;border-bottom:2px solid #d4a843;padding-bottom:6px}
      .meta{font-size:12px;color:#888;margin-bottom:32px}
      .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
      .stat-box{background:#f5f0e8;border:1px solid #e0d5c0;border-radius:6px;padding:14px;text-align:center}
      .stat-val{font-family:Georgia,serif;font-size:26px;font-weight:700;color:#d4a843}
      .stat-lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
      .callout{background:#fff8e6;border-left:4px solid #d4a843;padding:14px 18px;margin:20px 0;font-size:13px;line-height:1.6}
      table{width:100%;border-collapse:collapse}
      th{background:#f5f0e8;padding:8px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px}
      td{padding:6px 14px;border-bottom:1px solid #eee;font-size:13px}
      @media print{button{display:none!important}}
    </style></head><body><div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#d4a843;margin-bottom:6px">${APP_NAME}</div>
          <h1>Platform Utilization Report</h1>
          <div class="meta">${orgName} · Generated ${today} · Member since ${memberSince}</div>
        </div>
        <button onclick="window.print()" style="padding:8px 18px;background:#1a0f00;color:#d4a843;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:700">🖨 Print / Save PDF</button>
      </div>
      <div class="callout"><strong>${orgName}</strong> uses ${APP_NAME} to manage, catalog, and share their program's physical inventory — costumes, props, lighting, sound equipment, sets, and more. This report summarizes how the platform is being utilized to protect and maximize the value of district arts assets.</div>
      <h2>Inventory Summary</h2>
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-val">${totalItems}</div><div class="stat-lbl">Cataloged Items</div></div>
        <div class="stat-box"><div class="stat-val">${totalQty.toLocaleString()}</div><div class="stat-lbl">Total Inventory Qty</div></div>
        <div class="stat-box"><div class="stat-val">${totalValue>0?"$"+totalValue.toLocaleString("en-US",{maximumFractionDigits:0}):"—"}</div><div class="stat-lbl">Est. Inventory Value</div></div>
        <div class="stat-box"><div class="stat-val">${withPhotos}</div><div class="stat-lbl">Items with Photos</div></div>
        <div class="stat-box"><div class="stat-val">${inStock}</div><div class="stat-lbl">Currently Available</div></div>
        <div class="stat-box"><div class="stat-val">${listed}</div><div class="stat-lbl">Shared with Other Programs</div></div>
      </div>
      <h2>Inventory by Category</h2>
      <table><thead><tr><th>Category</th><th style="text-align:right">Items</th></tr></thead><tbody>${catRows}</tbody></table>
      <h2>Asset Management</h2>
      <table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody>
        <tr><td>QR Code Labels</td><td>✅ Every item gets a scannable label for instant identification</td></tr>
        <tr><td>Photo Documentation</td><td>${withPhotos>0?`✅ ${withPhotos} items documented with photos`:"○ No photos yet — recommended for high-value items"}</td></tr>
        <tr><td>Storage Location Tracking</td><td>✅ Items tracked by physical location within the program</td></tr>
        <tr><td>Condition Tracking</td><td>✅ Each item's condition recorded for maintenance planning</td></tr>
        <tr><td>Backstage Exchange</td><td>${listed>0?`✅ ${listed} item${listed!==1?"s":""} shared with neighboring programs — reducing costs for district schools`:"○ No items shared yet"}</td></tr>
      </tbody></table>
      <h2>Why This Matters</h2>
      <p style="font-size:13px;line-height:1.8;color:#444">Theatre programs typically manage hundreds of thousands of dollars in physical assets — costumes, lighting equipment, sound systems, and set materials — with no formal inventory system. Items go missing, get double-purchased, or sit unused while neighboring schools pay commercial rental rates for the same gear.</p>
      <p style="font-size:13px;line-height:1.8;color:#444">${APP_NAME} gives <strong>${orgName}</strong> a permanent, searchable record of every item the program owns. QR labels allow any staff member to instantly look up any item with their phone camera. The Backstage Exchange enables schools within the district to share resources freely — reducing program expenses and maximizing the return on arts investment.</p>
      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e0d5c0;font-size:10px;color:#aaa;text-align:center">${APP_NAME} — Artstracker LLC · ${doorHost(org)} · Report generated ${today}</div>
    </div></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const card={background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:16,marginBottom:12};
  const fmt=n=>"$"+n.toLocaleString("en-US",{minimumFractionDigits:2});

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:3}}>Platform Utilization Report</div>
          <div style={{fontSize:12,color:"var(--faint)"}}>A report for principals, arts directors, and board members showing how {APP_NAME} is being used to protect and maximize arts program assets.</div>
        </div>
        <button onClick={printReport} className="btn btn-g">🖨 Generate &amp; Print Report</button>
      </div>

      <div style={{...card,background:"rgba(212,168,67,.06)",borderColor:"rgba(212,168,67,.25)",marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>What this report shows</div>
        <div style={{fontSize:13,color:"var(--faint)",lineHeight:1.6}}>This report is designed to hand to a principal or superintendent. It shows the size and value of the program's cataloged inventory, how many items are documented with photos and QR labels, and how many assets are being shared with other programs through Backstage Exchange. Click "Generate &amp; Print Report" for the formatted, print-ready version.</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Cataloged Items",val:totalItems,                        color:"var(--goldink)"},
          {label:"Total Qty",      val:totalQty.toLocaleString(),          color:"var(--text)"},
          {label:"Est. Value",     val:totalValue>0?"$"+totalValue.toLocaleString("en-US",{maximumFractionDigits:0}):"—",color:"var(--green)"},
          {label:"With Photos",   val:withPhotos,                          color:"var(--text)"},
          {label:"Shared",         val:listed,                            color:"var(--blue)"},
          {label:"In Stock",       val:inStock,                           color:"var(--text)"},
        ].map(s=>(
          <div key={s.label} style={{...card,textAlign:"center",marginBottom:0,padding:14}}>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"'Playfair Display',serif",color:s.color}}>{s.val}</div>
            <div style={{fontSize:10,color:"var(--faint)",marginTop:3,textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      {topCats.length>0&&(
        <div style={card}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Inventory by Category</div>
          {topCats.map(([cat,n])=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:130,fontSize:12,color:"var(--faint)",flexShrink:0}}>{CAT_LABELS[cat]||cat}</div>
              <div style={{flex:1,height:6,background:"var(--white)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(totalItems>0?n/totalItems*100:0)+"%",background:"var(--gold)",borderRadius:3,transition:"width .4s"}}/>
              </div>
              <div style={{fontSize:12,fontWeight:700,width:30,textAlign:"right",flexShrink:0}}>{n}</div>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Asset Management Checklist</div>
        {[
          {label:"QR Code Labels",       done:true,         note:"Every item gets a scannable label for instant lookup"},
          {label:"Photo Documentation",  done:withPhotos>0, note:`${withPhotos} of ${totalItems} items have photos`},
          {label:"Location Tracking",    done:items.some(i=>i.location), note:"Items tracked by storage location"},
          {label:"Condition Records",    done:true,         note:"Each item's condition documented for maintenance planning"},
          {label:"Backstage Exchange",   done:listed>0,     note:listed>0?`${listed} items shared with neighboring programs`:"Enable to share with district schools"},
        ].map(row=>(
          <div key={row.label} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:18,flexShrink:0}}>{row.done?"✅":"○"}</div>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{row.label}</div>
              <div style={{fontSize:11,color:"var(--faint)",marginTop:1}}>{row.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{fontSize:11,color:"var(--faint)",fontStyle:"italic",marginTop:12,lineHeight:1.5}}>
        Click "Generate &amp; Print Report" for a fully formatted print-ready version suitable for principals, arts directors, or board presentations.
      </div>
    </div>
  );
}

export function ProductionReportTab({ org, allItems }) {
  const [productions, setProductions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null); // production being previewed
  const [needs, setNeeds]             = useState([]);
  const [prodItems, setProdItems]     = useState([]);
  const [loadingDetail, setLd]        = useState(false);

  useEffect(()=>{
    (async()=>{
      const { data } = await SB.from("productions")
        .select("*, production_items(id,status), production_needs(id,status)")
        .eq("org_id", org?.id)
        .order("created_at",{ascending:false});
      setProductions(data||[]);
      setLoading(false);
    })();
  },[org?.id]);

  const selectProd = async (prod) => {
    setSelected(prod); setLd(true);
    const [nr, ir] = await Promise.all([
      SB.from("production_needs").select("*").eq("production_id",prod.id).order("added_at"),
      SB.from("production_items").select("*").eq("production_id",prod.id).order("added_at"),
    ]);
    setNeeds(nr.data||[]);
    setProdItems(ir.data||[]);
    setLd(false);
  };

  const card = { background:"var(--parch)", border:"1px solid var(--border)",
    borderRadius:10, padding:16, marginBottom:12 };

  if (loading) return <div style={{textAlign:"center",padding:40,color:"var(--muted)"}}>Loading…</div>;

  if (productions.length === 0) return (
    <div style={{textAlign:"center",padding:48}}>
      <div style={{fontSize:40,marginBottom:12}}>🎭</div>
      <h3 style={{fontFamily:"var(--serif)",marginBottom:8}}>No Productions Yet</h3>
      <p style={{color:"var(--muted)",fontSize:13,lineHeight:1.6}}>
        Create a production in the Productions section to generate reports here.
      </p>
    </div>
  );

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h3 style={{fontFamily:"var(--serif)",fontSize:18,marginBottom:4}}>Production Reports</h3>
        <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
          Select a production to preview its needs list and inventory, then print a formatted report
          suitable for directors, stage managers, or program documentation.
        </p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
        {productions.map(prod=>{
          const totalNeeds = prod.production_needs?.length||0;
          const acqNeeds   = prod.production_needs?.filter(n=>n.status==="acquired").length||0;
          const totalInv   = prod.production_items?.length||0;
          const isSelected = selected?.id === prod.id;
          return (
            <div key={prod.id}
              onClick={()=>selectProd(prod)}
              style={{...card, cursor:"pointer",
                border:`1px solid ${isSelected?"var(--gold)":"var(--border)"}`,
                background:isSelected?"rgba(212,168,67,.06)":"var(--parch)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:32,height:32,borderRadius:8,background:prod.color||"var(--gold)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🎭</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.name}</div>
                  {prod.show_title&&<div style={{fontSize:11,color:"var(--muted)"}}>{prod.show_title}</div>}
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,
                  background:"rgba(255,255,255,.08)",color:"var(--muted)",textTransform:"capitalize"}}>
                  {prod.status}
                </span>
              </div>
              <div style={{display:"flex",gap:12,fontSize:11,color:"var(--muted)"}}>
                <span>📋 {totalNeeds} needs ({acqNeeds} sourced)</span>
                <span>📦 {totalInv} from inventory</span>
                {prod.opening_date&&<span>📅 {new Date(prod.opening_date).toLocaleDateString()}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontFamily:"var(--serif)",fontSize:16,fontWeight:700}}>{selected.name}</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-o btn-sm"
                onClick={()=>{setSelected(null);setNeeds([]);setProdItems([]);}}>
                ✕ Close
              </button>
              <button className="btn btn-g btn-sm"
                disabled={loadingDetail}
                onClick={()=>printProductionReport(selected, needs, prodItems, allItems, org)}>
                🖨 Print Report
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <div style={{textAlign:"center",padding:24,color:"var(--muted)"}}>Loading…</div>
          ) : (
            <div>
              {/* Quick stats */}
              <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
                {[
                  {l:"Needs List",     v:needs.length},
                  {l:"Acquired",       v:needs.filter(n=>n.status==="acquired").length},
                  {l:"Still Needed",   v:needs.filter(n=>n.status==="needed"||n.status==="searching").length},
                  {l:"From Inventory", v:prodItems.length},
                ].map(s=>(
                  <div key={s.l} style={{textAlign:"center",padding:"10px 16px",
                    background:"rgba(255,255,255,.04)",border:"1px solid var(--border)",
                    borderRadius:8,minWidth:80}}>
                    <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:700,
                      color:"var(--goldink)"}}>{s.v}</div>
                    <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Needs preview */}
              {needs.length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",
                    letterSpacing:1.5,color:"var(--muted)",marginBottom:8}}>Needs List Preview</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {needs.slice(0,5).map(n=>{
                      const st={needed:"🔴",searching:"🟡",found:"🔵",acquired:"🟢",not_needed:"⚫"}[n.status]||"🔴";
                      return (
                        <div key={n.id} style={{display:"flex",gap:8,alignItems:"center",
                          padding:"5px 8px",borderRadius:6,background:"rgba(255,255,255,.03)"}}>
                          <span style={{fontSize:12}}>{st}</span>
                          <span style={{fontSize:12,flex:1}}>{n.name}{n.qty_needed>1?` ×${n.qty_needed}`:""}</span>
                          <span style={{fontSize:11,color:"var(--muted)"}}>{n.category}</span>
                        </div>
                      );
                    })}
                    {needs.length>5&&<div style={{fontSize:11,color:"var(--muted)",padding:"4px 8px"}}>
                      +{needs.length-5} more items in full report
                    </div>}
                  </div>
                </div>
              )}

              <p style={{fontSize:12,color:"var(--muted)",lineHeight:1.6}}>
                The printed report includes your complete needs list grouped by category,
                all inventory items assigned to this production, cost estimates,
                and director's notes — formatted and ready to share.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
