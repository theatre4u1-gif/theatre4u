# BinTrove mobile app (Capacitor) — runbook

BinTrove is a **flavor** of the same Capacitor project — not a separate codebase. One web
app, one native app per brand door. The web app brands itself as BinTrove automatically
inside the shell because this flavor loads `https://bintrove.com` (the webview host is
`bintrove.com`, which `src/core/config.js` resolves to `IS_BINTROVE`).

Everything here is **additive**: Theatre4u stays the default build (`BRAND` unset) and its
`ios/` + `android/` projects are untouched. BinTrove uses its own native folders
`ios-bintrove/` + `android-bintrove/`.

## Identity
- **App name:** BinTrove
- **Bundle / App ID:** `com.bintrove.app`  (change in `capacitor.config.ts` BRANDS map before first store submission if desired)
- **Loads:** `https://bintrove.com`
- **Deep-link scheme:** `bintrove://` (for Google sign-in callback)
- **Brand bg/splash:** teal `#0A5450`
- Config: the `bintrove` entry in `/capacitor.config.ts` (selected via `BRAND=bintrove`).

## One-time setup (on your Mac)
> iOS needs a Mac with Xcode. Android needs Android Studio.

```bash
npm install

# Create the BinTrove native projects (separate folders, won't touch Theatre4u's):
BRAND=bintrove npx cap add ios
BRAND=bintrove npx cap add android

# Generate BinTrove icons + splash (teal) from mobile/assets-bintrove/:
npm run app:bintrove:assets

# Open to build/run:
npm run app:bintrove:ios        # Xcode
npm run app:bintrove:android    # Android Studio
```

After any web change, re-sync the BinTrove shells:
```bash
npm run app:bintrove:sync
```

## Icons + splash
Source art in `mobile/assets-bintrove/`:
- `icon.png` — 1024×1024 (currently a teal placeholder built from the logo mark; drop a
  final designed 1024 here to replace it)
- `splash.png` — 2732×2732 (teal, centered mark)

Run `npm run app:bintrove:assets` to regenerate every required size.

## Google sign-in — Supabase redirect URL
The app returns from Google via `bintrove://auth-callback`. In the **Supabase dashboard →
Authentication → URL Configuration → Redirect URLs**, add:
```
bintrove://auth-callback
```
Until it's allow-listed, Google sign-in in the app fails; **email + password still works.**
The Android scheme is registered automatically when `cap add android` generates
`android-bintrove/app/src/main/AndroidManifest.xml` — confirm the `bintrove` scheme is present.

## iOS Info.plist (Xcode, needed for review)
- `NSCameraUsageDescription` — "Take photos of your items and bins."
- `NSPhotoLibraryUsageDescription` — "Attach photos to your items."
- `NSPhotoLibraryAddUsageDescription` — "Save QR label images."
- URL scheme `bintrove` under `CFBundleURLTypes` (Google sign-in deep link).

## Store listing (BinTrove)
- **Name:** BinTrove — Home Storage, Organized
- **Keywords:** home inventory, storage organizer, QR labels, moving, moving boxes,
  packing, holiday storage, garage organization, declutter, what's in the box
- **Privacy Policy URL:** https://bintrove.com/#privacy
- **Support URL / contact:** hello@bintrove.com
- **Data safety / App Privacy:** declare account email + inventory data, and (if enabled)
  camera + push. Be accurate.
- **Screenshots:** iPhone 6.7", iPad 12.9", Android phone/tablet — use the de-theatred
  BinTrove UI (My Bins, Reports, Account).

## Store fees (reminder)
No extra fees for a 3rd app: Apple Developer is $99/yr **per account** (unlimited apps);
Google Play is a $25 **one-time** fee per account. BinTrove rides the same accounts as
Theatre4u/ArtsTracker.

## ArtsTracker
Same pattern — a `BRAND=artstracker` flavor is already wired in `capacitor.config.ts`
(appId `org.artstracker.app`, loads artstracker.org, native folders `ios-artstracker/` +
`android-artstracker/`). Add `mobile/assets-artstracker/` art and `app:artstracker:*`
scripts the same way if/when you build it here. (If your in-progress ArtsTracker app uses
a different setup, adjust the `artstracker` entry to match — it does not affect Theatre4u
or BinTrove.)
