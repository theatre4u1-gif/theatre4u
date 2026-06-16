// COMMUNITY BOARD — extracted from App.jsx (modularization).
// Components: CommunityPostForm, CommunityPostCard, CommunityPage, CommunityGate.
// Constants: POST_TYPES, PT. Only CommunityGate is rendered by App.jsx.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SB } from "./supabase.js";
import { Ic } from "./icons.jsx";
import { resizeImg, postShareText } from "./helpers.js";
import { EM } from "./messages.js";
import { FbShareBtn, Modal } from "./ui.jsx";
import { usp } from "../lib/backgrounds.js";
import { getVertical, getTerm } from "../lib/verticals.js";

// ══════════════════════════════════════════════════════════════════════════════
// COMMUNITY BOARD
// ══════════════════════════════════════════════════════════════════════════════
const POST_TYPES = [
  { id:"show",         label:"Upcoming Event",   icon:"🎟️", color:"#7b1fa2", desc:"Share your performance, concert, or exhibition dates" },
  { id:"audition",     label:"Call / Tryout",    icon:"🎤", color:"#1565c0", desc:"Looking for performers, members, or crew" },
  { id:"photo",        label:"Event Photos",      icon:"📸", color:"#c2185b", desc:"Share photos from your recent events" },
  { id:"wanted",       label:"Item Wanted",       icon:"🔍", color:"#d84315", desc:"Looking for a specific prop, costume, or equipment" },
  { id:"resource",     label:"Resource Share",    icon:"🤝", color:"#00838f", desc:"Offering props, costumes, or equipment to borrow or share" },
  { id:"announcement", label:"Announcement",      icon:"📢", color:"#2e7d32", desc:"News, updates, or anything else" },
];
const PT = Object.fromEntries(POST_TYPES.map(p=>[p.id,p]));

