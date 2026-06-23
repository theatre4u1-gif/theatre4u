// SETTINGS — extracted from App.jsx (modularization).
// Components: TeamSettings, QRPrivacySettings, SelfServiceDeleteAccount,
// CustomCategoriesManager, Settings (+ ROLES, ROLE_MAP). Only Settings is
// rendered by App.jsx; the rest are module-internal.
import React, { useState, useEffect, useCallback } from "react";
import { SB, callEdgeFn } from "./supabase.js";
import { EM } from "./messages.js";
import { Ic } from "./icons.jsx";
import { UpgradePlans } from "./billing.jsx";
import { isAdminEmail } from "./config.js";
import { setCustomCats } from "./inventory.js";
import { VERTICALS_LIST } from "../lib/verticals.js";
import { PLANS_DEF } from "./plans.js";
import { QR } from "./qr.js";
import { BG, usp } from "../lib/backgrounds.js";
import { US_STATES, STATE_NAMES, geocodeLocation } from "../lib/geo.js";

// ══════════════════════════════════════════════════════════════════════════════
// TEAM SETTINGS — Org member management with backstage roles
// ══════════════════════════════════════════════════════════════════════════════
const ROLES = [
  { id: "stage_manager", label: "Stage Manager", icon: "📋", desc: "Add, edit, delete items · Funding Tracker · Backstage Exchange · Community" },
  { id: "crew",          label: "Crew",          icon: "🔧", desc: "Add and edit items · Upload photos" },
  { id: "house",         label: "House",         icon: "🎟", desc: "View and look up items only" },
];
const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r]));

