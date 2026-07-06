// PREVIEW MODE + AI HELP BUBBLE — extracted from App.jsx (modularization).
// Both are AppRoot-level conditional UI; neither depends on AppRoot/DemoApp.
import React, { useState, useEffect, useRef } from "react";
import { SB } from "./supabase.js";
import { APP_NAME } from "./config.js";
import { QR } from "./qr.js";

export function AIHelpBubble({ user }) {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const EDGE_URL = "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/ai-help";

  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 120);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    setMsgs(p => [...p, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { data: { session } } = await SB.auth.getSession();
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": "Bearer " + session.access_token } : {}),
        },
        body: JSON.stringify({ messages: [...msgs, userMsg] }),
      });
      const json = await res.json();
      const reply = json.reply || "Sorry, I had trouble with that. Try emailing hello@theatre4u.org.";
      setMsgs(p => [...p, { role: "assistant", content: reply }]);
      if (!open) setUnread(true);
    } catch {
      setMsgs(p => [...p, { role: "assistant", content: "Connection error. Please check your internet and try again, or email hello@theatre4u.org." }]);
    }
    setLoading(false);
  };

  const bubbleStyle = {
    position: "fixed", bottom: 24, right: 24, zIndex: 9000,
    display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
    fontFamily: "'DM Sans', sans-serif",
  };
  const panelStyle = {
    width: 340, maxWidth: "calc(100vw - 32px)",
    height: 440, maxHeight: "calc(100vh - 120px)",
    background: "var(--bg2)", border: "1px solid var(--bd)",
    borderRadius: 16, display: "flex", flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,.5)",
    overflow: "hidden", animation: "su .2s ease",
  };

  return (
    <div style={bubbleStyle}>
      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#d4a843,#a37f2c)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 20 }}>🎭</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a0f00" }}>Theatre4u Help</div>
                <div style={{ fontSize: 11, color: "rgba(26,15,0,.65)" }}>Powered by Claude AI</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "rgba(0,0,0,.15)", border: "none", borderRadius: 6, color: "#1a0f00", cursor: "pointer", padding: "4px 8px", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 12px" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>👋</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, marginBottom: 6, color: "var(--t1)" }}>Hi! How can I help?</div>
                <div style={{ fontSize: 12.5, color: "var(--t3)", lineHeight: 1.6 }}>Ask me anything about Theatre4u — inventory, QR codes, Exchange, team sharing, and more.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 14 }}>
                  {["How do QR codes work?", "How do I invite my crew?", "What's in the Pro plan?", "How do I export my inventory?"].map(q => (
                    <button key={q} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 20, padding: "5px 11px", fontSize: 11.5, color: "var(--t2)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all .15s" }}
                      onMouseEnter={e => e.target.style.borderColor = "var(--gold)"}
                      onMouseLeave={e => e.target.style.borderColor = "var(--bd)"}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", padding: "9px 12px", borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                  background: m.role === "user" ? "linear-gradient(135deg,#d4a843,#a37f2c)" : "var(--bg3)",
                  color: m.role === "user" ? "#1a0f00" : "var(--t1)",
                  fontSize: 13, lineHeight: 1.55, border: m.role === "user" ? "none" : "1px solid var(--bd)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 5, padding: "8px 12px" }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gold)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.6 }}/>)}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bd)", flexShrink: 0, display: "flex", gap: 8, alignItems: "center", background: "var(--bg2)" }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ask anything…"
              style={{ flex: 1, background: "var(--bgi)", border: "1px solid var(--bd)", borderRadius: 8, padding: "8px 11px", color: "var(--t1)", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
              onFocus={e => e.target.style.borderColor = "var(--gold)"}
              onBlur={e => e.target.style.borderColor = "var(--bd)"}
            />
            <button onClick={send} disabled={!input.trim() || loading}
              style={{ background: "linear-gradient(135deg,#d4a843,#a37f2c)", border: "none", borderRadius: 8, padding: "8px 13px", cursor: input.trim() && !loading ? "pointer" : "not-allowed", opacity: input.trim() && !loading ? 1 : 0.5, fontSize: 16, display: "flex", alignItems: "center" }}>
              ➤
            </button>
          </div>
        </div>
      )}
      {/* Floating button */}
      <button onClick={() => setOpen(p => !p)}
        style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#d4a843,#a37f2c)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 20px rgba(212,168,67,.45)", transition: "all .2s", position: "relative" }}
        title="Get help"
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        {open ? "×" : "?"}
        {unread && !open && <span style={{ position: "absolute", top: 2, right: 2, width: 12, height: 12, background: "#c2185b", borderRadius: "50%", border: "2px solid var(--bg)" }}/>}
      </button>
    </div>
  );
}


