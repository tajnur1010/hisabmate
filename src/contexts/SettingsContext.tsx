import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppSettings } from '@/types';
import { DEFAULT_REMINDER_TEMPLATE_BN, DEFAULT_REMINDER_TEMPLATE_EN } from '@/lib/constants';

const STORAGE_KEY = 'hisab.settings';

const DEFAULTS: AppSettings = {
  reminderTemplateBn: DEFAULT_REMINDER_TEMPLATE_BN,
  reminderTemplateEn: DEFAULT_REMINDER_TEMPLATE_EN,
  dueSoonDays: 3,
  showBengaliNumerals: false,
  pinLockEnabled: false,
};

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readStored(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() =>
    typeof window === 'undefined' ? DEFAULTS : readStored(),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, update, reset }),
    [settings, update, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
