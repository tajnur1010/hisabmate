import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ThemeMode } from '@/types';
import { applyNativeTheme } from '@/lib/native';

const STORAGE_KEY = 'hisab.theme';

interface ThemeContextValue {
  mode: ThemeMode;
  /** The actually-applied theme after resolving "system". */
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): ThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'system' : readStored(),
  );
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  const resolved = mode === 'system' ? systemTheme : mode;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1512' : '#0D9F6E');
    // In the installed Android app the status bar is native chrome, so it has to
    // be recoloured explicitly to match. No-op in the browser.
    void applyNativeTheme(resolved);
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
