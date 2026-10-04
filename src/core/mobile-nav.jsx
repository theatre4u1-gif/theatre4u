// mobile-nav.jsx — fixed bottom tab bar for the native app (IS_NATIVE_APP only).
// Five uniform tabs using the app's own icon set.
import React from "react";
import { Ic } from "./icons.jsx";

const Item = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} aria-label={label} style={{
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 4, background: "none", border: "none", cursor: "pointer", padding: "9px 2px",
    color: active ? "#E6C65C" : "rgba(255,255,255,.62)", WebkitTapHighlightColor: "transparent",
  }}>
    <span className="mobnav-ico" style={{ width: 23, height: 23, display: "inline-flex" }}>{icon}</span>
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
      <Item icon={Ic.search} label="Scan" active={false} onClick={onScan} />
      <Item icon={Ic.plus} label="Add" active={false} onClick={onAdd} />
      <Item icon={Ic.menu} label="More" active={false} onClick={onMore} />
    </nav>
  );
}
