import type { CapacitorConfig } from '@capacitor/cli';

// Multi-brand native shell (Capacitor). One web codebase, one app per brand door.
// The web app brands itself by the webview host — because each flavor loads its own
// live site (server.url), src/core/config.js resolves the right brand automatically
// (theatre4u.org → Theatre4u, artstracker.org → ArtsTracker, bintrove.com → BinTrove).
//
// Pick the flavor at build time with the BRAND env var:
//     BRAND=bintrove   npm run app:bintrove:sync
//     BRAND=artstracker npx cap sync
//     (unset)          → Theatre4u (DEFAULT — identical to the original config)
//
// Each non-default flavor uses its OWN native project folders (ios-<brand> /
// android-<brand>) so the three apps never collide and Theatre4u's existing ios/
// and android/ projects are untouched.
type Brand = 'theatre4u' | 'artstracker' | 'bintrove';
const BRAND: Brand = (process.env.BRAND as Brand) || 'theatre4u';

const BRANDS: Record<Brand, {
  appId: string; appName: string; url: string; bg: string;
  scheme: string; iosPath?: string; androidPath?: string;
}> = {
  // DEFAULT — unchanged from the original Theatre4u config (native paths omitted =
  // Capacitor defaults 'ios' / 'android', so the existing projects are reused as-is).
  theatre4u: {
    appId: 'org.theatre4u.app', appName: 'Theatre4u',
    url: 'https://theatre4u.org', bg: '#0d0b11', scheme: 'theatre4u',
  },
  artstracker: {
    appId: 'org.artstracker.app', appName: 'ArtsTracker',
    url: 'https://artstracker.org', bg: '#0d0b11', scheme: 'artstracker',
    iosPath: 'ios-artstracker', androidPath: 'android-artstracker',
  },
  bintrove: {
    appId: 'com.bintrove.app', appName: 'BinTrove',
    url: 'https://bintrove.com', bg: '#0A5450', scheme: 'bintrove',
    iosPath: 'ios-bintrove', androidPath: 'android-bintrove',
  },
};

const b = BRANDS[BRAND];

const config: CapacitorConfig = {
  appId: b.appId,
  appName: b.appName,
  webDir: 'dist',
  backgroundColor: b.bg,
  // Load the live site so every website change reaches installed apps instantly
  // (no reinstall / no store review). The bundled dist/ stays as a fallback.
  server: {
    url: b.url,
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: b.bg,
    ...(b.iosPath ? { path: b.iosPath } : {}),
  },
  android: {
    backgroundColor: b.bg,
    ...(b.androidPath ? { path: b.androidPath } : {}),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: b.bg,
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
