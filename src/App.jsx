import { useState, useEffect, useMemo, useRef, useCallback } from "react";

const DB = {
  async load(key, fb) {
    try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fb; } catch { return fb; }
  },
  async save(key, data) {
    try { await window.storage.set(key, JSON.stringify(data)); } catch {}
  },
};
const uid  = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const fmt$ = n  => "$" + Number(n || 0).toFixed(2);
const usp  = (id, w=900, h=500) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=82`;

const BG = {
  dashboard:   "photo-1503095396549-807759245b35",
  inventory:   "photo-1560179707-f14e90ef3623",
  marketplace: "photo-1514525253161-7a46d19cd819",
  reports:     "photo-1504196606672-aef5c9cefc92",
  settings:    "photo-1516450360452-9312f5e86fc7",
};
const CAT_IMG = {
  costumes:"photo-1558618666-fcd25c85cd64", props:"photo-1513364776144-60967b0f800f",
  sets:"photo-1460723237483-7a6dc9d0b212",  lighting:"photo-1514525253161-7a46d19cd819",
  sound:"photo-1598488035139-bdbb2231ce04",  scripts:"photo-1481627834876-b7833e8f5570",
  makeup:"photo-1487412720507-e7ab37603c6f", furniture:"photo-1555041469-a586c61ea9bc",
  fabrics:"photo-1558769132-cb1aea458c5e",   tools:"photo-1504148455328-c376907d081c",
  effects:"photo-1516450360452-9312f5e86fc7",other:"photo-1492684223066-81342ee5ff30",
};
const SHOWCASE = [
  {img:"photo-1558618666-fcd25c85cd64",name:"Victorian Ball Gown",  cat:"costumes", price:"$25/wk", badge:"For Rent"},
  {img:"photo-1558769132-cb1aea458c5e",name:"Grand Stage Drape",    cat:"fabrics",  price:"$60/wk", badge:"For Rent"},
  {img:"photo-1516450360452-9312f5e86fc7",name:"Fog Machine Pro",   cat:"effects",  price:"$20/wk", badge:"For Rent"},
  {img:"photo-1513364776144-60967b0f800f",name:"Period Prop Set",   cat:"props",    price:"$45",    badge:"For Sale"},
  {img:"photo-1514525253161-7a46d19cd819",name:"LED Par Can Array", cat:"lighting", price:"$12/wk", badge:"Rent or Sale"},
  {img:"photo-1598488035139-bdbb2231ce04",name:"Shure Wireless Mic",cat:"sound",    price:"$18/wk", badge:"For Rent"},
];

const CATS = [
  {id:"costumes", label:"Costumes",       icon:"👗",color:"#b5174f"},
  {id:"props",    label:"Props",           icon:"🎭",color:"#6a1b8a"},
  {id:"sets",     label:"Sets & Scenery",  icon:"🏛️",color:"#1554a0"},
  {id:"lighting", label:"Lighting",        icon:"💡",color:"#d35400"},
  {id:"sound",    label:"Sound",           icon:"🔊",color:"#27723a"},
  {id:"scripts",  label:"Scripts & Music", icon:"📜",color:"#b83208"},
  {id:"makeup",   label:"Makeup & Wigs",   icon:"💄",color:"#a0144e"},
  {id:"furniture",label:"Stage Furniture", icon:"🪑",color:"#5d3a1a"},
  {id:"fabrics",  label:"Fabrics & Drapes",icon:"🧵",color:"#5c1a8a"},
  {id:"tools",    label:"Tools",           icon:"🔧",color:"#374549"},
  {id:"effects",  label:"Special Effects", icon:"✨",color:"#00695c"},
  {id:"other",    label:"Other",           icon:"📦",color:"#4a2e1a"},
];
const CAT   = Object.fromEntries(CATS.map(c=>[c.id,c]));
const CONDS = ["New","Excellent","Good","Fair","Poor","For Parts"];
const SIZES = ["XS","S","M","L","XL","XXL","One Size","N/A"];
const AVAIL = ["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"];
const MKT   = ["Not Listed","For Rent","For Sale","Rent or Sale"];

function makeSamples(){
  return [
    {name:"Victorian Ball Gown – Blue",   category:"costumes", condition:"Good",     size:"M",       qty:1, location:"Costume Closet A",notes:"Used in A Christmas Carol 2024",mkt:"For Rent",   rent:25,sale:0, avail:"In Stock",tags:["period","formal"],img:null},
    {name:"Pirate Hat Collection (6 pc)", category:"costumes", condition:"Fair",     size:"One Size",qty:6, location:"Costume Closet B",notes:"Assorted styles",              mkt:"Not Listed", rent:0, sale:0, avail:"In Stock",tags:["adventure"],      img:null},
    {name:"Wireless Mic – Shure SM58",    category:"sound",    condition:"Excellent",size:"N/A",     qty:4, location:"Sound Booth",     notes:"4 channels, wireless",         mkt:"For Rent",   rent:15,sale:0, avail:"In Stock",tags:["audio"],          img:null},
    {name:"LED Par Can RGBW 54×3W",       category:"lighting", condition:"New",      size:"N/A",     qty:12,location:"Lighting Storage",notes:"DMX controllable",             mkt:"Rent or Sale",rent:10,sale:85,avail:"In Stock",tags:["dmx","led"],      img:null},
    {name:"Wooden Throne Chair",          category:"furniture",condition:"Good",     size:"N/A",     qty:1, location:"Scene Shop",      notes:"Gold painted, red velvet",     mkt:"For Rent",   rent:30,sale:0, avail:"In Stock",tags:["royalty"],         img:null},
    {name:"Fog Machine 1000W",            category:"effects",  condition:"Good",     size:"N/A",     qty:2, location:"Effects Cage",    notes:"Includes remote",              mkt:"For Rent",   rent:20,sale:0, avail:"In Stock",tags:["atmosphere"],      img:null},
    {name:"Romeo & Juliet Scripts (30)",  category:"scripts",  condition:"Fair",     size:"N/A",     qty:30,location:"Library",        notes:"Director annotated",            mkt:"For Sale",   rent:0, sale:5, avail:"In Stock",tags:["shakespeare"],     img:null},
    {name:"Forest Backdrop Flat 8×12ft",  category:"sets",     condition:"Good",     size:"N/A",     qty:2, location:"Scene Shop",      notes:"Painted muslin on frame",      mkt:"For Rent",   rent:40,sale:0, avail:"In Stock",tags:["outdoor"],         img:null},
    {name:"Ben Nye Master Makeup Kit",    category:"makeup",   condition:"Good",     size:"N/A",     qty:3, location:"Dressing Room 1", notes:"Full spectrum",                mkt:"Not Listed", rent:0, sale:0, avail:"In Stock",tags:["professional"],    img:null},
    {name:"Foam Rubber Swords (8 pc)",    category:"props",    condition:"Fair",     size:"N/A",     qty:8, location:"Props Table",     notes:"Safe for stage combat",        mkt:"For Sale",   rent:0, sale:12,avail:"In Stock",tags:["combat"],          img:null},
  ].map(i=>({...i,id:uid(),added:new Date().toISOString()}));
}

function resizeImg(file,maxW=560,q=0.78){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement("canvas");
        let w=img.width,h=img.height;
        if(w>maxW){h=Math.round((maxW/w)*h);w=maxW;}
        c.width=w;c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",q));
      };
      img.src=e.target.result;
    };
    r.readAsDataURL(file);
  });
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Lora:ital,wght@0,500;0,600;1,400;1,500&family=Raleway:wght@500;600;700;800&display=swap');
:root{
  --ink:#120600;--deep:#2a0e00;--cog:#8b3a0f;--amber:#c4761a;--gold:#d4a843;--gilt:#f5d870;
  --cream:#fdf6ec;--parch:#f3e6cc;--linen:#e6d3b3;--sand:#ccb890;
  --text:#2a1008;--muted:#7a4e28;--faint:#b09060;--border:#ddc8a0;
  --white:#ffffff;--red:#8b1a2a;--green:#265e2a;--blue:#1a3570;
  --sh1:0 2px 14px rgba(18,6,0,.1);--sh2:0 6px 28px rgba(18,6,0,.17);--sh3:0 14px 52px rgba(18,6,0,.25);
  --r:5px;--rm:12px;--rl:18px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;background:var(--cream);color:var(--text);font-size:15px}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--parch)}::-webkit-scrollbar-thumb{background:var(--sand);border-radius:3px}
body{font-family:'Raleway',sans-serif;-webkit-font-smoothing:antialiased}

.shell{display:flex;height:100vh;overflow:hidden}
.sidebar{width:244px;min-width:244px;display:flex;flex-direction:column;z-index:200;transition:transform .28s cubic-bezier(.4,0,.2,1)}
.sidebar.hidden{transform:translateX(-100%);position:absolute;height:100%}
.sidebar.open{transform:translateX(0);position:absolute;height:100%}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.scroll-area{flex:1;overflow-y:auto}

/* Sidebar */
.sb-root{position:relative;height:100%;display:flex;flex-direction:column;background:var(--ink)}
.sb-photo{position:absolute;inset:0;overflow:hidden}
.sb-photo img{width:100%;height:100%;object-fit:cover;opacity:.14;filter:sepia(.5) brightness(.7)}
.sb-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(175deg,rgba(18,6,0,.5) 0%,rgba(18,6,0,.9) 60%,rgba(18,6,0,.97) 100%)}
.sb-inner{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;overflow-y:auto}
.sb-logo{padding:28px 20px 20px;border-bottom:1px solid rgba(212,168,67,.15)}
.sb-glyph{font-size:36px;display:block;margin-bottom:8px;line-height:1}
.sb-name{font-family:'Abril Fatface',display;font-size:27px;color:var(--gold);letter-spacing:.8px;line-height:1}
.sb-sub{font-size:9.5px;color:rgba(255,255,255,.28);text-transform:uppercase;letter-spacing:3px;margin-top:6px;font-weight:700}
.sb-nav{padding:14px 10px;flex:1}
.sb-section{font-size:9px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,.2);padding:14px 12px 5px;font-weight:800}
.sb-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:6px;color:rgba(255,255,255,.45);cursor:pointer;font-size:14px;font-weight:700;margin-bottom:2px;transition:all .15s;border-left:3px solid transparent}
.sb-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85)}
.sb-item.on{background:rgba(212,168,67,.14);color:var(--gilt);border-left-color:var(--gold);padding-left:9px}
.sb-ico{width:16px;height:16px;flex-shrink:0}
.sb-badge{margin-left:auto;background:rgba(255,255,255,.09);color:rgba(255,255,255,.38);font-size:11px;padding:1px 8px;border-radius:10px;font-weight:800}
.sb-item.on .sb-badge{background:rgba(212,168,67,.22);color:var(--gilt)}
.sb-foot{padding:16px 14px;border-top:1px solid rgba(212,168,67,.12)}

/* Topbar */
.topbar{display:flex;align-items:center;gap:14px;padding:14px 36px;border-bottom:1px solid var(--border);background:var(--cream);flex-shrink:0;position:relative}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--gold),var(--amber),var(--gilt) 50%,transparent 80%)}
.topbar-title{font-family:'Abril Fatface',display;font-size:27px;color:var(--ink);letter-spacing:.5px}
.menu-btn{display:none;background:none;border:none;cursor:pointer;color:var(--muted);padding:4px}
.menu-btn svg{width:22px;height:22px}

/* Page bg watermark */
.page-bg-img{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:.06;filter:sepia(.5) blur(2px);pointer-events:none;z-index:0}
.page-layer{position:relative;z-index:1}

/* Hero */
.hero-wrap{position:relative;overflow:hidden;border-radius:var(--rl)}
.hero-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 9s ease}
.hero-wrap:hover img{transform:scale(1.04)}
.hero-fade{position:absolute;inset:0;background:linear-gradient(135deg,rgba(18,6,0,.88) 0%,rgba(18,6,0,.5) 55%,rgba(18,6,0,.08) 100%)}
.hero-body{position:absolute;bottom:0;left:0;right:0;z-index:1;padding:42px 50px;display:flex;flex-direction:column}
.hero-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:4.5px;color:var(--gold);margin-bottom:10px}
.hero-title{font-family:'Abril Fatface',display;font-size:52px;color:var(--white);line-height:1.05;margin-bottom:10px;text-shadow:0 3px 24px rgba(0,0,0,.45);white-space:pre-line}
.hero-sub{font-family:'Lora',serif;font-size:17px;font-style:italic;color:rgba(255,255,255,.72);max-width:520px;line-height:1.65}
.hero-bar{position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--gold),var(--gilt),transparent 75%)}

/* Section heading */
.sh{margin-bottom:22px}
.sh h2{font-family:'Abril Fatface',display;font-size:32px;color:var(--ink);line-height:1.1;margin-bottom:3px}
.sh p{font-family:'Lora',serif;font-size:15.5px;font-style:italic;color:var(--muted)}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:32px}
.stat{background:rgba(253,246,236,.9);border:1px solid var(--border);border-radius:var(--rm);padding:20px 18px;box-shadow:var(--sh1);backdrop-filter:blur(8px);position:relative;overflow:hidden;transition:box-shadow .18s,transform .18s}
.stat:hover{box-shadow:var(--sh2);transform:translateY(-2px)}
.stat-ico{font-size:26px;margin-bottom:9px}
.stat-val{font-family:'Abril Fatface',display;font-size:38px;color:var(--ink);line-height:1}
.stat-lbl{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-top:5px}

/* Mosaic */
.mosaic{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,155px);gap:10px;border-radius:var(--rm);overflow:hidden}
.mc{overflow:hidden;position:relative;cursor:pointer}
.mc img{width:100%;height:100%;object-fit:cover;transition:transform .55s ease}
.mc:hover img{transform:scale(1.08)}
.mc.big{grid-column:span 2;grid-row:span 2}
.mc-lbl{position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(transparent,rgba(18,6,0,.8));font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--white)}

/* Image divider */
.img-div{height:180px;border-radius:var(--rm);overflow:hidden;position:relative}
.img-div img{width:100%;height:100%;object-fit:cover;display:block}
.img-div-fade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,6,0,.83) 0%,rgba(18,6,0,.35) 60%,transparent 100%)}
.img-div-text{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;justify-content:center;padding:0 42px}
.img-div-text h3{font-family:'Abril Fatface',display;font-size:30px;color:var(--white);margin-bottom:5px}
.img-div-text p{font-family:'Lora',serif;font-size:15px;font-style:italic;color:rgba(255,255,255,.7)}

/* Showcase */
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(224px,1fr));gap:16px}
.sc-card{border-radius:var(--rm);overflow:hidden;border:1px solid var(--border);background:var(--white);box-shadow:var(--sh1);transition:all .22s;cursor:pointer}
.sc-card:hover{box-shadow:var(--sh3);transform:translateY(-4px)}
.sc-img{height:170px;overflow:hidden;position:relative}
.sc-img img{width:100%;height:100%;object-fit:cover;transition:transform .55s}
.sc-card:hover .sc-img img{transform:scale(1.09)}
.sc-img-fade{position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(18,6,0,.6))}
.sc-badge{position:absolute;top:11px;right:11px;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
.bd-rent{background:var(--gold);color:var(--ink)}
.bd-sale{background:var(--green);color:#fff}
.bd-both{background:var(--ink);color:var(--gold)}
.sc-body{padding:14px 16px}
.sc-cat{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--amber);margin-bottom:4px}
.sc-name{font-family:'Lora',serif;font-size:17px;font-weight:600;color:var(--ink);margin-bottom:5px;line-height:1.3}
.sc-price{font-family:'Abril Fatface',display;font-size:19px;color:var(--cog)}

/* Category tiles */
.cat-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px}
.cat-tile{border-radius:var(--rm);overflow:hidden;cursor:pointer;position:relative;height:122px;box-shadow:var(--sh1);transition:all .2s}
.cat-tile:hover{box-shadow:var(--sh2);transform:translateY(-3px)}
.cat-tile img{width:100%;height:100%;object-fit:cover;transition:transform .55s}
.cat-tile:hover img{transform:scale(1.1)}
.cat-tile::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 20%,rgba(18,6,0,.78))}
.cat-info{position:absolute;bottom:0;left:0;right:0;padding:10px 12px;z-index:1}
.cat-emo{font-size:18px;display:block;margin-bottom:2px}
.cat-name{font-size:12px;font-weight:800;color:var(--white);text-transform:uppercase;letter-spacing:.8px;line-height:1.2}
.cat-cnt{font-size:11px;color:rgba(255,255,255,.6);font-weight:600}

/* Inventory cards */
.inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(266px,1fr));gap:16px}
.inv-card{background:rgba(253,246,236,.93);border:1px solid var(--border);border-radius:var(--rm);overflow:hidden;cursor:pointer;transition:all .2s;box-shadow:var(--sh1);backdrop-filter:blur(4px)}
.inv-card:hover{box-shadow:var(--sh2);transform:translateY(-3px)}
.inv-img{height:170px;overflow:hidden}
.inv-img img{width:100%;height:100%;object-fit:cover;transition:transform .55s}
.inv-card:hover .inv-img img{transform:scale(1.07)}
.inv-body{padding:14px 16px}
.inv-cat{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
.inv-name{font-family:'Lora',serif;font-size:18px;font-weight:600;color:var(--ink);margin-bottom:8px;line-height:1.25}
.inv-meta{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
.chip{padding:3px 9px;border-radius:3px;font-size:11.5px;font-weight:700;background:var(--parch);color:var(--muted)}
.inv-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--linen)}
.mkt-badge{padding:3px 9px;border-radius:3px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
.mb-rent{background:rgba(26,53,112,.1);color:var(--blue)}
.mb-sale{background:rgba(38,94,42,.1);color:var(--green)}
.mb-both{background:rgba(196,118,26,.12);color:var(--cog)}
.mb-none{background:var(--parch);color:var(--faint)}
.price{font-family:'Abril Fatface',display;font-size:18px;color:var(--cog)}

/* Bar charts */
.bar-row{display:flex;align-items:center;gap:12px;padding:7px 0}
.bar-ico{font-size:17px;width:24px;text-align:center}
.bar-lbl{width:142px;font-size:13.5px;font-weight:700;color:var(--muted);flex-shrink:0}
.bar-track{flex:1;height:7px;background:var(--linen);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width .75s cubic-bezier(.4,0,.2,1)}
.bar-cnt{width:30px;text-align:right;font-size:14px;font-weight:800;color:var(--text)}

/* Card */
.card{background:rgba(253,246,236,.9);border:1px solid var(--border);border-radius:var(--rm);box-shadow:var(--sh1);backdrop-filter:blur(6px)}
.card-p{padding:26px}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 21px;border-radius:var(--r);font-size:14px;font-weight:800;cursor:pointer;border:1.5px solid transparent;font-family:'Raleway',sans-serif;letter-spacing:.3px;transition:all .15s;white-space:nowrap}
.btn:disabled{opacity:.42;cursor:not-allowed}
.btn-p{background:var(--ink);color:var(--gold);border-color:var(--ink)}
.btn-p:hover:not(:disabled){background:var(--deep)}
.btn-g{background:linear-gradient(135deg,var(--gold),var(--amber));color:var(--ink);border:none;font-weight:800;box-shadow:0 3px 12px rgba(196,118,26,.38)}
.btn-g:hover:not(:disabled){filter:brightness(1.09);transform:translateY(-1px);box-shadow:0 6px 20px rgba(196,118,26,.48)}
.btn-o{background:transparent;color:var(--text);border-color:var(--border)}
.btn-o:hover:not(:disabled){background:var(--parch);border-color:var(--sand)}
.btn-d{background:rgba(139,26,42,.07);color:var(--red);border-color:rgba(139,26,42,.2)}
.btn-d:hover:not(:disabled){background:rgba(139,26,42,.14)}
.btn-sm{padding:5px 13px;font-size:12.5px}
.btn-full{width:100%;justify-content:center}
.ico-btn{padding:7px;background:transparent;border:1.5px solid var(--border);border-radius:var(--r);cursor:pointer;color:var(--muted);display:inline-flex;align-items:center;transition:all .15s}
.ico-btn:hover{border-color:var(--sand);color:var(--text);background:var(--parch)}
.ico-btn svg{width:15px;height:15px}

/* Modal */
.overlay{position:fixed;inset:0;background:rgba(18,6,0,.76);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:fi .15s}
.modal{background:var(--cream);border-radius:var(--rl);width:100%;max-width:640px;max-height:91vh;display:flex;flex-direction:column;box-shadow:var(--sh3);animation:su .22s}
.modal-hd{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);background:var(--parch);border-radius:var(--rl) var(--rl) 0 0}
.modal-hd h2{font-family:'Abril Fatface',display;font-size:23px;color:var(--ink)}
.modal-bd{padding:24px;overflow-y:auto;flex:1}

/* Form */
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:15px}
.fg{display:flex;flex-direction:column;gap:5px}
.fg.fu{grid-column:1/-1}
.fl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.3px;color:var(--muted)}
.fi,.fs,.ft{background:var(--parch);border:1.5px solid var(--border);border-radius:var(--r);padding:9px 12px;font-size:14px;color:var(--text);font-family:'Raleway',sans-serif;font-weight:600;outline:none;transition:border .15s,box-shadow .15s;width:100%}
.fi:focus,.fs:focus,.ft:focus{border-color:var(--gold);background:var(--white);box-shadow:0 0 0 3px rgba(212,168,67,.14)}
.ft{resize:vertical;min-height:72px}
.sdiv{grid-column:1/-1;border-top:1.5px solid var(--border);padding-top:16px;margin-top:6px}
.slbl{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--amber);margin-bottom:12px}
.tc{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;background:var(--linen);border-radius:3px;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .12s}
.tc:hover{background:rgba(139,26,42,.1);color:var(--red)}
.ph-wrap{width:76px;height:76px;border-radius:var(--r);overflow:hidden;position:relative;border:1.5px solid var(--border)}
.ph-wrap img{width:100%;height:100%;object-fit:cover}
.ph-rm{position:absolute;top:2px;right:2px;width:20px;height:20px;background:rgba(18,6,0,.72);border:none;color:#fff;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
.ph-wrap:hover .ph-rm{opacity:1}
.ph-add{width:76px;height:76px;border:2px dashed var(--border);border-radius:var(--r);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--faint);font-size:11.5px;font-weight:800;gap:4px;transition:all .15s}
.ph-add:hover{border-color:var(--gold);color:var(--gold);background:rgba(212,168,67,.06)}
.ph-add svg{width:20px;height:20px}

/* Detail */
.dt-sec{margin-bottom:22px}
.dt-sec h3{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--linen)}
.dt-row{display:flex;padding:6px 0;font-size:14.5px}
.dt-lbl{width:136px;color:var(--faint);flex-shrink:0;font-size:13px;font-weight:700}
.dt-img{border-radius:var(--rm);overflow:hidden;margin-bottom:20px;position:relative;cursor:zoom-in;height:240px}
.dt-img img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.dt-img:hover img{transform:scale(1.03)}

/* Table */
.tw{overflow-x:auto;border:1px solid var(--border);border-radius:var(--rm);background:rgba(253,246,236,.9);backdrop-filter:blur(6px)}
table{width:100%;border-collapse:collapse}
th{padding:11px 15px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--faint);font-weight:800;text-align:left;background:var(--parch);border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:11px 15px;border-bottom:1px solid var(--linen);font-size:14px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(243,230,204,.55)}

/* Filters */
.fbar{background:rgba(253,246,236,.9);border:1px solid var(--border);border-radius:var(--rm);padding:14px 18px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;backdrop-filter:blur(6px)}
.fbar label{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:1.3px;color:var(--faint);margin-bottom:4px;font-weight:800}
.fbar select{background:var(--parch);border:1.5px solid var(--border);border-radius:var(--r);padding:6px 10px;font-size:13px;font-weight:700;color:var(--text);font-family:'Raleway',sans-serif;outline:none}

/* Pagination */
.pgn{display:flex;align-items:center;justify-content:center;gap:5px;padding:20px 0}
.pgn button{background:rgba(253,246,236,.9);border:1.5px solid var(--border);color:var(--muted);padding:6px 14px;border-radius:var(--r);cursor:pointer;font-size:13.5px;font-family:'Raleway',sans-serif;font-weight:800;transition:all .15s}
.pgn button:hover:not(:disabled){border-color:var(--gold);color:var(--cog)}
.pgn button.on{background:var(--ink);color:var(--gold);border-color:var(--ink)}
.pgn button:disabled{opacity:.3;cursor:not-allowed}

/* View toggle */
.vtog{display:flex;border:1.5px solid var(--border);border-radius:var(--r);overflow:hidden}
.vtog button{background:none;border:none;color:var(--muted);padding:7px 15px;cursor:pointer;font-size:13.5px;font-family:'Raleway',sans-serif;font-weight:800;transition:all .15s}
.vtog button.on{background:var(--ink);color:var(--gold)}
.vtog button:not(.on):hover{background:var(--parch);color:var(--text)}

/* Search */
.srch{position:relative;display:flex;align-items:center}
.srch svg{position:absolute;left:11px;width:15px;height:15px;color:var(--faint);pointer-events:none}
.srch input{background:rgba(253,246,236,.9);border:1.5px solid var(--border);border-radius:22px;padding:8px 14px 8px 34px;font-size:14px;font-weight:700;color:var(--text);font-family:'Raleway',sans-serif;outline:none;width:240px;transition:border .15s,box-shadow .15s;backdrop-filter:blur(4px)}
.srch input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,168,67,.13);background:var(--white)}
.srch input::placeholder{color:var(--faint);font-weight:500}

/* Tabs */
.tabs{display:flex;gap:2px;border-bottom:1.5px solid var(--border);margin-bottom:22px}
.tab{background:none;border:none;padding:10px 20px;font-size:14.5px;font-weight:800;color:var(--faint);cursor:pointer;border-bottom:3px solid transparent;font-family:'Raleway',sans-serif;transition:all .15s}
.tab.on{color:var(--cog);border-bottom-color:var(--gold)}
.tab:hover:not(.on){color:var(--muted)}

/* Lightbox */
.lb{position:fixed;inset:0;background:rgba(18,6,0,.93);z-index:2000;display:flex;align-items:center;justify-content:center;cursor:zoom-out}
.lb img{max-width:90vw;max-height:90vh;border-radius:var(--rm);box-shadow:var(--sh3)}

/* Empty */
.empty{text-align:center;padding:66px 20px}
.empty-ico{font-size:58px;margin-bottom:16px;opacity:.3}
.empty h3{font-family:'Abril Fatface',display;font-size:28px;color:var(--ink);margin-bottom:8px}
.empty p{font-family:'Lora',serif;font-style:italic;color:var(--muted);font-size:16px;margin-bottom:20px}

/* Pricing */
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:16px}
.pricing-card{background:rgba(253,246,236,.9);border:1.5px solid var(--border);border-radius:var(--rm);padding:22px;transition:all .2s}
.pricing-card:hover{box-shadow:var(--sh2)}
.pricing-card.hot{border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,168,67,.16)}
.pname{font-family:'Abril Fatface',display;font-size:23px;color:var(--ink);margin-bottom:4px}
.pprice{font-family:'Abril Fatface',display;font-size:36px;color:var(--cog)}
.pprice span{font-size:14px;color:var(--muted);font-family:'Raleway',sans-serif;font-weight:600}
.pdesc{font-family:'Lora',serif;font-style:italic;font-size:14px;color:var(--muted);margin:8px 0 16px}
.pfeat{display:flex;align-items:flex-start;gap:7px;font-size:13.5px;font-weight:700;margin-bottom:7px;color:var(--text)}
.pfeat svg{width:14px;height:14px;color:var(--green);flex-shrink:0;margin-top:2px}

.mob-overlay{position:fixed;inset:0;background:rgba(18,6,0,.55);z-index:190}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.fin{animation:fi .35s ease}

@media(max-width:900px){
  .sidebar{position:absolute;height:100%}
  .menu-btn{display:flex}
  .srch input{width:170px}
  .fg2{grid-template-columns:1fr}
  .topbar{padding:10px 18px}
  .hero-title{font-size:34px}
  .hero-body{padding:28px 26px}
  .mosaic{grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,130px)}
  .mc.big{grid-column:span 2;grid-row:span 1}
}
@media(max-width:600px){
  .inv-grid{grid-template-columns:1fr}
  .stats{grid-template-columns:repeat(2,1fr)}
  .cat-gallery{grid-template-columns:repeat(2,1fr)}
  .srch input{width:140px}
  .pricing-grid{grid-template-columns:1fr}
  .hero-title{font-size:26px}
  .sc-grid{grid-template-columns:1fr 1fr}
}

/* ── FLOATING CTA ─────────────────────────────────────────────── */
.fab {
  position:fixed; bottom:32px; right:32px; z-index:500;
  display:flex; flex-direction:column; align-items:flex-end; gap:10px;
}
.fab-btn {
  display:flex; align-items:center; gap:10px;
  background:linear-gradient(135deg,var(--gold),var(--amber));
  color:var(--ink); border:none; border-radius:50px;
  padding:14px 24px; cursor:pointer;
  font-family:'Raleway',sans-serif; font-size:15px; font-weight:800;
  box-shadow:0 6px 28px rgba(196,118,26,.55);
  transition:all .2s; white-space:nowrap;
  letter-spacing:.2px;
}
.fab-btn:hover { transform:translateY(-3px) scale(1.03); box-shadow:0 10px 36px rgba(196,118,26,.65); filter:brightness(1.07); }
.fab-btn svg   { width:20px; height:20px; flex-shrink:0; }
.fab-pulse {
  position:absolute; inset:-4px; border-radius:50px;
  border:2px solid var(--gold); opacity:0;
  animation:pulse 2.2s ease-out infinite;
  pointer-events:none;
}
.fab-sub {
  background:var(--ink); color:rgba(255,255,255,.75);
  font-family:'Lora',serif; font-style:italic;
  font-size:13px; padding:6px 14px; border-radius:20px;
  box-shadow:0 3px 14px rgba(18,6,0,.35);
  animation:fi .4s ease .6s both;
}
@keyframes pulse {
  0%   { transform:scale(1);    opacity:.7; }
  70%  { transform:scale(1.12); opacity:0;  }
  100% { opacity:0; }
}
@media(max-width:600px){
  .fab { bottom:20px; right:16px; }
  .fab-btn { font-size:13.5px; padding:12px 18px; }
  .fab-sub { display:none; }
}
`;

