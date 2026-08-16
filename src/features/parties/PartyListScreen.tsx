import { useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import type { PartyType } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { usePartyType } from '@/contexts/DataContext';
import { Card, EmptyState, MoneyText, SearchInput, SegmentedControl } from '@/components/ui';
import { PartyRow } from '@/features/parties/PartyRow';
import { PartyForm } from '@/features/parties/PartyForm';

type SortKey = 'recent' | 'balance' | 'name';

/** Shared list screen for both customers and suppliers. */
export function PartyListScreen({ type }: { type: PartyType }) {
  const { t } = useI18n();
  const list = usePartyType(type);
  const isCustomer = type === 'customer';

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    let get = 0;
    let give = 0;
    for (const p of list) {
      const owedToYou = isCustomer ? Math.max(p.balance, 0) : Math.max(-p.balance, 0);
      const youOwe = isCustomer ? Math.max(-p.balance, 0) : Math.max(p.balance, 0);
      get += owedToYou;
      give += youOwe;
    }
    return { get, give };
  }, [list, isCustomer]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.phone ?? '').replace(/\s/g, '').includes(q),
        )
      : list;
    const sorted = filtered.slice().sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'balance') return Math.abs(b.balance) - Math.abs(a.balance);
      return (b.lastTransactionAt ?? '').localeCompare(a.lastTransactionAt ?? '');
    });
    return sorted;
  }, [list, query, sort]);

  return (
    <div className="space-y-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {isCustomer ? t('party.customers') : t('party.suppliers')}
          </h1>
          <p className="text-sm text-muted">{list.length}</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-transform active:scale-95"
        >
          <Plus size={16} />
          {t('common.add')}
        </button>
      </header>

      {list.length > 0 && (
        <>
          <Card padded={false} className="flex divide-x divide-line">
            <div className="flex-1 p-3.5">
              <p className="text-xs text-muted">{t('dashboard.youWillGet')}</p>
              <MoneyText amount={totals.get} tone="gold" size="md" className="mt-0.5 block font-semibold" />
            </div>
            <div className="flex-1 p-3.5">
              <p className="text-xs text-muted">{t('dashboard.youWillGive')}</p>
              <MoneyText amount={totals.give} tone="positive" size="md" className="mt-0.5 block font-semibold" />
            </div>
          </Card>

          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={isCustomer ? t('party.searchCustomers') : t('party.searchSuppliers')}
          />

          <SegmentedControl<SortKey>
            aria-label={t('common.search')}
            value={sort}
            onChange={setSort}
            size="sm"
            options={[
              { value: 'recent', label: t('party.sortRecent') },
              { value: 'balance', label: t('party.sortBalance') },
              { value: 'name', label: t('party.sortName') },
            ]}
          />
        </>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title={isCustomer ? t('party.noCustomers') : t('party.noSuppliers')}
          description={isCustomer ? t('party.noCustomersDesc') : t('party.noSuppliersDesc')}
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg transition-transform active:scale-95"
            >
              {isCustomer ? t('party.addCustomer') : t('party.addSupplier')}
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-faint">{t('search.empty')}</p>
      ) : (
        <div className="space-y-2.5">
          {visible.map((p) => (
            <PartyRow key={p.id} party={p} />
          ))}
        </div>
      )}

      <PartyForm open={adding} onClose={() => setAdding(false)} type={type} />
    </div>
  );
}
