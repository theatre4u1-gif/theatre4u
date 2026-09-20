import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { CAT } from "./inventory.js";
import { QR } from "./qr.js";
import { APP_NAME, APP_EMAIL } from "./config.js";
import { doorOf } from "../lib/admin-metrics.js";

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

// Plain-paper label sizes (inches). The print engine tiles as many as fit on a US Letter
// page at the chosen size, so a small size fills the page and a big size prints one or a few.
const PAPER_SIZES = [
  { id:"2x2",   label:'Small square · 2" × 2" (most per page)', w:2,   h:2   },
  { id:"2x3",   label:'Tag · 2" × 3"',                          w:2,   h:3   },
  { id:"25x35", label:'Card · 2.5" × 3.5"',                     w:2.5, h:3.5 },
  { id:"3x3",   label:'Medium square · 3" × 3"',                w:3,   h:3   },
  { id:"3x4",   label:'Large · 3" × 4"',                        w:3,   h:4   },
  { id:"4x6",   label:'Photo · 4" × 6"',                        w:4,   h:6   },
  { id:"85x10", label:'Full page · 8" × 10" (one per page)',    w:8,   h:10  },
  { id:"custom",label:'Custom size…',                           w:0,   h:0   },
];

// Avery label sheets (US Letter 8.5 x 11). Dimensions in inches. Left margin is derived by
// centering the grid horizontally (Avery sheets are symmetric), which keeps these robust.
// cols/rows = grid; lw/lh = one label; gx/gy = gaps between labels; mt = top margin.
const AVERY = {
  "5160":  { name:"Avery 5160 / 5260 — 30 per sheet (2.625\" x 1\")", cols:3, rows:10, lw:2.625, lh:1.0,  gx:0.125,  gy:0,   mt:0.5 },
  "22806": { name:"Avery 22806 square — 12 per sheet (2\" x 2\")", cols:3, rows:4,  lw:2.0,   lh:2.0,  gx:0.5,    gy:0.5, mt:0.5 },
  "5164":  { name:"Avery 5164 / 6464 / 8464 — 6 per sheet (4\" x 3.33\")", cols:2, rows:3,  lw:4.0,   lh:3.33, gx:0.1875, gy:0,   mt:0.5 },
};



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
  const [averyType, setAveryType] = useState("5160");
  const [avNudgeX, setAvNudgeX]   = useState(0); // mm, correct printer drift left/right
  const [avNudgeY, setAvNudgeY]   = useState(0); // mm, correct printer drift up/down
  const [withPhoto, setWithPhoto] = useState(false);
  const [paperSize, setPaperSize] = useState(2); // index into PAPER_SIZES (default: Card 2.5" x 3.5")
  const [customW, setCustomW]     = useState(2); // custom label width, inches
  const [customH, setCustomH]     = useState(2); // custom label height, inches
  const [fitMode, setFitMode]     = useState("cover"); // cover = crop to fill, contain = show whole photo
  const [mode, setMode]           = useState("items");   // "items" | "locations" — what are you labeling
  const [printLane, setPrintLane] = useState("avery");   // "avery" | "plain" | "ptouch" | "order" — how will you print
  const [myLocations, setMyLocations] = useState([]);

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
        .select("id,name,category,location,location_id,display_id,added,condition,qty,img,size")
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

      // Load storage boxes and locations so they print from the same engine as items
      const {data:locs} = await SB.from("storage_locations")
        .select("id,name,code,description,location_type,vertical")
        .eq("org_id",userId).order("name");
      setMyLocations(locs||[]);

      // Deep link from the Locations screen: open straight into locations mode, on the
      // recommended big-square Avery size, with the clicked location preselected.
      try {
        const init = (typeof window!=="undefined") && window.__t4u_labels_init;
        if (init && init.mode==="locations") {
          setTab("print"); setMode("locations"); setAveryType("22806"); setPrintLane("avery");
          if (init.selectId && (locs||[]).some(l=>l.id===init.selectId)) setSelected([init.selectId]);
          delete window.__t4u_labels_init;
        }
      } catch(e) {}

      const {data:ords} = await SB.from("label_orders")
        .select("id,item_count,assigned_count,blank_count,costume_count,equipment_count,label_type,status,created_at,tracking,code_start,code_end,amount_cents,include_logo,vendor,vendor_order_ref,notes,reorder_of")
        .eq("org_id",userId).order("created_at",{ascending:false});
      setOrders(ords||[]);
      setLoadingItems(false);
    })();
  },[userId]);

  // ── PRINT TAB ────────────────────────────────────────────────────────────
  // The Print tab labels two kinds of thing through one engine: inventory items and
  // storage boxes/locations. Both are normalized into a common shape so every print
  // path (plain paper, Avery, P-touch, CSV) works the same for either.
  const host = doorOf(org) === "artstracker" ? "artstracker.org" : "theatre4u.org";
  const locCount = (locId) => myItems.filter(i=>i.location_id===locId).length;

  const normItem = (i) => {
    const cat = CAT[i.category]||CAT.other;
    return { id:i.id, kind:"item", qrPath:"/#/item/"+i.id, title:i.name,
      catLabel:cat.label, icon:cat.icon, color:cat.color||"#888",
      loc:i.location||"", code:i.display_id||i.id.slice(0,8).toUpperCase(),
      img:i.img||"", size:i.size,
      search:(i.name+" "+(i.location||"")+" "+(i.display_id||"")).toLowerCase() };
  };
  const normLoc = (l) => {
    const icon = l.location_type==="room"?"🗺️":l.location_type==="rack"?"🏗️":"📦";
    const type = l.location_type==="room"?"Room":l.location_type==="rack"?"Rack":"Storage location";
    return { id:l.id, kind:"location", qrPath:"/#/location/"+l.id, title:l.name,
      catLabel:type, icon, color:"#c4761a", loc:l.description||"", code:l.code||"",
      img:"", count:locCount(l.id),
      search:(l.name+" "+(l.code||"")+" "+(l.description||"")).toLowerCase() };
  };

  const allEntries = mode==="items" ? myItems.map(normItem) : myLocations.map(normLoc);
  const filtered = allEntries.filter(e => !search || e.search.includes(search.toLowerCase()));
  const selectedEntries = () => allEntries.filter(e=>selected.includes(e.id));
  const toggleSel = id => setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const selAll    = () => setSelected(filtered.map(e=>e.id));
  const clearSel  = () => setSelected([]);

  // Switch what we are labeling; reset the selection and pick the Avery size that
  // suits it (small 30-up for items, big square for boxes and locations).
  const chooseMode = (m) => {
    if(m===mode) return;
    setMode(m); setSelected([]); setSearch("");
    setAveryType(m==="locations" ? "22806" : "5160");
  };
  const sub = (e) => e.kind==="location"
    ? e.catLabel + (e.count!=null ? " · "+e.count+" item"+(e.count!==1?"s":"") : "")
    : e.catLabel + (e.loc ? " · "+e.loc : "");

  // Export a CSV for Brother P-touch Editor. Columns follow the merge template. Uses the
  // selected rows, or all filtered if none. Adapts to items or locations.
  const exportPtouchCsv = () => {
    const rows = selected.length ? allEntries.filter(e=>selected.includes(e.id)) : filtered;
    if(!rows.length) return;
    const esc = v => '"'+String(v==null?"":v).replace(/"/g,'""')+'"';
    const header = mode==="items"
      ? ["Label_ID","Item_Name","Size","Location","QR_URL","Label_Type"]
      : ["Label_ID","Location_Name","Item_Count","Description","QR_URL","Label_Type"];
    const lines = [header.join(",")];
    rows.forEach(e=>{
      const url = "https://"+host+e.qrPath;
      if(mode==="items"){
        lines.push([ esc(e.code), esc(e.title), esc(e.size && e.size!=="N/A" ? e.size : ""),
          esc(e.loc), esc(url), esc(e.catLabel) ].join(","));
      } else {
        lines.push([ esc(e.code||e.title), esc(e.title), esc(e.count),
          esc(e.loc), esc(url), esc(e.catLabel) ].join(","));
      }
    });
    const csv = "﻿" + lines.join("\r\n"); // BOM + CRLF so P-touch Editor / Excel read it cleanly
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a = document.createElement("a");
    a.href = url;
    a.download = (org?.label_prefix || "labels") + "-" + mode + "-ptouch-" + new Date().toISOString().slice(0,10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print onto plain paper at a size the user chooses. Tiles as many labels as fit on a US
  // Letter page at that size (so a small size fills the page, a big size prints one or a few),
  // with page breaks between full pages. Fonts and the QR scale to the label size.
  const printPaper = async () => {
    const toPrint = selectedEntries();
    if(!toPrint.length) return;
    setPrinting(true);
    try {
      const ps = PAPER_SIZES[paperSize] || PAPER_SIZES[0];
      let W = ps.id==="custom" ? (parseFloat(customW)||2) : ps.w;
      let H = ps.id==="custom" ? (parseFloat(customH)||2) : ps.h;
      W = Math.max(1, Math.min(8,   W));   // keep within a Letter page (0.5in margins)
      H = Math.max(1, Math.min(10,  H));
      const margin = 0.5, gap = 0.12;
      const cols = Math.max(1, Math.floor((8.5 - 2*margin + gap) / (W + gap)));
      const rows = Math.max(1, Math.floor((11  - 2*margin + gap) / (H + gap)));
      const cw = W*96, ch = H*96, m = Math.min(cw, ch);
      // Point the QR at the program's own door (music/dance/art/booster => ArtsTracker;
      // theatre follows its signup domain). Both doors resolve /#/item/ and /#/location/ the same way.
      const srcs = await Promise.all(toPrint.map(e=> QR.toDataURL("https://"+host+e.qrPath, 400)));
      const esc = (s)=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
      // Sizes scale with the label but stay within sane bounds.
      const fName = Math.max(10, Math.min(48, Math.round(cw*0.062)));
      const fCat  = Math.max(7,  Math.min(22, Math.round(cw*0.032)));
      const fId   = Math.max(9,  Math.min(30, Math.round(cw*0.045)));
      const pad   = Math.max(6,  Math.round(cw*0.04));
      const qrPlain = Math.min(360, Math.round(m*0.5));   // big centered QR when no photo
      const qrFoot  = Math.min(220, Math.round(cw*0.26)); // corner QR when photo is on
      const ph      = Math.round(ch*0.5);                 // photo band height
      const labels = toPrint.map((e,n)=>{
        const eName = esc(e.title), eId = esc(e.code), eImg = esc(e.img), eCat = esc(e.catLabel);
        const subTxt = e.kind==="location"
          ? (e.count!=null ? `${e.count} item${e.count!==1?"s":""}` : "")
          : (e.loc ? "📍 "+esc(e.loc) : "");
        if(withPhoto){
          const photo = e.img
            ? `<img src="${eImg}" class="pc-img"/>`
            : `<div class="pc-noimg">${e.icon}</div>`;
          return `<div class="cell"><div class="pcard">
            ${photo}
            <div class="pc-body">
              <div class="pc-cat" style="color:${e.color}">${e.icon} ${eCat}</div>
              <div class="pc-name">${eName}</div>
              ${subTxt?`<div class="pc-sub">${subTxt}</div>`:""}
              <div class="pc-foot">
                <div class="pc-id">${eId}</div>
                ${srcs[n]?`<img src="${srcs[n]}" class="pc-qr"/>`:""}
              </div>
            </div>
          </div></div>`;
        }
        return `<div class="cell"><div class="lbl">
          <div class="lbl-cat" style="color:${e.color}">${e.icon} ${eCat}</div>
          <div class="lbl-name">${eName}</div>
          ${subTxt?`<div class="lbl-sub">${subTxt}</div>`:""}
          ${srcs[n]?`<img src="${srcs[n]}" class="lbl-qr"/>`:""}
          <div class="lbl-id">${eId}</div>
        </div></div>`;
      }).join("");
      const w = window.open("","_blank","width=900,height=700");
      if(!w){setPrinting(false);return;}
      w.document.write(`<!DOCTYPE html><html><head><title>Labels — ${org?.name||APP_NAME}</title>
      <style>
        @page{ size:letter; margin:0; }
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#fff}
        body{font-family:Arial,Helvetica,sans-serif;color:#000}
        .controls{text-align:center;padding:10px;font-size:13px;background:#faf7ef;border-bottom:1px solid #eee}
        .sheet{padding:${margin}in;display:grid;grid-template-columns:repeat(${cols}, ${W}in);column-gap:${gap}in;row-gap:${gap}in;justify-content:center;align-content:start}
        .cell{width:${W}in;height:${H}in;page-break-inside:avoid;break-inside:avoid}
        .lbl{width:100%;height:100%;border:1px dashed #bbb;border-radius:6px;padding:${pad}px;
          display:flex;flex-direction:column;align-items:center;text-align:center;gap:${Math.round(pad*0.4)}px;background:#fff;overflow:hidden}
        .lbl-cat{font-size:${fCat}px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;align-self:flex-start}
        .lbl-name{font-size:${fName}px;font-weight:700;color:#111;line-height:1.15;word-break:break-word}
        .lbl-sub{font-size:${fCat}px;color:#555}
        .lbl-qr{width:${qrPlain}px;height:${qrPlain}px;max-width:90%;max-height:60%;margin-top:auto}
        .lbl-id{font-size:${fId}px;font-weight:800;color:#c4761a;font-family:monospace;letter-spacing:.5px;margin-top:${Math.round(pad*0.4)}px}
        .pcard{width:100%;height:100%;border:1px dashed #bbb;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;background:#fff}
        .pc-img{width:100%;height:${ph}px;object-fit:${fitMode};display:block;background:#f2f2f2}
        .pc-noimg{width:100%;height:${ph}px;display:flex;align-items:center;justify-content:center;font-size:${Math.round(ph*0.34)}px;background:#f2f2f2}
        .pc-body{padding:${pad}px;display:flex;flex-direction:column;gap:${Math.round(pad*0.3)}px;flex:1;min-height:0}
        .pc-cat{font-size:${fCat}px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
        .pc-name{font-size:${fName}px;font-weight:700;color:#111;line-height:1.15;flex:1;overflow:hidden;word-break:break-word}
        .pc-sub{font-size:${fCat}px;color:#555}
        .pc-foot{display:flex;align-items:flex-end;justify-content:space-between;margin-top:auto;gap:6px}
        .pc-id{font-size:${fId}px;font-weight:800;color:#c4761a;font-family:monospace;letter-spacing:.5px}
        .pc-qr{width:${qrFoot}px;height:${qrFoot}px;flex-shrink:0}
        @media print{.controls{display:none}}
      </style></head><body>
      <div class="controls">
        <strong>${org?.name||APP_NAME}</strong> — ${toPrint.length} label${toPrint.length!==1?"s":""} · ${W}" × ${H}" · ${cols*rows} per page
        <button onclick="window.print()" style="margin-left:16px;padding:5px 14px;background:#d4a843;border:none;border-radius:5px;font-weight:700;cursor:pointer">🖨 Print</button>
        <button onclick="window.close()" style="margin-left:6px;padding:5px 14px;border:1px solid #ccc;border-radius:5px;cursor:pointer">Close</button>
        <span style="margin-left:12px;color:#888;font-size:12px">In the print dialog, set Scale to 100% (not "Fit"), and turn off headers and footers.</span>
      </div>
      <div class="sheet">${labels}</div>
      <script>setTimeout(function(){window.print()},600)<\/script>
      </body></html>`);
      w.document.close();
    } finally { setPrinting(false); }
  };

  // Print onto an Avery label sheet (US Letter). Lays each label into the chosen product's exact
  // grid so it lines up with the pre-cut sheet. The nudge (mm) shifts everything to correct a
  // printer that drifts; users should run one test sheet first.
  const printAvery = async () => {
    const toPrint = selectedEntries();
    if(!toPrint.length) return;
    setPrinting(true);
    try {
      const p = AVERY[averyType] || AVERY["5160"];
      const srcs = await Promise.all(toPrint.map(e=>QR.toDataURL("https://"+host+e.qrPath, 300)));
      const esc = (s)=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
      const ml = (8.5 - (p.cols*p.lw + (p.cols-1)*p.gx)) / 2;        // centered left margin
      const qrSize = Math.max(0.6, Math.min(p.lw, p.lh) - 0.22);    // QR square in inches
      const perPage = p.cols * p.rows;
      let pages = "";
      for (let start=0; start<toPrint.length; start+=perPage) {
        const cells = toPrint.slice(start, start+perPage).map((e,k)=>{
          const n = start+k;
          const eName = esc(e.title), eId = esc(e.code);
          const subTxt = e.kind==="location"
            ? (e.count!=null ? `${e.count} item${e.count!==1?"s":""}` : "")
            : esc(e.loc);
          return `<div class="av-cell">
            ${srcs[n]?`<img class="av-qr" src="${srcs[n]}"/>`:""}
            <div class="av-txt"><div class="av-name">${eName}</div>${subTxt?`<div class="av-loc">${subTxt}</div>`:""}<div class="av-id">${eId}</div></div>
          </div>`;
        }).join("");
        pages += `<div class="av-page"><div class="av-grid">${cells}</div></div>`;
      }
      const html = `<!DOCTYPE html><html><head><title>Avery ${averyType} — ${org?.name||APP_NAME}</title>
      <style>
        @page{ size:letter; margin:0; }
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#fff}
        body{font-family:Arial,Helvetica,sans-serif;color:#000}
        .av-page{width:8.5in;height:11in;padding:${p.mt}in 0 0 ${ml}in;page-break-after:always;overflow:hidden;position:relative;left:${avNudgeX||0}mm;top:${avNudgeY||0}mm}
        .av-page:last-child{page-break-after:auto}
        .av-grid{display:grid;grid-template-columns:repeat(${p.cols}, ${p.lw}in);column-gap:${p.gx}in;row-gap:${p.gy}in}
        .av-cell{width:${p.lw}in;height:${p.lh}in;display:flex;align-items:center;gap:.08in;padding:.06in;overflow:hidden}
        .av-qr{width:${qrSize}in;height:${qrSize}in;flex-shrink:0}
        .av-txt{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:.02in}
        .av-name{font-size:8.5pt;font-weight:700;line-height:1.05;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
        .av-loc{font-size:6.5pt;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .av-id{font-size:7pt;font-weight:800;font-family:monospace;letter-spacing:.3px}
      </style></head><body>${pages}</body></html>`;
      const ifr = document.createElement("iframe");
      ifr.setAttribute("aria-hidden","true");
      ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(ifr);
      const idoc = ifr.contentWindow.document;
      idoc.open(); idoc.write(html); idoc.close();
      let fired = false;
      const fire = () => {
        if (fired) return; fired = true;
        try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch(e){}
        setTimeout(()=>{ try{ document.body.removeChild(ifr); }catch(e){} }, 60000);
      };
      ifr.onload = () => setTimeout(fire, 300);
      setTimeout(fire, 1000);
    } finally { setPrinting(false); }
  };

  // Run the action for whichever lane is active. P-touch is CSV-only (into the Brother app),
  // since direct browser printing to the Cube is unreliable.
  const doPrint = () => {
    if(printLane==="avery")  return printAvery();
    if(printLane==="ptouch") return exportPtouchCsv();
    return printPaper(); // plain paper, at the chosen size
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
  // Print-tab helpers (two-step chooser)
  const LANES = [
    { id:"avery",  ico:"🗒", t:"Label sheets (Avery)",          d:"Peel and stick on any printer. Cheapest and easiest.", rec:true },
    { id:"plain",  ico:"🖨", t:"Plain paper (any size)",         d:"Pick a size, print, cut out, and tape on. No supplies." },
    { id:"ptouch", ico:"🏷", t:"Label printer (Brother P-touch)", d:"Download a CSV and print from the Brother app." },
    { id:"order",  ico:"📬", t:"Order pre-printed",              d:"We mail durable labels. Stick now, assign later." },
  ];
  const printBtnLabel = printLane==="avery" ? "🗒 Print on Avery" : printLane==="ptouch" ? "⬇ Download CSV for Brother app" : "🖨 Print";
  const stepLabel = { fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:8 };
  const miniLbl   = { fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.6,color:"var(--faint)" };
  const nudgeInp  = { width:48,padding:"4px 6px",borderRadius:6,border:"1px solid var(--border)",background:"var(--white)",color:"var(--text)",fontFamily:"inherit",fontSize:12 };
  const selInp    = { padding:"7px 10px",borderRadius:7,border:"1px solid var(--border)",background:"var(--white)",color:"var(--text)",fontSize:12,cursor:"pointer",fontFamily:"inherit" };
  const ghostBtn  = { padding:"7px 13px",borderRadius:7,border:"1px solid var(--border)",background:"transparent",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit" };

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
        {[["print","🖨 Print Labels"],["assign","🔗 Assign a Label"],["gear","🛒 Label Gear"],["order","📬 Orders"]].filter(([id])=>id!=="order"||isAdmin).map(([id,lbl])=>(
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
          <p style={{fontSize:13,color:"var(--muted)",marginBottom:18}}>
            Two quick choices and you are printing. Pick what you are labeling, pick how you want to print,
            then select the rows and hit Print. Every label carries a QR code that any phone camera scans
            (no app) to pull up that item or location instantly.
          </p>

          {/* Step 1 — What are you labeling? */}
          <div style={{marginBottom:18}}>
            <div style={stepLabel}>Step 1 · What are you labeling?</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[["items","📦","Inventory items"],["locations","🗺","Storage boxes & locations"]].map(([id,ico,lbl])=>{
                const on = mode===id;
                return (
                  <button key={id} onClick={()=>chooseMode(id)}
                    style={{padding:"9px 16px",borderRadius:9,border:"1.5px solid",
                      borderColor:on?"var(--gold)":"var(--border)",background:on?"rgba(212,168,67,.12)":"transparent",
                      color:on?"var(--goldink)":"var(--muted)",fontSize:13,fontWeight:on?700:500,cursor:"pointer",fontFamily:"inherit"}}>
                    {ico} {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 — How will you print? */}
          <div style={{marginBottom:16}}>
            <div style={stepLabel}>Step 2 · How will you print?</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
              {LANES.map(L=>{
                const on = printLane===L.id;
                return (
                  <button key={L.id} onClick={()=>setPrintLane(L.id)}
                    style={{textAlign:"left",padding:"12px 14px",borderRadius:10,border:"1.5px solid",
                      borderColor:on?"var(--gold)":"var(--border)",background:on?"rgba(212,168,67,.1)":"var(--parch)",
                      cursor:"pointer",fontFamily:"inherit",position:"relative"}}>
                    {L.rec&&<span style={{position:"absolute",top:10,right:10,fontSize:9,fontWeight:800,
                      textTransform:"uppercase",letterSpacing:.5,color:"#1a0f00",background:"var(--gold)",padding:"2px 6px",borderRadius:5}}>Recommended</span>}
                    <div style={{fontSize:14,fontWeight:700,marginBottom:3,color:on?"var(--goldink)":"var(--text)"}}>{L.ico} {L.t}</div>
                    <div style={{fontSize:11.5,color:"var(--muted)",lineHeight:1.5}}>{L.d}</div>
                  </button>
                );
              })}
            </div>
            <div style={{fontSize:11.5,color:"var(--faint)",marginTop:8}}>
              Not sure? Avery label sheets are the easiest and cheapest for most programs.
            </div>
          </div>

          {/* Lane options */}
          {printLane==="avery"&&(
            <div style={{...card,padding:"12px 14px",marginBottom:14,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                <span style={miniLbl}>Avery product (on your box)</span>
                <select value={averyType} onChange={e=>setAveryType(e.target.value)} style={selInp}>
                  {Object.entries(AVERY).map(([k,v])=><option key={k} value={k}>{v.name}</option>)}
                </select>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                <span style={miniLbl}>Alignment nudge</span>
                <span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"var(--muted)"}}>
                  <input type="number" step="0.5" value={avNudgeX} onChange={e=>setAvNudgeX(parseFloat(e.target.value)||0)} aria-label="Nudge right (mm)" style={nudgeInp}/> right
                  <input type="number" step="0.5" value={avNudgeY} onChange={e=>setAvNudgeY(parseFloat(e.target.value)||0)} aria-label="Nudge down (mm)" style={nudgeInp}/> down (mm)
                </span>
              </div>
              <div style={{fontSize:11,color:"var(--faint)",flex:1,minWidth:180,lineHeight:1.5}}>
                Print one test sheet on plain paper first, hold it over the Avery sheet, then nudge if it drifts. Set Scale to 100% and turn off headers and footers.
              </div>
            </div>
          )}
          {printLane==="plain"&&(
            <div style={{...card,padding:"12px 14px",marginBottom:14,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                <span style={miniLbl}>Label size</span>
                <select value={paperSize} onChange={e=>setPaperSize(Number(e.target.value))} style={selInp}>
                  {PAPER_SIZES.map((s,i)=><option key={s.id} value={i}>{s.label}</option>)}
                </select>
              </div>
              {PAPER_SIZES[paperSize] && PAPER_SIZES[paperSize].id==="custom" && (
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <span style={miniLbl}>Width × height (inches)</span>
                  <span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"var(--muted)"}}>
                    <input type="number" step="0.25" min="1" max="8"  value={customW} onChange={e=>setCustomW(parseFloat(e.target.value)||0)} aria-label="Label width (inches)"  style={nudgeInp}/> ×
                    <input type="number" step="0.25" min="1" max="10" value={customH} onChange={e=>setCustomH(parseFloat(e.target.value)||0)} aria-label="Label height (inches)" style={nudgeInp}/> in
                  </span>
                </div>
              )}
              <button onClick={()=>setWithPhoto(v=>!v)} title="Include a picture at the top of each label"
                style={{padding:"7px 13px",borderRadius:7,border:"1px solid",borderColor:withPhoto?"var(--gold)":"var(--border)",
                  background:withPhoto?"rgba(212,168,67,.12)":"transparent",color:withPhoto?"var(--goldink)":"var(--muted)",
                  fontSize:12,fontWeight:withPhoto?700:500,cursor:"pointer",fontFamily:"inherit",alignSelf:"flex-end"}}>
                🖼 Photo: {withPhoto?"On":"Off"}
              </button>
              {withPhoto&&(<select value={fitMode} onChange={e=>setFitMode(e.target.value)} style={{...selInp,alignSelf:"flex-end"}}>
                <option value="cover">Crop to fill</option><option value="contain">Show whole photo</option></select>)}
              <div style={{fontSize:11,color:"var(--faint)",flex:1,minWidth:180,lineHeight:1.5}}>
                Prints on any printer and fits as many as it can per page at this size. Cut out and tape on. Pick a big size like 8" × 10" for a single sign, or a small one to get the most per page.
              </div>
            </div>
          )}
          {printLane==="ptouch"&&(
            <div style={{...card,padding:"12px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>Brother P-touch (24mm tape) — print through the Brother P-touch Editor app.</span>
              <button onClick={exportPtouchCsv} disabled={filtered.length===0}
                title="Download a CSV of ALL rows in the current list (ignores selection) for Brother P-touch Editor."
                style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--border)",fontFamily:"inherit",fontSize:12,fontWeight:700,
                  cursor:filtered.length?"pointer":"not-allowed",background:"transparent",color:"var(--goldink)"}}>
                ⬇ Download CSV of all ({filtered.length})
              </button>
              <button onClick={()=>setTab("gear")}
                style={{background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,color:"var(--goldink)",textDecoration:"underline"}}>
                See the step-by-step how-to →
              </button>
              <div style={{fontSize:11,color:"var(--faint)",flex:1,minWidth:220,lineHeight:1.5}}>
                Download the CSV, open your label template in Brother P-touch Editor on a computer, connect the CSV as the data source, and print to the Cube. The button on the right downloads just your selected rows; this one downloads the whole list.
              </div>
            </div>
          )}
          {printLane==="order"&&(
            <div style={{...card,padding:"16px 18px",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>📬 Order pre-printed labels</div>
              <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.7,marginBottom:12}}>
                For durable weatherproof labels with no printing on your end. They arrive pre-coded, so you can stick them on bins now and link each code to an item or location later in the Assign tab.
              </div>
              <button onClick={()=>setTab("gear")}
                style={{padding:"9px 18px",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",background:"var(--gold)",color:"#1a0f00"}}>
                See label options →
              </button>
            </div>
          )}

          {/* Search + select + print (the order lane has nothing to select) */}
          {printLane!=="order"&&(<>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder={mode==="items"?"Search items, locations, codes…":"Search boxes and locations…"}
                style={{flex:1,minWidth:200,...inputStyle,width:"auto"}}/>
              <button onClick={selAll} style={ghostBtn}>Select All ({filtered.length})</button>
              <button onClick={clearSel} style={ghostBtn}>Clear</button>
              <button onClick={doPrint} disabled={selected.length===0||printing}
                style={{padding:"8px 20px",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:13,fontWeight:700,
                  cursor:selected.length&&!printing?"pointer":"not-allowed",
                  background:selected.length&&!printing?"var(--gold)":"var(--border)",
                  color:selected.length&&!printing?"#1a0f00":"var(--muted)"}}>
                {printing?"Generating…":selected.length?(printBtnLabel+" ("+selected.length+")"):("Select "+(mode==="items"?"items":"locations")+" to print")}
              </button>
            </div>

            {loadingItems?(
              <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>Loading…</div>
            ):(
              <div style={{...card,overflow:"hidden",marginBottom:10}}>
                {filtered.length===0?(
                  <div style={{padding:32,textAlign:"center",color:"var(--muted)",fontSize:13}}>
                    {mode==="items"
                      ?(myItems.length===0?"Add items to your inventory first — then print labels here.":"No items match your search.")
                      :(myLocations.length===0?"Add storage boxes and locations in the Locations tab first — then print their labels here.":"No locations match your search.")}
                  </div>
                ):(
                  filtered.map(e=>{
                    const isSel = selected.includes(e.id);
                    return(
                      <div key={e.id} onClick={()=>toggleSel(e.id)}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"9px 14px",
                          borderBottom:"1px solid var(--border)",cursor:"pointer",
                          background:isSel?"rgba(212,168,67,.07)":"transparent",transition:"background .1s"}}>
                        <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid",
                          borderColor:isSel?"var(--gold)":"var(--border)",
                          background:isSel?"var(--gold)":"transparent",flexShrink:0,
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {isSel&&<span style={{color:"#1a0f00",fontSize:12,fontWeight:900}}>✓</span>}
                        </div>
                        <span style={{fontSize:16,flexShrink:0}}>{e.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {e.title}
                          </div>
                          <div style={{fontSize:11,color:"var(--muted)"}}>{sub(e)}</div>
                        </div>
                        {e.code&&(
                          <span style={{fontSize:11,fontFamily:"monospace",fontWeight:700,
                            color:"var(--amber)",background:"rgba(196,118,26,.1)",
                            padding:"2px 7px",borderRadius:4,flexShrink:0}}>
                            {e.code}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            <div style={{fontSize:12,color:"var(--muted)"}}>
              {selected.length} of {mode==="items"?myItems.length:myLocations.length} {mode==="items"?"item":"location"}{(mode==="items"?myItems.length:myLocations.length)!==1?"s":""} selected
            </div>
          </>)}
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

      {/* ══ LABEL GEAR TAB ══ */}
      {tab==="gear"&&(
        <div style={{maxWidth:640}}>
          <p style={{fontSize:14,color:"var(--muted)",lineHeight:1.8,marginBottom:18}}>
            Any printer works with the <strong style={{color:"var(--text)"}}>Print Labels</strong> tab
            and Avery-style sticker sheets. For labels that survive years of backstage handling,
            these are the printers we recommend:
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:18}}>
            {[
              ["🏷️","Brother QL-810W","Cheap, fast bulk labels for bins and shelves. Paper rolls run about 3\u00A2 per label (400-label roll \u2248 $14).","https://www.amazon.com/dp/B01MTWGMRR?tag=artstracker-20","Printer on Amazon","https://www.amazon.com/dp/B0002VS6HG?tag=artstracker-20","DK-1201 label rolls"],
              ["🔧","Brother P-touch CUBE Plus (PT-P710BT)","Prints durable laminated tape for props, cases, and anything handled every week. Connects to a computer by USB (Bluetooth is for the phone app).","https://www.amazon.com/dp/B07HB8LNSY?tag=artstracker-20","Printer on Amazon",null,null],
              ["📦","TZe-251 tape, 24mm black on white (everyday, best overall)","The size the label template uses. Best for props, storage tubs, toolboxes, shelving, and lighting and sound equipment.","https://www.amazon.com/s?k=Brother+TZe-251+24mm&tag=artstracker-20","Tape on Amazon",null,null],
              ["💪","TZe-S241 tape, 24mm extra strength adhesive","Stronger stick for rough or textured surfaces: Rubbermaid bins, Pelican and road cases, and painted scenery carts.","https://www.amazon.com/s?k=Brother+TZe-S241&tag=artstracker-20","Tape on Amazon",null,null],
            ].map(([icon,name,desc,url,cta,url2,cta2],i)=>(
              <div key={i} style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,padding:"16px 18px",display:"flex",gap:14,alignItems:"flex-start"}}>
                <div style={{fontSize:26,lineHeight:1}}>{icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{name}</div>
                  <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.7,marginBottom:10}}>{desc}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <a href={url} target="_blank" rel="noreferrer sponsored"
                      style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:7,background:"var(--gold)",color:"#1a0f00",textDecoration:"none"}}>
                      {cta} →
                    </a>
                    {url2&&(
                      <a href={url2} target="_blank" rel="noreferrer sponsored"
                        style={{fontSize:12,fontWeight:600,padding:"6px 14px",borderRadius:7,border:"1px solid var(--border)",color:"var(--text)",textDecoration:"none"}}>
                        {cta2} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12.5,color:"var(--muted)",lineHeight:1.7,marginBottom:16}}>
            <strong style={{color:"var(--text)"}}>Outfitting a whole department?</strong> A solid starter set: 10x TZe-251 (everyday) and 4x TZe-S241 (extra strength).
          </div>
          <div style={{background:"var(--parch)",border:"1px solid var(--border)",borderRadius:12,padding:"16px 18px",marginBottom:18}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>🔧 How to print on the P-touch Cube Plus (PT-P710BT)</div>
            <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.7,marginBottom:12}}>
              The P-touch Cube prints on 24mm tape using Brother's free <strong style={{color:"var(--text)"}}>P-touch Editor</strong> on a Mac or Windows computer (the phone app can't merge a list of items). One-time setup, then a quick routine each batch:
            </div>
            <div style={{fontWeight:700,fontSize:12.5,color:"var(--text)",marginBottom:4}}>First time only</div>
            <ol style={{margin:"0 0 12px 20px",padding:0,fontSize:13,color:"var(--muted)",lineHeight:1.8}}>
              <li>Install <strong style={{color:"var(--text)"}}>P-touch Editor</strong> and the PT-P710BT driver from Brother's website (search "Brother PT-P710BT downloads").</li>
              <li>Load a 24mm TZe tape cassette and connect the printer to your computer with the USB cable.</li>
            </ol>
            <div style={{fontWeight:700,fontSize:12.5,color:"var(--text)",marginBottom:4}}>Each time you print a batch</div>
            <ol style={{margin:"0 0 0 20px",padding:0,fontSize:13,color:"var(--muted)",lineHeight:1.8}}>
              <li>In the <strong style={{color:"var(--text)"}}>Print Labels</strong> tab, select your items and click <strong style={{color:"var(--text)"}}>Export for P-touch</strong>. A CSV downloads to your computer.</li>
              <li>Open your label template (the .lbx file) in P-touch Editor.</li>
              <li>Connect the CSV: <strong style={{color:"var(--text)"}}>File → Database → Connect</strong>, choose the CSV, and confirm "first row contains field names." The fields (Label_ID, Item_Name, Size, Location, QR_URL) line up automatically.</li>
              <li><strong style={{color:"var(--text)"}}>To print every label:</strong> in the database list at the bottom, click the first row and Shift-click the last row so all rows are highlighted (or Cmd+A). Then <strong style={{color:"var(--text)"}}>File → Print</strong>, choose <strong style={{color:"var(--text)"}}>Brother PT-P710BT</strong>, turn on Auto Cut, and Print. (Keep Copies = 1; Copies makes duplicates, not one per item. If it still prints one, open Detailed Settings and set the range to All records.)</li>
            </ol>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
            <button onClick={()=>setTab("print")}
              style={{padding:"10px 20px",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",background:"var(--gold)",color:"#1a0f00"}}>
              🖨 Print Labels Now
            </button>
            <a href="/help.html#qr" target="_blank" rel="noreferrer"
              style={{fontSize:13,fontWeight:600,color:"var(--goldink)",textDecoration:"none"}}>
              Full printing guide in Help →
            </a>
          </div>
          <div style={{fontSize:11,color:"var(--faint)",lineHeight:1.6}}>
            As an Amazon Associate, we earn from qualifying purchases.
          </div>
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
