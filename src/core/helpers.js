// Small shared helpers — extracted from App.jsx.
export function authErrKey(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("email not confirmed") || m.includes("wrong password") || m.includes("incorrect password")) return "loginBadPassword";
  if (m.includes("user not found") || m.includes("no user") || m.includes("email not found") || m.includes("no account")) return "loginNoEmail";
  if (m.includes("expired") || m.includes("jwt") || m.includes("refresh_token")) return "sessionExpired";
  return null;
}

export function getRefCode() {
  try { return sessionStorage.getItem("t4u_ref") || null; } catch(e) { return null; }
}

export const isDemoMode = () => {
  try { return new URLSearchParams(window.location.search).get("demo") === "1"; } catch { return false; }
};

export function parseCSV(text) {
  const lines = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").filter(l=>l.trim());
  const rows = [];
  for (const line of lines) {
    const cols = [];
    let cur = "", inQ = false;
    for (let i=0; i<line.length; i++) {
      const c = line[i];
      if (c==="\"" && inQ && line[i+1]==="\"") { cur+="\""; i++; }
      else if (c==="\"") { inQ=!inQ; }
      else if (c==="," && !inQ) { cols.push(cur); cur=""; }
      else { cur+=c; }
    }
    cols.push(cur);
    rows.push(cols.map(c=>c.trim()));
  }
  return rows;
}

// CSV import field schema (used by autoMatch + CSVImport's column mapper).
// Restored from git history — was accidentally deleted in an earlier commit.
export const CSV_FIELDS = [
  { key:"name",       label:"Item Name",    required:true,  hints:["name","item","title","item name"] },
  { key:"category",   label:"Category",     required:false, hints:["category","cat","type","kind"] },
  { key:"condition",  label:"Condition",    required:false, hints:["condition","cond","quality","state"] },
  { key:"size",       label:"Size",         required:false, hints:["size","sz"] },
  { key:"qty",        label:"Quantity",     required:false, hints:["qty","quantity","count","amount","num","number"] },
  { key:"location",   label:"Location",     required:false, hints:["location","loc","storage","bin","room","where","place"] },
  { key:"avail",      label:"Availability", required:false, hints:["availability","avail","available","status"] },
  { key:"mkt",        label:"Market Status",required:false, hints:["market","mkt","listing","listed","for rent","for sale"] },
  { key:"rent",       label:"Rental Price", required:false, hints:["rent","rental","rate","per week","weekly"] },
  { key:"loan_period",label:"Loan Period",  required:false, hints:["loan period","loan weeks","borrow period","lending period","weeks"] },
  { key:"deposit",    label:"Deposit",      required:false, hints:["deposit","security","refundable"] },
  { key:"sale",       label:"Sale Price",   required:false, hints:["sale","sell","price","cost","value"] },
  { key:"tags",       label:"Tags",         required:false, hints:["tags","tag","keywords","labels"] },
  { key:"description",label:"Description",  required:false, hints:["description","desc","item description","about","overview"] },
  { key:"img",        label:"Image URL",    required:false, hints:["image","image url","photo","photo url","img","picture","url","photo link","image link"] },
  { key:"notes",      label:"Notes",        required:false, hints:["notes","note","comments","comment","remarks","details"] },
];

export function autoMatch(header) {
  const h = header.toLowerCase().trim();
  for (const f of CSV_FIELDS) {
    if (h === f.key) return f.key;
    if (f.hints.some(hint => h.includes(hint) || hint.includes(h))) return f.key;
  }
  return null;
}

export function postShareText(post, orgName) {
  const body = post.body ? "\n\n"+post.body.slice(0,200)+(post.body.length>200?"…":"") : "";
  return "🎭 "+post.title+(orgName?" — "+orgName:"")+body+
    "\n\nPosted on Theatre4u Community.\n\ntheatre4u.org #Theatre #TheatreEducation";
}

export function resizeImg(file,maxW=560,q=0.78){
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

export function fbShare(url, quote="") {
  const params = new URLSearchParams({ u: url, ...(quote ? { quote } : {}) });
  window.open("https://www.facebook.com/sharer/sharer.php?" + params, "fb-share", "width=600,height=500,scrollbars=yes");
}

export const getPointsName = (vertical) => (!vertical || vertical === "theatre") ? "Stage Points" : "Encore Points";

export function itemShareUrl(item) {
  return "https://theatre4u.org/#/item/" + (item.display_id || item.id);
}

export function itemShareText(item, orgName) {
  const cat = CAT_FALLBACK[item.category] || { icon:"🎭" };
  const price = item.mkt==="For Loan" ? "Free loan"
    : item.rent>0&&item.sale>0 ? "$"+item.rent+"/wk or $"+item.sale+" to buy"
    : item.rent>0 ? "$"+item.rent+"/wk to rent"
    : item.sale>0 ? "$"+item.sale+" to buy" : "";
  return cat.icon+" "+item.name+(orgName?" — from "+orgName:"")+(price?" · "+price:"")+
    "\n\nAvailable on the Backstage Exchange — free resource sharing for theatre programs everywhere."+
    "\n\ntheatre4u.org #Theatre #TheatreEducation #BackstageExchange #TheatreTeacher";
}

// shared currency formatter
export const fmt$ = n  => "$" + Number(n || 0).toFixed(2);

const CAT_FALLBACK = {
  costumes:"🥻",props:"🎭",sets:"🏗️",lighting:"💡",sound:"🔊",
  scripts:"📜",makeup:"💄",furniture:"🪑",fabrics:"🧵",tools:"🔧",effects:"✨",other:"📦"
};
