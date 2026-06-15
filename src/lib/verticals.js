// verticals.js — ArtsTracker vertical configuration
// Place this file at: src/lib/verticals.js
//
// Each vertical defines the full category list, conditions, sizes,
// availability options, and market options for one type of arts program.
//
// The theatre vertical exactly mirrors the existing CATS / CONDS / CAT_GFX
// constants in App.jsx so Theatre4u behaviour is unchanged.

export const VERTICALS = {

  // ── THEATRE (matches existing Theatre4u CATS — do not change) ─────────────
  theatre: {
    id: "theatre",
    label: "Theatre",
    icon: "🎭",
    color: "#b5174f",
    appName: "Theatre4u™",
    exchangeName: "Backstage Exchange",
    terms: { productions:"Productions", production:"Production", addToProduction:"Add to Production", productionPhotos:"Production Photos", upcomingShow:"Upcoming Show", auditionNotice:"Audition Notice", showAnnouncement:"Show Announcement", crewRole:"Crew" },
    fundingCats: ["Equipment","Costumes","Sets & Scenery","Lighting & Sound","Props","Scripts & Royalties","Supplies","Travel","Personnel","Other"],
    categories: [
      { id:"costumes",  label:"Costumes",        icon:"👗", color:"#b5174f", grad:"linear-gradient(135deg,#7b1560,#c2185b,#e91e8c)" },
      { id:"props",     label:"Props",            icon:"🎭", color:"#6a1b8a", grad:"linear-gradient(135deg,#4a148c,#7b1fa2,#9c27b0)" },
      { id:"sets",      label:"Sets & Scenery",   icon:"🏛️", color:"#1554a0", grad:"linear-gradient(135deg,#0d2b6e,#1565c0,#1976d2)" },
      { id:"lighting",  label:"Lighting",         icon:"💡", color:"#d35400", grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)" },
      { id:"sound",     label:"Sound",            icon:"🔊", color:"#27723a", grad:"linear-gradient(135deg,#1b5e20,#2e7d32,#43a047)" },
      { id:"scripts",   label:"Scripts & Music",  icon:"📜", color:"#b83208", grad:"linear-gradient(135deg,#bf360c,#d84315,#e64a19)" },
      { id:"makeup",    label:"Makeup & Wigs",    icon:"💄", color:"#a0144e", grad:"linear-gradient(135deg,#880e4f,#ad1457,#e91e63)" },
      { id:"furniture", label:"Stage Furniture",  icon:"🪑", color:"#5d3a1a", grad:"linear-gradient(135deg,#3e2723,#5d4037,#795548)" },
      { id:"fabrics",   label:"Fabrics & Drapes", icon:"🧵", color:"#5c1a8a", grad:"linear-gradient(135deg,#4a148c,#6a1b9a,#8e24aa)" },
      { id:"tools",     label:"Tools",            icon:"🔧", color:"#374549", grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)" },
      { id:"effects",   label:"Special Effects",  icon:"✨", color:"#00695c", grad:"linear-gradient(135deg,#006064,#00838f,#00acc1)" },
      { id:"other",     label:"Other",            icon:"📦", color:"#4a2e1a", grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)" },
    ],
    conditions:    ["New","Excellent","Good","Fair","Poor","For Parts"],
    sizes:         ["XS","S","M","L","XL","XXL","One Size","N/A"],
    availability:  ["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"],
    marketOptions: ["Not Listed","For Rent","For Sale","Rent or Sale","For Loan"],
  },

  // ── MUSIC ─────────────────────────────────────────────────────────────────
  music: {
    id: "music",
    label: "Music",
    icon: "🎵",
    color: "#1554a0",
    appName: "ArtsTracker",
    exchangeName: "Instrument Exchange",
    terms: { productions:"Concerts", production:"Concert", addToProduction:"Add to Concert", productionPhotos:"Concert Photos", upcomingShow:"Upcoming Concert", auditionNotice:"Audition Notice", showAnnouncement:"Concert Announcement", crewRole:"Aide" },
    fundingCats: ["Instruments","Sheet Music","Equipment","Uniforms","Instruction","Travel","Personnel","Technology","Other"],
    categories: [
      { id:"strings",       label:"Strings",        icon:"🎻", color:"#6a1b8a", grad:"linear-gradient(135deg,#4a148c,#7b1fa2,#9c27b0)" },
      { id:"woodwinds",     label:"Woodwinds",       icon:"🎶", color:"#0d5e2a", grad:"linear-gradient(135deg,#1b5e20,#2e7d32,#43a047)" },
      { id:"brass",         label:"Brass",           icon:"🎺", color:"#b06800", grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)" },
      { id:"percussion",    label:"Percussion",      icon:"🥁", color:"#b83208", grad:"linear-gradient(135deg,#bf360c,#d84315,#e64a19)" },
      { id:"keyboard",      label:"Keyboard",        icon:"🎹", color:"#374549", grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)" },
      { id:"vocal",         label:"Vocal",           icon:"🎤", color:"#a0144e", grad:"linear-gradient(135deg,#880e4f,#ad1457,#e91e63)" },
      { id:"sheet_music",   label:"Sheet Music",     icon:"🎼", color:"#b83208", grad:"linear-gradient(135deg,#bf360c,#d84315,#e64a19)" },
      { id:"amplification", label:"Amplification",   icon:"🔊", color:"#27723a", grad:"linear-gradient(135deg,#1b5e20,#2e7d32,#43a047)" },
      { id:"other",         label:"Other",           icon:"📦", color:"#4a2e1a", grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)" },
    ],
    conditions:    ["New","Excellent","Good","Fair","Poor","Needs Repair"],
    sizes:         ["Full","3/4","1/2","1/4","N/A"],
    availability:  ["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"],
    marketOptions: ["Not Listed","For Rent","For Sale","Rent or Sale","For Loan"],
  },

  // ── DANCE ─────────────────────────────────────────────────────────────────
  dance: {
    id: "dance",
    label: "Dance",
    icon: "💃",
    color: "#c2185b",
    appName: "ArtsTracker",
    exchangeName: "Dance Exchange",
    terms: { productions:"Performances", production:"Performance", addToProduction:"Add to Performance", productionPhotos:"Performance Photos", upcomingShow:"Upcoming Performance", auditionNotice:"Audition Notice", showAnnouncement:"Performance Announcement", crewRole:"Aide" },
    fundingCats: ["Costumes","Footwear","Equipment","Sound & Music","Studio Supplies","Travel","Personnel","Other"],
    categories: [
      { id:"costumes", label:"Costumes",        icon:"👗", color:"#b5174f", grad:"linear-gradient(135deg,#7b1560,#c2185b,#e91e8c)" },
      { id:"footwear", label:"Footwear",         icon:"👠", color:"#a0144e", grad:"linear-gradient(135deg,#880e4f,#ad1457,#e91e63)" },
      { id:"props",    label:"Props",            icon:"🌂", color:"#6a1b8a", grad:"linear-gradient(135deg,#4a148c,#7b1fa2,#9c27b0)" },
      { id:"sound",    label:"Sound & Music",    icon:"🎵", color:"#27723a", grad:"linear-gradient(135deg,#1b5e20,#2e7d32,#43a047)" },
      { id:"lighting", label:"Lighting",         icon:"💡", color:"#d35400", grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)" },
      { id:"mirrors",  label:"Mirrors & Barres", icon:"🪞", color:"#374549", grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)" },
      { id:"other",    label:"Other",            icon:"📦", color:"#4a2e1a", grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)" },
    ],
    conditions:    ["New","Excellent","Good","Fair","Poor","For Parts"],
    sizes:         ["XS","S","M","L","XL","One Size","N/A"],
    availability:  ["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"],
    marketOptions: ["Not Listed","For Rent","For Sale","Rent or Sale","For Loan"],
  },

  // ── VISUAL ART ────────────────────────────────────────────────────────────
  art: {
    id: "art",
    label: "Visual Art",
    icon: "🎨",
    color: "#1554a0",
    appName: "ArtsTracker",
    exchangeName: "Materials Exchange",
    terms: { productions:"Exhibitions", production:"Exhibition", addToProduction:"Add to Exhibition", productionPhotos:"Exhibition Photos", upcomingShow:"Upcoming Exhibition", auditionNotice:"Call for Artists", showAnnouncement:"Exhibition Announcement", crewRole:"Aide" },
    fundingCats: ["Art Supplies","Equipment","Kiln & Tools","Framing & Display","Instruction","Travel","Personnel","Other"],
    categories: [
      { id:"painting",    label:"Painting Supplies", icon:"🖌️", color:"#b5174f", grad:"linear-gradient(135deg,#7b1560,#c2185b,#e91e8c)" },
      { id:"drawing",     label:"Drawing",           icon:"✏️", color:"#374549", grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)" },
      { id:"sculpture",   label:"Sculpture",         icon:"🗿", color:"#5d3a1a", grad:"linear-gradient(135deg,#3e2723,#5d4037,#795548)" },
      { id:"printmaking", label:"Printmaking",       icon:"🖨️", color:"#0d5e2a", grad:"linear-gradient(135deg,#1b5e20,#2e7d32,#43a047)" },
      { id:"ceramics",    label:"Ceramics",          icon:"🏺", color:"#b06800", grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)" },
      { id:"digital",     label:"Digital Media",     icon:"💻", color:"#1554a0", grad:"linear-gradient(135deg,#0d2b6e,#1565c0,#1976d2)" },
      { id:"textiles",    label:"Textiles",          icon:"🧵", color:"#5c1a8a", grad:"linear-gradient(135deg,#4a148c,#6a1b9a,#8e24aa)" },
      { id:"equipment",   label:"Equipment",         icon:"📷", color:"#00695c", grad:"linear-gradient(135deg,#006064,#00838f,#00acc1)" },
      { id:"other",       label:"Other",             icon:"📦", color:"#4a2e1a", grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)" },
    ],
    conditions:    ["New","Excellent","Good","Fair","Poor","Consumable"],
    sizes:         ["N/A"],
    availability:  ["In Stock","In Use","Checked Out","Being Repaired","Lost","Retired"],
    marketOptions: ["Not Listed","For Sale","For Loan"],
  },

  // ── BOOSTER / PTA ─────────────────────────────────────────────────────────
  booster: {
    id: "booster",
    label: "Booster / PTA",
    icon: "🏆",
    color: "#7b1fa2",
    appName: "ArtsTracker",
    exchangeName: "Resource Exchange",
    terms: { productions:"Events", production:"Event", addToProduction:"Add to Event", productionPhotos:"Event Photos", upcomingShow:"Upcoming Event", auditionNotice:"Volunteer Call", showAnnouncement:"Event Announcement", crewRole:"Volunteer" },
    fundingCats: ["Fundraising","Equipment","Uniforms","Event Supplies","Concessions","Travel","Awards","Other"],
    categories: [
      { id:"uniforms",      label:"Uniforms",              icon:"👕", color:"#1554a0", grad:"linear-gradient(135deg,#0d2b6e,#1565c0,#1976d2)" },
      { id:"equipment",     label:"Equipment",             icon:"🎒", color:"#374549", grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)" },
      { id:"fundraising",   label:"Fundraising Items",     icon:"🏛️", color:"#7b1fa2", grad:"linear-gradient(135deg,#4a148c,#7b1fa2,#9c27b0)" },
      { id:"spirit_gear",   label:"Spirit Gear",           icon:"📣", color:"#b83208", grad:"linear-gradient(135deg,#bf360c,#d84315,#e64a19)" },
      { id:"event_supplies",label:"Event Supplies",        icon:"🎪", color:"#c2185b", grad:"linear-gradient(135deg,#880e4f,#ad1457,#e91e63)" },
      { id:"canteen",       label:"Canteen / Concessions", icon:"🍕", color:"#d35400", grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)" },
      { id:"storage",       label:"Storage",               icon:"📦", color:"#4a2e1a", grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)" },
      { id:"office",        label:"Office Supplies",       icon:"📋", color:"#374549", grad:"linear-gradient(135deg,#263238,#37474f,#546e7a)" },
      { id:"awards",        label:"Awards & Recognition",  icon:"🏆", color:"#b06800", grad:"linear-gradient(135deg,#7f4800,#e65100,#ff9800)" },
      { id:"other",         label:"Other",                 icon:"📦", color:"#4a2e1a", grad:"linear-gradient(135deg,#37474f,#546e7a,#78909c)" },
    ],
    conditions:    ["New","Excellent","Good","Fair","Poor","For Parts"],
    sizes:         ["XS","S","M","L","XL","XXL","One Size","N/A","Custom"],
    availability:  ["In Stock","In Use","Checked Out","Distributed","Lost","Retired"],
    marketOptions: ["Not Listed","For Sale","For Pickup","For Loan"],
  },

};

