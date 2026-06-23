// ── Global app stylesheet (design system) — extracted from App.jsx ──
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Lora:ital,wght@0,500;0,600;1,400;1,500&family=Raleway:wght@500;600;700;800&display=swap');
:root{
  --ink:#4c1035;--deep:#360b26;--cog:#9a5f1f;--amber:#996226;--gold:#a77134;--gilt:#da975a;
  --cream:#f5ede3;--parch:#ede0cf;--linen:#ddd0ba;--sand:#c8b895;
  --text:#352130;--muted:#6e4a5e;--faint:#8a5e2e;--border:#d8c6a6;
  /* Official logo palette (2026): aubergine, berry, apricot, bronze, sage */
  --brand-burgundy:#4c1035;--brand-magenta:#841c56;--brand-mint:#64a383;--brand-gold:#a77134;--brand-apricot:#da975a;--brand-black:#222222;
  --white:#ffffff;--red:#8b1a2a;--green:#3f7a5b;--blue:#1a3570;
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
.sb-glyph{display:none}
.sb-name{font-family:'Cormorant Garamond','Playfair Display',serif;font-size:27px;color:var(--gilt);letter-spacing:.8px;line-height:1;font-weight:700}
.sb-sub{font-size:9.5px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:3px;margin-top:6px;font-weight:700}
.sb-nav{padding:14px 10px;flex:1}
.sb-section{font-size:9px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,.2);padding:14px 12px 5px;font-weight:800}
.sb-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:6px;color:rgba(255,255,255,.82);cursor:pointer;font-size:13.5px;font-weight:600;margin-bottom:1px;transition:all .15s;border-left:3px solid transparent}
.sb-item:hover{background:rgba(255,255,255,.08);color:#fff}
.sb-item.on{background:rgba(212,168,67,.16);color:var(--gilt);border-left-color:var(--gold);padding-left:9px;font-weight:700}
.sb-ico{width:16px;height:16px;flex-shrink:0}
.sb-badge{margin-left:auto;background:rgba(255,255,255,.12);color:rgba(255,255,255,.65);font-size:11px;padding:1px 8px;border-radius:10px;font-weight:800}
.sb-item.on .sb-badge{background:rgba(212,168,67,.22);color:var(--gilt)}
.sb-foot{padding:16px 14px;border-top:1px solid rgba(212,168,67,.12)}

/* Topbar */
.topbar{display:flex;align-items:center;gap:14px;padding:14px 36px;border-bottom:1px solid var(--border);background:var(--cream);flex-shrink:0;position:relative}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--gold),var(--amber),var(--gilt) 50%,transparent 80%)}
.topbar-title{font-family:'Cormorant Garamond','Playfair Display',serif;font-size:27px;color:var(--ink);letter-spacing:.5px}
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
.hero-title{font-family:'Playfair Display',serif;font-size:52px;color:var(--white);line-height:1.05;margin-bottom:10px;text-shadow:0 3px 24px rgba(0,0,0,.45);white-space:pre-line}
.hero-sub{font-family:'Lora',serif;font-size:17px;font-style:italic;color:rgba(255,255,255,.72);max-width:520px;line-height:1.65}
.hero-bar{position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--gold),var(--gilt),transparent 75%)}

/* Section heading */
.sh{margin-bottom:22px}
.sh h2{font-family:'Playfair Display',serif;font-size:32px;color:var(--ink);line-height:1.1;margin-bottom:3px}
.sh p{font-family:'Lora',serif;font-size:15.5px;font-style:italic;color:var(--muted)}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:32px}
.stat{background:rgba(253,246,236,.9);border:1px solid var(--border);border-radius:var(--rm);padding:20px 18px;box-shadow:var(--sh1);backdrop-filter:blur(8px);position:relative;overflow:hidden;transition:box-shadow .18s,transform .18s}
.stat:hover{box-shadow:var(--sh2);transform:translateY(-2px)}
.stat-ico{font-size:26px;margin-bottom:9px}
.stat-val{font-family:'Playfair Display',serif;font-size:38px;color:var(--ink);line-height:1}
.stat-lbl{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-top:5px}