// PREVIEW MODE -- guest exploration before sign-up
// Accessed via theatre4u.org?preview=1 or the "Take a Tour" button
// Shows sample inventory, demo UI, and a persistent sign-up prompt
const PREVIEW_ITEMS = [
  { id:"p1",  name:"Victorian Ball Gown — Blue",      category:"costumes",  condition:"Good",      size:"M",       qty:1,  location:"Costume Closet A",  notes:"Used in A Christmas Carol 2024", mkt:"For Rent",    avail:"In Stock", sale:0,  rent:25, tags:["period","formal"] },
  { id:"p2",  name:"Pirate Hat Collection (6pc)",     category:"costumes",  condition:"Fair",      size:"One Size",qty:6,  location:"Costume Closet B",  notes:"Assorted styles",               mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0,  tags:["adventure"] },
  { id:"p3",  name:"Wireless Handheld Mic — Shure",  category:"sound",     condition:"Excellent", size:"N/A",     qty:4,  location:"Sound Booth",       notes:"SM58 compatible, 4 channels",   mkt:"For Rent",    avail:"In Stock", sale:0,  rent:15, tags:["audio"] },
  { id:"p4",  name:"LED Par Can RGBW 54x3W",          category:"lighting",  condition:"New",       size:"N/A",     qty:12, location:"Lighting Storage",  notes:"DMX controllable",              mkt:"Rent or Sale",avail:"In Stock", sale:85, rent:10, tags:["dmx","led"] },
  { id:"p5",  name:"Wooden Throne Chair",             category:"furniture", condition:"Good",      size:"N/A",     qty:1,  location:"Scene Shop",        notes:"Gold painted, red velvet",      mkt:"For Rent",    avail:"In Stock", sale:0,  rent:30, tags:["royalty"] },
  { id:"p6",  name:"Fog Machine 1000W",              category:"effects",   condition:"Good",      size:"N/A",     qty:2,  location:"Effects Cage",      notes:"Includes remote",               mkt:"For Rent",    avail:"In Stock", sale:0,  rent:20, tags:["atmosphere"] },
  { id:"p7",  name:"Romeo and Juliet Scripts (30)",   category:"scripts",   condition:"Fair",      size:"N/A",     qty:30, location:"Library",           notes:"Director annotated",            mkt:"For Sale",    avail:"In Stock", sale:5,  rent:0,  tags:["shakespeare"] },
  { id:"p8",  name:"Ben Nye Master Makeup Kit",       category:"makeup",    condition:"Good",      size:"N/A",     qty:3,  location:"Dressing Room 1",   notes:"Full spectrum",                 mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0,  tags:["professional"] },
  { id:"p9",  name:"Forest Backdrop Flat 8x12ft",     category:"sets",      condition:"Good",      size:"N/A",     qty:2,  location:"Scene Shop",        notes:"Painted muslin on frame",       mkt:"For Rent",    avail:"In Stock", sale:0,  rent:40, tags:["outdoor"] },
  { id:"p10", name:"DeWalt Cordless Drill 20V",       category:"tools",     condition:"Good",      size:"N/A",     qty:2,  location:"Tool Cabinet",      notes:"With charger and bits",         mkt:"Not Listed",  avail:"In Stock", sale:0,  rent:0,  tags:["power tool"] },
  { id:"p11", name:"Foam Rubber Swords (8pc)",        category:"props",     condition:"Fair",      size:"N/A",     qty:8,  location:"Props Table",       notes:"Safe for stage combat",         mkt:"For Sale",    avail:"In Stock", sale:12, rent:0,  tags:["combat"] },
  { id:"p12", name:"Black Velvet Main Drape 20x40",   category:"fabrics",   condition:"Excellent", size:"N/A",     qty:1,  location:"Fly Loft",          notes:"Flame retardant",               mkt:"Not Listed",  avail:"In Use",   sale:0,  rent:0,  tags:["main stage"] },
];

