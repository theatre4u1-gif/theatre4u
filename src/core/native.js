// native.js — tiny helpers for when the web app runs inside the Capacitor
// native shell (the iOS / Android app). On the website these all no-op or
// report "not native", so nothing here changes the website's behavior.

// Capacitor injects a global `window.Capacitor` into the native webview.
// On the website that global is absent, so IS_NATIVE_APP is false.
export const IS_NATIVE_APP = (() => {
  try {
    const C = typeof window !== "undefined" ? window.Capacitor : null;
    if (!C) return false;
    if (typeof C.isNativePlatform === "function") return C.isNativePlatform();
    if (typeof C.getPlatform === "function") return C.getPlatform() !== "web";
    return false;
  } catch { return false; }
})();

export const NATIVE_PLATFORM = (() => {
  try { return window.Capacitor?.getPlatform?.() || "web"; } catch { return "web"; }
})();

// Open a URL in the device's real browser (Chrome / Safari), outside the app.
// In Capacitor, target "_system" hands the URL to the OS browser.
export function openExternal(url) {
  try {
    window.open(url, "_system");
  } catch {
    try { window.open(url, "_blank"); } catch { /* no-op */ }
  }
}

// Launch the native barcode / QR scanner (ready-made full-screen UI from the
// MLKit plugin). Returns the scanned text, or null. Only call inside the app.
export async function nativeScan() {
  if (!IS_NATIVE_APP) throw new Error("Scanning is only available in the app.");
  const mod = await import("@capacitor-mlkit/barcode-scanning");
  const BarcodeScanner = mod.BarcodeScanner || mod.default?.BarcodeScanner || mod.default;
  try { await BarcodeScanner.requestPermissions(); } catch { /* user prompt */ }
  const result = await BarcodeScanner.scan();
  const codes = result?.barcodes || [];
  return codes.length ? (codes[0].rawValue || codes[0].displayValue || null) : null;
}
