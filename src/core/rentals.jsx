// RENTALS / CHECKOUT — build a rental order, scan or search items onto it, mark items
// returned individually (partial returns), add more over time, and print a rental sheet.
// Additive feature. Tables: rental_orders + rental_order_items (org-scoped RLS).
// Scanning: hardware scanner / typed code always works; live camera scan is a progressive
// enhancement using the browser BarcodeDetector where the device supports it.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SB } from "./supabase.js";
import { APP_NAME } from "./config.js";
import { doorUrl } from "./helpers.js";
import { UpgradePlans } from "./billing.jsx";
import { DEFAULT_RENTAL_TERMS as DEFAULT_TERMS, platformNotice } from "./agreements.js";

// Pull a code out of a scanned value. QR codes encode a URL like
// theatre4u.org/#/item/OVHS-PROP-042, so grab the segment after /item/.
export function codeFromScan(raw) {
  const s = (raw || "").trim();
  const m = s.match(/\/item\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : s;
}

// Default rental terms and the platform-protection notice live in agreements.js so
// Rental Checkout and Borrowed & Lent stay identical.

// ── Live camera scanner (progressive enhancement) ──────────────────────────────
export function CameraScanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState(false);
  const lastRef = useRef({ code: "", at: 0 });

  useEffect(() => {
    let active = true, raf = 0, detector = null;
    const stop = () => { const s = streamRef.current; if (s) { s.getTracks().forEach(t => t.stop()); streamRef.current = null; } if (raf) cancelAnimationFrame(raf); };
    (async () => {
      try {
        if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) { setErr(true); return; }
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        const v = videoRef.current;
        if (v) { v.srcObject = s; await v.play().catch(() => {}); }
        const tick = async () => {
          if (!active) return;
          try {
            if (v && v.videoWidth) {
              const codes = await detector.detect(v);
              if (codes && codes.length) {
                const raw = codes[0].rawValue || "";
                const now = Date.now();
                // ignore the same code re-detected within 1.5s (camera sees many frames)
                if (raw && !(raw === lastRef.current.code && now - lastRef.current.at < 1500)) {
                  lastRef.current = { code: raw, at: now };
                  onCode(raw);
                }
              }
            }
          } catch (_) {}
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) { setErr(true); }
    })();
    return () => { active = false; stop(); };
  }, [onCode]);

  const ov = { position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  if (err) return (
    <div style={ov} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 340, textAlign: "center", color: "var(--text)" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Camera scanning not available here</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>This device or browser does not support live QR scanning. You can still type or use a handheld scanner in the code box, or search by name.</div>
        <button className="btn btn-g btn-sm" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
  return (
    <div style={ov} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "min(520px,96vw)", background: "#0c0c0c", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", color: "#fff" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Point the camera at a QR label</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ position: "relative", background: "#000", aspectRatio: "4 / 3" }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", left: "12%", right: "12%", top: "18%", bottom: "18%", border: "2px solid rgba(212,168,67,.85)", borderRadius: 12, boxShadow: "0 0 0 100vmax rgba(0,0,0,.25)" }} />
        </div>
        <div style={{ padding: "12px 16px", textAlign: "center", color: "#bbb", fontSize: 12 }}>Each item is added the moment it scans. Tap × when you are done.</div>
      </div>
    </div>
  );
}

export function RentalsPage({ userId, org, plan = "free", items = [], onItemSync }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState("list");   // list | detail
  const [current, setCurrent] = useState(null);      // selected order
  const [lines, setLines]     = useState([]);        // items on the current order
  const [showNew, setShowNew] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [search, setSearch]   = useState("");
  const [browse, setBrowse]   = useState(false);     // browse-inventory picker modal
  const [browseQ, setBrowseQ] = useState("");
  const [rentalTerms, setRentalTerms] = useState("");  // subscriber's saved terms (empty = use default)
  const [showTerms, setShowTerms]     = useState(false);
  const [termsDraft, setTermsDraft]   = useState("");
  const [returnScan, setReturnScan]   = useState(false);  // camera scan-to-return mode
  const [showAmounts, setShowAmounts] = useState(false);
  const [amtDeposit, setAmtDeposit]   = useState("");
  const [amtTotal, setAmtTotal]       = useState("");
  const [filter, setFilter]   = useState("open");    // open | closed | all
  const [msg, setMsg]         = useState("");
  const flash = m => { setMsg(m); setTimeout(() => setMsg(""), 3200); };

  const isPro = plan !== "free";
  const blankOrder = { customer_name: "", customer_contact: "", date_out: new Date().toISOString().slice(0, 10), due_date: "", notes: "" };
  const [form, setForm] = useState(blankOrder);

  useEffect(() => {
    if (!userId || !isPro) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await SB.from("rental_orders").select("*").eq("org_id", userId).order("created_at", { ascending: false });
      setOrders(data || []);
      const { data: o } = await SB.from("orgs").select("rental_terms").eq("id", userId).maybeSingle();
      setRentalTerms((o && o.rental_terms) || "");
      setLoading(false);
    })();
  }, [userId, isPro]);

  const saveTerms = async () => {
    const t = termsDraft.trim();
    const { error } = await SB.from("orgs").update({ rental_terms: t || null }).eq("id", userId);
    if (error) { flash("❌ Could not save terms"); return; }
    setRentalTerms(t);
    setShowTerms(false);
    flash("✓ Rental terms saved");
  };

  const loadLines = useCallback(async (orderId) => {
    const { data } = await SB.from("rental_order_items").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
    setLines(data || []);
  }, []);

  const openOrder = async (o) => { setCurrent(o); setView("detail"); setCodeInput(""); setSearch(""); await loadLines(o.id); };

  const createOrder = async () => {
    if (!form.customer_name.trim()) { flash("❌ Add a customer or borrower name"); return; }
    const payload = {
      org_id: userId,
      customer_name: form.customer_name.trim(),
      customer_contact: form.customer_contact.trim() || null,
      date_out: form.date_out || null,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    const { data, error } = await SB.from("rental_orders").insert(payload).select().single();
    if (error || !data) { flash("❌ Could not create the order. Try again."); return; }
    setOrders(p => [data, ...p]);
    setShowNew(false); setForm(blankOrder);
    setLines([]);
    setCurrent(data); setView("detail");
  };

  // ── Simple inventory sync (one-of-a-kind). Only flips In Stock <-> Checked Out, so it
  // never clobbers a status the subscriber set by hand (In Use, Being Repaired, etc). ──
  const markItemOut = async (itemId) => {
    if (!itemId) return;
    const { data } = await SB.from("items").update({ avail: "Checked Out" }).eq("org_id", userId).eq("id", itemId).eq("avail", "In Stock").select("id");
    if (data && data.length && onItemSync) onItemSync(itemId, "Checked Out"); // keep the inventory list live
  };
  // Free an item back to In Stock, but only if it is not still out on another open order.
  const markItemInIfClear = async (itemId, excludeOrderId) => {
    if (!itemId) return;
    const { data: outLines } = await SB.from("rental_order_items").select("order_id").eq("org_id", userId).eq("item_id", itemId).eq("status", "out");
    const otherIds = [...new Set((outLines || []).map(x => x.order_id).filter(id => id !== excludeOrderId))];
    if (otherIds.length) {
      const { data: openOnes } = await SB.from("rental_orders").select("id").in("id", otherIds).neq("status", "closed");
      if (openOnes && openOnes.length) return; // still out on another open order — leave as Checked Out
    }
    // also held by an active lent-out loan? then leave it Checked Out
    const { data: loanRows } = await SB.from("external_loans").select("id").eq("org_id", userId).eq("item_ref", itemId).eq("direction", "out").eq("returned", false);
    if (loanRows && loanRows.length) return;
    const { data } = await SB.from("items").update({ avail: "In Stock" }).eq("org_id", userId).eq("id", itemId).eq("avail", "Checked Out").select("id");
    if (data && data.length && onItemSync) onItemSync(itemId, "In Stock");
  };

  const addLine = async (item) => {
    if (!current) return;
    const payload = {
      order_id: current.id, org_id: userId,
      item_id: item.id || null,
      item_name: item.name || "Item",
      item_display_id: item.display_id || null,
      qty: 1, status: "out",
    };
    const { data, error } = await SB.from("rental_order_items").insert(payload).select().single();
    if (error || !data) { flash("❌ Could not add item"); return; }
    setLines(p => [...p, data]);
    if (current.status !== "closed") markItemOut(payload.item_id);
    flash("✓ Added " + (item.name || "item"));
  };

  // Resolve a scanned or typed code to one of this org's items, then add it.
  const resolveAndAdd = async (raw) => {
    const c = codeFromScan(raw);
    if (!c) return;
    let it = null;
    const q1 = await SB.from("items").select("id,name,display_id").eq("org_id", userId).eq("id", c).limit(1);
    it = q1.data && q1.data[0];
    if (!it) {
      const q2 = await SB.from("items").select("id,name,display_id").eq("org_id", userId).ilike("display_id", c).limit(1);
      it = q2.data && q2.data[0];
    }
    if (!it) { flash("❌ No item found for " + c); return; }
    await addLine(it);
  };

  // Scan or type a code to mark a matching out item on this order as returned.
  const resolveAndReturn = async (raw) => {
    const c = codeFromScan(raw);
    if (!c) return;
    const lc = c.toLowerCase();
    let line = lines.find(l => l.status !== "returned" && ((l.item_display_id && l.item_display_id.toLowerCase() === lc) || (l.item_id && l.item_id === c)));
    if (!line) {
      let it = null;
      const q1 = await SB.from("items").select("id,display_id").eq("org_id", userId).eq("id", c).limit(1);
      it = q1.data && q1.data[0];
      if (!it) { const q2 = await SB.from("items").select("id,display_id").eq("org_id", userId).ilike("display_id", c).limit(1); it = q2.data && q2.data[0]; }
      if (it) line = lines.find(l => l.status !== "returned" && l.item_id === it.id);
    }
    if (!line) { flash("❌ No out item on this order matches " + c); return; }
    await setLineStatus(line, "returned");
    flash("✓ Returned " + (line.item_name || "item"));
  };

  const saveAmounts = async () => {
    const toCents = v => { const s = String(v).trim(); if (s === "") return null; const n = parseFloat(s); return isNaN(n) ? null : Math.round(n * 100); };
    const { data, error } = await SB.from("rental_orders").update({ deposit_cents: toCents(amtDeposit), total_cents: toCents(amtTotal), updated_at: new Date().toISOString() }).eq("id", current.id).select().single();
    if (error || !data) { flash("❌ Could not save amounts"); return; }
    setCurrent(data);
    setOrders(p => p.map(x => x.id === data.id ? data : x));
    setShowAmounts(false);
    flash("✓ Amounts saved");
  };

  const onCodeSubmit = async () => {
    const v = codeInput.trim();
    if (!v) return;
    setCodeInput("");
    await resolveAndAdd(v);
  };

  const setLineStatus = async (line, status) => {
    const patch = status === "returned" ? { status: "returned", returned_at: new Date().toISOString() } : { status: "out", returned_at: null };
    const { data, error } = await SB.from("rental_order_items").update(patch).eq("id", line.id).select().single();
    if (!error && data) {
      setLines(p => p.map(x => x.id === data.id ? data : x));
      if (status === "returned") markItemInIfClear(line.item_id, current.id);
      else if (current.status !== "closed") markItemOut(line.item_id); // undo → back out
    }
  };

  const returnAll = async () => {
    const out = lines.filter(l => l.status !== "returned");
    if (!out.length) return;
    const now = new Date().toISOString();
    await SB.from("rental_order_items").update({ status: "returned", returned_at: now }).eq("order_id", current.id).neq("status", "returned");
    setLines(p => p.map(l => l.status === "returned" ? l : { ...l, status: "returned", returned_at: now }));
    for (const id of [...new Set(out.map(l => l.item_id).filter(Boolean))]) await markItemInIfClear(id, current.id);
    flash("✓ All items marked returned");
  };

  const removeLine = async (line) => {
    await SB.from("rental_order_items").delete().eq("id", line.id);
    setLines(p => p.filter(x => x.id !== line.id));
    if (line.status !== "returned") markItemInIfClear(line.item_id, current.id);
  };

  const setOrderStatus = async (o, status) => {
    const { data, error } = await SB.from("rental_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", o.id).select().single();
    if (!error && data) {
      setOrders(p => p.map(x => x.id === data.id ? data : x));
      if (current && current.id === data.id) setCurrent(data);
      flash(status === "closed" ? "✓ Order closed" : "Order reopened");
    }
  };

  const deleteOrder = async (o) => {
    if (!confirm("Delete this rental order and its item list? This cannot be undone.")) return;
    const outIds = [...new Set(lines.filter(l => l.status !== "returned").map(l => l.item_id).filter(Boolean))];
    await SB.from("rental_orders").delete().eq("id", o.id);   // cascade removes its item lines
    for (const id of outIds) await markItemInIfClear(id, o.id);
    setOrders(p => p.filter(x => x.id !== o.id));
    setView("list"); setCurrent(null); setLines([]);
    flash("Deleted");
  };

  // Invite the customer/borrower to join, so they can see your inventory and request items.
  const inviteCustomer = () => {
    if (!current) return;
    const brand = APP_NAME.replace("™", "");
    const subject = encodeURIComponent("An invitation to " + brand);
    const body = encodeURIComponent(`Hi ${current.customer_name || "there"},\n\nWe use ${brand} to manage our inventory and rentals. If you create a free account, you can browse what we have available and request items more easily.\n\nYou can sign up here: ${doorUrl(org)}\n\nThank you,\n${org?.name || ""}`);
    const to = (current.customer_contact && current.customer_contact.includes("@")) ? current.customer_contact : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const printOrder = () => {
    if (!current) return;
    const esc = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const rows = lines.map((l, i) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd">${esc(l.item_name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd">${esc(l.item_display_id || "")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd">${l.qty || 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd">${l.status === "returned" ? "Returned" : "Out"}</td>
    </tr>`).join("");
    const outN = lines.filter(l => l.status !== "returned").length;
    const brand = APP_NAME.replace("™", "");
    const bizName = esc(org?.name || brand);
    const bizContact = [org?.email, org?.phone, org?.location].filter(Boolean).map(esc).join(" &middot; ");
    const termsText = esc(rentalTerms || DEFAULT_TERMS).replace(/\n/g, "<br>");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rental Agreement</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;color:#1a0f00;max-width:720px;margin:24px auto;padding:0 16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d4a843;padding-bottom:10px;margin-bottom:16px">
          <div>
            <div style="font-size:22px;font-weight:700">${bizName}</div>
            ${bizContact ? `<div style="font-size:12px;color:#666;margin-top:2px">${bizContact}</div>` : ""}
            <div style="font-size:13px;font-weight:700;color:#8b6914;margin-top:6px">Rental Agreement</div>
          </div>
          <div style="text-align:right;font-size:12px;color:#666">Date ${new Date().toLocaleDateString()}</div>
        </div>
        <table style="width:100%;font-size:13px;margin-bottom:16px"><tr>
          <td style="padding:2px 0"><strong>Renter:</strong> ${esc(current.customer_name)}</td>
          <td style="padding:2px 0"><strong>Contact:</strong> ${esc(current.customer_contact || "")}</td></tr>
          <tr><td style="padding:2px 0"><strong>Date out:</strong> ${esc(current.date_out || "")}</td>
          <td style="padding:2px 0"><strong>Due back:</strong> ${esc(current.due_date || "")}</td></tr>
          ${(current.total_cents != null || current.deposit_cents != null) ? `<tr>
          <td style="padding:2px 0">${current.total_cents != null ? `<strong>Rental total:</strong> $${(current.total_cents / 100).toFixed(2)}` : ""}</td>
          <td style="padding:2px 0">${current.deposit_cents != null ? `<strong>Deposit:</strong> $${(current.deposit_cents / 100).toFixed(2)}` : ""}</td></tr>` : ""}
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f5f0e8">
            <th style="text-align:left;padding:6px 8px">#</th><th style="text-align:left;padding:6px 8px">Item</th>
            <th style="text-align:left;padding:6px 8px">ID</th><th style="text-align:left;padding:6px 8px">Qty</th>
            <th style="text-align:left;padding:6px 8px">Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="padding:10px;color:#999">No items yet</td></tr>'}</tbody>
        </table>
        <p style="font-size:13px;margin-top:12px"><strong>${lines.length}</strong> items total, <strong>${outN}</strong> currently out.</p>
        ${current.notes ? `<p style="font-size:12px;color:#555;margin-top:8px">Notes: ${esc(current.notes)}</p>` : ""}

        <div style="margin-top:20px;border-top:1px solid #eee;padding-top:14px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">Terms and Conditions</div>
          <div style="font-size:12px;color:#333;line-height:1.6">${termsText}</div>
        </div>

        <table style="width:100%;font-size:12px;margin-top:34px">
          <tr>
            <td style="width:50%;padding-right:20px">
              <div style="border-top:1px solid #333;padding-top:4px">Renter signature</div>
            </td>
            <td style="width:50%">
              <div style="border-top:1px solid #333;padding-top:4px">Date</div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:26px;padding-right:20px">
              <div style="border-top:1px solid #333;padding-top:4px">For ${bizName}</div>
            </td>
            <td style="padding-top:26px">
              <div style="border-top:1px solid #333;padding-top:4px">Date</div>
            </td>
          </tr>
        </table>

        <p style="font-size:10px;color:#999;margin-top:26px;border-top:1px solid #eee;padding-top:10px;line-height:1.6">
          ${platformNotice(bizName, brand)}
        </p>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { flash("❌ Allow pop-ups to print"); return; }
    w.document.write(html); w.document.close();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 300);
  };

  // ── styles (match house style) ──
  const card = { background: "var(--parch)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 12 };
  const lbl  = { fontSize: 10, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 };
  const inp  = { background: "var(--white)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
  const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 };

  const Flash = () => msg ? <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: msg.startsWith("❌") ? "var(--red)" : "var(--green)", boxShadow: "0 4px 20px rgba(0,0,0,.4)" }}>{msg}</div> : null;

  // ── Free plan gate ──
  if (!isPro) return (
    <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: "40px 16px" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>Rental Checkout</h2>
      <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 460, margin: "0 auto 24px", lineHeight: 1.6 }}>Rent your items to your own customers. Build a rental order, add items with your phone camera or by search, mark items returned as they come back, and print an agreement. This is separate from the Backstage Exchange. Upgrade to Pro to use Rental Checkout.</p>
      <UpgradePlans compact={true} userId={org?.id} userEmail={org?.email} />
    </div>
  );

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>Loading…</div>;

  // ── DETAIL VIEW ──
  if (view === "detail" && current) {
    const outN = lines.filter(l => l.status !== "returned").length;
    const retN = lines.length - outN;
    const matches = search.trim() ? (items || []).filter(it => {
      const q = search.toLowerCase();
      return (it.name || "").toLowerCase().includes(q) || (it.display_id || "").toLowerCase().includes(q);
    }).slice(0, 8) : [];
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Flash />
        {scanning && <CameraScanner onCode={resolveAndAdd} onClose={() => setScanning(false)} />}
        {returnScan && <CameraScanner onCode={resolveAndReturn} onClose={() => setReturnScan(false)} />}
        {showAmounts && (
          <div onClick={() => setShowAmounts(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 400 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 12 }}>Order amounts</h3>
              <div style={{ marginBottom: 10 }}><label style={lbl}>Rental total ($)</label><input style={inp} type="number" min="0" step="0.01" value={amtTotal} onChange={e => setAmtTotal(e.target.value)} placeholder="0.00" /></div>
              <div style={{ marginBottom: 12 }}><label style={lbl}>Deposit ($)</label><input style={inp} type="number" min="0" step="0.01" value={amtDeposit} onChange={e => setAmtDeposit(e.target.value)} placeholder="0.00" /></div>
              <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 12, lineHeight: 1.5 }}>Recorded for your agreement only. No payment is processed by the app.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowAmounts(false)} className="btn btn-o" style={{ fontSize: 13 }}>Cancel</button>
                <button onClick={saveAmounts} className="btn btn-g" style={{ fontSize: 13 }}>Save</button>
              </div>
            </div>
          </div>
        )}
        {browse && (
          <div onClick={() => setBrowse(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, width: "100%", maxWidth: 560, maxHeight: "86vh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18 }}>Add from inventory</h3>
                <button onClick={() => setBrowse(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)", lineHeight: 1 }}>×</button>
              </div>
              <input style={inp} value={browseQ} onChange={e => setBrowseQ(e.target.value)} placeholder="Filter by name, ID, or category" autoFocus />
              <div style={{ marginTop: 10, overflowY: "auto", flex: 1 }}>
                {(items || []).filter(it => { const q = browseQ.trim().toLowerCase(); return !q || (it.name || "").toLowerCase().includes(q) || (it.display_id || "").toLowerCase().includes(q) || (it.category || "").toLowerCase().includes(q); }).slice(0, 300).map(it => (
                  <div key={it.id} onClick={() => addLine(it)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>{[it.display_id, it.category, it.location].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="btn btn-g btn-sm" style={{ fontSize: 11, pointerEvents: "none" }}>＋ Add</span>
                  </div>
                ))}
                {(items || []).length === 0 && <div style={{ textAlign: "center", padding: 30, color: "var(--faint)", fontSize: 13 }}>No items in your inventory yet.</div>}
              </div>
              <div style={{ marginTop: 12, textAlign: "right" }}><button onClick={() => setBrowse(false)} className="btn btn-g" style={{ fontSize: 13 }}>Done</button></div>
            </div>
          </div>
        )}

        <button onClick={() => { setView("list"); setCurrent(null); }} className="btn btn-o btn-sm" style={{ fontSize: 12, marginBottom: 14 }}>← All orders</button>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>{current.customer_name}</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: current.status === "closed" ? "rgba(120,120,120,.15)" : "rgba(212,168,67,.15)", color: current.status === "closed" ? "var(--muted)" : "var(--gold)" }}>{current.status === "closed" ? "Closed" : "Open"}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--faint)" }}>{current.customer_contact ? current.customer_contact + " · " : ""}{current.date_out ? "Out " + current.date_out : ""}{current.due_date ? " · Due " + current.due_date : ""}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{lines.length} items · {outN} out · {retN} returned</div>
              {(current.total_cents != null || current.deposit_cents != null) && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{current.total_cents != null ? "Total $" + (current.total_cents / 100).toFixed(2) : ""}{current.total_cents != null && current.deposit_cents != null ? " · " : ""}{current.deposit_cents != null ? "Deposit $" + (current.deposit_cents / 100).toFixed(2) : ""}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={printOrder} className="btn btn-o btn-sm" style={{ fontSize: 11 }}>🖨 Print</button>
              <button onClick={() => { setAmtDeposit(current.deposit_cents != null ? (current.deposit_cents / 100).toString() : ""); setAmtTotal(current.total_cents != null ? (current.total_cents / 100).toString() : ""); setShowAmounts(true); }} className="btn btn-o btn-sm" style={{ fontSize: 11 }}>💵 Amounts</button>
              <button onClick={inviteCustomer} className="btn btn-o btn-sm" style={{ fontSize: 11 }}>✉️ Invite customer</button>
              {outN > 0 && <button onClick={() => setReturnScan(true)} className="btn btn-o btn-sm" style={{ fontSize: 11 }}>📷 Scan to return</button>}
              {outN > 0 && <button onClick={returnAll} className="btn btn-o btn-sm" style={{ fontSize: 11 }}>Return all</button>}
              {current.status === "closed"
                ? <button onClick={() => setOrderStatus(current, "open")} className="btn btn-o btn-sm" style={{ fontSize: 11 }}>Reopen</button>
                : <button onClick={() => setOrderStatus(current, "closed")} className="btn btn-g btn-sm" style={{ fontSize: 11 }}>Close order</button>}
              <button onClick={() => deleteOrder(current)} className="btn btn-o btn-sm" style={{ fontSize: 11, color: "var(--red)" }}>Delete</button>
            </div>
          </div>
        </div>

        {/* Add items */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={lbl}>Add items to this order</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={() => setScanning(true)} className="btn btn-g" style={{ fontSize: 13 }}>📷 Scan with camera</button>
            <button onClick={() => { setBrowse(true); setBrowseQ(""); }} className="btn btn-o" style={{ fontSize: 13 }}>📦 Browse inventory</button>
            <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 6 }}>
              <input style={inp} value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onCodeSubmit(); }} placeholder="Scan or type an item code, then Enter" />
              <button onClick={onCodeSubmit} className="btn btn-o btn-sm" style={{ fontSize: 12 }}>Add</button>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <input style={inp} value={search} onChange={e => setSearch(e.target.value)} placeholder="…or search your inventory by name" />
            {matches.length > 0 && (
              <div style={{ position: "absolute", zIndex: 20, left: 0, right: 0, background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, marginTop: 4, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}>
                {matches.map(it => (
                  <div key={it.id} onClick={() => { addLine(it); setSearch(""); }} style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{it.name}</span>{it.display_id ? <span style={{ color: "var(--faint)", marginLeft: 8, fontSize: 11 }}>{it.display_id}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 8, lineHeight: 1.5 }}>Tip: a handheld barcode scanner works too. Click the code box, scan, and it adds instantly. Camera scanning works on most phones.</div>
        </div>

        {/* Item lines */}
        {lines.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--faint)", fontSize: 14 }}>No items on this order yet. Scan or search above to add them.</div>
        ) : lines.map(l => (
          <div key={l.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, opacity: l.status === "returned" ? .65 : 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.item_name}{l.qty > 1 ? " ×" + l.qty : ""}</div>
              <div style={{ fontSize: 12, color: "var(--faint)" }}>{l.item_display_id || ""}{l.status === "returned" && l.returned_at ? " · returned " + l.returned_at.slice(0, 10) : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {l.status === "returned"
                ? <button onClick={() => setLineStatus(l, "out")} className="btn btn-o btn-sm" style={{ fontSize: 11 }}>Undo</button>
                : <button onClick={() => setLineStatus(l, "returned")} className="btn btn-g btn-sm" style={{ fontSize: 11 }}>Return</button>}
              <button onClick={() => removeLine(l)} className="btn btn-o btn-sm" style={{ fontSize: 11, color: "var(--red)" }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── LIST VIEW ──
  const today = new Date().toISOString().slice(0, 10);
  const shown = orders.filter(o => filter === "all" ? true : filter === "closed" ? o.status === "closed" : o.status !== "closed");
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Flash />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 4 }}>Rental Checkout</h2>
          <p style={{ color: "var(--faint)", fontSize: 13, maxWidth: 620, lineHeight: 1.5 }}>Rent your items to your own customers. Create a rental order, add items, mark them returned as they come back, and print an agreement. Great for renting many costumes and props at once. This is your own checkout, separate from the Backstage Exchange, and it does not use Stage Points.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => { setTermsDraft(rentalTerms || DEFAULT_TERMS); setShowTerms(true); }} className="btn btn-o" style={{ fontSize: 13 }}>📝 Edit rental terms</button>
          <button onClick={() => { setForm(blankOrder); setShowNew(true); }} className="btn btn-g" style={{ fontSize: 13 }}>＋ New rental order</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["open", "Open"], ["closed", "Closed"], ["all", "All"]].map(([t, l]) => (
          <button key={t} onClick={() => setFilter(t)} className={filter === t ? "btn btn-g btn-sm" : "btn btn-o btn-sm"} style={{ fontSize: 12 }}>{l}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--faint)", fontSize: 14 }}>No rental orders yet. Click "New rental order" to start one.</div>
      ) : shown.map(o => (
        <div key={o.id} onClick={() => openOrder(o)} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{o.customer_name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: o.status === "closed" ? "rgba(120,120,120,.15)" : "rgba(212,168,67,.15)", color: o.status === "closed" ? "var(--muted)" : "var(--gold)" }}>{o.status === "closed" ? "Closed" : "Open"}</span>
              {o.status !== "closed" && o.due_date && o.due_date < today && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(229,57,53,.15)", color: "var(--red)" }}>Overdue</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{o.date_out ? "Out " + o.date_out : ""}{o.due_date ? " · Due " + o.due_date : ""}</div>
          </div>
          <span style={{ color: "var(--faint)", fontSize: 18 }}>→</span>
        </div>
      ))}

      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, marginBottom: 14 }}>New rental order</h3>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Customer or borrower name</label>
              <input style={inp} value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="e.g. Carol Channing High School, or Jane Smith" autoFocus />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Their email or phone (optional)</label>
              <input style={inp} value={form.customer_contact} onChange={e => setForm(f => ({ ...f, customer_contact: e.target.value }))} placeholder="name@example.com" />
            </div>
            <div style={row2}>
              <div><label style={lbl}>Date out</label><input style={inp} type="date" value={form.date_out} onChange={e => setForm(f => ({ ...f, date_out: e.target.value }))} /></div>
              <div><label style={lbl}>Due back</label><input style={inp} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Notes (optional)</label>
              <textarea style={{ ...inp, minHeight: 56, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Deposit, show name, anything to remember" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNew(false)} className="btn btn-o" style={{ fontSize: 13 }}>Cancel</button>
              <button onClick={createOrder} className="btn btn-g" style={{ fontSize: 13 }}>Create order</button>
            </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div onClick={() => setShowTerms(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, marginBottom: 6 }}>Rental terms</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>These print on your rental agreement, below the item list. Edit them to fit your shop. A short notice that {APP_NAME.replace("™", "")} is only the software provider, and not a party to your rental, is always added at the bottom to protect both of us.</p>
            <textarea style={{ ...inp, minHeight: 220, resize: "vertical", lineHeight: 1.5 }} value={termsDraft} onChange={e => setTermsDraft(e.target.value)} />
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => setTermsDraft(DEFAULT_TERMS)} className="btn btn-o btn-sm" style={{ fontSize: 12 }}>Reset to default</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowTerms(false)} className="btn btn-o" style={{ fontSize: 13 }}>Cancel</button>
                <button onClick={saveTerms} className="btn btn-g" style={{ fontSize: 13 }}>Save terms</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
