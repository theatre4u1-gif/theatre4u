// BinTrove consumer sign-up / sign-in (home-inventory door).
// SEPARATE from the school AuthScreen/AuthOverlay — those are never edited.
// Only rendered when IS_BINTROVE (app.bintrove.com). Email/password only for v1
// (Google sign-in is a fast-follow). Creates the org as kind='home', home_plan='free'.
import React, { useState } from "react";
import { SB } from "./supabase.js";
import { EM } from "./messages.js";
import { CSS } from "./styles.js";
import { APP_NAME, APP_EMAIL } from "./config.js";
import { LegalModal } from "./ui.jsx";
import { TERMS_CONTENT, PRIVACY_CONTENT } from "./legal.js";
import { authErrKey } from "./helpers.js";

// BinTrove palette (kept inline so it never depends on the school CSS vars).
const TEAL = "#0F6E6B", TEAL_D = "#0A5450", GOLD = "#D3A13C", INK = "#163230", CREAM = "#FBF4E6", LINE = "#e7e2d7";

export function BinTroveAuthScreen({ onAuth }) {
  const [mode, setMode] = useState("signup");         // consumers land on sign-up
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");               // the person's name
  const [household, setHousehold] = useState("");      // optional household label
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [legal, setLegal] = useState(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const submit = async () => {
    setErr("");
    if (!email.trim()) { setErr("Please enter your email address."); return; }
    if (!pass) { setErr("Please enter a password."); return; }
    const em = email.trim().toLowerCase();
    if (mode === "signup") {
      if (!name.trim()) { setErr("Please enter your name."); return; }
      if (pass.length < 6) { setErr("Password must be at least 6 characters."); return; }
      if (!ageConfirmed) { setErr("Please confirm you are 18 or older."); return; }
      if (!termsAccepted) { setErr("Please agree to the Terms and Privacy Policy to continue."); return; }
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const homeName = household.trim() || (name.trim() ? name.trim() + "'s Home" : "My Home");
        const redirect = (typeof window !== "undefined" && window.location) ? window.location.origin : undefined;
        const { data, error } = await SB.auth.signUp({
          email: em, password: pass,
          options: { data: { org_name: homeName }, emailRedirectTo: redirect },
        });
        if (error) {
          if (error.message?.toLowerCase().includes("already registered") || error.message?.toLowerCase().includes("already exists")) {
            setMode("login"); setErr("An account with this email already exists — switching you to Sign In."); setLoading(false); return;
          }
          throw error;
        }
        // Supabase anti-enumeration: duplicate signup → no error, empty identities array.
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setMode("login"); setErr("An account with this email already exists — switching you to Sign In."); setLoading(false); return;
        }
        if (data.user) {
          // Create the HOME org. The caps trigger keys off kind='home'; home_plan='free'.
          // No temp_pro, no vertical, no state/ZIP — this is a household, not a school.
          await SB.from("orgs").upsert({
            id: data.user.id,
            name: homeName,
            email: em,
            director_name: name.trim() || null,
            type: "", phone: "", location: "", bio: "",
            kind: "home", home_plan: "free",
            vertical: "home", verticals_enabled: ["home"],
            org_type: "home", // audience for email/messaging branching — home accounts
            terms_accepted_at: new Date().toISOString(),
            terms_version: "2026-08",
          }, { onConflict: "id", ignoreDuplicates: false });
          // Funnel tracking (fire-and-forget).
          try { await SB.from("signup_events").insert({ org_id: data.user.id, referrer: (typeof document !== "undefined" ? document.referrer : null) || null }); } catch (e) {}
          // Fire the welcome email + admin notice (same path as the school signup).
          // send-sequence-email resolves the BinTrove brand + home series from the org (org_type=home).
          try {
            fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/signup-notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ org_id: data.user.id, org_email: em, is_team_member: false }),
            }).catch(() => {}); // fire and forget — never block signup
          } catch (e) {}
          if (data.session) { if (typeof onAuth === "function") onAuth(data.user); }
          else { setDone(true); }
        }
      } else {
        const { data, error } = await SB.auth.signInWithPassword({ email: em, password: pass });
        if (error) throw error;
        onAuth(data.user);
      }
    } catch (e) {
      const k = authErrKey(e.message);
      setErr(k ? EM[k].body : EM.generic.body);
    }
    setLoading(false);
  };

  const resetPass = async () => {
    if (!email) { setErr("Enter your email above first."); return; }
    try {
      await SB.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
      setErr(""); setDone(true);
    } catch (e) { setErr("Could not send the reset email. Try again."); }
  };

  const field = { width: "100%", padding: "13px 14px", fontSize: 16, border: "1.5px solid " + LINE, borderRadius: 11, background: "#fff", marginTop: 10, boxSizing: "border-box" };
  const wrap = { minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: INK };
  const card = { width: "100%", maxWidth: 420, background: "#fff", border: "1px solid " + LINE, borderRadius: 18, padding: "28px 24px", boxShadow: "0 10px 40px rgba(15,110,107,.10)" };

  if (done) return (
    <><style>{CSS}</style>
      <div style={wrap}><div style={{ ...card, textAlign: "center" }}>
        <img src="/logo-bintrove.png" alt={APP_NAME} style={{ height: 56, marginBottom: 14 }} />
        <h2 style={{ margin: "0 0 8px", color: TEAL }}>Check your email</h2>
        <p style={{ color: "#5d706d", fontSize: 15 }}>We sent a confirmation link to <b>{email}</b>. Click it to finish setting up your BinTrove account.</p>
        <button onClick={() => { setDone(false); setMode("login"); }} style={{ marginTop: 14, background: "none", border: "none", color: TEAL, fontWeight: 700, cursor: "pointer" }}>Back to sign in</button>
      </div></div>
    </>
  );

  return (
    <><style>{CSS}</style>
      <style>{`
        .btl-row{display:flex;gap:16px;justify-content:center;align-items:center;flex-wrap:wrap;width:100%;margin-top:12px}
        .btl-card{order:1}
        .btl-a{order:2}
        .btl-b{order:3}
        .btl-side{width:250px;max-width:90%;height:auto;border-radius:14px;border:1px solid #e7e2d7;box-shadow:0 6px 22px rgba(15,110,107,.08);display:block}
        @media(min-width:1000px){.btl-a{order:1}.btl-card{order:2}.btl-b{order:3}}
      `}</style>
      <div style={{ minHeight: "100vh", background: CREAM, backgroundImage: "url(/bintrove-bg-pattern.jpg)", backgroundRepeat: "repeat", backgroundSize: "680px", padding: "28px 20px 52px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", color: INK }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {mode === "signup" && <BinTroveHeader />}
        <div className="btl-row">
        {mode === "signup" && <img className="btl-side btl-a" src="/bintrove-ba-bins.jpg" alt="Before and after — every bin QR-labeled" loading="lazy" />}
        <div className="btl-card" id="bt-signup" style={card}>
          {mode === "login" && (
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <img src="/logo-bintrove.png" alt={APP_NAME} style={{ height: 58 }} />
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 13, marginTop: 6 }}>Home storage, organized.</div>
          </div>
          )}
          <h2 style={{ textAlign: "center", margin: "14px 0 2px", fontSize: 22 }}>{mode === "signup" ? "Create your free account" : "Welcome back"}</h2>
          <p style={{ textAlign: "center", color: "#5d706d", fontSize: 14, margin: "0 0 10px" }}>
            {mode === "signup" ? "3 bins free forever. No credit card." : "Sign in to find what's in every bin."}
          </p>

          {mode === "signup" && (
            <input style={field} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input style={field} type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={field} type="password" placeholder={mode === "signup" ? "Create a password (6+ characters)" : "Password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
          {mode === "signup" && (
            <input style={field} placeholder="Household name (optional)" value={household} onChange={e => setHousehold(e.target.value)} />
          )}

          {mode === "signup" && (
            <div style={{ marginTop: 14, fontSize: 13, color: "#44534f" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
                <span>I am 18 years of age or older.</span>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ marginTop: 2 }} />
                <span>I agree to the <a onClick={() => setLegal("terms")} style={{ color: TEAL, cursor: "pointer", textDecoration: "underline" }}>Terms</a> and <a onClick={() => setLegal("privacy")} style={{ color: TEAL, cursor: "pointer", textDecoration: "underline" }}>Privacy Policy</a>.</span>
              </label>
            </div>
          )}

          {err && <div style={{ marginTop: 12, background: "#fdecec", border: "1px solid #f3b4b4", color: "#9b2c2c", padding: "10px 12px", borderRadius: 10, fontSize: 14 }}>{err}</div>}

          <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 16, background: loading ? TEAL_D : TEAL, color: "#fff", border: "none", padding: "14px", fontSize: 16, fontWeight: 700, borderRadius: 11, cursor: loading ? "default" : "pointer" }}>
            {loading ? "One moment…" : (mode === "signup" ? "Start Free →" : "Sign In →")}
          </button>

          {mode === "login" && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button onClick={resetPass} style={{ background: "none", border: "none", color: "#5d706d", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Forgot password?</button>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#5d706d" }}>
            {mode === "signup" ? "Already have an account? " : "New to BinTrove? "}
            <button onClick={() => { setErr(""); setMode(mode === "signup" ? "login" : "signup"); }} style={{ background: "none", border: "none", color: TEAL, fontWeight: 700, cursor: "pointer" }}>
              {mode === "signup" ? "Sign in" : "Create a free account"}
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#9aa29e" }}>Questions? {APP_EMAIL}</div>
        </div>
        {mode === "signup" && <img className="btl-side btl-b" src="/bintrove-ba-hero.jpg" alt="Scan a bin to see what's inside" loading="lazy" />}
        </div>
        {mode === "signup" && <BinTroveChips />}
        </div>
      </div>
      {legal === "terms" && <LegalModal title="Terms of Service" onClose={() => setLegal(null)}>{TERMS_CONTENT.map(([h, b]) => <div key={h} style={{ marginBottom: 16 }}><div style={{ fontWeight: 700, color: "#d4a843", marginBottom: 4, fontSize: 13 }}>{h}</div><div>{b}</div></div>)}</LegalModal>}
      {legal === "privacy" && <LegalModal title="Privacy Policy" onClose={() => setLegal(null)}>{PRIVACY_CONTENT.map(([h, b]) => <div key={h} style={{ marginBottom: 16 }}><div style={{ fontWeight: 700, color: "#d4a843", marginBottom: 4, fontSize: 13 }}>{h}</div><div>{b}</div></div>)}</LegalModal>}
    </>
  );
}

// Header shown ABOVE the flanked signup row for new visitors: brand + pitch.
function BinTroveHeader() {
  const TEALc = "#0F6E6B", GOLDc = "#D3A13C", MUTc = "#5d706d", INKc = "#163230";
  return (
    <div style={{ textAlign: "center", marginBottom: 2 }}>
      <img src="/logo-bintrove.png" alt="BinTrove" style={{ height: 92 }} />
      <div style={{ color: GOLDc, fontWeight: 700, fontSize: 13, marginTop: 6 }}>Home storage, organized.</div>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: INKc, margin: "14px auto 0", maxWidth: 640, lineHeight: 1.15 }}>
        Know what's in <span style={{ color: TEALc }}>every bin</span> — without opening a single one.
      </h1>
      <p style={{ color: MUTc, fontSize: 16, maxWidth: 560, margin: "10px auto 0", lineHeight: 1.5 }}>
        Snap a photo, print a QR label, and scan any bin to see everything inside. Garage, closet, attic, or a whole move.
      </p>
    </div>
  );
}

// Trust chips shown below the flanked signup row.
function BinTroveChips() {
  const chip = { color: "#5d706d", fontSize: 13.5, fontWeight: 600 };
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", margin: "18px auto 0" }}>
      <span style={chip}>&#10003; 3 bins free forever</span>
      <span style={chip}>&#10003; No credit card</span>
      <span style={chip}>&#10003; Set up in minutes</span>
    </div>
  );
}
