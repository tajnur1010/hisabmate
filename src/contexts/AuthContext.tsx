import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { webRedirectUrl } from '@/lib/native';
import { defaultAdapterKind } from '@/services';
import type { AdapterKind } from '@/services';
import { uuid } from '@/utils/id';

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string;
}

/**
 * How the current session stores its data.
 * - `cloud`  — a real account on the configured backend (Supabase when set up).
 * - `guest`  — no account at all: everything lives in this device's own
 *              database, so the app works with no internet and no sign-up.
 */
export type SessionMode = 'cloud' | 'guest';

interface AuthResult {
  ok: boolean;
  error?: string;
  /** Supabase may require email confirmation before a session exists. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Which kind of session this is. */
  mode: SessionMode;
  /** Convenience flag: signed in without an account, data stays on the device. */
  isGuest: boolean;
  /** Which data backend this session must talk to. */
  adapterKind: AdapterKind;
  /** True when this device already holds guest data from an earlier visit. */
  hasGuestData: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  /** Starts (or resumes) an on-device session that needs no account. */
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  /** Sends a password-reset email (Supabase mode only). */
  resetPassword: (email: string) => Promise<AuthResult>;
  /** Sets a new password for the current (recovery) session. */
  updatePassword: (newPassword: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_SESSION = 'hisab.session';
const LOCAL_USERS = 'hisab.users';
const LOCAL_MODE = 'hisab.mode';
const LOCAL_GUEST = 'hisab.guest';

/* ── On-device auth (used when Supabase isn't configured) ──────────────── */
type LocalUsers = Record<string, AuthUser>;

function readLocalUsers(): LocalUsers {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS) ?? '{}') as LocalUsers;
  } catch {
    return {};
  }
}

function readLocalSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/* ── Guest session ─────────────────────────────────────────────────────── */

/**
 * The guest identity is created once and then reused forever on this device.
 * That matters: the id is the owner key for every row in the on-device
 * database, so minting a fresh one on each visit would leave the shop's real
 * ledger stranded behind an id nobody asks for again.
 */
function readGuest(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_GUEST);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    return typeof parsed?.id === 'string' && parsed.id
      ? { id: parsed.id, email: null, fullName: parsed.fullName || 'Guest' }
      : null;
  } catch {
    return null;
  }
}

function ensureGuest(): AuthUser {
  const existing = readGuest();
  if (existing) return existing;
  const guest: AuthUser = { id: `guest-${uuid()}`, email: null, fullName: 'Guest' };
  localStorage.setItem(LOCAL_GUEST, JSON.stringify(guest));
  return guest;
}

