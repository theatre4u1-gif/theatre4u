import React, { useState, useEffect, useCallback } from "react";
import { APP_NAME, APP_EMAIL, APP_HOST, IS_ARTSTRACKER } from "./config.js";
import { SB } from "./supabase.js";
import { BG, usp } from "../lib/backgrounds.js";
import { fbShare, getPointsName } from "./helpers.js";
import { ADMIN_EMAILS } from "./config.js";
import { POINTS_FREE_MONTH } from "./points-config.js";

// Points / credits page — extracted from App.jsx.

export function CreditsPage({ userId, org, plan, balance, onBalanceChange }) {
  const [ledger,        setLedger]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState("overview");
  const [adminOrg,      setAdminOrg]      = useState("");
  const [adminAmt,      setAdminAmt]      = useState("");
  const [adminMsg,      setAdminMsg]      = useState("");
  const [adminSaving,   setAS]            = useState(false);
  const [daysUntilElig, setDaysUntilElig] = useState(null);
  const [redeeming,     setRedeeming]     = useState(false);
  const [redeemMsg,     setRedeemMsg]     = useState("");
  const [refCopied,     setRefCopied]     = useState(false);
  const isAdmin   = ADMIN_EMAILS?.includes?.(org?.email);
  const isAnnual  = org?.plan_interval === "annual";
  const earnMult  = isAnnual ? 1.5 : 1.0;

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ledgerData }, { data: bal }, { data: daysData }] = await Promise.all([
      SB.from("credit_ledger").select("*").eq("org_id", userId)
        .order("created_at", { ascending: false }).limit(100),
      SB.rpc("get_my_credit_balance"),
      SB.rpc("points_eligible_in_days", { p_org_id: userId }),
    ]);
    setLedger(ledgerData || []);
    onBalanceChange?.(bal || 0);
    setDaysUntilElig(typeof daysData === "number" ? daysData : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const totalEarned = ledger.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalSpent  = Math.abs(ledger.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0));

  const typeIcon = {
    welcome_bonus:        "🎉", catalog_bonus:         "📸", rental_earn:  "🔑",
    loan_earn:            "🤝", early_return_bonus:    "⚡", referral_earn: "👥",
    spend_rental:         "🛒", spend_deposit:         "🔒", admin_adjust: "🔧",
    expire:               "⏰", annual_bonus:          "⭐", annual_renewal_bonus: "⭐",
    profile_complete:     "✅", items_10:              "📦", items_25_photos: "📸",
    first_listing:        "🏪", first_request:         "📨", team_invite:  "👥",
  };
  const typeLabel = {
    welcome_bonus:        "Welcome Bonus",       catalog_bonus:        "Catalog Milestone",
    rental_earn:          "Rental Completed",    loan_earn:            "Loan Completed",
    early_return_bonus:   "Early Return",        referral_earn:        "Referral Bonus",
    spend_rental:         "Points Applied",      spend_deposit:        "Deposit Covered",
    admin_adjust:         "Admin Adjustment",    expire:               "Points Expired",
    annual_bonus:         "Annual Plan Bonus",   annual_renewal_bonus: "Annual Renewal Bonus",
    profile_complete:     "Profile Completed",   items_10:             "10 Items Added",
    items_25_photos:      "25 Items + Photos",   first_listing:        "First Exchange Listing",
    first_request:        "First Exchange Request", team_invite:       "Team Member Invited",
  };

  const adminAward = async () => {
    if (!adminOrg || !adminAmt) return;
    setAS(true);
    await SB.rpc("admin_award_credits", {
      p_org_id: adminOrg, p_amount: parseInt(adminAmt), p_description: adminMsg || "Admin adjustment"
    });
    setAS(false); setAdminOrg(""); setAdminAmt(""); setAdminMsg("");
    load();
  };

  return (
    <div style={{ position: "relative" }}>
      <img src={usp(BG.dashboard, 1400, 900)} alt="" className="page-bg-img" />
      <div style={{ padding: "32px 36px 0" }}>
        <div className="hero-wrap" style={{ height: 210 }}>
          <img src={usp(BG.dashboard, 1100, 270)} alt="Credits" loading="eager" />
          <div className="hero-fade" />
          <div className="hero-body">
            <div className="hero-eyebrow">🪙 Stage Economy</div>
            <h1 className="hero-title" style={{ fontSize: 44 }}>{getPointsName(org?.vertical)}</h1>
            <p className="hero-sub">Earn points by sharing inventory and completing Exchange deals. Spend them for discounts — or save up for a free month.</p>
          </div>
          <div className="hero-bar" />
        </div>
      </div>

      <div style={{ padding: "24px 36px 56px", position: "relative", zIndex: 1 }}>

        {/* Balance card */}
        <div className="card card-p" style={{ marginBottom: 22, background: "linear-gradient(135deg,rgba(212,168,67,.12),rgba(212,168,67,.04))", borderColor: "rgba(212,168,67,.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6 }}>Your Balance</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 64, color: "var(--goldink)", lineHeight: 1 }}>{balance.toLocaleString()}</span>
                <span style={{ fontSize: 18, color: "var(--muted)", fontWeight: 700 }}>points</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>1 point = $0.01 · 1,500 points = free Pro month</div>
              {isAnnual && (
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(212,168,67,.15)", border: "1px solid rgba(212,168,67,.3)",
                  borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "var(--goldink)", fontWeight: 700 }}>
                  ⭐ Annual plan — earning at 1.5× rate on loans &amp; rentals
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Total Earned", val: totalEarned, icon: "📈", col: "var(--green)" },
                { label: "Total Spent",  val: totalSpent,  icon: "📤", col: "var(--amber)" },
                { label: "Transactions", val: ledger.length, icon: "📋", col: "var(--blue)" },
              ].map(s => (
                <div key={s.label} className="card card-p" style={{ textAlign: "center", padding: "12px 18px", minWidth: 100 }}>
                  <div style={{ fontSize: 20, marginBottom: 3 }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: s.col }}>{s.val.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How to earn — always visible */}
        <div className="card card-p" style={{ marginBottom: 22, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {[
            { icon: "🎉", title: "Join & Welcome",      earn: "+25 pts",      note: "Awarded automatically on signup." },
            { icon: "✅", title: "Complete Profile",    earn: "+25 pts",      note: "Add name, location, bio, and email." },
            { icon: "📦", title: "Add 10 Items",        earn: "+25 pts",      note: "One-time milestone." },
            { icon: "📸", title: "25 Items + Photos",   earn: "+50 pts",      note: "Quality catalog milestone." },
            { icon: "🏪", title: "First Exchange Listing",earn: "+15 pts",    note: "List any item on the Exchange." },
            { icon: "📨", title: "First Exchange Request",earn: "+10 pts",    note: "Send your first request to another program." },
            { icon: "👥", title: "Invite a Team Member", earn: "+15 pts",     note: "Per member who signs in." },
            { icon: "👋", title: "Refer a Program",     earn: "+50 pts",      note: "Per program that creates an account using your referral link." },
            { icon: "🤝", title: "Loan Completed",       earn: isAnnual ? "+15–75 pts ⭐" : "+10–50 pts",
              note: isAnnual ? "1.5× annual rate. Lighting/Sound = 75 pts." : "Varies by item category. Lighting/Sound = 50 pts." },
            { icon: "🔑", title: "Rental Completed",     earn: isAnnual ? "+$1 = 1.5 pts ⭐" : "+$1 = 1 pt",
              note: isAnnual ? "1.5× annual rate — 1.5 pts per dollar of rental price." : "1 point per dollar of rental price." },
            { icon: "🛒", title: "Exchange Discount", earn: "Up to 50% off", note: "Apply points when requesting any rental or purchase." },
            { icon: "🎟️", title: "Free Pro Month",    earn: "1,500 pts",   note: "Redeem 1,500 points for one free month of Pro." },
          ].map(s => (
            <div key={s.title} style={{ padding: "12px 14px", background: "var(--parch)", borderRadius: 10, border: "1px solid var(--linen)" }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{s.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.earn.startsWith("+") ? "var(--green)" : "var(--amber)", marginBottom: 4 }}>{s.earn}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{s.note}</div>
            </div>
          ))}
        </div>

        {/* ── Referral Link ── */}
        {org?.referral_code && (
          <div className="card card-p" style={{ marginBottom: 22,
            background: "linear-gradient(135deg,rgba(212,168,67,.06),rgba(212,168,67,.02))",
            border: "1px solid rgba(212,168,67,.25)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>👋</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                  Your Referral Link — Earn 50 Points Per Program
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
                  Share this link with other theatre directors. When they sign up and create an account,
                  you automatically earn 50 Stage Points. No limit on referrals.
                </div>
                {/* Referral link box */}
                {(()=>{
                  const refUrl = "https://theatre4u.org?ref=" + org.referral_code;
                  const copy = () => {
                    navigator.clipboard.writeText(refUrl).then(()=>{
                      setRefCopied(true); setTimeout(()=>setRefCopied(false), 2500);
                    });
                  };
                  return (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 200, background: "var(--parch)",
                        border: "1px solid var(--border)", borderRadius: 8,
                        padding: "9px 14px", fontFamily: "monospace", fontSize: 13,
                        color: "var(--goldink)", letterSpacing: 0.3, wordBreak: "break-all" }}>
                        {refUrl}
                      </div>
                      <button onClick={copy}
                        style={{ padding: "9px 18px", borderRadius: 8, border: "none",
                          background: refCopied ? "var(--green)" : "var(--gold)",
                          color: "#1a0f00", fontWeight: 700, fontSize: 13,
                          cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                          transition: "background .2s" }}>
                        {refCopied ? "✓ Copied!" : "Copy Link"}
                      </button>
                      <button onClick={()=>fbShare(refUrl,
                        `I use ${APP_NAME} to manage my program's inventory and share resources with other programs through the Exchange. It's free right now — check it out!\n\n${APP_HOST} ` + (IS_ARTSTRACKER ? "#ArtsEducation" : "#Theatre #TheatreEducation"))}
                        style={{ padding: "9px 14px", borderRadius: 8,
                          border: "1px solid rgba(24,119,242,.35)",
                          background: "rgba(24,119,242,.08)", color: "#4285f4",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                          fontFamily: "inherit", flexShrink: 0,
                          display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Share
                      </button>
                    </div>
                  );
                })()}
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                  Your referral code: <strong style={{ color: "var(--goldink)", fontFamily: "monospace", letterSpacing: 1 }}>{org.referral_code}</strong>
                  {" · "}Points appear in your ledger within seconds of the new program signing up.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Redeem Free Month ── */}
        {plan !== "free" && (
          <div className="card card-p" style={{ marginBottom: 22,
            border: balance >= POINTS_FREE_MONTH ? "1.5px solid rgba(212,168,67,.5)" : "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 36 }}>🎟️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>Redeem for a Free Pro Month</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                  1,500 points = one free month of Pro ($15 value)
                </div>
                {/* Eligibility gate */}
                {daysUntilElig !== null && daysUntilElig > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(107,100,120,.15)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>
                    🕐 Free-month redemption available in <strong style={{ color: "var(--text)" }}>&nbsp;{daysUntilElig} days</strong>
                    &nbsp;· Exchange discounts available now
                  </div>
                ) : balance < POINTS_FREE_MONTH ? (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {(POINTS_FREE_MONTH - balance).toLocaleString()} more points needed
                    {/* Mini progress bar */}
                    <div style={{ marginTop: 6, background: "var(--border)", borderRadius: 99, height: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 99, background: "var(--gold)",
                        width: Math.min(100, balance / POINTS_FREE_MONTH * 100) + "%" }}/>
                    </div>
                  </div>
                ) : (
                  <div>
                    {redeemMsg && (
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8,
                        color: redeemMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>
                        {redeemMsg}
                      </div>
                    )}
                    <button
                      disabled={redeeming || balance < POINTS_FREE_MONTH}
                      onClick={async () => {
                        setRedeeming(true); setRedeemMsg("");
                        // Check eligibility server-side
                        const { data: eligible } = await SB.rpc("is_points_eligible", { p_org_id: userId });
                        if (!eligible) {
                          setRedeemMsg("⚠️ Not yet eligible — 90 days of Pro required for free-month redemption.");
                          setRedeeming(false); return;
                        }
                        const { data } = await SB.rpc("spend_credits", {
                          p_org_id: userId, p_amount: POINTS_FREE_MONTH,
                          p_type: "spend_rental",
                          p_description: "Redeemed 1,500 pts for free Pro month"
                        });
                        if (data?.success) {
                          setRedeemMsg("✓ 1,500 points redeemed! Your free month credit will be applied. Contact "+APP_EMAIL+" to confirm.");
                          load();
                        } else {
                          setRedeemMsg("⚠️ " + (data?.error || "Could not redeem — please try again."));
                        }
                        setRedeeming(false);
                      }}
                      className="btn btn-g" style={{ marginTop: 4 }}>
                      {redeeming ? "Processing…" : "Redeem 1,500 Points → Free Month"}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28,
                  color: balance >= POINTS_FREE_MONTH ? "var(--gold)" : "var(--muted)",
                  fontWeight: 700 }}>
                  {balance.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>/ 1,500 pts</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 18 }}>
          {[["overview","📋 History"],["rules","📖 How It Works"],...( isAdmin ? [["admin","🔧 Admin"]] : [])].map(([t, l]) => (
            <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{l}</button>
          ))}
        </div>

        {/* ── History ── */}
        {tab === "overview" && (
          <div className="card" style={{ overflow: "hidden" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading…</div>
            ) : ledger.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">🪙</div>
                <h3>No credit activity yet</h3>
                <p>Complete a loan or rental, add photos to 10+ items, or just wait — your welcome bonus should appear shortly.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--parch)" }}>
                      {["Date", "Type", "Description", "Amount", "Balance"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 700, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.reduce((acc, row, i) => {
                      // Running balance (ledger is newest-first, so we go reverse)
                      const runningBal = ledger.slice(i).reduce((s, r) => s + r.amount, 0);
                      acc.push(
                        <tr key={row.id} style={{ borderBottom: "1px solid var(--linen)", background: i % 2 === 0 ? "transparent" : "rgba(243,230,204,.3)" }}>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                            {new Date(row.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span style={{ fontSize: 13 }}>{typeIcon[row.type] || "•"} {typeLabel[row.type] || row.type}</span>
                          </td>
                          <td style={{ padding: "9px 14px", fontSize: 13, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.description}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: row.amount > 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                              {row.amount > 0 ? "+" : ""}{row.amount.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px", fontFamily: "'Playfair Display',serif", fontSize: 15, color: "var(--goldink)" }}>
                            {runningBal.toLocaleString()}
                          </td>
                        </tr>
                      );
                      return acc;
                    }, [])}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Rules ── */}
        {tab === "rules" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { title: "Earning Credits",
                body: "Credits are earned automatically when a transaction is marked returned by the owner. For free loans, the item must have been out for at least 3 days to qualify. For rentals, you earn 1 credit per $1 of rental value (minimum 5, maximum 500 per transaction)." },
              { title: "Spending Credits",
                body: "When requesting a rental or purchase, you can apply credits to cover up to 50% of the price. The remaining cash balance must be paid directly to the item owner outside of the platform — by check, Venmo, invoice, or any payment method agreed between your organizations. Artstracker LLC does not collect or transfer cash payments. Credits can also be used to cover 100% of a security deposit." },
              { title: "Credit Value",
                body: "1 credit = $1 of discount toward a rental or purchase. Credits have no cash value and cannot be refunded, transferred to another organization, or exchanged for money." },
              { title: "Expiry & Forfeiture",
                body: "Points expire 12 months after they are earned. Your maximum balance is 5,000 points. Points can be redeemed for Exchange discounts (up to 50% of transaction value) or traded for a free Pro month at 1,500 points. Points have no cash value and cannot be transferred between accounts." },
              { title: "Fair Use",
                body: "Artstracker LLC reserves the right to adjust or revoke credits in cases of abuse, fraudulent transactions, or violations of the Terms of Service. The admin_adjust transaction type will appear in your history if a correction is made." },
            ].map(r => (
              <div key={r.title} className="card card-p">
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, marginBottom: 8 }}>{r.title}</h3>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{r.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Admin ── */}
        {tab === "admin" && isAdmin && (
          <div className="card card-p" style={{ maxWidth: 480 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 14 }}>🔧 Award Credits to Any Org</h3>
            <div className="fg2">
              <div className="fg fu">
                <label className="fl">Org ID</label>
                <input className="fi" value={adminOrg} onChange={e => setAdminOrg(e.target.value)} placeholder="Paste org UUID…" />
              </div>
              <div className="fg">
                <label className="fl">Amount</label>
                <input className="fi" type="number" min="1" value={adminAmt} onChange={e => setAdminAmt(e.target.value)} placeholder="50" />
              </div>
              <div className="fg fu">
                <label className="fl">Description</label>
                <input className="fi" value={adminMsg} onChange={e => setAdminMsg(e.target.value)} placeholder="Reason for adjustment…" />
              </div>
            </div>
            <button className="btn btn-g" onClick={adminAward} disabled={adminSaving || !adminOrg || !adminAmt}>
              {adminSaving ? "Awarding…" : "Award Credits"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
