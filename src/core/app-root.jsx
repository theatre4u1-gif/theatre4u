// APP ROOT — the main authenticated app shell/router. Extracted from App.jsx.
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SB, activateDemoStore, callEdgeFn } from "./supabase.js";
import { getVertical, getCats, getCatGfx, VERTICALS_LIST, getExchangeName, getTerm } from "../lib/verticals.js";
import { US_STATES, STATE_NAMES, zipToCoords, milesBetween, geocodeLocation } from "../lib/geo.js";
import { BG, usp } from "../lib/backgrounds.js";
import { CSS } from "./styles.js";
import { EM } from "./messages.js";
import { TERMS_CONTENT, PRIVACY_CONTENT } from "./legal.js";
import { authErrKey, getRefCode, isDemoMode, fmt$, parseCSV, autoMatch, postShareText, resizeImg, fbShare, getPointsName, itemShareUrl, itemShareText, CSV_FIELDS, uid } from "./helpers.js";
import { AuthOverlay } from "./auth.jsx";
import { STRIPE_LINKS, stripeLink, PLANS_DEF, UPGRADE_PLANS } from "./plans.js";
import { UpgradePrompt, UpgradePlans } from "./billing.jsx";
import { CAT_GFX, CATS, CAT, CAT_MAP, CONDS, SIZES, AVAIL, MKT, setCustomCats, customCatsFor, getCatsMerged } from "./inventory.js";
import { AdminHub, DistrictDashboard } from "./admin.jsx";
import { LabelsPage } from "./labels.jsx";
import { OrgProfilePage } from "./profile.jsx";
import { Prop28Page } from "./prop28.jsx";
import { Messages } from "./chat.jsx";
import { CreditsPage } from "./points.jsx";
import { Reports } from "./reports.jsx";
import { FundingPage } from "./funding.jsx";
import { ExternalLoans } from "./external-loans.jsx";
import { HOSTNAME, IS_THEATRE4U, IS_ARTSTRACKER, APP_NAME, APP_SUBTITLE, APP_EMAIL, APP_URL, ADMIN_EMAILS, isAdminEmail, ADMIN_EMAIL, LOGO_ICON, FAVICON, TOUCH_ICON, LOGO_FULL } from "./config.js";
import { POINT_EARN_RATES, POINTS_PER_DOLLAR, POINTS_FREE_MONTH, POINTS_MAX_BALANCE, POINTS_EXPIRE_DAYS, PLATFORM_FEE_PCT, POINTS_MIN_REDEEM, MILESTONE_POINTS } from "./points-config.js";
import { Ic } from "./icons.jsx";
import { Pager, Modal, FbShareBtn, HeroImg, CatCard, CatThumb, LegalModal, LogoMarkDark, LogoMarkLight } from "./ui.jsx";
import { FeedbackWidget } from "./feedback.jsx";
import { PIN_COLORS, ROW_LABELS, COL_LABELS } from "./storage-map.js";
import { QR } from "./qr.js";
import { ItemForm, ItemDetail } from "./items.jsx";
import { Dashboard } from "./dashboard.jsx";
import { Inventory } from "./inventory-page.jsx";
import { MarketplaceGate, CSVImport } from "./marketplace.jsx";
import { Requests } from "./requests.jsx";
import { Productions } from "./productions.jsx";
import { CommunityGate } from "./community.jsx";
import { Settings } from "./settings.jsx";
import { LandingPage, PublicOrgPage, PublicItemPage } from "./public.jsx";
import { AIHelpBubble, PreviewMode } from "./preview.jsx";
import { OnboardingOverlay } from "./onboarding.jsx";
import { LocationsPanel } from "./locations.jsx";

function makeSamples(){
  return [
    {name:"Victorian Ball Gown – Blue",   category:"costumes", condition:"Good",     size:"M",       qty:1, location:"Storage Room A",notes:"Used in A Christmas Carol 2024",mkt:"For Rent",   rent:25,sale:0, avail:"In Stock",tags:["period","formal"],img:null},
    {name:"Pirate Hat Collection (6 pc)", category:"costumes", condition:"Fair",     size:"One Size",qty:6, location:"Storage Room B",notes:"Assorted styles",              mkt:"Not Listed", rent:0, sale:0, avail:"In Stock",tags:["adventure"],      img:null},
    {name:"Wireless Mic – Shure SM58",    category:"sound",    condition:"Excellent",size:"N/A",     qty:4, location:"Sound Booth",     notes:"4 channels, wireless",         mkt:"For Rent",   rent:15,sale:0, avail:"In Stock",tags:["audio"],          img:null},
    {name:"LED Par Can RGBW 54×3W",       category:"lighting", condition:"New",      size:"N/A",     qty:12,location:"Lighting Storage",notes:"DMX controllable",             mkt:"Rent or Sale",rent:10,sale:85,avail:"In Stock",tags:["dmx","led"],      img:null},
    {name:"Wooden Throne Chair",          category:"furniture",condition:"Good",     size:"N/A",     qty:1, location:"Workroom",      notes:"Gold painted, red velvet",     mkt:"For Rent",   rent:30,sale:0, avail:"In Stock",tags:["royalty"],         img:null},
    {name:"Fog Machine 1000W",            category:"effects",  condition:"Good",     size:"N/A",     qty:2, location:"Effects Cage",    notes:"Includes remote",              mkt:"For Rent",   rent:20,sale:0, avail:"In Stock",tags:["atmosphere"],      img:null},
    {name:"Romeo & Juliet Scripts (30)",  category:"scripts",  condition:"Fair",     size:"N/A",     qty:30,location:"Library",        notes:"Director annotated",            mkt:"For Sale",   rent:0, sale:5, avail:"In Stock",tags:["shakespeare"],     img:null},
    {name:"Forest Backdrop Flat 8×12ft",  category:"sets",     condition:"Good",     size:"N/A",     qty:2, location:"Workroom",      notes:"Painted muslin on frame",      mkt:"For Rent",   rent:40,sale:0, avail:"In Stock",tags:["outdoor"],         img:null},
    {name:"Ben Nye Master Makeup Kit",    category:"makeup",   condition:"Good",     size:"N/A",     qty:3, location:"Dressing Room 1", notes:"Full spectrum",                mkt:"Not Listed", rent:0, sale:0, avail:"In Stock",tags:["professional"],    img:null},
    {name:"Foam Rubber Swords (8 pc)",    category:"props",    condition:"Fair",     size:"N/A",     qty:8, location:"Props Table",     notes:"Safe for stage combat",        mkt:"For Sale",   rent:0, sale:12,avail:"In Stock",tags:["combat"],          img:null},
  ].map(i=>({...i,id:uid(),added:new Date().toISOString()}));
}

