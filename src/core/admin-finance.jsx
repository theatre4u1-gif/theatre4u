// Business Finance module (Phase 8 admin app). Bookkeeping for Artstracker LLC — income & expenses,
// a simple P&L, and one-click import of Stripe revenue as income. Distinct from the per-program
// Funding Tracker. Backed by business_ledger (admin-only). Amounts stored in cents.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";

const fmt = (c) => (c < 0 ? "-$" : "$") + (Math.abs(c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const ym = (d) => String(d).slice(0, 7);
const INCOME_CATS = ["Subscriptions", "Label sales", "Donations", "Grants", "Other income"];
const EXPENSE_CATS = ["Software / SaaS", "Hosting", "Printing & fulfillment", "Marketing", "Payment fees", "Supplies", "Contractors", "Legal / filing", "Other expense"];

const S = {
  card: { background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: "16px 18px" },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" },
  th: { textAlign: "left", fontSize: 11, fontWeight: 800, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, padding: "8px 10px", borderBottom: "1px solid #e6e0d6" },
  td: { fontSize: 13, color: "#3a3a3a", padding: "9px 10px", borderBottom: "1px solid #f0ece3" },
  btn: (bg, dis) => ({ padding: "8px 15px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: 700, fontSize: 13, cursor: dis ? "default" : "pointer", fontFamily: "inherit", opacity: dis ? .6 : 1 }),
};

function Stat({ label, value, accent, sub }) {
  return (
    <div style={S.card}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8a8272", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent || "#2a2a2a", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9a9284", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export function BusinessFinance({ userId }) {
  const [rows, setRows] = useState(null);
  const [stripeRev, setStripeRev] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), type: "expense", category: "", amount: "", note: "" });

  const load = async () => {
    const [{ data: l, error }, { data: r }] = await Promise.all([
      SB.from("business_ledger").select("*").order("entry_date", { ascending: false }),
      SB.from("stripe_revenue_summary").select("month,revenue_cents,refunded_cents"),
    ]);
    if (error) { setErr(error.message); return; }
    setRows(l || []);
    setStripeRev(r || []);
  };
  useEffect(() => { load(); }, []);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const addEntry = async () => {
    const cents = Math.round(parseFloat(form.amount) * 100);
    if (!cents || isNaN(cents) || cents <= 0) { flash("Enter an amount greater than 0"); return; }
    setBusy(true);
    const { error } = await SB.from("business_ledger").insert({
      entry_date: form.entry_date, type: form.type, category: form.category || null,
      amount_cents: cents, note: form.note || null, source: "manual", created_by: userId || null,
    });
    setBusy(false);
    if (error) { flash("Error: " + error.message); return; }
    setForm(f => ({ ...f, amount: "", note: "" }));
    flash("✓ Entry added");
    load();
  };

  const del = async (id) => {
    const { error } = await SB.from("business_ledger").delete().eq("id", id);
    if (error) { flash("Error: " + error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const importStripe = async () => {
    const have = new Set((rows || []).filter(r => r.source === "stripe").map(r => ym(r.entry_date)));
    const toAdd = stripeRev
      .map(r => ({ m: ym(r.month), date: String(r.month).slice(0, 10), net: (r.revenue_cents || 0) - (r.refunded_cents || 0) }))
      .filter(r => r.net > 0 && !have.has(r.m))
      .map(r => ({ entry_date: r.date, type: "income", category: "Subscriptions", amount_cents: r.net, note: "Stripe revenue (auto-imported)", source: "stripe", created_by: userId || null }));
    if (!toAdd.length) { flash("Stripe revenue is already up to date"); return; }
    setBusy(true);
    const { error } = await SB.from("business_ledger").insert(toAdd);
    setBusy(false);
    if (error) { flash("Error: " + error.message); return; }
    flash("✓ Imported " + toAdd.length + " month" + (toAdd.length === 1 ? "" : "s") + " of Stripe revenue");
    load();
  };

  const exportCsv = () => {
    const head = ["Date", "Type", "Category", "Amount", "Note", "Source"];
    const body = (rows || []).map(r => [r.entry_date, r.type, r.category || "", (r.amount_cents / 100).toFixed(2), r.note || "", r.source || ""]);
    const csv = [head, ...body].map(a => a.map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "business-ledger.csv"; a.click(); URL.revokeObjectURL(url);
  };

  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load finance: {err}</div>;
  if (!rows) return <div style={{ padding: 24, color: "#888" }}>Loading finance…</div>;

  const thisMonth = ym(new Date().toISOString());
  const sum = (pred) => rows.filter(pred).reduce((a, r) => a + (r.amount_cents || 0), 0);
  const income = sum(r => r.type === "income");
  const expense = sum(r => r.type === "expense");
  const net = income - expense;
  const mIncome = sum(r => r.type === "income" && ym(r.entry_date) === thisMonth);
  const mExpense = sum(r => r.type === "expense" && ym(r.entry_date) === thisMonth);
  const stripeNetAll = stripeRev.reduce((a, r) => a + ((r.revenue_cents || 0) - (r.refunded_cents || 0)), 0);

  // expense breakdown by category
  const byCat = {};
  rows.filter(r => r.type === "expense").forEach(r => { const k = r.category || "Uncategorized"; byCat[k] = (byCat[k] || 0) + (r.amount_cents || 0); });
  const cats = Object.entries(byCat).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const maxCat = Math.max(1, ...cats.map(c => c.v));

  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 };
  const H = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: "26px 0 12px" }}>{children}</h3>;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 4px" }}>Bookkeeping for the business (Artstracker LLC) — separate from programs' own Funding Tracker.</p>
      {msg && <div style={{ marginTop: 8, fontWeight: 700, fontSize: 13, color: msg.startsWith("Error") ? "#c0392b" : "#1a7f37" }}>{msg}</div>}

      <H>Profit &amp; loss</H>
      <div style={grid}>
        <Stat label="Net (all-time)" value={fmt(net)} accent={net >= 0 ? "#1a7f37" : "#c0392b"} sub="income − expenses" />
        <Stat label="Income (all-time)" value={fmt(income)} accent="#1a7f37" />
        <Stat label="Expenses (all-time)" value={fmt(expense)} accent="#c07a00" />
        <Stat label="This month" value={fmt(mIncome - mExpense)} accent={(mIncome - mExpense) >= 0 ? "#1a7f37" : "#c0392b"} sub={fmt(mIncome) + " in · " + fmt(mExpense) + " out"} />
      </div>

      <H>Add an entry</H>
      <div style={S.card}>
        <div style={{ display: "grid", gridTemplateColumns: "130px 120px 1fr 130px", gap: 10, alignItems: "end", marginBottom: 10 }}>
          <div><label style={S.label}>Date</label><input type="date" style={S.input} value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} /></div>
          <div><label style={S.label}>Type</label>
            <select style={S.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, category: "" }))}>
              <option value="expense">Expense</option><option value="income">Income</option>
            </select>
          </div>
          <div><label style={S.label}>Category</label>
            <input style={S.input} list="fin-cats" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Software / SaaS" />
            <datalist id="fin-cats">{(form.type === "income" ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div><label style={S.label}>Amount ($)</label><input type="number" step="0.01" min="0" style={S.input} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}><label style={S.label}>Note (optional)</label><input style={S.input} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="What was this for?" /></div>
          <button onClick={addEntry} disabled={busy} style={S.btn("#1a7f37", busy)}>Add entry</button>
        </div>
      </div>

      <H>Stripe revenue</H>
      <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(stripeNetAll)}</div><div style={{ fontSize: 12, color: "#9a9284" }}>net Stripe revenue on record (all months)</div></div>
        <button onClick={importStripe} disabled={busy} style={S.btn("#c4922a", busy)}>⭳ Import Stripe revenue as income</button>
      </div>
      <div style={{ fontSize: 11.5, color: "#9a9284", marginTop: 6 }}>Adds one income entry per month not already imported (won't double-count). Billing begins Sept 1, so this stays near $0 until then.</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 12px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: 0 }}>Entries ({rows.length})</h3>
        <button onClick={exportCsv} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 8, border: "1px solid #1a7f37", background: "#fff", color: "#1a7f37", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⭳ Export CSV</button>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead><tr><th style={S.th}>Date</th><th style={S.th}>Category</th><th style={S.th}>Note</th><th style={{ ...S.th, textAlign: "right" }}>Amount</th><th style={S.th}></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td style={S.td} colSpan={5}>No entries yet — add your first above, or import Stripe revenue.</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td style={S.td}>{fmtDate(r.entry_date)}</td>
                <td style={S.td}>{r.category || "—"}{r.source === "stripe" && <span style={{ fontSize: 10, color: "#a5731f", fontWeight: 700 }}> · auto</span>}</td>
                <td style={S.td}>{r.note || ""}</td>
                <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: r.type === "income" ? "#1a7f37" : "#c0392b" }}>{r.type === "income" ? "+" : "−"}{fmt(r.amount_cents).replace("-", "")}</td>
                <td style={{ ...S.td, textAlign: "right" }}><button onClick={() => del(r.id)} title="Delete" style={{ border: "1px solid #e2b6b6", background: "#fff", color: "#c0392b", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontFamily: "inherit" }}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cats.length > 0 && <>
        <H>Expenses by category</H>
        <div style={S.card}>
          {cats.map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span style={{ color: "#3a3a3a" }}>{c.k}</span><span style={{ fontWeight: 700, color: "#6b6459" }}>{fmt(c.v)}</span></div>
              <div style={{ height: 6, background: "#efe9de", borderRadius: 3 }}><div style={{ height: 6, width: (c.v / maxCat * 100) + "%", background: "#c07a00", borderRadius: 3 }} /></div>
            </div>
          ))}
        </div>
      </>}
      <div style={{ height: 30 }} />
    </div>
  );
}