function TeamSettings({ userId, orgName, plan }) {
  const [members,  setMembers]  = useState([]);
  const [invites,  setInvites]  = useState([]);
  const [joinCode, setJoinCode] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("crew");
  const [sending,  setSending]  = useState(false);
  const [msg,      setMsg]      = useState("");
  const [showCode, setShowCode] = useState(false);
  const [qrUrl,    setQrUrl]    = useState(null);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const inviteUrl = joinCode ? `https://theatre4u.org/invite.html?code=${joinCode}` : null;

  // Generate a QR image for the join link whenever the code is available.
  // Retries a few times — the QR generator loads from a CDN and can fail the
  // first time; if it never succeeds we just fall back to the code + link.
  useEffect(() => {
    if (!joinCode) { setQrUrl(null); return; }
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        const url = await QR.toDataURL(inviteUrl, 240);
        if (cancelled) return;
        if (url) { setQrUrl(url); return; }
        await new Promise(r => setTimeout(r, 700));
      }
    })();
    return () => { cancelled = true; };
  }, [joinCode]); // eslint-disable-line

  // Open a print-ready sheet for posting in the costume room. Includes the QR if
  // it generated; otherwise prints the code + link so the sheet is still usable.
  const printQR = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const qrBlock = qrUrl
      ? `<p style="font-size:15px;color:#555;margin:0 0 24px">Scan with your phone camera to sign up as crew.</p>
         <img src="${qrUrl}" width="300" height="300" style="display:block;margin:0 auto"/>`
      : `<p style="font-size:15px;color:#555;margin:0 0 24px">Enter this code at theatre4u.org to sign up as crew.</p>`;
    w.document.write(`<!DOCTYPE html><html><head><title>Join ${orgName} on Theatre4u</title></head>
      <body style="font-family:Arial,sans-serif;text-align:center;padding:48px 24px;color:#1a1200">
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#d4a843">🎭 Theatre4u</div>
        <h1 style="font-size:26px;margin:10px 0 4px">Join the ${orgName} team</h1>
        ${qrBlock}
        <p style="font-size:22px;font-weight:800;letter-spacing:4px;margin:18px 0 2px">${joinCode}</p>
        <p style="font-size:13px;color:#888;margin:0">Or visit theatre4u.org/invite.html?code=${joinCode}</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  // Load team
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: mData }, { data: iData }] = await Promise.all([
      SB.from("org_members").select("*").eq("org_id", userId).order("created_at"),
      SB.from("org_invites").select("*").eq("org_id", userId)
        .is("accepted_at", null).order("created_at", { ascending: false }),
    ]);
    setMembers(mData || []);
    // Find existing join code invite
    const code = (iData || []).find(i => i.invite_type === "code");
    setJoinCode(code?.join_code || null);
    setInvites((iData || []).filter(i => i.invite_type === "email"));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Generate or show join code
  const getJoinCode = async () => {
    if (joinCode) { setShowCode(true); return; }
    // Insert — DB trigger auto-generates join_code
    const { error } = await SB.from("org_invites").insert({
      org_id: userId,
      role: "crew",
      invite_type: "code",
      is_permanent: true,
      expires_at: new Date(Date.now() + 365*24*60*60*1000).toISOString(), // 1 year
    });
    if (error) { flash("❌ Could not generate join code. Try again."); return; }
    // Re-fetch the newly created code invite (RLS: org_id = auth.uid())
    const { data: fetched } = await SB.from("org_invites")
      .select("join_code")
      .eq("org_id", userId)
      .eq("invite_type", "code")
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (fetched?.join_code) {
      setJoinCode(fetched.join_code);
      setShowCode(true);
    } else {
      flash("❌ Code generated but couldn't load — try refreshing.");
    }
  };

  // Send email invite
  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    // Step 1: Insert the invite row
    const { data, error } = await SB.from("org_invites").insert({
      org_id: userId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invite_type: "email",
    }).select().single();
    if (error || !data) {
      flash("❌ " + EM.sendInvite.body);
      setSending(false);
      return;
    }
    setInvites(p => [data, ...p]);
    setInviteEmail("");
    // Step 2: Call edge function to send the email
    try {
      const { data: { session } } = await SB.auth.getSession();
      const res = await fetch(
        "https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/team-invite",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + session?.access_token,
          },
          body: JSON.stringify({ invite_id: data.id }),
        }
      );
      const result = await res.json();
      if (result.email_sent) {
        flash("✓ Invite email sent to " + data.email);
      } else {
        flash("✓ Invite saved — copy the link below to share manually");
      }
    } catch {
      flash("✓ Invite saved — copy the link below to share manually");
    }
    setSending(false);
  };

  // Remove a member
  const removeMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from your team?`)) return;
    await SB.from("org_members").delete().eq("id", memberId);
    setMembers(p => p.filter(m => m.id !== memberId));
    flash("✓ Removed from team");
  };

  // Cancel a pending invite
  const cancelInvite = async (inviteId) => {
    await SB.from("org_invites").delete().eq("id", inviteId);
    setInvites(p => p.filter(i => i.id !== inviteId));
    flash("✓ Invite cancelled");
  };

  // Change a member's role
  const changeRole = async (memberId, newRole) => {
    await SB.from("org_members").update({ role: newRole }).eq("id", memberId);
    setMembers(p => p.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    flash("✓ Role updated");
  };

  const joinUrl = joinCode ? `theatre4u.org/invite.html?code=${joinCode}` : null;

  return (
    <div className="card card-p" style={{ marginBottom: 20 }}>
      <div className="sh">
        <h2>🎭 Your Backstage Team</h2>
        <p>Invite people to help manage your inventory. Each role has different access levels.</p>
      </div>

      {/* Role legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {[{ id: "director", label: "Director", icon: "🎬", desc: "Full access — that's you" }, ...ROLES].map(r => (
          <div key={r.id} style={{ background: "var(--parch)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 12px", minWidth: 160 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{r.icon} {r.label}</div>
            <div style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.4 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Current members */}
      {loading ? (
        <div style={{ color: "var(--faint)", fontSize: 13, padding: "12px 0" }}>Loading team…</div>
      ) : members.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
            color: "var(--faint)", marginBottom: 8 }}>Current Team</div>
          {members.map(m => {
            const r = ROLE_MAP[m.role] || { label: m.role, icon: "👤" };
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "9px 0", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--parch)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.email}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>
                    Joined {new Date(m.joined_at).toLocaleDateString()}
                  </div>
                </div>
                <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                  style={{ background: "var(--parch)", border: "1px solid var(--bd)", borderRadius: 6,
                    padding: "4px 8px", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}>
                  {[{ id: "director", label: "Co-Director", icon: "🎬" }, ...ROLES].map(ro => <option key={ro.id} value={ro.id}>{ro.icon} {ro.label}</option>)}
                </select>
                <button onClick={() => removeMember(m.id, m.email)}
                  style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer",
                    fontSize: 18, lineHeight: 1, padding: "0 4px" }} title="Remove">×</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "var(--faint)", fontSize: 13, marginBottom: 20, fontStyle: "italic" }}>
          No team members yet — invite someone below.
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
            color: "var(--faint)", marginBottom: 8 }}>Pending Invites</div>
          {invites.map(inv => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--bd)" }}>
              <div style={{ fontSize: 15 }}>✉️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.email}</div>
                <div style={{ fontSize: 11, color: "var(--faint)" }}>
                  {ROLE_MAP[inv.role]?.label} · Expires {new Date(inv.expires_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => {
                const url = `https://theatre4u.org/invite.html?token=${inv.token}`;
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(url)
                    .then(() => flash("✓ Invite link copied!"))
                    .catch(() => { prompt("Copy this link:", url); });
                } else { prompt("Copy this link:", url); }
              }} style={{ background: "var(--parch)", border: "1px solid var(--bd)", borderRadius: 6,
                color: "var(--muted)", padding: "4px 10px", cursor: "pointer", fontSize: 11,
                fontFamily: "inherit" }}>Copy Link</button>
              <button onClick={() => cancelInvite(inv.id)}
                style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer",
                  fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Invite by email */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
          color: "var(--faint)", marginBottom: 8 }}>Invite by Email</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="fi" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@school.edu" type="email"
            onKeyDown={e => e.key === "Enter" && sendInvite()}
            style={{ flex: "1 1 200px", minWidth: 0 }}/>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            className="fs" style={{ flex: "0 0 auto", minWidth: 130 }}>
            {[{ id: "director", label: "Co-Director", icon: "🎬" }, ...ROLES].map(r => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
          </select>
          <button className="btn bp" onClick={sendInvite} disabled={sending || !inviteEmail.trim()}
            style={{ whiteSpace: "nowrap" }}>
            {sending ? "Sending…" : "Send Invite"}
          </button>
        </div>
        {inviteEmail && (
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 6 }}>
            They'll get a link to join your team at <strong>{orgName}</strong> as <strong>{ROLE_MAP[inviteRole]?.label || (inviteRole === "director" ? "Co-Director" : inviteRole)}</strong>.
          </div>
        )}
      </div>

      {/* Join code */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
          color: "var(--faint)", marginBottom: 8 }}>Join Code — For Groups & Students</div>
        {!showCode ? (
          <button className="btn bs" onClick={getJoinCode}>
            🔑 Generate Join Code
          </button>
        ) : (
          <div style={{ background: "var(--parch)", border: "1px solid var(--bd)", borderRadius: 12,
            padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {qrUrl && (
                <div style={{ textAlign: "center" }}>
                  <img src={qrUrl} alt="Join QR code" width={108} height={108}
                    style={{ display: "block", borderRadius: 8, background: "#fff", padding: 4 }}/>
                  <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 3 }}>Scan to join</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>Share this code</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 900,
                  letterSpacing: 4, color: "var(--goldink)" }}>{joinCode}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>Or share this link</div>
                <div style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
                  theatre4u.org/invite.html?code={joinCode}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="btn bs bsm" onClick={() => {
                  navigator.clipboard?.writeText(inviteUrl)
                    .then(() => flash("✓ Link copied to clipboard!"))
                    .catch(() => flash("✓ Link: " + inviteUrl));
                  flash("✓ Link copied!");
                }}>Copy Link</button>
                <button className="btn bs bsm" onClick={printQR}>🖨 Print {qrUrl ? "QR" : "Code"}</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12, lineHeight: 1.5 }}>
              Anyone with this code joins as <strong>Crew</strong> — they can add and edit items.
              Post it in your costume room or send it to your team. Expires in 30 days.
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: msg.startsWith("❌") ? "#7f1d1d" : "#14532d",
          color: "#fff", padding: "10px 22px", borderRadius: 10,
          fontSize: 14, fontWeight: 700, boxShadow: "0 4px 20px rgba(0,0,0,.35)",
          whiteSpace: "nowrap", pointerEvents: "none",
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}



