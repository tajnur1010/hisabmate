import { useState } from 'react';
import { CloudOff, RefreshCw, ServerCrash, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui';
import { LedgerMark } from '@/components/Splash';

/**
 * Shown when the first cloud load failed, instead of guessing.
 *
 * The old behaviour sent anyone without a loaded business to onboarding, which
 * for an offline user meant being asked to create a shop they already have —
 * and creating a duplicate the moment they obliged. So this screen says plainly
 * that the data could not be reached, offers a retry, and offers the offline
 * route: keep working on this device with no account.
 */
export function DataUnavailable() {
  const { t } = useI18n();
  const { error, refresh } = useData();
  const { isGuest, continueAsGuest, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  async function onRetry() {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg px-6 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-surface-2 text-muted">
        {offline ? <CloudOff size={28} /> : <ServerCrash size={28} />}
      </span>

      <div className="space-y-2">
        <h1 className="font-display text-xl font-semibold text-ink">
          {offline ? t('offline.title') : t('offline.failedTitle')}
        </h1>
        <p className="mx-auto max-w-[19rem] text-sm leading-relaxed text-muted">
          {offline ? t('offline.body') : t('offline.failedBody')}
        </p>
        {/* The real reason, verbatim — a vague "something went wrong" would
            leave the shop owner with nothing to act on or report. */}
        {error && <p className="break-words text-[11px] leading-tight text-faint">{error}</p>}
      </div>

      <div className="w-full max-w-[19rem] space-y-2.5">
        <Button
          fullWidth
          loading={retrying}
          leftIcon={<RefreshCw size={17} />}
          onClick={() => void onRetry()}
        >
          {t('offline.retry')}
        </Button>

        {/* A guest's data is already on this device, so there is nothing to
            switch to — the button only makes sense for account sessions. */}
        {!isGuest && (
          <>
            <Button
              fullWidth
              variant="secondary"
              leftIcon={<Smartphone size={17} />}
              onClick={continueAsGuest}
            >
              {t('offline.useOffline')}
            </Button>
            <p className="text-[11px] leading-tight text-faint">{t('offline.useOfflineHint')}</p>
          </>
        )}

        <Button fullWidth variant="ghost" size="sm" onClick={() => void signOut()}>
          {t('settings.logout')}
        </Button>
      </div>

      <span className="mt-2 inline-flex items-center gap-1.5 text-faint">
        <LedgerMark className="h-4 w-4" />
        <span className="text-[11px] font-semibold tracking-tight">{t('app.name')}</span>
      </span>
    </div>
  );
}
