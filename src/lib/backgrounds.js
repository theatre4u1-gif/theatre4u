// ── Page background photo IDs + per-vertical gradient fallbacks ───────────────
// Extracted from App.jsx (modularization). Pure data — no React, no app state.

export const BG = {
  dashboard:   "photo-1503095396549-807759245b35",
  inventory:   "photo-1489987707025-afc232f7ea0f",
  marketplace: "photo-1503095396549-807759245b35",
  reports:     "photo-1503095396549-807759245b35",
  settings:    "photo-1497366216548-37526070297c",
};

export const VERTICAL_BG_GRAD = {
  music:   "linear-gradient(135deg,#0d2b6e 0%,#1554a0 55%,#3949ab 100%)",
  dance:   "linear-gradient(135deg,#7b1560 0%,#c2185b 55%,#e91e8c 100%)",
  art:     "linear-gradient(135deg,#0d2b6e 0%,#1565c0 50%,#00838f 100%)",
  booster: "linear-gradient(135deg,#4a148c 0%,#7b1fa2 55%,#9c27b0 100%)",
};

// Unsplash photo URL builder
export const usp=(id,w=900,h=500)=>`https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=82`;
