// BinTrove Home (dashboard) — shown for home accounts instead of the theatre Dashboard.
// Separate file; the school Dashboard is never touched. Home-branded, no theatre imagery/terms.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { getCat } from "../lib/verticals.js";

const TEAL = "#0F6E6B", TEAL_D = "#0A5450", GOLD = "#D3A13C", INK = "#163230", CREAM = "#FBF4E6", LINE = "#e7e2d7", MUT = "#5d706d";

export function BinTroveHome({ items = [], org, goInventory }) {
  const [bins, setBins] = useState(null);
  const orgId = org?.id;
  const firstName = (org?.director_name || "").trim().split(" ")[0] || "";

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const b = await SB.from("storage_locations").select("*", { count: "exact", head: true }).eq("org_id", orgId);
        if (live) setBins(b.count ?? 0);
      } catch (e) { if (live) setBins(0); }
    })();
    return () => { live = false; };
  }, [orgId]);

  const recent = (items || []).slice(0, 8);
  const wrap = { maxWidth: 920, margin: "0 auto", padding: "6px 4px 44px", color: INK, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" };
  const card = { background: "#fff", border: "1px solid " + LINE, borderRadius: 16, padding: 20 };

  const stat = (val, label, ico) => (
    <div style={{ ...card, flex: 1, minWidth: 140, textAlign: "center" }}>
      <div style={{ fontSize: 24 }}>{ico}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: TEAL, lineHeight: 1.1, margin: "4px 0 2px" }}>{val}</div>
      <div style={{ fontSize: 13, color: MUT, fontWeight: 600 }}>{label}</div>
    </div>
  );
  const action = (label, ico, onClick) => (
    <button onClick={onClick} style={{ flex: 1, minWidth: 150, background: "#fff", border: "1.5px solid " + LINE, borderRadius: 14, padding: "16px 12px", cursor: "pointer", textAlign: "center", fontWeight: 700, color: INK }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>{ico}</div>{label}
    </button>
  );

  return (
    <div style={wrap}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg," + TEAL + "," + TEAL_D + ")", borderRadius: 18, padding: "26px 24px", color: "#fff", marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: .4, color: "#bfe3dd" }}>🏠 BINTROVE</div>
        <h1 style={{ fontSize: "clamp(22px,4vw,30px)", margin: "6px 0 4px" }}>{firstName ? "Welcome back, " + firstName + "." : "Welcome to BinTrove."}</h1>
        <p style={{ margin: 0, color: "#d6ece8", fontSize: 15 }}>Find what's in every bin — without opening a single one.</p>
        <button onClick={() => goInventory && goInventory()} style={{ marginTop: 16, background: GOLD, color: INK, border: "none", padding: "11px 20px", borderRadius: 11, fontWeight: 800, cursor: "pointer" }}>Find something →</button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        {stat(bins == null ? "…" : bins, "Bins", "📦")}
        {stat((items || []).length, "Items", "🏷️")}
        {stat((items || []).filter(i => i && i.image).length, "With photos", "📷")}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        {action("Add a bin", "➕", () => goInventory && goInventory())}
        {action("Add an item", "🏷️", () => goInventory && goInventory())}
        {action("Browse my bins", "🔎", () => goInventory && goInventory())}
      </div>

      {/* Recent */}
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Recently added</div>
        {recent.length === 0 ? (
          <div style={{ color: MUT, fontSize: 15, lineHeight: 1.5 }}>
            Nothing here yet. Create your first bin, snap a photo of what's inside, and stick on a QR label — then you'll be able to find anything in seconds.
            <div style={{ marginTop: 12 }}>
              <button onClick={() => goInventory && goInventory()} style={{ background: TEAL, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Add your first bin →</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
            {recent.map((it, i) => {
              const c = getCat("home", it.category);
              return (
                <div key={it.id || i} style={{ border: "1px solid " + LINE, borderRadius: 11, padding: "11px 13px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name || "Untitled"}</div>
                  <div style={{ fontSize: 12.5, color: MUT, marginTop: 3 }}>{c ? c.icon + " " + c.label : "📦 Item"}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
