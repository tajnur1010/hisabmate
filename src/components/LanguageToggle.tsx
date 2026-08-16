import { useI18n } from '@/contexts/I18nContext';
import { cn } from '@/utils/cn';

/** Compact bn/EN switch used on auth and onboarding screens. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cn('inline-flex items-center rounded-full bg-surface-2 p-0.5 text-sm font-semibold', className)}>
      <button
        onClick={() => setLang('bn')}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          lang === 'bn' ? 'bg-elevated text-ink shadow-soft' : 'text-muted',
        )}
        aria-pressed={lang === 'bn'}
      >
        বাংলা
      </button>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          lang === 'en' ? 'bg-elevated text-ink shadow-soft' : 'text-muted',
        )}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
    </div>
  );
}
