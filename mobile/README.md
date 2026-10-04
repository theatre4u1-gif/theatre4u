# Theatre4u mobile app (Capacitor)

This wraps the existing Vite-built web app (`dist/`) into native **iOS / iPadOS / Android**
apps using [Capacitor](https://capacitorjs.com). One codebase, three stores. The web app
brands itself as **Theatre4u** automatically inside the shell (the webview host is
`localhost`, which `src/core/config.js` already treats as Theatre4u).

Branch: `mobile/capacitor-theatre4u` — nothing here affects the live website or the
Vercel build of `main`.

---

## One-time setup (on your Mac)

> iOS requires a **Mac with Xcode**. Android works on any OS with **Android Studio**.

```bash
# 1. Install the new dependencies (already added to package.json)
npm install

# 2. Build the web app and create the native projects
npm run build
npx cap add ios
npx cap add android

# 3. Generate app icons + splash from a source logo (see mobile/assets below)
npm run app:assets

# 4. Open each project to build/run on a simulator or device
npx cap open ios        # Xcode
npx cap open android    # Android Studio
```

After any web change, re-sync the native shells:

```bash
npm run app:sync        # = npm run build && npx cap sync
```

Handy shortcuts: `npm run app:ios`, `npm run app:android` (build + sync + open).

---

## App identity

- **App name:** Theatre4u
- **Bundle / App ID:** `org.theatre4u.app`  (change in `capacitor.config.ts` if desired — do it before the first store submission)
- Config lives in `/capacitor.config.ts`.

## mobile/assets (icons + splash)

Drop a square source logo here and the generator makes every required size:

- `mobile/assets/logo.png` — 1024×1024, the app icon
- `mobile/assets/logo-dark.png` — optional dark variant
- `mobile/assets/splash.png` — 2732×2732, centered mark on the dark (#0d0b11) background

Then run `npm run app:assets`. (Uses `@capacitor/assets`.)

---

## Native features — status + required config

Done in the app (branch `mobile/capacitor-theatre4u`): mobile home + bottom tab bar,
full-screen mobile sign-in, native QR scanner, system font + mobile layout, in-app
label preview, per-item **Print / Save PNG via the OS share sheet**, **native camera**
for Add-Item photos, and **Google sign-in** via system browser + deep link.

**After pulling these changes, run `npm install` first** (new plugins were added:
`@capacitor/share`, `@capacitor/filesystem`, `@capacitor/camera`, `@capacitor/browser`),
then `npm run app:sync`.

### Google sign-in — one setting to flip (Supabase)
The app returns from Google via the deep link `theatre4u://auth-callback`.
In the **Supabase dashboard → Authentication → URL Configuration → Redirect URLs**,
add:  `theatre4u://auth-callback`
(Google Cloud needs no change — Supabase is the OAuth client.) Until this URL is
allow-listed, Google sign-in in the app will fail; **email + password still works.**
Android deep-link scheme is already registered in `android/app/src/main/AndroidManifest.xml`.

### iOS (when we add the iPhone app) — Info.plist
Add these keys (Xcode will also need them for App Store review):
- `NSCameraUsageDescription` — "Take photos of inventory items."
- `NSPhotoLibraryUsageDescription` — "Attach photos to inventory items."
- `NSPhotoLibraryAddUsageDescription` — "Save label images."
- URL scheme `theatre4u` under `CFBundleURLTypes` (for Google sign-in deep link).

## Phase 2 — native upgrades (not done yet)

These are the code changes that make it feel like a real app, planned next:

1. **Native QR / barcode scanner** — replace the web camera in the label/scan flow with
   `@capacitor-mlkit/barcode-scanning` (already a dependency). Big UX win for inventory.
2. **Auth deep links** — Supabase magic-link / OAuth / password-reset currently redirect to
   `window.location.origin`, which is `localhost` inside the app. Add a custom URL scheme +
   `@capacitor/app` `appUrlOpen` handling (or switch those flows to native) so sign-in
   returns to the app. **Email + password sign-in already works without this**; magic links
   and Google OAuth need it.
3. **Push notifications** — wire `@capacitor/push-notifications` + APNs (iOS) / FCM (Android).
4. **Polish** — mobile-first navigation, scanner front-and-center, larger touch targets,
   "add item from camera."

## Phase 3 — store submission (checklist)

**Accounts**
- [ ] Apple Developer Program — enroll ($99/yr), create the App ID `org.theatre4u.app`
- [ ] Google Play Console — register ($25 one-time)

**Assets & listing**
- [ ] App icon (from `npm run app:assets`)
- [ ] Screenshots: iPhone 6.7", iPad 12.9", Android phone/tablet
- [ ] Listing copy: name, subtitle, description, keywords (include: theatre, inventory,
      costumes, props, QR, school)
- [ ] Privacy Policy URL: https://theatre4u.org/#privacy
- [ ] **Data safety / App Privacy disclosures** — declare account email, inventory data,
      and (if enabled) camera + push. Relevant to your school DPAs; be accurate.
- [ ] Support URL + contact: hello@theatre4u.org

**Build & submit**
- [ ] iOS: set signing team in Xcode, Archive → upload to App Store Connect → TestFlight → submit
- [ ] Android: generate a signed AAB in Android Studio → upload to Play Console → internal test → submit

## ArtsTracker (later)

Because the web app already supports the ArtsTracker door, a second app is a separate
Capacitor config/flavor (different `appId`, name, icon) pointing at the arts door, plus its
own store listing — not a second codebase.
