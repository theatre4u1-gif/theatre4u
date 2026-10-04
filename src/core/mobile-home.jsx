// mobile-home.jsx — the app's mobile landing screen. Shown ONLY inside the
// native iOS/Android shell (see IS_NATIVE_APP). Big, thumb-friendly actions,
// with a way out to the full in-app experience and to the web platform.
import React from "react";

const Tile = ({ icon, title, sub, onClick, primary }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 16, width: "100%",
      padding: "20px 18px", marginBottom: 14, borderRadius: 16, cursor: "pointer",
      textAlign: "left", border: "1px solid " + (primary ? "transparent" : "rgba(212,175,55,.35)"),
      background: primary
        ? "linear-gradient(135deg,#C9A23A 0%,#E6C65C 100%)"
        : "rgba(255,255,255,.04)",
      color: primary ? "#1a1208" : "var(--linen,#f3ead3)",
      WebkitTapHighlightColor: "transparent",
    }}
  >
    <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0, width: 40, textAlign: "center" }}>{icon}</span>
    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{title}</span>
      {sub && <span style={{ fontSize: 13, opacity: primary ? .8 : .6 }}>{sub}</span>}
    </span>
  </button>
);

export function MobileHome({ appName, orgName, logo, onScan, onInventory, onAddItem, onOpenWeb, onFullApp, onSettings }) {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--ink,#0d0b11)",
      display: "flex", flexDirection: "column",
      padding: "calc(env(safe-area-inset-top,0px) + 22px) 22px calc(env(safe-area-inset-bottom,0px) + 22px)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {logo && <img src={logo} alt="" style={{ width: 46, height: 36, objectFit: "contain" }} />}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "var(--goldink,#E6C65C)", lineHeight: 1.1 }}>{appName}</span>
            {orgName && <span style={{ fontSize: 12, color: "var(--muted,#9a9488)" }}>{orgName}</span>}
          </div>
        </div>
        {onSettings && (
          <button onClick={onSettings} aria-label="Settings" style={{
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(212,175,55,.25)",
            borderRadius: 12, width: 42, height: 42, fontSize: 19, cursor: "pointer", color: "var(--linen,#f3ead3)",
          }}>⚙︎</button>
        )}
      </div>

      {/* Primary actions */}
      <div style={{ flex: 1 }}>
        <Tile primary icon="🔍" title="Scan a code" sub="Pull up an item or bin by its QR code" onClick={onScan} />
        <Tile icon="📦" title="My Inventory" sub="Browse and search your items" onClick={onInventory} />
        <Tile icon="➕" title="Add an item" sub="Snap a photo and add it fast" onClick={onAddItem} />
      </div>

      {/* Secondary */}
      <div style={{ marginTop: 18 }}>
        <button onClick={onOpenWeb} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
          padding: "15px", borderRadius: 14, cursor: "pointer",
          background: "transparent", border: "1px solid rgba(212,175,55,.3)",
          color: "var(--goldink,#E6C65C)", fontSize: 15, fontWeight: 600,
        }}>
          Open the full web platform <span style={{ fontSize: 15 }}>↗</span>
        </button>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={onFullApp} style={{
            background: "none", border: "none", color: "var(--muted,#9a9488)",
            fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 6,
          }}>
            Use the full app menu
          </button>
        </div>
      </div>
    </div>
  );
}