export function AppRoot({ demoStore = null, demoUser = null, onEnterDemo = null }){
  const isDemo = !!demoStore;
  activateDemoStore(demoStore);
  // In demo mode, use the pre-built demo user if provided
  const [user,setUser] = useState(demoUser);
  // ── Hash routing: #/item/:id and #/location/:id (storage location QR codes) ──
  const _parseHash = (h) => ({
    itemId:     (h.match(/^#\/item\/(.+)$/)     || [])[1] || null,
    locationId: (h.match(/^#\/location\/(.+)$/) || [])[1] || null,
    orgSlug:    (h.match(/^#\/org\/(.+)$/)      || [])[1] || null,
  });
  const [publicItemId,     setPublicItemId]     = useState(() => _parseHash(window.location.hash).itemId);
  const [deepLinkLocation, setDeepLinkLocation] = useState(() => _parseHash(window.location.hash).locationId);
  const [deepLinkCategory, setDeepLinkCategory] = useState(null);
  const [publicOrgSlug,    setPublicOrgSlug]    = useState(() => _parseHash(window.location.hash).orgSlug);
  useEffect(()=>{
    const onHash = () => {
      const { itemId, locationId, orgSlug } = _parseHash(window.location.hash);
      setPublicItemId(itemId);
      setDeepLinkLocation(locationId);
      setPublicOrgSlug(orgSlug);
      if (locationId && !itemId) setPage("inventory");
    };
    window.addEventListener("hashchange", onHash);
    // Also handle the case where the page loads with an existing hash
    // (e.g. second scan: browser already at #/item/X, so hashchange doesn't fire)
    // We handle this by watching document visibility — when user returns from camera
    const onVisible = () => {
      const { itemId } = _parseHash(window.location.hash);
      if(itemId) setPublicItemId(p => p === itemId ? itemId + " " : itemId); // force re-render
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const [items,setItems]   = useState([]);
  const [org,setOrg]       = useState({name:"",type:"",email:"",phone:"",location:"",bio:""});
  const [plan,setPlanState] = useState("free"); // derived from org.plan
  const [page,setPage]     = useState("dashboard");
  const [legalPage,setLegalPage] = useState(null);
  const [mob,setMob]       = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [authChk,setAuthChk] = useState(false);
  // Preview mode -- ?preview=1 in URL shows the platform with sample data (no login required)
  const [previewMode, setPreviewMode] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1"
  );
  // District: activeSchool = null means "own account", otherwise = school org object
  const [activeSchool,setActiveSchool]   = useState(null);
  const [memberRole,  setMemberRole]    = useState(null); // null=owner/director, or stage_manager/crew/house/program_director
  const [memberships, setMemberships]   = useState([]); // all program memberships (for multi-program directors)
  const [activeVertical, setActiveVertical] = useState(null); // active department for multi-vertical accounts; null until org loads
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [openConvId,    setOpenConvId]    = useState(null);
  const [pendingReqCount, setPendingReqCount] = useState(0);
  const [creditBalance, setCreditBalance] = useState(0);
  const [onboardingStep, setOnboardingStep] = useState(null); // null=loading, 0-4
  const [schoolItems,setSchoolItems]     = useState([]);
  const [schoolLoading,setSchoolLoading] = useState(false);
  const [custCatVer,setCustCatVer] = useState(0); // bumped when custom categories reload, forces re-render
  const [facDistrict,setFacDistrict]= useState(null); // district this user facilitates (full-edit browse), or null
  const [facSchools, setFacSchools] = useState([]);   // schools in the facilitated district
  const [ownsDistrict,setOwnsDistrict] = useState(false); // true if this user owns a district — show District tab from any of their orgs
  // Invite token from URL — persisted in localStorage so it survives
  // Supabase's email confirmation redirect (which strips query params)
  const [pendingInvite,setPendingInvite] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const fromUrl = p.get("invite") || p.get("token");
    // Also capture join codes from URL e.g. ?code=Y8H-YMH
    const codeFromUrl = p.get("code");
    if (codeFromUrl && !codeFromUrl.includes("-0") && codeFromUrl.length < 12) {
      // Looks like a join code (not a label code like OVHS-0001)
      localStorage.setItem("t4u_pending_join_code", codeFromUrl.toUpperCase().trim());
    }
    if (fromUrl) {
      localStorage.setItem("t4u_pending_invite", fromUrl);
      const itype = p.get("token") ? "team" : "district";
      localStorage.setItem("t4u_pending_invite_type", itype);
      return fromUrl;
    }
    return localStorage.getItem("t4u_pending_invite") || null;
  });
  const pendingInviteType = localStorage.getItem("t4u_pending_invite_type") || "district";
  const [inviteInfo, setInviteInfo] = useState(null);
  useEffect(()=>{
    if(!pendingInvite||user) return;
    (async()=>{
      try{const{data}=await SB.rpc("get_invite_by_token",{p_token:pendingInvite});if(data&&data.length>0)setInviteInfo(data[0]);}
      catch(e){console.warn("invite info:",e);}
    })();
  },[pendingInvite,user]);

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(()=>{
    // Demo mode: user is pre-set, skip all real auth checks
    if(isDemo){ setAuthChk(true); return; }

    SB.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user||null);
      setAuthChk(true);
      if(!session){
        try{
          const keys=Object.keys(localStorage).filter(k=>k.startsWith("sb-"));
          if(keys.length>0){keys.forEach(k=>localStorage.removeItem(k));}
        }catch(e){}
      }
    });
    const{data:{subscription}}=SB.auth.onAuthStateChange((_,session)=>{
      const u = session?.user||null;
      setUser(u);
      if(!session) {
        setItems([]); setOrg({name:"",type:"",email:"",phone:"",location:"",bio:""});
        setLoaded(false);
      } else if(u) {
        setLoaded(false);
      }
    });
    return()=>subscription.unsubscribe();
  },[]);

  // ── On load: if ?signin=1 or ?signup=1 in URL, open auth modal immediately ──
  useEffect(()=>{
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("signin")==="1" ? "login"
                 : params.get("signup")==="1" ? "signup"
                 : null;
      if(mode) {
        const nextHash = params.get("next") || "";
        const cleanUrl = window.location.pathname + (nextHash ? nextHash : "");
        window.history.replaceState({}, "", cleanUrl);
        if(nextHash && nextHash.startsWith("#/item/")) {
          try { localStorage.setItem("t4u_post_auth_hash", nextHash); } catch(e) {}
        }
        setTimeout(()=>{
          if(typeof window.__t4u_show_auth === "function") {
            window.__t4u_show_auth(mode);
          }
        }, 400);
      }
    } catch(e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detect post-Stripe-payment redirect and refresh org plan ────────────────
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");
  useEffect(()=>{
    if(!user) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const paymentSuccess = params.get("payment_success") || params.get("session_id");
      if(paymentSuccess) {
        // Clean the URL immediately
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
        // Refresh org data — try immediately then again after 3s for webhook processing
        const refresh = async () => {
          const { data: freshOrg } = await SB.from("orgs").select("*").eq("id", user.id).single();
          if(freshOrg) {
            setOrg(prev => ({ ...prev, ...freshOrg }));
            const ep = freshOrg.stripe_subscription_id ? freshOrg.plan
              : freshOrg.temp_pro ? "pro" : (freshOrg.plan || "free");
            setPlanState(ep);
          }
        };
        refresh();
        setTimeout(refresh, 3000);
        setPaymentSuccessMsg("🎉 Welcome to Pro! Your subscription is now active.");
        setTimeout(() => setPaymentSuccessMsg(""), 8000);
      }
    } catch(e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  useEffect(()=>{
    if(!user) return;
    try {
      const savedHash = localStorage.getItem("t4u_post_auth_hash");
      if(savedHash && savedHash.startsWith("#/item/")) {
        localStorage.removeItem("t4u_post_auth_hash");
        // Small delay to let auth state settle, then navigate to item
        setTimeout(()=>{ window.location.hash = savedHash; }, 300);
      }
    } catch(e) {}
  }, [user]);

  // ── Load data once logged in ─────────────────────────────────────────────
  useEffect(()=>{
    if(!user||loaded) return;
    (async()=>{
      // Check if user is a member of one or more orgs (team member or program director)
      const { data: memberRows } = await SB.from("org_members")
        .select("org_id, role, orgs(*)")
        .eq("user_id", user.id);
      let memberList = memberRows || [];
      // Always make the user's OWN org (id === user.id) selectable as owner, so a
      // multi-program owner who is also a member elsewhere can still reach their
      // own org. Appended (not prepended) to preserve the default-landing behavior.
      if (!memberList.some(m => m.org_id === user.id)) {
        const { data: ownOrg } = await SB.from("orgs").select("*").eq("id", user.id).single();
        if (ownOrg) memberList = [...memberList, { org_id: user.id, role: null, orgs: ownOrg, _own: true }];
      }
      setMemberships(memberList);

      // Pick the active program: a saved preference if still valid, else the first
      // REAL membership (preserves prior default), else the user's own org.
      const savedId = (()=>{ try { return localStorage.getItem("t4u_active_program"); } catch(e){ return null; } })();
      const firstReal = (memberRows && memberRows.length) ? memberRows[0] : (memberList[0] || null);
      let activeMembership = memberList.find(m => m.org_id === savedId) || firstReal;
      // The user's own org is owner access, NOT a membership — treat it like the
      // old "0 memberships" path (memberRole=null, not a member).
      const realMembership = (activeMembership && activeMembership.org_id !== user.id) ? activeMembership : null;
      const targetOrgId = realMembership ? realMembership.org_id : user.id;
      const memberRole  = realMembership ? realMembership.role : null;

      const{data:orgData}=await SB.from("orgs").select("*").eq("id",targetOrgId).single();
      // Admin emails always get District plan regardless of what is stored
      // temp_pro = true gives Pro access during beta (no payment required)
      const effectivePlan = isAdminEmail(user?.email) ? "district"
        : orgData?.temp_pro ? "pro"
        : (orgData?.plan || "free");
      if(orgData){
        setOrg({...orgData, _memberRole: memberRole, _isMember: !!realMembership});
        setMemberRole(memberRole);
        setPlanState(effectivePlan);
        // Load onboarding step — 0 = brand new user
        setOnboardingStep(orgData.onboarding_step ?? 0);
        // Multi-vertical: choose the active department — saved pref if still enabled, else the org's primary
        const _enabled = (orgData.verticals_enabled?.length ? orgData.verticals_enabled : [orgData.vertical || "theatre"]);
        const _savedV = (()=>{ try { return localStorage.getItem("t4u_active_vertical_"+targetOrgId); } catch(e){ return null; } })();
        setActiveVertical(_enabled.includes(_savedV) ? _savedV : (orgData.vertical || _enabled[0] || "theatre"));
      } else { setPlanState(effectivePlan); }
      const{data:itemData}=await SB.from("items").select("*").eq("org_id",targetOrgId).order("added",{ascending:false}).limit(2000);
      if(itemData) setItems(itemData);
      // Facilitator detection — if this user facilitates a district, load it + its schools (full-edit browse)
      const { data: facRows } = await SB.from("district_members")
        .select("district_id").eq("user_id", user.id).eq("role","facilitator").limit(1);
      if (facRows && facRows.length) {
        const fdId = facRows[0].district_id;
        const { data: fDist } = await SB.from("districts").select("*").eq("id", fdId).single();
        setFacDistrict(fDist || null);
        const { data: fSch } = await SB.from("orgs").select("*").eq("district_id", fdId).order("name");
        setFacSchools(fSch || []);
      } else { setFacDistrict(null); setFacSchools([]); }
      // District-owner detection — lets the District tab show from ANY of the owner's orgs
      // (e.g. while viewing a school they direct), not only from their own-org context.
      const { data: ownDist } = await SB.from("districts").select("id").eq("owner_id", user.id).maybeSingle();
      setOwnsDistrict(!!ownDist);
      setLoaded(true);
      // Load unread message count
      const { count: unread } = await SB.from("messages")
        .select("id", { count: "exact", head: true })
        .eq("read", false)
        .neq("sender_id", user.id);
      setUnreadCount(unread || 0);
      // Load pending request count (incoming)
      const { count: reqCount } = await SB.from("rental_requests")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "pending");
      setPendingReqCount(reqCount || 0);
      // Stage Points balance — loaded at login so it shows in nav/dashboard
      SB.rpc("get_my_credit_balance").then(({data})=>{ if(data!=null) setCreditBalance(data||0); }).catch(()=>{});
      // Stage Points balance — also refreshed on Credits page visit
      // (removed from startup to reduce login query count)
    })();
  },[user]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  // Active org to write to: the org currently being viewed (own org for owners,
  // or the org a team member belongs to). NEVER user.id directly — a crew member's
  // uid is not an orgs row, which violates items_org_id_fkey. (Coppell fix 2026-06-15)
  const activeOrgId = org?.id || user?.id;
  // Multi-vertical view state: the enabled departments, the active one, and a view-org +
  // filtered items for working-context pages. Single-vertical accounts are unaffected
  // (multiVertical=false → viewOrg=org, vItems=items, no switcher shown).
  const enabledVerticals = (org?.verticals_enabled?.length ? org.verticals_enabled : [org?.vertical || "theatre"]);
  const curVertical = activeVertical || org?.vertical || "theatre";
  const multiVertical = enabledVerticals.length > 1;
  const viewOrg = multiVertical ? { ...org, vertical: curVertical } : org;
  const vItems = multiVertical ? items.filter(i => (i.vertical||"theatre") === curVertical) : items;
  const add = useCallback(async(item)=>{
    const row={...item,org_id:activeOrgId, vertical: item.vertical || activeVertical || org?.vertical || "theatre"};
    // Sanitize optional numeric/date/uuid fields — empty string → null
    if(!row.purchase_cost || row.purchase_cost==="")    row.purchase_cost    = null;
    else row.purchase_cost = parseFloat(row.purchase_cost) || null;
    if(!row.purchase_date  || row.purchase_date==="")   row.purchase_date    = null;
    if(!row.purchase_vendor|| row.purchase_vendor==="") row.purchase_vendor  = null;
    if(!row.funding_source_id||row.funding_source_id==="") row.funding_source_id = null;
    if(!row.location_id    || row.location_id==="")     row.location_id      = null;
    if(!row.pin_id         || row.pin_id==="")           row.pin_id           = null;
    if(!row.rack_slot      || row.rack_slot==="")        row.rack_slot        = null;
    const{data,error}=await SB.from("items").insert(row).select().single();
    if(error){ alert("Could not save item: "+error.message); console.error(error); return; }
    if(data){
      setItems(p=>[data,...p]);
      // Auto-create funding expenditure if a funding source and cost were provided
      if(item.funding_source_id && item.purchase_cost && parseFloat(item.purchase_cost)>0){
        await SB.from("funding_expenditures").insert({
          org_id:           activeOrgId,
          funding_source_id: item.funding_source_id,
          item_id:          data.id,
          amount:           parseFloat(item.purchase_cost),
          description:      item.name || "Inventory item",
          vendor:           item.purchase_vendor || null,
          purchase_date:    item.purchase_date || new Date().toISOString().slice(0,10),
          category:         "Supplies",
        });
      }
    }
  },[user,activeOrgId,activeVertical,org]);

  const edit = useCallback(async(item)=>{
    const payload={...item};
    // Strip immutable fields and any joined org_ fields from Exchange cross-org queries
    delete payload.id; delete payload.org_id; delete payload.added;
    Object.keys(payload).forEach(k=>{ if(k.startsWith('org_')||k==='orgs') delete payload[k]; });
    // Sanitize optional numeric/date/uuid fields — empty string → null
    if(payload.purchase_cost===""||payload.purchase_cost===null||isNaN(parseFloat(payload.purchase_cost)))
      payload.purchase_cost = null;
    else payload.purchase_cost = parseFloat(payload.purchase_cost);
    if(!payload.purchase_date    ||payload.purchase_date==="")    payload.purchase_date    = null;
    if(!payload.purchase_vendor  ||payload.purchase_vendor==="")  payload.purchase_vendor  = null;
    if(!payload.funding_source_id||payload.funding_source_id==="")payload.funding_source_id= null;
    if(!payload.location_id      ||payload.location_id==="")      payload.location_id      = null;
    if(!payload.pin_id           ||payload.pin_id===""           )payload.pin_id           = null;
    if(!payload.rack_slot        ||payload.rack_slot===""        )payload.rack_slot         = null;
    const{data,error}=await SB.from("items").update(payload).eq("id",item.id).select().single();
    if(error){ alert("Could not update item: "+error.message); console.error(error); return; }
    if(data){
      setItems(p=>p.map(x=>x.id===item.id?data:x));
      // If a funding source + cost is set, upsert the expenditure linked to this item
      // (only create if none exists yet for this item — avoid duplicating on every edit)
      if(item.funding_source_id && item.purchase_cost && parseFloat(item.purchase_cost)>0){
        const{data:existing}=await SB.from("funding_expenditures").select("id").eq("item_id",item.id).maybeSingle();
        if(!existing){
          await SB.from("funding_expenditures").insert({
            org_id:           activeOrgId,
            funding_source_id: item.funding_source_id,
            item_id:          item.id,
            amount:           parseFloat(item.purchase_cost),
            description:      item.name || "Inventory item",
            vendor:           item.purchase_vendor || null,
            purchase_date:    item.purchase_date || new Date().toISOString().slice(0,10),
            category:         "Supplies",
          });
        } else {
          // Update existing expenditure amount/source if changed
          await SB.from("funding_expenditures").update({
            funding_source_id: item.funding_source_id,
            amount:           parseFloat(item.purchase_cost),
            vendor:           item.purchase_vendor || null,
            purchase_date:    item.purchase_date || existing.purchase_date,
          }).eq("id",existing.id);
        }
      }
    }
  },[user,activeOrgId]);

  const del = useCallback(async(id)=>{
    await SB.from("items").delete().eq("id",id);
    setItems(p=>p.filter(x=>x.id!==id));
  },[]);

  const seed = useCallback(async()=>{
    if(items.length>0){
      if(!window.confirm("You already have "+items.length+" item(s). Add sample data anyway?")) return;
    }
    const samples=makeSamples().map(i=>({...i,org_id:activeOrgId}));
    const{data,error}=await SB.from("items").insert(samples).select();
    if(error){alert(EM.sampleLoad.title+"\n\n"+EM.sampleLoad.body);return;}
    if(data) setItems(p=>[...data,...p]);
  },[user,items,activeOrgId]);

  // setPlan — used by admin test panel to override plan
  const setPlan = useCallback(async(newPlan)=>{
    setPlanState(newPlan);
    setOrg(p=>({...p,plan:newPlan}));
    await SB.from("orgs").update({plan:newPlan}).eq("id",user.id);
  },[user]);

  const saveOrg = useCallback(async(o)=>{
    setOrg(o);
    let update = {...o, id:user.id};
    // Auto-geocode zipcode when saving profile
    if(o.zipcode && o.zipcode.length===5 && o.zipcode!==org.zipcode){
      const coords = await zipToCoords(o.zipcode);
      if(coords){ update.lat=coords.lat; update.lng=coords.lng; update.state=update.state||coords.state; }
    }
    await SB.from("orgs").upsert(update);
  },[user,org.zipcode]);

  const signOut = async()=>{ await SB.auth.signOut(); };

  const nav = p => {
    // Handle special onboarding actions
    if (p === "inventory-csv") { setPage("inventory"); setMob(false); setActiveSchool(null);
      window.history.pushState({ t4uPage: "inventory" }, "", window.location.pathname);
      // Signal inventory to open CSV modal after mount
      setTimeout(()=>window.__t4u_open_csv&&window.__t4u_open_csv(), 400); return; }
    if (p === "sample") { setPage("dashboard"); setMob(false); setActiveSchool(null);
      window.history.pushState({ t4uPage: "dashboard" }, "", window.location.pathname);
      setTimeout(()=>window.__t4u_load_samples&&window.__t4u_load_samples(), 400); return; }
    setPage(p); setMob(false); setActiveSchool(null);
    // Push a history entry so browser back button navigates within the app
    window.history.pushState({ t4uPage: p }, "", window.location.pathname);
  };
  // Onboarding: auto-advance when item milestones are hit
  useEffect(()=>{
    if (onboardingStep === null) return;
    // Step 2 triggers after first item is added
    if (onboardingStep === 2 && items.length === 0) return; // wait for item
    // Step 3 triggers after 5+ items
    if (onboardingStep === 3 && items.length < 5) return;
  },[onboardingStep, items.length]);

  // Redirect to dashboard if current page's flag gets turned off

  useEffect(()=>{
    if(page==="marketplace"&& !org?.marketplace_enabled) setPage("dashboard");
  },[org?.marketplace_enabled, page]);
  // Expose for cross-component navigation
  useEffect(()=>{
    window.__t4u_nav_messages = (convId) => { setOpenConvId(convId); setPage("messages"); setMob(false); };
    window.__t4u_nav_requests = ()       => { setPage("requests"); setMob(false); };
    return () => { delete window.__t4u_nav_messages; delete window.__t4u_nav_requests; };
  },[]);
  // Back button: intercept popstate and navigate within the app
  useEffect(()=>{
    // Seed initial history entry so there's always somewhere to go back to
    window.history.replaceState({ t4uPage: "dashboard" }, "", window.location.pathname);
    const onPop = (e) => {
      const p = e.state?.t4uPage;
      if (p) {
        setPage(p); setMob(false); setActiveSchool(null);
      } else {
        // No state means we've gone back past our first entry — push again to trap
        window.history.pushState({ t4uPage: page }, "", window.location.pathname);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const isDesk = typeof window !== "undefined" && window.innerWidth > 900;
  const listed = items.filter(i=>i.mkt!=="Not Listed").length;

  // Switch into a school's context (district admin only)
  const switchSchool = useCallback(async (school) => {
    if (!school) { setActiveSchool(null); setSchoolItems([]); return; }
    setActiveSchool(school);
    setSchoolLoading(true);
    const { data } = await SB.from("items").select("*").eq("org_id", school.id).order("added", { ascending: false });
    setSchoolItems(data || []);
    setSchoolLoading(false);
    setPage("inventory");
    setMob(false);
  }, []);

  // Keep custom inventory categories in sync with whichever org is currently active
  // (own account OR a district school being viewed) — so switching never needs a page refresh.
  useEffect(()=>{
    const oid = activeSchool?.id || org?.id;
    if(!oid){ setCustomCats([]); return; }
    let cancelled=false;
    SB.from("org_categories").select("id,vertical,label").eq("org_id", oid).then(({data})=>{
      if(cancelled) return;
      setCustomCats(data||[]);
      setCustCatVer(v=>v+1);
    });
    return ()=>{ cancelled=true; };
  },[activeSchool, org?.id]);

  // Handle invite token — after login, accept the invite
  useEffect(() => {
    if (!user || !pendingInvite) return;
    const itype = localStorage.getItem("t4u_pending_invite_type") || "district";

    const clearInvite = () => {
      localStorage.removeItem("t4u_pending_invite");
      localStorage.removeItem("t4u_pending_invite_type");
      setPendingInvite(null);
      window.history.replaceState({}, "", window.location.pathname);
    };

    (async () => {
      // ── TEAM INVITE (org_invites) ──────────────────────────────────────
      if (itype === "team") {
        // Use SECURITY DEFINER RPC to bypass RLS — handles insert + mark accepted
        const { data: result, error: rpcErr } = await SB.rpc("accept_team_invite", {
          p_token: pendingInvite,
        });

        if (rpcErr || result?.error) {
          console.error("accept_team_invite error:", rpcErr || result?.error);
          clearInvite();
          const msg = result?.error || "Something went wrong accepting the invite.";
          if (msg.includes("Already a member")) {
            alert("You're already a member of this team!");
          } else if (msg.includes("expired")) {
            alert("This invite has expired. Ask the director to send a new invite.");
          } else {
            alert(msg + " Please try again or contact hello@theatre4u.org.");
          }
          return;
        }

        clearInvite();
        const orgName = result?.org_name || "the program";
        const roleLabel = result?.role === "stage_manager" ? "Stage Manager"
          : result?.role === "crew" ? "Crew" : "House";
        alert(`✓ Welcome to ${orgName}'s Backstage Team! You've joined as ${roleLabel}. The page will reload to show your team inventory.`);
        window.location.reload();
        return;
      }

      // ── JOIN CODE (persisted from URL or signup) ──────────────────────
      const pendingCode = localStorage.getItem("t4u_pending_join_code");
      if (pendingCode) {
        localStorage.removeItem("t4u_pending_join_code");
        clearInvite();
        const { data: codeResult, error: codeErr } = await SB.rpc("accept_team_invite_by_code", {
          p_code: pendingCode,
        });
        if (!codeErr && codeResult?.success) {
          const orgName   = codeResult.org_name || "the program";
          const roleLabel = codeResult.role === "stage_manager" ? "Stage Manager"
            : codeResult.role === "crew" ? "Crew"
            : codeResult.role === "co_director" ? "Co-Director" : "House";
          alert(`✓ Welcome to ${orgName}'s Backstage Team! You've joined as ${roleLabel}. The page will reload.`);
          window.location.reload();
        } else if (codeResult?.error?.includes("Already a member")) {
          // Silent — they're already in, just reload
          window.location.reload();
        }
        return;
      }

      // ── DISTRICT INVITE (district_invites) ────────────────────────────
      const { data: invite } = await SB.from("district_invites")
        .select("*, districts(id,name)")
        .eq("token", pendingInvite)
        .eq("status", "pending")
        .single();
      if (!invite) {
        clearInvite();
        alert("This invite link has expired or has already been used. Ask your district administrator to send a fresh invite link.");
        return;
      }

      // Check if this org is already in a different district
      const { data: currentOrg } = await SB.from("orgs").select("district_id,name").eq("id", user.id).single();
      if (currentOrg?.district_id && currentOrg.district_id !== invite.district_id) {
        const districtName = invite.districts?.name || "this district";
        const confirmed = window.confirm(
          `Your account (${currentOrg.name || user.email}) is currently linked to another district.\n\n` +
          `Accepting this invite will move your account to "${districtName}".\n\n` +
          `Your inventory and data will move with you. Continue?`
        );
        if (!confirmed) { clearInvite(); return; }
      }

      // Link org to district + mark invite accepted
      await SB.from("orgs").update({ district_id: invite.district_id, role: "school_admin" }).eq("id", user.id);
      await SB.from("district_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);
      clearInvite();
      // Reload org data to pick up new district_id
      const { data: updatedOrg } = await SB.from("orgs").select("*").eq("id", user.id).single();
      if (updatedOrg) setOrg(updatedOrg);
      alert(`✓ You've joined ${invite.districts?.name || "the district"}! Your account and inventory are now linked. Welcome to Theatre4u™.`);
    })();
  }, [user, pendingInvite]);

  // Navigate to inventory when location QR is scanned and user is logged in
  useEffect(()=>{
    if (deepLinkLocation && loaded && user) {
      setPage("inventory");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [deepLinkLocation, loaded, user]);

  const isAdmin = isAdminEmail(user?.email);
  const NAV = (() => {
    const role = memberRole; // null=director/owner, stage_manager, crew, house
    const isCrew  = role === "crew"  || role === "house";
    const isStage = role === "stage_manager";
    const isMember = !!role; // any team member (not the owner)
    return [
      { id:"dashboard",   label:"Dashboard",   ico:Ic.home    },
      ...(!isCrew  ? [{ id:"messages",    label:"Messages",    ico:"💬"       }] : []),
      ...(!isCrew  ? [{ id:"requests",    label:"Requests",    ico:"📋"       }] : []),
      { id:"inventory",   label:"Inventory",   ico:Ic.box     },
      ...(!isCrew && org?.marketplace_enabled ? [{ id:"marketplace", label:getExchangeName(curVertical), ico:Ic.store   }] : []),
      ...(!isCrew && org?.community_enabled   ? [{ id:"community",   label:"Community",   ico:"🎪", community:true }] : []),
      { id:"productions", label:getTerm(curVertical,"productions"), ico:"🎭"       },
      ...(!isMember? [{ id:"reports",     label:"Reports",     ico:Ic.chart   }] : []),
      ...(!isMember? [{ id:"funding",     label:"Funding Tracker", ico:"💰"  }] : []),
      // Prop 28 nav hidden — legacy data accessible via Funding Tracker migration banner
      { id:"profile",     label:"My Profile",  ico:"👤"       },
      ...(!isMember ? [{ id:"labels",  label:"QR Labels",    ico:"🏷" }] : []),
      ...(!isMember ? [{ id:"points", label:getPointsName(curVertical), ico:"🪙" }] : []),
      ...((!isMember && plan === "district") || ownsDistrict ? [{ id:"district", label:"District", ico:"🏢", district:true }] : []),
      ...(!isMember && facDistrict ? [{ id:"facschools", label:"District Schools", ico:"🏫" }] : []),
      ...(!isMember && isAdmin ? [{ id:"admin", label:"Admin", ico:Ic.settings, admin:true }] : []),
    ];
  })();
  const TITLES = { messages:"Messages", prop28:"Prop 28", requests:"Requests", dashboard:"Dashboard", inventory: activeSchool ? `📦 ${activeSchool.name}` : "Inventory", marketplace:getExchangeName(curVertical), productions:getTerm(curVertical,"productions"), reports:"Reports", settings:"Settings", admin:"Admin Dashboard", district:"District", credits:getPointsName(curVertical), points:getPointsName(curVertical), community:"Community Board", labels:"QR Labels", facschools:"District Schools" };

  // ── Public item page — no auth required ─────────────────────────────────────
  if (publicOrgSlug) return <PublicOrgPage slug={publicOrgSlug} />;
  if (publicItemId) return <PublicItemPage itemId={publicItemId} />;

  // ── Auth gate ────────────────────────────────────────────────────────────
  if(!authChk) return(
    <div style={{minHeight:"100vh",background:"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexDirection:"column"}}>
      <style>{CSS}</style>
      <div style={{fontSize:52}}>🎭</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--gold)"}}>Loading Theatre4u™…</div>
      <div style={{width:32,height:32,border:"2.5px solid var(--linen)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
    </div>
  );

  if(!user && previewMode) return <PreviewMode onSignUp={()=>{ setPreviewMode(false); window.__t4u_show_auth&&window.__t4u_show_auth("signup"); }}/>;

  if(!user) return(
    <>
      <style>{CSS}</style>
      <LandingPage
        onSignIn={()=>{
          // Show auth screen in signin mode by mounting AuthScreen with initial mode
          const el=document.getElementById("t4u-auth-overlay");
          if(el) el.style.display="flex";
          window.__t4u_auth_mode="login";
          window.__t4u_show_auth&&window.__t4u_show_auth("login");
        }}
        onSignUp={()=>{
          window.__t4u_show_auth&&window.__t4u_show_auth("signup");
        }}
        onTakeTour={()=>{ window.location.href = window.location.href.split("?")[0] + "?preview=1"; }}
      />
      <AuthOverlay onAuth={u=>{setUser(u);}} pendingInvite={pendingInvite} inviteInfo={inviteInfo}/>
      {user && <FeedbackWidget userId={org?.id || user.id} orgName={org?.name||""} isLeadingPlayer={org?.is_leading_player||false}/>}
      {user && !isDemo && <AIHelpBubble user={user} />}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        {/* Sidebar */}
        <aside className={`sidebar ${isDesk ? "" : mob ? "open" : "hidden"}`}
               style={isDesk ? {position:"relative",transform:"none"} : {}}>
          <div className="sb-root">
            <div className="sb-photo" style={{background:"linear-gradient(180deg,#0F0B0A 0%,#1a1208 50%,#0F0B0A 100%)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:.06,userSelect:"none"}}>
                <svg width="180" height="180" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="5" width="90" height="90" rx="14" stroke="#D4A64A" fill="none" strokeWidth="3"/>
                  <path d="M20 50 Q37 22 54 50 Q37 72 20 50Z" fill="#D4A64A"/>
                  <path d="M46 50 Q63 78 80 50 Q63 28 46 50Z" fill="#D4A64A"/>
                </svg>
              </div>
            </div>
            <div className="sb-inner">
              <div className="sb-logo">
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <LogoMarkDark size={54}/>
                  <div>
                    <div className="sb-name">{APP_NAME}</div>
                    <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"rgba(212,168,67,.5)",marginTop:2,fontFamily:"'Raleway',sans-serif",fontWeight:700}}>{APP_SUBTITLE}</div>
                  </div>
                </div>
                <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{padding:"2px 8px",background:plan==="free"?"rgba(255,255,255,.08)":plan==="pro"?"rgba(212,168,67,.2)":"rgba(66,165,245,.2)",color:plan==="free"?"rgba(255,255,255,.35)":plan==="pro"?"var(--gold)":"#42a5f5",borderRadius:9,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>
                    {plan==="free"?"Free Plan":plan==="pro"?"Pro":"District"}
                  </span>
                  {IS_ARTSTRACKER && org?.vertical && (
                    <span style={{padding:"2px 8px",background:"rgba(212,168,67,.15)",color:"var(--gold)",borderRadius:9,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"inline-flex",alignItems:"center",gap:4}}>
                      {getVertical(org.vertical).icon} {getVertical(org.vertical).label}
                    </span>
                  )}
                </div>
                {/* Program switcher — only for directors assigned to 2+ programs */}
                {memberships.length >= 2 && (
                  <select
                    value={org?.id || ""}
                    onChange={e=>{ try{ localStorage.setItem("t4u_active_program", e.target.value);}catch(err){} window.location.reload(); }}
                    style={{marginTop:8,width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--linen)",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}
                    title="Switch between the programs you direct">
                    {memberships.map(m=>(
                      <option key={m.org_id} value={m.org_id}>{m.orgs?.name || "Program"}</option>
                    ))}
                  </select>
                )}
                {/* Department switcher — only when the account has 2+ verticals enabled */}
                {multiVertical && (
                  <select
                    value={curVertical}
                    onChange={e=>{ setActiveVertical(e.target.value); try{ localStorage.setItem("t4u_active_vertical_"+(org?.id||""), e.target.value); }catch(err){} }}
                    style={{marginTop:8,width:"100%",padding:"6px 8px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--linen)",fontSize:12,fontFamily:"inherit",cursor:"pointer"}}
                    title="Switch between departments">
                    {enabledVerticals.map(v=>(
                      <option key={v} value={v}>{getVertical(v).icon} {getVertical(v).label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Member banner — shown when logged in as a team member */}
              {memberRole && org && (
                <div style={{
                  margin:"8px 12px 4px",
                  background:"rgba(212,168,67,.08)",
                  border:"1px solid rgba(212,168,67,.2)",
                  borderRadius:8,
                  padding:"8px 12px",
                  fontSize:11,
                  lineHeight:1.4,
                }}>
                  <div style={{color:"var(--gold)",fontWeight:700,marginBottom:2}}>
                    {memberRole==="stage_manager"?"📋 Stage Manager":
                     memberRole==="crew"?("🔧 "+getTerm(curVertical,"crewRole")):
                     memberRole==="house"?"🎟 House":
                     memberRole==="program_director"?"🎯 Program Director":"Team Member"}
                  </div>
                  <div style={{color:"rgba(255,255,255,.5)"}}>
                    Viewing <strong style={{color:"rgba(255,255,255,.75)"}}>{org.name}</strong>
                  </div>
                </div>
              )}

              <nav className="sb-nav">
                {/* School context banner when browsing a school as district admin */}
                {activeSchool && (
                  <div style={{ padding: "8px 10px", marginBottom: 6, background: "rgba(66,165,245,.12)", border: "1px solid rgba(66,165,245,.25)", borderRadius: 8, fontSize: 12 }}>
                    <div style={{ color: "#42a5f5", fontWeight: 700, marginBottom: 3 }}>📋 Viewing School</div>
                    <div style={{ color: "rgba(255,255,255,.75)", lineHeight: 1.3, marginBottom: 6 }}>{activeSchool.name}</div>
                    <button onClick={() => { setActiveSchool(null); setPage(plan==="district" ? "district" : "facschools"); }}
                      style={{ fontSize: 11, color: "rgba(255,255,255,.6)", background: "none", border: "1px solid rgba(255,255,255,.2)", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                      {plan==="district" ? "← Back to District" : "← Back to Schools"}
                    </button>
                  </div>
                )}
                {NAV.map(n=>(
                  <div key={n.id}
                    className={`sb-item ${page===n.id?"on":""}`}
                    onClick={()=>nav(n.id)}
                    style={n.admin ? {marginTop:12, borderTop:"1px solid rgba(212,168,67,.15)", paddingTop:12, color: page===n.id ? undefined : "rgba(212,168,67,.65)"}
                         : n.district ? {marginTop:4, color: page===n.id ? undefined : "rgba(66,165,245,.75)"}
                         
                         : n.credits  ? {color: page===n.id ? undefined : "rgba(212,168,67,.75)"}
                         : n.community ? {color: page===n.id ? undefined : "rgba(82,153,224,.85)"}
                         : {}}>
                    <span className="sb-ico">{n.admin ? "🔧" : n.district ? "🏢" : n.ico}</span>
                    <span>{n.label}</span>
                    {n.admin && <span style={{marginLeft:"auto",fontSize:9,padding:"1px 5px",background:"rgba(212,168,67,.2)",color:"var(--gold)",borderRadius:4,fontWeight:700,letterSpacing:1}}>ADMIN</span>}
                    {n.district && <span style={{marginLeft:"auto",fontSize:9,padding:"1px 5px",background:"rgba(66,165,245,.2)",color:"#42a5f5",borderRadius:4,fontWeight:700,letterSpacing:1}}>DIST</span>}
                    {n.id==="messages"   && unreadCount>0    && <span className="sb-badge" style={{background:"var(--red)",color:"#fff"}}>{unreadCount}</span>}
                    {n.id==="requests"   && pendingReqCount>0 && <span className="sb-badge" style={{background:"var(--red)",color:"#fff"}}>{pendingReqCount}</span>}
                    {n.id==="inventory"  && items.length>0 && <span className="sb-badge">{activeSchool ? schoolItems.length : items.length}</span>}
                    {n.id==="marketplace"&& listed>0       && <span className="sb-badge">{listed}</span>}
                    {n.id==="productions"&& <span className="sb-badge" style={{background:"rgba(212,168,67,.2)",color:"var(--gold)"}}>🎭</span>}
                    
                    {n.id==="points"    && creditBalance>0 && <span className="sb-badge" style={{background:"rgba(212,168,67,.2)",color:"var(--gold)"}}>{creditBalance}</span>}
                  </div>
                ))}
              </nav>

              <div className="sb-foot">
                <div style={{display:"flex",gap:5,flexDirection:"column"}}>
                  {(plan==="pro"||plan==="district"||isAdmin)&&!isDemo&&(
                    <a href="/app.html" target="_blank" rel="noreferrer" className="btn btn-o btn-sm btn-full"
                      style={{color:"var(--gold)",borderColor:"rgba(212,168,67,.3)",fontSize:12,padding:"7px 12px",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      📱 Mobile App
                    </a>
                  )}
                  {(plan==="pro"||plan==="district"||isAdmin)&&!isDemo&&(
                    <a href="/help.html" target="_blank" rel="noreferrer" className="btn btn-o btn-sm btn-full"
                      style={{color:"rgba(255,255,255,.6)",borderColor:"rgba(255,255,255,.12)",fontSize:12,padding:"7px 12px",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      ❓ Help & Tutorials
                    </a>
                  )}
                  {plan==="free"&&!isAdmin&&(
                    <button className="btn btn-sm btn-full" style={{background:"linear-gradient(135deg,var(--gold),var(--amber))",border:"none",color:"#1a0f00",fontSize:13,fontWeight:800,padding:"9px 12px",letterSpacing:.2}} onClick={()=>nav("settings")}>
                      ⭐ Upgrade Plan
                    </button>
                  )}
                  <button className="btn btn-o btn-sm btn-full" style={{color:"rgba(255,255,255,.85)",borderColor:"rgba(255,255,255,.28)",fontSize:13,padding:"8px 12px"}} onClick={()=>nav("settings")}>
                    <span style={{width:13,height:13,display:"flex"}}>{Ic.settings}</span>Settings
                  </button>
                  {/* Subscribe button — shown for temp_pro users who haven't paid yet, not in demo */}
                  {org?.temp_pro && !org?.stripe_subscription_id && !isAdmin && !isDemoMode() && (
                    <a href={stripeLink(STRIPE_LINKS.pro?.monthly, user?.id, user?.email)}
                      target="_blank" rel="noreferrer"
                      style={{display:"flex",alignItems:"center",justifyContent:"center",
                        gap:7,padding:"9px 12px",borderRadius:8,fontSize:13,fontWeight:700,
                        background:"linear-gradient(135deg,var(--gold),#a37f2c)",color:"#1a0f00",
                        textDecoration:"none",border:"none",cursor:"pointer",marginBottom:0}}>
                      ⭐ Subscribe — $15/mo
                    </a>
                  )}
                  <button className="btn btn-sm btn-full" style={{background:"rgba(139,26,42,.22)",border:"1px solid rgba(139,26,42,.38)",color:"rgba(255,255,255,.85)",fontSize:13,padding:"8px 12px"}} onClick={signOut}>
                    Sign Out
                  </button>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:10}}>
                  <span onClick={()=>setLegalPage("terms")} style={{fontSize:10,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Terms</span>
                  <span style={{color:"rgba(255,255,255,.15)"}}>·</span>
                  <span onClick={()=>setLegalPage("privacy")} style={{fontSize:10,color:"rgba(255,255,255,.3)",cursor:"pointer"}}>Privacy</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {mob && !isDesk && <div className="mob-overlay" onClick={()=>setMob(false)}/>}

        <div className="main">
          <div style={{height:3,background:"linear-gradient(90deg,var(--gold),var(--amber),var(--gilt) 55%,transparent 82%)",flexShrink:0}}/>
          <div className="topbar">
            <button className="menu-btn" onClick={()=>setMob(!mob)}>{mob?Ic.x:Ic.menu}</button>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <LogoMarkLight size={32}/>
              <span className="topbar-title">{TITLES[page]}</span>
            </div>
          </div>
          <div className="scroll-area" onClick={()=>mob&&setMob(false)}>
            {/* Post-payment success banner */}
            {paymentSuccessMsg&&(
              <div style={{background:"linear-gradient(135deg,rgba(76,175,80,.15),rgba(76,175,80,.08))",
                border:"1px solid rgba(76,175,80,.35)",borderRadius:10,margin:"16px 24px 0",
                padding:"12px 18px",display:"flex",gap:12,alignItems:"center"}}>
                <span style={{fontSize:20}}>🎉</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#4caf50"}}>
                    Subscription active!
                  </div>
                  <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>
                    {paymentSuccessMsg.replace("🎉 ","")}
                  </div>
                </div>
                <button onClick={()=>setPaymentSuccessMsg("")}
                  style={{background:"none",border:"none",color:"var(--muted)",
                    cursor:"pointer",fontSize:18,padding:"0 4px",lineHeight:1}}>✕</button>
              </div>
            )}
            {!loaded
              ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:18,color:"var(--faint)"}}>
                  <div style={{fontSize:52}}>🎭</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"var(--muted)"}}>Loading your collection…</div>
                  <div style={{width:32,height:32,border:"2.5px solid var(--linen)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
                </div>
              : <div className="fin">
                  {page==="requests"    && <Requests userId={org?.id || user?.id} orgName={org?.name} orgEmail={org?.email}
                    onUnreadChange={async()=>{
                      const{count}=await SB.from("rental_requests").select("id",{count:"exact",head:true}).eq("owner_id",user?.id).eq("status","pending");
                      setPendingReqCount(count||0);
                    }}/>}
                  {page==="messages"    && <Messages userId={user?.id} orgName={org?.name} openConvId={openConvId} onClearOpenConv={()=>setOpenConvId(null)} onUnreadChange={async()=>{ const{count}=await SB.from("messages").select("id",{count:"exact",head:true}).eq("read",false).neq("sender_id",user?.id); setUnreadCount(count||0); }}/>}
                  {page==="dashboard"   && <Dashboard   items={vItems} org={viewOrg} plan={plan} pointBalance={creditBalance} goInventory={(cat)=>{ if(cat) setDeepLinkCategory(cat); nav("inventory"); }} goMarketplace={()=>nav("marketplace")} goCommunity={()=>nav("community")} goProfile={()=>nav("profile")} goPoints={()=>nav("points")}/>}
                  {page==="inventory"   && !activeSchool && <Inventory   items={vItems} onAdd={add} onEdit={edit} onDelete={del} userId={org?.id || user?.id} plan={plan} memberRole={memberRole} org={viewOrg} enableLoans={!memberRole} onImported={(data)=>setItems(data)} deepLinkLocationId={deepLinkLocation} onDeepLinkConsumed={()=>setDeepLinkLocation(null)} deepLinkCategory={deepLinkCategory} onDeepLinkCategoryConsumed={()=>setDeepLinkCategory(null)}/>}
                  {page==="inventory"   && activeSchool && (
                    schoolLoading
                      ? <div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>Loading {activeSchool.name}…</div>
                      : <Inventory items={schoolItems}
                          onAdd={async(item)=>{ const row={...item,org_id:activeSchool.id}; const{data}=await SB.from("items").insert(row).select().single(); if(data) setSchoolItems(p=>[data,...p]); }}
                          onEdit={async(item)=>{ const pl={...item}; delete pl.id; delete pl.org_id; delete pl.added; const{data,error}=await SB.from("items").update(pl).eq("id",item.id).select().single(); if(error){alert("Could not update item: "+error.message);console.error(error);}else if(data) setSchoolItems(p=>p.map(x=>x.id===item.id?data:x)); }}
                          onDelete={async(id)=>{ await SB.from("items").delete().eq("id",id); setSchoolItems(p=>p.filter(x=>x.id!==id)); }}
                          userId={activeSchool.id} plan={plan} org={activeSchool}
                          schoolName={activeSchool.name}
                          headerNote={<div style={{padding:"8px 12px",background:"rgba(66,165,245,.1)",border:"1px solid rgba(66,165,245,.2)",borderRadius:7,marginBottom:12,fontSize:12,color:"#42a5f5"}}>🏫 Editing inventory for <strong>{activeSchool.name}</strong></div>}
                        />
                  )}
                  {page==="marketplace" && <MarketplaceGate items={vItems} org={viewOrg} setOrg={setOrg} plan={plan} userId={org?.id || user?.id} activeSchool={activeSchool} allSchoolsMode={plan==="district"} onEdit={edit} onDelete={del}/>}
                  {page==="productions" && <Productions userId={org?.id || user?.id} allItems={vItems} org={viewOrg} onNavigateTo={nav}/>}
                  {page==="reports"     && <Reports     items={activeSchool ? schoolItems : vItems} plan={plan} org={viewOrg} userId={org?.id || user?.id} userEmail={user?.email}/>}
                  {page==="funding"     && <FundingPage userId={org?.id || user?.id} org={viewOrg} plan={plan}/>}
                  {page==="prop28"      && <Prop28Page  userId={org?.id || user?.id} org={viewOrg} onNav={nav}/>}
                  {page==="profile"     && <OrgProfilePage userId={org?.id || user?.id} org={org} setOrg={saveOrg} plan={plan} items={items}/>}
              {page==="settings"    && <Settings    org={org} setOrg={saveOrg} onSeed={seed} user={user} userId={org?.id || user?.id} items={items} setItems={setItems} plan={plan} userEmail={user?.email} setPlan={setPlan} memberRole={memberRole}/>}
                  {page==="district"    && (plan==="district" || ownsDistrict) && <DistrictDashboard user={user} plan={plan} onSwitchSchool={switchSchool}/>}
                  {page==="facschools"  && facDistrict && (
                    <div style={{padding:"32px 36px 56px"}}>
                      <h1 style={{fontFamily:"var(--serif)",fontSize:32,marginBottom:4}}>District Schools</h1>
                      <p style={{color:"var(--muted)",fontSize:14,marginBottom:24}}>{facDistrict.name} — you can view and edit inventory for any school below.</p>
                      {facSchools.length===0 ? (
                        <div style={{color:"var(--muted)",fontSize:14}}>No schools in this district yet.</div>
                      ) : (
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                          {facSchools.map(sc=>(
                            <div key={sc.id} className="card card-p" style={{display:"flex",flexDirection:"column",gap:8}}>
                              <div style={{fontWeight:700,fontSize:15}}>{sc.name||"(unnamed school)"}</div>
                              <div style={{fontSize:12,color:"var(--muted)"}}>{getVertical(sc.vertical).icon} {getVertical(sc.vertical).label}{sc.location?" · "+sc.location:""}</div>
                              <button className="btn btn-g btn-sm" style={{marginTop:4}} onClick={()=>switchSchool(sc)}>Open inventory →</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {page==="community"   && <CommunityGate userId={org?.id || user?.id} org={viewOrg} setOrg={setOrg} plan={plan}/>}
                  {page==="labels"     && <LabelsPage org={viewOrg} userId={org?.id || user?.id} items={vItems} isAdmin={isAdmin}/>}
                  {page==="points"     && (plan!=="free"||isAdmin) && <CreditsPage userId={org?.id || user?.id} org={viewOrg} plan={plan} balance={creditBalance} onBalanceChange={setCreditBalance}/>}
                  {page==="points"     && plan==="free"&&!isAdmin && <div style={{padding:40,textAlign:"center"}}><div style={{fontSize:44,marginBottom:14}}>🪙</div><h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:10}}>{getPointsName(curVertical)} is a Pro Feature</h2><p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 24px",lineHeight:1.6}}>Earn credits by lending and renting your items. Spend them when you borrow. Upgrade to unlock.</p><UpgradePlans compact={true} userId={org?.id || user?.id} userEmail={user?.email}/></div>}


                  {page==="admin"       && isAdmin && <AdminHub currentUser={user} org={org}/>}
                </div>
            }
          </div>
        </div>
      </div>

      {/* ── Legal Modals ── */}
      {legalPage==="terms"&&<LegalModal title="Terms of Service" onClose={()=>setLegalPage(null)}>{TERMS_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legalPage==="privacy"&&<LegalModal title="Privacy Policy" onClose={()=>setLegalPage(null)}>{PRIVACY_CONTENT.map(([h,b])=><div key={h} style={{marginBottom:16}}><div style={{fontWeight:700,color:"#d4a843",marginBottom:4,fontSize:13}}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {user && <FeedbackWidget userId={org?.id || user.id} orgName={org?.name||""} isLeadingPlayer={org?.is_leading_player||false}/>}
      {user && !isDemo && <AIHelpBubble user={user} />}
      {/* ── Onboarding overlay ─ shown once to new users ── */}
      {user && onboardingStep !== null && onboardingStep < 4 && (
        (onboardingStep === 0 ||
         onboardingStep === 1 ||
         (onboardingStep === 2 && items.length >= 1) ||
         (onboardingStep === 3 && items.length >= 5)
        ) ? (
          <OnboardingOverlay
            step={onboardingStep}
            org={org}
            userId={org?.id || user?.id}
            items={items}
            onUpdate={(updated) => { setOrg(p=>({...p,...updated})); setOnboardingStep(updated.onboarding_step ?? 4); }}
            onNav={nav}
          />
        ) : null
      )}
    </>
  );
}