const Ic = {
  search:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  plus:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  edit:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  x:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  menu:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  home:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  box:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  store:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>,
  chart:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  settings:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  filter:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  check:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  dl:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  cam:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
};

function Modal({title,onClose,children}){
  useEffect(()=>{const h=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[onClose]);
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hd"><h2>{title}</h2><button className="ico-btn" onClick={onClose}>{Ic.x}</button></div>
        <div className="modal-bd">{children}</div>
      </div>
    </div>
  );
}

function ItemForm({item,onSave,onCancel}){
  const blank={name:"",category:"costumes",condition:"Good",size:"N/A",qty:1,location:"",notes:"",mkt:"Not Listed",rent:0,sale:0,avail:"In Stock",img:null,tags:[]};
  const[f,setF]=useState(item||blank);
  const[ti,setTi]=useState("");
  const[upl,setUpl]=useState(false);
  const fr=useRef();
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const showRent=f.mkt==="For Rent"||f.mkt==="Rent or Sale";
  const showSale=f.mkt==="For Sale"||f.mkt==="Rent or Sale";
  const handlePhoto=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    setUpl(true);const data=await resizeImg(file);upd("img",data);setUpl(false);
    if(fr.current)fr.current.value="";
  };
  const addTag=()=>{const t=ti.trim().toLowerCase();if(t&&!(f.tags||[]).includes(t))upd("tags",[...(f.tags||[]),t]);setTi("");};
  return(
    <div className="fg2">
      <div className="fg fu"><label className="fl">Item Name *</label><input className="fi" value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="e.g. Victorian Ball Gown" autoFocus/></div>
      <div className="fg"><label className="fl">Category</label><select className="fs" value={f.category} onChange={e=>upd("category",e.target.value)}>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
      <div className="fg"><label className="fl">Condition</label><select className="fs" value={f.condition} onChange={e=>upd("condition",e.target.value)}>{CONDS.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"><label className="fl">Size</label><select className="fs" value={f.size} onChange={e=>upd("size",e.target.value)}>{SIZES.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="0" value={f.qty} onChange={e=>upd("qty",parseInt(e.target.value)||0)}/></div>
      <div className="fg"><label className="fl">Availability</label><select className="fs" value={f.avail} onChange={e=>upd("avail",e.target.value)}>{AVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
      <div className="fg"><label className="fl">Location</label><input className="fi" value={f.location} onChange={e=>upd("location",e.target.value)} placeholder="e.g. Costume Closet A"/></div>
      <div className="fg fu sdiv">
        <div className="slbl">📷 Photo</div>
        <div style={{display:"flex",gap:10}}>
          {f.img?<div className="ph-wrap"><img src={f.img} alt=""/><button className="ph-rm" onClick={()=>upd("img",null)}>×</button></div>
                :<label className="ph-add" style={{opacity:upl?.5:1}}>{Ic.cam}<span>{upl?"Uploading…":"Add Photo"}</span><input ref={fr} type="file" accept="image/*" hidden onChange={handlePhoto} disabled={upl}/></label>}
        </div>
      </div>
      <div className="fg fu">
        <div className="slbl">🏷 Tags</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>{(f.tags||[]).map(t=><span key={t} className="tc" onClick={()=>upd("tags",f.tags.filter(x=>x!==t))}>#{t} ×</span>)}</div>
        <div style={{display:"flex",gap:7}}><input className="fi" style={{flex:1}} value={ti} onChange={e=>setTi(e.target.value)} placeholder="Add tag…" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag()}}}/><button className="btn btn-o btn-sm" onClick={addTag}>Add</button></div>
      </div>
      <div className="fg fu"><label className="fl">Notes</label><textarea className="ft" value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Production history, care instructions…"/></div>
      <div className="fg fu sdiv"><div className="slbl">🏪 Marketplace</div></div>
      <div className="fg"><label className="fl">Listing Status</label><select className="fs" value={f.mkt} onChange={e=>upd("mkt",e.target.value)}>{MKT.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="fg"/>
      {showRent&&<div className="fg"><label className="fl">Rental / week ($)</label><input className="fi" type="number" min="0" step="0.01" value={f.rent} onChange={e=>upd("rent",parseFloat(e.target.value)||0)}/></div>}
      {showSale&&<div className="fg"><label className="fl">Sale Price ($)</label><input className="fi" type="number" min="0" step="0.01" value={f.sale} onChange={e=>upd("sale",parseFloat(e.target.value)||0)}/></div>}
      <div className="fg fu" style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:16,borderTop:"1.5px solid var(--border)",marginTop:6}}>
        <button className="btn btn-o" onClick={onCancel}>Cancel</button>
        <button className="btn btn-p" disabled={!f.name.trim()} style={!f.name.trim()?{opacity:.42}:{}} onClick={()=>onSave(f)}>
          <span style={{width:15,height:15,display:"flex"}}>{Ic.check}</span>{item?"Save Changes":"Add Item"}
        </button>
      </div>
    </div>
  );
}

