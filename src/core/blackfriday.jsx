// Black Friday / Cyber Monday promo bar for the Theatre4u and BinTrove landing pages.
// Brand-themed, sticky at the top, click-to-copy code pill, auto-hides after the sale ends.
// Shown on Theatre4u and BinTrove only (NOT ArtsTracker — it has no BF code). Ends 11:59pm PT Dec 1, 2026.
import React, { useState, useEffect } from "react";
import { IS_THEATRE4U, IS_BINTROVE } from "./config.js";

// Sale ends 2026-12-01 23:59:59 America/Los_Angeles  →  2026-12-02T07:59:59Z
const SALE_END = Date.parse("2026-12-02T07:59:59Z");

const DEALS = {
  theatre4u: {
    code: "CURTAIN30",
    emoji: "🎭", // 🎭
    headline: "30% off Theatre4u Pro",
    sub: "6 months — just $10.50/mo",
    bg: "linear-gradient(90deg,#140d00 0%,#241800 50%,#140d00 100%)",
    accent: "#E7B64A",       // gold
    text: "#F6ECD2",
    pillBg: "#E7B64A",
    pillText: "#1a1200",
  },
  bintrove: {
    code: "BINFRIDAY40",
    emoji: "📦", // 📦
    headline: "40% off your first year",
    sub: "Home Plus, Home & Starter",
    bg: "linear-gradient(90deg,#083f3c 0%,#0F6E6B 50%,#083f3c 100%)",
    accent: "#F2C45B",       // warm gold on teal
    text: "#F3FBF9",
    pillBg: "#F2C45B",
    pillText: "#0A3F3C",
  },
};

export function BlackFridayBar() {
  const brand = IS_BINTROVE ? "bintrove" : IS_THEATRE4U ? "theatre4u" : null;
  const d = brand ? DEALS[brand] : null;
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem("bf2026_dismissed") === (d ? d.code : ""); } catch (e) { return false; }
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!d) return null;                      // ArtsTracker / other: no bar
  if (Date.now() > SALE_END) return null;   // sale over
  if (hidden) return null;

  const copy = () => {
    try { navigator.clipboard.writeText(d.code); setCopied(true); } catch (e) { setCopied(true); }
  };
  const dismiss = () => {
    try { localStorage.setItem("bf2026_dismissed", d.code); } catch (e) {}
    setHidden(true);
  };

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 9999, width: "100%",
      background: d.bg, color: d.text, borderBottom: "2px solid " + d.accent,
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      boxShadow: "0 2px 14px rgba(0,0,0,.28)",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "9px 44px 9px 16px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap",
        textAlign: "center", position: "relative", minHeight: 24,
      }}>
        <span style={{ fontSize: 17, lineHeight: 1 }} aria-hidden="true">{d.emoji}</span>
        <span style={{
          fontWeight: 800, letterSpacing: ".14em", fontSize: 12, color: d.accent, textTransform: "uppercase",
        }}>Black&nbsp;Friday</span>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{d.headline}</span>
        <span style={{ fontSize: 13, opacity: .85 }}>{d.sub}</span>
        <button onClick={copy} title="Click to copy code" style={{
          display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
          background: d.pillBg, color: d.pillText, border: "none", borderRadius: 999,
          padding: "4px 12px", fontWeight: 800, fontSize: 13, letterSpacing: ".04em",
        }}>
          <span style={{ fontWeight: 600, opacity: .8 }}>CODE</span>
          {d.code}
          <span style={{ fontSize: 11, fontWeight: 700 }}>{copied ? "✓ Copied" : "⧉"}</span>
        </button>
        <span style={{ fontSize: 12, opacity: .8 }}>Ends&nbsp;Dec&nbsp;1</span>
        <button onClick={dismiss} aria-label="Dismiss" style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", color: d.text, opacity: .7, fontSize: 20,
          lineHeight: 1, cursor: "pointer", padding: 4,
        }}>&times;</button>
      </div>
    </div>
  );
}
