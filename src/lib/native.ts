import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { env } from '@/lib/env';

/**
 * Everything that is different when HisabMate runs as the installed Android app
 * instead of a browser tab. In the browser every function here is a no-op, so
 * the same code ships to both without branching at the call sites.
 */

/** True only inside the packaged app. False in every browser, including mobile. */
export const isNativeApp = Capacitor.isNativePlatform();

/**
 * Where Supabase should send the user back to after an email link (password
 * reset, OAuth).
 *
 * In the browser that is simply the current origin. Inside the app the origin is
 * an internal address (`http://localhost`) that no email client can open, so the
 * real, whitelisted https site is used instead — the link opens in the phone's
 * browser, the password is changed there, and the user returns to the app.
 *
 * Set VITE_PUBLIC_URL to the deployed site for app builds; without it we fall
 * back to the current origin rather than inventing a URL.
 */
export function webRedirectUrl(path = '/'): string {
  const base = (isNativeApp && env.publicUrl ? env.publicUrl : window.location.origin).replace(
    /\/+$/,
    '',
  );
  return `${base}${path}`;
}

/**
 * Match the native status bar to the theme the app is actually showing.
 *
 * The colours are the `--surface` token from src/index.css, because the status
 * bar sits directly above the app's own header bar (`bg-surface/95`) — matching
 * the header, not the page background, is what makes the two read as one
 * surface instead of a stripe.
 */
export async function applyNativeTheme(resolved: 'light' | 'dark'): Promise<void> {
  if (!isNativeApp) return;
  try {
    // Style.Light = light background with dark icons, and vice versa.
    await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: resolved === 'dark' ? '#111C19' : '#FFFFFF' });
  } catch {
    // Older devices can refuse to colour the status bar; the app is unaffected.
  }
}

/**
 * Native shell wiring, called once at startup:
 *
 * 1. Android's hardware/gesture back button walks back through the app's own
 *    history instead of instantly killing the app, and only exits from the
 *    first screen — the behaviour every Android user expects.
 * 2. The launch splash is dismissed as soon as React has painted, so the app
 *    feels quick rather than waiting out a fixed timer.
 */
export function initNativeShell(): void {
  if (!isNativeApp) return;

  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void CapacitorApp.exitApp();
  });

  requestAnimationFrame(() => {
    window.setTimeout(() => {
      void SplashScreen.hide().catch(() => {
        // Nothing to hide (auto-hide already fired) — safe to ignore.
      });
    }, 120);
  });
}
