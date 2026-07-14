// Per-program support console (Phase 8 admin app). Opened from the Overview → programs drill-down.
// Goal: give the admin safe tools to help a program — see their account + usage, fix common fields,
// grant/remove access, lock, and (recoverably) close. Guardrails: edits limited to safe support
// fields, close is a 30-day recoverable soft-close via the close-org edge function (no hard delete
// here), private message content is never shown, and every change is written to audit_log.
import React, { useState, useEffect } from "react";
import { SB, callEdgeFn } from "./supabase.js";

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtWhen = (iso) => iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const audit = (action, orgId, detail) => { try { SB.from("audit_log").insert({ action, org_id: orgId, detail }); } catch (e) { /* non-blocking */ } };

const box = { background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: 18, marginBottom: 16 };
const h3 = { margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#2a2a2a" };
const lab = { display: "block", fontSize: 11, fontWeight: 700, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 };
const inp = { width: "100%", padding: "8px 11px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
const btn = (bg, dis) => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: 700, fontSize: 13, cursor: dis ? "default" : "pointer", fontFamily: "inherit", opacity: dis ? .6 : 1 });
const factRow = (k, v) => (<div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid #f4f0e8", fontSize: 13 }}><span style={{ color: "#8a8272" }}>{k}</span><span style={{ color: "#333", fontWeight: 600, textAlign: "right" }}>{v}</span></div>);

const EDIT_FIELDS = [
  { key: "name", label: "Program name" },
  { key: "email", label: "Contact email" },
  { key: "director_name", label: "Director name" },
  { key: "location", label: "Location" },
  { key: "phone", label: "Phone" },
];

export function ProgramDetail({ org: seed, onBack, onChanged }) {
  const [org, setOrg] = useState(null);
  const [usage, setUsage] = useState(null);
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [closeConfirm, setCloseConfirm] = useState("");
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: full } = await SB.from("orgs").select("*").eq("id", seed.id).maybeSingle();
      if (!alive) return;
      const o = full || seed;
      setOrg(o);
      setEdit(EDIT_FIELDS.reduce((a, f) => (a[f.key] = o[f.key] || "", a), {}));
      SB.from("org_platform_usage").select("*").eq("org_id", seed.id).maybeSingle().then(({ data }) => alive && setUsage(data || {}));
      SB.from("items").select("name,category,condition,created_at").eq("org_id", seed.id).order("created_at", { ascending: false }).limit(15)
        .then(({ data, error }) => { if (alive) setItems(error ? [] : (data || [])); });
    })();
    return () => { alive = false; };
  }, [seed.id]);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };
  const patch = (fields, action, detail) => {
    setOrg(o => ({ ...o, ...fields }));
    onChanged && onChanged(seed.id, fields);
    audit(action, seed.id, detail);
  };

  const saveEdits = async () => {
    setBusy("save");
    const changed = {}; EDIT_FIELDS.forEach(f => { if ((edit[f.key] || "") !== (org[f.key] || "")) changed[f.key] = edit[f.key] || null; });
    if (!Object.keys(changed).length) { setBusy(""); flash("No changes to save"); return; }
    const { error } = await SB.from("orgs").update(changed).eq("id", seed.id);
    setBusy("");
    if (error) { flash("Error: " + error.message); return; }
    patch(changed, "admin_edit_org", "Edited: " + Object.keys(changed).join(", "));
    flash("✓ Saved");
  };

  const toggle = async (field, onNote, offNote) => {
    const next = !org[field];
    setBusy(field);
    const extra = field === "temp_pro" ? { temp_pro_granted_at: next ? new Date().toISOString() : null, temp_pro_note: next ? "Granted via support console" : "Removed via support console" } : {};
    const { error } = await SB.from("orgs").update({ [field]: next, ...extra }).eq("id", seed.id);
    setBusy("");
    if (error) { flash("Error: " + error.message); return; }
    patch({ [field]: next, ...extra }, "admin_" + field, next ? onNote : offNote);
    flash("✓ " + (next ? onNote : offNote));
  };

  const closeAccount = async () => {
    if (closeConfirm !== "CLOSE") { flash("Type CLOSE to confirm"); return; }
    setBusy("close");
    const { data: { session } } = await SB.auth.getSession();
    const result = await callEdgeFn("close-org", { org_id: seed.id, reason: "Closed via admin support console", action: "close", is_admin_action: true }, session?.access_token);
    setBusy("");
    if (result?.success) { patch({ account_status: "closed" }, "admin_close_org", "Soft-closed (30-day recoverable)"); setCloseConfirm(""); flash("✓ Account closed — recoverable for 30 days"); }
    else { flash("Close failed: " + (result?.error || "check logs")); }
  };

  if (!org) return <div style={{ padding: 24, color: "#888" }}>Loading program…</div>;
  if (viewing) return <ViewAsProgram orgId={seed.id} orgName={org.name} onBack={() => setViewing(false)} />;

  const planTxt = org.stripe_subscription_id ? "Paying" : org.founding_member ? "Founding member" : org.temp_pro ? "Beta (free Pro)" : (org.plan || "free");
  const U = usage || {};

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <button onClick={onBack} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d5cfc4", background: "#fff", color: "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>← Back to list</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#2a2a2a", margin: 0 }}>{org.name || "(no name)"}</h2>
        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#fff", background: org.stripe_subscription_id ? "#1a7f37" : org.founding_member ? "#c4922a" : org.temp_pro ? "#b06fc9" : "#8a8272" }}>{planTxt}</span>
        {org.account_status === "closed" && <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#fff", background: "#c0392b" }}>Closed</span>}
        {org.account_locked && <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#fff", background: "#8a5a00" }}>🔒 Locked</span>}
      </div>
      {msg && <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 13, color: msg.startsWith("Error") || msg.includes("failed") ? "#c0392b" : "#1a7f37" }}>{msg}</div>}

      <button onClick={() => { audit("admin_view_as", seed.id, "Opened read-only data view"); setViewing(true); }}
        style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #c4922a", background: "rgba(212,168,67,.12)", color: "#a5731f", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>
        👁 View their data (read-only) →
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, alignItems: "start" }}>
        {/* Account facts */}
        <div style={box}>
          <h3 style={h3}>Account</h3>
          {factRow("Email", org.email || "—")}
          {factRow("Location", org.location || org.city || "—")}
          {factRow("Plan", org.plan || "free")}
          {factRow("Joined", fmtDate(org.created_at))}
          {factRow("Last seen", fmtWhen(org.last_seen))}
          {factRow("Subscription", org.subscription_status || (org.stripe_subscription_id ? "active" : "—"))}
          {org.plan_expires_at && factRow("Plan expires", fmtDate(org.plan_expires_at))}
          {org.beta_end_date && factRow("Beta ends", fmtDate(org.beta_end_date))}
          {org.founding_member && factRow("Founding since", fmtDate(org.founding_member_at))}
        </div>

        {/* Usage snapshot — what they're experiencing */}
        <div style={box}>
          <h3 style={h3}>Usage</h3>
          {!usage ? <div style={{ color: "#9a9284", fontSize: 13 }}>Loading…</div> : <>
            {factRow("Inventory items", U.total_items ?? 0)}
            {factRow("Items with photos", U.items_with_photos ?? 0)}
            {factRow("Productions", U.productions_tracked ?? 0)}
            {factRow("Exchanges completed", U.exchanges_completed ?? 0)}
            {factRow("Community posts", U.community_posts ?? 0)}
            {factRow("Requests sent / received", (U.requests_sent ?? 0) + " / " + (U.requests_received ?? 0))}
            {factRow("Last item added", fmtDate(U.last_item_added))}
          </>}
        </div>
      </div>

      {/* Read-only inventory peek */}
      <div style={box}>
        <h3 style={h3}>Recent inventory <span style={{ fontWeight: 500, color: "#9a9284", fontSize: 12 }}>(read-only — what they see)</span></h3>
        {items === null ? <div style={{ color: "#9a9284", fontSize: 13 }}>Loading…</div>
          : items.length === 0 ? <div style={{ color: "#9a9284", fontSize: 13 }}>No items to show.</div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
              {items.map((it, i) => <div key={i} style={{ border: "1px solid #eee6d9", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}><div style={{ fontWeight: 700, color: "#333" }}>{it.name}</div><div style={{ fontSize: 11.5, color: "#9a9284" }}>{it.category || "—"}{it.condition ? " · " + it.condition : ""}</div></div>)}
            </div>}
      </div>

      {/* Edit safe support fields */}
      <div style={box}>
        <h3 style={h3}>Edit details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 12 }}>
          {EDIT_FIELDS.map(f => (
            <div key={f.key}><label style={lab}>{f.label}</label><input style={inp} value={edit[f.key] || ""} onChange={e => setEdit(p => ({ ...p, [f.key]: e.target.value }))} /></div>
          ))}
        </div>
        <button onClick={saveEdits} disabled={busy === "save"} style={btn("#1a7f37", busy === "save")}>{busy === "save" ? "Saving…" : "Save changes"}</button>
      </div>

      {/* Support actions */}
      <div style={box}>
        <h3 style={h3}>Support actions</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          {!org.stripe_subscription_id && !org.founding_member && (
            <button onClick={() => toggle("temp_pro", "Beta Pro granted", "Beta Pro removed")} disabled={busy === "temp_pro"}
              style={{ padding: "9px 15px", borderRadius: 8, border: "1px solid " + (org.temp_pro ? "#c4922a" : "#d5cfc4"), background: org.temp_pro ? "rgba(212,168,67,.12)" : "#fff", color: org.temp_pro ? "#a5731f" : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {org.temp_pro ? "⭐ Beta Pro on — remove" : "Grant Beta Pro"}
            </button>
          )}
          <button onClick={() => toggle("account_locked", "Account locked", "Account unlocked")} disabled={busy === "account_locked"}
            style={{ padding: "9px 15px", borderRadius: 8, border: "1px solid " + (org.account_locked ? "#8a5a00" : "#d5cfc4"), background: org.account_locked ? "rgba(138,90,0,.1)" : "#fff", color: org.account_locked ? "#8a5a00" : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {org.account_locked ? "🔒 Locked — unlock" : "Lock account"}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "#9a9284" }}>Locking blocks sign-in while you investigate; unlocking restores it. Every action here is logged.</div>
      </div>

      {/* View-as entry lives near the top; nothing else here */}

      {/* Danger zone — recoverable close only */}
      {org.account_status !== "closed" && (
        <div style={{ ...box, border: "1px solid #e6b8b8", background: "#fdf6f6" }}>
          <h3 style={{ ...h3, color: "#a5342b" }}>Close account</h3>
          <div style={{ fontSize: 13, color: "#7a5a56", marginBottom: 10, lineHeight: 1.5 }}>Soft-close is <strong>recoverable for 30 days</strong> before permanent deletion. Use this if a program asks to close or for cleanup. (Permanent hard-delete lives in the in-app admin, on purpose.)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={closeConfirm} onChange={e => setCloseConfirm(e.target.value)} placeholder="Type CLOSE to confirm" style={{ ...inp, width: 220 }} />
            <button onClick={closeAccount} disabled={busy === "close"} style={btn("#c0392b", busy === "close")}>{busy === "close" ? "Closing…" : "Close account"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Read-only "View as" — see a program's own data to troubleshoot, without logging in as them.
// Everything is read-only; opening it is audited by the caller. Queries degrade gracefully if a
// table isn't admin-readable. Private messages/conversations are intentionally never shown.
const firstOf = (o, keys) => { for (const k of keys) { if (o[k]) return o[k]; } return null; };

export function ViewAsProgram({ orgId, orgName, onBack }) {
  const [tab, setTab] = useState("inventory");
  const [items, setItems] = useState(null);
  const [prods, setProds] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    SB.from("items").select("name,category,condition,created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (alive) setItems(error ? [] : (data || [])); });
    SB.from("productions").select("*").eq("org_id", orgId).limit(300)
      .then(({ data, error }) => { if (alive) setProds(error ? [] : (data || [])); });
    return () => { alive = false; };
  }, [orgId]);

  const tabBtn = (id, label, n) => (
    <button onClick={() => setTab(id)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + (tab === id ? "#c4922a" : "#dcd6cc"), background: tab === id ? "#c4922a" : "#fff", color: tab === id ? "#fff" : "#555", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>{label}{n != null ? " (" + n + ")" : ""}</button>
  );
  const filteredItems = (items || []).filter(it => ((it.name || "") + " " + (it.category || "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <button onClick={onBack} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #d5cfc4", background: "#fff", color: "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>← Back to support console</button>
      <div style={{ background: "#fff8e8", border: "1px solid #e8cf95", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#8a6a1f", fontWeight: 600 }}>
        👁 Read-only view of <strong>{orgName || "this program"}</strong>'s data — for support. You can look, not change. This view was logged.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabBtn("inventory", "Inventory", items ? items.length : null)}
        {tabBtn("productions", "Productions", prods ? prods.length : null)}
      </div>

      {tab === "inventory" && (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search items…" style={{ ...inp, maxWidth: 340, marginBottom: 12 }} />
          {items === null ? <div style={{ color: "#9a9284", fontSize: 13 }}>Loading…</div>
            : items.length === 0 ? <div style={{ color: "#9a9284", fontSize: 13 }}>No inventory items (or not readable).</div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                {filteredItems.map((it, i) => <div key={i} style={{ border: "1px solid #eee6d9", borderRadius: 8, padding: "9px 11px", background: "#fff" }}><div style={{ fontWeight: 700, color: "#333", fontSize: 13 }}>{it.name}</div><div style={{ fontSize: 11.5, color: "#9a9284" }}>{it.category || "—"}{it.condition ? " · " + it.condition : ""}</div></div>)}
              </div>}
        </>
      )}

      {tab === "productions" && (
        prods === null ? <div style={{ color: "#9a9284", fontSize: 13 }}>Loading…</div>
          : prods.length === 0 ? <div style={{ color: "#9a9284", fontSize: 13 }}>No productions (or not readable).</div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
              {prods.map((p, i) => {
                const name = firstOf(p, ["name", "title", "show_name"]) || "(untitled)";
                const when = firstOf(p, ["opening_date", "show_date", "event_date", "created_at"]);
                return <div key={i} style={{ border: "1px solid #eee6d9", borderRadius: 10, padding: "12px 14px", background: "#fff" }}><div style={{ fontWeight: 700, color: "#333" }}>{name}</div>{when && <div style={{ fontSize: 12, color: "#9a9284", marginTop: 3 }}>{fmtDate(when)}</div>}</div>;
              })}
            </div>
      )}
      <div style={{ height: 30 }} />
    </div>
  );
}
