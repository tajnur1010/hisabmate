import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Home, Plus, Truck, Users } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useQuickActions } from '@/features/quick-actions/QuickActions';
import type { TranslationKey } from '@/i18n/en';
import { cn } from '@/utils/cn';

interface Tab {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  end?: boolean;
}

/** Two tabs sit on each side of the central quick-add button. */
const LEFT_TABS: Tab[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home, end: true },
  { to: '/customers', labelKey: 'nav.customers', icon: Users },
];
const RIGHT_TABS: Tab[] = [
  { to: '/suppliers', labelKey: 'nav.suppliers', icon: Truck },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
];

function TabLink({ tab }: { tab: Tab }) {
  const { t } = useI18n();
  const Icon = tab.icon;
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className="group flex flex-1 flex-col items-center justify-center gap-0.5 pt-1"
    >
      {({ isActive }) => (
        <>
          <Icon
            size={22}
            strokeWidth={isActive ? 2.5 : 2}
            className={cn(
              'transition-colors',
              isActive ? 'text-brand-strong' : 'text-faint group-hover:text-muted',
            )}
          />
          <span
            className={cn(
              'text-[10.5px] font-semibold tracking-tight transition-colors',
              isActive ? 'text-brand-strong' : 'text-faint group-hover:text-muted',
            )}
          >
            {t(tab.labelKey)}
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Fixed bottom tab bar with a raised central quick-add (+) button. */
export function BottomNav() {
  const { t } = useI18n();
  const { openMenu } = useQuickActions();

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
        </div>
      </div>

      {/* Central raised FAB */}
      <button
        type="button"
        onClick={openMenu}
        aria-label={t('quick.title')}
        className="absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-brand-fg shadow-fab ring-4 ring-bg transition-transform duration-150 active:scale-90"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </nav>
  );
}
