// Built-in (theatre) inventory vocabulary: categories, conditions, sizes, availability, market — extracted from App.jsx.

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
