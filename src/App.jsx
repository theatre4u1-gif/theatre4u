import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const currency = (n) => "$" + Number(n || 0).toFixed(2);

// â”€â”€â”€ Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DB = {
  async load(key, fallback) {
    try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; } catch { return fallback; }
  },
  async save(key, data) {
    try { await window.storage.set(key, JSON.stringify(data)); } catch (e) { console.warn("Storage save failed", e); }
  },
};

// â”€â”€â”€ QR Code Generator (pure canvas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QR = (() => {
  function generatePattern(text) {
    const hash = [];
    for (let i = 0; i < 21 * 21; i++) {
      let h = 0;
      for (let j = 0; j < text.length; j++) {
        h = ((h << 5) - h + text.charCodeAt(j) + i * 7) | 0;
      }
      hash.push(Math.abs(h) % 3 === 0);
    }
    return hash;
  }

  function toDataURL(text, size = 200) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const grid = 21;
    const cell = size / (grid + 4);
    const offset = (size - cell * grid) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const pattern = generatePattern(text);
    ctx.fillStyle = "#1a1520";

    const drawFinder = (x, y) => {
      ctx.fillStyle = "#1a1520";
      ctx.fillRect(offset + x * cell, offset + y * cell, 7 * cell, 7 * cell);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(offset + (x + 1) * cell, offset + (y + 1) * cell, 5 * cell, 5 * cell);
      ctx.fillStyle = "#1a1520";
      ctx.fillRect(offset + (x + 2) * cell, offset + (y + 2) * cell, 3 * cell, 3 * cell);
    };
    drawFinder(0, 0);
    drawFinder(14, 0);
    drawFinder(0, 14);

    ctx.fillStyle = "#1a1520";
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        if ((i < 8 && j < 8) || (i < 8 && j >= 13) || (i >= 13 && j < 8)) continue;
        if (pattern[i * grid + j]) {
          ctx.fillRect(offset + j * cell, offset + i * cell, cell, cell);
        }
      }
    }

    ctx.fillStyle = "#d4a843";
    ctx.fillRect(offset + 9 * cell, offset + 9 * cell, 3 * cell, 3 * cell);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(offset + 9.5 * cell, offset + 9.5 * cell, 2 * cell, 2 * cell);
    ctx.fillStyle = "#d4a843";
    ctx.fillRect(offset + 10 * cell, offset + 10 * cell, cell, cell);

    return canvas.toDataURL();
  }

  return { toDataURL };
})();

// â”€â”€â”€ Image Compression â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function compressImage(file, maxWidth = 400, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORIES = [
  { id: "costumes", label: "Costumes", icon: "\u{1F457}", color: "#c2185b" },
  { id: "props", label: "Props", icon: "\u{1F3AD}", color: "#7b1fa2" },
  { id: "sets", label: "Sets & Scenery", icon: "\u{1F3D7}\uFE0F", color: "#1565c0" },
  { id: "lighting", label: "Lighting", icon: "\u{1F4A1}", color: "#f9a825" },
  { id: "sound", label: "Sound Equipment", icon: "\u{1F50A}", color: "#2e7d32" },
  { id: "scripts", label: "Scripts & Music", icon: "\u{1F4DC}", color: "#d84315" },
  { id: "makeup", label: "Makeup & Wigs", icon: "\u{1F484}", color: "#ad1457" },
  { id: "furniture", label: "Stage Furniture", icon: "\u{1FA91}", color: "#4e342e" },
  { id: "fabrics", label: "Fabrics & Drapes", icon: "\u{1F9F5}", color: "#6a1b9a" },
  { id: "tools", label: "Tools & Hardware", icon: "\u{1F527}", color: "#546e7a" },
  { id: "effects", label: "Special Effects", icon: "\u2728", color: "#00838f" },
  { id: "other", label: "Other", icon: "\u{1F4E6}", color: "#757575" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const CONDITIONS = ["New", "Excellent", "Good", "Fair", "Poor", "For Parts"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "One Size", "N/A"];
const AVAILABILITY = ["In Stock", "In Use", "Checked Out", "Being Repaired", "Lost", "Retired"];
const MARKET_STATUS = ["Not Listed", "For Rent", "For Sale", "Rent or Sale"];

function seedItems() {
  return [
    { name: "Victorian Ball Gown - Blue", category: "costumes", condition: "Good", size: "M", quantity: 1, location: "Costume Closet A", notes: "Used in A Christmas Carol 2024", marketStatus: "For Rent", rentalPrice: 25, salePrice: 0, availability: "In Stock", images: [], tags: ["period", "formal"] },
    { name: "Pirate Hat Collection (6pc)", category: "costumes", condition: "Fair", size: "One Size", quantity: 6, location: "Costume Closet B", notes: "Assorted styles", marketStatus: "Not Listed", rentalPrice: 0, salePrice: 0, availability: "In Stock", images: [], tags: ["adventure"] },
    { name: "Wireless Handheld Mic - Shure", category: "sound", condition: "Excellent", size: "N/A", quantity: 4, location: "Sound Booth", notes: "SM58 compatible, 4 channels", marketStatus: "For Rent", rentalPrice: 15, salePrice: 0, availability: "In Stock", images: [], tags: ["audio"] },
    { name: "LED Par Can RGBW 54x3W", category: "lighting", condition: "New", size: "N/A", quantity: 12, location: "Lighting Storage", notes: "DMX controllable", marketStatus: "Rent or Sale", rentalPrice: 10, salePrice: 85, availability: "In Stock", images: [], tags: ["dmx", "led"] },
    { name: "Wooden Throne Chair", category: "furniture", condition: "Good", size: "N/A", quantity: 1, location: "Scene Shop", notes: "Gold painted, red velvet", marketStatus: "For Rent", rentalPrice: 30, salePrice: 0, availability: "In Stock", images: [], tags: ["royalty"] },
    { name: "Fog Machine 1000W", category: "effects", condition: "Good", size: "N/A", quantity: 2, location: "Effects Cage", notes: "Includes remote", marketStatus: "For Rent", rentalPrice: 20, salePrice: 0, availability: "In Stock", images: [], tags: ["atmosphere"] },
    { name: "Romeo and Juliet Scripts (30)", category: "scripts", condition: "Fair", size: "N/A", quantity: 30, location: "Library", notes: "Director annotated", marketStatus: "For Sale", rentalPrice: 0, salePrice: 5, availability: "In Stock", images: [], tags: ["shakespeare"] },
    { name: "Black Velvet Main Drape 20x40", category: "fabrics", condition: "Excellent", size: "N/A", quantity: 1, location: "Fly Loft", notes: "Flame retardant", marketStatus: "Not Listed", rentalPrice: 0, salePrice: 0, availability: "In Use", images: [], tags: ["main stage"] },
    { name: "Ben Nye Master Makeup Kit", category: "makeup", condition: "Good", size: "N/A", quantity: 3, location: "Dressing Room 1", notes: "Full spectrum", marketStatus: "Not Listed", rentalPrice: 0, salePrice: 0, availability: "In Stock", images: [], tags: ["professional"] },
    { name: "Forest Backdrop Flat 8x12ft", category: "sets", condition: "Good", size: "N/A", quantity: 2, location: "Scene Shop", notes: "Painted muslin on frame", marketStatus: "For Rent", rentalPrice: 40, salePrice: 0, availability: "In Stock", images: [], tags: ["outdoor"] },
    { name: "DeWalt Cordless Drill 20V", category: "tools", condition: "Good", size: "N/A", quantity: 2, location: "Tool Cabinet", notes: "With charger and bits", marketStatus: "Not Listed", rentalPrice: 0, salePrice: 0, availability: "In Stock", images: [], tags: ["power tool"] },
    { name: "Foam Rubber Swords (8pc)", category: "props", condition: "Fair", size: "N/A", quantity: 8, location: "Props Table", notes: "Safe for stage combat", marketStatus: "For Sale", rentalPrice: 0, salePrice: 12, availability: "In Stock", images: [], tags: ["combat"] },
  ].map(i => ({ ...i, id: uid(), dateAdded: new Date().toISOString() }));
}

// â”€â”€â”€ Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const I = {
  search: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  plus: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  edit: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  x: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  menu: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  home: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  box: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  store: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>,
  settings: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  chart: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  filter: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  check: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  download: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  camera: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  qr: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><path d="M21 14h-3v3"/><path d="M21 21h-3v-3"/></svg>,
  print: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  tag: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  scan: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
};

