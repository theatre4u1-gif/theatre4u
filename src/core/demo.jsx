// DEMO MODE — full app on an in-memory store (theatre4u.org?demo=1).
// Extracted from App.jsx. createDemoStore + DEMO_ORG/DEMO_ITEMS are internal.
import React, { useState, useEffect } from "react";
import { AppRoot } from "./app-root.jsx";
import { ErrorBoundary } from "./ui.jsx";
import { CSS } from "./styles.js";

const DEMO_ORG = {
  id: "demo-org-id",
  name: "", // filled in during signup demo
  email: "",
  type: "", phone: "", location: "", bio: "",
  plan: "pro", temp_pro: true,
  director_name: "", director_title: "Theatre Director",
  label_prefix: "DEMO",
  is_leading_player: false,
  beta_acknowledged: false,
  profile_public: false,
  onboarding_step: 0,
  created_at: new Date().toISOString(),
};

const DEMO_ITEMS = [
  { id:"di1", name:"Victorian Ball Gown — Blue", category:"costumes", condition:"Good", size:"M", qty:1, location:"Costume Closet A", notes:"Used in A Christmas Carol 2024", mkt:"For Rent", avail:"In Stock", sale:0, rent:25, tags:["period","formal"], img:null, display_id:"DEMO-0001", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di2", name:"Pirate Hat Collection (6pc)", category:"costumes", condition:"Fair", size:"One Size", qty:6, location:"Costume Closet B", notes:"Assorted styles", mkt:"Not Listed", avail:"In Stock", sale:0, rent:0, tags:["adventure"], img:null, display_id:"DEMO-0002", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di3", name:"Wireless Handheld Mic — Shure SM58", category:"sound", condition:"Excellent", size:"N/A", qty:4, location:"Sound Booth", notes:"4 channels, includes cases", mkt:"For Rent", avail:"In Stock", sale:0, rent:15, tags:["audio"], img:null, display_id:"DEMO-0003", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di4", name:"LED Par Can RGBW", category:"lighting", condition:"New", size:"N/A", qty:12, location:"Lighting Storage", notes:"DMX controllable", mkt:"Rent or Sale", avail:"In Stock", sale:85, rent:10, tags:["dmx","led"], img:null, display_id:"DEMO-0004", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di5", name:"Fog Machine 1000W", category:"effects", condition:"Good", size:"N/A", qty:2, location:"Effects Cage", notes:"Includes remote", mkt:"For Rent", avail:"In Stock", sale:0, rent:20, tags:["atmosphere"], img:null, display_id:"DEMO-0005", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di6", name:"Forest Backdrop 8x12ft", category:"sets", condition:"Good", size:"N/A", qty:2, location:"Scene Shop", notes:"Painted muslin on frame", mkt:"For Rent", avail:"In Stock", sale:0, rent:40, tags:["outdoor"], img:null, display_id:"DEMO-0006", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di7", name:"Foam Rubber Swords (8pc)", category:"props", condition:"Fair", size:"N/A", qty:8, location:"Props Table", notes:"Safe for stage combat", mkt:"For Sale", avail:"In Stock", sale:12, rent:0, tags:["combat"], img:null, display_id:"DEMO-0007", org_id:"demo-org-id", added:new Date().toISOString() },
  { id:"di8", name:"Ben Nye Master Makeup Kit", category:"makeup", condition:"Good", size:"N/A", qty:3, location:"Dressing Room 1", notes:"Full spectrum palette", mkt:"Not Listed", avail:"In Stock", sale:0, rent:0, tags:["professional"], img:null, display_id:"DEMO-0008", org_id:"demo-org-id", added:new Date().toISOString() },
];

