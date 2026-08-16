import { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import type { Transaction, TransactionType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { EmptyState } from '@/components/ui';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';
import { typeLabelKey } from '@/features/shared/lookups';
import { cn } from '@/utils/cn';

type Filter = 'all' | TransactionType;

const FILTERS: Filter[] = ['all', 'received', 'paid', 'credit_sale', 'refund'];
const PAGE = 25;

/** The full business ledger — every transaction, filterable by type. */
export default function Transactions() {
  const { t } = useI18n();
  const { transactions, getPartyById } = useData();

  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<Transaction | null>(null);

  const live = useMemo(
    () =>
      transactions
        .filter((x) => !x.deletedAt)
        .slice()
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [transactions],
  );

  const filtered = useMemo(
    () => (filter === 'all' ? live : live.filter((x) => x.type === filter)),
    [live, filter],
  );

  const visible = filtered.slice(0, limit);

  return (
    <div className="space-y-4 px-4 py-4">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">{t('txn.allTransactions')}</h1>
        <p className="text-sm text-muted">{filtered.length}</p>
      </header>

      {/* Type filter chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setLimit(PAGE);
              }}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-brand bg-brand text-brand-fg'
                  : 'border-line text-muted hover:text-ink',
              )}
            >
              {f === 'all' ? t('common.all') : t(typeLabelKey(f))}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Receipt size={26} />}
          title={t('txn.noTransactions')}
          description={t('txn.noTransactionsDesc')}
        />
      ) : (
        <>
          <div className="divide-y divide-line/70">
            {visible.map((tx) => (
              <TransactionRow
                key={tx.id}
                txn={tx}
                partyName={tx.partyId ? getPartyById(tx.partyId)?.name : undefined}
                onClick={() => setDetail(tx)}
              />
            ))}
          </div>
          {visible.length < filtered.length && (
            <button
              type="button"
              onClick={() => setLimit(filtered.length)}
              className="w-full rounded-2xl border border-line py-2.5 text-sm font-semibold text-brand-strong transition-colors hover:bg-surface-2"
            >
              {t('common.viewAll')} ({filtered.length - visible.length})
            </button>
          )}
        </>
      )}

      <TransactionDetail
        open={!!detail}
        onClose={() => setDetail(null)}
        txn={detail}
        partyName={detail?.partyId ? getPartyById(detail.partyId)?.name : undefined}
      />
    </div>
  );
}
