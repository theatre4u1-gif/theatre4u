// Business Finance (Artstracker LLC) — the single home for the company's books.
// Backed by business_ledger (admin-only, amounts in cents). Income + expenses + owner equity,
// a P&L by year / month / brand / category, and a Chase CSV uploader that auto-categorizes,
// previews, and dedupes (import_key) so re-uploading a statement never double-books.
// Chase deposits ARE the income (Stripe payouts land net), so this no longer imports the
// Stripe summary separately — that avoided double-counting revenue.
import React, { useState, useEffect, useMemo } from "react";
import { SB } from "./supabase.js";

const fmt = (c) => (c < 0 ? "-$" : "$") + (Math.abs(c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const ymOf = (d) => String(d).slice(0, 7);
const yrOf = (d) => String(d).slice(0, 4);

const BRANDS = ["Theatre4u", "ArtsTracker", "BinTrove", "Shared / LLC"];
const TYPES = [["expense", "Expense"], ["income", "Income"], ["owner_contribution", "Owner contribution"]];
const INCOME_CATS = ["Subscriptions", "Move pass", "Label sales", "Donations", "Grants", "Other income"];
const EXPENSE_CATS = ["Software / SaaS", "Hosting", "Printing & fulfillment", "Marketing", "Payment fees", "Supplies", "Equipment", "Contractors", "Legal / filing", "Insurance", "Taxes & licenses", "Education", "Other expense"];
const ACCOUNTS = ["Chase Business Checking", "Chase Business Credit"];

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

// ── Chase CSV parsing + auto-categorization (mirrors the server-side seed rules) ──
function splitCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out;
}
const toISO = (s) => { const p = String(s).trim().split("/"); return p.length === 3 ? `${p[2]}-${String(+p[0]).padStart(2, "0")}-${String(+p[1]).padStart(2, "0")}` : ""; };
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

function catCredit(dU) {
  if (dU.includes("BIBERK")) return "Insurance";
  if (dU.includes("ORANGECLERK") || dU.includes("FBN") || dU.includes("SANTA ANA NEWS")) return "Taxes & licenses";
  if (dU.includes("NAME-CHEAP") || dU.includes("NAMECHEAP") || dU.includes("VERCEL")) return "Hosting";
  if (dU.includes("INTEREST CHARGE") || dU.includes("ANNUAL MEMBERSHIP FEE")) return "Payment fees";
  if (dU.includes("ASK A LAWYER") || dU.includes("CONTRACTSCOUNSEL") || dU.includes("COPYRIGHT") || dU.includes("PATENT") || dU.includes("TRADEMARK")) return "Legal / filing";
  if (dU.includes("BESTBUY") || dU.includes("APPLE STORE")) return "Equipment";
  if (dU.includes("RESEND") || dU.includes("CANVA")) return "Software / SaaS";
  if (dU.includes("VISTAPRINT") || dU.includes("GOTPRINT") || dU.includes("MOO PRINT")) return "Printing & fulfillment";
  if (dU.includes("FACEBK") || dU.includes("FACEBOOK") || dU.includes("CREATIVE LOGIC")) return "Marketing";
  if (dU.includes("BARCODES") || dU.includes("USPS") || dU.includes("CROSS CO")) return "Supplies";
  return "Other expense";
}
function classifyCheck(dU, amt) {
  if (dU.includes("PAYMENT TO CHASE CARD") || dU.includes("CHASE CREDIT CRD")) return null;
  if (dU.includes("TO MMA") || dU.includes("ONLINE TRANSFER TO")) return null;
  if (dU.includes("ACCTVERIFY") || Math.abs(amt) < 0.10) return null;
  if (dU.includes("FROM JOINT CHECKING")) return ["owner_contribution", "Owner contribution", "Transfer in from personal (equity)"];
  if (dU.includes("STRIPE")) return ["income", "Subscriptions", amt > 0 ? "Stripe payout" : "Stripe refund"];
  if (dU.includes("FACEBOOK") || dU.includes("FACEBK") || dU.includes("META")) return ["expense", "Marketing", "Facebook/Meta ads"];
  if (dU.includes("ANTHROPIC")) return ["expense", "Software / SaaS", "Anthropic / Claude"];
  if (dU.includes("SUPABASE")) return ["expense", "Hosting", "Supabase"];
  if (dU.includes("SERVICE FEE")) return ["expense", "Payment fees", "Bank fee"];
  if (dU.includes("FIVERR")) return ["expense", "Contractors", "Fiverr"];
  if (dU.includes("GRANDRANKER")) return ["expense", "Software / SaaS", "GrandRanker"];
  if (dU.includes("GARDEN GROVE CITY")) return ["expense", "Taxes & licenses", "City business license"];
  if (dU.includes("CETA") || dU.includes("CONFERENCE")) return ["expense", "Education", "CETA conference"];
  if (dU.includes("REMOTE ONLINE DEPOSIT") || dU.includes("DEPOSIT ID NUMBER") || dU.includes("DEPOSIT  ID NUMBER")) return ["owner_contribution", "Owner contribution", "Owner deposit (equity)"];
  return ["__flag__", "Other expense", "Unclassified — set the category"];
}
function parseChase(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { rows: [], err: "Empty file." };
  const header = lines[0];
  const isCredit = /Transaction Date/i.test(header) && /Card/i.test(header);
  const isCheck = /Posting Date/i.test(header) && /Details/i.test(header);
  if (!isCredit && !isCheck) return { rows: [], err: "This doesn't look like a Chase checking or credit CSV." };
  const account = isCredit ? "Chase Business Credit" : "Chase Business Checking";
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]); if (c.length < 4) continue;
    let dt, desc, amt, typ = "", res;
    if (isCredit) { dt = toISO(c[1]); desc = norm(c[3]); typ = norm(c[5]); amt = parseFloat(c[6]); }
    else { dt = toISO(c[1]); desc = norm(c[2]); amt = parseFloat(c[3]); }
    if (!dt || isNaN(amt)) continue;
    const dU = desc.toUpperCase();
    let type, category, note, brand = "Shared / LLC", cents;
    if (isCredit) {
      if (typ === "Payment") continue; // internal card payment
      category = catCredit(dU);
      if (dU.includes("FACEBK") || dU.includes("FACEBOOK")) brand = "Theatre4u";
      note = dU.includes("CREATIVE LOGIC") ? "Logo design — " + desc : (typ === "Return" ? "Refund/return — " + desc : desc);
      type = "expense"; cents = Math.round((typ === "Return" ? -Math.abs(amt) : Math.abs(amt)) * 100);
    } else {
      res = classifyCheck(dU, amt); if (!res) continue;
      [type, category, note] = res;
      if (type === "income") cents = Math.round(amt * 100);
      else cents = Math.round(Math.abs(amt) * 100);
      if (type === "expense" && (dU.includes("FACEBOOK") || dU.includes("FACEBK"))) brand = "Theatre4u";
      if (type === "__flag__") type = "expense";
    }
    const key = `chase|${account}|${dt}|${cents}|${String(note).slice(0, 30)}`;
    rows.push({ keep: true, entry_date: dt, type, category, amount_cents: cents, note: String(note).slice(0, 180), brand, account, import_key: key });
  }
  return { rows, err: rows.length ? "" : "No usable transactions found." };
}

