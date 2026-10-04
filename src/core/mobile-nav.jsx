// mobile-nav.jsx — fixed bottom tab bar for the native app (IS_NATIVE_APP only).
// Gives one-tap navigation instead of the desktop slide-out sidebar.
import React from "react";

const Item = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 3, background: "none", border: "none", cursor: "pointer", padding: "6px 2px",
    color: active ? "#E6C65C" : "rgba(255,255,255,.62)", WebkitTapHighlightColor: "transparent",
  }}>
    <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .2 }}>{label}</span>
  </button>
);

export function MobileNav({ page, onHome, onInventory, onScan, onRequests, onMore }) {
  return (
    <nav style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 8000,
      display: "flex", alignItems: "stretch",
      background: "#15121b", borderTop: "1px solid rgba(212,175,55,.22)",
      paddingBottom: "env(safe-area-inset-bottom,0px)",
      boxShadow: "0 -4px 18px rgba(0,0,0,.35)",
    }}>
      <Item icon="🏠" label="Home" active={page==="home"} onClick={onHome} />
      <Item icon="📦" label="Inventory" active={page==="inventory"} onClick={onInventory} />
      {/* Center scan button — raised and emphasized */}
      <button onClick={onScan} aria-label="Scan a code" style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        gap: 3, background: "none", border: "none", cursor: "pointer", padding: "6px 2px",
        color: "#1a1208", WebkitTapHighlightColor: "transparent",
      }}>
        <span style={{
          width: 48, height: 48, borderRadius: "50%", marginTop: -20,
          background: "linear-gradient(135deg,#C9A23A 0%,#E6C65C 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          boxShadow: "0 3px 10px rgba(0,0,0,.4)", border: "3px solid #15121b",
        }}>🔍</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#E6C65C", marginTop: -1 }}>Scan</span>
      </button>
      <Item icon="📨" label="Requests" active={page==="requests"} onClick={onRequests} />
      <Item icon="☰" label="More" active={false} onClick={onMore} />
    </nav>
  );
}
