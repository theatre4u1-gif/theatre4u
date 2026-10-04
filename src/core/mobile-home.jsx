// mobile-home.jsx — the "Home" tab inside the native app. Big, thumb-friendly
// quick actions. Branding/title come from the app's top bar, so no header here.
import React from "react";

const Tile = ({ icon, title, sub, onClick, primary }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 16, width: "100%",
      padding: "18px 18px", marginBottom: 12, borderRadius: 16, cursor: "pointer",
      textAlign: "left", border: "1px solid " + (primary ? "transparent" : "rgba(212,175,55,.35)"),
      background: primary
        ? "linear-gradient(135deg,#C9A23A 0%,#E6C65C 100%)"
        : "rgba(255,255,255,.04)",
      color: primary ? "#1a1208" : "var(--linen,#f3ead3)",
      WebkitTapHighlightColor: "transparent",
    }}
  >
    <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0, width: 38, textAlign: "center" }}>{icon}</span>
    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{title}</span>
      {sub && <span style={{ fontSize: 12.5, opacity: primary ? .8 : .6 }}>{sub}</span>}
    </span>
  </button>
);

export function MobileHome({ appName, orgName, onScan, onInventory, onAddItem, onOpenWeb }) {
  return (
    <div style={{ padding: "18px 16px 8px" }}>
      {orgName && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--muted,#9a9488)" }}>Welcome back</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "var(--goldink,#E6C65C)", lineHeight: 1.15 }}>{orgName}</div>
        </div>
      )}

      <Tile primary icon="🔍" title="Scan a code" sub="Pull up an item or bin by its QR code" onClick={onScan} />
      <Tile icon="📦" title="My Inventory" sub="Browse and search your items" onClick={onInventory} />
      <Tile icon="➕" title="Add an item" sub="Add a new item to your catalog" onClick={onAddItem} />

      <button onClick={onOpenWeb} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
        marginTop: 10, padding: "14px", borderRadius: 14, cursor: "pointer",
        background: "transparent", border: "1px solid rgba(212,175,55,.3)",
        color: "var(--goldink,#E6C65C)", fontSize: 14.5, fontWeight: 600,
      }}>
        Open the full web platform <span>↗</span>
      </button>
    </div>
  );
}