// â”€â”€â”€ CSS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
:root{--bg:#0d0b11;--bg2:#15121b;--bg3:#1d1925;--bg3h:#252131;--bgi:#110f18;--bd:#282333;--bdl:#38324a;--t1:#ede8df;--t2:#9b93a8;--t3:#685f76;--gold:#d4a843;--goldd:#a37f2c;--red:#c2185b;--grn:#4caf50;--blu:#42a5f5;--sh:0 4px 24px rgba(0,0,0,.4);--r:10px;--rs:6px;--tr:.2s ease}
*{margin:0;padding:0;box-sizing:border-box}
html,body,#root{height:100%;background:var(--bg);color:var(--t1);font-family:'DM Sans',sans-serif;font-size:14px}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
.app{display:flex;height:100vh;overflow:hidden}
.side{width:228px;min-width:228px;background:var(--bg2);border-right:1px solid var(--bd);display:flex;flex-direction:column;z-index:100;transition:transform .3s,opacity .3s}
.side.mh{transform:translateX(-100%);opacity:0;position:absolute;height:100%}.side.ms{transform:translateX(0);opacity:1;position:absolute;height:100%}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.scroll{flex:1;overflow-y:auto;padding:22px 26px}
.logo{padding:20px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px}
.logo-i{width:38px;height:38px;background:linear-gradient(135deg,var(--gold),var(--goldd));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0}
.logo-t{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--gold)}.logo-s{font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-top:1px}
.nav{padding:12px 9px;flex:1;overflow-y:auto}
.nlbl{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--t3);padding:9px 11px 3px}
.ni{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:var(--rs);color:var(--t2);cursor:pointer;transition:all var(--tr);font-size:13px;font-weight:500;margin-bottom:1px;border:1px solid transparent}
.ni:hover{background:var(--bg3);color:var(--t1)}.ni.a{background:linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04));color:var(--gold);border-color:rgba(212,168,67,.2)}
.ni .c{margin-left:auto;background:var(--bg);padding:1px 6px;border-radius:9px;font-size:10px;color:var(--t3)}
.top{display:flex;align-items:center;gap:12px;padding:12px 26px;border-bottom:1px solid var(--bd);background:var(--bg2);flex-shrink:0}
.top h1{font-family:'Playfair Display',serif;font-size:20px;font-weight:700}
.mmb{display:none;background:none;border:none;color:var(--t2);cursor:pointer;padding:3px}
.srch{position:relative;display:flex;align-items:center}.srch svg{position:absolute;left:10px;color:var(--t3);pointer-events:none}
.srch input{background:var(--bgi);border:1px solid var(--bd);border-radius:var(--r);padding:7px 11px 7px 34px;color:var(--t1);font-size:13px;width:240px;outline:none;transition:border var(--tr);font-family:'DM Sans',sans-serif}
.srch input:focus{border-color:var(--gold)}.srch input::placeholder{color:var(--t3)}
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 15px;border-radius:var(--rs);font-size:13px;font-weight:600;cursor:pointer;transition:all var(--tr);border:1px solid transparent;font-family:'DM Sans',sans-serif;white-space:nowrap}
.bp{background:linear-gradient(135deg,var(--gold),var(--goldd));color:#1a1200;border:none}.bp:hover{filter:brightness(1.1);transform:translateY(-1px)}
.bs{background:var(--bg3);border-color:var(--bd);color:var(--t1)}.bs:hover{border-color:var(--bdl);background:var(--bg3h)}
.bd{background:rgba(194,24,91,.12);border-color:rgba(194,24,91,.25);color:var(--red)}.bd:hover{background:rgba(194,24,91,.22)}
.bsm{padding:5px 10px;font-size:12px}
.bi{padding:6px;background:none;border:1px solid var(--bd);color:var(--t2);border-radius:var(--rs);cursor:pointer;display:flex;align-items:center;transition:all var(--tr)}.bi:hover{border-color:var(--bdl);color:var(--t1)}
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:22px}
.cd{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r);padding:16px;transition:all var(--tr)}.cd:hover{border-color:var(--bdl);transform:translateY(-1px);box-shadow:var(--sh)}
.sc{text-align:center}.sc .si{font-size:24px;margin-bottom:5px}.sc .sv{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--gold)}.sc .sl{font-size:11px;color:var(--t3);margin-top:2px}
.ic{cursor:pointer;position:relative;overflow:hidden}
.ic-img{width:100%;height:130px;border-radius:var(--rs);overflow:hidden;margin-bottom:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--t3)}
.ic-img img{width:100%;height:100%;object-fit:cover}
.ich{display:flex;align-items:flex-start;gap:9px;margin-bottom:8px}
.icc{width:34px;height:34px;border-radius:var(--rs);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.ict{font-weight:600;font-size:13.5px;line-height:1.3}.ics{font-size:11px;color:var(--t3);margin-top:1px}
.icm{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.mt{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;background:var(--bg);border-radius:3px;font-size:10px;color:var(--t2);white-space:nowrap}
.icf{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:9px;border-top:1px solid var(--bd)}
.mb{padding:2px 8px;border-radius:14px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.mb.r{background:rgba(66,165,245,.14);color:var(--blu)}.mb.s{background:rgba(76,175,80,.14);color:var(--grn)}.mb.b{background:rgba(212,168,67,.14);color:var(--gold)}.mb.n{background:rgba(107,100,120,.08);color:var(--t3)}
.pr{font-weight:600;font-size:13px;color:var(--gold)}
.mov{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:1000;display:flex;align-items:center;justify-content:center;padding:14px;animation:fi .15s ease}
.modal{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;width:100%;max-width:640px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 8px 48px rgba(0,0,0,.5);animation:su .2s ease}
.mh{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bd)}.mh h2{font-family:'Playfair Display',serif;font-size:18px}
.mb2{padding:20px;overflow-y:auto;flex:1}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fg{display:flex;flex-direction:column;gap:4px}.fg.fu{grid-column:1/-1}
.fl{font-size:10.5px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:1px}
.fi,.fs,.ft{background:var(--bgi);border:1px solid var(--bd);border-radius:var(--rs);padding:8px 10px;color:var(--t1);font-size:13px;font-family:'DM Sans',sans-serif;outline:none;transition:border var(--tr)}
.fi:focus,.fs:focus,.ft:focus{border-color:var(--gold)}.ft{resize:vertical;min-height:60px}.fs{cursor:pointer}.fs option{background:var(--bg2)}
.pa{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}
.pt{width:72px;height:72px;border-radius:var(--rs);overflow:hidden;position:relative;border:1px solid var(--bd);flex-shrink:0}
.pt img{width:100%;height:100%;object-fit:cover}
.pt .pr2{position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,.7);border:none;color:#fff;border-radius:50%;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
.pt:hover .pr2{opacity:1}
.pad{width:72px;height:72px;border:2px dashed var(--bd);border-radius:var(--rs);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--t3);transition:all var(--tr);gap:1px;font-size:9px}
.pad:hover{border-color:var(--gold);color:var(--gold)}
.qrc{display:flex;align-items:center;gap:16px;padding:14px;background:var(--bg);border-radius:var(--r);border:1px solid var(--bd)}
.qrc img{border-radius:var(--rs);flex-shrink:0}
.dsec{margin-bottom:20px}.dsec h3{font-family:'Playfair Display',serif;font-size:14px;margin-bottom:9px;padding-bottom:6px;border-bottom:1px solid var(--bd)}
.dr{display:flex;padding:6px 0}.drl{width:140px;color:var(--t3);font-size:12px;flex-shrink:0}.drv{font-size:13px}
.pg{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.pg img{width:90px;height:90px;border-radius:var(--rs);object-fit:cover;border:1px solid var(--bd);cursor:pointer}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:2000;display:flex;align-items:center;justify-content:center;cursor:pointer}
.lb img{max-width:90vw;max-height:90vh;border-radius:var(--r)}
.tw{overflow-x:auto;border:1px solid var(--bd);border-radius:var(--r)}
table{width:100%;border-collapse:collapse}
th{background:var(--bg3);padding:9px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--t3);text-align:left;font-weight:600;white-space:nowrap;position:sticky;top:0}
td{padding:9px 12px;border-top:1px solid var(--bd);font-size:13px;vertical-align:middle}
tr:hover td{background:rgba(255,255,255,.015)}
.vt{display:flex;border:1px solid var(--bd);border-radius:var(--rs);overflow:hidden}
.vt button{background:none;border:none;color:var(--t3);padding:5px 12px;cursor:pointer;font-size:12px;transition:all var(--tr);font-family:'DM Sans',sans-serif;font-weight:500}
.vt button.a{background:var(--gold);color:#1a1200}.vt button:not(.a):hover{background:var(--bg3);color:var(--t1)}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:16px}
.tab{background:none;border:none;padding:8px 14px;font-size:13px;font-weight:500;color:var(--t3);cursor:pointer;border-bottom:2px solid transparent;transition:all var(--tr);font-family:'DM Sans',sans-serif}
.tab.a{color:var(--gold);border-bottom-color:var(--gold)}.tab:hover:not(.a){color:var(--t2)}
.cb{display:flex;align-items:center;gap:9px;padding:7px 0}.cbi{font-size:17px;width:26px;text-align:center}.cbl{font-size:12.5px;width:120px;color:var(--t2)}
.cbt{flex:1;height:6px;background:var(--bg);border-radius:3px;overflow:hidden}.cbf{height:100%;border-radius:3px;transition:width .5s ease}.cbc{font-size:12.5px;font-weight:600;width:32px;text-align:right}
.fp{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r);padding:12px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:9px;align-items:flex-end}
.fp label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px}
.fp select,.fp input{background:var(--bgi);border:1px solid var(--bd);border-radius:var(--rs);padding:5px 8px;color:var(--t1);font-size:12px;outline:none;font-family:'DM Sans',sans-serif}
.pgn{display:flex;align-items:center;justify-content:center;gap:5px;padding:16px 0}
.pgn button{background:var(--bg3);border:1px solid var(--bd);color:var(--t2);padding:4px 11px;border-radius:var(--rs);cursor:pointer;font-size:12px;transition:all var(--tr);font-family:'DM Sans',sans-serif}
.pgn button:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}.pgn button:disabled{opacity:.3;cursor:not-allowed}.pgn button.a{background:var(--gold);color:#1a1200;border-color:var(--gold)}
.emp{text-align:center;padding:44px 18px}.emp .ei{font-size:40px;margin-bottom:12px;opacity:.5}.emp h3{font-family:'Playfair Display',serif;font-size:17px;margin-bottom:5px}.emp p{color:var(--t3);font-size:12.5px;margin-bottom:14px}
.sov{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
@keyframes fi{from{opacity:0}to{opacity:1}}@keyframes su{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.fin{animation:fi .3s ease}
@media(max-width:900px){.side{position:absolute;height:100%}.mmb{display:flex}.srch input{width:160px}.fg2{grid-template-columns:1fr}.sg{grid-template-columns:repeat(2,1fr)}.scroll{padding:12px}.top{padding:10px 14px}}
@media(max-width:600px){.sg{grid-template-columns:1fr}.cg{grid-template-columns:1fr}.srch input{width:120px}}

/* ─── LANDING PAGE ────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&display=swap');
.lp{min-height:100vh;background:var(--bg);color:var(--t1);overflow-x:hidden}
.lp-grain{position:fixed;inset:0;pointer-events:none;z-index:1;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)'/%3E%3C/svg%3E")}
.lpn{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:20px 52px;transition:background .4s,border .4s}
.lpn.lpns{background:rgba(13,11,17,.94);border-bottom:1px solid rgba(212,168,67,.1);backdrop-filter:blur(14px)}
.lpnl{display:flex;align-items:center;gap:10px;cursor:pointer}
.lpni{width:34px;height:34px;background:linear-gradient(135deg,var(--gold),var(--goldd));border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:17px}
.lpnt{font-family:'Playfair Display',serif;font-size:19px;font-weight:700;color:var(--gold)}
.lpnr{display:flex;align-items:center;gap:10px}
.lph{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:130px 24px 90px;position:relative;overflow:hidden}
.lph::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(212,168,67,.07) 0%,transparent 70%)}
.lph-curtl,.lph-curtr{position:absolute;top:0;bottom:0;width:clamp(40px,8vw,140px);pointer-events:none}
.lph-curtl{left:0;background:linear-gradient(to right,rgba(100,20,20,.28),transparent)}
.lph-curtr{right:0;background:linear-gradient(to left,rgba(100,20,20,.28),transparent)}
.lph-line{position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(to right,transparent 0%,rgba(212,168,67,.3) 40%,rgba(212,168,67,.3) 60%,transparent 100%)}
.lph-ew{font-size:10px;font-weight:600;letter-spacing:5px;text-transform:uppercase;color:var(--gold);margin-bottom:28px;display:flex;align-items:center;gap:14px;opacity:0;animation:lp-rise .9s ease .1s forwards}
.lph-ew::before,.lph-ew::after{content:'';flex:1;max-width:48px;height:1px;background:rgba(212,168,67,.4)}
.lph-h{font-family:'Cormorant Garamond',serif;font-size:clamp(54px,9vw,118px);font-weight:300;line-height:.9;letter-spacing:-.01em;margin-bottom:0;opacity:0;animation:lp-rise .9s ease .25s forwards}
.lph-h em{font-style:italic;color:var(--gold)}
.lph-h b{display:block;font-weight:700;color:var(--gold);font-size:clamp(46px,7.5vw,100px)}
.lph-sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(18px,2.4vw,26px);color:var(--t1);opacity:.8;max-width:520px;line-height:1.5;margin:32px auto 48px;opacity:0;animation:lp-rise .9s ease .4s forwards}
.lph-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;opacity:0;animation:lp-rise .9s ease .55s forwards}
.lp-btnp{display:inline-flex;align-items:center;gap:8px;padding:14px 34px;background:linear-gradient(135deg,var(--gold),var(--goldd));color:#1a0f00;border:none;border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:700;cursor:pointer;letter-spacing:.02em;transition:all .25s;box-shadow:0 0 36px rgba(212,168,67,.18)}
.lp-btnp:hover{transform:translateY(-2px);box-shadow:0 6px 44px rgba(212,168,67,.32);filter:brightness(1.08)}
.lp-btns2{display:inline-flex;align-items:center;gap:8px;padding:14px 30px;background:transparent;color:var(--t1);border:1px solid rgba(212,168,67,.22);border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:14.5px;font-weight:500;cursor:pointer;transition:all .25s}
.lp-btns2:hover{border-color:rgba(212,168,67,.5);background:rgba(212,168,67,.05)}
.lph-stats{display:flex;gap:52px;margin-top:80px;opacity:0;animation:lp-rise .9s ease .7s forwards;flex-wrap:wrap;justify-content:center}
.lph-sn{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:600;color:var(--gold);line-height:1}
.lph-sl{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--t3);margin-top:5px}
.lps{padding:100px 24px;max-width:1120px;margin:0 auto}
.lps-lbl{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--goldd);font-weight:600;margin-bottom:14px}
.lps-title{font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4.5vw,56px);font-weight:300;line-height:1.1;margin-bottom:20px}
.lps-title em{font-style:italic;color:var(--gold)}
.lps-sub{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:20px;color:var(--t2);max-width:560px;line-height:1.55}
.lp-divider{border:none;height:1px;background:linear-gradient(to right,transparent,var(--bd),transparent);margin:0}
.lpf-row{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;margin-bottom:96px}
.lpf-row.rev{direction:rtl}.lpf-row.rev>*{direction:ltr}
.lpf-vis{border-radius:14px;overflow:hidden;background:var(--bg2);border:1px solid var(--bd);aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;position:relative}
.lpf-vis::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(212,168,67,.04),transparent 55%)}
.lpf-demo{padding:20px;width:100%;font-size:12px}
.lpf-n{font-family:'Cormorant Garamond',serif;font-size:80px;font-weight:700;color:rgba(212,168,67,.06);line-height:1;margin-bottom:-10px}
.lpf-title{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,3.5vw,42px);font-weight:300;line-height:1.1;margin-bottom:14px}
.lpf-title em{font-style:italic;color:var(--gold)}
.lpf-body{font-size:14px;color:var(--t2);line-height:1.75;margin-bottom:22px}
.lpf-ul{list-style:none;display:flex;flex-direction:column;gap:9px}
.lpf-ul li{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--t2);line-height:1.5}
.lpf-ul li::before{content:'\u25C6';color:var(--goldd);font-size:7px;margin-top:6px;flex-shrink:0}
.lp-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:48px}
.lp-cat{background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r);padding:18px 14px;text-align:center;cursor:pointer;transition:all .25s}
.lp-cat:hover{border-color:rgba(212,168,67,.3);background:rgba(212,168,67,.04);transform:translateY(-3px)}
.lp-cat-ico{font-size:26px;margin-bottom:8px}
.lp-cat-lbl{font-size:12px;font-weight:500;color:var(--t2)}
.lp-tg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:48px}
.lp-tc{background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:28px;position:relative}
.lp-tq{font-family:'Cormorant Garamond',serif;font-size:64px;color:rgba(212,168,67,.12);position:absolute;top:12px;left:18px;line-height:1;font-style:italic}
.lp-tt{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:var(--t1);line-height:1.6;margin-bottom:20px;position:relative;z-index:1;padding-top:22px}
.lp-tn{font-size:12.5px;font-weight:600;color:var(--gold)}
.lp-tr{font-size:11.5px;color:var(--t3);margin-top:2px}
.lp-pg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:52px}
.lp-pc{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:36px 28px;text-align:center;transition:all .3s}
.lp-pc:hover{transform:translateY(-4px)}
.lp-pc.feat{background:linear-gradient(145deg,#1c1108,var(--bg2));border-color:rgba(212,168,67,.45)}
.lp-pp{font-size:10px;text-transform:uppercase;letter-spacing:2.5px;color:var(--gold);font-weight:600;margin-bottom:14px}
.lp-pa{font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:600;color:var(--t1);line-height:1}
.lp-pper{font-size:13px;color:var(--t3);margin-bottom:28px}
.lp-pul{list-style:none;text-align:left;display:flex;flex-direction:column;gap:9px;margin-bottom:32px}
.lp-pul li{font-size:13px;color:var(--t2);display:flex;gap:9px;align-items:flex-start}
.lp-pul li::before{content:'\u2713';color:var(--gold);font-weight:700;flex-shrink:0}
.lp-cta{background:var(--bg2);border-top:1px solid rgba(212,168,67,.08);text-align:center;padding:120px 24px;position:relative;overflow:hidden}
.lp-cta::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:800px;background:radial-gradient(ellipse,rgba(212,168,67,.06),transparent 70%);pointer-events:none}
.lp-ft{background:var(--bg);border-top:1px solid var(--bd);padding:44px 52px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
.lp-fc{font-size:12px;color:var(--t3)}
.lp-fl{display:flex;gap:22px}
.lp-fl button{background:none;border:none;color:var(--t3);font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color .2s}
.lp-fl button:hover{color:var(--gold)}
.lp-ct{position:fixed;inset:0;z-index:9000;display:flex;pointer-events:none}
.lp-ctl,.lp-ctr{flex:1;background:var(--bg2);transition:transform .7s cubic-bezier(.77,0,.18,1)}
.lp-ctl{border-right:1px solid rgba(212,168,67,.35)}
.lp-ctr{border-left:1px solid rgba(212,168,67,.35)}
.lp-ct.open .lp-ctl{transform:translateX(-100%)}
.lp-ct.open .lp-ctr{transform:translateX(100%)}
.back-lp{display:flex;align-items:center;gap:7px;padding:7px 11px;margin:8px 9px 0;border-radius:var(--rs);color:var(--t3);cursor:pointer;font-size:12px;font-weight:500;border:1px solid transparent;transition:all var(--tr)}
.back-lp:hover{background:var(--bg3);color:var(--t2);border-color:var(--bd)}
@keyframes lp-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:900px){.lpn{padding:16px 20px}.lpf-row{grid-template-columns:1fr;gap:32px}.lpf-row.rev{direction:ltr}.lp-tg{grid-template-columns:1fr}.lp-pg{grid-template-columns:1fr}.lph-curtl,.lph-curtr{width:40px}.lp-ft{padding:32px 20px 20px}}
@media(max-width:600px){.lp-cats{grid-template-columns:repeat(3,1fr)}.lph-btns{flex-direction:column;align-items:stretch}.lph-btns button{justify-content:center}}
`;

// ─── Landing Page ────────────────────────────────────────────────────────────
function LandingPage({onLaunch}){
  const[scrolled,setScrolled]=useState(false);
  const[curtain,setCurtain]=useState("closed");

  useEffect(()=>{
    requestAnimationFrame(()=>{
      setCurtain("open");
      setTimeout(()=>setCurtain("hidden"),800);
    });
    const h=()=>setScrolled(window.scrollY>40);
    window.addEventListener("scroll",h,{passive:true});
    return()=>window.removeEventListener("scroll",h);
  },[]);

  const launch=()=>{
    setCurtain("closed");
    setTimeout(()=>{ window.scrollTo(0,0); onLaunch(); },700);
  };

  const FEATS=[
    {n:"01",title:<>Track <em>every</em> item</>,body:"Costumes, props, lighting rigs, audio gear, scripts — every item catalogued with photos, condition notes, storage locations, and tags.",bullets:["Up to 5 photos per item","Custom tags and notes","QR code label per item","Exact storage location tracking"],demo:(
      <div className="lpf-demo">
        {[{ico:"\u{1F457}",name:"Victorian Ball Gown",loc:"Closet A",cond:"Good",c:"rgba(76,175,80,.12)",t:"#4caf50"},{ico:"\u{1F399}\uFE0F",name:"Shure SM58 Wireless",loc:"Sound Booth",cond:"Excellent",c:"rgba(66,165,245,.12)",t:"#42a5f5"},{ico:"\u{1F4A1}",name:"LED Par Can RGBW",loc:"Lighting Store",cond:"New",c:"rgba(76,175,80,.12)",t:"#4caf50"}].map(r=>(
          <div key={r.name} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--bg)",borderRadius:6,marginBottom:7,border:"1px solid var(--bd)"}}>
            <span style={{fontSize:20}}>{r.ico}</span>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div><div style={{fontSize:10,color:"var(--t3)"}}>{r.loc}</div></div>
            <span style={{fontSize:10,padding:"2px 7px",background:r.c,color:r.t,borderRadius:10,flexShrink:0}}>{r.cond}</span>
          </div>
        ))}
      </div>
    )},
    {n:"02",title:<><em>QR labels</em> for everything</>,body:"Every item gets a unique QR code. Print it, stick it on the bin. Scan it with any phone to pull up full details instantly — no app required.",bullets:["One-click print from any browser","Scan with any smartphone","Instant item lookup by ID","Print all labels in bulk from Reports"],demo:(
      <div className="lpf-demo" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{background:"#fff",padding:14,borderRadius:10}}>
          <canvas ref={el=>{if(!el)return;const ctx=el.getContext("2d");const s=96;el.width=s;el.height=s;ctx.fillStyle="#fff";ctx.fillRect(0,0,s,s);const c=s/25;const draw=(x,y,w,h,fill)=>{ctx.fillStyle=fill;ctx.fillRect(x*c,y*c,w*c,h*c)};draw(0,0,7,7,"#1a1520");draw(1,1,5,5,"#fff");draw(2,2,3,3,"#1a1520");draw(18,0,7,7,"#1a1520");draw(19,1,5,5,"#fff");draw(20,2,3,3,"#1a1520");draw(0,18,7,7,"#1a1520");draw(1,19,5,5,"#fff");draw(2,20,3,3,"#1a1520");for(let i=0;i<25;i++)for(let j=0;j<25;j++){if((i<8&&j<8)||(i<8&&j>=18)||(i>=18&&j<8))continue;if(((i*13+j*7+i+j)%4===0))draw(j,i,1,1,"#1a1520");}draw(11,11,3,3,"#d4a843");}} width={96} height={96} style={{display:"block"}}/>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:600}}>Victorian Ball Gown</div>
          <div style={{fontSize:10,color:"var(--t3)",fontFamily:"monospace"}}>T4U \u00B7 Costume Closet A</div>
        </div>
      </div>
    )},
    {n:"03",title:<>The theatre <em>marketplace</em></>,body:"List your items for rent or sale. Other programs can browse and contact you. Turn idle inventory into income — or find what you need for your next production.",bullets:["Set rental price per week","Or list for outright sale","Filter by category and type","Connect with nearby programs"],demo:(
      <div className="lpf-demo">
        {[{ico:"\u{1FA91}",name:"Wooden Throne Chair",badge:"For Rent",price:"$30/wk",bc:"rgba(66,165,245,.14)",tc:"var(--blu)"},{ico:"\u{1F32B}\uFE0F",name:"Fog Machine 1000W",badge:"For Rent",price:"$20/wk",bc:"rgba(66,165,245,.14)",tc:"var(--blu)"},{ico:"\u{1F4DC}",name:"Romeo & Juliet Scripts (30)",badge:"For Sale",price:"$5 ea",bc:"rgba(76,175,80,.14)",tc:"var(--grn)"}].map(r=>(
          <div key={r.name} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--bg)",borderRadius:6,marginBottom:7,border:"1px solid var(--bd)"}}>
            <span style={{fontSize:20}}>{r.ico}</span>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div><span style={{fontSize:10,padding:"1px 6px",background:r.bc,color:r.tc,borderRadius:8}}>{r.badge}</span></div>
            <span style={{fontSize:12,fontWeight:700,color:"var(--gold)",flexShrink:0}}>{r.price}</span>
          </div>
        ))}
      </div>
    )},
  ];

  const TESTI=[
    {text:"We used to track everything in a spreadsheet nobody updated. Now the whole team can see what we have in real time. The QR labels alone changed how we store everything.",name:"Sarah M.",role:"Drama Director, Lincoln High School"},
    {text:"Rented out our fog machines and wireless mics to three other schools last semester. Covered our subscription for the year. The marketplace actually works.",name:"James T.",role:"Technical Director, Riverside Community Theatre"},
    {text:"Finally know what we actually own. Scanned an old bin backstage and found $800 worth of equipment we had forgotten about. Worth every penny.",name:"Patricia K.",role:"Performing Arts Coordinator, District 47"},
  ];

  const PLANS=[
    {plan:"Starter",price:"Free",period:"forever",feats:["Up to 50 items","QR code labels","Photo uploads","CSV export"],feat:false},
    {plan:"Pro",price:"$12",period:"/month",feats:["Unlimited inventory","Marketplace listings","Priority support","Advanced reports","Everything in Starter"],feat:true},
    {plan:"District",price:"$49",period:"/month",feats:["Multiple organisations","District dashboard","Bulk import","Dedicated support","Everything in Pro"],feat:false},
  ];

  return(
    <div className="lp">
      <div className="lp-grain"/>
      {curtain!=="hidden"&&(
        <div className={"lp-ct"+(curtain==="open"?" open":"")}>
          <div className="lp-ctl"/><div className="lp-ctr"/>
        </div>
      )}

      {/* Nav */}
      <nav className={"lpn"+(scrolled?" lpns":"")}>
        <div className="lpnl"><div className="lpni">{"\u{1F3AD}"}</div><div className="lpnt">Theatre4u</div></div>
        <div className="lpnr">
          <button className="lp-btns2" style={{padding:"8px 20px",fontSize:13}} onClick={launch}>Sign In</button>
          <button className="lp-btnp" style={{padding:"8px 22px",fontSize:13}} onClick={launch}>{"\u{1F3AD}"} Get Started Free</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="lph">
        <div className="lph-curtl"/><div className="lph-curtr"/><div className="lph-line"/>
        <div className="lph-ew">Theatre Inventory Management</div>
        <h1 className="lph-h">The Inventory <em>&amp;</em><br/><b>Marketplace</b><br/><span style={{fontSize:"clamp(38px,6vw,80px)",fontStyle:"normal",color:"var(--t1)",fontWeight:300}}>for Theatre Programs</span></h1>
        <p className="lph-sub">Track every costume, prop, and piece of equipment your program owns. List items for rent or sale. Generate QR labels for every storage bin. All in one place.</p>
        <div className="lph-btns">
          <button className="lp-btnp" onClick={launch}><span>{"\u{1F3AD}"}</span> Start for Free</button>
          <button className="lp-btns2" onClick={()=>document.getElementById("lp-features").scrollIntoView({behavior:"smooth"})}>See How It Works</button>
        </div>
        <div className="lph-stats">
          {[["12","Item categories"],["5","Photos per item"],["\u221E","Inventory entries"],["1-click","QR printing"]].map(([n,l])=>(
            <div key={l} style={{textAlign:"center"}}><div className="lph-sn">{n}</div><div className="lph-sl">{l}</div></div>
          ))}
        </div>
      </section>

      <hr className="lp-divider"/>

      {/* Features */}
      <section id="lp-features" style={{background:"var(--bg2)",borderBottom:"1px solid var(--bd)"}}>
        <div className="lps" style={{paddingBottom:20}}>
          <div className="lps-lbl">How It Works</div>
          <h2 className="lps-title">Everything your program needs,<br/><em>nothing it doesn&apos;t</em></h2>
          <p className="lps-sub">Built by people who know what it&apos;s like backstage &mdash; not enterprise software adapted for theatre.</p>
        </div>
        <div className="lps" style={{paddingTop:60}}>
          {FEATS.map((f,i)=>(
            <div key={f.n} className={"lpf-row"+(i%2===1?" rev":"")}>
              <div className="lpf-vis">{f.demo}</div>
              <div>
                <div className="lpf-n">{f.n}</div>
                <h3 className="lpf-title">{f.title}</h3>
                <p className="lpf-body">{f.body}</p>
                <ul className="lpf-ul">{f.bullets.map(b=><li key={b}>{b}</li>)}</ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="lp-divider"/>

      {/* Categories */}
      <section style={{background:"var(--bg)"}}>
        <div className="lps">
          <div className="lps-lbl">12 Categories</div>
          <h2 className="lps-title">Every corner of your <em>theatre</em></h2>
          <p className="lps-sub">From leading costume to the tools in the scene shop &mdash; every type of item has a home.</p>
          <div className="lp-cats">
            {CATEGORIES.map(c=>(
              <div key={c.id} className="lp-cat" onClick={launch}>
                <div className="lp-cat-ico">{c.icon}</div>
                <div className="lp-cat-lbl">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="lp-divider"/>

      {/* Testimonials */}
      <section style={{background:"var(--bg2)",borderTop:"1px solid var(--bd)",borderBottom:"1px solid var(--bd)"}}>
        <div className="lps">
          <div className="lps-lbl">What Directors Say</div>
          <h2 className="lps-title">Trusted by theatre programs <em>everywhere</em></h2>
          <div className="lp-tg">
            {TESTI.map(t=>(
              <div key={t.name} className="lp-tc">
                <div className="lp-tq">&ldquo;</div>
                <div className="lp-tt">{t.text}</div>
                <div className="lp-tn">{t.name}</div>
                <div className="lp-tr">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="lp-divider"/>

      {/* Pricing */}
      <section style={{background:"var(--bg)"}}>
        <div className="lps">
          <div className="lps-lbl">Simple Pricing</div>
          <h2 className="lps-title">Start free. <em>Grow</em> when you&apos;re ready.</h2>
          <p className="lps-sub">No credit card required. No surprise fees. Cancel any time.</p>
          <div className="lp-pg">
            {PLANS.map(p=>(
              <div key={p.plan} className={"lp-pc"+(p.feat?" feat":"")}>
                {p.feat&&<div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--gold)",marginBottom:10}}>Most Popular</div>}
                <div className="lp-pp">{p.plan}</div>
                <div className="lp-pa">{p.price}</div>
                <div className="lp-pper">{p.period}</div>
                <ul className="lp-pul">{p.feats.map(f=><li key={f}>{f}</li>)}</ul>
                <button className={p.feat?"lp-btnp":"lp-btns2"} style={{width:"100%",justifyContent:"center",padding:"12px 0"}} onClick={launch}>Get Started</button>
              </div>
            ))}
          </div>
          <p style={{textAlign:"center",marginTop:24,fontSize:12.5,color:"var(--t3)"}}>All plans include a 14-day free trial. No credit card required to start.</p>
        </div>
      </section>

      {/* CTA */}
      <div className="lp-cta">
        <div style={{position:"relative",zIndex:1}}>
          <div className="lps-lbl" style={{marginBottom:16}}>Ready?</div>
          <h2 className="lps-title" style={{marginBottom:20}}>Your programme deserves<br/><em>better than a spreadsheet.</em></h2>
          <p style={{color:"var(--t2)",fontSize:16,marginBottom:44,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",maxWidth:480,margin:"0 auto 44px"}}>Join drama directors and technical coordinators who finally know what they own.</p>
          <button className="lp-btnp" style={{fontSize:16,padding:"16px 44px"}} onClick={launch}><span>{"\u{1F3AD}"}</span> Open Theatre4u &mdash; It&apos;s Free</button>
        </div>
      </div>

      {/* Footer */}
      <footer className="lp-ft">
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <div className="lpni" style={{width:28,height:28,fontSize:14}}>{"\u{1F3AD}"}</div>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"var(--gold)"}}>Theatre4u</span>
          </div>
          <div className="lp-fc">Inventory &amp; Marketplace for Theatre Programs</div>
        </div>
        <div className="lp-fl">
          <button onClick={launch}>Open App</button>
          <button onClick={()=>{}}>hello@theatre4u.org</button>
        </div>
        <div className="lp-fc">&copy; {new Date().getFullYear()} Theatre4u. Built for the arts community.</div>
      </footer>
    </div>
  );
}

// â”€â”€â”€ Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Modal({title, onClose, children}){
  useEffect(()=>{const h=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[onClose]);
  return(<div className="mov" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal" onClick={e=>e.stopPropagation()}><div className="mh"><h2>{title}</h2><button className="bi" onClick={onClose}>{I.x()}</button></div><div className="mb2">{children}</div></div></div>);
}

function Lightbox({src,onClose}){if(!src)return null;return<div className="lb" onClick={onClose}><img src={src} alt="Full"/></div>}

// â”€â”€â”€ Item Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ItemForm({item, onSave, onCancel}){
  const[f,setF]=useState(item||{name:"",category:"costumes",condition:"Good",size:"N/A",quantity:1,location:"",notes:"",marketStatus:"Not Listed",rentalPrice:0,salePrice:0,availability:"In Stock",images:[],tags:[]});
  const[ti,setTi]=useState("");
  const fr=useRef();
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const v=f.name.trim();

  const addPhoto=async(e)=>{
    const files=Array.from(e.target.files||[]);
    const nw=[];
    for(const file of files.slice(0,5-(f.images||[]).length)){nw.push(await compressImage(file,600,.75))}
    s("images",[...(f.images||[]),...nw]);
    if(fr.current)fr.current.value="";
  };

  const addTag=()=>{const t=ti.trim().toLowerCase();if(t&&!(f.tags||[]).includes(t))s("tags",[...(f.tags||[]),t]);setTi("")};

  return(<>
    <div className="fg2">
      <div className="fg fu"><label className="fl">Item Name *</label><input className="fi" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. Victorian Ball Gown" autoFocus/></div>
      <div className="fg"><label className="fl">Category</label><select className="fs" value={f.category} onChange={e=>s("category",e.target.value)}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
      <div className="fg"><label className="fl">Condition</label><select className="fs" value={f.condition} onChange={e=>s("condition",e.target.value)}>{CONDITIONS.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"><label className="fl">Size</label><select className="fs" value={f.size} onChange={e=>s("size",e.target.value)}>{SIZES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="0" value={f.quantity} onChange={e=>s("quantity",parseInt(e.target.value)||0)}/></div>
      <div className="fg"><label className="fl">Availability</label><select className="fs" value={f.availability} onChange={e=>s("availability",e.target.value)}>{AVAILABILITY.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"><label className="fl">Location</label><input className="fi" value={f.location} onChange={e=>s("location",e.target.value)} placeholder="Costume Closet A"/></div>

      <div className="fg fu" style={{borderTop:"1px solid var(--bd)",paddingTop:12,marginTop:2}}>
        <label className="fl" style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>{I.camera(13)} Photos (up to 5)</label>
        <div className="pa">
          {(f.images||[]).map((img,i)=>(<div key={i} className="pt"><img src={img} alt=""/><button className="pr2" onClick={()=>s("images",(f.images||[]).filter((_,j)=>j!==i))}>Ã—</button></div>))}
          {(f.images||[]).length<5&&(<label className="pad">{I.plus(16)}<span>Add</span><input ref={fr} type="file" accept="image/*" multiple hidden onChange={addPhoto}/></label>)}
        </div>
      </div>

      <div className="fg fu">
        <label className="fl" style={{display:"flex",alignItems:"center",gap:5}}>{I.tag(13)} Tags</label>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
          {(f.tags||[]).map(t=><span key={t} className="mt" style={{cursor:"pointer"}} onClick={()=>s("tags",f.tags.filter(x=>x!==t))}>{t} Ã—</span>)}
        </div>
        <div style={{display:"flex",gap:5}}>
          <input className="fi" value={ti} onChange={e=>setTi(e.target.value)} placeholder="Add tag..." style={{flex:1}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag()}}}/>
          <button className="btn bsm bs" onClick={addTag}>Add</button>
        </div>
      </div>

      <div className="fg fu"><label className="fl">Notes</label><textarea className="ft" value={f.notes} onChange={e=>s("notes",e.target.value)} placeholder="Production history, care instructions..."/></div>

      <div className="fg fu" style={{borderTop:"1px solid var(--bd)",paddingTop:12,marginTop:2}}>
        <label className="fl" style={{color:"var(--gold)",marginBottom:4}}>Marketplace Settings</label>
      </div>
      <div className="fg"><label className="fl">Listing</label><select className="fs" value={f.marketStatus} onChange={e=>s("marketStatus",e.target.value)}>{MARKET_STATUS.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="fg"/>
      {(f.marketStatus==="For Rent"||f.marketStatus==="Rent or Sale")&&<div className="fg"><label className="fl">Rental / week</label><input className="fi" type="number" min="0" step="0.01" value={f.rentalPrice} onChange={e=>s("rentalPrice",parseFloat(e.target.value)||0)}/></div>}
      {(f.marketStatus==="For Sale"||f.marketStatus==="Rent or Sale")&&<div className="fg"><label className="fl">Sale Price</label><input className="fi" type="number" min="0" step="0.01" value={f.salePrice} onChange={e=>s("salePrice",parseFloat(e.target.value)||0)}/></div>}
    </div>
    <div style={{display:"flex",gap:7,justifyContent:"flex-end",marginTop:18,paddingTop:14,borderTop:"1px solid var(--bd)"}}>
      <button className="btn bs" onClick={onCancel}>Cancel</button>
      <button className="btn bp" disabled={!v} style={!v?{opacity:.5}:{}} onClick={()=>onSave(f)}>{I.check(14)} {item?"Save":"Add Item"}</button>
    </div>
  </>);
}

// â”€â”€â”€ Item Detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ItemDetail({item, onEdit, onDelete, onClose}){
  const cat=CAT_MAP[item.category]||CAT_MAP.other;
  const mB=item.marketStatus==="For Rent"?"r":item.marketStatus==="For Sale"?"s":item.marketStatus==="Rent or Sale"?"b":"n";
  const[lb,setLb]=useState(null);
  const[qr,setQr]=useState(null);
  useEffect(()=>{setQr(QR.toDataURL("T4U:"+item.id+":"+item.name,200))},[item.id,item.name]);

  const printQR=()=>{
    const w=window.open("","_blank","width=400,height=500");if(!w)return;
    w.document.write("<html><head><title>QR - "+item.name+"</title><style>body{font-family:sans-serif;text-align:center;padding:40px}img{margin:20px}h2{margin-bottom:4px}p{color:#666;font-size:14px}</style></head><body><h2>"+item.name+"</h2><p>"+cat.label+" | ID: "+item.id+"</p><img src='"+qr+"' width='200' height='200'/><br><p style='font-size:11px;margin-top:20px'>Theatre4u Inventory</p><script>setTimeout(function(){window.print()},300)<\/script></body></html>");
    w.document.close();
  };
  const dlQR=()=>{const a=document.createElement("a");a.href=qr;a.download="T4U-"+item.id+".png";a.click()};

  return(<>
    <Lightbox src={lb} onClose={()=>setLb(null)}/>
    {(item.images||[]).length>0&&<div className="pg">{item.images.map((img,i)=><img key={i} src={img} alt="" onClick={()=>setLb(img)}/>)}</div>}
    <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:18}}>
      <div className="icc" style={{background:cat.color+"22",fontSize:24,width:44,height:44}}>{cat.icon}</div>
      <div><div style={{fontSize:11.5,color:cat.color,fontWeight:600}}>{cat.label}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700}}>{item.name}</div></div>
    </div>
    {(item.tags||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>{item.tags.map(t=><span key={t} className="mt" style={{background:"rgba(212,168,67,.1)",color:"var(--gold)"}}>#{t}</span>)}</div>}
    <div className="dsec"><h3>Details</h3>
      <div className="dr"><span className="drl">Condition</span><span className="drv">{item.condition}</span></div>
      <div className="dr"><span className="drl">Size</span><span className="drv">{item.size}</span></div>
      <div className="dr"><span className="drl">Quantity</span><span className="drv">{item.quantity}</span></div>
      <div className="dr"><span className="drl">Availability</span><span className="drv">{item.availability}</span></div>
      <div className="dr"><span className="drl">Location</span><span className="drv">{item.location||"\u2014"}</span></div>
      {item.notes&&<div className="dr"><span className="drl">Notes</span><span className="drv">{item.notes}</span></div>}
      <div className="dr"><span className="drl">Added</span><span className="drv">{item.dateAdded?new Date(item.dateAdded).toLocaleDateString():"\u2014"}</span></div>
      <div className="dr"><span className="drl">Item ID</span><span className="drv" style={{fontFamily:"monospace",fontSize:11,color:"var(--t3)"}}>{item.id}</span></div>
    </div>
    <div className="dsec"><h3>Marketplace</h3>
      <div className="dr"><span className="drl">Status</span><span className="drv"><span className={"mb "+mB}>{item.marketStatus}</span></span></div>
      {(item.marketStatus==="For Rent"||item.marketStatus==="Rent or Sale")&&<div className="dr"><span className="drl">Rental</span><span className="drv pr">{currency(item.rentalPrice)}/wk</span></div>}
      {(item.marketStatus==="For Sale"||item.marketStatus==="Rent or Sale")&&<div className="dr"><span className="drl">Sale Price</span><span className="drv pr">{currency(item.salePrice)}</span></div>}
    </div>
    <div className="dsec"><h3 style={{display:"flex",alignItems:"center",gap:7}}>{I.qr(15)} QR Code Label</h3>
      <div className="qrc">{qr&&<img src={qr} alt="QR" width={110} height={110}/>}
        <div><div style={{fontFamily:"'Playfair Display',serif",fontSize:14,marginBottom:3}}>{item.name}</div>
          <p style={{fontSize:12,color:"var(--t3)",lineHeight:1.4,marginBottom:8}}>Print this label and attach it to the item or storage bin. Anyone can scan it to look up details instantly.</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="btn bsm bs" onClick={printQR}>{I.print(13)} Print</button>
            <button className="btn bsm bs" onClick={dlQR}>{I.download(13)} Save</button>
          </div>
        </div>
      </div>
    </div>
    <div style={{display:"flex",gap:7,marginTop:16}}>
      <button className="btn bp" onClick={()=>onEdit(item)}>{I.edit(14)} Edit</button>
      <button className="btn bd" onClick={()=>{if(confirm("Delete this item?"))onDelete(item.id)}}>{I.trash(14)} Delete</button>
    </div>
  </>);
}

// â”€â”€â”€ Pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Pgn({total,page,per,onPage}){
  const pages=Math.ceil(total/per);if(pages<=1)return null;
  const s=Math.max(1,page-2),e=Math.min(pages,page+2),b=[];
  for(let i=s;i<=e;i++)b.push(i);
  return(<div className="pgn">
    <button disabled={page<=1} onClick={()=>onPage(page-1)}>&lsaquo;</button>
    {s>1&&<><button onClick={()=>onPage(1)}>1</button><span style={{color:"var(--t3)"}}>â€¦</span></>}
    {b.map(i=><button key={i} className={i===page?"a":""} onClick={()=>onPage(i)}>{i}</button>)}
    {e<pages&&<><span style={{color:"var(--t3)"}}>â€¦</span><button onClick={()=>onPage(pages)}>{pages}</button></>}
    <button disabled={page>=pages} onClick={()=>onPage(page+1)}>&rsaquo;</button>
  </div>);
}

// â”€â”€â”€ Scanner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Scanner({items,onFound,onClose}){
  const[input,setInput]=useState("");
  const[result,setResult]=useState(null);
  const search=()=>{
    const q=input.trim().toLowerCase();if(!q)return;
    const found=items.find(i=>i.id===q||i.id.toLowerCase()===q||i.name.toLowerCase().includes(q));
    setResult(found||"nf");
  };
  return(<div className="sov" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{textAlign:"center",color:"var(--t1)"}}><div style={{marginBottom:10}}>{I.scan(44)}</div>
      <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:6}}>QR / ID Lookup</h2>
      <p style={{color:"var(--t3)",marginBottom:16,maxWidth:380,fontSize:13}}>Enter the item ID from a printed QR label, or type a name to find items quickly.</p>
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <input className="fi" value={input} onChange={e=>setInput(e.target.value)} placeholder="Item ID or name..." style={{width:260,fontSize:15,padding:11}} autoFocus onKeyDown={e=>e.key==="Enter"&&search()}/>
      <button className="btn bp" onClick={search} style={{padding:"11px 18px"}}>Lookup</button>
    </div>
    {result==="nf"&&<div style={{background:"rgba(194,24,91,.15)",border:"1px solid rgba(194,24,91,.3)",borderRadius:9,padding:14,color:"var(--red)",marginTop:6}}>No item found for "{input}"</div>}
    {result&&result!=="nf"&&<div className="cd" style={{maxWidth:380,marginTop:6,cursor:"pointer"}} onClick={()=>{onFound(result);onClose()}}>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <div className="icc" style={{background:(CAT_MAP[result.category]?.color||"#757575")+"22"}}>{CAT_MAP[result.category]?.icon||"\u{1F4E6}"}</div>
        <div><div style={{fontWeight:600}}>{result.name}</div><div style={{fontSize:11,color:"var(--t3)"}}>{result.category} \u00B7 {result.condition} \u00B7 Qty: {result.quantity}</div></div>
      </div>
      <div style={{fontSize:11,color:"var(--gold)",marginTop:7}}>Click to view details \u2192</div>
    </div>}
    <button className="btn bs" onClick={onClose} style={{marginTop:10}}>Close</button>
  </div>);
}

// â•â•â• PAGES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function Dashboard({items,org}){
  const tq=items.reduce((s,i)=>s+(i.quantity||1),0);
  const listed=items.filter(i=>i.marketStatus!=="Not Listed").length;
  const tv=items.reduce((s,i)=>s+((i.salePrice||0)*(i.quantity||1)),0);
  const wp=items.filter(i=>(i.images||[]).length>0).length;
  const cc={};items.forEach(i=>{cc[i.category]=(cc[i.category]||0)+(i.quantity||1)});
  const mx=Math.max(1,...Object.values(cc));
  return(<div className="fin">
    <div style={{marginBottom:22}}><h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:2}}>Welcome{org.name?", "+org.name:" to Theatre4u"}</h2><p style={{color:"var(--t3)",fontSize:13.5}}>Your theatre inventory at a glance.</p></div>
    <div className="sg">
      <div className="cd sc"><div className="si">{"\u{1F4E6}"}</div><div className="sv">{tq}</div><div className="sl">Total Items</div></div>
      <div className="cd sc"><div className="si">{"\u{1F4C2}"}</div><div className="sv">{items.length}</div><div className="sl">Entries</div></div>
      <div className="cd sc"><div className="si">{"\u{1F3EA}"}</div><div className="sv">{listed}</div><div className="sl">Listed</div></div>
      <div className="cd sc"><div className="si">{"\u{1F4F8}"}</div><div className="sv">{wp}</div><div className="sl">With Photos</div></div>
      <div className="cd sc"><div className="si">{"\u{1F4B0}"}</div><div className="sv">{tv>0?currency(tv):"\u2014"}</div><div className="sl">Est. Value</div></div>
    </div>
    <div className="cd" style={{marginBottom:18}}>
      <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:12}}>Inventory by Category</h3>
      {CATEGORIES.map(cat=>{const c=cc[cat.id]||0;if(!c)return null;return<div className="cb" key={cat.id}><div className="cbi">{cat.icon}</div><div className="cbl">{cat.label}</div><div className="cbt"><div className="cbf" style={{width:(c/mx*100)+"%",background:cat.color}}/></div><div className="cbc">{c}</div></div>})}
      {items.length===0&&<p style={{color:"var(--t3)",textAlign:"center",padding:14}}>No items yet. Add your first or load sample data in Settings.</p>}
    </div>
    <div className="cd">
      <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:8}}>Getting Started</h3>
      <div style={{color:"var(--t2)",fontSize:13,lineHeight:1.7}}>
        <p style={{marginBottom:5}}>{"\u{1F4E6}"} <strong>Inventory</strong> â€” Add items with photos, tags, locations, and conditions.</p>
        <p style={{marginBottom:5}}>{"\u{1F4F8}"} <strong>Photos</strong> â€” Upload up to 5 photos per item for visual ID.</p>
        <p style={{marginBottom:5}}>{"\u{1F533}"} <strong>QR Codes</strong> â€” Every item gets a printable QR label for instant lookup.</p>
        <p style={{marginBottom:5}}>{"\u{1F3EA}"} <strong>Marketplace</strong> â€” Share items for rent or sale with other programs.</p>
        <p>{"\u{1F4CA}"} <strong>Reports</strong> â€” Breakdowns and CSV export.</p>
      </div>
    </div>
  </div>);
}

