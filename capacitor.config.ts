import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor turns the existing HisabMate web app into a real Android app: the
 * built `dist/` bundle is packaged INSIDE the APK and served by the app's own
 * WebView, so the ledger opens instantly and works with no internet. Only
 * Supabase sync talks to the network.
 *
 * Nothing about the web build changes — https://hisabmate-nu.vercel.app keeps
 * working exactly as before. This file only describes the native wrapper.
 */
const config: CapacitorConfig = {
  // Reverse-domain id. This is the app's permanent identity on the device and
  // on Play Store — changing it later means a brand-new app, so keep it fixed.
  appId: 'com.hisabmate.app',
  appName: 'HisabMate',
  webDir: 'dist',

  android: {
    // The bundle is local, so there is no http content to mix in.
    allowMixedContent: false,
    // Lets the WebView keep native keyboard behaviour on form inputs.
    captureInput: true,
  },

  plugins: {
    SplashScreen: {
      // A short branded launch screen. `launchAutoHide` stays true on purpose:
      // even if the app's own hide() call never runs, the splash can never get
      // stuck on screen.
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0B1512',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      // The app paints its own header, so the status bar must not sit on top of
      // it. Colour and icon style are set from JS to follow light/dark theme
      // (see src/lib/native.ts).
      overlaysWebView: false,
      backgroundColor: '#0D9F6E',
    },
  },
};

export default config;
