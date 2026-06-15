// PRODUCTIONS (Show Folders) — extracted from App.jsx (modularization).
// Components: AddToProductionPicker, ProductionForm, ProductionNeedsImport,
// ProductionNeedsChecklist, ProductionDetail, Productions.
// Exports the two entry points App.jsx renders: AddToProductionPicker, Productions.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SB } from "./supabase.js";
import { Modal } from "./ui.jsx";
import { CATS, CAT } from "./inventory.js";
import { Ic } from "./icons.jsx";
import { parseCSV } from "./helpers.js";
import { usp } from "../lib/backgrounds.js";
import { getTerm } from "../lib/verticals.js";

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTIONS  (Show Folders)
// ══════════════════════════════════════════════════════════════════════════════

const PROD_COLORS = [
  "#d4a843","#c2185b","#7b1fa2","#1565c0","#2e7d32",
  "#d84315","#00838f","#4e342e","#ad1457","#546e7a",
];

const PROD_STATUSES = [
  { key:"needed",      label:"Needed",      color:"#9b93a8" },
  { key:"confirmed",   label:"Confirmed",   color:"#4caf50" },
  { key:"checked_out", label:"Checked Out", color:"#42a5f5" },
  { key:"returned",    label:"Returned",    color:"#d4a843" },
];
const PROD_STATUS_MAP = Object.fromEntries(PROD_STATUSES.map(s=>[s.key,s]));

