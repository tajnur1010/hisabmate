import { useMemo, useState } from 'react';
import { Download, Plus, Users } from 'lucide-react';
import type { PartyType } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { useData, usePartyType } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, EmptyState, MoneyText, SearchInput, SegmentedControl } from '@/components/ui';
import { PartyRow } from '@/features/parties/PartyRow';
import { PartyForm } from '@/features/parties/PartyForm';
import { partyBalanceView } from '@/features/parties/partyView';
import type { TranslationKey } from '@/i18n/en';
import { formatMoney } from '@/utils/money';
import { formatDateTime } from '@/utils/date';
import { printHtml } from '@/utils/print';
import { cn } from '@/utils/cn';

type SortKey = 'recent' | 'balance' | 'name';
type FilterKey = 'all' | 'receivable' | 'payable' | 'settled';

const FILTERS: { key: FilterKey; labelKey: TranslationKey }[] = [
  { key: 'all', labelKey: 'common.all' },
  { key: 'receivable', labelKey: 'dashboard.youWillGet' },
  { key: 'payable', labelKey: 'dashboard.youWillGive' },
  { key: 'settled', labelKey: 'party.settled' },
];

/** Shared list screen for both customers and suppliers. */
export function PartyListScreen({ type }: { type: PartyType }) {
  const { t, lang } = useI18n();
  const { business } = useData();
  const { settings } = useSettings();
  const list = usePartyType(type);
  const isCustomer = type === 'customer';
  const currency = business?.currency ?? '৳';

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [filter, setFilter] = useState<FilterKey>('all');
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
    let filtered = q
      ? list.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.phone ?? '').replace(/\s/g, '').includes(q),
        )
      : list;
    if (filter !== 'all') {
      filtered = filtered.filter((p) => {
        const v = partyBalanceView(p);
        if (filter === 'settled') return v.settled;
        if (filter === 'receivable') return !v.settled && v.labelKey === 'dashboard.youWillGet';
        return !v.settled && v.labelKey === 'dashboard.youWillGive';
      });
    }
    const sorted = filtered.slice().sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'balance') return Math.abs(b.balance) - Math.abs(a.balance);
      return (b.lastTransactionAt ?? '').localeCompare(a.lastTransactionAt ?? '');
    });
    return sorted;
  }, [list, query, sort, filter]);

  /**
   * Build a printable, self-contained party list for the current view (respects
   * search + filter + sort) and hand it to the browser's print dialog, where the
   * user can "Save as PDF". Every figure is derived from live balances — nothing
   * is faked here.
   */
  function buildListHtml(): string {
    const bn = settings.showBengaliNumerals;
    const money = (n: number) => formatMoney(n, { currency, bengaliNumerals: bn });
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) =>
        c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
      );

    const title = isCustomer ? t('party.customers') : t('party.suppliers');
    const bizName = esc(business?.name || t('app.name'));
    const owner = business?.ownerName ? esc(business.ownerName) : '';

    const getOf = (p: (typeof visible)[number]) => {
      const v = partyBalanceView(p);
      return !v.settled && v.labelKey === 'dashboard.youWillGet' ? v.amount : 0;
    };
    const giveOf = (p: (typeof visible)[number]) => {
      const v = partyBalanceView(p);
      return !v.settled && v.labelKey === 'dashboard.youWillGive' ? v.amount : 0;
    };

    const headRow =
      `<tr class="hd"><td class="num">#</td>` +
      `<td>${esc(t('common.name'))}</td>` +
      `<td>${esc(t('common.phone'))}</td>` +
      `<td class="num">${esc(t('dashboard.youWillGet'))}</td>` +
      `<td class="num">${esc(t('dashboard.youWillGive'))}</td></tr>`;

    const bodyRows = visible
      .map((p, i) => {
        const get = getOf(p);
        const give = giveOf(p);
        return (
          `<tr><td class="num">${i + 1}</td>` +
          `<td>${esc(p.name)}</td>` +
          `<td>${esc(p.phone ?? '')}</td>` +
          `<td class="num">${get ? esc(money(get)) : '—'}</td>` +
          `<td class="num">${give ? esc(money(give)) : '—'}</td></tr>`
        );
      })
      .join('');

    const totalGet = visible.reduce((s, p) => s + getOf(p), 0);
    const totalGive = visible.reduce((s, p) => s + giveOf(p), 0);
    const totalRow =
      `<tr class="total"><td></td><td>${esc(t('common.total'))}</td><td></td>` +
      `<td class="num">${esc(money(totalGet))}</td>` +
      `<td class="num">${esc(money(totalGive))}</td></tr>`;

    const emptyRow = `<tr><td colspan="5" class="empty">${esc(t('search.empty'))}</td></tr>`;

    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${bizName} — ${esc(title)}</title>
<style>
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{font-family:-apple-system,"Segoe UI","Noto Sans Bengali",Roboto,system-ui,sans-serif;color:#0f172a;font-size:13px;line-height:1.5;padding:28px 30px;}
  .head{border-bottom:2px solid #0f766e;padding-bottom:14px;}
  .brand{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#0f766e;font-weight:700;}
  h1{font-size:22px;margin:4px 0 2px;}
  .owner{color:#475569;font-size:13px;}
  .meta{margin:12px 0 4px;display:flex;gap:22px;flex-wrap:wrap;font-size:12px;color:#475569;}
  .meta b{color:#0f172a;font-weight:600;}
  table{width:100%;border-collapse:collapse;margin-top:12px;}
  td{padding:8px 2px;border-bottom:1px solid #e5e7eb;}
  td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:16px;}
  tr.hd td{font-weight:600;color:#64748b;border-bottom:1.5px solid #cbd5e1;}
  tr.total td{border-top:2px solid #cbd5e1;font-weight:700;}
  td.empty{text-align:center;color:#94a3b8;padding:16px 2px;}
  .foot{margin-top:26px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;}
  @page{margin:16mm;}
  @media print{body{padding:0;}}
</style>
</head>
<body>
  <div class="head">
    <div class="brand">HisabMate</div>
    <h1>${bizName}</h1>
    ${owner ? `<div class="owner">${owner}</div>` : ''}
  </div>
  <div class="meta">
    <span><b>${esc(title)}</b></span>
    <span>${esc(t('common.total'))}: <b>${visible.length}</b></span>
  </div>
  <table>
    ${headRow}
    ${bodyRows || emptyRow}
    ${visible.length ? totalRow : ''}
  </table>
  <div class="foot">
    <span>${esc(t('reports.generatedOn'))}: ${esc(formatDateTime(new Date(), lang))}</span>
    <span>HisabMate</span>
  </div>
</body>
</html>`;
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">
            {isCustomer ? t('party.customers') : t('party.suppliers')}
          </h1>
          <p className="text-sm text-muted">{list.length}</p>
        </div>
        <div className="flex items-center gap-2">
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => printHtml(buildListHtml())}
              aria-label={t('common.download')}
              title={t('common.download')}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-elevated text-muted transition-transform active:scale-95"
            >
              <Download size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-transform active:scale-95"
          >
            <Plus size={16} />
            {t('common.add')}
          </button>
        </div>
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

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    on
                      ? 'border-brand bg-brand-soft text-brand-strong'
                      : 'border-line bg-elevated text-muted hover:border-line/80',
                  )}
                >
                  {t(f.labelKey)}
                </button>
              );
            })}
          </div>

          <SegmentedControl<SortKey>
            aria-label={t('party.sortRecent')}
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