// ── QR Code Privacy Settings ─────────────────────────────────────────────────
function QRPrivacySettings({ org, setOrg, userId }) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const privacy       = org?.qr_privacy       ?? "contact";
  const contactFields = org?.qr_contact_fields ?? ["name","email"];

  const togglePrivacy = async (val) => {
    setSaving(true);
    const { error } = await SB.from("orgs").update({ qr_privacy: val }).eq("id", userId);
    if (!error) setOrg(p => ({ ...p, qr_privacy: val }));
    setSaving(false);
  };

  const toggleField = async (field) => {
    const current = Array.isArray(contactFields) ? contactFields : ["name","email"];
    const next    = current.includes(field) ? current.filter(f => f !== field) : [...current, field];
    setSaving(true);
    const { error } = await SB.from("orgs").update({ qr_contact_fields: next }).eq("id", userId);
    if (!error) { setOrg(p => ({ ...p, qr_contact_fields: next })); setSaved(true); setTimeout(()=>setSaved(false),2000); }
    setSaving(false);
  };

  const fields = [
    { key:"name",     label:"Organization Name",  always: true },
    { key:"email",    label:"Email Address" },
    { key:"phone",    label:"Phone Number" },
    { key:"location", label:"City / Location" },
    { key:"bio",      label:"About / Bio" },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Privacy mode toggle */}
      <div style={{display:"flex",gap:0,border:"1px solid var(--border)",borderRadius:8,overflow:"hidden",width:"fit-content"}}>
        {[{v:"contact",label:"🔒 Contact Only",desc:"Show org contact info only"},{v:"public",label:"🌐 Public Details",desc:"Show full item details"}].map(opt=>(
          <button key={opt.v} onClick={()=>togglePrivacy(opt.v)} style={{
            background: privacy===opt.v ? "var(--gold)" : "transparent",
            color:      privacy===opt.v ? "#1a0f00" : "var(--muted)",
            border:"none", padding:"9px 18px", cursor:"pointer",
            fontFamily:"inherit", fontSize:13, fontWeight:700, transition:"all .15s"
          }}>{opt.label}</button>
        ))}
      </div>
      <p style={{fontSize:12.5,color:"var(--muted)",lineHeight:1.6,margin:0}}>
        {privacy === "contact"
          ? "When someone scans a QR label they are NOT a team member of, they will see your contact info and a prompt to sign in or request access."
          : "Full item details are visible to anyone who scans a QR label — no sign-in required."}
      </p>

      {/* Contact fields (only relevant in contact mode) */}
      {privacy === "contact" && (
        <div>
          <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:10}}>
            Information shown to scanner
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {fields.map(f => {
              const checked = f.always || (Array.isArray(contactFields) && contactFields.includes(f.key));
              return (
                <label key={f.key} style={{display:"flex",alignItems:"center",gap:10,cursor:f.always?"default":"pointer",opacity:f.always?.6:1}}>
                  <div onClick={()=>!f.always&&toggleField(f.key)} style={{
                    width:18, height:18, borderRadius:4,
                    background: checked ? "var(--gold)" : "transparent",
                    border: checked ? "2px solid var(--gold)" : "2px solid var(--border)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    flexShrink:0, cursor:f.always?"default":"pointer", transition:"all .15s"
                  }}>
                    {checked && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" fill="none" stroke="#1a0f00" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{fontSize:13.5,color:"var(--text)"}}>{f.label}</span>
                  {f.always && <span style={{fontSize:11,color:"var(--faint)"}}>always shown</span>}
                </label>
              );
            })}
          </div>
          {saved && <div style={{fontSize:12,color:"var(--grn,#4caf50)",marginTop:8,fontWeight:600}}>✓ Saved</div>}
          <p style={{fontSize:12,color:"var(--faint)",lineHeight:1.6,marginTop:10}}>
            Only the fields you check above will be visible to someone who scans a QR label. Your email is always the primary way for them to request access.
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELF-SERVICE ACCOUNT DELETION (owner-initiated, 30-day soft close)
// ══════════════════════════════════════════════════════════════════════════════
function SelfServiceDeleteAccount({ user, org }) {
  const [open,    setOpen]    = useState(false);
  const [reason,  setReason]  = useState("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [done,    setDone]    = useState(false);
  const [err,     setErr]     = useState("");
  const CONFIRM_WORD = "CLOSE";

  if (done) return (
    <div style={{ background:"rgba(76,175,80,.08)",border:"1px solid rgba(76,175,80,.25)",
      borderRadius:9,padding:"14px 16px",fontSize:13,lineHeight:1.7 }}>
      <div style={{ fontWeight:700,fontSize:15,marginBottom:4 }}>✅ Account Closed</div>
      <div>Your subscription has been canceled and your account is now closed.
        A confirmation email has been sent to <strong>{org?.email}</strong>.</div>
      <div style={{ marginTop:8,color:"var(--muted)" }}>
        Your data will be permanently deleted in 30 days.
        To restore your account before then, email <strong>hello@theatre4u.org</strong>.
      </div>
    </div>
  );

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ padding:"9px 18px",borderRadius:8,fontFamily:"inherit",fontWeight:700,
        fontSize:13,cursor:"pointer",background:"rgba(194,24,91,.08)",
        border:"1px solid rgba(194,24,91,.3)",color:"var(--red)" }}>
      Close My Account →
    </button>
  );

  const submit = async () => {
    if (confirm !== CONFIRM_WORD) { setErr(`Type ${CONFIRM_WORD} to confirm`); return; }
    setWorking(true); setErr("");
    const { data: { session } } = await SB.auth.getSession();
    const result = await callEdgeFn("close-org", {
      org_id: user.id, reason: reason || "Owner requested", action: "close", is_admin_action: false
    }, session?.access_token);
    if (result?.success) {
      setDone(true);
      // Sign out after a short delay
      setTimeout(() => SB.auth.signOut(), 3500);
    } else {
      setErr(result?.error || "Something went wrong. Email hello@theatre4u.org for help.");
      setWorking(false);
    }
  };

  return (
    <div style={{ background:"rgba(194,24,91,.05)",border:"1px solid rgba(194,24,91,.2)",
      borderRadius:10,padding:"16px" }}>
      <div style={{ fontWeight:700,fontSize:14,marginBottom:10,color:"var(--red)" }}>
        Confirm Account Closure
      </div>
      <div className="fg" style={{ marginBottom:12 }}>
        <label className="fl">Why are you closing your account? (optional)</label>
        <textarea className="ft" value={reason} onChange={e=>setReason(e.target.value)}
          placeholder="Switching tools, program ended, budget cuts…" rows={2} />
      </div>
      <div className="fg" style={{ marginBottom:12 }}>
        <label className="fl">
          Type <strong style={{ color:"var(--red)",fontFamily:"monospace",letterSpacing:2 }}>{CONFIRM_WORD}</strong> to confirm
        </label>
        <input className="fi" value={confirm}
          onChange={e=>setConfirm(e.target.value.toUpperCase())}
          placeholder={CONFIRM_WORD}
          style={{ fontFamily:"monospace",letterSpacing:3 }} />
      </div>
      {err && <div style={{ color:"var(--red)",fontSize:12,marginBottom:10 }}>{err}</div>}
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={()=>{setOpen(false);setConfirm("");setReason("");setErr("");}}
          className="btn btn-o">Cancel</button>
        <button onClick={submit} disabled={working || confirm !== CONFIRM_WORD}
          style={{ padding:"8px 18px",borderRadius:8,fontFamily:"inherit",fontWeight:800,
            fontSize:13,cursor:working||confirm!==CONFIRM_WORD?"not-allowed":"pointer",
            background:confirm===CONFIRM_WORD?"rgba(194,24,91,.8)":"rgba(194,24,91,.15)",
            color:confirm===CONFIRM_WORD?"#fff":"var(--red)",border:"1px solid rgba(194,24,91,.4)",
            opacity:working?.5:1 }}>
          {working ? "Closing account…" : "Close My Account"}
        </button>
      </div>
    </div>
  );
}