/* Mosaic */
.mosaic{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,155px);gap:10px;border-radius:var(--rm);overflow:hidden}
.mc{overflow:hidden;position:relative;cursor:pointer}
.mc>div:first-child{width:100%;height:100%;object-fit:cover;transition:transform .55s ease}
.mc:hover>div:first-child{transform:scale(1.04)}
.mc.big{grid-column:span 2;grid-row:span 2}
.mc-lbl{position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(transparent,rgba(18,6,0,.8));font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--white)}

/* Image divider */
.img-div{height:180px;border-radius:var(--rm);overflow:hidden;position:relative}
.img-div img{width:100%;height:100%;object-fit:cover;display:block}
.img-div-fade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,6,0,.83) 0%,rgba(18,6,0,.35) 60%,transparent 100%)}
.img-div-text{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;justify-content:center;padding:0 42px}
.img-div-text h3{font-family:'Playfair Display',serif;font-size:30px;color:var(--white);margin-bottom:5px}
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
.bd-both{background:var(--ink);color:var(--gilt)}
.sc-body{padding:14px 16px}
.sc-cat{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--amber);margin-bottom:4px}
.sc-name{font-family:'Lora',serif;font-size:17px;font-weight:600;color:var(--ink);margin-bottom:5px;line-height:1.3}
.sc-price{font-family:'Playfair Display',serif;font-size:19px;color:var(--cog)}

/* Category tiles */
.cat-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px}
.cat-tile{border-radius:var(--rm);overflow:hidden;cursor:pointer;position:relative;height:122px;box-shadow:var(--sh1);transition:all .2s}
.cat-tile:hover{box-shadow:var(--sh2);transform:translateY(-3px)}
.cat-tile>div{width:100%;height:100%!important;border-radius:0!important;transition:transform .55s}
.cat-tile:hover>div{transform:scale(1.06)}
.cat-tile::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 20%,rgba(18,6,0,.78))}
.cat-info{position:absolute;bottom:0;left:0;right:0;padding:10px 12px;z-index:1}
.cat-emo{font-size:18px;display:block;margin-bottom:2px}
.cat-name{font-size:12px;font-weight:800;color:var(--white);text-transform:uppercase;letter-spacing:.8px;line-height:1.2}
.cat-cnt{font-size:11px;color:rgba(255,255,255,.6);font-weight:600}