function Inventory({items,onAdd,onEdit,onDelete}){
  const[search,setSrch]=useState("");const[cf,setCf]=useState("all");const[cof,setCof]=useState("all");const[af,setAf]=useState("all");const[mf,setMf]=useState("all");
  const[view,setView]=useState("grid");const[showF,setShowF]=useState(false);const[pg,setPg]=useState(1);const[modal,setModal]=useState(null);const[act,setAct]=useState(null);const[scan,setScan]=useState(false);
  const PP=18;
  const flt=useMemo(()=>{let f=items;if(search){const q=search.toLowerCase();f=f.filter(i=>i.name.toLowerCase().includes(q)||(i.notes||"").toLowerCase().includes(q)||(i.location||"").toLowerCase().includes(q)||(i.tags||[]).some(t=>t.includes(q)))}
    if(cf!=="all")f=f.filter(i=>i.category===cf);if(cof!=="all")f=f.filter(i=>i.condition===cof);if(af!=="all")f=f.filter(i=>i.availability===af);if(mf!=="all")f=f.filter(i=>i.marketStatus===mf);return f},[items,search,cf,cof,af,mf]);
  const pd=useMemo(()=>flt.slice((pg-1)*PP,pg*PP),[flt,pg]);
  useEffect(()=>setPg(1),[search,cf,cof,af,mf]);
  const save=(form)=>{if(act)onEdit({...act,...form});else onAdd({...form,id:uid(),dateAdded:new Date().toISOString()});setModal(null);setAct(null)};
  const openD=(item)=>{setAct(item);setModal("d")};const openE=(item)=>{setAct(item);setModal("e")};

  return(<div className="fin">
    {scan&&<Scanner items={items} onFound={openD} onClose={()=>setScan(false)}/>}
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12,alignItems:"center"}}>
      <div className="srch">{I.search(14)}<input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search items, tags..."/></div>
      <button className="bi" title="Filters" onClick={()=>setShowF(!showF)} style={showF?{borderColor:"var(--gold)",color:"var(--gold)"}:{}}>{I.filter(14)}</button>
      <button className="bi" title="QR Lookup" onClick={()=>setScan(true)}>{I.scan(14)}</button>
      <div className="vt"><button className={view==="grid"?"a":""} onClick={()=>setView("grid")}>Grid</button><button className={view==="table"?"a":""} onClick={()=>setView("table")}>Table</button></div>
      <div style={{marginLeft:"auto"}}><button className="btn bp" onClick={()=>{setAct(null);setModal("a")}}>{I.plus(14)} Add Item</button></div>
    </div>
    {showF&&<div className="fp fin">
      <div><label>Category</label><select value={cf} onChange={e=>setCf(e.target.value)}><option value="all">All</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div><label>Condition</label><select value={cof} onChange={e=>setCof(e.target.value)}><option value="all">All</option>{CONDITIONS.map(c=><option key={c}>{c}</option>)}</select></div>
      <div><label>Availability</label><select value={af} onChange={e=>setAf(e.target.value)}><option value="all">All</option>{AVAILABILITY.map(c=><option key={c}>{c}</option>)}</select></div>
      <div><label>Market</label><select value={mf} onChange={e=>setMf(e.target.value)}><option value="all">All</option>{MARKET_STATUS.map(c=><option key={c}>{c}</option>)}</select></div>
      <button className="btn bsm bs" onClick={()=>{setCf("all");setCof("all");setAf("all");setMf("all")}}>Clear</button>
    </div>}
    <div style={{color:"var(--t3)",fontSize:11.5,marginBottom:8}}>{flt.length} item{flt.length!==1?"s":""}</div>
    {view==="grid"&&<>{pd.length===0?<div className="emp"><div className="ei">{"\u{1F3AD}"}</div><h3>No items found</h3><p>{items.length===0?"Add your first item to begin.":"Adjust search or filters."}</p>{items.length===0&&<button className="btn bp" onClick={()=>{setAct(null);setModal("a")}}>{I.plus(14)} Add Item</button>}</div>
      :<div className="cg">{pd.map(item=>{const cat=CAT_MAP[item.category]||CAT_MAP.other;const mB=item.marketStatus==="For Rent"?"r":item.marketStatus==="For Sale"?"s":item.marketStatus==="Rent or Sale"?"b":"n";const hi=(item.images||[]).length>0;
        return(<div key={item.id} className="cd ic" onClick={()=>openD(item)}>
          {hi&&<div className="ic-img"><img src={item.images[0]} alt={item.name} loading="lazy"/></div>}
          <div className="ich">{!hi&&<div className="icc" style={{background:cat.color+"22"}}>{cat.icon}</div>}<div><div className="ict">{item.name}</div><div className="ics">{cat.label}{item.location?" \u00B7 "+item.location:""}</div></div></div>
          <div className="icm"><span className="mt">{item.condition}</span><span className="mt">\u00D7{item.quantity}</span>{item.size!=="N/A"&&<span className="mt">{item.size}</span>}<span className="mt">{item.availability}</span>{hi&&<span className="mt">{"\u{1F4F8}"} {item.images.length}</span>}</div>
          <div className="icf"><span className={"mb "+mB}>{item.marketStatus}</span>{item.marketStatus!=="Not Listed"&&<span className="pr">{item.rentalPrice>0?currency(item.rentalPrice)+"/wk":""}{item.rentalPrice>0&&item.salePrice>0?" \u00B7 ":""}{item.salePrice>0?currency(item.salePrice):""}</span>}</div>
        </div>)})}</div>}<Pgn total={flt.length} page={pg} per={PP} onPage={setPg}/></>}
    {view==="table"&&<><div className="tw"><table><thead><tr><th></th><th>Item</th><th>Category</th><th>Cond.</th><th>Qty</th><th>Location</th><th>Status</th><th>Market</th><th></th></tr></thead><tbody>
      {pd.map(item=>{const cat=CAT_MAP[item.category]||CAT_MAP.other;const mB=item.marketStatus==="For Rent"?"r":item.marketStatus==="For Sale"?"s":item.marketStatus==="Rent or Sale"?"b":"n";
        return(<tr key={item.id}><td style={{width:36,padding:"3px 6px"}}>{(item.images||[]).length>0?<img src={item.images[0]} alt="" style={{width:28,height:28,borderRadius:3,objectFit:"cover"}}/>:<span style={{fontSize:16}}>{cat.icon}</span>}</td>
          <td style={{fontWeight:600,cursor:"pointer"}} onClick={()=>openD(item)}>{item.name}</td><td>{cat.label}</td><td>{item.condition}</td><td>{item.quantity}</td><td style={{color:"var(--t2)"}}>{item.location||"\u2014"}</td><td>{item.availability}</td>
          <td><span className={"mb "+mB}>{item.marketStatus}</span></td><td><div style={{display:"flex",gap:3}}><button className="bi" onClick={e=>{e.stopPropagation();openE(item)}}>{I.edit(12)}</button><button className="bi" style={{color:"var(--red)"}} onClick={e=>{e.stopPropagation();if(confirm("Delete?"))onDelete(item.id)}}>{I.trash(12)}</button></div></td></tr>)})}
      {pd.length===0&&<tr><td colSpan={9} style={{textAlign:"center",color:"var(--t3)",padding:32}}>No items</td></tr>}
    </tbody></table></div><Pgn total={flt.length} page={pg} per={PP} onPage={setPg}/></>}
    {modal==="a"&&<Modal title="Add New Item" onClose={()=>setModal(null)}><ItemForm onSave={save} onCancel={()=>setModal(null)}/></Modal>}
    {modal==="e"&&act&&<Modal title="Edit Item" onClose={()=>setModal(null)}><ItemForm item={act} onSave={save} onCancel={()=>setModal(null)}/></Modal>}
    {modal==="d"&&act&&<Modal title="Item Details" onClose={()=>{setModal(null);setAct(null)}}><ItemDetail item={act} onEdit={()=>setModal("e")} onDelete={id=>{onDelete(id);setModal(null);setAct(null)}} onClose={()=>{setModal(null);setAct(null)}}/></Modal>}
  </div>);
}

