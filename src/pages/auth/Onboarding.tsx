import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, User } from 'lucide-react';
import type { Language } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { env } from '@/lib/env';
import type { TranslationKey } from '@/i18n/en';
import { validateName } from '@/utils/validation';
import { errorMessage } from '@/utils/errorMessage';
import { Button, Input, SegmentedControl } from '@/components/ui';
import { CenteredScreen } from '@/components/layout/CenteredScreen';
import { LedgerMark } from '@/components/Splash';

const CURRENCIES = ['৳', '₹', '$', '€', '£', '₨'];

export default function Onboarding() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const { createBusiness } = useData();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.fullName ?? '');
  const [currency, setCurrency] = useState(env.defaultCurrency || '৳');
  const [language, setLanguage] = useState<Language>(lang);
  const [errors, setErrors] = useState<{ name?: string; ownerName?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nameErr = validateName(name);
    const ownerErr = validateName(ownerName);
    if (nameErr || ownerErr) {
      setErrors({
        name: nameErr ? t(nameErr as TranslationKey) : undefined,
        ownerName: ownerErr ? t(ownerErr as TranslationKey) : undefined,
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await createBusiness({
        name: name.trim(),
        ownerName: ownerName.trim(),
        currency,
        language,
      });
      setLang(language);
      navigate('/', { replace: true });
    } catch (err) {
      // Surface the real reason (Supabase errors aren't Error instances).
      console.error('createBusiness failed:', err);
      toast.error(errorMessage(err, t('error.saveFailed')));
      setSubmitting(false);
    }
  }

  return (
    <CenteredScreen>
      <div className="flex flex-col items-center pt-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-brand-fg shadow-fab">
          <LedgerMark />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">
          {t('onboarding.title')}
        </h1>
        <p className="mt-1.5 max-w-xs text-muted">{t('onboarding.subtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-9 space-y-4" noValidate>
        <Input
          label={t('onboarding.businessName')}
          leftIcon={<Store size={18} />}
          placeholder={lang === 'bn' ? 'যেমন: রহিম স্টোর' : 'e.g. Rahim Store'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoFocus
        />
        <Input
          label={t('onboarding.ownerName')}
          leftIcon={<User size={18} />}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          error={errors.ownerName}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">{t('onboarding.currency')}</label>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={
                  'h-12 w-12 rounded-2xl border text-lg font-num font-semibold transition-all active:scale-95 ' +
                  (currency === c
                    ? 'border-brand bg-brand-soft text-brand-strong'
                    : 'border-line bg-elevated text-muted hover:border-line/80')
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">{t('onboarding.language')}</label>
          <SegmentedControl<Language>
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'bn', label: 'বাংলা' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-2">
          {t('onboarding.finish')}
        </Button>
      </form>
      <div className="h-8 shrink-0" />
    </CenteredScreen>
  );
}
