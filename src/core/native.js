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

// Print an HTML document safely. On the web this opens a print window as usual.
// In the native app, window.open hands a blank page to the phone's browser (which
// can land on spam), so we print through a hidden in-app iframe instead and strip
// any auto-print <script> so it only prints once.
export function printHtml(html, winFeatures) {
  if (IS_NATIVE_APP) {
    const safe = String(html).replace(/<script[\s\S]*?<\/script>/gi, "");
    const ifr = document.createElement("iframe");
    ifr.setAttribute("aria-hidden", "true");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
    document.body.appendChild(ifr);
    const d = ifr.contentWindow.document; d.open(); d.write(safe); d.close();
    setTimeout(() => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e) {} setTimeout(() => ifr.remove(), 2000); }, 600);
    return null;
  }
  const w = window.open("", "_blank", winFeatures || "width=820,height=640");
  if (!w) return null;
  w.document.write(html); w.document.close();
  return w;
}

// Launch the native barcode / QR scanner (ready-made full-screen UI from the
// MLKit plugin). Returns the scanned text, or null. Only call inside the app.
export async function nativeScan() {
  if (!IS_NATIVE_APP) throw new Error("Scanning is only available in the app.");
  const mod = await import("@capacitor-mlkit/barcode-scanning");
  const BarcodeScanner = mod.BarcodeScanner || mod.default?.BarcodeScanner || mod.default;
  try { await BarcodeScanner.requestPermissions(); } catch { /* user prompt */ }

  // Android needs Google's barcode-scanner module present before the first scan.
  // It downloads once in the background; we wait for it to finish, then scan.
  if (NATIVE_PLATFORM === "android" && BarcodeScanner.isGoogleBarcodeScannerModuleAvailable) {
    try {
      const avail = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!avail?.available) {
        await new Promise((resolve, reject) => {
          let done = false;
          const finish = (fn, arg) => { if (!done) { done = true; fn(arg); } };
          BarcodeScanner.addListener("googleBarcodeScannerModuleInstallProgress", (ev) => {
            // state 4 = COMPLETED (per MLKit); also resolve if progress hits 100
            if (ev?.state === 4 || ev?.progress === 100) finish(resolve);
          });
          BarcodeScanner.installGoogleBarcodeScannerModule().catch((e) => finish(reject, e));
          // Safety timeout so we never hang forever
          setTimeout(() => finish(resolve), 30000);
        });
      }
    } catch { /* fall through and let scan() surface any real error */ }
  }

  const result = await BarcodeScanner.scan();
  const codes = result?.barcodes || [];
  return codes.length ? (codes[0].rawValue || codes[0].displayValue || null) : null;
}
