// mobile-nav.jsx — fixed bottom tab bar for the native app (IS_NATIVE_APP only).
// One-tap navigation using the app's own icon set.
import React from "react";
import { Ic } from "./icons.jsx";

const Item = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 4, background: "none", border: "none", cursor: "pointer", padding: "7px 2px",
    color: active ? "#E6C65C" : "rgba(255,255,255,.6)", WebkitTapHighlightColor: "transparent",
  }}>
    <span className="mobnav-ico" style={{ width: 22, height: 22, display: "inline-flex" }}>{icon}</span>
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .2 }}>{label}</span>
  </button>
);

export function MobileNav({ page, onHome, onInventory, onScan, onAdd, onMore }) {
  return (
    <nav style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 8000,
      display: "flex", alignItems: "stretch",
      background: "#15121b", borderTop: "1px solid rgba(212,175,55,.22)",
      paddingBottom: "env(safe-area-inset-bottom,0px)",
      boxShadow: "0 -4px 18px rgba(0,0,0,.35)",
    }}>
      <Item icon={Ic.home} label="Home" active={page==="home"} onClick={onHome} />
      <Item icon={Ic.box} label="Inventory" active={page==="inventory"} onClick={onInventory} />
      {/* Center scan button — raised and emphasized */}
      <button onClick={onScan} aria-label="Scan a code" style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        gap: 3, background: "none", border: "none", cursor: "pointer", padding: "7px 2px",
        WebkitTapHighlightColor: "transparent",
      }}>
        <span className="mobnav-ico" style={{
          width: 48, height: 48, borderRadius: "50%", marginTop: -20, color: "#1a1208",
          background: "linear-gradient(135deg,#C9A23A 0%,#E6C65C 100%)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 3px 10px rgba(0,0,0,.4)", border: "3px solid #15121b",
        }}><span style={{ width: 22, height: 22, display: "inline-flex" }}>{Ic.search}</span></span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#E6C65C", marginTop: -1 }}>Scan</span>
      </button>
      <Item icon={Ic.plus} label="Add" active={false} onClick={onAdd} />
      <Item icon={Ic.menu} label="More" active={false} onClick={onMore} />
    </nav>
  );
}
