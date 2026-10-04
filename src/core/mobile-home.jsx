// mobile-home.jsx — the "Home" tab inside the native app. Big, thumb-friendly
// quick actions, styled for the app's light content background.
import React from "react";

const Tile = ({ icon, title, sub, onClick, primary }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 15, width: "100%",
      padding: "15px 16px", marginBottom: 11, borderRadius: 14, cursor: "pointer",
      textAlign: "left",
      border: primary ? "none" : "1px solid var(--border,#e4d9c4)",
      background: primary ? "linear-gradient(135deg,#C9A23A 0%,#E6C65C 100%)" : "#fffdf8",
      color: primary ? "#1a1208" : "var(--ink,#241a10)",
      boxShadow: primary ? "0 2px 10px rgba(201,162,58,.35)" : "0 1px 4px rgba(0,0,0,.05)",
      WebkitTapHighlightColor: "transparent",
    }}
  >
    <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0, width: 34, textAlign: "center" }}>{icon}</span>
    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{title}</span>
      {sub && <span style={{ fontSize: 12.5, color: primary ? "rgba(26,18,8,.72)" : "var(--muted,#8a7c66)" }}>{sub}</span>}
    </span>
  </button>
);

export function MobileHome({ appName, orgName, onScan, onInventory, onAddItem, onOpenWeb }) {
  return (
    <div style={{ padding: "16px 16px 8px" }}>
      {orgName && (
        <div style={{ marginBottom: 15 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted,#8a7c66)" }}>Welcome back</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "var(--ink,#241a10)", lineHeight: 1.15 }}>{orgName}</div>
        </div>
      )}

      <Tile primary icon="🔍" title="Scan a code" sub="Pull up an item or bin by its QR code" onClick={onScan} />
      <Tile icon="📦" title="My Inventory" sub="Browse and search your items" onClick={onInventory} />
      <Tile icon="➕" title="Add an item" sub="Add a new item to your catalog" onClick={onAddItem} />

      <button onClick={onOpenWeb} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
        marginTop: 8, padding: "12px", borderRadius: 12, cursor: "pointer",
        background: "transparent", border: "1px solid var(--border,#e4d9c4)",
        color: "var(--muted,#8a7c66)", fontSize: 13.5, fontWeight: 600,
      }}>
        Open the full web platform <span>↗</span>
      </button>
    </div>
  );
}
