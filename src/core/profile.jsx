import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";
import { BG, usp } from "../lib/backgrounds.js";
import { geocodeLocation } from "../lib/geo.js";
import { APP_URL } from "./config.js";
import { getPointsName } from "./helpers.js";
import { getExchangeName } from "../lib/verticals.js";

// Public org profile editor page — extracted from App.jsx.

export function OrgProfilePage({ userId, org, setOrg, plan, items }) {
  const [editing, setEditing]     = useState(false);
  const [f, setF]                  = useState(null);
  const [saving, setSaving]        = useState(false);
  const [msg, setMsg]              = useState("");
  const [copied, setCopied]        = useState(false);

  useEffect(() => {
    // Load fresh org data including new profile fields
    (async () => {
      const { data } = await SB.from("orgs").select("*").eq("id", userId).single();
      if (data) {
        setOrg(o => ({ ...o, ...data }));
        setF(data);
      }
    })();
  }, [userId]);

  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f) return;
    setSaving(true);
    // Auto-generate slug if empty
    let slug = f.slug;
    if (!slug && f.name) {
      const base = f.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 50);
      slug = base;
    }
    // Geocode location once on profile save — stored permanently, no repeated network calls
    let latLng = {};
    if (f.location && f.location.trim().length > 2) {
      try {
        const geo = await geocodeLocation(f.location);
        if (geo) latLng = { lat: geo.lat, lng: geo.lng };
      } catch { /* geocoding optional */ }
    }
    const { data, error } = await SB.from("orgs").update({
      name: f.name, type: f.type, email: f.email, phone: f.phone,
      director_name: f.director_name, director_title: f.director_title,
      location: f.location, bio: f.bio, website: f.website,
      facebook: f.facebook, instagram: f.instagram,
      logo_url: f.logo_url, founded_year: f.founded_year,
      student_count: f.student_count, profile_public: f.profile_public,
      slug, ...latLng,
    }).eq("id", userId).select().single();
    if (data) {
      setOrg(o => ({ ...o, ...data }));
      setF(data);
      setMsg("✓ Profile saved");
      setTimeout(() => setMsg(""), 2500);
    }
    setSaving(false);
    setEditing(false);
  };

  const profileUrl = org?.slug
    ? `${APP_URL}/#/org/${org.slug}`
    : null;

  const copyUrl = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const listed = items.filter(i => i.marketStatus && i.marketStatus !== "Not Listed").length;

  if (!f) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>;

  return (
    <div style={{ position: "relative" }}>
      <img src={usp(BG.dashboard, 1400, 900)} alt="" className="page-bg-img" />

      <div style={{ padding: "32px 36px 0" }}>
        <div className="hero-wrap" style={{ height: 200 }}>
          <img src={usp("photo-1503095396549-807759245b35", 1100, 260)} alt="Profile" loading="eager" />
          <div className="hero-fade" />
          <div className="hero-body">
            <div className="hero-eyebrow">👤 Your Organization</div>
            <h1 className="hero-title" style={{ fontSize: 40 }}>Public Profile</h1>
            <p className="hero-sub">Your shareable page for other programs and the public to discover you.</p>
          </div>
          <div className="hero-bar" />
        </div>
      </div>

      <div style={{ padding: "24px 36px 56px", position: "relative", zIndex: 1 }}>

        {/* Public URL card */}
        <div className="card card-p" style={{ marginBottom: 20, borderColor: profileUrl ? "rgba(82,199,132,.3)" : "var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 4 }}>
                Your Public Profile URL
              </div>
              {profileUrl
                ? <div style={{ fontFamily: "monospace", fontSize: 15, color: "var(--green)", fontWeight: 700 }}>{profileUrl}</div>
                : <div style={{ fontSize: 13, color: "var(--muted)" }}>Save your profile to generate your URL.</div>
              }
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                Share this link so other programs, parents, and community members can discover your inventory listings.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {profileUrl && <>
                <button className="btn btn-o btn-sm" onClick={copyUrl}>
                  {copied ? "✓ Copied!" : "📋 Copy Link"}
                </button>
                <a href={profileUrl} target="_blank" rel="noreferrer" className="btn btn-o btn-sm">
                  🔗 Preview
                </a>
              </>}
            </div>
          </div>
        </div>

        {/* Visibility toggle */}
        <div className="card card-p" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Profile Visibility</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              {f.profile_public ? "Your profile is public — anyone with the link can see it." : "Your profile is private — only you can see it."}
            </div>
          </div>
          <button onClick={async () => {
            const next = !f.profile_public;
            upd("profile_public", next);
            await SB.from("orgs").update({ profile_public: next }).eq("id", userId);
            setMsg(next ? "✓ Profile is now public" : "✓ Profile is now private");
            setTimeout(() => setMsg(""), 2000);
          }} style={{
            padding: "8px 18px", borderRadius: 8, border: "1.5px solid",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: f.profile_public ? "rgba(82,199,132,.15)" : "var(--parch)",
            color: f.profile_public ? "var(--green)" : "var(--muted)",
            borderColor: f.profile_public ? "var(--green)" : "var(--border)",
          }}>
            {f.profile_public ? "🌐 Public" : "🔒 Private"}
          </button>
        </div>

        {/* Profile preview card */}
        {!editing && (
          <div className="card card-p" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20 }}>Profile Preview</h3>
              <button className="btn btn-o btn-sm" onClick={() => setEditing(true)}>✏️ Edit Profile</button>
            </div>

            {/* Preview of what public sees */}
            <div style={{ background: "var(--white)", borderRadius: 10, padding: 20, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 12, background: "linear-gradient(135deg,var(--gold2),var(--gold))",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0
                }}>
                  {f.logo_url ? <img src={f.logo_url} alt="" style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} /> : "🎭"}
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22 }}>{f.name || "Your Program Name"}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    {[f.type, f.location].filter(Boolean).join(" · ") || "Location not set"}
                  </div>
                </div>
              </div>
              {f.bio && <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 12 }}>{f.bio}</p>}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {f.founded_year && <span style={{ padding: "3px 10px", background: "rgba(212,168,67,.1)", color: "var(--goldink)", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>Est. {f.founded_year}</span>}
                {f.student_count && <span style={{ padding: "3px 10px", background: "rgba(82,199,132,.1)", color: "var(--green)", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{f.student_count.toLocaleString()} students</span>}
                {listed > 0 && <span style={{ padding: "3px 10px", background: "rgba(66,165,245,.1)", color: "#42a5f5", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{listed} items listed</span>}
                {plan !== "free" && <span style={{ padding: "3px 10px", background: "rgba(212,168,67,.15)", color: "var(--goldink)", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>🪙 Accepts {getPointsName(org?.vertical)}</span>}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 12, color: "var(--amber)" }}>✉️ {f.email}</a>}
                {f.phone && <span style={{ fontSize: 12, color: "var(--muted)" }}>📞 {f.phone}</span>}
                {f.website && <a href={f.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--amber)" }}>🌐 Website</a>}
                {f.instagram && <a href={`https://instagram.com/${f.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--amber)" }}>📸 Instagram</a>}
              </div>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="card card-p" style={{ marginBottom: 20 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, marginBottom: 16 }}>Edit Profile</h3>
            <div className="fg2">
              <div className="fg fu"><label className="fl">Organization Name</label>
                <input className="fi" value={f.name || ""} onChange={e => upd("name", e.target.value)} placeholder="Your program name" /></div>

              <div className="fg"><label className="fl">Your Name (Director)</label>
                <input className="fi" value={f.director_name || ""} onChange={e => upd("director_name", e.target.value)} placeholder="Jane Smith" /></div>

              <div className="fg"><label className="fl">Your Title</label>
                <input className="fi" value={f.director_title || ""} onChange={e => upd("director_title", e.target.value)} placeholder="Theatre Director" /></div>

              <div className="fg fu">
                <label className="fl">Profile Photo / Logo URL</label>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  {f.logo_url && <img src={f.logo_url} alt="Logo preview" style={{width:52,height:52,borderRadius:8,objectFit:"cover",border:"1px solid var(--border)",flexShrink:0}}/>}
                  <div style={{flex:1}}>
                    <input className="fi" value={f.logo_url || ""} onChange={e => upd("logo_url", e.target.value)}
                      placeholder="Paste an image URL (Google Drive, Dropbox, etc.)" />
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>
                      Paste any direct image URL. For Google Drive: share the image → Copy link → replace /view with nothing and add &sz=w400 to the end.
                    </div>
                  </div>
                </div>
              </div>

              <div className="fg"><label className="fl">Type</label>
                <select className="fs" value={f.type || ""} onChange={e => upd("type", e.target.value)}>
                  <option value="">Select…</option>
                  {["School","Community Theatre","College","District","Professional","Other"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="fg"><label className="fl">City / Location</label>
                <input className="fi" value={f.location || ""} onChange={e => upd("location", e.target.value)} placeholder="Portland, OR" /></div>

              <div className="fg"><label className="fl">Contact Email</label>
                <input className="fi" type="email" value={f.email || ""} onChange={e => upd("email", e.target.value)} placeholder="drama@school.edu" /></div>

              <div className="fg"><label className="fl">Phone</label>
                <input className="fi" value={f.phone || ""} onChange={e => upd("phone", e.target.value)} placeholder="(555) 123-4567" /></div>

              <div className="fg"><label className="fl">Year Founded</label>
                <input className="fi" type="number" min="1800" max="2026" value={f.founded_year || ""} onChange={e => upd("founded_year", parseInt(e.target.value) || null)} placeholder="e.g. 1998" /></div>

              <div className="fg"><label className="fl">Students Served (approx.)</label>
                <input className="fi" type="number" min="0" value={f.student_count || ""} onChange={e => upd("student_count", parseInt(e.target.value) || null)} placeholder="e.g. 350" /></div>

              <div className="fg fu"><label className="fl">About Your Program</label>
                <textarea className="ft" value={f.bio || ""} onChange={e => upd("bio", e.target.value)}
                  placeholder="Tell other programs and the community about your program…" style={{ minHeight: 80 }} /></div>

              <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 12 }}>Links & Social</div>
              </div>

              <div className="fg"><label className="fl">Website URL</label>
                <input className="fi" value={f.website || ""} onChange={e => upd("website", e.target.value)} placeholder="https://yourschool.edu" /></div>

              <div className="fg"><label className="fl">Instagram Handle</label>
                <input className="fi" value={f.instagram || ""} onChange={e => upd("instagram", e.target.value)} placeholder="@yourprogram" /></div>

              <div className="fg fu"><label className="fl">Logo Image URL (optional)</label>
                <input className="fi" value={f.logo_url || ""} onChange={e => upd("logo_url", e.target.value)} placeholder="https://drive.google.com/… or direct image URL" />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Paste a public image URL for your program's logo. Shown on your public profile.</div>
              </div>

              <div className="fg fu"><label className="fl">Profile URL Slug</label>
                <input className="fi" value={f.slug || ""} onChange={e => upd("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="lincoln-high-drama" />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Your profile will be at: {APP_URL.replace(/^https?:\/\//,"")}/#/org/<strong>{f.slug || "your-slug-here"}</strong></div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-o" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-g" onClick={save} disabled={saving}>{saving ? "Saving…" : "✓ Save Profile"}</button>
              {msg && <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 13, alignSelf: "center" }}>{msg}</span>}
            </div>
          </div>
        )}

        {/* Listed items preview */}
        {listed > 0 && (
          <div className="card card-p">
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 4 }}>{getExchangeName(org?.vertical)} — Your Listings</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>These items appear on your public profile. Anyone can browse them without logging in.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
              {items.filter(i => i.market_status && i.market_status !== "Not Listed" && i.market_status !== "Private").slice(0, 6).map(item => {
                const catColor = { costumes: "#c2185b", props: "#7b1fa2", sets: "#1565c0", lighting: "#f9a825", sound: "#2e7d32", scripts: "#d84315", makeup: "#ad1457", furniture: "#4e342e", fabrics: "#6a1b9a", tools: "#546e7a", effects: "#00838f", other: "#757575" }[item.category] || "#757575";
                return (
                  <div key={item.id} style={{ background: "var(--white)", borderRadius: 8, padding: 12, border: "1px solid var(--border)" }}>
                    {item.img
                      ? <img src={item.img} alt={item.name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 8 }} />
                      : <div style={{ height: 80, borderRadius: 6, background: catColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 8 }}>📦</div>}
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.market_status}</div>
                    {item.rental_price > 0 && <div style={{ fontSize: 13, color: "var(--green)", fontWeight: 700, marginTop: 2 }}>${item.rental_price}/wk</div>}
                    {item.sale_price > 0 && <div style={{ fontSize: 13, color: "var(--green)", fontWeight: 700, marginTop: 2 }}>${item.sale_price}</div>}
                  </div>
                );
              })}
            </div>
            {listed > 6 && <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "var(--muted)" }}>+{listed - 6} more items on your public profile</div>}
          </div>
        )}
      </div>
    </div>
  );
}
