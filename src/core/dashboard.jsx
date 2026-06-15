// DASHBOARD — extracted from App.jsx (modularization).
// Dashboard page + its CommunitySpotlight widget (internal).
import React, { useState, useEffect, useRef } from "react";
import { SB } from "./supabase.js";
import { Ic } from "./icons.jsx";
import { CatCard, HeroImg } from "./ui.jsx";
import { fmt$, getPointsName } from "./helpers.js";
import { CAT, CATS, getCatsMerged } from "./inventory.js";
import { POINTS_FREE_MONTH } from "./points-config.js";
import { BG, usp } from "../lib/backgrounds.js";
import { getVertical, getExchangeName, getCatGfx, getTerm } from "../lib/verticals.js";

function CommunitySpotlight({onViewAll}){
  const [posts,   setPosts]   = useState([]);
  const [orgs,    setOrgs]    = useState({});
  const [idx,     setIdx]     = useState(0);
  const [fade,    setFade]    = useState(true);
  const timerRef = useRef(null);

  useEffect(()=>{
    (async()=>{
      // Get viewer coords from org for proximity sorting
      const vLat = null, vLng = null; // org coords passed separately if needed
      const{data}=await SB.rpc("proximity_community_posts",{
        viewer_lat: null, viewer_lng: null, radius_miles: 150, row_limit: 20
      });
      if(!data||data.length===0)return;
      setPosts(data);
      const ids=[...new Set(data.map(p=>p.org_id))];
      const{data:od}=await SB.from("orgs").select("id,name").in("id",ids);
      const map={};(od||[]).forEach(o=>{map[o.id]=o.name;});
      setOrgs(map);
    })();
  },[]);

  // Auto-rotate every 5s
  useEffect(()=>{
    if(posts.length<2)return;
    timerRef.current=setInterval(()=>{
      setFade(false);
      setTimeout(()=>{
        setIdx(i=>(i+1)%posts.length);
        setFade(true);
      },250);
    },5000);
    return()=>clearInterval(timerRef.current);
  },[posts.length]);

  const goTo=(i)=>{
    clearInterval(timerRef.current);
    setFade(false);
    setTimeout(()=>{setIdx(i);setFade(true);},200);
  };

  const PT_COLORS={show:"#7b1fa2",audition:"#1565c0",photo:"#c2185b",wanted:"#d84315",announcement:"#2e7d32"};
  const PT_ICONS ={show:"🎭",audition:"🎤",photo:"📸",wanted:"🔍",announcement:"📢"};
  const PT_LABELS={show:"Upcoming Show",audition:"Audition Notice",photo:"Production Photos",wanted:"Item Wanted",announcement:"Announcement"};

  // Empty state — encourage first post
  if(posts.length===0) return(
    <div style={{background:"var(--parch)",border:"2px dashed var(--border)",borderRadius:"var(--rl)",padding:"32px 24px",textAlign:"center",marginBottom:32}}>
      <div style={{fontSize:40,marginBottom:10}}>🎪</div>
      <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,marginBottom:6}}>Nothing posted yet</h3>
      <p style={{color:"var(--muted)",fontSize:13,maxWidth:380,margin:"0 auto 16px",lineHeight:1.6}}>Be the first to share an upcoming show, post an audition notice, or connect with your theatre community.</p>
      <button className="btn btn-g" onClick={onViewAll}>+ Post to Community Board</button>
    </div>
  );

  const post  = posts[idx];
  const color = PT_COLORS[post.type]||"#7b1fa2";
  const icon  = PT_ICONS[post.type]||"📢";
  const label = PT_LABELS[post.type]||"Post";
  const orgName = orgs[post.org_id]||"A Theatre Program";

  return(
    <div style={{marginBottom:32}}>
      {/* Main card */}
      <div style={{
        background:`linear-gradient(135deg,${color}18,${color}08)`,
        border:`1.5px solid ${color}30`,
        borderRadius:"var(--rl)",
        overflow:"hidden",
        transition:"all .3s",
        cursor:"pointer",
      }} onClick={onViewAll}>
        {/* Top stripe */}
        <div style={{height:4,background:`linear-gradient(90deg,${color},${color}66)`}}/>
        <div style={{
          padding:"22px 24px 18px",
          opacity:fade?1:0,
          transition:"opacity .25s",
        }}>
          {/* Type badge + org */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:22}}>{icon}</span>
              <span style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1,color:color}}>{label}</span>
            </div>
            <div style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>by {orgName}{post.location?` · ${post.location}`:""}</div>
          </div>

          {/* Title */}
          <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,lineHeight:1.2,marginBottom:8,color:"var(--ink)"}}>{post.title}</h3>

          {/* Show meta */}
          {(post.show_title||post.start_date||post.venue)&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}}>
              {post.show_title&&<span style={{fontSize:12,fontWeight:700,padding:"2px 9px",background:color+"18",borderRadius:6,color}}>{post.show_title}</span>}
              {post.venue&&<span style={{fontSize:12,color:"var(--muted)",padding:"2px 9px",background:"var(--white)",borderRadius:6}}>📍 {post.venue}</span>}
              {post.start_date&&<span style={{fontSize:12,fontWeight:700,padding:"2px 9px",background:color+"18",borderRadius:6,color}}>
                📅 {new Date(post.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                {post.end_date&&post.end_date!==post.start_date?" – "+new Date(post.end_date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}
              </span>}
            </div>
          )}

          {/* Body excerpt */}
          {post.body&&<p style={{fontSize:13.5,color:"var(--muted)",lineHeight:1.65,marginBottom:12}}>{post.body.length>180?post.body.slice(0,180)+"…":post.body}</p>}

          {/* Production Photos */}
          {(post.images||[]).length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {(post.images||[]).slice(0,4).map((url,i)=>(
                <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",flexShrink:0,
                  width:(post.images||[]).length===1?"100%":"calc(50% - 3px)",
                  height:(post.images||[]).length===1?240:120,cursor:"pointer"}}
                  onClick={e=>{e.stopPropagation();window.open(url,"_blank");}}>
                  <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  {i===3&&(post.images||[]).length>4&&(
                    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:18}}>
                      +{(post.images||[]).length-4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${color}20`}}>
            <div style={{display:"flex",gap:6}}>
              {(post.tags||[]).slice(0,3).map(t=><span key={t} style={{fontSize:11,padding:"1px 7px",background:"var(--white)",borderRadius:4,color:"var(--muted)"}}>#{t}</span>)}
            </div>
            <span style={{fontSize:12,fontWeight:700,color:color}}>View on Community Board →</span>
          </div>
        </div>
      </div>

      {/* Dots + navigation */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12}}>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {posts.slice(0,8).map((_,i)=>(
            <button key={i} onClick={e=>{e.stopPropagation();goTo(i);}} style={{
              width:i===idx?20:7,height:7,borderRadius:4,border:"none",cursor:"pointer",
              background:i===idx?color:"var(--border)",
              transition:"all .3s",padding:0,
            }}/>
          ))}
          {posts.length>8&&<span style={{fontSize:11,color:"var(--muted)"}}>+{posts.length-8} more</span>}
        </div>
        <button className="btn btn-o btn-sm" onClick={onViewAll} style={{fontSize:12}}>
          See All {posts.length} Post{posts.length!==1?"s":""}
        </button>
      </div>
    </div>
  );
}


export function Dashboard({items,org,plan="free",pointBalance=0,goInventory,goMarketplace,goCommunity,goProfile,goPoints}){
  const totalQty=items.reduce((s,i)=>s+(i.qty||1),0);
  const listed=items.filter(i=>i.mkt!=="Not Listed").length;
  const withImg=items.filter(i=>i.img).length;
  const totalVal=items.reduce((s,i)=>s+((i.sale||0)*(i.qty||1)),0);
  const cc={};items.forEach(i=>{cc[i.category]=(cc[i.category]||0)+(i.qty||1)});
  const maxC=Math.max(1,...Object.values(cc));
  const vVertical=org?.vertical||"theatre"; const vCATS=getCatsMerged(vVertical);
  const [highlights, setHighlights] = useState([]);
  useEffect(()=>{
    (async()=>{
      const{data}=await SB.from("items")
        .select("*, orgs(name,location)")
        .neq("mkt","Not Listed")
        .eq("avail","In Stock")
        .order("added",{ascending:false})
        .limit(40);
      const mine=(data||[]).filter(i=>(i.vertical||"theatre")===vVertical).slice(0,6);
      setHighlights(mine);
    })();
  },[vVertical]);

  const profileIncomplete = !org?.director_name;
  const isTempPro = org?.temp_pro;

  return(
    <div style={{position:"relative",padding:"32px 36px 56px"}}>
      <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.dashboard} w={1400} h={900} className="page-bg-img"/>
      <div className="page-layer">

        {/* Temp Pro beta notice */}
        {isTempPro&&(()=>{
          const itemCount = items.filter(i=>!i._is_loan).length;
          const hasFeedback = org?.founding_member_rate || false;
          const isFoundingMember = org?.founding_member_rate || false;
          const itemsNeeded = Math.max(0, 25 - itemCount);
          const itemPct = Math.min(100, Math.round(itemCount / 25 * 100));

          // Founding member — show celebration
          if (isFoundingMember) return (
            <div style={{background:"linear-gradient(135deg,rgba(76,175,80,.15),rgba(76,175,80,.05))",
              border:"1px solid rgba(76,175,80,.4)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:24,flexShrink:0}}>🎉</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#4caf50",marginBottom:3}}>
                    You've earned the Founding Member Rate — $9.99/month!
                  </div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6}}>
                    You added 25+ items and shared your feedback during beta. When Theatre4u launches,
                    your rate is locked at <strong style={{color:"var(--text)"}}>$9.99/month</strong> for
                    as long as you subscribe — 33% less than the standard $15 rate. Thank you for being
                    a founding member of Theatre4u.
                  </div>
                </div>
              </div>
            </div>
          );

          // Still working toward founding member rate
          return(
            <div style={{background:"linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04))",
              border:"1px solid rgba(212,168,67,.3)",borderRadius:10,padding:"14px 16px",
              marginBottom:16}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
                <span style={{fontSize:20,flexShrink:0}}>⭐</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--gold)",marginBottom:3}}>
                    Full Pro access — complimentary during Theatre4u beta
                  </div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.6,marginBottom:10}}>
                    When Theatre4u launches you'll have the option to subscribe.
                    {" "}<strong style={{color:"var(--text)"}}>Add 25+ items and share feedback</strong>{" "}
                    to lock in the founding member rate of <strong style={{color:"var(--gold)"}}>$9.99/month</strong> — 
                    instead of the standard $15 — for life.
                  </div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:140}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                        <span style={{color:"var(--muted)"}}>📦 Items added</span>
                        <span style={{fontWeight:700,color:itemCount>=25?"#4caf50":"var(--gold)"}}>
                          {itemCount}/25 {itemCount>=25?"✓":""}
                        </span>
                      </div>
                      <div style={{height:5,background:"rgba(0,0,0,.2)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:itemPct+"%",
                          background:itemCount>=25?"#4caf50":"var(--gold)",
                          borderRadius:3,transition:"width .5s"}}/>
                      </div>
                      {itemsNeeded>0&&<div style={{fontSize:10,color:"var(--muted)",marginTop:3}}>
                        {itemsNeeded} more item{itemsNeeded===1?"":"s"} to go
                      </div>}
                    </div>
                    <div style={{flex:1,minWidth:140}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                        <span style={{color:"var(--muted)"}}>💬 Feedback</span>
                        <span style={{fontWeight:700,color:"var(--muted)"}}>via Leading Players button</span>
                      </div>
                      <div style={{height:5,background:"rgba(0,0,0,.2)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:"0%",background:"var(--gold)",borderRadius:3}}/>
                      </div>
                      <div style={{fontSize:10,color:"var(--muted)",marginTop:3}}>
                        Click the ? button to submit
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Incomplete profile banner */}
        {profileIncomplete&&(
          <div style={{background:"rgba(33,150,243,.06)",border:"1px solid rgba(33,150,243,.2)",
            borderRadius:10,padding:"12px 16px",marginBottom:16,
            display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>👤</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13}}>Complete your profile</div>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>
                Add your name under <strong>My Profile → Edit Profile</strong> so other programs know who to contact.
              </div>
            </div>
            <button onClick={goProfile}
              style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(33,150,243,.4)",
                background:"rgba(33,150,243,.1)",color:"#42a5f5",fontSize:12,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
              Go to My Profile →
            </button>
          </div>
        )}

        <div className="hero-wrap" style={{height:380,marginBottom:32}}>
          <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId={BG.dashboard} w={1200} h={480} alt="" loading="eager"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">📦 Inventory · {getTerm(vVertical,"productions")} · Community</div>
            <h1 className="hero-title">{org.name?`Welcome,\n${org.name}`:"Welcome to\nTheatre4u"}</h1>
            <p className="hero-sub">Everything your program owns — cataloged, photographed, and organized. Your program's complete inventory, always at your fingertips.</p>
          </div>
          <div className="hero-bar"/>
        </div>
        {/* Profile Completion Nudge — show only if 2+ fields missing */}
        {([!org?.location, !org?.phone, !org?.bio].filter(Boolean).length >= 2) && items.length > 0 && (
          <div style={{background:"linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.05))",
            border:"1.5px solid rgba(212,168,67,.3)",borderRadius:14,padding:"14px 18px",
            display:"flex",alignItems:"center",gap:14,marginBottom:20,cursor:"pointer"}}
            onClick={()=>goProfile&&goProfile()}>
            <div style={{fontSize:28,flexShrink:0}}>✏️</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--gold)",marginBottom:3}}>
                Complete your profile
              </div>
              <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>
                Add your location, phone, and bio so other programs can find and contact you in Backstage Exchange.
              </div>
            </div>
            <div style={{color:"var(--gold)",fontSize:18,flexShrink:0}}>→</div>
          </div>
        )}

        {/* Stats */}
        <div className="stats">
          {[
            {ico:"📦",val:totalQty,   lbl:"Total Items",     col:"#c4761a", bg:"photo-1558618666-fcd25c85cd64"}, // organized prop storage
            {ico:"📂",val:items.length,lbl:"Entries",         col:"#1554a0", bg:"photo-1489987707025-afc232f7ea0f"}, // costume racks
            {ico:"🏪",val:listed,     lbl:"On "+getExchangeName(vVertical),  col:"#27723a", bg:"photo-1460723237483-7a6dc9d0b212"}, // stage lit up
            {ico:"📷",val:withImg,    lbl:"With Photos",     col:"#a0144e", bg:"photo-1516450360452-9312f5e86fc7"}, // stage lighting rigs
            {ico:"💰",val:totalVal>0?fmt$(totalVal):"—",lbl:"Est. Value",col:"#8b3a0f",bg:"photo-1503095396549-807759245b35"}, // grand theatre
          ].map(s=>(
            <div key={s.lbl} className="stat" style={{borderTop:`4px solid ${s.col}`,overflow:"hidden"}}>
              {/* Background photo with dark overlay */}
              <img src={usp(s.bg,400,200)} alt="" loading="lazy"
                style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.13,pointerEvents:"none",userSelect:"none"}}/>
              <div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${s.col}18,rgba(18,6,0,.55))`,pointerEvents:"none"}}/>
              <div style={{position:"relative",zIndex:1}}>
                <div className="stat-ico">{s.ico}</div>
                <div className="stat-val">{s.val}</div>
                <div className="stat-lbl">{s.lbl}</div>
              </div>
            </div>
          ))}
        </div>
        {/* ── Stage Points Progress Card ── */}
        {plan !== "free" && (
          <div onClick={()=>goPoints&&goPoints()} style={{cursor:"pointer",
            background:"linear-gradient(135deg,rgba(212,168,67,.1),rgba(212,168,67,.04))",
            border:"1.5px solid rgba(212,168,67,.25)",borderRadius:14,
            padding:"16px 20px",marginBottom:24,
            display:"flex",alignItems:"center",gap:16}}>
            <div style={{fontSize:36,flexShrink:0}}>🪙</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                <div style={{fontWeight:800,fontSize:15,color:"var(--gold)"}}>{getPointsName(vVertical)}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--gold)",fontWeight:700}}>
                  {(pointBalance||0).toLocaleString()}
                  <span style={{fontSize:12,color:"var(--muted)",fontWeight:400}}> pts</span>
                </div>
              </div>
              {/* Progress bar toward free month */}
              <div style={{background:"rgba(0,0,0,.2)",borderRadius:99,height:6,marginBottom:6,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,
                  background:"linear-gradient(90deg,var(--gold),#c4921a)",
                  width: Math.min(100,(pointBalance||0)/POINTS_FREE_MONTH*100)+"%",
                  transition:"width .5s ease"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)"}}>
                <span>Earn by sharing inventory &amp; completing Exchange deals</span>
                <span style={{fontWeight:700,color:(pointBalance||0)>=POINTS_FREE_MONTH?"var(--gold)":"var(--muted)"}}>
                  {Math.max(0,POINTS_FREE_MONTH-(pointBalance||0)).toLocaleString()} until free month
                </span>
              </div>
            </div>
            <div style={{color:"var(--gold)",fontSize:18,flexShrink:0}}>→</div>
          </div>
        )}

        {/* ── Community Spotlight ── */}
        <div className="sh"><h2>🎪 Community Board</h2><p>Upcoming events, opportunities, and announcements from your arts network.</p></div>
        <CommunitySpotlight onViewAll={goCommunity}/>
        {/* Divider 1 */}
        <div className="img-div" style={{marginBottom:32}}>
          <HeroImg vertical={vVertical!=="theatre"?vVertical:null} photoId="photo-1503095396549-807759245b35" w={1000} h={240} alt="" loading="lazy"/>
          <div className="img-div-fade"/>
          <div className="img-div-text">
            <h3>{getExchangeName(vVertical)}</h3>
            <p>Browse items posted by other programs — rent, borrow, or purchase. Share your own when you're ready.</p>
          </div>
        </div>
        {/* Marketplace Highlights — auto-scrolling carousel */}
        <div className="sh"><h2>{getExchangeName(vVertical)} — Highlights</h2><p>Items posted for rent, sale, or loan by programs in your community.</p></div>
        {highlights.length===0?(
          <div style={{background:"var(--parch)",border:"2px dashed var(--border)",borderRadius:"var(--rl)",padding:"40px 32px",textAlign:"center",marginBottom:36}}>
            <div style={{fontSize:44,marginBottom:12}}>🏪</div>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:8}}>No Listings Yet</h3>
            <p style={{color:"var(--muted)",fontSize:14,maxWidth:420,margin:"0 auto 18px"}}>When you or other programs post items to the {getExchangeName(vVertical)}, they'll be showcased here for the whole community to discover.</p>
            <button className="btn btn-g" onClick={()=>goMarketplace&&goMarketplace()}>Browse {getExchangeName(vVertical)}</button>
          </div>
        ):(
          <div style={{marginBottom:36}}>
            {/* Carousel track — overflows and animates */}
            <div style={{position:"relative",overflow:"hidden",borderRadius:"var(--rm)",
              background:"var(--parch)",border:"1px solid var(--border)",padding:"20px 0",marginBottom:14}}
              onMouseEnter={e=>e.currentTarget.querySelector(".scroll-track").style.animationPlayState="paused"}
              onMouseLeave={e=>e.currentTarget.querySelector(".scroll-track").style.animationPlayState="running"}>
              {/* Fade edges */}
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:80,
                background:"linear-gradient(to right,var(--parch),transparent)",zIndex:2,pointerEvents:"none"}}/>
              <div style={{position:"absolute",right:0,top:0,bottom:0,width:80,
                background:"linear-gradient(to left,var(--parch),transparent)",zIndex:2,pointerEvents:"none"}}/>
              {/* Scrolling track — duplicated for seamless loop */}
              <div className="scroll-track" style={{
                display:"flex",gap:16,paddingLeft:16,
                width:"max-content",
                animation:`mkt-scroll ${highlights.length * 6}s linear infinite`,
              }}>
                {[...highlights,...highlights].map((item,i)=>{
                  const cat=CAT[item.category]||CAT.other;
                  const orgName=item.orgs?.name||"";
                  const mktCls=item.mkt==="For Rent"?"mb-rent":item.mkt==="For Sale"?"mb-sale":item.mkt==="For Loan"?"mb-loan":"mb-both";
                  return(
                    <div key={`${item.id}-${i}`}
                      onClick={()=>goMarketplace&&goMarketplace()}
                      style={{width:220,flexShrink:0,background:"var(--cream)",borderRadius:"var(--rm)",
                        border:"1px solid var(--border)",overflow:"hidden",cursor:"pointer",
                        boxShadow:"var(--sh1)",transition:"transform .2s,box-shadow .2s"}}
                      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="var(--sh2)";}}
                      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="var(--sh1)";}}>
                      {/* Image or gradient */}
                      <div style={{height:140,position:"relative",overflow:"hidden",flexShrink:0}}>
                        {item.img
                          ?<img src={item.img} alt={item.name} loading="lazy"
                              style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          :<div style={{width:"100%",height:"100%",
                              background:getCatGfx(vVertical,item.category).grad,
                              display:"flex",alignItems:"center",justifyContent:"center",
                              fontSize:52,opacity:.85}}>
                              {cat.icon}
                            </div>
                        }
                        {/* Org badge top-left */}
                        {orgName&&<div style={{position:"absolute",top:8,left:8,
                          background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)",
                          color:"#fff",fontSize:10,fontWeight:700,padding:"2px 7px",
                          borderRadius:6,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {orgName}
                        </div>}
                        {/* Badge top-right */}
                        <div style={{position:"absolute",top:8,right:8}}>
                          <span className={`mkt-badge ${mktCls}`}>{item.mkt}</span>
                        </div>
                      </div>
                      {/* Info */}
                      <div style={{padding:"10px 12px"}}>
                        <div style={{fontSize:11,color:cat.color,fontWeight:700,marginBottom:3}}>{cat.icon} {cat.label}</div>
                        <div style={{fontFamily:"'Lora',serif",fontSize:14,fontWeight:600,lineHeight:1.3,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:6}}>{item.name}</div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontSize:11,color:"var(--muted)"}}>{item.condition} · ×{item.qty}</span>
                          <span style={{fontWeight:800,fontSize:13,color:"var(--cog)"}}>
                            {item.mkt==="For Loan"
                              ?`${item.loan_period||2}wk loan`
                              :item.rent>0?fmt$(item.rent)+"/wk"
                              :item.sale>0?fmt$(item.sale):""}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{textAlign:"center"}}>
              <button className="btn btn-g" onClick={()=>goMarketplace&&goMarketplace()}>
                Browse All Listings →
              </button>
            </div>
          </div>
        )}
        {/* Category gallery */}
        <div className="sh"><h2>Browse by Category</h2><p>Click any category to explore your inventory.</p></div>
        <div className="cat-gallery" style={{marginBottom:36}}>
          {vCATS.map(cat=>{
            const count=items.filter(it=>it.category===cat.id).length;
            return(
              <div key={cat.id} className="cat-tile" onClick={()=>goInventory&&goInventory(cat.id)}>
                <CatCard catId={cat.id} label={cat.label} icon={cat.icon} width="100%" height={160} vertical={vVertical}>
                  <div className="cat-info"><span className="cat-emo">{cat.icon}</span><span className="cat-name">{cat.label}</span>{count>0&&<div className="cat-cnt">{count} item{count!==1?"s":""}</div>}</div>
                </CatCard>
              </div>
            );
          })}
        </div>
        {/* Divider 2 */}
        <div className="img-div" style={{marginBottom:32}}>
          <img src={usp("photo-1504196606672-aef5c9cefc92",1000,240)} alt="" loading="lazy"/>
          <div className="img-div-fade"/>
          <div className="img-div-text">
            <h3>{getTerm(vVertical,"tagline")}</h3>
            <p>{getTerm(vVertical,"taglineSub")}</p>
          </div>
        </div>
        {/* Bar chart */}
        {items.length>0?(
          <div className="card card-p">
            <div className="sh" style={{marginBottom:20}}><h2>Inventory at a Glance</h2></div>
            {vCATS.map(cat=>{const c=cc[cat.id]||0;if(!c)return null;return(
              <div key={cat.id} className="bar-row">
                <span className="bar-ico">{cat.icon}</span>
                <span className="bar-lbl">{cat.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:`${(c/maxC)*100}%`,background:cat.color}}/></div>
                <span className="bar-cnt">{c}</span>
              </div>
            );})}
          </div>
        ):(
          <div className="empty"><div className="empty-ico">{getVertical(vVertical).icon}</div><h3>Welcome to Your Program</h3><p>Load sample data from Settings, or add your first item to begin.</p></div>
        )}
      </div>
    </div>
  );
}