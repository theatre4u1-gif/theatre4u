// Data health panel (Phase 8 admin app). Surfaces data anomalies automatically so the numbers can
// be trusted — duplicate records, activity without a login, unusual statuses, and billing conflicts.
// Read-only detection; each flagged program opens the support console for a fix.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { ProgramDetail } from "./admin-program.jsx";

const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const planTxt = (o) => o.stripe_subscription_id ? "Paying" : o.founding_member ? "Founding" : o.temp_pro ? "Beta" : (o.plan || "free");

export function DataHealthDashboard() {
  const [orgs, setOrgs] = useState(null);
  const [err, setErr] = useState("");
  const [detailOrg, setDetailOrg] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [orgsRes, usageRes] = await Promise.all([
          SB.from("orgs").select("id,name,email,plan,temp_pro,founding_member,stripe_subscription_id,account_status,deleted_at,last_seen,owner_id,created_at"),
          SB.from("org_platform_usage").select("org_id,total_items"),
        ]);
        if (!alive) return;
        if (orgsRes.error) throw orgsRes.error;
        const items = {}; (usageRes.data || []).forEach(u => { items[u.org_id] = u.total_items || 0; });
        setOrgs((orgsRes.data || []).filter(o => !o.deleted_at).map(o => ({ ...o, _items: items[o.id] || 0 })));
      } catch (e) { if (alive) setErr(e.message || String(e)); }
    })();
    return () => { alive = false; };
  }, []);

  if (detailOrg) return <ProgramDetail org={detailOrg} onBack={() => setDetailOrg(null)} onChanged={(id, p) => setOrgs(prev => prev.map(x => x.id === id ? { ...x, ...p } : x))} />;
  if (err) return <div style={{ padding: 24, color: "#c0392b" }}>Couldn't load data health: {err}</div>;
  if (!orgs) return <div style={{ padding: 24, color: "#888" }}>Running checks…</div>;

  // group helper for duplicate detection
  const groupsBy = (keyFn) => {
    const m = {};
    orgs.forEach(o => { const k = keyFn(o); if (!k) return; (m[k] = m[k] || []).push(o); });
    return Object.entries(m).filter(([, list]) => list.length > 1).map(([k, list]) => ({ k, list }));
  };
  const dupNames = groupsBy(o => norm(o.name));
  const dupEmails = groupsBy(o => norm(o.email));
  const noLogin = orgs.filter(o => o._items > 0 && !o.last_seen);
  const weirdStatus = orgs.filter(o => o.account_status && !["active", "closed"].includes(o.account_status));
  const paidBeta = orgs.filter(o => o.stripe_subscription_id && o.temp_pro);
  const noOwner = orgs.filter(o => !o.owner_id);

  const totalFlags = dupNames.length + dupEmails.length + noLogin.length + weirdStatus.length + paidBeta.length + noOwner.length;

  const progLine = (o, extra) => (
    <div key={o.id} onClick={() => setDetailOrg(o)} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderBottom: "1px solid #f0ece3", cursor: "pointer", fontSize: 13 }}>
      <span><span style={{ fontWeight: 700, color: "#a5731f", textDecoration: "underline" }}>{o.name || "(no name)"}</span> <span style={{ color: "#9a9284" }}>· {planTxt(o)} · {o._items} items{o.account_status ? " · " + o.account_status : ""}</span></span>
      <span style={{ color: "#9a9284", whiteSpace: "nowrap" }}>{extra}</span>
    </div>
  );

  const Section = ({ title, desc, sev, count, children }) => (
    <div style={{ background: "#fff", border: "1px solid #e6e0d6", borderRadius: 12, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: count === 0 ? "#1a7f37" : sev === "warn" ? "#c07a00" : "#8a8272" }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#2a2a2a" }}>{title}</h3>
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: count === 0 ? "#1a7f37" : "#c07a00" }}>{count === 0 ? "✓ clear" : count + " flagged"}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "#8a8272", marginBottom: count ? 12 : 0, lineHeight: 1.5 }}>{desc}</div>
      {count > 0 && children}
    </div>
  );

  const grp = (g, label) => (
    <div key={g.k} style={{ border: "1px solid #eee6d9", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      <div style={{ background: "#faf7f1", padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "#6b6459" }}>{label}: “{g.list[0].name || g.k}” · {g.list.length} records</div>
      {g.list.map(o => progLine(o, ""))}
    </div>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 14px" }}>
        Automatic checks that keep the numbers trustworthy. {totalFlags === 0 ? "Everything looks clean." : totalFlags + " thing" + (totalFlags === 1 ? "" : "s") + " to look at. Click any program to open its console."}
      </p>

      <Section title="Duplicate program names" sev="warn" count={dupNames.length}
        desc="Multiple programs share the same name — usually leftover duplicate signups. Keep the real one, close the empties.">
        {dupNames.map(g => grp(g, "Name"))}
      </Section>

      <Section title="Duplicate contact emails" sev="warn" count={dupEmails.length}
        desc="Same email on more than one program — may be duplicates or one person running several.">
        {dupEmails.map(g => grp(g, "Email"))}
      </Section>

      <Section title="Activity but no owner sign-in" sev="info" count={noLogin.length}
        desc="Has inventory but the account owner has never signed in — normal for districts/team-run programs (members log in). Flagged so 'active' counts read right.">
        {noLogin.map(o => progLine(o, o._items + " items"))}
      </Section>

      <Section title="Unusual account status" sev="warn" count={weirdStatus.length}
        desc="Status isn't the usual active/closed (e.g. paused). Worth confirming it's intentional.">
        {weirdStatus.map(o => progLine(o, o.account_status))}
      </Section>

      <Section title="Marked beta but also paying" sev="warn" count={paidBeta.length}
        desc="Has a Stripe subscription AND the free-beta flag — could mean they're being given free access while also paying.">
        {paidBeta.map(o => progLine(o, "paying + beta"))}
      </Section>

      <Section title="Missing owner" sev="warn" count={noOwner.length}
        desc="No owner_id set (post owner-model). May need reassigning so the right person controls the account.">
        {noOwner.map(o => progLine(o, "no owner"))}
      </Section>
      <div style={{ height: 30 }} />
    </div>
  );
}