/* Inventory cards */
.inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(266px,1fr));gap:16px}
.inv-card{background:rgba(253,246,236,.93);border:1px solid var(--border);border-radius:var(--rm);overflow:hidden;cursor:pointer;transition:all .2s;box-shadow:var(--sh1);backdrop-filter:blur(4px);position:relative}
tr.select-row{cursor:pointer}tr.select-row:hover td{background:rgba(212,168,67,.04)}
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
.mb-loan{background:rgba(0,131,143,.1);color:#00838f}
.price{font-family:'Playfair Display',serif;font-size:18px;color:var(--cog)}

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
.btn-p{background:var(--ink);color:var(--gilt);border-color:var(--ink)}
.btn-p:hover:not(:disabled){background:var(--deep)}
.btn-g{background:linear-gradient(135deg,var(--gilt),var(--gold));color:#3a1414;border:none;font-weight:800;box-shadow:0 3px 12px rgba(196,118,26,.38)}
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
.modal{background:var(--cream);border-radius:var(--rl);width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;box-shadow:var(--sh3);animation:su .22s}
.modal-hd{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);background:var(--parch);border-radius:var(--rl) var(--rl) 0 0}
.modal-hd h2{font-family:'Playfair Display',serif;font-size:23px;color:var(--ink)}
.modal-bd{padding:24px;overflow-y:auto;flex:1}
.modal-ft{padding:16px 24px;border-top:2px solid var(--linen);background:var(--parch);border-radius:0 0 var(--rl) var(--rl);display:flex;gap:8px;justify-content:flex-end;flex-shrink:0}

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
.pgn button.on{background:var(--ink);color:var(--gilt);border-color:var(--ink)}
.pgn button:disabled{opacity:.3;cursor:not-allowed}

/* View toggle */
.vtog{display:flex;border:1.5px solid var(--border);border-radius:var(--r);overflow:hidden}
.vtog button{background:none;border:none;color:var(--muted);padding:7px 15px;cursor:pointer;font-size:13.5px;font-family:'Raleway',sans-serif;font-weight:800;transition:all .15s}
.vtog button.on{background:var(--ink);color:var(--gilt)}
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
.empty h3{font-family:'Playfair Display',serif;font-size:28px;color:var(--ink);margin-bottom:8px}
.empty p{font-family:'Lora',serif;font-style:italic;color:var(--muted);font-size:16px;margin-bottom:20px}

/* Pricing */
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:16px}
.pricing-card{background:#1e1208;border:1.5px solid rgba(212,168,67,.2);border-radius:var(--rm);padding:22px;transition:all .2s;color:#f0e6d3}
.pricing-card:hover{box-shadow:var(--sh2)}
.pricing-card.hot{background:#241808;border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,168,67,.2)}
.pname{font-family:'Playfair Display',serif;font-size:23px;color:var(--ink);margin-bottom:4px}
.pprice{font-family:'Playfair Display',serif;font-size:36px;color:var(--cog)}
.pprice span{font-size:14px;color:var(--muted);font-family:'Raleway',sans-serif;font-weight:600}
.pdesc{font-family:'Lora',serif;font-style:italic;font-size:14px;color:var(--muted);margin:8px 0 16px}
.pfeat{display:flex;align-items:flex-start;gap:7px;font-size:13.5px;font-weight:700;margin-bottom:7px;color:var(--text)}
.pfeat svg{width:14px;height:14px;color:var(--green);flex-shrink:0;margin-top:2px}

.mob-overlay{position:fixed;inset:0;background:rgba(18,6,0,.55);z-index:190}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes mkt-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
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
  /* Mobile font boosters */
  html,body,#root{font-size:16px}
  .sb-sub{font-size:11px}
  .sb-section{font-size:10px}
  .chip,.mkt-badge,.fl{font-size:13px}
  .inv-cat{font-size:12px}
  .stat-lbl{font-size:12px}
  th{font-size:12px;padding:9px 12px}
  td{padding:9px 12px;font-size:14px}
}

/* ── Readability overrides — ensure nothing is unreadably small ──────────── */
/* Minimum readable: labels/badges 12px, body 13px, headings 15px+ */
.fl{font-size:12px}                           /* form labels */
.sb-section{font-size:10px}                   /* sidebar section headers — stays small, all caps */
.sb-badge{font-size:12px}                     /* sidebar count badges */
.chip{font-size:12px}                         /* inventory chips */
.mkt-badge{font-size:12px}                    /* market status badges */
.inv-cat{font-size:12px}                      /* inventory category labels */
.sc-cat{font-size:12px}                       /* shop category label */
.stat-lbl{font-size:12px}                     /* stat card labels */
.dt-sec h3{font-size:12px}                    /* detail section headers */
.fbar label{font-size:11px}                   /* filter bar labels */
.cat-cnt{font-size:12px}                      /* category count */
/* Muted text contrast boost — minimum #8a7060 on light bg */
.sb-sub{color:rgba(255,255,255,.65)}          /* sidebar subtitle */
.faint{color:var(--muted)}                    /* faint → muted everywhere */

/* ── FLOATING CTA ─────────────────────────────────────────────── */
/* FAB removed — Upgrade button is now in sidebar */

/* ── Landing Page ─────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
:root{--bg:#0d0b11;--bg2:#15121b;--bg3:#1d1925;--bg3h:#252131;--bgi:#110f18;--bd:#282333;--bdl:#38324a;--t1:#ede8df;--t2:#9b93a8;--t3:#685f76;--goldd:#a37f2c;--grn:#4caf50;--blu:#42a5f5;--sh:0 4px 24px rgba(0,0,0,.4);--r:10px;--rs:6px;--tr:.2s ease}
.lp{min-height:100vh;background:var(--bg);color:var(--t1);overflow-x:hidden;font-family:'DM Sans',sans-serif}
.lp *{box-sizing:border-box;margin:0;padding:0}
.lp-grain{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)'/%3E%3C/svg%3E")}
.lpn{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 52px;transition:background .4s,border .4s}
.lpn.lpns{background:rgba(13,11,17,.94);border-bottom:1px solid rgba(212,168,67,.1);backdrop-filter:blur(14px)}
.lpnl{display:flex;align-items:center;gap:10px;cursor:pointer}
.lpni{width:34px;height:34px;background:linear-gradient(135deg,var(--gold),var(--goldd));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:17px}
.lpnt{font-family:'Playfair Display',serif;font-size:19px;font-weight:700;color:var(--gold)}
.lpnr{display:flex;align-items:center;gap:10px}
.lph{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:130px 24px 90px;position:relative;overflow:hidden}
.lph::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(212,168,67,.07) 0%,transparent 70%)}
.lph-curtl,.lph-curtr{position:absolute;top:0;bottom:0;width:clamp(40px,8vw,140px);pointer-events:none}
.lph-curtl{left:0;background:linear-gradient(to right,rgba(100,20,20,.28),transparent)}
.lph-curtr{right:0;background:linear-gradient(to left,rgba(100,20,20,.28),transparent)}
.lph-line{position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(to right,transparent 0%,rgba(212,168,67,.3) 40%,rgba(212,168,67,.3) 60%,transparent 100%)}
.lph-ew{font-size:10px;font-weight:600;letter-spacing:5px;text-transform:uppercase;color:var(--gold);margin-bottom:28px;display:flex;align-items:center;gap:14px;opacity:0;animation:lp-rise .9s ease .1s forwards}
.lph-ew::before,.lph-ew::after{content:'';flex:1;max-width:48px;height:1px;background:rgba(212,168,67,.4)}
.lph-h{font-family:'Cormorant Garamond',serif;font-size:clamp(54px,9vw,118px);font-weight:300;line-height:.9;letter-spacing:-.01em;margin-bottom:0;opacity:0;animation:lp-rise .9s ease .25s forwards}
.lph-h em{font-style:italic;color:var(--gold)}
.lph-h b{display:block;font-weight:700;color:var(--gold);font-size:clamp(46px,7.5vw,100px)}
.lph-sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(18px,2.4vw,26px);color:var(--t1);opacity:.8;max-width:520px;line-height:1.5;margin:32px auto 48px;opacity:0;animation:lp-rise .9s ease .4s forwards}
.lph-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;opacity:0;animation:lp-rise .9s ease .55s forwards}
.lp-btnp{display:inline-flex;align-items:center;gap:8px;padding:14px 34px;background:linear-gradient(135deg,var(--gold),var(--goldd));color:#1a0f00;border:none;border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:700;cursor:pointer;letter-spacing:.02em;transition:all .25s;box-shadow:0 0 36px rgba(212,168,67,.18)}
.lp-btnp:hover{transform:translateY(-2px);box-shadow:0 6px 44px rgba(212,168,67,.32);filter:brightness(1.08)}
.lp-btns2{display:inline-flex;align-items:center;gap:8px;padding:14px 30px;background:transparent;color:var(--t1);border:1px solid rgba(212,168,67,.22);border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:500;cursor:pointer;transition:all .25s}
.lp-btns2:hover{border-color:rgba(212,168,67,.5);background:rgba(212,168,67,.05)}
.lph-stats{display:flex;gap:52px;margin-top:80px;opacity:0;animation:lp-rise .9s ease .7s forwards;flex-wrap:wrap;justify-content:center}
.lph-sn{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:600;color:var(--gold);line-height:1}
.lph-sl{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--t3);margin-top:5px}
.lps{padding:100px 24px;max-width:1120px;margin:0 auto}
.lps-lbl{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--goldd);font-weight:600;margin-bottom:14px}
.lps-title{font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4.5vw,56px);font-weight:300;line-height:1.1;margin-bottom:20px}
.lps-title em{font-style:italic;color:var(--gold)}
.lps-sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:20px;color:var(--t2);max-width:560px;line-height:1.55}
.lp-divider{border:none;height:1px;background:linear-gradient(to right,transparent,var(--bd),transparent);margin:0}
.lpf-row{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;margin-bottom:96px}
.lpf-row.rev{direction:rtl}.lpf-row.rev>*{direction:ltr}
.lpf-vis{border-radius:14px;overflow:hidden;background:var(--bg2);border:1px solid var(--bd);aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;position:relative}
.lpf-vis::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(212,168,67,.04),transparent 55%)}
.lpf-demo{padding:20px;width:100%;font-size:12px}
.lpf-n{font-family:'Cormorant Garamond',serif;font-size:80px;font-weight:700;color:rgba(212,168,67,.06);line-height:1;margin-bottom:-10px}
.lpf-title{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,3.5vw,42px);font-weight:300;line-height:1.1;margin-bottom:14px}
.lpf-title em{font-style:italic;color:var(--gold)}
.lpf-body{font-size:14px;color:var(--t2);line-height:1.75;margin-bottom:22px}
.lpf-ul{list-style:none;display:flex;flex-direction:column;gap:9px}
.lpf-ul li{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--t2);line-height:1.5}
.lpf-ul li::before{content:'\u25C6';color:var(--goldd);font-size:7px;margin-top:6px;flex-shrink:0}
.lp-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:48px}
.lp-cat{background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:18px 14px;text-align:center;cursor:pointer;transition:all .25s}
.lp-cat:hover{border-color:rgba(212,168,67,.3);background:rgba(212,168,67,.04);transform:translateY(-3px)}
.lp-cat-ico{font-size:26px;margin-bottom:8px}
.lp-cat-lbl{font-size:12px;font-weight:500;color:var(--t2)}
.lp-tg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:48px}
.lp-tc{background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:28px}
.lp-tt{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:var(--t1);line-height:1.6;margin-bottom:20px}
.lp-tn{font-size:12.5px;font-weight:600;color:var(--gold)}
.lp-tr{font-size:11.5px;color:var(--t3);margin-top:2px}
.lp-pg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:52px}
.lp-pc{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:36px 28px;text-align:center;transition:all .3s}
.lp-pc:hover{transform:translateY(-4px)}
.lp-pc.feat{background:linear-gradient(145deg,#1c1108,var(--bg2));border-color:rgba(212,168,67,.45)}
.lp-pp{font-size:10px;text-transform:uppercase;letter-spacing:2.5px;color:var(--gold);font-weight:600;margin-bottom:14px}
.lp-pa{font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:600;color:var(--t1);line-height:1}
.lp-pper{font-size:13px;color:var(--t3);margin-bottom:28px}
.lp-pul{list-style:none;text-align:left;display:flex;flex-direction:column;gap:9px;margin-bottom:32px}
.lp-pul li{font-size:13px;color:var(--t2);display:flex;gap:9px;align-items:flex-start}
.lp-pul li::before{content:'\u2713';color:var(--gold);font-weight:700;flex-shrink:0}
.lp-cta{background:var(--bg2);border-top:1px solid rgba(212,168,67,.08);text-align:center;padding:120px 24px;position:relative;overflow:hidden}
.lp-cta::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:800px;background:radial-gradient(ellipse,rgba(212,168,67,.06),transparent 70%);pointer-events:none}
.lp-ft{background:var(--bg);border-top:1px solid var(--bd);padding:44px 52px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
.lp-fc{font-size:12px;color:var(--t3)}
.lp-fl{display:flex;gap:22px}
.lp-fl button{background:none;border:none;color:var(--t3);font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color .2s}
.lp-fl button:hover{color:var(--gold)}
.lp-ct{position:fixed;inset:0;z-index:9000;display:flex;pointer-events:none}
.lp-ctl,.lp-ctr{flex:1;background:var(--bg2);transition:transform .7s cubic-bezier(.77,0,.18,1)}
.lp-ctl{border-right:1px solid rgba(212,168,67,.35)}
.lp-ctr{border-left:1px solid rgba(212,168,67,.35)}
.lp-ct.open .lp-ctl{transform:translateX(-100%)}
.lp-ct.open .lp-ctr{transform:translateX(100%)}
@keyframes lp-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:900px){.lpn{padding:16px 20px}.lpf-row{grid-template-columns:1fr;gap:32px}.lpf-row.rev{direction:ltr}.lp-tg{grid-template-columns:1fr}.lp-pg{grid-template-columns:1fr}.lph-curtl,.lph-curtr{width:40px}.lp-ft{padding:32px 20px 20px}}
@media(max-width:600px){.lp-cats{grid-template-columns:repeat(3,1fr)}.lph-btns{flex-direction:column;align-items:stretch}.lph-btns button{justify-content:center}}
`;
