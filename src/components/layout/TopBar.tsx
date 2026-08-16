import { useNavigate } from 'react-router-dom';
import { Check, CloudOff, RefreshCw, Search, Settings } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSync } from '@/contexts/SyncContext';
import { IconButton } from '@/components/ui';
import { LedgerMark } from '@/components/Splash';
import { cn } from '@/utils/cn';

/** Compact live sync status. Stays quiet when everything is synced. */
function SyncIndicator() {
  const { state, pending, flush } = useSync();
  const { t } = useI18n();

  if (state === 'synced') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-positive-soft px-2 py-1 text-[11px] font-semibold text-positive"
        title={t('sync.synced')}
      >
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }

  if (state === 'offline') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
        <CloudOff size={12} />
        {t('sync.offline')}
      </span>
    );
  }

  // syncing / pending — tappable to force a flush
  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning transition-transform active:scale-95"
    >
      <RefreshCw size={12} className="animate-spin [animation-duration:1.4s]" />
      {pending > 0 ? t('sync.pending', { count: pending }) : t('sync.syncing')}
    </button>
  );
}

/** Persistent top bar for the app shell: brand + business, sync, search, settings. */
export function TopBar({ className }: { className?: string }) {
  const { business } = useData();
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'shrink-0 border-b border-line/70 bg-surface/95 pt-safe backdrop-blur supports-[backdrop-filter]:bg-surface/80',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          aria-label={t('nav.dashboard')}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand text-brand-fg shadow-fab">
            <LedgerMark className="h-[22px] w-[22px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[15px] font-bold leading-tight text-ink">
              {business?.name ?? t('app.name')}
            </span>
            <span className="block truncate text-[11px] leading-tight text-faint">
              {business?.ownerName ?? t('app.tagline')}
            </span>
          </span>
        </button>

        <SyncIndicator />

        <IconButton
          size="sm"
          label={t('common.search')}
          onClick={() => navigate('/search')}
        >
          <Search size={20} />
        </IconButton>
        <IconButton
          size="sm"
          label={t('nav.settings')}
          onClick={() => navigate('/settings')}
        >
          <Settings size={20} />
        </IconButton>
      </div>
    </header>
  );
}