export function BusinessFinance({ userId }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [preview, setPreview] = useState(null); // {rows, fileName}
  const [form, setForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), type: "expense", brand: "Shared / LLC", category: "", amount: "", note: "", account: "Chase Business Checking" });

  const load = async () => {
    const { data, error } = await SB.from("business_ledger").select("*").order("entry_date", { ascending: false });
    if (error) { setErr(error.message); return; }
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const addEntry = async () => {
    const cents = Math.round(parseFloat(form.amount) * 100);
    if (!cents || isNaN(cents)) { flash("Enter an amount"); return; }
    setBusy(true);
    const { error } = await SB.from("business_ledger").insert({
      entry_date: form.entry_date, type: form.type, category: form.category || null, brand: form.brand || null,
      account: form.account || null, amount_cents: cents, note: form.note || null, source: "manual", created_by: userId || null,
    });
    setBusy(false);
    if (error) { flash("Error: " + error.message); return; }
    setForm(f => ({ ...f, amount: "", note: "" })); flash("✓ Entry added"); load();
  };
  const del = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    const { error } = await SB.from("business_ledger").delete().eq("id", id);
    if (error) { flash("Error: " + error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const { rows: parsed, err: perr } = parseChase(text);
    if (perr) { flash(perr); return; }
    setPreview({ rows: parsed, fileName: file.name });
  };
  const commitImport = async () => {
    const keep = preview.rows.filter(r => r.keep && r.amount_cents);
    if (!keep.length) { setPreview(null); return; }
    setBusy(true);
    const payload = keep.map(r => ({ entry_date: r.entry_date, type: r.type, category: r.category, brand: r.brand, account: r.account, amount_cents: r.amount_cents, note: r.note, source: "chase_import", import_key: r.import_key, created_by: userId || null }));
    const { error } = await SB.from("business_ledger").upsert(payload, { onConflict: "import_key", ignoreDuplicates: true });
    setBusy(false);
    if (error) { flash("Import error: " + error.message); return; }
    setPreview(null); flash("✓ Imported " + keep.length + " transaction" + (keep.length === 1 ? "" : "s") + " (duplicates skipped)"); load();
  };
  const updPrev = (i, k, v) => setPreview(p => ({ ...p, rows: p.rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));

  const exportCsv = () => {
    const head = ["Date", "Type", "Brand", "Category", "Account", "Amount", "Note", "Source"];
    const body = (rows || []).map(r => [r.entry_date, r.type, r.brand || "", r.category || "", r.account || "", (r.amount_cents / 100).toFixed(2), r.note || "", r.source || ""]);
    const csv = [head, ...body].map(a => a.map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "artstracker-ledger.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const view = useMemo(() => {
    if (!rows) return null;
    const inYear = rows.filter(r => yrOf(r.entry_date) === year);
    const sum = (list, pred) => list.filter(pred).reduce((a, r) => a + (r.amount_cents || 0), 0);
    const income = sum(inYear, r => r.type === "income");
    const expense = sum(inYear, r => r.type === "expense");
    const equity = sum(inYear, r => r.type === "owner_contribution");
    const thisMonth = ymOf(new Date().toISOString());
    const mIncome = sum(inYear, r => r.type === "income" && ymOf(r.entry_date) === thisMonth);
    const mExpense = sum(inYear, r => r.type === "expense" && ymOf(r.entry_date) === thisMonth);
    const byBrand = BRANDS.map(b => ({ b, inc: sum(inYear, r => r.type === "income" && (r.brand || "Shared / LLC") === b), exp: sum(inYear, r => r.type === "expense" && (r.brand || "Shared / LLC") === b) })).filter(x => x.inc || x.exp);
    const byCat = {}; inYear.filter(r => r.type === "expense").forEach(r => { const k = r.category || "Uncategorized"; byCat[k] = (byCat[k] || 0) + (r.amount_cents || 0); });
    const cats = Object.entries(byCat).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    const months = []; for (let m = 1; m <= 12; m++) { const mm = `${year}-${String(m).padStart(2, "0")}`; months.push({ mm, label: new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "short" }), inc: sum(inYear, r => r.type === "income" && ymOf(r.entry_date) === mm), exp: sum(inYear, r => r.type === "expense" && ymOf(r.entry_date) === mm) }); }
    // reminder: is last calendar month missing a Chase import?
    const now = new Date(); const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); const lmKey = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthImported = rows.some(r => r.source === "chase_import" && ymOf(r.entry_date) === lmKey);
    const years = Array.from(new Set(rows.map(r => yrOf(r.entry_date)))).sort().reverse();
    return { income, expense, equity, net: income - expense, mIncome, mExpense, byBrand, cats, months, lmKey, lastMonthImported, years, count: inYear.length };
  }, [rows, year]);

  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load finance: {err}</div>;
  if (!rows || !view) return <div style={{ padding: 24, color: "#888" }}>Loading finance…</div>;

  const maxCat = Math.max(1, ...view.cats.map(c => c.v));
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 };
  const H = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: "26px 0 12px" }}>{children}</h3>;
  const lmLabel = new Date(view.lmKey + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 10px" }}>Bookkeeping for Artstracker LLC — your single source of truth. Upload Chase CSVs monthly; income, expenses, owner equity, and P&L update here.</p>
      {msg && <div style={{ marginBottom: 10, fontWeight: 700, fontSize: 13, color: msg.startsWith("Error") || msg.startsWith("Import error") ? "#c0392b" : "#1a7f37" }}>{msg}</div>}

      {!view.lastMonthImported && (
        <div style={{ ...S.card, background: "#fff8e6", borderColor: "#e8c96b", display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>📅</span>
          <div style={{ flex: 1, fontSize: 13.5, color: "#7a5a00" }}><b>Time to update your books.</b> {lmLabel} isn't loaded yet. Download your Chase Business Checking and Credit activity and upload both below.</div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <H>Profit &amp; loss</H>
        <select value={year} onChange={e => setYear(e.target.value)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 7, border: "1px solid #d5cfc4", fontFamily: "inherit", fontSize: 13 }}>
          {(view.years.length ? view.years : [year]).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={grid}>
        <Stat label={"Net (" + year + ")"} value={fmt(view.net)} accent={view.net >= 0 ? "#1a7f37" : "#c0392b"} sub="income − expenses" />
        <Stat label="Income" value={fmt(view.income)} accent="#1a7f37" sub="Stripe payouts + other" />
        <Stat label="Expenses" value={fmt(view.expense)} accent="#c07a00" />
        <Stat label="This month" value={fmt(view.mIncome - view.mExpense)} accent={(view.mIncome - view.mExpense) >= 0 ? "#1a7f37" : "#c0392b"} sub={fmt(view.mIncome) + " in · " + fmt(view.mExpense) + " out"} />
        <Stat label="Owner contributions" value={fmt(view.equity)} accent="#4C1035" sub="equity — not in net" />
      </div>

      <H>Upload Chase activity</H>
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ ...S.btn("#1a7f37"), display: "inline-block" }}>
          ⭱ Upload Chase CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </label>
        <div style={{ fontSize: 12.5, color: "#9a9284" }}>Chase.com → each account → Download → CSV. Upload checking and credit; it auto-categorizes, you review, duplicates are skipped.</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 12px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: 0 }}>Add an entry by hand</h3>
      </div>
      <div style={S.card}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 130px 120px 1fr 110px", gap: 10, alignItems: "end", marginBottom: 10 }}>
          <div><label style={S.label}>Date</label><input type="date" style={S.input} value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} /></div>
          <div><label style={S.label}>Type</label><select style={S.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, category: "" }))}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label style={S.label}>Brand</label><select style={S.input} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select></div>
          <div><label style={S.label}>Category</label><input style={S.input} list="fin-cats" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="category" /><datalist id="fin-cats">{(form.type === "income" ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c} value={c} />)}</datalist></div>
          <div><label style={S.label}>Amount ($)</label><input type="number" step="0.01" style={S.input} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}><label style={S.label}>Note</label><input style={S.input} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="What was this for?" /></div>
          <button onClick={addEntry} disabled={busy} style={S.btn("#1a7f37", busy)}>Add</button>
        </div>
      </div>

      {view.byBrand.length > 0 && <>
        <H>By brand ({year})</H>
        <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead><tr><th style={S.th}>Brand</th><th style={{ ...S.th, textAlign: "right" }}>Income</th><th style={{ ...S.th, textAlign: "right" }}>Expenses</th><th style={{ ...S.th, textAlign: "right" }}>Net</th></tr></thead>
            <tbody>{view.byBrand.map(b => (
              <tr key={b.b}><td style={S.td}>{b.b}</td><td style={{ ...S.td, textAlign: "right", color: "#1a7f37" }}>{fmt(b.inc)}</td><td style={{ ...S.td, textAlign: "right", color: "#c07a00" }}>{fmt(b.exp)}</td><td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: (b.inc - b.exp) >= 0 ? "#1a7f37" : "#c0392b" }}>{fmt(b.inc - b.exp)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </>}

      {view.cats.length > 0 && <>
        <H>Expenses by category ({year})</H>
        <div style={S.card}>
          {view.cats.map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span style={{ color: "#3a3a3a" }}>{c.k}</span><span style={{ fontWeight: 700, color: "#6b6459" }}>{fmt(c.v)}</span></div>
              <div style={{ height: 6, background: "#efe9de", borderRadius: 3 }}><div style={{ height: 6, width: (c.v / maxCat * 100) + "%", background: "#c07a00", borderRadius: 3 }} /></div>
            </div>
          ))}
        </div>
      </>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 12px" }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5, margin: 0 }}>Entries ({view.count} in {year})</h3>
        <button onClick={exportCsv} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 8, border: "1px solid #1a7f37", background: "#fff", color: "#1a7f37", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⭳ Export CSV</button>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e6e0d6", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead><tr><th style={S.th}>Date</th><th style={S.th}>Brand</th><th style={S.th}>Category</th><th style={S.th}>Note</th><th style={{ ...S.th, textAlign: "right" }}>Amount</th><th style={S.th}></th></tr></thead>
          <tbody>
            {rows.filter(r => yrOf(r.entry_date) === year).map(r => (
              <tr key={r.id}>
                <td style={S.td}>{fmtDate(r.entry_date)}</td>
                <td style={S.td}>{r.brand || "—"}</td>
                <td style={S.td}>{r.category || "—"}{r.type === "owner_contribution" && <span style={{ fontSize: 10, color: "#4C1035", fontWeight: 700 }}> · equity</span>}</td>
                <td style={S.td}>{r.note || ""}</td>
                <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: r.type === "income" ? "#1a7f37" : r.type === "owner_contribution" ? "#4C1035" : "#c0392b" }}>{r.type === "income" ? "+" : r.type === "owner_contribution" ? "⌂ " : "−"}{fmt(r.amount_cents).replace("-", "")}</td>
                <td style={{ ...S.td, textAlign: "right" }}><button onClick={() => del(r.id)} title="Delete" style={{ border: "1px solid #e2b6b6", background: "#fff", color: "#c0392b", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontFamily: "inherit" }}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ height: 30 }} />

      {preview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,15,5,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto" }} onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div style={{ background: "#fff", borderRadius: 14, maxWidth: 900, width: "100%", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Review import · {preview.fileName}</h3>
              <button onClick={() => setPreview(null)} style={{ marginLeft: "auto", border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#888" }}>×</button>
            </div>
            <div style={{ fontSize: 12.5, color: "#777", marginBottom: 10 }}>Internal transfers (card payments, savings moves) are already excluded. Uncheck anything you don't want, fix any category, then import. Duplicates are skipped automatically.</div>
            <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #e6e0d6", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr><th style={S.th}></th><th style={S.th}>Date</th><th style={S.th}>Type</th><th style={S.th}>Brand</th><th style={S.th}>Category</th><th style={S.th}>Note</th><th style={{ ...S.th, textAlign: "right" }}>Amount</th></tr></thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} style={{ opacity: r.keep ? 1 : .45 }}>
                      <td style={S.td}><input type="checkbox" checked={r.keep} onChange={e => updPrev(i, "keep", e.target.checked)} /></td>
                      <td style={S.td}>{fmtDate(r.entry_date)}</td>
                      <td style={S.td}><select value={r.type} onChange={e => updPrev(i, "type", e.target.value)} style={{ fontSize: 12, fontFamily: "inherit" }}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                      <td style={S.td}><select value={r.brand} onChange={e => updPrev(i, "brand", e.target.value)} style={{ fontSize: 12, fontFamily: "inherit" }}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select></td>
                      <td style={S.td}><input value={r.category} onChange={e => updPrev(i, "category", e.target.value)} list="fin-cats" style={{ fontSize: 12, fontFamily: "inherit", width: 130, padding: "3px 6px", border: "1px solid #ddd", borderRadius: 5 }} /></td>
                      <td style={{ ...S.td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.note}>{r.note}</td>
                      <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{fmt(r.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setPreview(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #d5cfc4", background: "#fff", color: "#555", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={commitImport} disabled={busy} style={S.btn("#1a7f37", busy)}>{busy ? "Importing…" : "Import " + preview.rows.filter(r => r.keep).length + " transactions"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
