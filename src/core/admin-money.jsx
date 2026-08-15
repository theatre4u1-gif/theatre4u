// Money — one home for everything financial (Phase 8 admin app).
// Sub-views reuse the existing modules: Revenue & subscriptions (Stripe), Break-even (MRR vs
// operating cost), and Bookkeeping (income/expense ledger). Replaces the separate Billing +
// Finance tabs.
import React, { useState } from "react";
import { BillingDashboard } from "./admin-billing.jsx";
import { BusinessFinance } from "./admin-finance.jsx";
import { BreakEvenTracker } from "./admin-breakeven.jsx";

const SUBS = [
  ["revenue", "Revenue & subscriptions"],
  ["breakeven", "Break-even"],
  ["books", "Bookkeeping"],
];

export function MoneyDashboard({ door = "all", userId }) {
  const [sub, setSub] = useState("revenue");
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
        {SUBS.map(([id, lbl]) => (
          <button key={id} onClick={() => setSub(id)}
            style={{ padding: "7px 15px", borderRadius: 8, border: "1px solid " + (sub === id ? "#c4922a" : "#e0d9cc"), background: sub === id ? "#c4922a" : "#fff", color: sub === id ? "#fff" : "#6b6459", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {lbl}
          </button>
        ))}
      </div>
      {sub === "revenue" && <BillingDashboard door={door} />}
      {sub === "breakeven" && (
        <>
          <p style={{ color: "#777", fontSize: 13, margin: "0 0 12px" }}>Projected monthly recurring revenue against the operating cost.</p>
          <BreakEvenTracker />
        </>
      )}
      {sub === "books" && <BusinessFinance userId={userId} />}
    </div>
  );
}
