#!/usr/bin/env bash
#
# Theatre4u mobile one-command setup.
# Run from the project with:   bash mobile/setup.sh
#
# It checks your tools, installs dependencies, builds the web app, and creates
# the native iOS + Android projects. Plain-language status as it goes. It is safe
# to run again — it skips steps that are already done.

# Always work from the project root (the folder this script's parent lives in).
cd "$(dirname "$0")/.." || exit 1

line() { printf '\n────────────────────────────────────────────────────────\n'; }
ok()   { printf '  ✅ %s\n' "$1"; }
warn() { printf '  ⚠️  %s\n' "$1"; }
stop() { printf '\n  ⛔ %s\n\n' "$1"; exit 1; }

line
printf '  Theatre4u mobile setup\n'
line

# ---- 1. Check Node ----
if ! command -v node >/dev/null 2>&1; then
  stop "Node is not installed yet.
     Install it first: go to  https://nodejs.org  and download the
     'LTS' installer for macOS, run it, then re-run this script."
fi
ok "Node $(node -v) found"

if ! command -v npm >/dev/null 2>&1; then
  stop "npm is missing (it normally comes with Node). Reinstall Node from https://nodejs.org"
fi
ok "npm $(npm -v) found"

# ---- 2. Check Xcode (needed for the iPhone/iPad app) ----
HAVE_IOS=0
if command -v xcodebuild >/dev/null 2>&1 && xcode-select -p 2>/dev/null | grep -q "Xcode.app"; then
  ok "Xcode $(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}') found"
  HAVE_IOS=1
  if ! command -v pod >/dev/null 2>&1; then
    warn "CocoaPods is not installed — the iPhone project needs it."
    warn "Install it with:   sudo gem install cocoapods"
    warn "Then run this script again."
    HAVE_IOS=0
  fi
else
  warn "Full Xcode not found. The Android app can still be set up now."
  warn "For the iPhone/iPad app, install Xcode from the Mac App Store, open it"
  warn "once to finish setup, then run this script again."
fi

# ---- 3. Install dependencies ----
line; printf '  Installing dependencies (this can take a few minutes)...\n'
if npm install; then ok "Dependencies installed"; else stop "npm install failed — copy the red text above and send it to me."; fi

# ---- 4. Build the web app ----
line; printf '  Building the web app...\n'
if npm run build; then ok "Web app built into dist/"; else stop "Build failed — copy the red text above and send it to me."; fi

# The website's postbuild renames dist/index.html -> dist/home-theatre4u.html.
# Capacitor needs an index.html entry point, so restore one for the native shell.
node mobile/fix-index.mjs && ok "Checked app entry point (dist/index.html)"

# ---- 5. Create the native projects ----
line; printf '  Creating native projects...\n'

if [ -d "android" ]; then
  ok "Android project already exists (skipping)"
else
  if npx --yes cap add android; then ok "Android project created"; else warn "Android add had a problem — send me the text above."; fi
fi

if [ "$HAVE_IOS" = "1" ]; then
  if [ -d "ios" ]; then
    ok "iOS project already exists (skipping)"
  else
    if npx --yes cap add ios; then ok "iOS project created"; else warn "iOS add had a problem — send me the text above."; fi
  fi
else
  warn "Skipped the iPhone/iPad project for now (see the Xcode note above)."
fi

# ---- 6. Sync web build into the native shells ----
line; printf '  Syncing the latest build into the native apps...\n'
npx --yes cap sync >/dev/null 2>&1 && ok "Synced"

# ---- Done ----
line
printf '  Done! 🎉\n\n'
printf '  Next:\n'
if [ "$HAVE_IOS" = "1" ] && [ -d "ios" ]; then
  printf '   • Open the iPhone app in Xcode:   npx cap open ios\n'
fi
if [ -d "android" ]; then
  printf '   • Open the Android app:           npx cap open android\n'
fi
printf '\n  Anytime you want the app to pick up website changes, run:\n'
printf '   • npm run app:sync\n'
line
