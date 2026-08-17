import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useQuickActions } from '@/features/quick-actions/QuickActions';
import { summarizeDashboard } from '@/services/ledger';
import { Card, EmptyState, MoneyText } from '@/components/ui';
import { PartyRow } from '@/features/parties/PartyRow';
import { partyBalanceView } from '@/features/parties/partyView';
import { TYPE_ICON, TYPE_TONE_CLASS, CATEGORY_ICON } from '@/features/shared/lookups';
import { cn } from '@/utils/cn';

function greetingKey(hour: number) {
  if (hour < 12) return 'dashboard.greetingMorning' as const;
  if (hour < 17) return 'dashboard.greetingAfternoon' as const;
  return 'dashboard.greetingEvening' as const;
}

export default function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { business, partiesWithBalance, transactions, expenses, parties } = useData();
  const { openTransaction, openExpense } = useQuickActions();

  const summary = useMemo(
    () => summarizeDashboard(partiesWithBalance, transactions, expenses),
    [partiesWithBalance, transactions, expenses],
  );

  // Home lists people (customers & suppliers), most recently active first.
  // Only parties with an OUTSTANDING balance are shown — once an account is
  // fully settled (balance ~ 0) the name drops off home automatically. Settled
  // parties stay reachable from the Customers/Suppliers tabs.
  // Transactions are not shown here — they live inside each party's profile.
  const activeParties = useMemo(
    () =>
      partiesWithBalance
        .filter((p) => !partyBalanceView(p).settled)
        .sort((a, b) => (b.lastTransactionAt ?? '').localeCompare(a.lastTransactionAt ?? '')),
    [partiesWithBalance],
  );

  const greeting = t(greetingKey(new Date().getHours()));

  return (
    <div className="space-y-5 px-4 py-4">
      <header>
        <p className="text-sm text-muted">{greeting}</p>
        <h1 className="font-display text-base font-semibold text-ink">
          {business?.ownerName || business?.name || t('app.name')}
        </h1>
      </header>

      {/* Hero: total receivable */}
      <Card elevated spine="brand" padded={false} className="p-5">
        <p className="text-sm font-medium text-muted">{t('dashboard.totalReceivable')}</p>
        <MoneyText amount={summary.totalReceivable} tone="gold" size="balance" className="mt-1 block" />
        <p className="mt-1 text-xs text-faint">{t('dashboard.youWillGet')}</p>
      </Card>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('dashboard.totalPayable')} amount={summary.totalPayable} tone="danger" />
        <button type="button" onClick={() => navigate('/customers')} className="text-left">
          <Card
            className={cn('h-full p-4', summary.overdueCount > 0 && 'border-danger/30')}
            interactive
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              {summary.overdueCount > 0 && <AlertTriangle size={13} className="text-danger" />}
              {t('dashboard.overdue')}
            </p>
            <MoneyText
              amount={summary.overdueAmount}
              tone={summary.overdueCount > 0 ? 'danger' : 'muted'}
              size="lg"
              className="mt-1 block"
            />
            <p className="mt-0.5 text-xs text-faint">
              {summary.overdueCount} {t('dashboard.overdueCustomers').toLowerCase()}
            </p>
          </Card>
        </button>
        <Stat label={t('dashboard.todayCollection')} amount={summary.todayCollection} tone="positive" />
        <Stat label={t('dashboard.todayExpense')} amount={summary.todayExpense} tone="ink" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickTile
          label={t('quick.moneyReceived')}
          type="received"
          onClick={() => openTransaction({ type: 'received', partyType: 'customer' })}
        />
        <QuickTile
          label={t('quick.creditSale')}
          type="credit_sale"
          onClick={() => openTransaction({ type: 'credit_sale', partyType: 'customer' })}
        />
        <QuickTile label={t('quick.expense')} expense onClick={openExpense} />
      </div>

      {/* People: customers & suppliers by name. Tap a name for full details + ledger. */}
      {parties.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<ArrowRight size={26} />}
          title={t('onboarding.welcome')}
          description={t('party.noCustomersDesc')}
          action={
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg transition-transform active:scale-95"
            >
              {t('party.addCustomer')}
            </button>
          }
        />
      ) : (
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">{t('dashboard.parties')}</h2>
            {activeParties.length > 0 && (
              <span className="text-xs font-medium text-faint">{activeParties.length}</span>
            )}
          </div>
          {activeParties.length > 0 ? (
            <div className="space-y-2.5">
              {activeParties.map((p) => (
                <PartyRow key={p.id} party={p} />
              ))}
            </div>
          ) : (
            <Card className="py-6 text-center">
              <p className="text-sm font-medium text-ink">{t('dashboard.allSettled')}</p>
              <p className="mt-1 text-xs text-muted">{t('dashboard.allSettledDesc')}</p>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: 'danger' | 'positive' | 'ink' | 'muted';
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <MoneyText amount={amount} tone={tone} size="lg" className="mt-1 block" />
    </Card>
  );
}

function QuickTile({
  label,
  type,
  expense,
  onClick,
}: {
  label: string;
  type?: 'received' | 'credit_sale';
  expense?: boolean;
  onClick: () => void;
}) {
  const Icon = expense ? CATEGORY_ICON.other : TYPE_ICON[type ?? 'received'];
  const tone = expense ? null : TYPE_TONE_CLASS[type ?? 'received'];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-elevated py-3 text-center transition-transform active:scale-95"
    >
      <span
        className={cn(
          'grid h-7 w-7 place-items-center rounded-xl',
          tone ? cn(tone.soft, tone.text) : 'bg-brand-soft text-brand-strong',
        )}
      >
        <Icon size={14} />
      </span>
      <span className="text-[11px] font-medium leading-tight text-ink">{label}</span>
    </button>
  );
}