// ── Helper functions ───────────────────────────────────────────────────────

// Get a vertical's full config object by its ID.
// Falls back to theatre if the ID is unknown — keeps Theatre4u safe.
export const getVertical = (verticalId) =>
  VERTICALS[verticalId] || VERTICALS.theatre;

// Get a single category object within a vertical.
// Falls back to 'other' if the category ID isn't found.
export const getCat = (verticalId, catId) => {
  const cats = getVertical(verticalId).categories;
  return cats.find(c => c.id === catId) || cats.find(c => c.id === "other");
};

// Flat list of all verticals — useful for dropdown menus and signup screens.
export const VERTICALS_LIST = Object.values(VERTICALS);

// Returns the categories array for a given vertical ID.
// This is the most common call site — e.g. to populate a category dropdown.
export const getCats = (verticalId) => getVertical(verticalId).categories;

// Returns a {grad, icon} object for a category, matching the CAT_GFX shape
// already used by CatCard and CatThumb in App.jsx.
// Pass vertical="theatre" (or omit) for full Theatre4u backwards-compatibility.
export const getExchangeName = (verticalId) => getVertical(verticalId).exchangeName || "Resource Exchange";

// Per-vertical UI terminology. Falls back to the theatre wording, then the raw key.
// e.g. getTerm("music","productions") === "Concerts"
export const getTerm = (verticalId, key) => {
  const t = getVertical(verticalId).terms || {};
  if (t[key] != null) return t[key];
  const th = VERTICALS.theatre.terms || {};
  return th[key] != null ? th[key] : key;
};

// Per-vertical funding categories (falls back to theatre's list).
export const getFundingCats = (verticalId) =>
  getVertical(verticalId).fundingCats || VERTICALS.theatre.fundingCats || [];

export const getCatGfx = (verticalId, catId) => {
  const cat = getCat(verticalId, catId);
  return { grad: cat.grad, icon: cat.icon };
};
