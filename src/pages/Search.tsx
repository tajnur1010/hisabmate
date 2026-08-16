import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PartyWithBalance, Transaction } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { SearchInput } from '@/components/ui';
import { PartyRow } from '@/features/parties/PartyRow';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';

/** Unified search across customers, suppliers and transactions. */
export default function Search() {
  const { t } = useI18n();
  const { partiesWithBalance, transactions, getPartyById } = useData();
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Transaction | null>(null);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return { customers: [], suppliers: [], txns: [] as Transaction[] };

    const matchParty = (p: PartyWithBalance) =>
      p.name.toLowerCase().includes(q) || (p.phone ?? '').replace(/\s/g, '').includes(q);

    const customers = partiesWithBalance.filter((p) => p.type === 'customer' && matchParty(p));
    const suppliers = partiesWithBalance.filter((p) => p.type === 'supplier' && matchParty(p));

    const txns = transactions
      .filter((x) => {
        if (x.deletedAt) return false;
        const partyName = x.partyId ? (getPartyById(x.partyId)?.name ?? '') : '';
        return (
          (x.note ?? '').toLowerCase().includes(q) ||
          String(x.amount).includes(q) ||
          partyName.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 25);

    return { customers, suppliers, txns };
  }, [q, partiesWithBalance, transactions, getPartyById]);

  const hasQuery = q.length > 0;
  const empty =
    hasQuery &&
    results.customers.length === 0 &&
    results.suppliers.length === 0 &&
    results.txns.length === 0;

  return (
    <div className="space-y-4 px-4 py-4">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">{t('search.title')}</h1>
      </header>

      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('search.placeholder')}
        autoFocus
      />

      {!hasQuery ? (
        <p className="py-16 text-center text-sm text-faint">{t('search.hint')}</p>
      ) : empty ? (
        <p className="py-16 text-center text-sm text-faint">{t('search.empty')}</p>
      ) : (
        <div className="space-y-6">
          {results.customers.length > 0 && (
            <Group title={t('search.customers')}>
              <div className="space-y-2.5">
                {results.customers.map((p) => (
                  <PartyRow key={p.id} party={p} />
                ))}
              </div>
            </Group>
          )}

          {results.suppliers.length > 0 && (
            <Group title={t('search.suppliers')}>
              <div className="space-y-2.5">
                {results.suppliers.map((p) => (
                  <PartyRow key={p.id} party={p} />
                ))}
              </div>
            </Group>
          )}

          {results.txns.length > 0 && (
            <Group title={t('search.transactions')}>
              <div className="divide-y divide-line/70">
                {results.txns.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    txn={tx}
                    partyName={tx.partyId ? getPartyById(tx.partyId)?.name : undefined}
                    onClick={() => setDetail(tx)}
                  />
                ))}
              </div>
            </Group>
          )}
        </div>
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-faint">{title}</h2>
      {children}
    </section>
  );
}
