import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Language } from '@/types';
import { env } from '@/lib/env';
import { en } from '@/i18n/en';
import type { TranslationKey } from '@/i18n/en';
import { bn } from '@/i18n/bn';

const STORAGE_KEY = 'hisab.lang';

type Interpolations = Record<string, string | number>;

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Interpolations) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStored(): Language {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'bn' || raw === 'en' ? raw : env.defaultLang;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() =>
    typeof window === 'undefined' ? env.defaultLang : readStored(),
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Interpolations) => {
      const dict = lang === 'bn' ? bn : en;
      let str: string = (dict[key] as string | undefined) ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return str;
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