// ── Add-to-Production picker (shown from item detail or card) ─────────────
export function AddToProductionPicker({ item, userId, onClose }) {
  const [productions, setProductions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(null);
  const [done,        setDone]        = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await SB.from("productions")
        .select("*, production_items(item_id)")
        .eq("org_id", userId)
        .neq("status","closed")
        .order("created_at", { ascending: false });
      setProductions(data || []);
      setLoading(false);
    })();
  }, [userId]);

  const toggle = async (prod) => {
    const already = prod.production_items?.some(pi => pi.item_id === item.id);
    setSaving(prod.id);
    if (already) {
      await SB.from("production_items")
        .delete()
        .eq("production_id", prod.id)
        .eq("item_id", item.id);
      setDone(p => ({ ...p, [prod.id]: false }));
    } else {
      await SB.from("production_items")
        .insert({ production_id: prod.id, item_id: item.id, qty_needed: 1 });
      setDone(p => ({ ...p, [prod.id]: true }));
    }
    // Refresh
    const { data } = await SB.from("productions")
      .select("*, production_items(item_id)")
      .eq("org_id", userId)
      .neq("status","closed")
      .order("created_at", { ascending: false });
    setProductions(data || []);
    setSaving(null);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", zIndex:3000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxWidth:400, background:"#fdf6ec",
        border:"1px solid var(--border)", borderRadius:14, overflow:"hidden",
        boxShadow:"0 12px 48px rgba(0,0,0,.5)", animation:"su .2s ease" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700 }}>Add to Production</div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{item.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--border)",
            color:"var(--muted)", borderRadius:6, padding:"3px 9px", cursor:"pointer", fontFamily:"inherit" }}>✕</button>
        </div>
        <div style={{ padding:14, maxHeight:360, overflowY:"auto" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:24, color:"var(--muted)" }}>Loading…</div>
          ) : productions.length === 0 ? (
            <div style={{ textAlign:"center", padding:24 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🎭</div>
              <p style={{ color:"var(--muted)", fontSize:13, marginBottom:12 }}>
                No active productions yet. Create one on the Productions page first.
              </p>
            </div>
          ) : (
            productions.map(prod => {
              const inProd = prod.production_items?.some(pi => pi.item_id === item.id);
              const isDone = done[prod.id] !== undefined ? done[prod.id] : inProd;
              return (
                <div key={prod.id} onClick={() => saving !== prod.id && toggle(prod)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                    borderRadius:8, cursor:"pointer", marginBottom:4,
                    background: isDone ? "rgba(76,175,80,.1)" : "rgba(255,255,255,.03)",
                    border:`1px solid ${isDone ? "rgba(76,175,80,.25)" : "var(--border)"}`,
                    transition:"all .15s" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%",
                    background:prod.color||"var(--gold)", flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{prod.name}</div>
                    {prod.opening_date && (
                      <div style={{ fontSize:11, color:"var(--muted)" }}>
                        Opens {new Date(prod.opening_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize:18, flexShrink:0 }}>
                    {saving === prod.id ? "⏳" : isDone ? "✅" : "○"}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div style={{ padding:"10px 14px", borderTop:"1px solid var(--border)",
          textAlign:"center", fontSize:12, color:"var(--muted)" }}>
          Click a production to add or remove this item
        </div>
      </div>
    </div>
  );
}

// ── Production Form ────────────────────────────────────────────────────────
function ProductionForm({ prod, onSave, onCancel, vertical="theatre" }) {
  const [f, setF] = useState(prod || {
    name:"", show_title:"", opening_date:"", closing_date:"",
    notes:"", color:PROD_COLORS[0], status:"planning"
  });
  const s = (k,v) => setF(p => ({ ...p, [k]:v }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div className="fg2">
        <div className="fg fu">
          <label className="fl">Production Name *</label>
          <input className="fi" value={f.name} onChange={e=>s("name",e.target.value)}
            placeholder="e.g. The Wiz — Spring 2026" autoFocus/>
        </div>
        <div className="fg">
          <label className="fl">Show Title</label>
          <input className="fi" value={f.show_title||""} onChange={e=>s("show_title",e.target.value)}
            placeholder="The Wiz"/>
        </div>
        <div className="fg">
          <label className="fl">Status</label>
          <select className="fs" value={f.status} onChange={e=>s("status",e.target.value)}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="fg">
          <label className="fl">Opening Date</label>
          <input className="fi" type="date" value={f.opening_date||""} onChange={e=>s("opening_date",e.target.value)}/>
        </div>
        <div className="fg">
          <label className="fl">Closing Date</label>
          <input className="fi" type="date" value={f.closing_date||""} onChange={e=>s("closing_date",e.target.value)}/>
        </div>
        <div className="fg fu">
          <label className="fl">Color Label</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
            {PROD_COLORS.map(c => (
              <div key={c} onClick={()=>s("color",c)}
                style={{ width:28, height:28, borderRadius:"50%", background:c, cursor:"pointer",
                  border: f.color===c ? "3px solid white" : "3px solid transparent",
                  boxShadow: f.color===c ? `0 0 0 2px ${c}` : "none",
                  transition:"all .15s" }}/>
            ))}
          </div>
        </div>
        <div className="fg fu">
          <label className="fl">Notes</label>
          <textarea className="ft" value={f.notes||""} onChange={e=>s("notes",e.target.value)}
            placeholder="Budget notes, director's vision, special requirements…"/>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", paddingTop:10,
        borderTop:"1px solid var(--border)" }}>
        <button className="btn btn-o" onClick={onCancel}>Cancel</button>
        <button className="btn btn-g" disabled={!f.name.trim()} onClick={()=>onSave(f)}
          style={!f.name.trim()?{opacity:.4}:{}}>
          {prod ? "Save Changes" : ("Create "+getTerm(vertical,"production"))}
        </button>
      </div>
    </div>
  );
}

// ── Shared: Print Production Report ──────────────────────────────────────────
// Exported — used by ProductionDetail (here) and ProductionReportTab (reports.jsx).
export async function printProductionReport(prod, needs, prodItems, allItems, org) {
  const today = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const orgName = org?.name || "Theatre Program";

  // Status helpers
  const statusLabel = { needed:"Still Needed", searching:"Searching", found:"Found",
    acquired:"Acquired", not_needed:"Not Needed" };
  const sourceLabel  = { unknown:"TBD", in_house:"From Our Inventory",
    exchange:"Backstage Exchange", borrow:"Borrowing", buy:"Purchasing", donate:"Donated" };

  // Stats
  const totalNeeds = needs.length;
  const acquiredN  = needs.filter(n=>n.status==="acquired").length;
  const pct        = totalNeeds > 0 ? Math.round(acquiredN/totalNeeds*100) : 0;
  const estCost    = needs.reduce((s,n)=>s+(parseFloat(n.estimated_cost)||0),0);
  const actCost    = needs.reduce((s,n)=>s+(parseFloat(n.actual_cost)||0),0);

  // Group needs by category
  const needsByCat = {};
  needs.forEach(n=>{
    const cat = n.category||"other";
    if(!needsByCat[cat]) needsByCat[cat]=[];
    needsByCat[cat].push(n);
  });

  // Group inventory items by category
  const enriched = prodItems.map(pi=>({...pi, item:allItems.find(i=>i.id===pi.item_id)}))
    .filter(pi=>pi.item);
  const invByCat = {};
  enriched.forEach(pi=>{
    const cat = pi.item?.category||"other";
    if(!invByCat[cat]) invByCat[cat]=[];
    invByCat[cat].push(pi);
  });

  const statusColor = { needed:"#c0392b", searching:"#e67e22", found:"#2980b9",
    acquired:"#27ae60", not_needed:"#95a5a6" };

  const needsHTML = Object.entries(needsByCat).map(([catId, catNeeds])=>{
    const cat = catId.charAt(0).toUpperCase()+catId.slice(1);
    const rows = catNeeds.map((n,i)=>`
      <tr style="background:${i%2===0?"#fff":"#faf7f2"}">
        <td style="padding:7px 12px;border-bottom:1px solid #eee">${n.name}${n.qty_needed>1?` ×${n.qty_needed}`:""}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee">
          <span style="color:${statusColor[n.status]||"#666"};font-weight:700;font-size:11px">
            ${statusLabel[n.status]||n.status}
          </span>
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">
          ${sourceLabel[n.source]||n.source}
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">
          ${n.resolved_notes||n.notes||"—"}
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;text-align:right;font-size:12px">
          ${n.actual_cost?`$${parseFloat(n.actual_cost).toFixed(2)}`:n.estimated_cost?`~$${parseFloat(n.estimated_cost).toFixed(2)}`:"—"}
        </td>
      </tr>`).join("");
    return `
      <div style="margin-bottom:24px;break-inside:avoid">
        <div style="background:#f5ede0;padding:7px 12px;font-weight:700;font-size:12px;
          text-transform:uppercase;letter-spacing:1px;color:#8a6a20;border-radius:4px 4px 0 0">
          ${cat} (${catNeeds.length})
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#fff8ef">
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Item</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Status</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Source</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Notes</th>
            <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Cost</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const invHTML = Object.entries(invByCat).length > 0 ? Object.entries(invByCat).map(([catId,items])=>{
    const cat = catId.charAt(0).toUpperCase()+catId.slice(1);
    const rows = items.map((pi,i)=>`
      <tr style="background:${i%2===0?"#fff":"#faf7f2"}">
        <td style="padding:7px 12px;border-bottom:1px solid #eee">${pi.item?.name||"—"}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">${pi.item?.condition||"—"}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">${pi.item?.location||"—"}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #eee">
          <span style="font-size:11px;font-weight:700;color:${
            pi.status==="confirmed"||pi.status==="returned"?"#27ae60":
            pi.status==="needed"?"#c0392b":"#e67e22"}">
            ${pi.status||"needed"}
          </span>
        </td>
      </tr>`).join("");
    return `
      <div style="margin-bottom:24px;break-inside:avoid">
        <div style="background:#f5ede0;padding:7px 12px;font-weight:700;font-size:12px;
          text-transform:uppercase;letter-spacing:1px;color:#8a6a20;border-radius:4px 4px 0 0">
          ${cat} (${items.length})
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#fff8ef">
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Item</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Condition</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Location</th>
            <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #e8d89a;color:#666;font-size:11px">Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("") : '<p style="color:#888;font-style:italic;font-size:13px">No inventory items assigned to this production.</p>';

  const html = `<!DOCTYPE html><html><head><title>${prod.name} — Production Report</title>
  <style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1008;margin:0;padding:0}
    @media print{body{margin:0}.no-print{display:none}}
    h1,h2,h3{font-family:Georgia,serif}
  </style></head><body>
  <div style="max-width:860px;margin:0 auto;padding:40px 32px">

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;
      margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1200">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;
          color:#c4922a;margin-bottom:6px">Production Report · Theatre4u™</div>
        <h1 style="font-size:32px;font-weight:700;color:#1a1200;margin:0 0 4px">${prod.name}</h1>
        ${prod.show_title?`<div style="font-size:16px;color:#666;margin-bottom:4px">${prod.show_title}</div>`:""}
        <div style="font-size:13px;color:#888">${orgName}</div>
      </div>
      <div style="text-align:right">
        ${prod.opening_date?`<div style="font-size:13px;color:#444;margin-bottom:3px">
          <strong>Opens:</strong> ${new Date(prod.opening_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
        </div>`:""}
        ${prod.closing_date?`<div style="font-size:13px;color:#444;margin-bottom:3px">
          <strong>Closes:</strong> ${new Date(prod.closing_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
        </div>`:""}
        <div style="font-size:11px;color:#aaa;margin-top:8px">Generated ${today}</div>
      </div>
    </div>

    <!-- Summary stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px">
      ${[
        ["Needs List Items", totalNeeds],
        ["Items Sourced",    acquiredN],
        ["Progress",         pct+"%"],
        ["Items from Inventory", enriched.length],
      ].map(([l,v])=>`
        <div style="border:1px solid #e8dcc8;border-radius:8px;padding:14px;text-align:center;background:#fffcf7">
          <div style="font-size:26px;font-weight:700;font-family:Georgia,serif;color:#c4922a">${v}</div>
          <div style="font-size:10px;color:#8a7a60;margin-top:3px;text-transform:uppercase;letter-spacing:.5px">${l}</div>
        </div>`).join("")}
    </div>

    ${(estCost>0||actCost>0)?`
    <!-- Cost summary -->
    <div style="background:#fffcf7;border:1px solid #e8d89a;border-radius:8px;padding:16px 20px;
      margin-bottom:28px;display:flex;gap:32px">
      ${estCost>0?`<div><div style="font-size:11px;color:#8a7a60;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Estimated Budget</div>
        <div style="font-size:22px;font-weight:700;font-family:Georgia,serif;color:#c4922a">$${estCost.toFixed(2)}</div></div>`:""}
      ${actCost>0?`<div><div style="font-size:11px;color:#8a7a60;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Actual Spent</div>
        <div style="font-size:22px;font-weight:700;font-family:Georgia,serif;color:#1a1200">$${actCost.toFixed(2)}</div></div>`:""}
    </div>`:""}

    ${prod.notes?`
    <!-- Director notes -->
    <div style="background:#f5f5f5;border-left:4px solid #c4922a;padding:12px 16px;
      border-radius:0 6px 6px 0;margin-bottom:28px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;
        color:#8a7a60;margin-bottom:6px">Director's Notes</div>
      <div style="font-size:13px;color:#444;line-height:1.7">${prod.notes}</div>
    </div>`:""}

    <!-- Needs List -->
    ${totalNeeds>0?`
    <h2 style="font-size:20px;font-weight:700;color:#1a1200;margin:0 0 16px;
      padding-bottom:8px;border-bottom:2px solid #e8dcc8">
      📋 Needs List — What This Production Requires
    </h2>
    ${needsHTML}`:""}

    <!-- From Inventory -->
    <h2 style="font-size:20px;font-weight:700;color:#1a1200;margin:28px 0 16px;
      padding-bottom:8px;border-bottom:2px solid #e8dcc8">
      📦 Items from Your Inventory
    </h2>
    ${invHTML}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;
      font-size:11px;color:#aaa;text-align:center">
      Generated by Theatre4u™ · theatre4u.org · ${today}
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`;

  const w = window.open("","_blank","width=1000,height=750");
  if(w){ w.document.write(html); w.document.close(); }
}

// ── Production Needs CSV Import ───────────────────────────────────────────────
function ProductionNeedsImport({ prod, userId, onImported, onClose }) {
  const [step,      setStep]      = useState("upload"); // upload → preview → done
  const [rows,      setRows]      = useState([]);
  const [headers,   setHeaders]   = useState([]);
  const [mapping,   setMapping]   = useState({});
  const [preview,   setPreview]   = useState([]);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);
  const fileRef = useRef();

  // Fields we can map from CSV
  const FIELDS = [
    { key:"name",           label:"Item Name *",     required:true  },
    { key:"category",       label:"Category",        required:false },
    { key:"qty_needed",     label:"Quantity",        required:false },
    { key:"status",         label:"Status",          required:false },
    { key:"source",         label:"Source",          required:false },
    { key:"estimated_cost", label:"Estimated Cost",  required:false },
    { key:"notes",          label:"Notes",           required:false },
  ];

  const downloadTemplate = () => {
    const h = ["Item Name","Category","Quantity","Status","Source","Estimated Cost","Notes"];
    const ex = [
      ["Magic Wand","props","1","needed","unknown","","Check with Lincoln High"],
      ["Victorian Ball Gown","costumes","2","searching","exchange","","Need size M and L"],
      ["Crown","props","3","needed","buy","15.00","Party City or Amazon"],
      ["Fog Machine","effects","1","found","in_house","","We have one in effects cage"],
      ["Period Boots","costumes","4","needed","borrow","","Try Fountain Valley HS"],
    ];
    const csv = [h,...ex].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "production_needs_template.csv";
    a.click();
  };

  // Auto-match column headers to field keys
  const autoMatch = h => {
    const s = h.toLowerCase().trim();
    if (s.includes("name") || s.includes("item"))          return "name";
    if (s.includes("cat"))                                  return "category";
    if (s.includes("qty") || s.includes("quantity") || s.includes("num")) return "qty_needed";
    if (s.includes("status"))                               return "status";
    if (s.includes("source") || s.includes("how"))         return "source";
    if (s.includes("cost") || s.includes("price") || s.includes("est")) return "estimated_cost";
    if (s.includes("note") || s.includes("comment"))       return "notes";
    return null;
  };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const allRows = parseCSV(ev.target.result);
      if (allRows.length < 2) { alert("File must have a header row and at least one data row."); return; }
      const hdrs = allRows[0];
      const dataRows = allRows.slice(1).filter(r => r.some(c=>c));
      setHeaders(hdrs);
      setRows(dataRows);
      // Auto-detect mapping
      const auto = {};
      hdrs.forEach((h,i) => { const m = autoMatch(h); if (m) auto[i] = m; });
      setMapping(auto);
      buildPreviewFromRows(hdrs, dataRows, auto);
    };
    reader.readAsText(file);
  };

  const buildPreviewFromRows = (hdrs, dataRows, map) => {
    // Validate category and source values
    const validCats   = CATS.map(c=>c.id);
    const validStatus = ["needed","searching","found","acquired","not_needed"];
    const validSource = ["unknown","in_house","exchange","borrow","buy","donate"];

    const items = dataRows.map(row => {
      const item = {
        name:"", category:"other", qty_needed:1,
        status:"needed", source:"unknown",
        estimated_cost:null, notes:"",
      };
      Object.entries(map).forEach(([colIdx, fieldKey]) => {
        const raw = (row[parseInt(colIdx)]||"").trim();
        if (!raw) return;
        switch(fieldKey) {
          case "name":           item.name = raw; break;
          case "category": {
            const lc = raw.toLowerCase();
            const match = validCats.find(c=>lc.includes(c)||c.includes(lc));
            if (match) item.category = match;
            else item.category = "other";
            break;
          }
          case "qty_needed":     item.qty_needed = parseInt(raw)||1; break;
          case "status": {
            const lc = raw.toLowerCase();
            item.status = validStatus.find(s=>s.includes(lc)||lc.includes(s))||"needed";
            break;
          }
          case "source": {
            const lc = raw.toLowerCase();
            if (lc.includes("house")||lc.includes("own")||lc.includes("inventory")) item.source="in_house";
            else if (lc.includes("exchange")||lc.includes("borrow exchange"))       item.source="exchange";
            else if (lc.includes("borrow"))                                          item.source="borrow";
            else if (lc.includes("buy")||lc.includes("purch"))                      item.source="buy";
            else if (lc.includes("donat"))                                           item.source="donate";
            else item.source="unknown";
            break;
          }
          case "estimated_cost": item.estimated_cost = parseFloat(raw.replace(/[$,]/g,""))||null; break;
          case "notes":          item.notes = raw; break;
        }
      });
      return item;
    }).filter(i => i.name.trim());

    setPreview(items);
    setStep("preview");
  };

  const doImport = async () => {
    setImporting(true);
    const now = new Date().toISOString();
    const payload = preview.map(item => ({
      ...item,
      production_id: prod.id,
      org_id: userId,
      added_at: now,
      updated_at: now,
    }));

    // Insert in batches of 50
    let imported = 0;
    for (let i=0; i<payload.length; i+=50) {
      const { error } = await SB.from("production_needs").insert(payload.slice(i, i+50));
      if (!error) imported += Math.min(50, payload.length-i);
    }
    setResult(imported);
    setStep("done");
    setImporting(false);
  };

  const card = { background:"var(--parch)", border:"1px solid var(--border)",
    borderRadius:10, padding:20 };

  // ── DONE ──
  if (step === "done") return (
    <div style={{...card, textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>✅</div>
      <h3 style={{fontFamily:"var(--serif)",marginBottom:8}}>Import Complete</h3>
      <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>
        {result} item{result!==1?"s":""} added to your needs list.
      </p>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}>
        <button className="btn btn-o btn-sm" onClick={()=>{
          setStep("upload"); setPreview([]); setRows([]); setHeaders([]); setMapping({}); setResult(null);
        }}>Import Another File</button>
        <button className="btn btn-g btn-sm" onClick={()=>onImported()}>Done</button>
      </div>
    </div>
  );

  // ── PREVIEW ──
  if (step === "preview") return (
    <div style={card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>
            Preview — {preview.length} items ready to import
          </div>
          <div style={{fontSize:12,color:"var(--muted)"}}>
            Review the list below. Items with a blank name are skipped automatically.
          </div>
        </div>
        <button className="btn btn-o btn-sm" onClick={()=>setStep("upload")}>← Back</button>
      </div>

      {/* Column mapping */}
      <div style={{marginBottom:16,padding:"12px 14px",background:"rgba(255,255,255,.04)",
        borderRadius:8,border:"1px solid var(--border)"}}>
        <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,
          color:"var(--muted)",marginBottom:10}}>Column Mapping</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
          {FIELDS.map(f=>{
            const colIdx = Object.entries(mapping).find(([,v])=>v===f.key)?.[0];
            return (
              <div key={f.key} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                <span style={{color:"var(--muted)",width:110,flexShrink:0}}>{f.label}</span>
                <select value={colIdx??""} className="fs"
                  style={{fontSize:11,padding:"3px 6px",flex:1}}
                  onChange={e=>{
                    const newMap={...mapping};
                    // Remove old mapping for this field
                    Object.keys(newMap).forEach(k=>{ if(newMap[k]===f.key) delete newMap[k]; });
                    if(e.target.value!=="") newMap[e.target.value]=f.key;
                    setMapping(newMap);
                    buildPreviewFromRows(headers, rows, newMap);
                  }}>
                  <option value="">— skip —</option>
                  {headers.map((h,i)=><option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview table */}
      <div style={{maxHeight:280,overflowY:"auto",marginBottom:16,
        border:"1px solid var(--border)",borderRadius:8}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"rgba(255,255,255,.06)"}}>
              {["Item","Category","Qty","Status","Source","Est. Cost","Notes"].map(h=>(
                <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,
                  fontWeight:800,textTransform:"uppercase",letterSpacing:1,
                  color:"var(--muted)",borderBottom:"1px solid var(--border)",
                  whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((item,i)=>(
              <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"6px 10px",fontWeight:600}}>{item.name}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.category}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.qty_needed}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.status}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>{item.source}</td>
                <td style={{padding:"6px 10px",color:"var(--muted)"}}>
                  {item.estimated_cost?`$${item.estimated_cost.toFixed(2)}`:"—"}
                </td>
                <td style={{padding:"6px 10px",color:"var(--muted)",
                  maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap"}}>{item.notes||"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button className="btn btn-o btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-g" disabled={importing||preview.length===0} onClick={doImport}>
          {importing ? "Importing…" : `Import ${preview.length} Items`}
        </button>
      </div>
    </div>
  );

  // ── UPLOAD ──
  return (
    <div style={card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:15}}>Import Needs List from CSV</div>
        <button className="btn btn-o btn-sm" onClick={onClose}>✕ Cancel</button>
      </div>

      <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.7,marginBottom:16}}>
        Upload a spreadsheet of everything your production needs — props, costumes, lighting,
        whatever you're tracking. We'll map your columns and import the list in one step.
      </p>

      {/* Download template */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
        background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",
        borderRadius:8,marginBottom:20}}>
        <span style={{fontSize:24}}>📄</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>Download our template</div>
          <div style={{fontSize:12,color:"var(--muted)"}}>
            Start with our CSV template — it has the right columns already set up with example items.
          </div>
        </div>
        <button className="btn btn-o btn-sm" onClick={downloadTemplate}>
          ⬇ Template
        </button>
      </div>

      {/* Upload area */}
      <label style={{display:"block",border:"2px dashed var(--border)",borderRadius:10,
        padding:"32px 20px",textAlign:"center",cursor:"pointer",
        background:"rgba(255,255,255,.02)",transition:"border .15s"}}
        onDragOver={e=>{e.preventDefault();}}
        onDrop={e=>{e.preventDefault();
          const file = e.dataTransfer.files[0];
          if(file){fileRef.current.files=e.dataTransfer.files;handleFile({target:{files:[file]}});}
        }}>
        <div style={{fontSize:36,marginBottom:10}}>📂</div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>
          Drop your CSV here, or click to browse
        </div>
        <div style={{fontSize:12,color:"var(--muted)"}}>
          Supports .csv files. Columns can be in any order — we'll help you map them.
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile}/>
      </label>

      {/* Accepted columns hint */}
      <div style={{marginTop:14,padding:"10px 14px",background:"rgba(255,255,255,.03)",
        borderRadius:8,fontSize:11,color:"var(--muted)",lineHeight:1.8}}>
        <strong style={{color:"var(--text)"}}>Columns we recognize:</strong>{" "}
        Item Name (required) · Category · Quantity · Status · Source · Estimated Cost · Notes
      </div>
    </div>
  );
}

// ── Production Needs Checklist ────────────────────────────────────────────────
// Planning layer: list what you need BEFORE you have it, then track how you source it

const NEED_STATUSES = [
  { key:"needed",     label:"Still Needed",  color:"var(--red)",   icon:"🔴" },
  { key:"searching",  label:"Searching",     color:"var(--gold)",  icon:"🟡" },
  { key:"found",      label:"Found",         color:"var(--blue)",  icon:"🔵" },
  { key:"acquired",   label:"Acquired",      color:"var(--green)", icon:"🟢" },
  { key:"not_needed", label:"Not Needed",    color:"var(--muted)", icon:"⚫" },
];
const NEED_SOURCES = [
  { key:"unknown",   label:"Source TBD"      },
  { key:"in_house",  label:"From Our Inventory" },
  { key:"exchange",  label:"Backstage Exchange" },
  { key:"borrow",    label:"Borrowing"       },
  { key:"buy",       label:"Purchasing"      },
  { key:"donate",    label:"Donated"         },
];

function ProductionNeedsChecklist({ prod, allItems, userId, org, onNavigateToExchange, memberRole=null }) {
  // Role-based permissions
  // director (null) + stage_manager: full access
  // crew: can add and update status, cannot delete or import
  // house: view only (but house can't see Productions at all in nav)
  const canAdd    = memberRole !== "house";
  const canEdit   = memberRole !== "house";
  const canDelete = !memberRole || memberRole === "director" || memberRole === "stage_manager";
  const canImport = !memberRole || memberRole === "director" || memberRole === "stage_manager";
  const [needs,    setNeeds]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [adding,   setAdding]  = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing,  setEditing] = useState(null);
  const [filter,   setFilter]  = useState("all"); // all | needed | acquired
  const [catFilter,setCatFilter]= useState("all");

  // Blank need form
  const blank = () => ({
    name:"", category:"costumes", qty_needed:1,
    notes:"", status:"needed", source:"unknown",
    resolved_item_id:null, resolved_notes:"",
    estimated_cost:"", actual_cost:"",
  });
  const [form, setForm] = useState(blank());
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = async () => {
    const { data } = await SB.from("production_needs")
      .select("*")
      .eq("production_id", prod.id)
      .order("added_at");
    setNeeds(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [prod.id]);

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      production_id: prod.id,
      org_id: userId,
      qty_needed: parseInt(form.qty_needed) || 1,
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
      updated_at: new Date().toISOString(),
    };
    // Strip id from payload
    const { id: _id, ...rest } = payload;
    if (editing) {
      const { error } = await SB.from("production_needs").update(rest).eq("id", editing.id);
      if (error) { alert("Save failed: " + error.message); return; }
      setNeeds(p => p.map(n => n.id === editing.id ? { ...n, ...rest, id:editing.id } : n));
    } else {
      const { data, error } = await SB.from("production_needs").insert(payload).select().single();
      if (error) { alert("Save failed: " + error.message); return; }
      if (data) setNeeds(p => [...p, data]);
    }
    setAdding(false); setEditing(null); setForm(blank());
  };

  const deleteNeed = async (id) => {
    const { error } = await SB.from("production_needs").delete().eq("id", id);
    if (error) { alert("Delete failed: " + error.message); return; }
    setNeeds(p => p.filter(n => n.id !== id));
  };

  const quickStatus = async (id, status) => {
    const { error } = await SB.from("production_needs").update({ status, updated_at:new Date().toISOString() }).eq("id", id);
    if (!error) setNeeds(p => p.map(n => n.id === id ? { ...n, status } : n));
  };

  const linkToInventory = async (needId, itemId) => {
    const { error } = await SB.from("production_needs").update({
      resolved_item_id: itemId,
      source: "in_house",
      status: "acquired",
      updated_at: new Date().toISOString()
    }).eq("id", needId);
    if (!error) setNeeds(p => p.map(n => n.id === needId
      ? { ...n, resolved_item_id:itemId, source:"in_house", status:"acquired" } : n));
  };

  // Filtered view
  const filtered = needs.filter(n => {
    if (filter === "needed" && (n.status === "acquired" || n.status === "not_needed")) return false;
    if (filter === "acquired" && n.status !== "acquired") return false;
    if (catFilter !== "all" && n.category !== catFilter) return false;
    return true;
  });

  // Stats
  const total    = needs.length;
  const acquired = needs.filter(n => n.status === "acquired").length;
  const pct      = total > 0 ? Math.round(acquired / total * 100) : 0;

  // Categories present in this needs list
  const catsUsed = [...new Set(needs.map(n => n.category))];

  const card = { background:"var(--parch)", border:"1px solid var(--border)",
    borderRadius:10, overflow:"hidden" };

  const NeedForm = ({ onDone }) => (
    <div style={{ ...card, padding:20, marginBottom:16 }}>
      <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--gold)" }}>
        {editing ? "Edit Item" : "Add to Needs List"}
      </div>

      {/* Name + Qty row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:12 }}>
        <div className="fg" style={{ margin:0 }}>
          <label className="fl">Item Name *</label>
          <input className="fi" value={form.name} autoFocus
            onChange={e=>upd("name",e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&save()}
            placeholder="e.g. Victorian Ball Gown, Magic Wand, Crown (3)"/>
        </div>
        <div className="fg" style={{ margin:0, width:70 }}>
          <label className="fl">Qty</label>
          <input className="fi" type="number" min="1" value={form.qty_needed}
            onChange={e=>upd("qty_needed",e.target.value)}/>
        </div>
      </div>

      {/* Category */}
      <div className="fg" style={{ marginBottom:12 }}>
        <label className="fl">Category</label>
        <select className="fs" value={form.category} onChange={e=>upd("category",e.target.value)}>
          {CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>

      {/* Source + Status row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
        <div className="fg" style={{ margin:0 }}>
          <label className="fl">How will you source it?</label>
          <select className="fs" value={form.source} onChange={e=>upd("source",e.target.value)}>
            {NEED_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="fg" style={{ margin:0 }}>
          <label className="fl">Status</label>
          <select className="fs" value={form.status} onChange={e=>upd("status",e.target.value)}>
            {NEED_STATUSES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Cost estimates — show only if buying */}
      {(form.source === "buy" || form.source === "borrow") && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          <div className="fg" style={{ margin:0 }}>
            <label className="fl">Est. Cost ($)</label>
            <input className="fi" type="number" min="0" step="0.01"
              value={form.estimated_cost} onChange={e=>upd("estimated_cost",e.target.value)}
              placeholder="0.00"/>
          </div>
          <div className="fg" style={{ margin:0 }}>
            <label className="fl">Actual Cost ($)</label>
            <input className="fi" type="number" min="0" step="0.01"
              value={form.actual_cost} onChange={e=>upd("actual_cost",e.target.value)}
              placeholder="0.00"/>
          </div>
        </div>
      )}

      {/* Resolved notes */}
      <div className="fg" style={{ marginBottom:16 }}>
        <label className="fl">Notes</label>
        <input className="fi" value={form.resolved_notes||form.notes||""}
          onChange={e=>upd("resolved_notes",e.target.value)}
          placeholder='e.g. "Check with Lincoln High", "Order from Amazon", "Grandma has one"'/>
      </div>

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button className="btn btn-o btn-sm" onClick={onDone}>Cancel</button>
        <button className="btn btn-g btn-sm" disabled={!form.name.trim()} onClick={save}>
          {editing ? "Save Changes" : "Add to List"}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Stats row */}
      {total > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12,
            color:"var(--muted)", marginBottom:5 }}>
            <span>{acquired} of {total} items sourced</span>
            <span style={{ fontWeight:700, color:pct===100?"var(--green)":"var(--ink)" }}>{pct}%</span>
          </div>
          <div style={{ height:6, background:"rgba(255,255,255,.08)", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:pct+"%", borderRadius:4,
              background: pct===100 ? "var(--green)" : prod.color||"var(--gold)",
              transition:"width .5s ease" }}/>
          </div>

          {/* Cost summary */}
          {needs.some(n=>n.estimated_cost||n.actual_cost) && (
            <div style={{ display:"flex", gap:16, marginTop:10 }}>
              {[
                { label:"Estimated", val: needs.reduce((s,n)=>s+(parseFloat(n.estimated_cost)||0),0) },
                { label:"Actual",    val: needs.reduce((s,n)=>s+(parseFloat(n.actual_cost)||0),0) },
              ].map(s => s.val > 0 && (
                <div key={s.label} style={{ fontSize:12, color:"var(--muted)" }}>
                  {s.label}: <strong style={{ color:"var(--text)" }}>${s.val.toFixed(2)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
        {/* Filter pills */}
        <div style={{ display:"flex", gap:5 }}>
          {[["all","All"],["needed","Still Needed"],["acquired","Acquired"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)}
              className={"btn btn-o btn-sm"+(filter===k?" btn-active":"")}
              style={{ padding:"4px 10px", fontSize:11,
                background:filter===k?"var(--gold)":"var(--parch)",
                color:filter===k?"#1a1000":"var(--muted)",
                borderColor:filter===k?"var(--gold)":"var(--border)" }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
          {canImport && (
            <button className="btn btn-o btn-sm"
              onClick={()=>{ setShowImport(true); setAdding(false); setEditing(null); }}
              style={{ fontSize:11 }}>
              ⬆ Import CSV
            </button>
          )}
          {canAdd && (
            <button className="btn btn-g btn-sm"
              onClick={()=>{ setEditing(null); setForm(blank()); setAdding(true); setShowImport(false); }}>
              + Add Item
            </button>
          )}
        </div>
      </div>

      {/* Import CSV */}
      {showImport && (
        <ProductionNeedsImport
          prod={prod}
          userId={userId}
          onClose={()=>setShowImport(false)}
          onImported={async()=>{ setShowImport(false); await load(); }}
        />
      )}

      {/* Add / Edit form */}
      {!showImport && (adding || editing) && (
        <NeedForm onDone={()=>{ setAdding(false); setEditing(null); setForm(blank()); }}/>
      )}

      {/* Exchange shortcut callout */}
      {needs.some(n=>n.status==="needed"||n.status==="searching") && org?.marketplace_enabled && (
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
          background:"rgba(82,153,224,.08)", border:"1px solid rgba(82,153,224,.2)",
          borderRadius:8, marginBottom:14, cursor:"pointer" }}
          onClick={onNavigateToExchange}>
          <span style={{ fontSize:20 }}>🏪</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--blue)" }}>Check Backstage Exchange</div>
            <div style={{ fontSize:11, color:"var(--muted)" }}>
              Other programs near you may have items on your needs list available to borrow or rent.
            </div>
          </div>
          <span style={{ color:"var(--blue)", fontSize:18 }}>→</span>
        </div>
      )}

      {/* Needs list */}
      {loading ? (
        <div style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>Loading…</div>
      ) : total === 0 ? (
        <div style={{ textAlign:"center", padding:36 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
          <h3 style={{ fontFamily:"var(--serif)", marginBottom:8 }}>Start Your Needs List</h3>
          <p style={{ color:"var(--muted)", fontSize:13, lineHeight:1.7, maxWidth:380, margin:"0 auto 16px" }}>
            Add every prop, costume, and piece of gear your production needs —
            even before you know where it's coming from. Then track how you source each one.
          </p>
          {canAdd && (
            <button className="btn btn-g" onClick={()=>{ setForm(blank()); setAdding(true); }}>
              + Add Your First Item
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:20, color:"var(--muted)", fontSize:13 }}>
          No items match this filter.
        </div>
      ) : (
        // Group by category
        Object.entries(
          filtered.reduce((acc, n) => {
            const cat = n.category || "other";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(n);
            return acc;
          }, {})
        ).map(([catId, catNeeds]) => {
          const cat = CAT[catId] || CAT.other;
          return (
            <div key={catId} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase",
                letterSpacing:1.5, color:cat.color, marginBottom:8,
                display:"flex", alignItems:"center", gap:6 }}>
                {cat.icon} {cat.label} ({catNeeds.length})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {catNeeds.map(need => {
                  const st  = NEED_STATUSES.find(s=>s.key===need.status)||NEED_STATUSES[0];
                  const src = NEED_SOURCES.find(s=>s.key===need.source)||NEED_SOURCES[0];
                  const linkedItem = need.resolved_item_id
                    ? allItems.find(i=>i.id===need.resolved_item_id) : null;

                  return (
                    <div key={need.id} style={{
                      padding:"10px 12px", borderRadius:8,
                      background:"rgba(255,255,255,.03)",
                      border:`1px solid ${need.status==="acquired"
                        ? "rgba(82,199,132,.25)"
                        : need.status==="not_needed"
                        ? "var(--border)"
                        : "var(--border)"}`,
                      opacity: need.status==="not_needed" ? 0.5 : 1,
                    }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                        {/* Status icon — click to cycle */}
                        <div style={{ fontSize:16, cursor:"pointer", flexShrink:0, marginTop:1 }}
                          title="Click to mark acquired"
                          onClick={()=>{
                            const next = need.status==="needed"?"searching"
                              :need.status==="searching"?"found"
                              :need.status==="found"?"acquired"
                              :"needed";
                            quickStatus(need.id, next);
                          }}>
                          {st.icon}
                        </div>

                        {/* Main info */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:13,
                            textDecoration:need.status==="not_needed"?"line-through":"none",
                            color:need.status==="acquired"?"var(--green)":"var(--text)" }}>
                            {need.name}
                            {need.qty_needed > 1 && (
                              <span style={{ fontSize:11, color:"var(--muted)",
                                marginLeft:6, fontWeight:400 }}>×{need.qty_needed}</span>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:"var(--muted)", marginTop:2,
                            display:"flex", gap:8, flexWrap:"wrap" }}>
                            <span>{src.label}</span>
                            {need.resolved_notes && <span>· {need.resolved_notes}</span>}
                            {linkedItem && (
                              <span style={{ color:"var(--green)" }}>
                                · Linked: {linkedItem.name}
                              </span>
                            )}
                            {(need.estimated_cost||need.actual_cost) && (
                              <span>
                                {need.actual_cost
                                  ? ("· Actual $"+parseFloat(need.actual_cost).toFixed(2))
                                  : ("· Est. $"+parseFloat(need.estimated_cost).toFixed(2))}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                          {/* Link to inventory */}
                          {need.status !== "acquired" && allItems.length > 0 && (
                            <select
                              onChange={e=>{ if(e.target.value) linkToInventory(need.id, e.target.value); }}
                              value=""
                              style={{ background:"var(--parch)", border:"1px solid var(--border)",
                                borderRadius:6, padding:"2px 6px", fontSize:10,
                                color:"var(--muted)", fontFamily:"inherit", cursor:"pointer" }}
                              title="Link to an item in your inventory">
                              <option value="">Link inventory…</option>
                              {allItems
                                .filter(i=>i.category===need.category || need.category==="other")
                                .slice(0,30)
                                .map(i=>(
                                  <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                            </select>
                          )}
                          {canEdit && (
                            <button onClick={()=>{ setEditing(need); setForm({...need, estimated_cost:need.estimated_cost||"", actual_cost:need.actual_cost||""}); setAdding(false); }}
                              style={{ background:"none", border:"none", color:"var(--muted)",
                                cursor:"pointer", fontSize:13, padding:"0 3px" }}>✏️</button>
                          )}
                          {canDelete && (
                            <button onClick={()=>deleteNeed(need.id)}
                              style={{ background:"none", border:"none", color:"var(--muted)",
                                cursor:"pointer", fontSize:14, padding:"0 3px" }}>✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Production Detail (the folder view) ────────────────────────────────────
function ProductionDetail({ prod, allItems, userId, onEdit, onDelete, onClose, onNavigateTo, org }) {
  const [detailTab, setDetailTab] = useState("needs"); // needs | inventory
  const [prodItems, setProdItems] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");

  const load = useCallback(async () => {
    const { data } = await SB.from("production_items")
      .select("*")
      .eq("production_id", prod.id)
      .order("added_at");
    setProdItems(data || []);
    setLoading(false);
  }, [prod.id]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (piId, status) => {
    const { error } = await SB.from("production_items").update({ status }).eq("id", piId);
    if (!error) setProdItems(p => p.map(x => x.id === piId ? { ...x, status } : x));
  };

  const removeItem = async (piId) => {
    const { error } = await SB.from("production_items").delete().eq("id", piId);
    if (!error) setProdItems(p => p.filter(x => x.id !== piId));
  };

  // Join production_items with allItems
  const enriched = prodItems.map(pi => ({
    ...pi,
    item: allItems.find(i => i.id === pi.item_id)
  })).filter(pi => {
    if (!pi.item) return false;
    if (!search) return true;
    return pi.item.name.toLowerCase().includes(search.toLowerCase());
  });

  // Group by category
  const byCategory = {};
  enriched.forEach(pi => {
    const cat = pi.item?.category || "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(pi);
  });

  const total     = prodItems.length;
  const confirmed = prodItems.filter(p => p.status === "confirmed" || p.status === "returned").length;
  const pct       = total > 0 ? Math.round(confirmed / total * 100) : 0;

  // Days until opening
  const daysUntil = prod.opening_date
    ? Math.ceil((new Date(prod.opening_date) - new Date()) / 86400000)
    : null;

  return (
    <div>
      {/* Header strip */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:20 }}>
        <div style={{ width:48, height:48, borderRadius:10, background:prod.color||"var(--gold)",
          flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:24 }}>🎭</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"var(--serif)", fontSize:20, fontWeight:700 }}>{prod.name}</div>
          {prod.show_title && <div style={{ fontSize:12, color:"var(--muted)" }}>{prod.show_title}</div>}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6 }}>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8, fontWeight:700,
              background:"rgba(255,255,255,.08)", color:"var(--muted)" }}>{prod.status}</span>
            {prod.opening_date && (
              <span style={{ fontSize:11, padding:"2px 8px", borderRadius:8, fontWeight:700,
                background: daysUntil !== null && daysUntil <= 14 ? "rgba(212,168,67,.2)" : "rgba(255,255,255,.08)",
                color: daysUntil !== null && daysUntil <= 14 ? "var(--gold)" : "var(--muted)" }}>
                {daysUntil !== null && daysUntil > 0
                  ? ("Opens in "+daysUntil+" day"+(daysUntil!==1?"s":""))
                  : daysUntil === 0 ? "Opens today!"
                  : ("Opened "+new Date(prod.opening_date).toLocaleDateString())}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button className="btn btn-o btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn btn-o btn-sm"
            onClick={async()=>{
              const { data:needsData } = await SB.from("production_needs")
                .select("*").eq("production_id", prod.id).order("added_at");
              const { data:piData } = await SB.from("production_items")
                .select("*").eq("production_id", prod.id).order("added_at");
              printProductionReport(prod, needsData||[], piData||[], allItems, org);
            }}
            style={{ color:"var(--gold)", borderColor:"rgba(212,168,67,.3)" }}>
            🖨 Print Report
          </button>
          <button className="btn btn-o btn-sm" style={{ color:"var(--red)" }}
            onClick={()=>{ if(window.confirm("Delete this production?")) onDelete(prod.id); }}>
            Delete
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12,
            color:"var(--muted)", marginBottom:5 }}>
            <span>{confirmed} of {total} items confirmed</span>
            <span style={{ fontWeight:700, color: pct===100?"var(--green)":"var(--ink)" }}>{pct}%</span>
          </div>
          <div style={{ height:7, background:"rgba(255,255,255,.08)", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:pct+"%", borderRadius:4,
              background: pct===100 ? "var(--green)" : prod.color||"var(--gold)",
              transition:"width .5s ease" }}/>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:18, borderBottom:"1px solid var(--border)", paddingBottom:0 }}>
        {[
          { key:"needs",     label:"📋 Needs List",      desc:"Plan what you need" },
          { key:"inventory", label:"📦 From Inventory",  desc:"Items from your collection" },
        ].map(t => (
          <button key={t.key} onClick={()=>setDetailTab(t.key)}
            style={{ padding:"8px 16px", background:"none", border:"none",
              borderBottom: detailTab===t.key ? "2px solid var(--gold)" : "2px solid transparent",
              color: detailTab===t.key ? "var(--gold)" : "var(--muted)",
              fontWeight: detailTab===t.key ? 700 : 400,
              fontSize:13, cursor:"pointer", fontFamily:"inherit",
              marginBottom:-1, transition:"all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Needs List tab */}
      {detailTab === "needs" && (
        <ProductionNeedsChecklist
          prod={prod}
          allItems={allItems}
          userId={userId}
          org={org}
          memberRole={org?._memberRole||null}
          onNavigateToExchange={()=>onNavigateTo&&onNavigateTo("marketplace")}
        />
      )}

      {/* From Inventory tab */}
      {detailTab === "inventory" && (<>

      {/* Search */}
      {total > 3 && (
        <div className="srch" style={{ marginBottom:14, width:"100%", maxWidth:280 }}>
          {Ic.search}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…"/>
        </div>
      )}

      {/* Items grouped by category */}
      {loading ? (
        <div style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>Loading…</div>
      ) : total === 0 ? (
        <div style={{ textAlign:"center", padding:36 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📦</div>
          <h3 style={{ fontFamily:"var(--serif)", marginBottom:6 }}>No Items Yet</h3>
          <p style={{ color:"var(--muted)", fontSize:13, lineHeight:1.6 }}>
            Open any item in Inventory and click "{getTerm(org?.vertical,"addToProduction")}" to start building your list.
          </p>
        </div>
      ) : enriched.length === 0 ? (
        <div style={{ textAlign:"center", padding:24, color:"var(--muted)" }}>No items match your search.</div>
      ) : (
        Object.entries(byCategory).map(([catId, items]) => {
          const cat = CAT[catId] || CAT.other;
          return (
            <div key={catId} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1.5,
                color:cat.color, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                {cat.icon} {cat.label} ({items.length})
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {items.map(pi => {
                  const st = PROD_STATUS_MAP[pi.status] || PROD_STATUS_MAP.needed;
                  return (
                    <div key={pi.id} style={{ display:"flex", alignItems:"center", gap:10,
                      padding:"9px 12px", borderRadius:8,
                      background:"rgba(255,255,255,.03)", border:"1px solid var(--border)" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {pi.item?.name}
                        </div>
                        <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>
                          {pi.item?.location || pi.item?.condition || ""}
                          {pi.qty_needed > 1 ? " · Need "+pi.qty_needed : ""}
                        </div>
                      </div>
                      {/* Status toggle */}
                      <select value={pi.status}
                        onChange={e => updateStatus(pi.id, e.target.value)}
                        style={{ background:"var(--parch)", border:`1px solid ${st.color}40`,
                          borderRadius:6, padding:"3px 7px", fontSize:11, fontWeight:700,
                          color:st.color, fontFamily:"inherit", cursor:"pointer", outline:"none" }}>
                        {PROD_STATUSES.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                      <button onClick={() => removeItem(pi.id)}
                        style={{ background:"none", border:"none", color:"var(--muted)",
                          cursor:"pointer", fontSize:16, padding:"0 2px", lineHeight:1,
                          display:"flex", alignItems:"center" }}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
      {prod.notes && (
        <div style={{ marginTop:16, padding:"10px 14px", background:"rgba(255,255,255,.03)",
          borderRadius:8, border:"1px solid var(--border)" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:4,
            textTransform:"uppercase", letterSpacing:1 }}>Notes</div>
          <div style={{ fontSize:13, color:"var(--ink)", lineHeight:1.6 }}>{prod.notes}</div>
        </div>
      )}
      </>)}
    </div>
  );
}

// ── Productions Page ───────────────────────────────────────────────────────
export function Productions({ userId, allItems, org, onNavigateTo }) {
  const [productions, setProductions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null); // "new" | "edit" | "detail"
  const [active,      setActive]      = useState(null);
  const [filter,      setFilter]      = useState("all"); // all | planning | active | closed

  const load = useCallback(async () => {
    const { data } = await SB.from("productions")
      .select("*, production_items(id, status)")
      .eq("org_id", userId)
      .order("created_at", { ascending: false });
    setProductions(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const saveProd = async (form) => {
    // Strip fields that aren't columns (embedded joins, immutable fields)
    const { id: _id, org_id: _org, created_at: _ca, production_items: _pi, ...payload } = form;
    if (active && modal === "edit") {
      const { data, error } = await SB.from("productions")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", active.id).select().single();
      if (error) { alert("Save failed: " + error.message); return; }
      if (data) {
        setProductions(p => p.map(x => x.id === data.id ? { ...x, ...data } : x));
        // If we came from detail view, update active so it reflects new dates
        setActive(prev => prev ? { ...prev, ...data } : prev);
      }
    } else {
      const { data, error } = await SB.from("productions")
        .insert({ ...payload, org_id: userId }).select().single();
      if (error) { alert("Save failed: " + error.message); return; }
      if (data) setProductions(p => [data, ...p]);
    }
    // If editing from detail, go back to detail not close entirely
    if (modal === "edit" && active) {
      setModal("detail");
    } else {
      setModal(null); setActive(null);
    }
  };

  const deleteProd = async (id) => {
    await SB.from("productions").delete().eq("id", id);
    setProductions(p => p.filter(x => x.id !== id));
    setModal(null); setActive(null);
  };

  const visible = filter === "all" ? productions : productions.filter(p => p.status === filter);

  return (
    <div style={{ position:"relative" }}>
      <img src={usp("photo-1503095396549-807759245b35", 1400, 900)} alt="" className="page-bg-img"/>
      <div style={{ padding:"32px 36px 0" }}>
        <div className="hero-wrap" style={{ height:220 }}>
          <img src={usp("photo-1503095396549-807759245b35", 1100, 280)} alt="Productions" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🎭 Show Planning</div>
            <h1 className="hero-title" style={{ fontSize:44 }}>Productions</h1>
            <p className="hero-sub">Create a folder for each show. Track every costume, prop, and piece of gear from wishlist to opening night.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{ padding:"24px 36px 56px", position:"relative", zIndex:1 }}>
        {/* Toolbar */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:20, alignItems:"center" }}>
          <div className="vtog">
            {["all","planning","active","closed"].map(f => (
              <button key={f} className={filter===f?"on":""} onClick={()=>setFilter(f)}
                style={{ textTransform:"capitalize" }}>{f}</button>
            ))}
          </div>
          <div style={{ marginLeft:"auto" }}>
            <button className="btn btn-g" onClick={()=>{ setActive(null); setModal("new"); }}>
              <span style={{ width:15, height:15, display:"flex" }}>{Ic.plus}</span>
              New Production
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:48, color:"var(--muted)" }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:"center", padding:56 }}>
            <div style={{ fontSize:48, marginBottom:14 }}>🎭</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:8 }}>
              {filter==="all" ? ("No "+getTerm(org?.vertical,"productions")+" Yet") : ("No "+filter+" "+getTerm(org?.vertical,"productions").toLowerCase())}
            </h3>
            <p style={{ color:"var(--muted)", fontSize:13, maxWidth:380, margin:"0 auto 20px", lineHeight:1.6 }}>
              {filter==="all"
                ? "Create a production folder for each show. Save items from your inventory to track exactly what you need."
                : ("No shows in "+filter+" status.")}
            </p>
            {filter==="all" && (
              <button className="btn btn-g" onClick={()=>{ setActive(null); setModal("new"); }}>
                + Create First Production
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:14 }}>
            {visible.map(prod => {
              const total     = prod.production_items?.length || 0;
              const confirmed = prod.production_items?.filter(pi =>
                pi.status==="confirmed"||pi.status==="returned").length || 0;
              const pct = total > 0 ? Math.round(confirmed/total*100) : 0;
              const daysUntil = prod.opening_date
                ? Math.ceil((new Date(prod.opening_date) - new Date()) / 86400000)
                : null;
              return (
                <div key={prod.id} className="card card-p"
                  style={{ cursor:"pointer", borderLeft:`4px solid ${prod.color||"var(--gold)"}` }}
                  onClick={() => { setActive(prod); setModal("detail"); }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:10 }}>
                    <div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700,
                        lineHeight:1.3 }}>{prod.name}</div>
                      {prod.show_title && (
                        <div style={{ fontSize:12, color:"var(--muted)", marginTop:1 }}>{prod.show_title}</div>
                      )}
                    </div>
                    <span style={{ fontSize:10, padding:"3px 8px", borderRadius:8, fontWeight:800,
                      textTransform:"uppercase", letterSpacing:.5, flexShrink:0,
                      background: prod.status==="active" ? "rgba(76,175,80,.15)" :
                                  prod.status==="closed" ? "rgba(255,255,255,.07)" : "rgba(212,168,67,.12)",
                      color: prod.status==="active" ? "var(--green)" :
                             prod.status==="closed" ? "var(--muted)" : "var(--gold)" }}>
                      {prod.status}
                    </span>
                  </div>

                  {/* Progress */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      fontSize:11, color:"var(--muted)", marginBottom:4 }}>
                      <span>{total} item{total!==1?"s":""}</span>
                      <span style={{ fontWeight:700, color:pct===100?"var(--green)":undefined }}>{pct}% confirmed</span>
                    </div>
                    <div style={{ height:5, background:"rgba(255,255,255,.08)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:pct+"%", borderRadius:3,
                        background: pct===100 ? "var(--green)" : prod.color||"var(--gold)",
                        transition:"width .5s" }}/>
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {prod.opening_date && (
                      <span style={{ fontSize:11, color:"var(--muted)" }}>
                        📅 {daysUntil !== null && daysUntil > 0
                          ? ("Opens in "+daysUntil+"d")
                          : new Date(prod.opening_date).toLocaleDateString()}
                      </span>
                    )}
                    {prod.closing_date && (
                      <span style={{ fontSize:11, color:"var(--muted)" }}>
                        → {new Date(prod.closing_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {(modal==="new"||modal==="edit") && (
        <Modal title={modal==="new"?("New "+getTerm(org?.vertical,"production")):("Edit "+getTerm(org?.vertical,"production"))}
          onClose={()=>{ setModal(null); setActive(null); }}>
          <ProductionForm prod={modal==="edit"?active:null} vertical={org?.vertical}
            onSave={saveProd}
            onCancel={()=>{ setModal(null); setActive(null); }}/>
        </Modal>
      )}
      {modal==="detail" && active && (
        <Modal title={getTerm(org?.vertical,"production")+" Details"}
          onClose={()=>{ setModal(null); setActive(null); load(); }}>
          <ProductionDetail
            prod={active}
            allItems={allItems}
            userId={userId}
            org={org}
            onNavigateTo={onNavigateTo}
            onEdit={()=>setModal("edit")}
            onDelete={deleteProd}
            onClose={()=>{ setModal(null); setActive(null); load(); }}
          />
        </Modal>
      )}
    </div>
  );
}
