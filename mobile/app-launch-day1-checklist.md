# App launch — "day 1 after approval" checklist (all 3 brands)

Run once the developer accounts are ACTIVE (Apple approved + $99 paid; Google org account live).
Everything is a Mac-side task. Do one brand fully, then repeat for the next.
Brands: theatre4u (default) · bintrove · artstracker. Substitute <brand> below.

## 0. One-time, shared (do once)
- [ ] Apple: in **App Store Connect** (appstoreconnect.apple.com), confirm the org shows as **Artstracker LLC** and you're the Account Holder (admin@artstracker.org).
- [ ] Apple: Certificates → let Xcode manage signing automatically (easiest) OR create a Distribution cert + provisioning profiles.
- [ ] Google: in **Play Console**, finish org verification (D-U-N-S) and set up the **payment profile**.
- [ ] Mac prep: `npm i` in the repo; Xcode + Android Studio installed; `npx cap --version` works.

## 1. Create the native project for the brand
- [ ] `BRAND=<brand> npx cap add ios`
- [ ] `BRAND=<brand> npx cap add android`
  (theatre4u already has ios/ + android/ — skip add, just sync.)
- [ ] `npm run app:<brand>:assets`   (generates icons + splash from mobile/assets-<brand>/)
- [ ] `npm run app:<brand>:sync`

## 2. iOS (Xcode)
- [ ] `npm run app:<brand>:ios` (opens Xcode on ios-<brand>/)
- [ ] Signing & Capabilities → select the **Artstracker LLC** team; let Xcode manage signing.
- [ ] Bundle ID matches capacitor.config: theatre4u `org.theatre4u.app` · bintrove `com.bintrove.app` · artstracker `org.artstracker.app`.
- [ ] Info.plist — add usage strings (required or the app is rejected):
      - NSCameraUsageDescription = "Scan QR labels and add item photos."
      - NSPhotoLibraryUsageDescription = "Add photos of your items."
      - NSPhotoLibraryAddUsageDescription = "Save labels/exports to your photos." (if used)
- [ ] URL scheme (for auth callback): add `<brand>` scheme (theatre4u / artstracker / bintrove).
- [ ] Set version 1.0.0, build 1.
- [ ] Run on a simulator + a real device to smoke-test sign-in, add item, QR scan.
- [ ] Product → Archive → Distribute App → App Store Connect → Upload.

## 3. Android (Android Studio)
- [ ] `npm run app:<brand>:android`
- [ ] Set applicationId = same bundle ID; versionCode 1 / versionName 1.0.0.
- [ ] AndroidManifest: CAMERA permission present (for QR/photos); add the `<brand>` deep-link scheme.
- [ ] Build → Generate Signed Bundle (AAB) → create/choose an upload keystore (SAVE IT — losing it blocks future updates).
- [ ] Upload the .aab in Play Console.

## 4. Supabase (auth redirect) — per brand host
- [ ] Supabase → Authentication → URL Configuration → add `<brand>://auth-callback` (e.g. `bintrove://auth-callback`) to the redirect allow-list, so email confirm/reset returns into the app.

## 5. Store listing + review
- [ ] Paste the listing from mobile/<brand>-store-listing.md (name, subtitle, description, keywords, category).
- [ ] Upload screenshots per mobile/app-screenshots-shotlist.md (capture logged-in w/ sample data).
- [ ] Google: upload the 1024×500 feature graphic + 512 icon.
- [ ] Privacy policy URL + data-safety / App Privacy answers (from the listing doc).
- [ ] Apple: fill Age Rating, set price = Free, pick territories.
- [ ] Submit for review. (Apple: ~1–3 days typical. Google: a few hours–2 days; first app can take longer.)

## 6. After approval
- [ ] Release to the stores.
- [ ] Swap the website "Get the app" links from the PWA/add-to-home instructions to the real store badges once live.

## Notes / gotchas
- **Guideline 4.3 (Apple):** three near-identical apps from one account can get a "spam/duplicate" flag. Mitigate: each has a distinct brand, audience, icon, screenshots, and description (we have that). If flagged, reply that they serve different audiences (theatre programs / arts programs / home consumers).
- **Keystore (Android):** back up the upload keystore + passwords somewhere safe. It's unrecoverable.
- **No extra fees:** all three apps live under the one Apple account ($99/yr) and one Google account ($25 once).
- Build order suggestion: **BinTrove first** (newest, cleanest, mobile app.html already polished), then Theatre4u, then ArtsTracker.