function Marketplace({items,org}){
  const[search,setSrch]=useState("");const[cf,setCf]=useState("all");const[tf,setTf]=useState("all");const[pg,setPg]=useState(1);const[vi,setVi]=useState(null);const PP=16;
  const listed=useMemo(()=>{let f=items.filter(i=>i.marketStatus!=="Not Listed"&&i.availability==="In Stock");if(search){const q=search.toLowerCase();f=f.filter(i=>i.name.toLowerCase().includes(q))}if(cf!=="all")f=f.filter(i=>i.category===cf);if(tf==="rent")f=f.filter(i=>i.marketStatus.includes("Rent"));if(tf==="sale")f=f.filter(i=>i.marketStatus.includes("Sale"));return f},[items,search,cf,tf]);
  const pd=useMemo(()=>listed.slice((pg-1)*PP,pg*PP),[listed,pg]);useEffect(()=>setPg(1),[search,cf,tf]);
  return(<div className="fin">
    <p style={{color:"var(--t2)",fontSize:13,marginBottom:14}}>Items marked for rent or sale. Other organizations can browse these.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12,alignItems:"center"}}>
      <div className="srch">{I.search(14)}<input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Search listings..."/></div>
      <select value={cf} onChange={e=>setCf(e.target.value)} style={{background:"var(--bgi)",border:"1px solid var(--bd)",borderRadius:6,padding:"5px 8px",color:"var(--t1)",fontSize:12}}><option value="all">All Categories</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <div className="vt"><button className={tf==="all"?"a":""} onClick={()=>setTf("all")}>All</button><button className={tf==="rent"?"a":""} onClick={()=>setTf("rent")}>Rent</button><button className={tf==="sale"?"a":""} onClick={()=>setTf("sale")}>Sale</button></div>
    </div>
    <div style={{color:"var(--t3)",fontSize:11.5,marginBottom:8}}>{listed.length} listing{listed.length!==1?"s":""}</div>
    {pd.length===0?<div className="emp"><div className="ei">{"\u{1F3EA}"}</div><h3>No listings</h3><p>Mark items for rent or sale in inventory.</p></div>
    :<div className="cg">{pd.map(item=>{const cat=CAT_MAP[item.category]||CAT_MAP.other;const mB=item.marketStatus==="For Rent"?"r":item.marketStatus==="For Sale"?"s":"b";const hi=(item.images||[]).length>0;
      return(<div key={item.id} className="cd ic" onClick={()=>setVi(item)}>
        {org.name&&<div style={{fontSize:11,color:"var(--gold)",fontWeight:600,marginBottom:7,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,background:"var(--gold)",borderRadius:"50%",display:"inline-block"}}/>{org.name}</div>}
        {hi&&<div className="ic-img"><img src={item.images[0]} alt={item.name} loading="lazy"/></div>}
        <div className="ich">{!hi&&<div className="icc" style={{background:cat.color+"22"}}>{cat.icon}</div>}<div><div className="ict">{item.name}</div><div className="ics">{cat.label} \u00B7 {item.condition} \u00B7 Qty: {item.quantity}</div></div></div>
        {item.notes&&<p style={{fontSize:11.5,color:"var(--t3)",margin:"5px 0",lineHeight:1.4}}>{item.notes.slice(0,80)}{item.notes.length>80?"\u2026":""}</p>}
        <div className="icf"><span className={"mb "+mB}>{item.marketStatus}</span><span className="pr">{item.rentalPrice>0?currency(item.rentalPrice)+"/wk":""}{item.rentalPrice>0&&item.salePrice>0?" \u00B7 ":""}{item.salePrice>0?currency(item.salePrice):""}</span></div>
      </div>)})}</div>}
    <Pgn total={listed.length} page={pg} per={PP} onPage={setPg}/>
    {vi&&<Modal title="Listing" onClose={()=>setVi(null)}><ItemDetail item={vi} onEdit={()=>{}} onDelete={()=>{}} onClose={()=>setVi(null)}/></Modal>}
  </div>);
}

