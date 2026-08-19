import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { isMockBackend } from '@/lib/env';
import type { TranslationKey } from '@/i18n/en';
import { authErrorMessage } from '@/utils/authError';
import { validateEmail } from '@/utils/validation';
import { Button, Input } from '@/components/ui';
import { CenteredScreen } from '@/components/layout/CenteredScreen';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LedgerMark } from '@/components/Splash';

export default function ForgotPassword() {
  const { t } = useI18n();
  const { resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(t(emailErr as TranslationKey));
      return;
    }
    setError(undefined);

    // On-device mode has no cloud account to reset — say so plainly.
    if (isMockBackend) {
      toast.show(t('auth.resetNeedsOnline'), 'info');
      return;
    }

    setSubmitting(true);
    const res = await resetPassword(email.trim());
    setSubmitting(false);
    if (!res.ok) {
      toast.error(authErrorMessage(res.error, t));
      return;
    }
    // Don't reveal whether the address is registered — show the same confirmation either way.
    setSent(true);
  }

  return (
    <CenteredScreen>
      <div className="flex items-center justify-between pt-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-brand-fg shadow-soft">
          <LedgerMark />
        </div>
        <LanguageToggle />
      </div>

      <div className="mt-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t('auth.forgotTitle')}</h1>
        <p className="mt-1.5 text-muted">{t('auth.forgotSubtitle')}</p>
      </div>

      {sent ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl bg-brand-soft px-5 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-fg">
            <MailCheck size={26} />
          </span>
          <p className="text-sm font-medium text-brand-strong">{t('auth.resetLinkSent')}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <Input
            label={t('auth.email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            leftIcon={<Mail size={18} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {t('auth.sendResetLink')}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={() => navigate('/login')}
        className="mt-8 flex w-full items-center justify-center gap-1.5 pb-8 text-sm font-semibold text-brand-strong hover:underline"
      >
        <ArrowLeft size={16} />
        {t('auth.backToLogin')}
      </button>
    </CenteredScreen>
  );
}
