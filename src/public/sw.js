// Theatre4u service worker — minimal, network-first so the app is always current
// (required for Android's "Install app" prompt). No aggressive caching, so changes
// you push to the site show up immediately; cache is only a last-resort offline fallback.
const CACHE = "t4u-shell-v1";

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // let the browser handle cross-origin
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && req.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