function Reports({items}){
  const[tab,setTab]=useState("overview");
  const tq=items.reduce((s,i)=>s+(i.quantity||1),0);
  const cd=CATEGORIES.map(cat=>{const ci=items.filter(i=>i.category===cat.id);return{...cat,count:ci.length,qty:ci.reduce((s,i)=>s+(i.quantity||1),0),value:ci.reduce((s,i)=>s+((i.salePrice||0)*(i.quantity||1)),0)}}).filter(c=>c.count>0);
  const coD=CONDITIONS.map(c=>({l:c,c:items.filter(i=>i.condition===c).length})).filter(c=>c.c>0);
  const avD=AVAILABILITY.map(a=>({l:a,c:items.filter(i=>i.availability===a).length})).filter(a=>a.c>0);
  const mkD=MARKET_STATUS.map(s=>({l:s,c:items.filter(i=>i.marketStatus===s).length})).filter(m=>m.c>0);

  const csv=()=>{const h=["Name","Category","Condition","Size","Qty","Location","Availability","Market","Rental","Sale","Tags","Notes","ID","Date"];
    const r=items.map(i=>[i.name,i.category,i.condition,i.size,i.quantity,i.location,i.availability,i.marketStatus,i.rentalPrice,i.salePrice,(i.tags||[]).join(";"),'"'+(i.notes||"").replace(/"/g,'""')+'"',i.id,i.dateAdded]);
    const c=[h.join(","),...r.map(r=>r.join(","))].join("\n");const b=new Blob([c],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="theatre4u_inventory.csv";a.click()};

  const printQR=()=>{const w=window.open("","_blank");if(!w)return;
    const labels=items.map(i=>{const src=QR.toDataURL("T4U:"+i.id+":"+i.name,140);return'<div style="display:inline-block;text-align:center;padding:10px;border:1px dashed #ccc;margin:5px;width:170px"><img src="'+src+'" width="96" height="96"/><div style="font-size:10px;font-weight:600;margin-top:5px">'+i.name+'</div><div style="font-size:8px;color:#888">'+i.id+'</div></div>'}).join("");
    w.document.write('<html><head><title>Theatre4u QR Labels</title></head><body style="font-family:sans-serif;padding:16px">'+labels+'<script>setTimeout(function(){window.print()},400)<\/script></body></html>');w.document.close()};

  return(<div className="fin">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:7}}>
      <p style={{color:"var(--t2)",fontSize:13}}>Analyze and export inventory data.</p>
      <div style={{display:"flex",gap:6}}><button className="btn bs bsm" onClick={printQR}>{I.qr(13)} Print All QR</button><button className="btn bs bsm" onClick={csv}>{I.download(13)} Export CSV</button></div>
    </div>
    <div className="tabs">{["overview","condition","availability","market"].map(t=><button key={t} className={"tab "+(tab===t?"a":"")} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
    {tab==="overview"&&<div className="cd"><h3 style={{fontFamily:"'Playfair Display',serif",marginBottom:12}}>Category Breakdown</h3><div className="tw"><table><thead><tr><th>Category</th><th>Entries</th><th>Qty</th><th>Value</th></tr></thead><tbody>
      {cd.map(c=><tr key={c.id}><td>{c.icon} {c.label}</td><td>{c.count}</td><td>{c.qty}</td><td>{c.value>0?currency(c.value):"\u2014"}</td></tr>)}
      <tr style={{fontWeight:700}}><td>Total</td><td>{items.length}</td><td>{tq}</td><td>{currency(cd.reduce((s,c)=>s+c.value,0))}</td></tr></tbody></table></div></div>}
    {tab==="condition"&&<div className="cd"><h3 style={{fontFamily:"'Playfair Display',serif",marginBottom:12}}>Condition Report</h3>
      {coD.map(c=><div className="cb" key={c.l}><div className="cbl" style={{width:100}}>{c.l}</div><div className="cbt"><div className="cbf" style={{width:(c.c/items.length*100)+"%",background:c.l==="New"?"#4caf50":c.l==="Excellent"?"#66bb6a":c.l==="Good"?"#42a5f5":"#ffa726"}}/></div><div className="cbc">{c.c}</div></div>)}</div>}
    {tab==="availability"&&<div className="cd"><h3 style={{fontFamily:"'Playfair Display',serif",marginBottom:12}}>Availability</h3>
      {avD.map(a=><div className="cb" key={a.l}><div className="cbl" style={{width:100}}>{a.l}</div><div className="cbt"><div className="cbf" style={{width:(a.c/items.length*100)+"%",background:a.l==="In Stock"?"#4caf50":"#42a5f5"}}/></div><div className="cbc">{a.c}</div></div>)}</div>}
    {tab==="market"&&<div className="cd"><h3 style={{fontFamily:"'Playfair Display',serif",marginBottom:12}}>Marketplace</h3>
      {mkD.map(m=><div className="cb" key={m.l}><div className="cbl" style={{width:100}}>{m.l}</div><div className="cbt"><div className="cbf" style={{width:(m.c/items.length*100)+"%",background:m.l.includes("Rent")?"#42a5f5":m.l.includes("Sale")?"#4caf50":m.l.includes("or")?"#d4a843":"#757575"}}/></div><div className="cbc">{m.c}</div></div>)}</div>}
  </div>);
}

function Settings({org,setOrg,onSeed}){
  const[f,setF]=useState(org);const[saved,setSaved]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const save=()=>{setOrg(f);setSaved(true);setTimeout(()=>setSaved(false),2000)};
  return(<div className="fin" style={{maxWidth:600}}>
    <div className="cd" style={{marginBottom:18}}>
      <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:16}}>Organization Profile</h3>
      <div className="fg2">
        <div className="fg fu"><label className="fl">Organization Name</label><input className="fi" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Lincoln High Drama"/></div>
        <div className="fg"><label className="fl">Type</label><select className="fs" value={f.type} onChange={e=>s("type",e.target.value)}><option value="">Select...</option><option value="school">School</option><option value="district">District</option><option value="community">Community Theatre</option><option value="college">College</option><option value="professional">Professional</option><option value="other">Other</option></select></div>
        <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={f.email} onChange={e=>s("email",e.target.value)} placeholder="drama@school.edu"/></div>
        <div className="fg"><label className="fl">Phone</label><input className="fi" value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="(555) 123-4567"/></div>
        <div className="fg"><label className="fl">City</label><input className="fi" value={f.location} onChange={e=>s("location",e.target.value)} placeholder="Portland, OR"/></div>
        <div className="fg fu"><label className="fl">About</label><textarea className="ft" value={f.bio} onChange={e=>s("bio",e.target.value)} placeholder="Tell others about your program..."/></div>
      </div>
      <div style={{marginTop:14,display:"flex",gap:7,alignItems:"center"}}>
        <button className="btn bp" onClick={save}>{I.check(14)} Save</button>
        {saved&&<span style={{color:"var(--grn)",fontSize:12,fontWeight:600}}>{"\u2713"} Saved!</span>}
      </div>
    </div>
    <div className="cd">
      <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:8}}>Data Management</h3>
      <p style={{color:"var(--t3)",fontSize:12.5,marginBottom:12}}>Load sample data to explore, or reset everything.</p>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        <button className="btn bs" onClick={onSeed}>{I.box(14)} Load Samples</button>
        <button className="btn bd" onClick={()=>{if(confirm("Delete ALL data?")){const e={name:"",type:"",email:"",phone:"",location:"",bio:""};setOrg(e);setF(e);DB.save("t4u-items",[]);DB.save("t4u-org",e);window.location.reload()}}}>{I.trash(14)} Reset All</button>
      </div>
    </div>
  </div>);
}