function readMode(): SessionMode {
  return localStorage.getItem(LOCAL_MODE) === 'guest' ? 'guest' : 'cloud';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<SessionMode>(() => readMode());
  const [hasGuestData, setHasGuestData] = useState(() => readGuest() !== null);

  // Supabase's auth listener lives for the whole app, but it must not speak for
  // a guest session — a stale cloud token would otherwise yank a guest into an
  // account they didn't ask for. The ref keeps the listener in step with mode
  // without tearing the subscription down and rebuilding it.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let active = true;

    // A guest session is resolved entirely on the device: no network, no token
    // refresh, so the app opens with zero connectivity.
    const guestBoot = readMode() === 'guest';
    if (guestBoot) {
      setUser(ensureGuest());
      setLoading(false);
    }

    if (isSupabaseConfigured && supabase) {
      if (!guestBoot) {
        supabase.auth.getSession().then(({ data }) => {
          if (!active || modeRef.current === 'guest') return;
          setUser(mapSupabaseUser(data.session?.user));
          setLoading(false);
        });
      }
      // Subscribed even when booting as a guest (the handler ignores events
      // while `mode` is guest), because a guest who later signs out and signs
      // in with an account needs this listener already in place.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (modeRef.current === 'guest') return;
        setUser(mapSupabaseUser(session?.user));
      });
      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    }

    // Local mode
    if (!guestBoot) {
      setUser(readLocalSession());
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, []);

  /** Moves the session out of guest mode before an account sign-in attempt. */
  const claimCloudMode = useCallback(() => {
    localStorage.removeItem(LOCAL_MODE);
    modeRef.current = 'cloud';
    setMode('cloud');
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password) => {
      claimCloudMode();
      if (isSupabaseConfigured && supabase) {
        if (!navigator.onLine) return { ok: false, error: 'offline' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { ok: false, error: error.message } : { ok: true };
      }
      const users = readLocalUsers();
      const key = email.trim().toLowerCase();
      const existing = users[key];
      const account: AuthUser = existing ?? { id: uuid(), email: key, fullName: key.split('@')[0] };
      users[key] = account;
      localStorage.setItem(LOCAL_USERS, JSON.stringify(users));
      localStorage.setItem(LOCAL_SESSION, JSON.stringify(account));
      setUser(account);
      return { ok: true };
    },
    [claimCloudMode],
  );

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (email, password, fullName) => {
      claimCloudMode();
      if (isSupabaseConfigured && supabase) {
        if (!navigator.onLine) return { ok: false, error: 'offline' };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, needsConfirmation: !data.session };
      }
      const users = readLocalUsers();
      const key = email.trim().toLowerCase();
      const account: AuthUser = { id: uuid(), email: key, fullName: fullName.trim() || key.split('@')[0] };
      users[key] = account;
      localStorage.setItem(LOCAL_USERS, JSON.stringify(users));
      localStorage.setItem(LOCAL_SESSION, JSON.stringify(account));
      setUser(account);
      return { ok: true };
    },
    [claimCloudMode],
  );

  const signInWithGoogle = useCallback<AuthContextValue['signInWithGoogle']>(async () => {
    claimCloudMode();
    if (isSupabaseConfigured && supabase) {
      if (!navigator.onLine) return { ok: false, error: 'offline' };
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: webRedirectUrl() },
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const account: AuthUser = { id: uuid(), email: 'you@example.com', fullName: 'Shop Owner' };
    localStorage.setItem(LOCAL_SESSION, JSON.stringify(account));
    setUser(account);
    return { ok: true };
  }, [claimCloudMode]);

  /**
   * Enter the app with no account. Nothing is sent anywhere; the same guest
   * identity (and therefore the same ledger) comes back on every later visit.
   */
  const continueAsGuest = useCallback<AuthContextValue['continueAsGuest']>(() => {
    const guest = ensureGuest();
    localStorage.setItem(LOCAL_MODE, 'guest');
    modeRef.current = 'guest';
    setMode('guest');
    setHasGuestData(true);
    setUser(guest);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    // Leaving guest mode keeps the device's data exactly where it is — the
    // guest identity is remembered so tapping "continue without an account"
    // again returns to the same ledger. Only "Clear data" erases it.
    const wasGuest = modeRef.current === 'guest';
    if (!wasGuest && isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_MODE);
    localStorage.removeItem(LOCAL_SESSION);
    modeRef.current = 'cloud';
    setMode('cloud');
    setUser(null);
  }, []);

  const resetPassword = useCallback<AuthContextValue['resetPassword']>(async (email) => {
    if (isSupabaseConfigured && supabase) {
      if (!navigator.onLine) return { ok: false, error: 'offline' };
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: webRedirectUrl('/reset'),
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    // On-device mode keeps no server-side credential, so there is nothing to reset.
    return { ok: false, error: 'offline' };
  }, []);

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (newPassword) => {
    if (isSupabaseConfigured && supabase) {
      if (!navigator.onLine) return { ok: false, error: 'offline' };
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return { ok: false, error: 'offline' };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      mode,
      isGuest: mode === 'guest',
      adapterKind: mode === 'guest' ? 'mock' : defaultAdapterKind(),
      hasGuestData,
      signIn,
      signUp,
      signInWithGoogle,
      continueAsGuest,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [
      user,
      loading,
      mode,
      hasGuestData,
      signIn,
      signUp,
      signInWithGoogle,
      continueAsGuest,
      signOut,
      resetPassword,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function mapSupabaseUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | undefined | null): AuthUser | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const fullName = (meta.full_name as string) || (meta.name as string) || (u.email ?? '').split('@')[0] || 'User';
  return { id: u.id, email: u.email ?? null, fullName };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
