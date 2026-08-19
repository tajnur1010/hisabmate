import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { ExpenseCategory, ProductUnit } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button, Card, MoneyText, SegmentedControl } from '@/components/ui';
import {
  buildCashFlow,
  buildPeriodReport,
  expensesByCategory,
  monthRange,
  summarizeDashboard,
  todayRange,
  weekRange,
} from '@/services/ledger';
import { totalProductProfit } from '@/services/inventory';
import { categoryLabelKey } from '@/features/shared/lookups';
import { Qty, trimQuantity, unitLabelKey } from '@/features/products/productView';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatMoney, toBengaliDigits } from '@/utils/money';
import { printHtml } from '@/utils/print';

type RangeKey = 'daily' | 'weekly' | 'monthly';

/** A long product list would bury the rest of the page, so the on-screen
 *  profit card shows the best performers and the printed report shows all. */
const PROFIT_ROWS_ON_SCREEN = 6;

/**
 * Period reports: headline metrics, product-wise profit, cash-flow trend and
 * expense mix — plus a printable/PDF export of the same figures.
 */
export default function Reports() {
  const { t, lang } = useI18n();
  const { business, partiesWithBalance, transactions, expenses, productProfit } = useData();
  const { settings } = useSettings();
  const [rangeKey, setRangeKey] = useState<RangeKey>('daily');

  const summary = useMemo(
    () => summarizeDashboard(partiesWithBalance, transactions, expenses),
    [partiesWithBalance, transactions, expenses],
  );

  const range = useMemo(
    () => (rangeKey === 'daily' ? todayRange() : rangeKey === 'weekly' ? weekRange() : monthRange()),
    [rangeKey],
  );

  const report = useMemo(
    () => buildPeriodReport(range, transactions, expenses, summary.totalReceivable, summary.totalPayable),
    [range, transactions, expenses, summary],
  );

  const cashFlow = useMemo(() => buildCashFlow(transactions, expenses, 6), [transactions, expenses]);
  const byCat = useMemo(() => expensesByCategory(expenses, range), [expenses, range]);

  // Product-wise sales & profit for the same period. Only products that were
  // actually sold appear, so shops that don't track inventory see nothing.
  const profitRows = useMemo(() => productProfit(range), [productProfit, range]);
  const profitTotals = useMemo(() => totalProductProfit(profitRows), [profitRows]);

  const maxFlow = Math.max(1, ...cashFlow.map((p) => Math.max(p.inflow, p.outflow)));
  const catTotal = byCat.reduce((s, c) => s + c.total, 0);

  /** Counts follow the same numeral preference as money figures. */
  const num = (n: number) => (settings.showBengaliNumerals ? toBengaliDigits(n) : String(n));

  const currency = business?.currency ?? '৳';
  const rangeLabel =
    rangeKey === 'daily'
      ? t('reports.daily')
      : rangeKey === 'weekly'
        ? t('reports.weekly')
        : t('reports.monthly');

  /**
   * Build a self-contained, printable HTML document for the current period and
   * hand it to the browser's print dialog, where the user can choose
   * "Save as PDF". Every figure comes from the same derived data shown on
   * screen — nothing is re-computed or faked here.
   */
  function buildReportHtml(): string {
    const bn = settings.showBengaliNumerals;
    const money = (n: number) => formatMoney(n, { currency, bengaliNumerals: bn });
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) =>
        c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
      );

    const periodDates =
      formatDate(range.from, lang) +
      (range.from !== range.to ? ` – ${formatDate(range.to, lang)}` : '');
    const bizName = esc(business?.name || t('app.name'));
    const owner = business?.ownerName ? esc(business.ownerName) : '';

    const row = (label: string, val: number) =>
      `<tr><td>${esc(label)}</td><td class="num">${esc(money(val))}</td></tr>`;

    const metricTable = [
      row(t('reports.collection'), report.collection),
      row(t('reports.sales'), report.sales),
      row(t('reports.expense'), report.expense),
      row(t('reports.estimatedProfit'), report.estimatedProfit),
    ].join('');

    const outstandingTable = [
      row(t('reports.outstandingReceivable'), report.outstandingReceivable),
      row(t('reports.outstandingPayable'), report.outstandingPayable),
    ].join('');

    const flowTable =
      `<tr class="hd"><td>${esc(t('reports.cashFlow'))}</td>` +
      `<td class="num">${esc(t('dashboard.inflow'))}</td>` +
      `<td class="num">${esc(t('dashboard.outflow'))}</td>` +
      `<td class="num">${esc(t('dashboard.net'))}</td></tr>` +
      cashFlow
        .map(
          (p) =>
            `<tr><td>${esc(p.label)}</td>` +
            `<td class="num">${esc(money(p.inflow))}</td>` +
            `<td class="num">${esc(money(p.outflow))}</td>` +
            `<td class="num">${esc(money(p.net))}</td></tr>`,
        )
        .join('');

    /** Quantity with its unit, honouring the Bengali-numeral preference. */
    const qty = (value: number, unit: ProductUnit) => {
      const digits = trimQuantity(Math.abs(value));
      const sign = value < 0 ? '−' : '';
      return `${sign}${bn ? toBengaliDigits(digits) : digits} ${t(unitLabelKey(unit))}`;
    };

    // The printed report lists every sold product, not just the top few.
    const profitTable = profitRows.length
      ? `<tr class="hd"><td>${esc(t('product.title'))}</td>` +
        `<td class="num">${esc(t('product.sold'))}</td>` +
        `<td class="num">${esc(t('product.revenue'))}</td>` +
        `<td class="num">${esc(t('product.profit'))}</td></tr>` +
        profitRows
          .map(
            (r) =>
              `<tr><td>${esc(r.name)}</td>` +
              `<td class="num">${esc(qty(r.quantitySold, r.unit))}</td>` +
              `<td class="num">${esc(money(r.revenue))}</td>` +
              `<td class="num">${esc(money(r.profit))}</td></tr>`,
          )
          .join('') +
        `<tr class="total"><td>${esc(t('product.profit'))}</td><td class="num"></td>` +
        `<td class="num">${esc(money(profitTotals.revenue))}</td>` +
        `<td class="num">${esc(money(profitTotals.profit))}</td></tr>`
      : '';

    const catRows = byCat.length
      ? byCat
          .map(({ category, total }) => row(t(categoryLabelKey(category as ExpenseCategory)), total))
          .join('') +
        `<tr class="total"><td>${esc(t('reports.expense'))}</td><td class="num">${esc(money(catTotal))}</td></tr>`
      : `<tr><td colspan="2" class="empty">${esc(t('reports.noData'))}</td></tr>`;

    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${bizName} — ${esc(t('reports.documentTitle'))}</title>
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
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:#64748b;margin:22px 0 6px;}
  table{width:100%;border-collapse:collapse;}
  td{padding:8px 2px;border-bottom:1px solid #e5e7eb;}
  td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:16px;}
  tr.hd td{font-weight:600;color:#64748b;border-bottom:1.5px solid #cbd5e1;}
  tr.total td{border-top:2px solid #cbd5e1;border-bottom:none;font-weight:700;}
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
    <span><b>${esc(t('reports.documentTitle'))}</b></span>
    <span>${esc(t('reports.period'))}: <b>${esc(rangeLabel)}</b></span>
    <span>${esc(periodDates)}</span>
  </div>

  <h2>${esc(t('reports.summary'))}</h2>
  <table>${metricTable}</table>
${
  profitTable
    ? `\n  <h2>${esc(t('product.profitTitle'))}</h2>\n  <table>${profitTable}</table>\n`
    : ''
}
  <h2>${esc(t('reports.outstandingReceivable'))} · ${esc(t('reports.outstandingPayable'))}</h2>
  <table>${outstandingTable}</table>

  <h2>${esc(t('reports.cashFlow'))}</h2>
  <table>${flowTable}</table>

  <h2>${esc(t('reports.byCategory'))}</h2>
  <table>${catRows}</table>

  <div class="foot">
    <span>${esc(t('reports.generatedOn'))}: ${esc(formatDateTime(new Date(), lang))}</span>
    <span>HisabMate</span>
  </div>
</body>
</html>`;
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">{t('reports.title')}</h1>
          <p className="text-sm text-muted">
            {formatDate(range.from, lang)}
            {range.from !== range.to ? ` – ${formatDate(range.to, lang)}` : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Download size={16} />}
          onClick={() => printHtml(buildReportHtml())}
          className="shrink-0"
        >
          {t('reports.download')}
        </Button>
      </header>

      <SegmentedControl<RangeKey>
        aria-label={t('reports.title')}
        value={rangeKey}
        onChange={setRangeKey}
        options={[
          { value: 'daily', label: t('reports.daily') },
          { value: 'weekly', label: t('reports.weekly') },
          { value: 'monthly', label: t('reports.monthly') },
        ]}
      />

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Metric label={t('reports.collection')} amount={report.collection} tone="positive" />
        <Metric label={t('reports.sales')} amount={report.sales} tone="gold" />
        <Metric label={t('reports.expense')} amount={report.expense} tone="danger" />
        <Metric
          label={t('reports.estimatedProfit')}
          amount={report.estimatedProfit}
          tone={report.estimatedProfit >= 0 ? 'positive' : 'danger'}
          hint={t('reports.profitHint')}
        />
      </div>

      {/* Product-wise sales & profit for the selected period. Rendered only
          when something was actually sold from stock, so ledger-only shops
          never see an empty section. */}
      {profitRows.length > 0 && (
        <Card className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted">{t('product.profitTitle')}</h2>
            <MoneyText
              amount={profitTotals.profit}
              tone={profitTotals.profit >= 0 ? 'positive' : 'danger'}
              size="md"
              className="font-semibold"
            />
          </div>
          <ul className="divide-y divide-line/70">
            {profitRows.slice(0, PROFIT_ROWS_ON_SCREEN).map((r) => (
              <li key={r.productId} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{r.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-faint">
                    <span>{t('product.sold')}</span>
                    <Qty value={r.quantitySold} unit={r.unit} />
                    <span aria-hidden>·</span>
                    <MoneyText amount={r.revenue} className="text-faint" />
                  </p>
                </div>
                <MoneyText
                  amount={r.profit}
                  tone={r.profit >= 0 ? 'positive' : 'danger'}
                  className="shrink-0 font-semibold"
                />
              </li>
            ))}
          </ul>
          {profitRows.length > PROFIT_ROWS_ON_SCREEN && (
            <p className="pt-1 text-[11px] text-faint">
              +{num(profitRows.length - PROFIT_ROWS_ON_SCREEN)}{' '}
              {t('product.totalProducts').toLowerCase()}
            </p>
          )}
          <p className="pt-1 text-[11px] leading-tight text-faint">{t('product.profitHint')}</p>
        </Card>
      )}

      {/* Outstanding balances (live, not period-bound) */}
      <Card padded={false} className="flex divide-x divide-line">
        <div className="flex-1 p-3.5">
          <p className="text-xs text-muted">{t('reports.outstandingReceivable')}</p>
          <MoneyText
            amount={report.outstandingReceivable}
            tone="gold"
            size="md"
            className="mt-0.5 block font-semibold"
          />
        </div>
        <div className="flex-1 p-3.5">
          <p className="text-xs text-muted">{t('reports.outstandingPayable')}</p>
          <MoneyText
            amount={report.outstandingPayable}
            tone="danger"
            size="md"
            className="mt-0.5 block font-semibold"
          />
        </div>
      </Card>

      {/* Cash flow (last 6 months) */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">{t('reports.cashFlow')}</h2>
          <div className="flex items-center gap-3 text-[11px] text-faint">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-positive" />
              {t('dashboard.inflow')}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-danger" />
              {t('dashboard.outflow')}
            </span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2">
          {cashFlow.map((p) => (
            <div key={p.monthKey} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div
                  className="w-2.5 rounded-t bg-positive transition-all"
                  style={{ height: `${Math.max((p.inflow / maxFlow) * 100, p.inflow > 0 ? 3 : 0)}%` }}
                />
                <div
                  className="w-2.5 rounded-t bg-danger transition-all"
                  style={{ height: `${Math.max((p.outflow / maxFlow) * 100, p.outflow > 0 ? 3 : 0)}%` }}
                />
              </div>
              <span className="text-[10px] text-faint">{p.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Expense mix for the selected period */}
      {byCat.length > 0 ? (
        <Card className="space-y-2.5">
          <h2 className="text-sm font-semibold text-muted">{t('reports.byCategory')}</h2>
          {byCat.map(({ category, total }) => {
            const pct = catTotal > 0 ? (total / catTotal) * 100 : 0;
            return (
              <div key={category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink">{t(categoryLabelKey(category as ExpenseCategory))}</span>
                  <MoneyText amount={total} className="text-muted" />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <p className="py-6 text-center text-sm text-faint">{t('reports.noData')}</p>
      )}
    </div>
  );
}

function Metric({
  label,
  amount,
  tone,
  hint,
}: {
  label: string;
  amount: number;
  tone: 'positive' | 'danger' | 'gold' | 'ink';
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <MoneyText amount={amount} tone={tone} size="lg" className="mt-1 block" />
      {hint && <p className="mt-0.5 text-[11px] leading-tight text-faint">{hint}</p>}
    </Card>
  );
}
