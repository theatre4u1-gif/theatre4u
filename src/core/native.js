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
    const styleM = safe.match(/<style[\s\S]*?<\/style>/i);
    const bodyM = safe.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const inner = (styleM ? styleM[0] : "") + (bodyM ? bodyM[1] : safe);

    // One-time print stylesheet: in print output, show only the label content.
    if (!document.getElementById("t4u-print-style")) {
      const ps = document.createElement("style");
      ps.id = "t4u-print-style";
      ps.textContent = "@media print{body>*:not(.t4u-print-root){display:none!important}.t4u-print-root{position:static!important;overflow:visible!important}.t4u-print-bar{display:none!important}}";
      document.head.appendChild(ps);
    }

    const root = document.createElement("div");
    root.className = "t4u-print-root";
    root.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:#fff;color:#000;overflow:auto";

    const bar = document.createElement("div");
    bar.className = "t4u-print-bar";
    bar.style.cssText = "position:sticky;top:0;display:flex;gap:10px;justify-content:flex-end;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:#15121b;border-bottom:1px solid rgba(212,175,55,.3)";
    const mk = (label, bg, fg) => { const b = document.createElement("button"); b.textContent = label; b.style.cssText = "padding:9px 18px;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;background:" + bg + ";color:" + fg; return b; };
    const closeBtn = mk("Close", "rgba(255,255,255,.14)", "#f3ead3");
    const printBtn = mk("Print / Save PDF", "linear-gradient(135deg,#C9A23A,#E6C65C)", "#1a1208");
    const cleanup = () => { try { root.remove(); } catch (e) {} };
    closeBtn.onclick = cleanup;
    printBtn.onclick = () => { try { window.print(); } catch (e) {} };
    bar.appendChild(closeBtn); bar.appendChild(printBtn);

    const content = document.createElement("div");
    content.style.cssText = "padding:14px";
    content.innerHTML = inner;

    root.appendChild(bar); root.appendChild(content);
    document.body.appendChild(root);
    return null;
  }
  const w = window.open("", "_blank", winFeatures || "width=820,height=640");
  if (!w) return null;
  w.document.write(html); w.document.close();
  return w;
}

// Google sign-in inside the app: open Google in the system browser, then the
// OS returns to the app via a custom-scheme deep link that we exchange for a
// session. Needs the redirect URL allow-listed in Supabase (see mobile/README).
export const OAUTH_REDIRECT = "theatre4u://auth-callback";

export async function nativeGoogleOAuth(supabase) {
  if (!IS_NATIVE_APP) throw new Error("Only in the app.");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start Google sign-in.");
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url });
}

// Register once (native only): catch the deep link back from Google and finish
// the sign-in. Handles both PKCE (?code=) and implicit (#access_token=) returns.
export async function initOAuthDeepLink(supabase) {
  if (!IS_NATIVE_APP) return;
  const { App } = await import("@capacitor/app");
  App.addListener("appUrlOpen", async ({ url }) => {
    if (!url || url.indexOf("auth-callback") === -1) return;
    try {
      const frag = (url.split("#")[1] || url.split("?")[1] || "");
      const p = new URLSearchParams(frag);
      if (p.get("code")) {
        await supabase.auth.exchangeCodeForSession(p.get("code"));
      } else if (p.get("access_token")) {
        await supabase.auth.setSession({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token") });
      }
    } catch (e) { console.error("OAuth deep link failed", e); }
    try { const { Browser } = await import("@capacitor/browser"); await Browser.close(); } catch (e) {}
  });
}

// Take a photo with the phone's native camera and return it as a File (so it
// flows through the same upload/resize path as a picked file). App only.
export async function nativeTakePhoto() {
  if (!IS_NATIVE_APP) throw new Error("Camera is only available in the app.");
  const mod = await import("@capacitor/camera");
  const { Camera, CameraResultType, CameraSource } = mod;
  const photo = await Camera.getPhoto({
    quality: 80, allowEditing: false,
    resultType: CameraResultType.DataUrl, source: CameraSource.Camera,
  });
  if (!photo?.dataUrl) return null;
  const blob = await (await fetch(photo.dataUrl)).blob();
  return new File([blob], "photo-" + Date.now() + ".jpg", { type: blob.type || "image/jpeg" });
}

// Share (or save) a PNG given as a data URL. In the app this opens the OS share
// sheet — which includes Print, Save image, Save to Drive, and sending anywhere.
// On the web it just downloads the file. Returns true if the share sheet opened.
export async function shareImageDataUrl(dataUrl, filename) {
  if (!IS_NATIVE_APP) {
    try { const a = document.createElement("a"); a.href = dataUrl; a.download = filename; a.click(); } catch (e) {}
    return false;
  }
  try {
    const fsMod = await import("@capacitor/filesystem");
    const shMod = await import("@capacitor/share");
    const Filesystem = fsMod.Filesystem; const Directory = fsMod.Directory;
    const Share = shMod.Share;
    const base64 = String(dataUrl).split(",")[1];
    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    // Share the file (not a URL) so Print / Save to Photos / Files appear in the sheet.
    await Share.share({ title: "QR labels", files: [uri] });
    return true;
  } catch (e) {
    if (e && String(e.message || e).toLowerCase().includes("cancel")) return false; // user dismissed the sheet
    alert("Couldn't open the share sheet: " + (e?.message || e));
    return false;
  }
}

// Render a set of QR labels into one image and open the OS share sheet (Print,
// Save to Photos/Files, AirDrop…). App only. `labels` = [{name,id,sub,loc,qr}].
export async function shareLabelsAsImage(labels, filename = "qr-labels.png") {
  if (!labels || !labels.length) return false;
  const cols = labels.length === 1 ? 1 : (labels.length === 2 ? 2 : 3);
  const cellW = 250, cellH = 280, pad = 16, qr = 150;
  const rows = Math.ceil(labels.length / cols);
  const W = cols * cellW + pad * 2, H = rows * cellH + pad * 2;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.textAlign = "center";
  const clip = (s, n) => (s && s.length > n) ? s.slice(0, n - 1) + "…" : (s || "");
  const loadImg = (src) => new Promise((res) => { if (!src) { res(null); return; } const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  for (let i = 0; i < labels.length; i++) {
    const r = Math.floor(i / cols), col = i % cols;
    const x = pad + col * cellW, y = pad + r * cellH, cx = x + cellW / 2;
    g.strokeStyle = "#ccc"; g.lineWidth = 1; g.strokeRect(x + 5, y + 5, cellW - 10, cellH - 10);
    g.fillStyle = "#111"; g.font = "bold 15px Arial"; g.fillText(clip(labels[i].name, 22), cx, y + 30);
    if (labels[i].id) { g.fillStyle = "#c4761a"; g.font = "bold 13px monospace"; g.fillText(clip(labels[i].id, 20), cx, y + 52); }
    if (labels[i].sub) { g.fillStyle = "#666"; g.font = "11px Arial"; g.fillText(clip(labels[i].sub, 30), cx, y + 70); }
    if (labels[i].loc) { g.fillStyle = "#333"; g.font = "bold 11px Arial"; g.fillText("📍 " + clip(labels[i].loc, 26), cx, y + 88); }
    const img = await loadImg(labels[i].qr);
    if (img) g.drawImage(img, cx - qr / 2, y + 100, qr, qr);
  }
  return shareImageDataUrl(c.toDataURL("image/png"), filename);
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
