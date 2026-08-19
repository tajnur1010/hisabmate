import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { isMockBackend, env } from '@/lib/env';
import type { TranslationKey } from '@/i18n/en';
import { authErrorMessage } from '@/utils/authError';
import { validateEmail, validatePassword } from '@/utils/validation';
import { Button, Input } from '@/components/ui';
import { CenteredScreen } from '@/components/layout/CenteredScreen';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LedgerMark } from '@/components/Splash';
import { GoogleGlyph } from '@/components/GoogleGlyph';

export default function Login() {
  const { t } = useI18n();
  const { signIn, signInWithGoogle, continueAsGuest, hasGuestData } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setErrors({
        email: emailErr ? t(emailErr as TranslationKey) : undefined,
        password: passErr ? t(passErr as TranslationKey) : undefined,
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const res = await signIn(email.trim(), password);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(authErrorMessage(res.error, t));
      return;
    }
    navigate('/', { replace: true });
  }

  async function onGoogle() {
    const res = await signInWithGoogle();
    if (!res.ok) toast.error(authErrorMessage(res.error, t));
    else if (isMockBackend) navigate('/', { replace: true });
  }

  /** No account, no network — straight into the app with on-device storage. */
  function onGuest() {
    continueAsGuest();
    navigate('/', { replace: true });
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t('auth.loginTitle')}</h1>
        <p className="mt-1.5 text-muted">{t('auth.loginSubtitle')}</p>
      </div>

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
          error={errors.email}
        />
        <Input
          label={t('auth.password')}
          type={showPass ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          leftIcon={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="text-faint hover:text-ink"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <div className="flex justify-end">
          <Link to="/forgot" className="text-sm font-medium text-brand-strong hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('auth.login')}
        </Button>
      </form>

      {/* Other ways in. One divider covers both, so the screen doesn't grow a
          second "or" when Google sign-in is switched off. */}
      <div className="my-6 flex items-center gap-3 text-sm text-faint">
        <span className="h-px flex-1 bg-line" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="space-y-3">
        {env.enableGoogleAuth && (
          <Button variant="secondary" size="lg" fullWidth onClick={onGoogle} leftIcon={<GoogleGlyph />}>
            {t('auth.continueGoogle')}
          </Button>
        )}

        {/* The offline route: no sign-up, no server, works with no network at
            all. Kept as prominent as the account options because for many shop
            owners this is the only way in. */}
        <Button
          variant="soft"
          size="lg"
          fullWidth
          onClick={onGuest}
          leftIcon={<Smartphone size={18} />}
        >
          {hasGuestData ? t('auth.guestResume') : t('auth.guestStart')}
        </Button>
        <p className="px-1 text-center text-[11.5px] leading-tight text-faint">
          {t('auth.guestHint')}
        </p>
      </div>

      {isMockBackend && (
        <p className="mt-6 rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm text-brand-strong">
          {t('auth.demoHint')}
        </p>
      )}

      <p className="mt-8 pb-8 text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" className="font-semibold text-brand-strong hover:underline">
          {t('auth.signup')}
        </Link>
      </p>
    </CenteredScreen>
  );
}
