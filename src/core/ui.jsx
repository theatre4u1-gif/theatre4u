import React from "react";

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
