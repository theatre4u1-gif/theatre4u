// Domain detection + app naming (Theatre4u vs ArtsTracker) — extracted from App.jsx.
export const HOSTNAME       = typeof window !== "undefined" ? window.location.hostname : "";
export const IS_THEATRE4U   = HOSTNAME.includes("theatre4u.org") || HOSTNAME === "localhost";
export const IS_ARTSTRACKER = HOSTNAME.includes("artstracker.org");
export const APP_NAME       = IS_THEATRE4U ? "Theatre4u\u2122" : "ArtsTracker";
export const APP_SUBTITLE   = IS_THEATRE4U ? "Inventory \u00B7 Exchange" : "Theatre \u00B7 Music \u00B7 Dance \u00B7 Art \u00B7 Boosters";
export const APP_EMAIL      = IS_THEATRE4U ? "hello@theatre4u.org" : "hello@artstracker.org";
export const APP_URL        = IS_THEATRE4U ? "https://theatre4u.org" : "https://artstracker.org";