// â•â•â• APP â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function App(){
  const[items,setItems]=useState([]);const[org,setOrg]=useState({name:"",type:"",email:"",phone:"",location:"",bio:""});
  const[page,setPage]=useState("dashboard");const[so,setSo]=useState(false);const[loaded,setLoaded]=useState(false);
  const[scene,setScene]=useState("landing");
  const[curtain,setCurtain]=useState("hidden");

  useEffect(()=>{(async()=>{const si=await DB.load("t4u-items",null);const so2=await DB.load("t4u-org",null);if(si)setItems(si);if(so2)setOrg(so2);setLoaded(true)})()},[]);
  useEffect(()=>{if(loaded)DB.save("t4u-items",items)},[items,loaded]);
  useEffect(()=>{if(loaded)DB.save("t4u-org",org)},[org,loaded]);

  const add=useCallback(i=>setItems(p=>[i,...p]),[]);
  const edit=useCallback(i=>setItems(p=>p.map(x=>x.id===i.id?i:x)),[]);
  const del=useCallback(id=>setItems(p=>p.filter(x=>x.id!==id)),[]);
  const seed=useCallback(()=>setItems(p=>[...p,...seedItems()]),[]);
  const nav=p=>{setPage(p);setSo(false)};

  const goApp=useCallback(()=>{
    setCurtain("closed");
    setTimeout(()=>{setScene("app");window.scrollTo(0,0);setCurtain("open");setTimeout(()=>setCurtain("hidden"),800);},700);
  },[]);

  const goLanding=useCallback(()=>{
    setCurtain("closed");
    setTimeout(()=>{setScene("landing");window.scrollTo(0,0);setCurtain("open");setTimeout(()=>setCurtain("hidden"),800);},700);
  },[]);

  const navs=[{id:"dashboard",l:"Dashboard",i:I.home},{id:"inventory",l:"Inventory",i:I.box},{id:"marketplace",l:"Marketplace",i:I.store},{id:"reports",l:"Reports",i:I.chart},{id:"settings",l:"Settings",i:I.settings}];
  const listed=items.filter(i=>i.marketStatus!=="Not Listed").length;
  const titles={dashboard:"Dashboard",inventory:"Inventory",marketplace:"Marketplace",reports:"Reports",settings:"Settings"};
  const desk=typeof window!=="undefined"&&window.innerWidth>900;

  const curtainEl=curtain!=="hidden"&&(
    <div style={{position:"fixed",inset:0,zIndex:9000,display:"flex",pointerEvents:"none"}}>
      <div style={{flex:1,background:"var(--bg2)",transition:"transform .7s cubic-bezier(.77,0,.18,1)",borderRight:"1px solid rgba(212,168,67,.35)",transform:curtain==="open"?"translateX(-100%)":"translateX(0)"}}/>
      <div style={{flex:1,background:"var(--bg2)",transition:"transform .7s cubic-bezier(.77,0,.18,1)",borderLeft:"1px solid rgba(212,168,67,.35)",transform:curtain==="open"?"translateX(100%)":"translateX(0)"}}/>
    </div>
  );

  if(scene==="landing") return(<><style>{CSS}</style>{curtainEl}<LandingPage onLaunch={goApp}/></>);

  return(<><style>{CSS}</style>{curtainEl}
    <div className="app">
      <aside className={"side "+(desk?"":so?"ms":"mh")} style={desk?{position:"relative",transform:"none",opacity:1}:{}}>
        <div className="logo"><div className="logo-i">{"\u{1F3AD}"}</div><div><div className="logo-t">Theatre4u</div><div className="logo-s">Inventory & Market</div></div></div>
        <nav className="nav">
          <div className="nlbl">Main</div>
          {navs.map(n=><div key={n.id} className={"ni "+(page===n.id?"a":"")} onClick={()=>nav(n.id)}>{n.i(16)}<span>{n.l}</span>
            {n.id==="inventory"&&items.length>0&&<span className="c">{items.length}</span>}
            {n.id==="marketplace"&&listed>0&&<span className="c">{listed}</span>}
          </div>)}
          <div className="nlbl" style={{marginTop:12}}>Categories</div>
          {CATEGORIES.slice(0,7).map(cat=>{const c=items.filter(i=>i.category===cat.id).length;
            return<div key={cat.id} className="ni" onClick={()=>nav("inventory")} style={{fontSize:12,padding:"5px 11px"}}><span>{cat.icon}</span><span>{cat.label}</span>{c>0&&<span className="c">{c}</span>}</div>})}
          <div style={{marginTop:"auto",padding:"10px 9px 6px",borderTop:"1px solid var(--bd)"}}>
            <div className="back-lp" onClick={goLanding}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              <span>About Theatre4u</span>
            </div>
          </div>
        </nav>
      </aside>
      <div className="main">
        <div className="top"><button className="mmb" onClick={()=>setSo(!so)}>{so?I.x(20):I.menu(20)}</button><h1>{titles[page]}</h1></div>
        <div className="scroll" onClick={()=>so&&setSo(false)}>
          {!loaded?<div style={{textAlign:"center",padding:50,color:"var(--t3)"}}><div style={{fontSize:32,marginBottom:10}}>{"\u{1F3AD}"}</div><p>Loading...</p></div>:<>
            {page==="dashboard"&&<Dashboard items={items} org={org}/>}
            {page==="inventory"&&<Inventory items={items} onAdd={add} onEdit={edit} onDelete={del}/>}
            {page==="marketplace"&&<Marketplace items={items} org={org}/>}
            {page==="reports"&&<Reports items={items}/>}
            {page==="settings"&&<Settings org={org} setOrg={setOrg} onSeed={seed}/>}
          </>}
        </div>
      </div>
    </div>
    {so&&!desk&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}} onClick={()=>setSo(false)}/>}
  </>);
}