// In-memory store for demo — mimics Supabase table structure
function createDemoStore() {
  // Generic in-memory store — works for ANY table name automatically
  // Key: table name, Value: array of row objects
  const tables = {
    orgs:  [],
    items: [],
  };
  let seeded = false;

  const uid = () => "demo-" + Math.random().toString(36).slice(2,10);

  // Get or create a table
  const tbl = (name) => {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  };

  const mockTable = (table) => {
    const chain = {
      _filters: [],
      _data:    undefined,  // undefined = "not set", null = "explicitly null"
      _single:  false,
      _count:   false,

      select:   (cols) => {
        // If selecting with a nested join like "*, orgs(name,...)", enrich items with org data
        if (cols && typeof cols === "string" && cols.includes("orgs(") && table === "items") {
          chain._enrichWithOrg = true;
        }
        return chain;
      },
      order:    ()             => chain,
      limit:    ()             => chain,
      range:    ()             => chain,
      neq:      (col, val)     => { chain._filters.push(r => r[col] !== val); return chain; },
      gte:      (col, val)     => { chain._filters.push(r => r[col] >= val);  return chain; },
      lte:      (col, val)     => { chain._filters.push(r => r[col] <= val);  return chain; },
      lt:       (col, val)     => { chain._filters.push(r => r[col] < val);   return chain; },
      gt:       (col, val)     => { chain._filters.push(r => r[col] > val);   return chain; },
      ilike:    (col, val)     => { chain._filters.push(r => String(r[col]||"").toLowerCase().includes(String(val||"").toLowerCase().replace(/%/g,""))); return chain; },
      in:       (col, vals)    => { chain._filters.push(r => vals.includes(r[col])); return chain; },
      contains: ()             => chain,
      not:      ()             => chain,
      or:       ()             => chain,
      eq: (col, val) => {
        chain._filters.push(r => r[col] === val);
        return chain;
      },
      is: (col, val) => {
        chain._filters.push(r => val === null ? (r[col] == null) : r[col] === val);
        return chain;
      },
      single: () => { chain._single = true; return chain; },

      insert: (data) => {
        const rows = Array.isArray(data) ? data : [data];
        const inserted = rows.map(r => ({
          ...r,
          id:         r.id         || uid(),
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));
        tbl(table).push(...inserted);
        // Always store the array — then() will unwrap to single if .single() was chained
        chain._data = inserted;
        return chain;
      },

      upsert: (data, opts) => {
        const rows = Array.isArray(data) ? data : [data];
        const conflictKey = opts?.onConflict || "id";
        rows.forEach(r => {
          const store = tbl(table);
          const idx = store.findIndex(x => x[conflictKey] === r[conflictKey]);
          if (idx >= 0) {
            store[idx] = { ...store[idx], ...r, updated_at: new Date().toISOString() };
          } else {
            store.push({ ...r, id: r.id||uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }
        });
        const result = tbl(table).find(x => x[conflictKey] === rows[0]?.[conflictKey]);
        // Store as array so then() can unwrap for .single()
        chain._data = result ? [result] : [];
        return chain;
      },

      update: (data) => {
        const store = tbl(table);
        const updated = [];
        store.forEach((r, i) => {
          if (chain._filters.every(f => f(r))) {
            store[i] = { ...r, ...data, updated_at: new Date().toISOString() };
            updated.push(store[i]);
          }
        });
        // Store updated rows so chained .select().single() returns the row
        chain._data = updated;
        return chain;
      },

      delete: () => {
        tables[table] = tbl(table).filter(r => !chain._filters.every(f => f(r)));
        chain._data = null;
        return chain;
      },

      // Thenable — makes await work on every query
      then: (resolve, reject) => {
        try {
          let data;
          if (chain._data !== undefined) {
            data = chain._data;
            if (chain._single && Array.isArray(data)) data = data[0] || null;
          } else {
            const store = tbl(table);
            const filtered = store.filter(r => chain._filters.every(f => f(r)));
            data = chain._single ? (filtered[0] || null) : filtered;
          }
          // Enrich items with org data when a nested join was requested
          if (chain._enrichWithOrg && Array.isArray(data)) {
            const orgStore = tbl("orgs");
            data = data.map(item => {
              const org = orgStore.find(o => o.id === item.org_id) || {};
              return { ...item, orgs: {
                name: org.name || "Demo Theatre Program",
                location: org.location || "Demo City, CA",
                state: org.state || "CA",
                zipcode: org.zipcode || "92648",
                lat: null, lng: null,
                marketplace_enabled: true,
              }};
            });
          }
          const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
          resolve({ data, error: null, count });
        } catch(e) {
          if (reject) reject(e);
          else resolve({ data: null, error: e });
        }
      },
    };
    chain[Symbol.toStringTag] = "DemoQuery";
    return chain;
  };

  return {
    getStore: () => tables,
    seedItems: () => {
      if (!seeded) { tables.items = [...DEMO_ITEMS]; seeded = true; }
    },
    from: (table) => mockTable(table),
    rpc:  (fn, args) => {
      // Handle specific RPCs that need to return useful data
      if (fn === "generate_label_prefix") {
        const name = args?.p_name || "DEMO";
        const prefix = name.replace(/[^A-Z]/gi, "").toUpperCase().slice(0,4) || "DEMO";
        return Promise.resolve({ data: prefix, error: null });
      }
      // Credits spending always succeeds in demo
      if (fn === "spend_credits") return Promise.resolve({ data: { success: true }, error: null });
      // Points awarding, referrals, etc. — all succeed silently
      if (fn === "award_milestone_points")  return Promise.resolve({ data: null, error: null });
      if (fn === "award_referral_points")   return Promise.resolve({ data: null, error: null });
      if (fn === "get_my_credit_balance")   return Promise.resolve({ data: 150, error: null });
      if (fn === "points_eligible_in_days") return Promise.resolve({ data: 0,   error: null });
      if (fn === "lookup_label")            return Promise.resolve({ data: null, error: null });
      if (fn === "is_org_member")           return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getSession:        () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: ()=>{} } } }),
      signInWithPassword:() => Promise.resolve({ data: { user: null }, error: { message: "Demo mode" } }),
      signUp: (creds) => {
        const u = { id:"demo-user-id", email:creds.email, created_at:new Date().toISOString() };
        return Promise.resolve({ data: { user: u, session: { access_token:"demo-token", user:u } }, error: null });
      },
      signOut: () => { window.location.href = "https://theatre4u.org"; return Promise.resolve(); },
      admin: { getUserById: () => Promise.resolve({ data: null }) },
    },
    // Realtime — no-op in demo (no live updates needed)
    channel: (name) => {
      const noop = { on: ()=>noop, subscribe: ()=>noop, unsubscribe: ()=>{} };
      return noop;
    },
    removeChannel: () => {},
    removeAllChannels: () => {},
    storage: {
      from: () => ({
        upload:       () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        remove:       () => Promise.resolve({ data: null, error: null }),
      })
    },
  };
}

