import type { CapacitorConfig } from '@capacitor/cli';

// Theatre4u native shell (Capacitor). Wraps the existing Vite-built web app (dist/)
// into native iOS, iPadOS, and Android apps. The web app brands itself as Theatre4u
// automatically inside the shell because the webview host is "localhost", which
// src/core/config.js already treats as Theatre4u (IS_THEATRE4U).
//
// We bundle the built web app (webDir: 'dist') rather than loading the live URL, so
// this is a real installable app (offline-tolerant, store-review-friendly). The app
// still talks to Supabase/Stripe over the network exactly as the website does.
const config: CapacitorConfig = {
  appId: 'org.theatre4u.app',
  appName: 'Theatre4u',
  webDir: 'dist',
  backgroundColor: '#0d0b11',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0d0b11',
  },
  android: {
    backgroundColor: '#0d0b11',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0d0b11',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
