// QR Code generator — client-side via esm.sh/qrcode. Extracted from App.jsx.
// Shared utility used across many pages (item labels, public pages, etc.).
let _qrMod = null;
async function _getQR() {
  if (_qrMod) return _qrMod;
  _qrMod = await import("https://esm.sh/qrcode@1.5.3");
  return _qrMod;
}

export const QR = {
  // Returns a data URL (canvas-rendered, no network after first load)
  async toDataURL(text, size = 200) {
    try {
      const QRCode = await _getQR();
      return await QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch(e) {
      console.error("QR error:", e);
      return null;
    }
  },
  // Sync convenience — returns a promise, named for readable call sites
  src: null, // not used in new version
};
