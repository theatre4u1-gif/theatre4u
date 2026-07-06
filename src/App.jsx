// ─────────────────────────────────────────────────────────────────────────────
// App entry shell. All features live in ./core/* and ./lib/* modules.
// This file only wires up the entry point + two runtime side-effects.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { isDemoMode } from "./core/helpers.js";
import { IS_THEATRE4U, FAVICON, TOUCH_ICON } from "./core/config.js";
import { AppRoot } from "./core/app-root.jsx";
import { DemoApp } from "./core/demo.jsx";
import { ErrorBoundary } from "./core/ui.jsx";

// Set the browser tab icon + iOS home-screen icon at runtime, by hostname.
// This is why we never need to edit the Vite-owned src/index.html.
if (typeof document !== "undefined") {
  const setIcon = (rel, href, type) => {
    let l = document.querySelector("link[rel='" + rel + "']");
    if (!l) { l = document.createElement("link"); l.rel = rel; document.head.appendChild(l); }
    if (type) { l.type = type; }
    l.href = href;
  };
  setIcon("icon", FAVICON, IS_THEATRE4U ? "image/svg+xml" : "image/png");
  setIcon("apple-touch-icon", TOUCH_ICON, null);
}

// Capture a referral code from the ?ref= param and persist it for signup.
;(() => {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) sessionStorage.setItem("t4u_ref", ref.toUpperCase().trim());
  } catch { /* no-op */ }
})();

// Entry: demo mode renders the sandbox; otherwise the real app inside an error boundary.
const AppWithBoundary = () => isDemoMode()
  ? <DemoApp/>
  : <ErrorBoundary><AppRoot/></ErrorBoundary>;

export default AppWithBoundary;