function CommunityPostForm({initial, onSave, onCancel, saving=false}) {
  const blank = {type:"show",title:"",body:"",show_title:"",venue:"",start_date:"",end_date:"",ticket_url:"",contact_email:"",tags:[],images:[]};
  const [f,setF] = useState(()=>initial ? {...blank,...initial,images:initial.images||[]} : blank);
  const [tagInput,setTagInput] = useState("");
  const [uploading,setUploading] = useState(false);
  const photoRef = useRef();
  const upd = (k,v)=>setF(p=>({...p,[k]:v}));

  const handlePhotos = async(e)=>{
    const files = Array.from(e.target.files||[]).slice(0,6-(f.images||[]).length);
    if(!files.length) return;
    setUploading(true);
    const urls = [];
    for(const file of files){
      // Use resizeImg if available, otherwise compressImage
      const resized = typeof resizeImg==="function"
        ? await resizeImg(file,1200,0.85)
        : await new Promise(res=>{
            const reader=new FileReader();
            reader.onload=e2=>{
              const img=new Image();
              img.onload=()=>{
                const canvas=document.createElement("canvas");
                let w=img.width,h=img.height;
                if(w>1200){h=Math.round(1200/w*h);w=1200;}
                canvas.width=w;canvas.height=h;
                canvas.getContext("2d").drawImage(img,0,0,w,h);
                res(canvas.toDataURL("image/jpeg",0.85));
              };
              img.src=e2.target.result;
            };
            reader.readAsDataURL(file);
          });
      // Upload to community-photos bucket
      try{
        const blob=await fetch(resized).then(r=>r.blob());
        const path=`community/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const{data,error}=await SB.storage.from("community-photos").upload(path,blob,{contentType:"image/jpeg",upsert:false});
        if(!error&&data){
          const{data:urlData}=SB.storage.from("community-photos").getPublicUrl(path);
          if(urlData?.publicUrl) urls.push(urlData.publicUrl);
        }
      }catch(err){console.error("Photo upload error:",err);}
    }
    upd("images",[...(f.images||[]),...urls]);
    setUploading(false);
    if(photoRef.current) photoRef.current.value="";
  };

  const removePhoto=(url)=>upd("images",(f.images||[]).filter(u=>u!==url));
  const addTag=()=>{const t=tagInput.trim().toLowerCase();if(t&&!(f.tags||[]).includes(t))upd("tags",[...(f.tags||[]),t]);setTagInput("");};
  const valid = f.title.trim() && f.type;

  return(<div className="fg2">
    <div className="fg fu">
      <label className="fl">Post Type</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {POST_TYPES.map(pt=>(
          <button key={pt.id} type="button" onClick={()=>upd("type",pt.id)}
            style={{padding:"8px 14px",borderRadius:8,border:"1.5px solid",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",
              background:f.type===pt.id?pt.color+"22":"var(--parch)",
              color:f.type===pt.id?pt.color:"var(--muted)",
              borderColor:f.type===pt.id?pt.color:"var(--border)"}}>
            {pt.icon} {pt.label}
          </button>
        ))}
      </div>
    </div>
    <div className="fg fu"><label className="fl">Title *</label><input className="fi" value={f.title} onChange={e=>upd("title",e.target.value)} placeholder={f.type==="show"?"e.g. Tickets Now Available — Into the Woods":f.type==="audition"?"e.g. Seeking Leads & Ensemble for Spring Musical":f.type==="wanted"?"e.g. Looking for Wizard of Oz costume set":"Title"} autoFocus/></div>
    {(f.type==="show"||f.type==="audition")&&<>
      <div className="fg"><label className="fl">Show Title</label><input className="fi" value={f.show_title||""} onChange={e=>upd("show_title",e.target.value)} placeholder="Into the Woods"/></div>
      <div className="fg"><label className="fl">Venue</label><input className="fi" value={f.venue||""} onChange={e=>upd("venue",e.target.value)} placeholder="Lincoln High Auditorium"/></div>
    </>}
    {f.type==="show"&&<>
      <div className="fg"><label className="fl">Opening Date</label><input className="fi" type="date" value={f.start_date||""} onChange={e=>upd("start_date",e.target.value)}/></div>
      <div className="fg"><label className="fl">Closing Date</label><input className="fi" type="date" value={f.end_date||""} onChange={e=>upd("end_date",e.target.value)}/></div>
      <div className="fg"><label className="fl">Ticket Link (optional)</label><input className="fi" type="url" value={f.ticket_url||""} onChange={e=>upd("ticket_url",e.target.value)} placeholder="https://..."/></div>
    </>}
    {f.type==="audition"&&<>
      <div className="fg"><label className="fl">Audition Date(s)</label><input className="fi" type="date" value={f.start_date||""} onChange={e=>upd("start_date",e.target.value)}/></div>
      <div className="fg"><label className="fl">Contact Email</label><input className="fi" type="email" value={f.contact_email||""} onChange={e=>upd("contact_email",e.target.value)} placeholder="director@school.edu"/></div>
    </>}
    <div className="fg fu"><label className="fl">{f.type==="photo"?"Caption / Description":f.type==="audition"?"What You're Looking For":"Details"}</label><textarea className="ft" value={f.body||""} onChange={e=>upd("body",e.target.value)} placeholder={f.type==="show"?"Tell the community about your production...":f.type==="audition"?"Describe the roles available, experience needed, rehearsal schedule...":f.type==="wanted"?"Describe exactly what you're looking for...":"What would you like to share?"}/></div>

    <div className="fg fu">
      <label className="fl">Tags</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>{(f.tags||[]).map(t=><span key={t} className="mt" style={{cursor:"pointer"}} onClick={()=>upd("tags",f.tags.filter(x=>x!==t))}>{t} ×</span>)}</div>
      <div style={{display:"flex",gap:6}}><input className="fi" value={tagInput} onChange={e=>setTagInput(e.target.value)} placeholder="musical, drama, comedy..." style={{flex:1}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag();}}}/><button className="btn btn-o btn-sm" onClick={addTag}>Add</button></div>
    </div>
    
    {/* ── Photo Upload ─────────────────────────────────────────── */}
    <div className="fg fu" style={{marginBottom:4}}>
      <label className="fl" style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        📸 Production Photos <span style={{fontWeight:400,color:"var(--muted)",fontSize:10}}>(up to 6)</span>
      </label>
      {(f.images||[]).length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
          {(f.images||[]).map((url,i)=>(
            <div key={i} style={{position:"relative",width:80,height:80,borderRadius:8,overflow:"hidden",border:"1.5px solid var(--border)",flexShrink:0}}>
              <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <button onClick={()=>removePhoto(url)} style={{position:"absolute",top:2,right:2,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,.75)",border:"none",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>
            </div>
          ))}
        </div>
      )}
      {(f.images||[]).length<6&&(
        <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:8,border:"1.5px dashed var(--border)",cursor:"pointer",color:"var(--muted)",fontSize:13,fontWeight:600,transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--gold)";e.currentTarget.style.color="var(--gold)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--muted)";}}>
          {uploading?"⏳ Uploading…":"📷 Add Photos"}
          <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} disabled={uploading}/>
        </label>
      )}
      {uploading&&<div style={{fontSize:12,color:"var(--gold)",marginTop:4}}>Uploading photos…</div>}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10,paddingTop:14,borderTop:"1.5px solid var(--border)",gridColumn:"1/-1"}}>
      <button className="btn btn-o" onClick={onCancel}>Cancel</button>
      <button className="btn btn-g" disabled={!valid||saving} style={(!valid||saving)?{opacity:.4}:{}} onClick={()=>onSave(f)}>{saving?"Posting…":initial?"Save Changes":"Post to Community"}</button>
    </div>
  </div>);
}

function CommunityPostCard({post, orgName, onEdit, onDelete, isOwn}) {
  const pt = PT[post.type]||PT.announcement;
  const [expanded,setExpanded] = useState(false);
  const hasMore = post.body && post.body.length > 160;

  return(
    <div className="card" style={{marginBottom:14,overflow:"hidden",border:`1px solid ${pt.color}22`}}>
      {/* Header stripe */}
      <div style={{height:4,background:`linear-gradient(90deg,${pt.color},${pt.color}88)`}}/>
      <div style={{padding:"14px 18px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
            <div style={{width:40,height:40,borderRadius:10,background:pt.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{pt.icon}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:pt.color,marginBottom:2}}>{pt.label}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,lineHeight:1.2,color:"var(--ink)"}}>{post.title}</div>
            </div>
          </div>
          {isOwn&&<div style={{display:"flex",gap:4,flexShrink:0}}>
            <button className="ico-btn" onClick={()=>onEdit(post)}>{Ic.edit}</button>
            <button className="ico-btn" style={{color:"var(--red)"}} onClick={()=>onDelete(post.id)}>{Ic.trash}</button>
          </div>}
        </div>

        {/* Show/audition meta */}
        {(post.show_title||post.venue||post.start_date)&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            {post.show_title&&<span style={{padding:"2px 9px",background:"var(--parch)",borderRadius:6,fontSize:12,fontWeight:600,color:"var(--ink)"}}>{post.show_title}</span>}
            {post.venue&&<span style={{padding:"2px 9px",background:"var(--parch)",borderRadius:6,fontSize:12,color:"var(--muted)"}}>📍 {post.venue}</span>}
            {post.start_date&&<span style={{padding:"2px 9px",background:pt.color+"15",borderRadius:6,fontSize:12,fontWeight:600,color:pt.color}}>📅 {new Date(post.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}{post.end_date&&post.end_date!==post.start_date?" – "+new Date(post.end_date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}  </span>}
          </div>
        )}

        {/* Body */}
        {post.body&&(
          <div style={{fontSize:13.5,color:"var(--muted)",lineHeight:1.7,marginBottom:10}}>
            {expanded||!hasMore ? post.body : post.body.slice(0,160)+"…"}
            {hasMore&&<button onClick={()=>setExpanded(!expanded)} style={{marginLeft:5,background:"none",border:"none",color:pt.color,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{expanded?"Show less":"Read more"}</button>}
          </div>
        )}

        {/* Footer */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--amber))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🎭</div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--ink)"}}>{orgName}</div>
              {post.location&&<div style={{fontSize:11,color:"var(--faint)"}}>{post.location}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {(post.tags||[]).slice(0,3).map(t=><span key={t} className="mt">#{t}</span>)}
            {post.ticket_url&&<a href={post.ticket_url} target="_blank" rel="noreferrer" className="btn btn-o btn-sm" style={{fontSize:11,padding:"3px 10px"}}>🎟️ Tickets</a>}
            {post.contact_email&&<a href={`mailto:${post.contact_email}`} className="btn btn-o btn-sm" style={{fontSize:11,padding:"3px 10px"}}>✉️ Contact</a>}
            <FbShareBtn
              url={"https://theatre4u.org/#/community"}
              text={postShareText(post, orgName)}
              compact={true}
              style={{fontSize:11,padding:"3px 9px"}}
            />
            {post.distance_miles != null && (
              <span style={{fontSize:11,fontWeight:700,padding:"1px 7px",background:"rgba(255,255,255,.06)",borderRadius:5,color:"var(--muted)"}}>
                📍 {post.distance_miles < 1 ? "< 1" : Math.round(post.distance_miles)} mi
              </span>
            )}
            <div style={{fontSize:11,color:"var(--faint)"}}>{new Date(post.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunityPage({userId, org, plan}) {
  const [posts,    setPosts]   = useState([]);
  const [orgs,     setOrgs]    = useState({});
  const [loading,  setLoading] = useState(true);
  const [viewerLoc,setViewerLoc] = useState(null);
  const [typeF,    setTypeF]   = useState("all");
  const [search,   setSearch]  = useState("");
  const [modal,    setModal]   = useState(null);
  const [active,   setActive]  = useState(null);
  const [saving,   setSaving]  = useState(false);
  const [msg,      setMsg]     = useState("");

  const load = useCallback(async()=>{
    setLoading(true);
    // Get viewer location — use stored org coords only, no blocking network calls
    const vLat = org?.lat || null;
    const vLng = org?.lng || null;
    setViewerLoc(vLat && vLng ? { lat: vLat, lng: vLng } : null);

    // Use proximity RPC — falls back to recency if no location
    const { data } = await SB.rpc("proximity_community_posts", {
      viewer_lat:   vLat   || null,
      viewer_lng:   vLng   || null,
      radius_miles: 150,
      row_limit:    80,
      p_vertical:   org?.vertical || null,   // per-vertical community: only this department's posts
    });
    // Strip computed RPC columns (distance_miles) before storing
    setPosts((data || []).map(({distance_miles, ...p}) => p));
    // Load org names
    const ids = [...new Set((data || []).map(p => p.org_id))];
    if (ids.length > 0) {
      const { data: orgData } = await SB.from("orgs").select("id,name,location").in("id", ids);
      const map = {}; (orgData || []).forEach(o => { map[o.id] = o.name; });
      setOrgs(map);
    }
    setLoading(false);
  }, [org?.lat, org?.lng, org?.location, org?.vertical]);

  useEffect(()=>{load();},[load]);

  const save = async(f)=>{
    setSaving(true);
    try {
      // Use org's stored coordinates directly — no geocoding needed
      // The org's lat/lng is already stored from profile setup
      const geoFields = (org?.lat && org?.lng)
        ? { lat: org.lat, lng: org.lng }
        : viewerLoc
          ? { lat: viewerLoc.lat, lng: viewerLoc.lng }
          : {};
      // Convert empty date strings to null — Postgres DATE columns reject ""
      // Only include real community_posts columns — strip computed fields like distance_miles
      const row = {
        type:           f.type,
        title:          f.title,
        body:           f.body         || null,
        show_title:     f.show_title   || null,
        venue:          f.venue        || null,
        location:       f.location     || null,
        start_date:     f.start_date   || null,
        end_date:       f.end_date     || null,
        ticket_url:     f.ticket_url   || null,
        contact_email:  f.contact_email|| null,
        tags:           f.tags         || [],
        images:         f.images       || [],
        org_id:         userId,
        vertical:       org?.vertical || "theatre",
        status:         "active",
        ...geoFields,
      };
      if(active&&modal==="edit"){
        const{data,error}=await SB.from("community_posts").update(row).eq("id",active.id).select().single();
        if(error) throw new Error(error.message);
        if(data){setPosts(p=>p.map(x=>x.id===data.id?data:x));setMsg("✓ Post updated");}
      } else {
        const{data,error}=await SB.from("community_posts").insert(row).select().single();
        if(error) throw new Error(error.message);
        if(data){setPosts(p=>[data,...p]);setMsg("✓ Post published!");}
      }
      setModal(null);setActive(null);
      setTimeout(()=>setMsg(""),3000);
    } catch(err) {
      console.error("Community post save error:", err);
      setMsg("❌ " + EM.generic.body);
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async(id)=>{
    if(!window.confirm("Delete this post?"))return;
    await SB.from("community_posts").update({status:"archived"}).eq("id",id);
    setPosts(p=>p.filter(x=>x.id!==id));
  };

  const filtered = posts.filter(p=>{
    if(typeF!=="all"&&p.type!==typeF)return false;
    if(search){const q=search.toLowerCase();return p.title.toLowerCase().includes(q)||(p.body||"").toLowerCase().includes(q)||(p.show_title||"").toLowerCase().includes(q)||(p.location||"").toLowerCase().includes(q)||(p.tags||[]).some(t=>t.includes(q));}
    return true;
  });

  const myPosts = posts.filter(p=>p.org_id===userId);

  return(
    <div style={{position:"relative"}}>
      <img src={usp("photo-1503095396549-807759245b35",1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:230}}>
          <img src={usp("photo-1503095396549-807759245b35",1100,290)} alt="Community" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🎪 {getVertical(org?.vertical).label} Community</div>
            <h1 className="hero-title" style={{fontSize:44}}>Community Board</h1>
            <p className="hero-sub">{getTerm(org?.vertical,"communityIntro")}</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 56px",position:"relative",zIndex:1}}>
        {/* Actions bar */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20,alignItems:"center"}}>
          <div className="srch" style={{position:"relative",flex:1,minWidth:220}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",display:"flex",pointerEvents:"none"}}>{Ic.search}</span>
            <input className="fi" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search the board…" style={{paddingLeft:34,width:"100%"}}/>
          </div>
          <div style={{display:"flex",gap:0,border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
            {[["all","All"],["show","🎟️ Events"],["audition","🎤 Calls"],["photo","📸 Photos"],["wanted","🔍 Wanted"],["announcement","📢 News"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTypeF(id)} style={{background:typeF===id?"var(--gold)":"transparent",color:typeF===id?"#1a0f00":"var(--muted)",border:"none",padding:"7px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
                {label}
              </button>
            ))}
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            {msg&&<span style={{color:msg.startsWith("❌")?"var(--red)":"var(--green)",fontWeight:700,fontSize:13}}>{msg}</span>}
            <button className="btn btn-g" onClick={()=>{setActive(null);setModal("add");}}>+ Share Something</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:24,alignItems:"start"}}>
          {/* Main feed */}
          <div>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:12,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
              <span>{filtered.length} post{filtered.length!==1?"s":""}{typeF!=="all"?` · ${PT[typeF]?.label}`:""}</span>
              {viewerLoc
                ? <span style={{color:"var(--green)",fontWeight:700}}>📍 Sorted by proximity to you</span>
                : <span style={{color:"var(--amber)",fontSize:11}}>⚠️ Set your location in Profile for proximity sorting</span>}
            </div>
            {loading
              ?<div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>Loading community posts…</div>
              :filtered.length===0
                ?<div className="empty">
                    <div className="empty-ico">🎪</div>
                    <h3>Be the first to post</h3>
                    <p>Share your upcoming show, post an audition notice, or let the community know what items you're looking for.</p>
                    <button className="btn btn-g" onClick={()=>{setActive(null);setModal("add");}}>+ Share Something</button>
                  </div>
                :filtered.map(post=>(
                    <CommunityPostCard key={post.id} post={post} orgName={orgs[post.org_id]||"A Theatre Program"} isOwn={post.org_id===userId} onEdit={p=>{setActive(p);setModal("edit");}} onDelete={deletePost}/>
                  ))
            }
          </div>

          {/* Sidebar */}
          <div style={{position:"sticky",top:80}}>
            {/* Your posts */}
            {myPosts.length>0&&(
              <div className="card card-p" style={{marginBottom:16}}>
                <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:12}}>Your Posts</h3>
                {myPosts.slice(0,5).map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--linen)"}}>
                    <span style={{fontSize:16}}>{PT[p.type]?.icon||"📢"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                      <div style={{fontSize:10,color:"var(--muted)"}}>{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                    <button className="ico-btn" style={{flexShrink:0,color:"var(--red)"}} onClick={()=>deletePost(p.id)}>{Ic.trash}</button>
                  </div>
                ))}
              </div>
            )}

            {/* What to post guide */}
            <div className="card card-p" style={{background:"linear-gradient(135deg,rgba(212,168,67,.08),rgba(212,168,67,.03))",borderColor:"rgba(212,168,67,.25)"}}>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:12,color:"var(--gold)"}}>What to Share</h3>
              {POST_TYPES.map(pt=>(
                <div key={pt.id} style={{display:"flex",gap:8,padding:"7px 0",borderBottom:"1px solid var(--linen)"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{pt.icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:pt.color}}>{pt.label}</div>
                    <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.4}}>{pt.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{marginTop:10,fontSize:11,color:"var(--muted)",lineHeight:1.5}}>Open to all Theatre4u™ members — free and Pro alike.</div>
              <div style={{marginTop:8,fontSize:11,color:"var(--amber)",lineHeight:1.5,padding:"6px 8px",background:"rgba(212,168,67,.08)",borderRadius:6}}>
                📍 Posts are sorted by proximity. Set your city in Profile for best results.
              </div>
            </div>
          </div>
        </div>
      </div>

      {(modal==="add"||modal==="edit")&&(
        <Modal title={modal==="add"?"Share with the Community":"Edit Post"} onClose={()=>{setModal(null);setActive(null);}}>
          <CommunityPostForm initial={modal==="edit"?active:null} onSave={save} onCancel={()=>{setModal(null);setActive(null);}} saving={saving}/>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMUNITY GATE — opt-in wrapper for CommunityPage
// ══════════════════════════════════════════════════════════════════════════════
export function CommunityGate({userId, org, setOrg, plan}) {
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    const updated = {...org, community_enabled: true};
    setOrg(updated);
    await SB.from("orgs").update({community_enabled: true}).eq("id", userId);
    // no need to setJoining(false) — component will re-render as CommunityPage
  };

  if (org?.community_enabled) {
    return <CommunityPage userId={userId} org={org} plan={plan}/>;
  }

  return (
    <div style={{position:"relative",minHeight:"70vh"}}>
      <img src={usp("photo-1503095396549-807759245b35",1400,900)} alt="" className="page-bg-img"/>
      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:230}}>
          <img src={usp("photo-1503095396549-807759245b35",1100,290)} alt="Community" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">🎪 Theatre Community</div>
            <h1 className="hero-title" style={{fontSize:44}}>Community Board</h1>
            <p className="hero-sub">Connect with theatre programs across the network.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"40px 36px 64px",position:"relative",zIndex:1,maxWidth:700}}>
        <div className="card card-p" style={{borderColor:"rgba(212,168,67,.3)",background:"linear-gradient(135deg,rgba(212,168,67,.06),rgba(212,168,67,.02))"}}>
          <div style={{fontSize:44,marginBottom:16,textAlign:"center"}}>🎪</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,marginBottom:12,textAlign:"center"}}>Join the Community Board</h2>
          <p style={{color:"var(--muted)",fontSize:14,lineHeight:1.7,marginBottom:20,textAlign:"center",maxWidth:500,margin:"0 auto 20px"}}>
            The Community Board is a shared space for {getVertical(org?.vertical).label} programs to connect — post updates, notices, photos, and requests. Other opted-in programs can see your posts.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
            {[
              ["🎭","Post Show Announcements","Let the network know about your upcoming productions."],
              ["🎤","Share Audition Notices","Find talent and help others find their next role."],
              ["📸","Share Production Photos","Celebrate your work with the broader community."],
              ["🔍","Post Wanted Items","Let others know what you're looking for."],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{padding:"14px",background:"var(--parch)",borderRadius:10,border:"1px solid var(--linen)"}}>
                <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{title}</div>
                <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.4}}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(212,168,67,.08)",border:"1px solid rgba(212,168,67,.2)",borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:12,color:"var(--muted)",lineHeight:1.5}}>
            📍 <strong>Proximity sorted</strong> — posts from nearby programs appear first. Set your city or zip in <strong>Profile</strong> for best results. You can leave the Community Board at any time from <strong>Settings</strong>.
          </div>
          <div style={{textAlign:"center"}}>
            <button className="btn btn-g" style={{fontSize:15,padding:"11px 32px"}}
              disabled={joining} onClick={join}>
              {joining ? "Joining…" : "Join the Community Board →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
