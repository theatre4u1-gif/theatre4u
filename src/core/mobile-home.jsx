// mobile-home.jsx — the "Home" tab inside the native app. Big, thumb-friendly
// quick actions, styled for the app's light content background.
import React from "react";

// All three tiles share one look so Scan, Inventory and Add item match.
const Tile = ({ icon, title, sub, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%",
      padding: "15px 16px", marginBottom: 11, borderRadius: 14, cursor: "pointer",
      textAlign: "left", border: "1px solid var(--border,#e4d9c4)",
      background: "#fffdf8", color: "var(--ink,#241a10)",
      boxShadow: "0 1px 4px rgba(0,0,0,.05)", WebkitTapHighlightColor: "transparent",
    }}
  >
    <span style={{
      flexShrink: 0, width: 42, height: 42, borderRadius: 11,
      background: "linear-gradient(135deg,#C9A23A 0%,#E6C65C 100%)", color: "#1a1208",
      display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 21,
    }}>{icon}</span>
    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{title}</span>
      {sub && <span style={{ fontSize: 12.5, color: "var(--muted,#8a7c66)" }}>{sub}</span>}
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

      <Tile icon="🔍" title="Scan a code" sub="Pull up an item or bin by its QR code" onClick={onScan} />
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
