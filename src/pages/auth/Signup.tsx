import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Smartphone, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { isMockBackend } from '@/lib/env';
import type { TranslationKey } from '@/i18n/en';
import { authErrorMessage } from '@/utils/authError';
import { validateEmail, validateName, validatePassword } from '@/utils/validation';
import { Button, Input } from '@/components/ui';
import { CenteredScreen } from '@/components/layout/CenteredScreen';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LedgerMark } from '@/components/Splash';

export default function Signup() {
  const { t } = useI18n();
  const { signUp, continueAsGuest } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nameErr = validateName(fullName);
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    const confirmErr = !passErr && password !== confirmPassword ? 'validation.passwordMismatch' : null;
    if (nameErr || emailErr || passErr || confirmErr) {
      setErrors({
        fullName: nameErr ? t(nameErr as TranslationKey) : undefined,
        email: emailErr ? t(emailErr as TranslationKey) : undefined,
        password: passErr ? t(passErr as TranslationKey) : undefined,
        confirmPassword: confirmErr ? t(confirmErr as TranslationKey) : undefined,
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const res = await signUp(email.trim(), password, fullName.trim());
    setSubmitting(false);
    if (!res.ok) {
      toast.error(authErrorMessage(res.error, t));
      return;
    }
    if (res.needsConfirmation) {
      toast.success(t('auth.signupSubtitle'));
      navigate('/login', { replace: true });
      return;
    }
    // On success the auth state change routes us onward; onboarding gate handles the rest.
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t('auth.signupTitle')}</h1>
        <p className="mt-1.5 text-muted">{t('auth.signupSubtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Input
          label={t('auth.fullName')}
          autoComplete="name"
          leftIcon={<User size={18} />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />
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
          autoComplete="new-password"
          placeholder="••••••••"
          leftIcon={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={t('validation.passwordShort')}
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
        <Input
          label={t('auth.confirmPassword')}
          type={showPass ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="••••••••"
          leftIcon={<Lock size={18} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('auth.signup')}
        </Button>
      </form>

      {/* Signing up needs a working connection. Offer the offline route here
          too, so a shop with no data left can still start keeping its khata. */}
      <div className="my-6 flex items-center gap-3 text-sm text-faint">
        <span className="h-px flex-1 bg-line" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button
        variant="soft"
        size="lg"
        fullWidth
        leftIcon={<Smartphone size={18} />}
        onClick={() => {
          continueAsGuest();
          navigate('/', { replace: true });
        }}
      >
        {t('auth.guestStart')}
      </Button>
      <p className="mt-2 px-1 text-center text-[11.5px] leading-tight text-faint">
        {t('auth.guestHint')}
      </p>

      {isMockBackend && (
        <p className="mt-6 rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm text-brand-strong">
          {t('auth.demoHint')}
        </p>
      )}

      <p className="mt-8 pb-8 text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-brand-strong hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </CenteredScreen>
  );
}
