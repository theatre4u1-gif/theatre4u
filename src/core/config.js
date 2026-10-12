// Domain detection + app naming (Theatre4u vs ArtsTracker) — extracted from App.jsx.
export const HOSTNAME       = typeof window !== "undefined" ? window.location.hostname : "";
// QA-only brand override for previews/localhost (never honored on the real domains):
// append ?brand=theatre4u or ?brand=artstracker to a preview URL; sticks for the tab
// via sessionStorage so navigation keeps it. Clear with ?brand=off.
const BRAND_OVERRIDE = (() => {
  try {
    const isPreview = HOSTNAME.endsWith(".vercel.app") || HOSTNAME === "localhost" || HOSTNAME === "127.0.0.1";
    if (!isPreview) return null;
    const p = new URLSearchParams(window.location.search).get("brand");
    if (p === "off") { sessionStorage.removeItem("t4u_brand_override"); return null; }
    if (p === "theatre4u" || p === "artstracker" || p === "bintrove") sessionStorage.setItem("t4u_brand_override", p);
    return sessionStorage.getItem("t4u_brand_override");
  } catch (e) { return null; }
})();
export const IS_THEATRE4U   = BRAND_OVERRIDE ? BRAND_OVERRIDE === "theatre4u"
  : (HOSTNAME.includes("theatre4u.org") || HOSTNAME === "localhost");
// BinTrove = the consumer home-inventory door (bintrove.com, incl. app.bintrove.com).
// Additive THIRD brand: detected explicitly so the two existing doors are byte-identical.
export const IS_BINTROVE    = BRAND_OVERRIDE ? BRAND_OVERRIDE === "bintrove"
  : HOSTNAME.includes("bintrove.com");
// Any host that is neither Theatre4u nor BinTrove (incl. Vercel previews) counts as
// ArtsTracker, so the flags stay mutually exclusive and previews don't show mixed branding.
export const IS_ARTSTRACKER = !IS_THEATRE4U && !IS_BINTROVE;
export const APP_NAME       = IS_BINTROVE ? "BinTrove"             : (IS_THEATRE4U ? "Theatre4u\u2122" : "ArtsTracker");
export const APP_SUBTITLE   = IS_BINTROVE ? "Home storage, organized." : (IS_THEATRE4U ? "Inventory \u00B7 Exchange" : "Theatre \u00B7 Music \u00B7 Dance \u00B7 Art \u00B7 Organizations");
export const APP_EMAIL      = IS_BINTROVE ? "hello@bintrove.com"   : (IS_THEATRE4U ? "hello@theatre4u.org" : "hello@artstracker.org");
export const APP_URL        = IS_BINTROVE ? "https://bintrove.com" : (IS_THEATRE4U ? "https://theatre4u.org" : "https://artstracker.org");
export const APP_HOST       = IS_BINTROVE ? "bintrove.com"         : (IS_THEATRE4U ? "theatre4u.org" : "artstracker.org");

// Standalone admin app host (admin.artstracker.org). On previews/localhost, ?admin=1 forces it (for testing pre-DNS).
export const IS_ADMIN_HOST = (() => {
  if (HOSTNAME.startsWith("admin.")) return true;
  try {
    const isPreview = HOSTNAME.endsWith(".vercel.app") || HOSTNAME === "localhost" || HOSTNAME === "127.0.0.1";
    return isPreview && new URLSearchParams(window.location.search).get("admin") === "1";
  } catch (e) { return false; }
})();

// Brand assets, switched by domain (files live in src/public/)
export const LOGO_ICON  = IS_BINTROVE ? "/icon-192-bintrove.png"         : (IS_THEATRE4U ? "/favicon-theatre4u.svg"          : "/icon-192-artstracker.png");
export const FAVICON    = IS_BINTROVE ? "/favicon-bintrove.png"          : (IS_THEATRE4U ? "/favicon-theatre4u.svg"          : "/favicon-artstracker.png");
export const TOUCH_ICON = IS_BINTROVE ? "/apple-touch-icon-bintrove.png" : (IS_THEATRE4U ? "/apple-touch-icon-theatre4u.png" : "/apple-touch-icon-artstracker.png");
export const LOGO_FULL  = IS_BINTROVE ? "/logo-bintrove.png"             : (IS_THEATRE4U ? "/logo-theatre4u.svg"             : "/logo-artstracker.png");
export const LOGO_MARK  = IS_BINTROVE ? "/logo-mark-bintrove.png"        : (IS_THEATRE4U ? "/logo-mark-theatre4u.png"        : "/logo-mark-artstracker.png"); // tag-only "Simple" logo (loading screens etc.)

// Admin account gating (client-side)
export const ADMIN_EMAILS = [
  "theatre4u1@gmail.com",
  // Add tester emails here:
  // "tester1@example.com",
];
export const isAdminEmail = (e) => ADMIN_EMAILS.includes((e||"").toLowerCase().trim());
export const ADMIN_EMAIL  = ADMIN_EMAILS[0]; // legacy alias
