import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ChevronRight,
  HelpCircle,
  Home,
  MoreHorizontal,
  Package,
  Plus,
  Receipt,
  Settings,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useQuickActions } from '@/features/quick-actions/QuickActions';
import { Sheet } from '@/components/ui';
import type { TranslationKey } from '@/i18n/en';
import { cn } from '@/utils/cn';

interface Tab {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  end?: boolean;
}

/** Primary tabs — two on each side of the central quick-add button. */
const LEFT_TABS: Tab[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home, end: true },
  { to: '/customers', labelKey: 'nav.customers', icon: Users },
];
const RIGHT_TABS: Tab[] = [{ to: '/suppliers', labelKey: 'nav.suppliers', icon: Truck }];

/** Secondary destinations, reached from the "More" sheet. */
const MORE_LINKS: Tab[] = [
  { to: '/products', labelKey: 'nav.products', icon: Package },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
  { to: '/transactions', labelKey: 'nav.transactions', icon: Receipt },
  { to: '/expenses', labelKey: 'nav.expenses', icon: Wallet },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
  { to: '/help', labelKey: 'help.title', icon: HelpCircle },
];

const tabItem = 'group flex flex-1 flex-col items-center justify-center gap-0.5 pt-1';
const tabActive = 'text-brand-strong';
const tabIdle = 'text-faint group-hover:text-muted';
const tabLabel = 'text-[10.5px] font-semibold tracking-tight transition-colors';

function TabLink({ tab }: { tab: Tab }) {
  const { t } = useI18n();
  const Icon = tab.icon;
  return (
    <NavLink to={tab.to} end={tab.end} className={tabItem}>
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            strokeWidth={isActive ? 2.5 : 2}
            className={cn('transition-colors', isActive ? tabActive : tabIdle)}
          />
          <span className={cn(tabLabel, isActive ? tabActive : tabIdle)}>{t(tab.labelKey)}</span>
        </>
      )}
    </NavLink>
  );
}

/** Tab-styled button (not a route) that opens the "More" sheet. */
function MoreButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onClick} className={tabItem} aria-label={t('nav.more')}>
      <MoreHorizontal
        size={18}
        strokeWidth={active ? 2.5 : 2}
        className={cn('transition-colors', active ? tabActive : tabIdle)}
      />
      <span className={cn(tabLabel, active ? tabActive : tabIdle)}>{t('nav.more')}</span>
    </button>
  );
}

/** Fixed bottom tab bar with a raised central quick-add (+) button. */
export function BottomNav() {
  const { t } = useI18n();
  const { openMenu } = useQuickActions();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const go = (to: string) => {
    setMoreOpen(false);
    navigate(to);
  };

  return (
    <nav className="relative shrink-0 border-t border-line/70 bg-surface/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex h-16 items-stretch">
        <div className="flex flex-1 items-stretch">
          {LEFT_TABS.map((tab) => (
            <TabLink key={tab.to} tab={tab} />
          ))}
        </div>

        {/* Spacer for the floating action button */}
        <div className="w-16 shrink-0" aria-hidden />

        <div className="flex flex-1 items-stretch">
          {RIGHT_TABS.map((tab) => (
            <TabLink key={tab.to} tab={tab} />
          ))}
          <MoreButton active={moreOpen} onClick={() => setMoreOpen(true)} />
        </div>
      </div>

      {/* Central raised FAB */}
      <button
        type="button"
        onClick={openMenu}
        aria-label={t('quick.title')}
        className="absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-brand-fg shadow-fab ring-4 ring-bg transition-transform duration-150 active:scale-90"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* "More" sheet — secondary screens not shown on the tab bar. */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.more')}>
        <div className="space-y-2 pb-2">
          {MORE_LINKS.map(({ to, labelKey, icon: Icon }) => (
            <button
              key={to}
              type="button"
              onClick={() => go(to)}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3 text-left transition-all active:scale-[0.99] hover:border-line/70"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
                <Icon size={18} />
              </span>
              <span className="flex-1 text-sm font-semibold text-ink">{t(labelKey)}</span>
              <ChevronRight size={18} className="text-faint" />
            </button>
          ))}
        </div>
      </Sheet>
    </nav>
  );
}
