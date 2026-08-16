import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import type { TranslationKey } from '@/i18n/en';
import { validatePassword } from '@/utils/validation';
import { Button, Input } from '@/components/ui';
import { CenteredScreen } from '@/components/layout/CenteredScreen';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LedgerMark } from '@/components/Splash';

/**
 * Landing page for the password-reset email link. Supabase (with
 * detectSessionInUrl) parses the recovery token from the URL and creates a
 * temporary session, so this route must live OUTSIDE RedirectIfAuthed —
 * otherwise the recovery session would bounce the user away before they can
 * choose a new password.
 */
export default function ResetPassword() {
  const { t } = useI18n();
  const { updatePassword, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const passErr = validatePassword(password);
    const confirmErr = !passErr && password !== confirmPassword ? 'validation.passwordMismatch' : null;
    if (passErr || confirmErr) {
      setErrors({
        password: passErr ? t(passErr as TranslationKey) : undefined,
        confirmPassword: confirmErr ? t(confirmErr as TranslationKey) : undefined,
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const res = await updatePassword(password);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error && res.error !== 'offline' ? res.error : t('error.generic'));
      return;
    }
    toast.success(t('auth.passwordUpdated'));
    // Clear the temporary recovery session and have the user sign in fresh.
    await signOut();
    navigate('/login', { replace: true });
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
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t('auth.resetTitle')}</h1>
        <p className="mt-1.5 text-muted">{t('auth.resetSubtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Input
          label={t('auth.newPassword')}
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
          {t('auth.updatePassword')}
        </Button>
      </form>
    </CenteredScreen>
  );
}
