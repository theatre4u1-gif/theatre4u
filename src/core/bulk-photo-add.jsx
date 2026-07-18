// Bulk photo add — pick many photos (Google Drive or device); each becomes a draft item.
// Edit name/category/qty in a grid, then save them all at once.
import React, { useState, useRef } from "react";
import { SB } from "./supabase.js";
import { Modal } from "./ui.jsx";
import { uid } from "./helpers.js";
import { uploadPhoto, CameraCapture } from "./items.jsx";

export function BulkPhotoAdd({ userId, vertical = "theatre", cats = [], onClose, onImport }) {
  const defaultCat = cats[0]?.id || "costumes";
  const [rows, setRows] = useState([]); // {key, name, category, qty, img, uploading}
  const [saving, setSaving] = useState(false);
  const [showCam, setShowCam] = useState(false);
  const fileRef = useRef();

  const baseName = (fn) =>
    (fn || "Photo").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Photo";

  const addFile = async (file) => {
    if (!file) return;
    const key = uid();
    setRows((p) => [...p, { key, name: baseName(file.name), category: defaultCat, qty: 1, img: null, uploading: true }]);
    const url = userId ? await uploadPhoto(file, userId) : null;
    setRows((p) => p.map((r) => (r.key === key ? { ...r, img: url, uploading: false } : r)));
  };

  const fromDevice = (e) => {
    Array.from(e.target.files || []).forEach(addFile);
    if (fileRef.current) fileRef.current.value = "";
  };
  const fromDrive = () => {
    if (window.t4uPickFromDrive) window.t4uPickFromDrive(addFile);
    else alert("Google Drive import isn't ready yet — please refresh the page and try again.");
  };

  const upd = (key, k, v) => setRows((p) => p.map((r) => (r.key === key ? { ...r, [k]: v } : r)));
  const remove = (key) => setRows((p) => p.filter((r) => r.key !== key));
  const anyUploading = rows.some((r) => r.uploading);

  const saveAll = async () => {
    const ready = rows.filter((r) => !r.uploading);
    if (!ready.length) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = ready.map((r) => ({
      id: uid(),
      org_id: userId,
      name: (r.name || "").trim() || "Untitled",
      category: r.category || defaultCat,
      condition: "Good",
      size: "N/A",
      qty: parseInt(r.qty) || 1,
      location: "",
      notes: "",
      mkt: "Not Listed",
      rent: 0, sale: 0, loan_period: 2, deposit: 0,
      avail: "In Stock",
      img: r.img || null,
      tags: [],
      vertical: vertical || "theatre",
      added: now,
    }));
    const { error } = await SB.from("items").insert(payload);
    setSaving(false);
    if (error) {
      console.error("Bulk insert failed", error);
      alert("Couldn't save the items. " + (error.message || "Please try again."));
      return;
    }
    const { data } = await SB.from("items").select("*").eq("org_id", userId).order("added", { ascending: false });
    if (data && onImport) onImport(data);
    onClose();
  };

  return (
    <Modal title="Bulk add from photos" onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          {rows.length > 0 && (
            <span style={{ marginRight: "auto", fontSize: 12, color: "var(--muted)" }}>
              {rows.length} photo{rows.length !== 1 ? "s" : ""}{anyUploading ? " · uploading…" : ""}
            </span>
          )}
          <button className="btn btn-o" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-g" onClick={saveAll} disabled={saving || anyUploading || rows.length === 0}>
            {saving ? "Saving…" : "Add " + (rows.length || "") + " item" + (rows.length !== 1 ? "s" : "")}
          </button>
        </div>
      }>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        Pick a batch of photos — each one becomes its own item. Then adjust the name, category, and quantity, and save them all at once.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-o" onClick={fromDrive}>📁 From Google Drive</button>
        <label className="btn btn-o" style={{ cursor: "pointer" }}>📷 From this device
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={fromDevice} />
        </label>
        <button type="button" className="btn btn-o" onClick={() => setShowCam(true)}>📸 Camera (snap a series)</button>
      </div>
      {showCam && <CameraCapture unlimited noun="items" max={99} current={rows.length} onCapture={async (file) => { await addFile(file); return true; }} onClose={() => setShowCam(false)} />}
      {rows.length === 0
        ? <div style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: 13 }}>No photos yet — add some above.</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <div key={r.key} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {r.uploading ? <span style={{ fontSize: 10, color: "var(--muted)" }}>…</span>
                    : (r.img ? <img src={r.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 18 }}>🖼</span>)}
                </div>
                <input className="fi" style={{ flex: 2, minWidth: 120 }} value={r.name} onChange={(e) => upd(r.key, "name", e.target.value)} placeholder="Item name" />
                <select className="fs" style={{ flex: 1, minWidth: 110 }} value={r.category} onChange={(e) => upd(r.key, "category", e.target.value)}>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
                <input className="fi" style={{ width: 56 }} type="number" min="1" step="1" value={r.qty} onChange={(e) => upd(r.key, "qty", parseInt(e.target.value) || 1)} title="Quantity" />
                <button type="button" className="ico-btn" aria-label="Remove photo" onClick={() => remove(r.key)} title="Remove">✕</button>
              </div>
            ))}
          </div>}
    </Modal>
  );
}