function CustomCategoriesManager({ org, userId, memberRole=null }){
  const vertical = org?.vertical || "theatre";
  const CAT_EXAMPLE = { theatre:"Concessions", music:"Sheet Music", dance:"Recital Props", art:"Canvases", booster:"Merchandise" };
  const catExample = CAT_EXAMPLE[vertical] || "Concessions";
  const canManage = !memberRole || memberRole==="director" || memberRole==="program_director";
  const [list,setList] = useState([]);
  const [label,setLabel] = useState("");
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState("");
  const refresh = async()=>{
    if(!org?.id) return;
    const { data } = await SB.from("org_categories").select("id,vertical,label").eq("org_id", org.id);
    const all = data||[];
    setCustomCats(all);
    setList(all.filter(c=>c.vertical===vertical));
  };
  useEffect(()=>{ refresh(); },[org?.id, vertical]);
  const add = async()=>{
    const name = label.trim();
    if(!name) return;
    setBusy(true); setErr("");
    const { error } = await SB.from("org_categories").insert({ org_id:org.id, vertical, label:name, created_by:userId });
    setBusy(false);
    if(error){ setErr((error.code==="23505"||(error.message||"").includes("duplicate")) ? "That category already exists." : "Couldn't add category. Please try again."); return; }
    setLabel(""); refresh();
  };
  const del = async(id,nm)=>{
    if(!window.confirm("Delete the category \""+nm+"\"? Items already in it will show as \"Other\" until you re-categorize them.")) return;
    const { error } = await SB.from("org_categories").delete().eq("id", id);
    if(!error) refresh();
  };
  if(!canManage) return <p style={{fontSize:13,color:"var(--muted)"}}>Only the account owner or a director can manage custom categories.</p>;
  return(
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <input className="fs" style={{flex:1,minWidth:200}} placeholder={`New category name (e.g. ${catExample})`} value={label}
          onChange={e=>setLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")add();}} maxLength={40}/>
        <button className="btn btn-p" disabled={busy||!label.trim()} onClick={add}>Add</button>
      </div>
      {err&&<p style={{fontSize:12,color:"var(--red)",marginBottom:8}}>{err}</p>}
      {list.length===0
        ? <p style={{fontSize:13,color:"var(--muted)"}}>No custom categories yet. Add one above — it'll appear alongside the built-in categories when you add or edit items.</p>
        : <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {list.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"rgba(255,255,255,.04)",borderRadius:6}}>
                <span style={{fontSize:14}}>📦 {c.label}</span>
                <button className="btn btn-d btn-sm" onClick={()=>del(c.id,c.label)}>Remove</button>
              </div>
            ))}
          </div>}
      <p style={{fontSize:11,color:"var(--muted)",marginTop:12,fontStyle:"italic"}}>Custom categories use a default 📦 icon and apply to this program's {vertical} inventory.</p>
    </div>
  );
}
function DepartmentsManager({ org, setOrg, userId, plan="free", memberRole=null }){
  const canManage = !memberRole || memberRole==="director" || memberRole==="program_director";
  const primary = org?.vertical || "theatre";
  const enabled = (org?.verticals_enabled?.length ? org.verticals_enabled : [primary]);
  const multiAllowed = !!PLANS_DEF[plan]?.allVerticals || enabled.length > 1; // ArtsTracker plan, or already multi (e.g. comped)
  const [saving,setSaving] = useState(null);
  const toggle = async(vid)=>{
    if(vid===primary || !multiAllowed) return;            // home department always on; locked on single plans
    const next = enabled.includes(vid) ? enabled.filter(v=>v!==vid) : [...enabled, vid];
    if(next.length===0) return;                            // never empty
    setSaving(vid);
    const { error } = await SB.from("orgs").update({ verticals_enabled: next }).eq("id", userId);
    setSaving(null);
    if(!error) setOrg(p=>({ ...p, verticals_enabled: next }));
  };
  if(!canManage) return <p style={{fontSize:13,color:"var(--muted)"}}>Only the account owner or a director can manage departments.</p>;
  return(
    <div>
      <p style={{fontSize:13,color:"var(--muted)",marginBottom:12}}>
        {multiAllowed
          ? "Choose which arts departments are open in your account. Toggle any on or off — your home department always stays on. Switch between open departments from the sidebar."
          : "Your plan includes one department. Upgrade to ArtsTracker to open Music, Dance, Visual Art, and Organizations too."}
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {VERTICALS_LIST.map(v=>{
          const isPrimary=v.id===primary, isOn=enabled.includes(v.id), locked=!multiAllowed&&!isPrimary;
          return(
            <div key={v.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"rgba(255,255,255,.04)",borderRadius:6,opacity:locked?0.6:1}}>
              <span style={{fontSize:14}}>{v.icon} {v.label}{isPrimary&&<span style={{fontSize:11,color:"var(--muted)",marginLeft:6}}>· home</span>}</span>
              {locked
                ? <span style={{fontSize:11,color:"var(--goldink)",fontWeight:700}}>🔒 ArtsTracker</span>
                : <button onClick={()=>toggle(v.id)} disabled={isPrimary||saving===v.id}
                    title={isPrimary?"Your home department is always open":(isOn?"Turn off":"Turn on")}
                    style={{width:44,height:24,borderRadius:99,border:"none",cursor:isPrimary?"default":"pointer",position:"relative",flexShrink:0,
                      background:isOn?"var(--gold)":"rgba(255,255,255,.18)",transition:"background .2s",opacity:isPrimary?0.7:1}}>
                    <span style={{position:"absolute",top:2,left:isOn?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
                  </button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function Settings({ org, setOrg, onSeed, user, userId, items, setItems, plan="free", userEmail="", setPlan, memberRole=null }) {
  const [f,setF]       = useState(org);
  const [saved,setSaved] = useState(false);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));
  const save = async() => {
    // Geocode location if it changed so community posts are proximity-sorted correctly
    let geoUpdate = {};
    let fData = {...f};
    if (f.location && f.location !== org?.location) {
      const geo = await geocodeLocation(f.location);
      if (geo) { geoUpdate = { lat: geo.lat, lng: geo.lng }; fData = { ...fData, ...geoUpdate }; }
    } else if (f.zipcode && f.zipcode !== org?.zipcode) {
      const geo = await geocodeLocation(f.zipcode + ", USA");
      if (geo) { geoUpdate = { lat: geo.lat, lng: geo.lng }; fData = { ...fData, ...geoUpdate }; }
    }
    await setOrg(fData);
    setSaved(true);
    setTimeout(()=>setSaved(false),2200);
  };

  return(
    <div style={{position:"relative"}}>
      <img src={usp(BG.settings,1400,900)} alt="" className="page-bg-img"/>

      <div style={{padding:"32px 36px 0"}}>
        <div className="hero-wrap" style={{height:210}}>
          <img src={usp(BG.settings,1100,260)} alt="Settings" loading="lazy"/>
          <div className="hero-fade"/>
          <div className="hero-body">
            <div className="hero-eyebrow">⚙️ Configuration</div>
            <h1 className="hero-title" style={{fontSize:44}}>Profile</h1>
            <p className="hero-sub">{f.name||"Your program"} — manage your profile and data.</p>
          </div>
          <div className="hero-bar"/>
        </div>
      </div>

      <div style={{padding:"24px 36px 48px",position:"relative",zIndex:1,maxWidth:760}}>

        {/* Org Profile */}
        <div className="card card-p" style={{marginBottom:20}}>
          <div className="sh"><h2>Organization Profile</h2><p>This information appears on your Exchange listings.</p></div>
          <div className="fg2">
            <div className="fg fu"><label className="fl">Organization Name</label><input className="fi" value={f.name||""} onChange={e=>upd("name",e.target.value)} placeholder="e.g. Lincoln High Drama Dept"/></div>
            <div className="fg">
              <label className="fl">Type</label>
              <select className="fs" value={f.type||""} onChange={e=>upd("type",e.target.value)}>
                <option value="">Select…</option>
                {["School","District","Community Theatre","College","Professional","Other"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={f.email||""} onChange={e=>upd("email",e.target.value)} placeholder="drama@school.edu"/></div>
            <div className="fg"><label className="fl">Phone</label><input className="fi" value={f.phone||""} onChange={e=>upd("phone",e.target.value)} placeholder="(555) 123-4567"/></div>
            <div className="fg"><label className="fl">City / Location</label><input className="fi" value={f.location||""} onChange={e=>upd("location",e.target.value)} placeholder="Huntington Beach, CA"/></div>
            <div className="fg">
              <label className="fl">State</label>
              <select className="fs" value={f.state||""} onChange={e=>upd("state",e.target.value)}>
                <option value="">Select state…</option>
                {US_STATES.map(s=><option key={s} value={s}>{STATE_NAMES[s]} ({s})</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Zip Code</label>
              <input className="fi" value={f.zipcode||""} onChange={e=>upd("zipcode",e.target.value.replace(/[^0-9]/g,"").slice(0,5))} placeholder="e.g. 92648" maxLength={5}/>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>Used to sort Community Board posts by proximity to you</div>
            </div>
            <div className="fg fu"><label className="fl">About Your Program</label><textarea className="ft" value={f.bio||""} onChange={e=>upd("bio",e.target.value)} placeholder="Tell others about your program…"/></div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:18,paddingTop:14,borderTop:"1.5px solid var(--border)"}}>
            <button className="btn btn-p" onClick={save}><span style={{width:14,height:14,display:"flex"}}>{Ic.check}</span>Save Profile</button>
            {saved&&<span style={{color:"var(--green)",fontWeight:800,fontSize:13.5}}>✓ Saved!</span>}
          </div>
        </div>

        {/* Plans */}
        <div className="card card-p" style={{marginBottom:20}}>
          <div className="sh"><h2>Plans</h2><p>Choose the right plan for your program.</p></div>
          {/* Billing toggle */}
          <UpgradePlans userId={userId} userEmail={userEmail} plan={plan}/>
          {/* Manage / Cancel billing — only shown to paid non-admin users */}
          {plan !== "free" && !isAdminEmail(userEmail) && (
            <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--bd)"}}>
              <div style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>
                You are on the <strong style={{color:"var(--goldink)",textTransform:"capitalize"}}>{plan}</strong> plan.
                Your subscription renews automatically. Cancel anytime — you keep access until the end of your billing period.
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <a
                  href={"https://billing.stripe.com/p/login/aFa4gydAZ2X1cpZ6UHgA800" + (userEmail ? "?prefilled_email=" + encodeURIComponent(userEmail) : "")}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-o btn-sm"
                  style={{fontSize:12}}>
                  💳 Manage Billing &amp; Cancel
                </a>
                <a href="mailto:hello@theatre4u.org?subject=Cancel Subscription" className="btn btn-o btn-sm" style={{fontSize:12}}>
                  ✉️ Email Us to Cancel
                </a>
              </div>
              <div style={{fontSize:11,color:"var(--faint)",marginTop:8,lineHeight:1.6}}>
                Need help? Email <a href="mailto:hello@theatre4u.org" style={{color:"var(--goldink)"}}>hello@theatre4u.org</a> — we respond personally.
              </div>
              <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--bd)",fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
                <span style={{fontWeight:700,color:"var(--text)"}}>🏛️ Paying by check or PO?</span> Email{" "}
                <a href="mailto:hello@theatre4u.org?subject=Check/PO Subscription Request" style={{color:"var(--goldink)"}}>hello@theatre4u.org</a>
                {" "}and we'll send a formal invoice. Payment made payable to <strong>Artstracker LLC</strong>. Net-30 available for districts.
              </div>
            </div>
          )}
        </div>

        {/* Data */}
        {/* Admin Test Panel — only visible to admin email */}
        {isAdminEmail(userEmail)&&(
          <div className="card card-p" style={{marginBottom:20,border:"1px solid rgba(212,168,67,.4)",background:"rgba(212,168,67,.04)"}}>
            <div className="sh">
              <h2 style={{color:"var(--goldink)"}}>🔧 Admin: Plan Test Mode</h2>
              <p>Simulate any subscription level. Changes are saved to the database so you can test the full flow.</p>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>Current plan:</span>
              <span style={{padding:"3px 10px",background:"var(--gold)",color:"#1a0f00",borderRadius:9,fontSize:12,fontWeight:700,textTransform:"uppercase"}}>{plan}</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["free","pro","district"].map(p=>(
                <button key={p} className={"btn "+(plan===p?"btn-g":"btn-o")} style={{textTransform:"capitalize",opacity:plan===p?.6:1}}
                  onClick={()=>plan!==p&&setPlan(p)}
                  disabled={plan===p}>
                  {plan===p?"✓ ":""}{p.charAt(0).toUpperCase()+p.slice(1)}{plan===p?" (active)":""}
                </button>
              ))}
            </div>
            <div style={{marginTop:10,fontSize:11.5,color:"var(--faint)",lineHeight:1.6}}>
              <strong>Free:</strong> 25 item cap, no Exchange or Reports · <strong>Pro:</strong> unlimited items, Backstage Exchange · <strong>District:</strong> all Pro features + multi-org (future)
            </div>
          </div>
        )}

        {!memberRole&&<TeamSettings userId={userId} orgName={org?.name||"Your Program"} plan={plan}/>}

        {/* ── Participation Toggles ─────────────────────────────────────── */}
        {!memberRole&&(
        <div className="card card-p">
          <div className="sh">
            <h2>Participation Settings</h2>
            <p>Choose which Theatre4u features your program participates in. These settings are private and only visible to your account.</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:16}}>
            {[
              {key:"community_enabled",  icon:"🎪", label:"Community Board",  desc:"Appear in the community directory and post to the shared board. Other programs can see your posts."},
              {key:"marketplace_enabled",icon:"🏪", label:"Backstage Exchange",  desc:"Share selected items with other theatre programs in the region. You control exactly which items are posted. Browse what others have available."},
            ].map(({key,icon,label,desc})=>(
              <div key={key} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{fontSize:22,marginTop:2}}>{icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>{label}</div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>{desc}</div>
                </div>
                <label style={{display:"flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>
                  <input type="checkbox"
                    checked={!!(org&&org[key])}
                    onChange={async e=>{
                      const val = e.target.checked;
                      const updated = {...org,[key]:val};
                      setOrg(updated);
                      await SB.from("orgs").update({[key]:val}).eq("id",userId);
                    }}
                    style={{width:18,height:18,cursor:"pointer",accentColor:"var(--gold)"}}
                  />
                  <span style={{marginLeft:8,fontSize:13,color:"var(--muted)",fontWeight:600}}>
                    {org&&org[key]?"On":"Off"}
                  </span>
                </label>
              </div>
            ))}
          </div>
          <p style={{fontSize:11,color:"var(--muted)",marginTop:14,fontStyle:"italic"}}>
            Changes take effect immediately. Turning off Community or Backstage Exchange removes your content from shared views but does not delete it. The Funding Tracker is always private to your account.
          </p>
        </div>
        )}

        <div className="card card-p">
          <div className="sh"><h2>🔒 QR Code Privacy</h2><p>Control what others see when they scan your item QR labels.</p></div>
          <QRPrivacySettings org={org} setOrg={setOrg} userId={userId}/>
        </div>

        <div className="card card-p">
          <div className="sh"><h2>🎭 Departments</h2><p>Choose which arts departments are open in your account, and switch between them from the sidebar.</p></div>
          <DepartmentsManager org={org} setOrg={setOrg} userId={userId} plan={plan} memberRole={memberRole}/>
        </div>

        <div className="card card-p">
          <div className="sh"><h2>🗂️ Custom Categories</h2><p>Add your own inventory categories alongside the built-in ones.</p></div>
          <CustomCategoriesManager org={org} userId={userId} memberRole={memberRole}/>
        </div>

        <div className="sc">
          <div className="sh"><h2>Data Management</h2><p>Load sample data to explore, or reset everything to start fresh.</p></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn btn-o" onClick={onSeed}><span style={{width:14,height:14,display:"flex"}}>{Ic.box}</span>Load Sample Data</button>
            <button className="btn btn-d" onClick={async()=>{
              if(!window.confirm("This will permanently delete ALL your inventory items from the database. Your account and organization profile will remain. This cannot be undone.")) return;
              // Get current item IDs from state and delete each by primary key
              // (more reliable than bulk delete against org_id with RLS)
              const currentItems = items;
              if(currentItems.length===0){window.alert("No items to delete.");return;}
              let failed=0;
              for(const item of currentItems){
                const{error}=await SB.from("items").delete().eq("id",item.id);
                if(error) failed++;
              }
              // Also try a bulk delete by org_id as belt-and-suspenders
              await SB.from("items").delete().eq("org_id",user.id);
              setItems([]);
              if(failed>0) window.alert("Deleted with "+failed+" error(s). Refresh if items remain.");
              else window.alert("All inventory items deleted.");
            }}><span style={{width:14,height:14,display:"flex"}}>{Ic.trash}</span>Delete All Items</button>
          </div>
        </div>

        {/* ── Delete My Account (self-service) ── */}
        <div className="card card-p" style={{ borderColor:"rgba(194,24,91,.25)",background:"rgba(194,24,91,.02)" }}>
          <div className="sh">
            <h2 style={{ color:"var(--red)" }}>⚠️ Close My Account</h2>
            <p>
              Permanently close your Theatre4u account. Your Stripe subscription will be canceled immediately.
              Your data will be preserved for 30 days — email <strong>hello@theatre4u.org</strong> within
              30 days to restore your account. After 30 days, all data is permanently deleted.
            </p>
          </div>
          <SelfServiceDeleteAccount user={user} org={org} />
        </div>

      </div>
    </div>
  );
}
