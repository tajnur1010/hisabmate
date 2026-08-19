/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_BACKEND?: 'mock' | 'supabase';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ENABLE_GOOGLE_AUTH?: string;
  readonly VITE_DEFAULT_LANG?: 'bn' | 'en';
  readonly VITE_DEFAULT_CURRENCY?: string;
  /** Deployed https site — used by the packaged app for email-link redirects. */
  readonly VITE_PUBLIC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
