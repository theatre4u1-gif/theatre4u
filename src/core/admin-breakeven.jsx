// Break-even tracker for the admin dashboard.
// Shows how current + projected monthly recurring revenue (MRR) tracks against
// the company's monthly operating cost. "Committed + projected" basis:
//   committed  = real Stripe subscriptions + programs with a locked founding rate
//   projected  = also assume every program over the 25-item free limit converts
//                at list price (excludes closed / absorbed accounts)
// Figures are estimates for internal planning, not billed amounts.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { doorOf } from "../lib/admin-metrics.js";

// Monthly operating burn (Business Plan §10). Adjust here if costs change.
const COST_PER_MONTH = 327;
const FREE_ITEM_LIMIT = 25;

const PRO = { theatre4u: 15, artstracker: 59 };
const DISTRICT = { theatre4u: { S: 49, M: 99, L: 179 }, artstracker: { S: 199, M: 399, L: 699 } };
const money = (n) => "$" + (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

function tierOf(maxSchools) { const m = maxSchools || 6; return m <= 6 ? "S" : m <= 15 ? "M" : "L"; }

// Estimated monthly dollars a single org contributes.
function orgMonthly(o, itemCount, districtMap) {
  if (o.deleted_at || o.absorbed_into_district || o.account_status === "closed") return { amt: 0, kind: "excluded" };
  if (o.admin_notes && o.admin_notes.includes("[COMPED]")) return { amt: 0, kind: "excluded" }; // e.g. HBUHSD
  const door = doorOf(o) === "artstracker" ? "artstracker" : "theatre4u";
  // Locked founding rate always wins (committed).
  if (o.founding_rate_monthly) return { amt: Number(o.founding_rate_monthly), kind: "founding" };
  const paying = !!o.stripe_subscription_id;
  const over = (itemCount || 0) >= FREE_ITEM_LIMIT;
  if (!paying && !over) return { amt: 0, kind: "free" };
  if ((o.plan || "").startsWith("district")) {
    const ms = districtMap[o.district_id];
    return { amt: DISTRICT[door][tierOf(ms)], kind: paying ? "paying" : "projected" };
  }
  return { amt: PRO[door], kind: paying ? "paying" : "projected" };
}

export function BreakEvenTracker({ cost = COST_PER_MONTH }) {
  const [state, setState] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [orgsRes, itemsRes, distRes] = await Promise.all([
          SB.from("orgs").select("id,name,plan,vertical,signup_domain,stripe_subscription_id,founding_member,founding_rate_monthly,district_id,absorbed_into_district,account_status,deleted_at,admin_notes"),
          SB.from("items").select("org_id").limit(50000),
          SB.from("districts").select("id,max_schools"),
        ]);
        if (!alive) return;
        if (orgsRes.error) throw orgsRes.error;
        const counts = {}; (itemsRes.data || []).forEach(r => { counts[r.org_id] = (counts[r.org_id] || 0) + 1; });
        const districtMap = {}; (distRes.data || []).forEach(d => { districtMap[d.id] = d.max_schools; });
        let committed = 0, projected = 0;
        const buckets = { paying: 0, founding: 0, projected: 0 };
        const contributors = [];
        (orgsRes.data || []).forEach(o => {
          const { amt, kind } = orgMonthly(o, counts[o.id], districtMap);
          if (amt <= 0) return;
          if (kind === "paying" || kind === "founding") committed += amt; else projected += amt;
          buckets[kind] = (buckets[kind] || 0) + amt;
          contributors.push({ name: o.name, amt, kind, items: counts[o.id] || 0 });
        });
        contributors.sort((a, b) => b.amt - a.amt);
        setState({ committed, projected, total: committed + projected, buckets, contributors });
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  if (err) return <div style={{ padding: 16, color: "#c0392b" }}>Break-even: {err}</div>;
  if (!state) return <div style={{ padding: 16, color: "#888" }}>Calculating break-even…</div>;

  const { committed, projected, total, buckets, contributors } = state;
  const pct = Math.min(100, Math.round((total / cost) * 100));
  const cpct = Math.min(100, (committed / cost) * 100);
  const remaining = Math.max(0, cost - total);
  const past = total >= cost;
  const barWrap = { position: "relative", height: 26, background: "#efe9de", borderRadius: 13, overflow: "hidden", marginTop: 12 };

  return (
    <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6b6459", textTransform: "uppercase", letterSpacing: .5 }}>Break-even progress</div>
        <div style={{ fontSize: 13, color: "#9a9284" }}>Target {money(cost)}/mo operating cost</div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: past ? "#1a7f37" : "#2a2a2a", lineHeight: 1 }}>{pct}%</div>
        <div style={{ fontSize: 14, color: "#6b6459" }}>{money(total)}/mo projected · {past ? "past break-even 🎉" : money(remaining) + "/mo to go"}</div>
      </div>

      <div style={barWrap} title={`Committed ${money(committed)} · Projected ${money(total)}`}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", background: past ? "#1a7f37" : "#c4922a", transition: "width .4s" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: cpct + "%", background: "#1a7f37", opacity: .85 }} />
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, fontSize: 13, color: "#3a3a3a" }}>
        <span><strong style={{ color: "#1a7f37" }}>{money(buckets.paying || 0)}</strong> paying</span>
        <span><strong style={{ color: "#c4922a" }}>{money(buckets.founding || 0)}</strong> founding</span>
        <span><strong style={{ color: "#8a8272" }}>{money(buckets.projected || 0)}</strong> projected (25+ items)</span>
        <span style={{ marginLeft: "auto", color: "#9a9284" }}>{contributors.length} contributing programs</span>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 12.5, color: "#a5731f", fontWeight: 700 }}>What's counted</summary>
        <div style={{ marginTop: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {contributors.map((c, i) => (
                <tr key={i}>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #f0ece3", color: "#3a3a3a" }}>{c.name}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #f0ece3", color: "#9a9284" }}>{c.items} items</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #f0ece3", color: "#8a8272", textTransform: "capitalize" }}>{c.kind}</td>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #f0ece3", textAlign: "right", fontWeight: 700 }}>{money(c.amt)}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p style={{ color: "#9a9284", fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        Estimate for planning, not billed revenue. Committed = live subscriptions + locked founding rates; projected also assumes every program over the {FREE_ITEM_LIMIT}-item free limit converts at list price. Excludes closed, absorbed, and comped accounts (comped = admin note tagged [COMPED], e.g. HBUHSD). Edit COST_PER_MONTH in admin-breakeven.jsx if costs change.
      </p>
    </div>
  );
}
