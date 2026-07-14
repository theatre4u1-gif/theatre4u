// Standalone admin app (Phase 8) — served on admin.artstracker.org (see IS_ADMIN_HOST in config.js).
// Self-contained: email/password sign-in, platform_admins gate, then the admin modules.
// First module: Content & Brand editor. Future: billing dashboard, business finance, etc.
import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { ContentBrandEditor } from "./content-editor.jsx";
import { OverviewDashboard } from "./admin-overview.jsx";
import { UsageDashboard } from "./admin-usage.jsx";
import { DataHealthDashboard } from "./admin-health.jsx";

const PAGE_BG = "#f4f1ea";

const box = { fontFamily: "'DM Sans', -apple-system, Segoe UI, Roboto, sans-serif", color: "#2a2a2a" };

function Centered({ children }) {
  return (
    <div style={{ ...box, minHeight: "100vh", background: PAGE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {children}
    </div>
  );
}

function Login({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true); setErr("");
    const { error } = await SB.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) { setErr(error.message); setBusy(false); return; }
    onSignedIn?.();
    setBusy(false);
  };
  const signInGoogle = async () => {
    setBusy(true); setErr("");
    const { error } = await SB.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    if (error) { setErr(error.message); setBusy(false); }
    // on success the browser redirects to Google, then back here
  };
  const inp = { width: "100%", padding: "11px 12px", borderRadius: 8, border: "1px solid #d5cfc4", fontSize: 14, boxSizing: "border-box", marginBottom: 12, fontFamily: "inherit" };
  return (
    <Centered>
      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e6e0d6", borderRadius: 14, padding: 30, width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Admin</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Theatre4u · ArtsTracker — platform admin only</div>
        <button type="button" onClick={signInGoogle} disabled={busy}
          style={{ width: "100%", padding: "11px 12px", borderRadius: 8, border: "1px solid #d5cfc4", background: "#fff", color: "#333", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 16 }}>
          <span style={{ fontWeight: 800, color: "#4285F4", fontSize: 16 }}>G</span> Continue with Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 16px", color: "#bbb", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "#e6e0d6" }} />or<div style={{ flex: 1, height: 1, background: "#e6e0d6" }} />
        </div>
        <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={inp} type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} />
        {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", padding: "11px 12px", borderRadius: 8, border: "none", background: busy ? "#c9bfa0" : "#c4922a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Centered>
  );
}

const MODULES = [
  { id: "overview", label: "Overview" },
  { id: "usage", label: "Usage" },
  { id: "health", label: "Data health" },
  { id: "content", label: "Content & Brand" },
  // future: { id:"billing", label:"Billing" }, { id:"finance", label:"Business Finance" }, ...
];

export function AdminApp() {
  const [phase, setPhase] = useState("loading"); // loading | login | denied | ok
  const [user, setUser] = useState(null);
  const [mod, setMod] = useState("overview");

  const check = async () => {
    const { data: { session } } = await SB.auth.getSession();
    const u = session?.user || null;
    setUser(u);
    if (!u) { setPhase("login"); return; }
    const { data } = await SB.from("platform_admins").select("id").eq("id", u.id).maybeSingle();
    setPhase(data ? "ok" : "denied");
  };

  useEffect(() => {
    check();
    const { data: sub } = SB.auth.onAuthStateChange(() => check());
    return () => { try { sub?.subscription?.unsubscribe?.(); } catch (e) {} };
  }, []);

  const signOut = async () => { await SB.auth.signOut(); setUser(null); setPhase("login"); };

  if (phase === "loading") return <Centered><div style={{ color: "#999" }}>Loading…</div></Centered>;
  if (phase === "login")   return <Login onSignedIn={check} />;
  if (phase === "denied")  return (
    <Centered>
      <div style={{ background: "#fff", border: "1px solid #e6e0d6", borderRadius: 14, padding: 30, maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Not authorized</div>
        <div style={{ fontSize: 13, color: "#777", marginBottom: 18 }}>{user?.email} is not a platform admin.</div>
        <button onClick={signOut} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #d5cfc4", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Sign out</button>
      </div>
    </Centered>
  );

  // Authorized admin shell
  return (
    <div style={{ ...box, minHeight: "100vh", background: PAGE_BG }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", background: "#1a0f06", color: "#f0e6d3" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#e8b85d" }}>Admin</span>
          <nav style={{ display: "flex", gap: 6 }}>
            {MODULES.map(m => (
              <button key={m.id} onClick={() => setMod(m.id)}
                style={{ padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: mod === m.id ? "#c4922a" : "transparent", color: mod === m.id ? "#1a0f06" : "rgba(240,230,211,.75)" }}>
                {m.label}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          <span style={{ color: "rgba(240,230,211,.6)" }}>{user?.email}</span>
          <button onClick={signOut} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(240,230,211,.25)", background: "transparent", color: "rgba(240,230,211,.85)", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Sign out</button>
        </div>
      </header>
      <main style={{ padding: "26px 20px 60px" }}>
        {mod === "overview" && <OverviewDashboard />}
        {mod === "usage" && <UsageDashboard />}
        {mod === "health" && <DataHealthDashboard />}
        {mod === "content" && <ContentBrandEditor userId={user?.id} />}
      </main>
    </div>
  );
}
