import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { uuid } from '@/utils/id';

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  /** Supabase may require email confirmation before a session exists. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Sends a password-reset email (Supabase mode only). */
  resetPassword: (email: string) => Promise<AuthResult>;
  /** Sets a new password for the current (recovery) session. */
  updatePassword: (newPassword: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_SESSION = 'hisab.session';
const LOCAL_USERS = 'hisab.users';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setUser(mapSupabaseUser(data.session?.user));
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(mapSupabaseUser(session?.user));
      });
      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    }
    // Local mode
    setUser(readLocalSession());
    setLoading(false);
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    if (isSupabaseConfigured && supabase) {
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
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (email, password, fullName) => {
    if (isSupabaseConfigured && supabase) {
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
  }, []);

  const signInWithGoogle = useCallback<AuthContextValue['signInWithGoogle']>(async () => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    const account: AuthUser = { id: uuid(), email: 'you@example.com', fullName: 'Shop Owner' };
    localStorage.setItem(LOCAL_SESSION, JSON.stringify(account));
    setUser(account);
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_SESSION);
    setUser(null);
  }, []);

  const resetPassword = useCallback<AuthContextValue['resetPassword']>(async (email) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset`,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    // On-device mode keeps no server-side credential, so there is nothing to reset.
    return { ok: false, error: 'offline' };
  }, []);

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (newPassword) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return { ok: false, error: 'offline' };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, signInWithGoogle, signOut, resetPassword, updatePassword }),
    [user, loading, signIn, signUp, signInWithGoogle, signOut, resetPassword, updatePassword],
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
