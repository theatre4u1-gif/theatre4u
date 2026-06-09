import React, { useEffect } from "react";
import { Ic } from "./icons.jsx";
import { getCatGfx } from "../lib/verticals.js";
import { VERTICAL_BG_GRAD, usp } from "../lib/backgrounds.js";

// Shared UI primitives — extracted from App.jsx
export function Pager({total,page,per,onPage}){
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

export function Modal({title,onClose,children,footer}){
  useEffect(()=>{const h=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[onClose]);
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hd"><h2>{title}</h2><button className="ico-btn" onClick={onClose}>{Ic.x}</button></div>
        <div className="modal-bd">{children}</div>
        {footer&&<div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

export function FbShareBtn({ url, text, label="Share on Facebook", compact=false, style={} }) {
  const [shared, setShared] = useState(false);
  const handle = (e) => {
    e.stopPropagation();
    fbShare(url, text);
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  };
  return (
    <button onClick={handle} title="Share on Facebook"
      style={{ display:"inline-flex", alignItems:"center", gap:5,
        padding: compact ? "3px 9px" : "5px 12px",
        borderRadius:6, border:"1px solid rgba(24,119,242,.35)",
        background: shared ? "rgba(24,119,242,.2)" : "rgba(24,119,242,.08)",
        color: shared ? "#fff" : "#4285f4",
        fontSize:12, fontWeight:700, cursor:"pointer",
        fontFamily:"inherit", flexShrink:0, transition:"all .15s", ...style }}>
      {shared ? "✓ Shared!" : (<>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        {compact ? "Share" : label}
      </>)}
    </button>
  );
}

export function HeroImg({ vertical, photoId, w, h, alt="", className, loading="lazy" }){
  const grad = VERTICAL_BG_GRAD[vertical];
  if (grad) return <div aria-hidden="true" className={className} style={{width:"100%",height:"100%",background:grad}}/>;
  return <img src={usp(photoId,w,h)} alt={alt} className={className} loading={loading}/>;
}

export function CatCard({catId,label,icon,width=300,height=160,children,vertical="theatre"}){
  const g=getCatGfx(vertical,catId);
  return(
    <div style={{width,height,background:g.grad,borderRadius:8,position:"relative",overflow:"hidden",display:"flex",alignItems:"flex-end"}}>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(height*0.38),opacity:.25,userSelect:"none"}}>{g.icon}</div>
      <div style={{position:"relative",zIndex:1,width:"100%"}}>{children}</div>
    </div>
  );
}

export function CatThumb({catId,size=56,vertical="theatre"}){
  const g=getCatGfx(vertical,catId);
  return(
    <div style={{width:size,height:size,background:g.grad,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*0.44),flexShrink:0}}>
      {g.icon}
    </div>
  );
}
