import React, { useEffect } from "react";
import { Ic } from "./icons.jsx";

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