// Demo wrapper — replaces SB globally when ?demo=1
export function DemoApp() {
  const [started,  setStarted]  = useState(false);
  const [store]    = useState(() => createDemoStore());
  const [showNudge,setShowNudge]= useState(false);
  const [demoUser, setDemoUser] = useState(null); // set when user clicks "Enter Demo"

  const enterDemo = async (orgName="Demo Theatre Program") => {
    // Create the demo org in the in-memory store
    const user = { id:"demo-user-id", email:"demo@theatre4u.org", created_at:new Date().toISOString() };
    await store.from("orgs").upsert({
      id: user.id, name: orgName, email: user.email,
      type:"School", phone:"", location:"", bio:"",
      temp_pro:true, onboarding_step:0,
      plan:"pro", created_at:new Date().toISOString(),
      label_prefix:"DEMO",
    },{onConflict:"id",ignoreDuplicates:false});
    store.seedItems();
    setDemoUser(user);
  };

  useEffect(() => {
    window.__demoStore = store;
    window.__isDemo = true;
    setStarted(true);
    const t = setTimeout(() => setShowNudge(true), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [store]);

  if (!started) return null;

  // Don't render AppRoot until the user has clicked Enter Demo
  // Once demoUser is set, AppRoot mounts fresh with that user as the initial state
  if (!demoUser) return (
    <>
      <style>{CSS}</style>
      {/* Demo ribbon shown even on entry screen */}
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,
        background:"linear-gradient(135deg,#1a0d2e,#0d1225)",
        borderBottom:"2px solid #d4a843",
        padding:"7px 20px",display:"flex",alignItems:"center",
        justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎭</span>
          <span style={{fontWeight:800,color:"#d4a843",fontSize:14}}>Demo Mode</span>
          <span style={{color:"rgba(255,255,255,.55)",fontSize:12}}>
            — Nothing is saved. Close the tab to reset.
          </span>
        </div>
        <a href="https://theatre4u.org"
          style={{padding:"5px 14px",borderRadius:6,fontSize:12,fontWeight:600,
            color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.2)",
            textDecoration:"none"}}>
          Exit Demo
        </a>
      </div>
      {/* Entry screen */}
      <div style={{minHeight:"100vh",background:"#0d0b11",display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",padding:"80px 20px 40px",textAlign:"center",
        fontFamily:"'DM Sans',sans-serif",color:"#ede8df"}}>
        <div style={{fontSize:56,marginBottom:16}}>🎭</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,color:"#d4a843",marginBottom:8}}>
          Theatre4u™ Demo
        </div>
        <p style={{fontSize:16,color:"rgba(255,255,255,.55)",maxWidth:440,lineHeight:1.7,marginBottom:36}}>
          Explore the full platform with sample data. Add items, browse the Backstage Exchange,
          and see how Theatre4u works — no account needed.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:14,alignItems:"center",width:"100%",maxWidth:340}}>
          <button
            onClick={()=>enterDemo("Ocean View High School Drama")}
            style={{width:"100%",padding:"16px 32px",borderRadius:10,border:"none",
              background:"linear-gradient(135deg,#d4a843,#a37f2c)",color:"#1a0f00",
              fontSize:17,fontWeight:800,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              boxShadow:"0 4px 20px rgba(212,168,67,.3)"}}>
            🎭 Enter Demo →
          </button>
          <div style={{fontSize:13,color:"rgba(255,255,255,.35)"}}>
            — or personalize with your program name —
          </div>
          <div style={{display:"flex",gap:8,width:"100%"}}>
            <input
              id="demo-org-input"
              placeholder="e.g. Lincoln High Drama"
              style={{flex:1,padding:"11px 14px",borderRadius:8,
                border:"1px solid rgba(255,255,255,.15)",
                background:"rgba(255,255,255,.06)",color:"#fff",
                fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none"}}
              onKeyDown={e=>{
                if(e.key==="Enter"){
                  const v=e.target.value.trim();
                  enterDemo(v||"Ocean View High School Drama");
                }
              }}
            />
            <button
              onClick={()=>{
                const v=document.getElementById("demo-org-input")?.value?.trim();
                enterDemo(v||"Ocean View High School Drama");
              }}
              style={{padding:"11px 18px",borderRadius:8,
                border:"1px solid rgba(212,168,67,.4)",
                background:"rgba(212,168,67,.12)",color:"#d4a843",
                fontSize:14,fontWeight:700,cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"}}>
              Go →
            </button>
          </div>
          <a href="https://theatre4u.org?signup=1"
            style={{fontSize:13,color:"rgba(255,255,255,.3)",textDecoration:"none",marginTop:4}}>
            Ready to create a real account? →
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div style={{position:"relative"}}>
      {/* Demo ribbon */}
      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,
        background:"linear-gradient(135deg,#1a0d2e,#0d1225)",
        borderBottom:"2px solid var(--gold, #d4a843)",
        padding:"7px 20px",display:"flex",alignItems:"center",
        justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🎭</span>
          <span style={{fontWeight:800,color:"#d4a843",fontSize:14}}>Demo Mode</span>
          <span style={{color:"rgba(255,255,255,.55)",fontSize:12}}>
            — Experience Theatre4u as a new user. Nothing is saved. Close the tab to reset.
          </span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <a href="https://theatre4u.org" style={{padding:"5px 14px",borderRadius:6,
            fontSize:12,fontWeight:600,color:"rgba(255,255,255,.7)",
            border:"1px solid rgba(255,255,255,.2)",textDecoration:"none"}}>
            Exit Demo
          </a>
          <button onClick={()=>{
            // Carry over org name if user typed one during the demo
            const demoOrg = store.getStore().orgs?.[0];
            const orgName = demoOrg?.name || "";
            const email   = demoOrg?.email || "";
            // Store for pre-filling the real signup form
            try {
              if(orgName) sessionStorage.setItem("t4u_prefill_org",   orgName);
              if(email)   sessionStorage.setItem("t4u_prefill_email", email);
            } catch(e) {}
            window.location.href = "https://theatre4u.org?signup=1";
          }} style={{padding:"6px 16px",borderRadius:6,fontSize:13,fontWeight:700,
            color:"#1a0f00",background:"#d4a843",border:"none",cursor:"pointer",
            fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            ⭐ Create Real Account →
          </button>
        </div>
      </div>
      <div style={{paddingTop:40}}>
        {/* Timed conversion nudge — appears after 3 minutes */}
        {showNudge&&(
          <div style={{margin:"12px 16px 0",padding:"14px 18px",borderRadius:10,
            background:"linear-gradient(135deg,rgba(76,175,80,.15),rgba(76,175,80,.08))",
            border:"1px solid rgba(76,175,80,.35)",display:"flex",gap:12,
            alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:22}}>🎭</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"#4caf50",marginBottom:2}}>
                Ready to save your work?
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.65)",lineHeight:1.5}}>
                Everything you've done disappears when you close this tab.
                Create a free account to keep it — it takes 30 seconds.
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexShrink:0}}>
              <button onClick={()=>{
                const demoOrg = store.getStore().orgs?.[0];
                try {
                  if(demoOrg?.name)  sessionStorage.setItem("t4u_prefill_org",   demoOrg.name);
                  if(demoOrg?.email) sessionStorage.setItem("t4u_prefill_email", demoOrg.email);
                } catch(e) {}
                window.location.href = "https://theatre4u.org?signup=1";
              }} style={{padding:"8px 18px",borderRadius:7,border:"none",fontFamily:"inherit",
                fontSize:13,fontWeight:700,cursor:"pointer",
                background:"#4caf50",color:"#fff"}}>
                ⭐ Create Free Account
              </button>
              <button onClick={()=>setShowNudge(false)}
                style={{background:"none",border:"1px solid rgba(255,255,255,.15)",
                  borderRadius:7,padding:"8px 12px",color:"rgba(255,255,255,.5)",
                  fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                Maybe later
              </button>
            </div>
          </div>
        )}
        <ErrorBoundary><AppRoot demoStore={store} demoUser={demoUser} onEnterDemo={enterDemo}/></ErrorBoundary>
      </div>
    </div>
  );
}