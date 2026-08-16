import type { Language } from '@/types';

/** Centralised, typed access to build-time environment configuration. */
const backend = (import.meta.env.VITE_DATA_BACKEND ?? 'mock') as 'mock' | 'supabase';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const env = {
  backend,
  supabaseUrl,
  supabaseAnonKey,
  enableGoogleAuth: import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true',
  defaultLang: (import.meta.env.VITE_DEFAULT_LANG ?? 'bn') as Language,
  defaultCurrency: import.meta.env.VITE_DEFAULT_CURRENCY ?? '৳',
};

/** True only when a real Supabase backend is configured with credentials. */
export const isSupabaseConfigured =
  backend === 'supabase' && Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

/** True when running against in-browser demo data (not a real backend). */
export const isMockBackend = !isSupabaseConfigured;