function ItemDetail({item,onEdit,onDelete}){
  const cat=CAT[item.category]||CAT.other;
  const[lb,setLb]=useState(false);
  const fb=usp(CAT_IMG[item.category]||CAT_IMG.other,800,480);
  const src=item.img||fb;
  const mktCls=item.mkt==="For Rent"?"mb-rent":item.mkt==="For Sale"?"mb-sale":item.mkt==="Rent or Sale"?"mb-both":"mb-none";
  return(
    <>
      {lb&&<div className="lb" onClick={()=>setLb(false)}><img src={src} alt=""/></div>}
      <div className="dt-img" onClick={()=>setLb(true)}>
        <img src={src} alt={item.name}/>
        {!item.img&&<><div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 50%,rgba(18,6,0,.5))"}}/><div style={{position:"absolute",bottom:12,left:14,color:"rgba(255,255,255,.65)",fontSize:12,fontFamily:"'Lora',serif",fontStyle:"italic"}}>Representative image</div></>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:16}}>
        <div style={{width:50,height:50,background:cat.color+"22",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,border:`1.5px solid ${cat.color}44`}}>{cat.icon}</div>
        <div>
          <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:cat.color}}>{cat.label}</div>
          <div style={{fontFamily:"'Abril Fatface',display",fontSize:24,color:"var(--ink)",lineHeight:1.1}}>{item.name}</div>
        </div>
      </div>
      {(item.tags||[]).length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{item.tags.map(t=><span key={t} style={{background:"rgba(196,118,26,.12)",color:"var(--cog)",fontSize:12.5,fontWeight:700,padding:"3px 9px",borderRadius:3}}>#{t}</span>)}</div>}
      <div className="dt-sec"><h3>Details</h3>
        {[["Condition",item.condition],["Size",item.size],["Quantity",item.qty],["Availability",item.avail],["Location",item.location||"—"],["Notes",item.notes||"—"],["Added",item.added?new Date(item.added).toLocaleDateString():"—"],["ID",<span style={{fontFamily:"monospace",fontSize:11,color:"var(--faint)"}}>{item.id}</span>]].map(([l,v])=>(
          <div className="dt-row" key={l}><span className="dt-lbl">{l}</span><span>{v}</span></div>
        ))}
      </div>
      <div className="dt-sec"><h3>Marketplace</h3>
        <div className="dt-row"><span className="dt-lbl">Status</span><span className={`mkt-badge ${mktCls}`}>{item.mkt}</span></div>
        {(item.mkt==="For Rent"||item.mkt==="Rent or Sale")&&<div className="dt-row"><span className="dt-lbl">Rental/week</span><span className="price">{fmt$(item.rent)}</span></div>}
        {(item.mkt==="For Sale"||item.mkt==="Rent or Sale")&&<div className="dt-row"><span className="dt-lbl">Sale Price</span><span className="price">{fmt$(item.sale)}</span></div>}
      </div>
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <button className="btn btn-p btn-sm" onClick={onEdit}><span style={{width:14,height:14,display:"flex"}}>{Ic.edit}</span>Edit</button>
        <button className="btn btn-d btn-sm" onClick={()=>{if(window.confirm("Delete this item?"))onDelete(item.id)}}><span style={{width:14,height:14,display:"flex"}}>{Ic.trash}</span>Delete</button>
      </div>
    </>
  );
}

function Pager({total,page,per,onPage}){
  const pages=Math.ceil(total/per);if(pages<=1)return null;
  const s=Math.max(1,page-2),e=Math.min(pages,page+2),nums=[];
  for(let i=s;i<=e;i++)nums.push(i);
  return(
    <div className="pgn">
      <button disabled={page<=1} onClick={()=>onPage(page-1)}>‹</button>
      {s>1&&<><button onClick={()=>onPage(1)}>1</button><span style={{color:"var(--faint)"}}>…</span></>}
      {nums.map(n=><button key={n} className={n===page?"on":""} onClick={()=>onPage(n)}>{n}</button>)}
      {e<pages&&<><span style={{color:"var(--faint)"}}>…</span><button onClick={()=>onPage(pages)}>{pages}</button></>}
      <button disabled={page>=pages} onClick={()=>onPage(page+1)}>›</button>
    </div>
  );
}

/* ── PAGES ─────────────────────────────────────────────────────────────────── */

function Dashboard({items,org,goInventory}){
  const totalQty=items.reduce((s,i)=>s+(i.qty||1),0);
  const listed=items.filter(i=>i.mkt!=="Not Listed").length;
  const withImg=items.filter(i=>i.img).length;
  const totalVal=items.reduce((s,i)=>s+((i.sale||0)*(i.qty||1)),0);
  const cc={};items.forEach(i=>{cc[i.category]=(cc[i.category]||0)+(i.qty||1)});
  const maxC=Math.max(1,...Object.values(cc));
  return(
    <div style={{position:"relative",padding:"32px 36px 56px"}}>
      <img src={usp(BG.dashboard,1400,900)} alt="" className="page-bg-img"/>
      <div className="page-layer">
        {/* Hero */}
        <div className="hero-wrap" style={{height:380,marginBottom:32}}>
          <img src={usp(BG.dashboard,1200,480)} alt="Grand Theatre" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🎭 Theatre Inventory & Marketplace</div>
            <h1 className="hero-title">{org.name?`Welcome,\n${org.name}`:"Welcome to\nTheatre4u"}</h1>
            <p className="hero-sub">Everything your programme owns — catalogued, photographed, and ready to share with the wider arts community.</p>
          </div>
          <div className="hero-bar"/>
        </div>
        {/* Stats */}
        <div className="stats">
          {[{ico:"📦",val:totalQty,lbl:"Total Items",col:"#c4761a"},{ico:"📂",val:items.length,lbl:"Entries",col:"#1554a0"},{ico:"🏪",val:listed,lbl:"On Marketplace",col:"#27723a"},{ico:"📷",val:withImg,lbl:"With Photos",col:"#a0144e"},{ico:"💰",val:totalVal>0?fmt$(totalVal):"—",lbl:"Est. Value",col:"#8b3a0f"}].map(s=>(
            <div key={s.lbl} className="stat" style={{borderTop:`4px solid ${s.col}`}}>
              <div className="stat-ico">{s.ico}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
        {/* Mosaic */}
        <div className="sh"><h2>From the Stage</h2><p>A glimpse of what arts programs are cataloguing and sharing nationwide.</p></div>
        <div className="mosaic" style={{marginBottom:32}}>
          <div className="mc big"><img src={usp("photo-1503095396549-807759245b35",800,400)} alt="Grand Theatre" loading="lazy"/><div className="mc-lbl">Grand Stage Interiors</div></div>
          <div className="mc"><img src={usp("photo-1558618666-fcd25c85cd64",400,200)} alt="Costumes" loading="lazy"/><div className="mc-lbl">Costumes</div></div>
          <div className="mc"><img src={usp("photo-1514525253161-7a46d19cd819",400,200)} alt="Lighting" loading="lazy"/><div className="mc-lbl">Stage Lighting</div></div>
          <div className="mc"><img src={usp("photo-1516450360452-9312f5e86fc7",400,200)} alt="Effects" loading="lazy"/><div className="mc-lbl">Special Effects</div></div>
          <div className="mc"><img src={usp("photo-1598488035139-bdbb2231ce04",400,200)} alt="Sound" loading="lazy"/><div className="mc-lbl">Sound Equipment</div></div>
        </div>
        {/* Divider 1 */}
        <div className="img-div" style={{marginBottom:32}}>
          <img src={usp("photo-1560179707-f14e90ef3623",1000,240)} alt="Stage" loading="lazy"/>
          <div className="img-div-fade"/>
          <div className="img-div-text">
            <h3>The Theatre Marketplace</h3>
            <p>Rent or buy costumes, props, lighting and more from programmes in your community.</p>
          </div>
        </div>
        {/* Showcase */}
        <div className="sh"><h2>Marketplace Highlights</h2><p>Sample of what you'll find from programmes across the community.</p></div>
        <div className="sc-grid" style={{marginBottom:36}}>
          {SHOWCASE.map((it,i)=>{
            const cls=it.badge==="For Rent"?"bd-rent":it.badge==="For Sale"?"bd-sale":"bd-both";
            return(
              <div key={i} className="sc-card">
                <div className="sc-img"><img src={usp(it.img,400,200)} alt={it.name} loading="lazy"/><div className="sc-img-fade"/><span className={`sc-badge ${cls}`}>{it.badge}</span></div>
                <div className="sc-body"><div className="sc-cat">{CAT[it.cat]?.label}</div><div className="sc-name">{it.name}</div><div className="sc-price">{it.price}</div></div>
              </div>
            );
          })}
        </div>
        {/* Category gallery */}
        <div className="sh"><h2>Browse by Category</h2><p>Click any category to explore your inventory.</p></div>
        <div className="cat-gallery" style={{marginBottom:36}}>
          {CATS.map(cat=>{
            const count=items.filter(it=>it.category===cat.id).length;
            return(
              <div key={cat.id} className="cat-tile" onClick={goInventory}>
                <img src={usp(CAT_IMG[cat.id]||CAT_IMG.other,300,160)} alt={cat.label} loading="lazy"/>
                <div className="cat-info"><span className="cat-emo">{cat.icon}</span><span className="cat-name">{cat.label}</span>{count>0&&<div className="cat-cnt">{count} item{count!==1?"s":""}</div>}</div>
              </div>
            );
          })}
        </div>
        {/* Divider 2 */}
        <div className="img-div" style={{marginBottom:32}}>
          <img src={usp("photo-1504196606672-aef5c9cefc92",1000,240)} alt="Theatre seats" loading="lazy"/>
          <div className="img-div-fade"/>
          <div className="img-div-text">
            <h3>Every Seat Filled. Every Prop Accounted For.</h3>
            <p>Theatre4u keeps your whole programme organised from rehearsal to curtain call.</p>
          </div>
        </div>
        {/* Bar chart */}
        {items.length>0?(
          <div className="card card-p">
            <div className="sh" style={{marginBottom:20}}><h2>Inventory at a Glance</h2></div>
            {CATS.map(cat=>{const c=cc[cat.id]||0;if(!c)return null;return(
              <div key={cat.id} className="bar-row">
                <span className="bar-ico">{cat.icon}</span>
                <span className="bar-lbl">{cat.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(c/maxC)*100}%`,background:cat.color}}/></div>
                <span className="bar-cnt">{c}</span>
              </div>
            );})}
          </div>
        ):(
          <div className="empty"><div className="empty-ico">🎭</div><h3>Your Stage Awaits</h3><p>Load sample data from Settings, or add your first item to begin.</p></div>
        )}
      </div>
    </div>
  );
}

function Inventory({items,onAdd,onEdit,onDelete}){
  const[search,setSrch]=useState("");const[catF,setCatF]=useState("all");
  const[condF,setCondF]=useState("all");const[availF,setAvailF]=useState("all");
  const[mktF,setMktF]=useState("all");const[view,setView]=useState("grid");
  const[showF,setShowF]=useState(false);const[pg,setPg]=useState(1);
  const[modal,setModal]=useState(null);const[active,setActive]=useState(null);
  const PP=20;
  const mktCls=m=>m==="For Rent"?"mb-rent":m==="For Sale"?"mb-sale":m==="Rent or Sale"?"mb-both":"mb-none";
  const filtered=useMemo(()=>{
    let f=items;
    if(search){const q=search.toLowerCase();f=f.filter(i=>i.name.toLowerCase().includes(q)||(i.notes||"").toLowerCase().includes(q)||(i.location||"").toLowerCase().includes(q)||(i.tags||[]).some(t=>t.includes(q)))}
    if(catF!=="all")f=f.filter(i=>i.category===catF);
    if(condF!=="all")f=f.filter(i=>i.condition===condF);
    if(availF!=="all")f=f.filter(i=>i.avail===availF);
    if(mktF!=="all")f=f.filter(i=>i.mkt===mktF);
    return f;
  },[items,search,catF,condF,availF,mktF]);
  const paged=useMemo(()=>filtered.slice((pg-1)*PP,pg*PP),[filtered,pg]);
  useEffect(()=>setPg(1),[search,catF,condF,availF,mktF]);
  const openD=item=>{setActive(item);setModal("d")};
  const openE=item=>{setActive(item);setModal("e")};
  const handleSave=form=>{
    if(active&&modal==="e")onEdit({...active,...form});
    else onAdd({...form,id:uid(),added:new Date().toISOString()});
    setModal(null);setActive(null);
  };
  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.inventory,1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:240}}>
          <img src={usp(BG.inventory,1100,300)} alt="Stage" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📦 Your Collection</div>
            <h1 className="hero-title" style={{fontSize:46}}>Inventory</h1>
            <p className="hero-sub">Every costume, prop, set piece and piece of gear — all in one place.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>
      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
          <div className="srch">{Ic.search}<input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search items, tags, location…"/></div>
          <button className="ico-btn" style={showF?{borderColor:"var(--gold)",color:"var(--cog)"}:{}} onClick={()=>setShowF(!showF)}>{Ic.filter}</button>
          <div className="vtog"><button className={view==="grid"?"on":""} onClick={()=>setView("grid")}>Grid</button><button className={view==="table"?"on":""} onClick={()=>setView("table")}>Table</button></div>
          <div style={{marginLeft:"auto"}}><button className="btn btn-g" onClick={()=>{setActive(null);setModal("a")}}><span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add Item</button></div>
        </div>
        {showF&&(
          <div className="fbar fin">
            <div><label>Category</label><select value={catF} onChange={e=>setCatF(e.target.value)}><option value="all">All</option>{CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label>Condition</label><select value={condF} onChange={e=>setCondF(e.target.value)}><option value="all">All</option>{CONDS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label>Availability</label><select value={availF} onChange={e=>setAvailF(e.target.value)}><option value="all">All</option>{AVAIL.map(a=><option key={a}>{a}</option>)}</select></div>
            <div><label>Marketplace</label><select value={mktF} onChange={e=>setMktF(e.target.value)}><option value="all">All</option>{MKT.map(s=><option key={s}>{s}</option>)}</select></div>
            <button className="btn btn-o btn-sm" onClick={()=>{setCatF("all");setCondF("all");setAvailF("all");setMktF("all")}}>Clear</button>
          </div>
        )}
        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>{filtered.length} item{filtered.length!==1?"s":""}</div>
        {view==="grid"&&(paged.length===0
          ?<div className="empty"><div className="empty-ico">🎭</div><h3>No Items Found</h3><p>{items.length===0?"Add your first item to build your catalogue.":"Try adjusting search or filters."}</p>{items.length===0&&<button className="btn btn-g" onClick={()=>{setActive(null);setModal("a")}}><span style={{width:15,height:15,display:"flex"}}>{Ic.plus}</span>Add First Item</button>}</div>
          :<div className="inv-grid">
              {paged.map(item=>{
                const cat=CAT[item.category]||CAT.other;
                const fb=usp(CAT_IMG[item.category]||CAT_IMG.other,400,220);
                return(
                  <div key={item.id} className="inv-card" onClick={()=>openD(item)}>
                    <div className="inv-img"><img src={item.img||fb} alt={item.name} loading="lazy" style={!item.img?{opacity:.72}:{}}/></div>
                    <div className="inv-body">
                      <div className="inv-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</div>
                      <div className="inv-name">{item.name}</div>
                      <div className="inv-meta"><span className="chip">{item.condition}</span><span className="chip">×{item.qty}</span>{item.size!=="N/A"&&<span className="chip">{item.size}</span>}<span className="chip">{item.avail}</span></div>
                      <div className="inv-foot"><span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span>{item.mkt!=="Not Listed"&&<span className="price">{item.rent>0?fmt$(item.rent)+"/wk":""}{item.rent>0&&item.sale>0?" · ":""}{item.sale>0?fmt$(item.sale):""}</span>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
        )}
        {view==="table"&&(
          <div className="tw">
            <table>
              <thead><tr><th></th><th>Item</th><th>Category</th><th>Cond.</th><th>Qty</th><th>Location</th><th>Avail.</th><th>Market</th><th></th></tr></thead>
              <tbody>
                {paged.map(item=>{
                  const cat=CAT[item.category]||CAT.other;
                  const fb=usp(CAT_IMG[item.category]||CAT_IMG.other,60,60);
                  return(
                    <tr key={item.id}>
                      <td style={{width:40,padding:"4px 8px"}}><img src={item.img||fb} alt="" style={{width:32,height:32,borderRadius:4,objectFit:"cover",opacity:item.img?1:.7}}/></td>
                      <td style={{fontFamily:"'Lora',serif",fontWeight:600,fontSize:15,cursor:"pointer",color:"var(--ink)"}} onClick={()=>openD(item)}>{item.name}</td>
                      <td style={{fontWeight:700,color:"var(--muted)"}}>{cat.icon} {cat.label}</td>
                      <td>{item.condition}</td><td style={{fontWeight:800}}>{item.qty}</td>
                      <td style={{color:"var(--muted)"}}>{item.location||"—"}</td>
                      <td>{item.avail}</td>
                      <td><span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span></td>
                      <td><div style={{display:"flex",gap:4}}>
                        <button className="ico-btn" onClick={e=>{e.stopPropagation();openE(item)}}>{Ic.edit}</button>
                        <button className="ico-btn" style={{color:"var(--red)"}} onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))onDelete(item.id)}}>{Ic.trash}</button>
                      </div></td>
                    </tr>
                  );
                })}
                {paged.length===0&&<tr><td colSpan={9} style={{textAlign:"center",color:"var(--faint)",padding:40,fontFamily:"'Lora',serif",fontStyle:"italic"}}>No items found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pager total={filtered.length} page={pg} per={PP} onPage={setPg}/>
      </div>
      {modal==="a"&&<Modal title="Add New Item" onClose={()=>setModal(null)}><ItemForm onSave={handleSave} onCancel={()=>setModal(null)}/></Modal>}
      {modal==="e"&&active&&<Modal title="Edit Item" onClose={()=>setModal(null)}><ItemForm item={active} onSave={handleSave} onCancel={()=>setModal(null)}/></Modal>}
      {modal==="d"&&active&&<Modal title="Item Details" onClose={()=>{setModal(null);setActive(null)}}><ItemDetail item={active} onEdit={()=>setModal("e")} onDelete={id=>{onDelete(id);setModal(null);setActive(null)}}/></Modal>}
    </div>
  );
}

function Marketplace({items,org}){
  const[search,setSrch]=useState("");const[catF,setCatF]=useState("all");
  const[typeF,setTypeF]=useState("all");const[pg,setPg]=useState(1);
  const[viewing,setViewing]=useState(null);
  const PP=16;
  const mktCls=m=>m==="For Rent"?"mb-rent":m==="For Sale"?"mb-sale":"mb-both";
  const listed=useMemo(()=>{
    let f=items.filter(i=>i.mkt!=="Not Listed"&&i.avail==="In Stock");
    if(search){const q=search.toLowerCase();f=f.filter(i=>i.name.toLowerCase().includes(q))}
    if(catF!=="all")f=f.filter(i=>i.category===catF);
    if(typeF==="rent")f=f.filter(i=>i.mkt.includes("Rent"));
    if(typeF==="sale")f=f.filter(i=>i.mkt.includes("Sale"));
    return f;
  },[items,search,catF,typeF]);
  const paged=useMemo(()=>listed.slice((pg-1)*PP,pg*PP),[listed,pg]);
  useEffect(()=>setPg(1),[search,catF,typeF]);
  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.marketplace,1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:280}}>
          <img src={usp(BG.marketplace,1100,340)} alt="Marketplace" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🏪 Community Exchange</div>
            <h1 className="hero-title" style={{fontSize:46}}>The Marketplace</h1>
            <p className="hero-sub">Rent or buy costumes, props, lighting, sound and more from programmes near you. Give assets a second life.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>
      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
          <div className="srch">{Ic.search}<input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search listings…"/></div>
          <select style={{background:"rgba(253,246,236,.9)",border:"1.5px solid var(--border)",borderRadius:"var(--r)",padding:"8px 11px",fontSize:14,fontWeight:700,color:"var(--text)",fontFamily:"'Raleway',sans-serif",outline:"none"}} value={catF} onChange={e=>setCatF(e.target.value)}>
            <option value="all">All Categories</option>{CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="vtog"><button className={typeF==="all"?"on":""} onClick={()=>setTypeF("all")}>All</button><button className={typeF==="rent"?"on":""} onClick={()=>setTypeF("rent")}>Rent</button><button className={typeF==="sale"?"on":""} onClick={()=>setTypeF("sale")}>Sale</button></div>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:"var(--faint)",marginBottom:12}}>{listed.length} listing{listed.length!==1?"s":""}</div>
        {paged.length===0
          ?<div className="empty"><div className="empty-ico">🏪</div><h3>No Listings Yet</h3><p>Mark items as "For Rent" or "For Sale" in your Inventory to display them here.</p></div>
          :<div className="inv-grid">
              {paged.map(item=>{
                const cat=CAT[item.category]||CAT.other;
                const fb=usp(CAT_IMG[item.category]||CAT_IMG.other,400,220);
                return(
                  <div key={item.id} className="inv-card" onClick={()=>setViewing(item)}>
                    {org.name&&<div style={{padding:"6px 14px",background:"var(--parch)",borderBottom:"1px solid var(--linen)",fontSize:11,fontWeight:800,color:"var(--amber)",textTransform:"uppercase",letterSpacing:1.5}}>{org.name}</div>}
                    <div className="inv-img"><img src={item.img||fb} alt={item.name} loading="lazy" style={!item.img?{opacity:.72}:{}}/></div>
                    <div className="inv-body">
                      <div className="inv-cat" style={{color:cat.color}}>{cat.icon} {cat.label}</div>
                      <div className="inv-name">{item.name}</div>
                      {item.notes&&<p style={{fontFamily:"'Lora',serif",fontStyle:"italic",fontSize:14,color:"var(--muted)",margin:"3px 0 8px",lineHeight:1.5}}>{item.notes.slice(0,80)}{item.notes.length>80?"…":""}</p>}
                      <div className="inv-meta"><span className="chip">{item.condition}</span><span className="chip">×{item.qty}</span></div>
                      <div className="inv-foot">
                        <span className={`mkt-badge ${mktCls(item.mkt)}`}>{item.mkt}</span>
                        <span className="price">{item.rent>0?fmt$(item.rent)+"/wk":""}{item.rent>0&&item.sale>0?" · ":""}{item.sale>0?fmt$(item.sale):""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        }
        <Pager total={listed.length} page={pg} per={PP} onPage={setPg}/>
      </div>
      {viewing&&<Modal title="Listing Details" onClose={()=>setViewing(null)}><ItemDetail item={viewing} onEdit={()=>{}} onDelete={()=>{}}/></Modal>}
    </div>
  );
}

function Reports({ items }) {
  const [tab,setTab] = useState("overview");
  const totalQty  = items.reduce((s,i)=>s+(i.qty||1),0);
  const catData   = CATS.map(cat=>{const ci=items.filter(i=>i.category===cat.id);return{...cat,count:ci.length,qty:ci.reduce((s,i)=>s+(i.qty||1),0),val:ci.reduce((s,i)=>s+((i.sale||0)*(i.qty||1)),0)}}).filter(c=>c.count>0);
  const condData  = CONDS.map(c=>({l:c,n:items.filter(i=>i.condition===c).length})).filter(c=>c.n>0);
  const availData = AVAIL.map(a=>({l:a,n:items.filter(i=>i.avail===a).length})).filter(a=>a.n>0);
  const mktData   = MKT.map(s=>({l:s,n:items.filter(i=>i.mkt===s).length})).filter(m=>m.n>0);
  const maxN = n => Math.max(1,n);

  const csv = () => {
    const h=["Name","Category","Condition","Size","Qty","Location","Availability","Market","Rent","Sale","Tags","Notes","ID","Added"];
    const rows=items.map(i=>[i.name,i.category,i.condition,i.size,i.qty,i.location,i.avail,i.mkt,i.rent,i.sale,(i.tags||[]).join(";"),`"${(i.notes||"").replace(/"/g,'""')}"`,i.id,i.added]);
    const csv=[h,...rows].map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="theatre4u_inventory.csv";a.click();
  };

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
            <p className="hero-sub">Breakdowns, condition tracking, and data exports for your programme.</p>
          </div>
          <div style={{position:"absolute",bottom:24,right:30,zIndex:2}}>
            <button className="btn btn-g" onClick={csv}><span style={{width:14,height:14,display:"flex"}}>{Ic.dl}</span>Export CSV</button>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 48px",position:"relative",zIndex:1}}>
        <div className="tabs">
          {[["overview","Overview"],["condition","Condition"],["availability","Availability"],["market","Marketplace"]].map(([t,l])=>(
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
                      <td style={{fontFamily:"'Abril Fatface',display",color:"var(--cog)",fontSize:16}}>{c.val>0?fmt$(c.val):"—"}</td>
                    </tr>
                  ))}
                  <tr style={{background:"var(--parch)"}}>
                    <td style={{fontFamily:"'Abril Fatface',display",fontSize:17}}>Total</td>
                    <td style={{fontWeight:800}}>{items.length}</td>
                    <td style={{fontWeight:800}}>{totalQty}</td>
                    <td style={{fontFamily:"'Abril Fatface',display",color:"var(--cog)",fontSize:18}}>{fmt$(catData.reduce((s,c)=>s+c.val,0))}</td>
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
            <div className="sh"><h2>Marketplace Status</h2></div>
            {mktData.map(m=>(
              <div className="bar-row" key={m.l}>
                <span className="bar-lbl" style={{width:130}}>{m.l}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(m.n/maxN(items.length))*100}%`,background:m.l.includes("Rent")?"#42a5f5":m.l.includes("Sale")?"#4caf50":m.l==="Rent or Sale"?"#d4a843":"#aaa"}}/></div>
                <span className="bar-cnt">{m.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ org, setOrg, onSeed }) {
  const [f,setF]       = useState(org);
  const [saved,setSaved] = useState(false);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));
  const save = () => { setOrg(f); setSaved(true); setTimeout(()=>setSaved(false),2200); };

  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.settings,1400,900)} alt="" className="page-bg-img"/>

      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:210}}>
          <img src={usp(BG.settings,1100,260)} alt="Settings" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">⚙️ Configuration</div>
            <h1 className="hero-title" style={{fontSize:44}}>Settings</h1>
            <p className="hero-sub">{f.name||"Your programme"} — manage your profile and data.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 48px",position:"relative",zIndex:1,maxWidth:760}}>

        {/* Org Profile */}
        <div className="card card-p" style={{marginBottom:20}}>
          <div className="sh"><h2>Organisation Profile</h2><p>This information appears on your marketplace listings.</p></div>
          <div className="fg2">
            <div className="fg fu"><label className="fl">Organisation Name</label><input className="fi" value={f.name||""} onChange={e=>upd("name",e.target.value)} placeholder="e.g. Lincoln High Drama Dept"/></div>
            <div className="fg">
              <label className="fl">Type</label>
              <select className="fs" value={f.type||""} onChange={e=>upd("type",e.target.value)}>
                <option value="">Select…</option>
                {["School","District","Community Theatre","College","Professional","Other"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={f.email||""} onChange={e=>upd("email",e.target.value)} placeholder="drama@school.edu"/></div>
            <div className="fg"><label className="fl">Phone</label><input className="fi" value={f.phone||""} onChange={e=>upd("phone",e.target.value)} placeholder="(555) 123-4567"/></div>
            <div className="fg"><label className="fl">City / Location</label><input className="fi" value={f.location||""} onChange={e=>upd("location",e.target.value)} placeholder="Portland, OR"/></div>
            <div className="fg fu"><label className="fl">About Your Programme</label><textarea className="ft" value={f.bio||""} onChange={e=>upd("bio",e.target.value)} placeholder="Tell others about your programme…"/></div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:18,paddingTop:14,borderTop:"1.5px solid var(--border)"}}>
            <button className="btn btn-p" onClick={save}><span style={{width:14,height:14,display:"flex"}}>{Ic.check}</span>Save Profile</button>
            {saved&&<span style={{color:"var(--green)",fontWeight:800,fontSize:13.5}}>✓ Saved!</span>}
          </div>
        </div>

        {/* Plans */}
        <div className="card card-p" style={{marginBottom:20}}>
          <div className="sh"><h2>Plans</h2><p>Choose the right plan for your programme.</p></div>
          <div className="pricing-grid">
            {[
              { name:"Free",   price:"$0",  per:"/forever",   desc:"Perfect for getting started.",        hot:false, feats:["Up to 50 items","Basic marketplace","CSV export","QR labels"] },
              { name:"Pro",    price:"$12", per:"/month",     desc:"For active programmes & companies.",  hot:true,  feats:["Unlimited items","Priority marketplace","Photo storage 5GB","Analytics dashboard","Email support"] },
              { name:"District",price:"$49",per:"/month",    desc:"Multiple schools, one platform.",     hot:false, feats:["Unlimited programmes","Shared inventory pool","Admin controls","White-label option","Dedicated support"] },
            ].map(p=>(
              <div key={p.name} className={`pricing-card${p.hot?" hot":""}`}>
                <div className="pname">{p.name}</div>
                <div className="pprice">{p.price}<span>{p.per}</span></div>
                <div className="pdesc">{p.desc}</div>
                {p.feats.map(ft=>(
                  <div key={ft} className="pfeat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    {ft}
                  </div>
                ))}
                <button className={`btn btn-full ${p.hot?"btn-g":"btn-o"}`} style={{marginTop:16}}>{p.hot?"Get Pro":"Learn More"}</button>
              </div>
            ))}
          </div>
        </div>

        {/* Data */}
        <div className="card card-p">
          <div className="sh"><h2>Data Management</h2><p>Load sample data to explore, or reset everything to start fresh.</p></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn btn-o" onClick={onSeed}><span style={{width:14,height:14,display:"flex"}}>{Ic.box}</span>Load Sample Data</button>
            <button className="btn btn-d" onClick={()=>{
              if(window.confirm("Delete ALL items and reset the app? This cannot be undone.")){
                const empty={name:"",type:"",email:"",phone:"",location:"",bio:""};
                setOrg(empty);setF(empty);
                DB.save("t4u-items",[]);DB.save("t4u-org",empty);
                window.location.reload();
              }
            }}><span style={{width:14,height:14,display:"flex"}}>{Ic.trash}</span>Reset All Data</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [items,setItems]   = useState([]);
  const [org,setOrg]       = useState({name:"",type:"",email:"",phone:"",location:"",bio:""});
  const [page,setPage]     = useState("dashboard");
  const [mob,setMob]       = useState(false);
  const [loaded,setLoaded] = useState(false);

  useEffect(()=>{
    (async()=>{
      const si = await DB.load("t4u-items", null);
      const so = await DB.load("t4u-org",   null);
      if(si) setItems(si);
      if(so) setOrg(so);
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{ if(loaded) DB.save("t4u-items",items); },[items,loaded]);
  useEffect(()=>{ if(loaded) DB.save("t4u-org",org);     },[org,loaded]);

  const add  = useCallback(i  => setItems(p=>[i,...p]),                  []);
  const edit = useCallback(i  => setItems(p=>p.map(x=>x.id===i.id?i:x)),[]);
  const del  = useCallback(id => setItems(p=>p.filter(x=>x.id!==id)),    []);
  const seed = useCallback(()  => setItems(p=>[...p,...makeSamples()]),    []);
  const nav  = p => { setPage(p); setMob(false); };

  const isDesk = typeof window !== "undefined" && window.innerWidth > 900;
  const listed = items.filter(i=>i.mkt!=="Not Listed").length;

  const NAV = [
    { id:"dashboard",   label:"Dashboard",   ico:Ic.home    },
    { id:"inventory",   label:"Inventory",   ico:Ic.box     },
    { id:"marketplace", label:"Marketplace", ico:Ic.store   },
    { id:"reports",     label:"Reports",     ico:Ic.chart   },
    { id:"settings",    label:"Settings",    ico:Ic.settings},
  ];
  const TITLES = { dashboard:"Dashboard", inventory:"Inventory", marketplace:"Marketplace", reports:"Reports", settings:"Settings" };

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        {/* Sidebar */}
        <aside className={`sidebar ${isDesk ? "" : mob ? "open" : "hidden"}`}
               style={isDesk ? {position:"relative",transform:"none"} : {}}>
          <div className="sb-root">
            <div className="sb-photo">
              <img src={usp(BG.sidebar,400,900)} alt=""/>
            </div>
            <div className="sb-inner">
              <div className="sb-logo">
                <span className="sb-glyph">🎭</span>
                <div className="sb-name">Theatre4u</div>
                <div className="sb-sub">Inventory & Marketplace</div>
              </div>

              <nav className="sb-nav">
                <div className="sb-label">Navigation</div>
                {NAV.map(n=>(
                  <div key={n.id} className={`sb-item ${page===n.id?"on":""}`} onClick={()=>nav(n.id)}>
                    <span className="sb-ico">{n.ico}</span>
                    <span>{n.label}</span>
                    {n.id==="inventory"  && items.length>0 && <span className="sb-badge">{items.length}</span>}
                    {n.id==="marketplace"&& listed>0       && <span className="sb-badge">{listed}</span>}
                  </div>
                ))}

                <div className="sb-label" style={{marginTop:14}}>Categories</div>
                {CATS.slice(0,7).map(cat=>{
                  const c=items.filter(i=>i.category===cat.id).length;
                  return(
                    <div key={cat.id} className="sb-item" style={{fontSize:12.5,padding:"6px 12px"}} onClick={()=>nav("inventory")}>
                      <span>{cat.icon}</span><span>{cat.label}</span>
                      {c>0&&<span className="sb-badge">{c}</span>}
                    </div>
                  );
                })}
              </nav>

              <div className="sb-foot">
                {org.name&&<div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.35)",marginBottom:8,textTransform:"uppercase",letterSpacing:1.5}}>🏛 {org.name}</div>}
                <button className="btn btn-o btn-sm btn-full" style={{color:"rgba(255,255,255,.45)",borderColor:"rgba(255,255,255,.1)",fontSize:12}} onClick={()=>nav("settings")}>
                  <span style={{width:13,height:13,display:"flex"}}>{Ic.settings}</span>Settings
                </button>
              </div>
            </div>
          </div>
        </aside>

        {mob && !isDesk && <div className="mob-overlay" onClick={()=>setMob(false)}/>}

        <div className="main">
          {/* Gold stripe */}
          <div style={{height:3,background:"linear-gradient(90deg,var(--gold),var(--amber),var(--gilt) 55%,transparent 82%)",flexShrink:0}}/>
          {/* Topbar */}
          <div className="topbar">
            <button className="menu-btn" onClick={()=>setMob(!mob)}>{mob?Ic.x:Ic.menu}</button>
            <span className="topbar-title">{TITLES[page]}</span>
          </div>
          {/* Content */}
          <div className="scroll-area" onClick={()=>mob&&setMob(false)}>
            {!loaded
              ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:18,color:"var(--faint)"}}>
                  <div style={{fontSize:52}}>🎭</div>
                  <div style={{fontFamily:"'Abril Fatface',display",fontSize:24,color:"var(--muted)"}}>Loading your collection…</div>
                  <div style={{width:32,height:32,border:"2.5px solid var(--linen)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
                </div>
              : <div className="fin">
                  {page==="dashboard"   && <Dashboard   items={items} org={org} goInventory={()=>nav("inventory")}/>}
                  {page==="inventory"   && <Inventory   items={items} onAdd={add} onEdit={edit} onDelete={del}/>}
                  {page==="marketplace" && <Marketplace items={items} org={org}/>}
                  {page==="reports"     && <Reports     items={items}/>}
                  {page==="settings"    && <Settings    org={org} setOrg={setOrg} onSeed={seed}/>}
                </div>
            }
          </div>
        </div>
      </div>

      {/* ── Floating CTA Button ── */}
      <div className="fab">
        <div style={{position:"relative"}}>
          <div className="fab-pulse"/>
          <button className="fab-btn" onClick={()=>{nav("inventory");setTimeout(()=>{const btn=document.querySelector(".btn-g");if(btn)btn.click()},300);}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Start Building Your Inventory
          </button>
        </div>
        <div className="fab-sub">✨ Free to get started — no credit card needed</div>
      </div>
    </>
  );
}
