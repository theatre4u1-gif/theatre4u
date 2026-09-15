// Built-in (theatre) inventory vocabulary: categories, conditions, sizes, availability, market — extracted from App.jsx.
import { getCats, getVertical } from "../lib/verticals.js";

export const CAT_GFX = {
  costumes:  {grad:"linear-gradient(135deg,#7b1560,#c2185b,#e91e8c)",    icon:"👗"},
  props:     {grad:"linear-gradient(135deg,#4a148c,#7b1fa2,#9c27b0)",    icon:"🎭"},
  sets:      {grad:"linear-gradient(135deg,#0d2b6e,#1565c0,#1976d2)",    icon:"🏛️"},
  lighting:  {grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)",    icon:"💡"},
  sound:     {grad:"linear-gradient(135deg,#1b5e20,#2e7d32,#43a047)",    icon:"🔊"},
  scripts:   {grad:"linear-gradient(135deg,#bf360c,#d84315,#e64a19)",    icon:"📜"},
  makeup:    {grad:"linear-gradient(135deg,#880e4f,#ad1457,#e91e63)",    icon:"💄"},
  furniture: {grad:"linear-gradient(135deg,#3e2723,#5d4037,#795548)",    icon:"🪑"},
  fabrics:   {grad:"linear-gradient(135deg,#4a148c,#6a1b9a,#8e24aa)",    icon:"🧵"},
  tools:     {grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)",    icon:"🔧"},
  effects:   {grad:"linear-gradient(135deg,#006064,#00838f,#00acc1)",    icon:"✨"},
  other:     {grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)",    icon:"📦"},
};

export const CATS = [
  {id:"costumes", label:"Costumes",       icon:"👗",color:"#b5174f"},
  {id:"props",    label:"Props",           icon:"🎭",color:"#6a1b8a"},
  {id:"sets",     label:"Sets & Scenery",  icon:"🏛️",color:"#1554a0"},
  {id:"lighting", label:"Lighting",        icon:"💡",color:"#d35400"},
  {id:"sound",    label:"Sound",           icon:"🔊",color:"#27723a"},
  {id:"scripts",  label:"Scripts & Music", icon:"📜",color:"#b83208"},
  {id:"makeup",   label:"Makeup & Wigs",   icon:"💄",color:"#a0144e"},
  {id:"furniture",label:"Stage Furniture", icon:"🪑",color:"#5d3a1a"},
  {id:"fabrics",  label:"Fabrics & Drapes",icon:"🧵",color:"#5c1a8a"},
  {id:"tools",    label:"Tools",           icon:"🔧",color:"#374549"},
  {id:"effects",  label:"Special Effects", icon:"✨",color:"#00695c"},
  {id:"other",    label:"Other",           icon:"📦",color:"#4a2e1a"},
];

export const CAT   = Object.fromEntries(CATS.map(c=>[c.id,c]));

export const CAT_MAP = CAT; // alias used by PublicItemPage

export const CONDS = ["New","Excellent","Good","Fair","Poor","For Parts"];

export const SIZES = ["XS","S","M","L","XL","XXL","One Size","N/A"];

export const AVAIL = ["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"];

export const MKT   = ["Not Listed","For Rent","For Sale","Rent or Sale","For Loan"];

// ── Custom inventory categories (ADD-TO model) ──────────────────────────────
// Stateful per-org registry, loaded at runtime; SUPPLEMENTS the built-in
// vertical categories. setCustomCats() swaps the active list (called after the
// org's custom_categories rows load). customCatsFor()/getCatsMerged() read it.
let CUSTOM_CATS = [];
export function setCustomCats(rows){ CUSTOM_CATS = Array.isArray(rows) ? rows.map(r=>({id:r.id,vertical:r.vertical,label:r.label})) : []; }
export function customCatsFor(vertical){ return CUSTOM_CATS.filter(c=>c.vertical===(vertical||"theatre")).map(c=>({id:c.id,label:c.label,icon:"📦",color:"#4a2e1a",custom:true})); }

// ── Per-org label overrides (ADD-TO model, like CUSTOM_CATS) ────────────────
// Schools can rename a department (vertical) label/icon and rename built-in
// category names. setOrgLabels() is called after the org loads; the resolvers
// below apply overrides everywhere, falling back to the built-in defaults.
let ORG_VLABELS = {};   // { "<vertical>": { label, icon } }
let ORG_CATLABELS = {}; // { "<vertical>:<catId>": "New Name" }
export function setOrgLabels(vLabels, cLabels){
  ORG_VLABELS   = (vLabels && typeof vLabels === "object") ? vLabels : {};
  ORG_CATLABELS = (cLabels && typeof cLabels === "object") ? cLabels : {};
}
// Department (vertical) display name / icon, honoring the org's override.
export function vLabelOf(vertical){ const v = vertical||"theatre"; return (ORG_VLABELS[v] && ORG_VLABELS[v].label) || getVertical(v).label; }
export function vIconOf(vertical){  const v = vertical||"theatre"; return (ORG_VLABELS[v] && ORG_VLABELS[v].icon)  || getVertical(v).icon;  }
// Category display name for any id (custom label, built-in override, or default).
export function catLabelOf(vertical, catId){
  const v = vertical||"theatre";
  const custom = CUSTOM_CATS.find(c => c.id === catId && c.vertical === v);
  if (custom) return custom.label;
  const ov = ORG_CATLABELS[v + ":" + catId];
  if (ov) return ov;
  const bi = getCats(v).find(c => c.id === catId);
  return bi ? bi.label : (CAT[catId] ? CAT[catId].label : catId);
}
// Built-in categories with any per-org name overrides applied.
function applyCatOverrides(vertical, cats){
  const v = vertical||"theatre";
  return cats.map(c => { const ov = ORG_CATLABELS[v + ":" + c.id]; return ov ? { ...c, label: ov } : c; });
}
export function getCatsMerged(vertical){
  const v = vertical||"theatre";
  return [...applyCatOverrides(v, getCats(v)), ...customCatsFor(v)];
}