const PREVIEW_CATS = {
  costumes:"🥻",props:"🎭",sets:"🏗️",lighting:"💡",sound:"🔊",
  scripts:"📜",makeup:"💄",furniture:"🪑",fabrics:"🧵",tools:"🔧",effects:"✨",other:"📦"
};

export function PreviewMode({ onSignUp }) {
  const [tab,     setTab]     = React.useState("inventory");
  const [search,  setSearch]  = React.useState("");
  const [catF,    setCatF]    = React.useState("all");
  const [detail,  setDetail]  = React.useState(null);
  const [showCTA, setShowCTA] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setShowCTA(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const filtered = PREVIEW_ITEMS.filter(i => {
    if (catF !== "all" && i.category !== catF) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())
        && !i.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalItems = PREVIEW_ITEMS.length;
  const listed     = PREVIEW_ITEMS.filter(i => i.mkt !== "Not Listed").length;
  const totalQty   = PREVIEW_ITEMS.reduce((s, i) => s + i.qty, 0);
  const estValue   = PREVIEW_ITEMS.reduce((s, i) => s + (i.sale * i.qty), 0);

  const gold = "#d4a843", dark = "#1a0f00", bg = "#0d0b11", bg2 = "#15121b";
  const bd = "#282333", t1 = "#ede8df", t2 = "#9b93a8", t3 = "#685f76";

  const navs = [
    { id:"dashboard",  label:"Dashboard",         icon:"⌂" },
    { id:"inventory",  label:"Inventory",          icon:"📦" },
    { id:"marketplace",label:"Backstage Exchange", icon:"🏪" },
    { id:"reports",    label:"Reports",            icon:"📊" },
    { id:"funding",    label:"Funding Tracker",    icon:"💰" },
  ];

  const GoldBtn = ({ label, onClick, style = {} }) => (
    <button onClick={onClick} style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
      padding:"9px 20px", borderRadius:8, fontFamily:"'DM Sans',sans-serif",
      fontSize:14, fontWeight:700, cursor:"pointer", border:"none",
      background:`linear-gradient(135deg,${gold},#a37f2c)`, color:dark,
      transition:"all .2s", ...style
    }}>{label}</button>
  );

  const mktColor = (mkt) =>
    mkt === "Not Listed" ? "rgba(107,100,120,.5)"
    : mkt.includes("Rent") ? "rgba(66,165,245,.8)"
    : "rgba(76,175,80,.8)";

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden",
      background:bg, color:t1, fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>

      {/* Preview banner */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:9999,
        background:"linear-gradient(135deg,rgba(212,168,67,.97),rgba(163,127,44,.97))",
        padding:"9px 20px", display:"flex", alignItems:"center",
        justifyContent:"space-between", gap:12, flexWrap:"wrap",
        boxShadow:"0 2px 12px rgba(0,0,0,.4)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>🎭</span>
          <span style={{ fontWeight:800, color:dark, fontSize:14 }}>Preview Mode</span>
          <span style={{ color:"rgba(26,15,0,.65)", fontSize:12 }}>
            — Explore Theatre4u with sample data. No account needed.
          </span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => window.location.href = "https://theatre4u.org"}
            style={{ padding:"6px 14px", borderRadius:6, fontFamily:"'DM Sans',sans-serif",
              fontSize:12, fontWeight:600, cursor:"pointer",
              background:"rgba(0,0,0,.15)", border:"1px solid rgba(0,0,0,.2)", color:dark }}>
            Sign In
          </button>
          <GoldBtn label="Start Free Account →" onClick={onSignUp}
            style={{ padding:"6px 18px", fontSize:13 }}/>
        </div>
      </div>

      {/* Sidebar */}
      <aside style={{ width:224, minWidth:224, background:bg2,
        borderRight:`1px solid ${bd}`, display:"flex", flexDirection:"column",
        paddingTop:48, overflowY:"auto", zIndex:100 }}>
        <div style={{ padding:"18px 14px", borderBottom:`1px solid ${bd}`,
          display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:8, fontSize:20,
            background:`linear-gradient(135deg,${gold},#a37f2c)`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>🎭</div>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16,
              fontWeight:700, color:gold }}>{APP_NAME}</div>
            <div style={{ fontSize:9, color:t3, textTransform:"uppercase", letterSpacing:2 }}>
              Ocean View Drama
            </div>
          </div>
        </div>

        <nav style={{ padding:"12px 8px", flex:1 }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:2,
            color:t3, padding:"8px 10px 4px" }}>Main</div>
          {navs.map(n => (
            <div key={n.id} onClick={() => setTab(n.id)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
                borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:500, marginBottom:1,
                color: tab === n.id ? gold : t2,
                background: tab === n.id
                  ? "linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04))"
                  : "transparent",
                border: `1px solid ${tab === n.id ? "rgba(212,168,67,.2)" : "transparent"}` }}>
              <span style={{ fontSize:15 }}>{n.icon}</span>
              {n.label}
              {n.id === "inventory" && (
                <span style={{ marginLeft:"auto", background:bg, padding:"1px 6px",
                  borderRadius:9, fontSize:10, color:t3 }}>{totalItems}</span>
              )}
            </div>
          ))}
        </nav>

        <div style={{ padding:12, borderTop:`1px solid ${bd}` }}>
          <div style={{ background:"rgba(212,168,67,.08)", border:"1px solid rgba(212,168,67,.2)",
            borderRadius:10, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:gold, marginBottom:4 }}>
              🎟 Join for Free
            </div>
            <div style={{ fontSize:11, color:t2, lineHeight:1.5, marginBottom:8 }}>
              Create your program's inventory, earn Stage Points, and share with nearby schools.
            </div>
            <GoldBtn label="Start Free →" onClick={onSignUp}
              style={{ width:"100%", fontSize:12, padding:"8px 12px" }}/>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, display:"flex", flexDirection:"column",
        overflow:"hidden", paddingTop:42 }}>
        <div style={{ padding:"12px 24px", borderBottom:`1px solid ${bd}`,
          background:bg2, display:"flex", alignItems:"center", gap:12 }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700 }}>
            {navs.find(n => n.id === tab)?.label}
          </h1>
          <span style={{ marginLeft:"auto", fontSize:11, color:gold, fontWeight:600,
            background:"rgba(212,168,67,.1)", border:"1px solid rgba(212,168,67,.2)",
            padding:"3px 10px", borderRadius:12 }}>
            👁 Preview — sample data only
          </span>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, marginBottom:4 }}>
                Welcome to Ocean View Drama
              </h2>
              <p style={{ color:t2, fontSize:13, marginBottom:20 }}>
                Your theatre inventory at a glance. (Sample data)
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",
                gap:12, marginBottom:20 }}>
                {[
                  { icon:"📦", label:"Cataloged Items",  val:totalItems },
                  { icon:"🔢", label:"Total Quantity",    val:totalQty },
                  { icon:"🏪", label:"Listed / Shared",   val:listed },
                  { icon:"💰", label:"Est. Sale Value",   val:"$"+estValue.toLocaleString() },
                ].map(s => (
                  <div key={s.label} style={{ background:bg2, border:`1px solid ${bd}`,
                    borderRadius:10, padding:16, textAlign:"center" }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22,
                      fontWeight:700, color:gold }}>{s.val}</div>
                    <div style={{ fontSize:11, color:t3, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10, padding:16, marginBottom:20 }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:16, marginBottom:12 }}>
                  What Theatre4u™ Does
                </h3>
                {[
                  ["📦","Inventory Management","Catalog every costume, prop, light, and piece of gear with photos, QR labels, and condition tracking."],
                  ["🔲","QR Code Labels","Print scannable labels for any item. Any phone camera looks it up instantly."],
                  ["🏪","Backstage Exchange","Share items with other theatre programs near you — rent, loan, or sell gear to your neighbours."],
                  ["🪙","Stage Points","Earn points for cataloging and sharing inventory. Redeem for free months or Exchange discounts."],
                  ["💰","Funding Tracker","Track grants, Prop 28 funds, and spending. Generate accountability reports for principals and boards."],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ display:"flex", gap:12, padding:"10px 0",
                    borderBottom:`1px solid rgba(255,255,255,.05)` }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{title}</div>
                      <div style={{ fontSize:12, color:t2, lineHeight:1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <GoldBtn label="🎟 Create Your Free Account →" onClick={onSignUp}
                  style={{ fontSize:15, padding:"12px 32px" }}/>
                <div style={{ fontSize:12, color:t3, marginTop:8 }}>
                  No credit card required · Free forever for basic use
                </div>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div>
              <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ position:"relative" }}>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search items…"
                    style={{ background:"#110f18", border:`1px solid ${bd}`, borderRadius:8,
                      padding:"7px 10px 7px 32px", color:t1, fontSize:13, width:220, outline:"none" }}/>
                  <span style={{ position:"absolute", left:10, top:"50%",
                    transform:"translateY(-50%)", fontSize:14, color:t3 }}>🔍</span>
                </div>
                <select value={catF} onChange={e => setCatF(e.target.value)}
                  style={{ background:"#110f18", border:`1px solid ${bd}`, borderRadius:8,
                    padding:"7px 10px", color:t1, fontSize:13, outline:"none" }}>
                  <option value="all">All Categories</option>
                  {Object.keys(PREVIEW_CATS).map(c => (
                    <option key={c} value={c}>
                      {PREVIEW_CATS[c]} {c[0].toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize:12, color:t3 }}>{filtered.length} items</span>
                <button onClick={() => setShowCTA(true)}
                  style={{ marginLeft:"auto", padding:"7px 14px", borderRadius:8,
                    fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700,
                    cursor:"pointer", background:"rgba(212,168,67,.12)",
                    border:"1px solid rgba(212,168,67,.25)", color:gold }}>
                  + Add Item (sign up first)
                </button>
              </div>

              <div style={{ display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
                {filtered.map(item => (
                  <div key={item.id} onClick={() => setDetail(item)}
                    style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:10,
                      padding:14, cursor:"pointer", transition:"border-color .2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(212,168,67,.4)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = bd}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
                      <div style={{ fontSize:24, flexShrink:0 }}>{PREVIEW_CATS[item.category] || "📦"}</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, lineHeight:1.3 }}>{item.name}</div>
                        <div style={{ fontSize:11, color:t3, marginTop:2 }}>{item.location}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                      {[item.condition, `x${item.qty}`, item.avail].map(tag => (
                        <span key={tag} style={{ fontSize:10, padding:"2px 7px",
                          background:"rgba(255,255,255,.05)", borderRadius:4, color:t2 }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background: mktColor(item.mkt) + "22", color: mktColor(item.mkt) }}>
                        {item.mkt}
                      </span>
                      {(item.rent > 0 || item.sale > 0) && (
                        <span style={{ fontSize:12, fontWeight:700, color:gold }}>
                          {item.rent > 0 ? `$${item.rent}/wk` : ""}
                          {item.rent > 0 && item.sale > 0 ? " · " : ""}
                          {item.sale > 0 ? `$${item.sale}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {detail && (
                <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)",
                  zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
                  onClick={e => e.target === e.currentTarget && setDetail(null)}>
                  <div style={{ background:bg2, border:`1px solid ${bd}`, borderRadius:14,
                    width:"100%", maxWidth:520, padding:24, boxShadow:"0 8px 48px rgba(0,0,0,.5)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"flex-start", marginBottom:16 }}>
                      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                        <div style={{ fontSize:32 }}>{PREVIEW_CATS[detail.category] || "📦"}</div>
                        <div>
                          <div style={{ fontFamily:"'Playfair Display',serif",
                            fontSize:18, fontWeight:700 }}>{detail.name}</div>
                          <div style={{ fontSize:12, color:t3, marginTop:2 }}>
                            {detail.category} · {detail.condition}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setDetail(null)}
                        style={{ background:"none", border:`1px solid ${bd}`, color:t2,
                          borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:16,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                    </div>
                    {[
                      ["Location",      detail.location || "—"],
                      ["Quantity",      detail.qty],
                      ["Availability",  detail.avail],
                      ["Market Status", detail.mkt],
                      ...(detail.rent > 0 ? [["Rental Price", `$${detail.rent}/week`]] : []),
                      ...(detail.sale > 0 ? [["Sale Price",   `$${detail.sale}`]]      : []),
                      ...(detail.notes    ? [["Notes",        detail.notes]]            : []),
                    ].map(([l, v]) => (
                      <div key={l} style={{ display:"flex", padding:"7px 0",
                        borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                        <span style={{ width:130, color:t3, fontSize:12, flexShrink:0 }}>{l}</span>
                        <span style={{ fontSize:13 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop:16, padding:12, background:"rgba(212,168,67,.06)",
                      border:"1px solid rgba(212,168,67,.15)", borderRadius:9, textAlign:"center" }}>
                      <div style={{ fontSize:12, color:t2, marginBottom:8 }}>
                        Sign up to manage your own inventory, add photos, and print QR labels.
                      </div>
                      <GoldBtn label="🎟 Start Free Account →" onClick={onSignUp}
                        style={{ width:"100%" }}/>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OTHER TABS — teaser */}
          {(tab === "marketplace" || tab === "reports" || tab === "funding") && (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ fontSize:56, marginBottom:16 }}>
                {tab === "marketplace" ? "🏪" : tab === "reports" ? "📊" : "💰"}
              </div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26,
                fontWeight:700, marginBottom:10 }}>
                {tab === "marketplace" ? "Backstage Exchange"
                  : tab === "reports"    ? "Reports & Analytics"
                  : "Funding Tracker"}
              </div>
              <div style={{ color:t2, fontSize:14, maxWidth:480, margin:"0 auto 28px", lineHeight:1.8 }}>
                {tab === "marketplace" && "Browse and request items from theatre programs near you — or list your own inventory to share with the community. Free loans between district schools, rentals, and sales."}
                {tab === "reports"    && "Category breakdowns, condition reports, platform utilization reports for principals, and CSV export. The Platform Usage Report is designed to hand to an administrator showing how Theatre4u protects program assets."}
                {tab === "funding"    && "Track grants, Prop 28 funds, and all program spending. Generate accountability reports for principals, arts directors, and boards — formatted and print-ready in one click."}
              </div>
              <GoldBtn label="🎟 Create Free Account to Access →" onClick={onSignUp}
                style={{ fontSize:14, padding:"12px 32px" }}/>
              <div style={{ fontSize:12, color:t3, marginTop:10 }}>
                Full platform access · No credit card required
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Floating CTA (appears after 20s) */}
      {showCTA && (
        <div style={{ position:"fixed", bottom:20, right:20, zIndex:9998,
          background:bg2, border:"1px solid rgba(212,168,67,.4)", borderRadius:14,
          padding:"16px 18px", maxWidth:280, boxShadow:"0 8px 32px rgba(0,0,0,.5)" }}>
          <button onClick={() => setShowCTA(false)}
            style={{ position:"absolute", top:8, right:10, background:"none",
              border:"none", color:t3, cursor:"pointer", fontSize:16 }}>×</button>
          <div style={{ fontSize:24, marginBottom:8 }}>🎟</div>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:4, color:t1 }}>
            Ready to try it for your program?
          </div>
          <div style={{ fontSize:12, color:t2, lineHeight:1.5, marginBottom:12 }}>
            Free to start. No credit card. Your inventory, QR labels, and Backstage Exchange access in under 5 minutes.
          </div>
          <GoldBtn label="Start Free Account →" onClick={onSignUp}
            style={{ width:"100%", fontSize:13 }}/>
        </div>
      )}
    </div>
  );
}