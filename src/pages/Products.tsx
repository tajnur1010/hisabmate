import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Package, Plus, Tags } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useData } from '@/contexts/DataContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toBengaliDigits } from '@/utils/money';
import { Card, EmptyState, MoneyText, SearchInput, SegmentedControl } from '@/components/ui';
import { ProductRow } from '@/features/products/ProductRow';
import { ProductForm } from '@/features/products/ProductForm';
import { CategorySheet } from '@/features/products/CategorySheet';
import { Qty } from '@/features/products/productView';
import { cn } from '@/utils/cn';

type SortKey = 'name' | 'stock' | 'value';
type StatusFilter = 'all' | 'low' | 'out';

const chip = (on: boolean) =>
  cn(
    'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
    on
      ? 'border-brand bg-brand-soft text-brand-strong'
      : 'border-line bg-elevated text-muted hover:border-line/80',
  );

export default function Products() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { productsWithStock, productCategories, stockAlerts, inventorySummary } = useData();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [adding, setAdding] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = productsWithStock;

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.barcode ?? '').toLowerCase().includes(q),
      );
    }
    if (categoryId !== 'all') {
      list = list.filter((p) =>
        categoryId === 'none' ? !p.categoryId : p.categoryId === categoryId,
      );
    }
    if (status !== 'all') list = list.filter((p) => p.status === status);

    return list.slice().sort((a, b) => {
      if (sort === 'stock') return a.stock - b.stock;
      if (sort === 'value') return b.stockValueAtCost - a.stockValueAtCost;
      return a.name.localeCompare(b.name);
    });
  }, [productsWithStock, query, categoryId, status, sort]);

  const alertCount = inventorySummary.lowStockCount + inventorySummary.outOfStockCount;
  const hasProducts = productsWithStock.length > 0;
  /** Counts follow the same numeral preference as money figures. */
  const num = (n: number) => (settings.showBengaliNumerals ? toBengaliDigits(n) : String(n));

  return (
    <div className="space-y-4 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">{t('product.title')}</h1>
          <p className="text-sm text-muted">
            {num(inventorySummary.productCount)} {t('product.totalProducts')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setManagingCategories(true)}
            aria-label={t('product.categories')}
            title={t('product.categories')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-elevated text-muted transition-transform active:scale-95"
          >
            <Tags size={16} />
          </button>
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

      {hasProducts && (
        <>
          <Card padded={false} className="flex divide-x divide-line">
            <div className="flex-1 p-3.5">
              <p className="text-xs text-muted">
                {t('product.stockValue')} · {t('product.atCost')}
              </p>
              <MoneyText
                amount={inventorySummary.totalStockValueAtCost}
                tone="brand"
                size="md"
                className="mt-0.5 block font-semibold"
              />
            </div>
            <div className="flex-1 p-3.5">
              <p className="text-xs text-muted">{t('product.atRetail')}</p>
              <MoneyText
                amount={inventorySummary.totalStockValueAtRetail}
                tone="gold"
                size="md"
                className="mt-0.5 block font-semibold"
              />
            </div>
          </Card>

          {alertCount > 0 && (
            <Card spine="warning" padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 pb-1 pt-3.5">
                <AlertTriangle size={15} className="text-warning" />
                <h2 className="flex-1 text-sm font-semibold text-ink">{t('product.alerts')}</h2>
                <span className="font-num tabular text-xs font-semibold text-warning">
                  {num(alertCount)}
                </span>
              </div>
              <ul className="divide-y divide-line/70">
                {stockAlerts.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          p.status === 'out' ? 'text-danger' : 'text-warning',
                        )}
                      >
                        {p.status === 'out' ? (
                          t('product.outOfStock')
                        ) : (
                          <Qty value={p.stock} unit={p.unit} />
                        )}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
              {alertCount > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus('all');
                    setCategoryId('all');
                    setSort('stock');
                  }}
                  className="w-full border-t border-line/70 px-4 py-2.5 text-xs font-semibold text-brand-strong"
                >
                  {t('common.viewAll')}
                </button>
              )}
            </Card>
          )}

          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('product.searchProducts')}
          />

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => setStatus('all')} className={chip(status === 'all')}>
              {t('common.all')}
            </button>
            <button type="button" onClick={() => setStatus('low')} className={chip(status === 'low')}>
              {t('product.lowStock')}
            </button>
            <button type="button" onClick={() => setStatus('out')} className={chip(status === 'out')}>
              {t('product.outOfStock')}
            </button>
          </div>

          {productCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCategoryId('all')}
                className={chip(categoryId === 'all')}
              >
                {t('common.all')}
              </button>
              {productCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={chip(categoryId === c.id)}
                >
                  {c.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategoryId('none')}
                className={chip(categoryId === 'none')}
              >
                {t('product.uncategorized')}
              </button>
            </div>
          )}

          <SegmentedControl<SortKey>
            aria-label={t('product.sortName')}
            value={sort}
            onChange={setSort}
            size="sm"
            options={[
              { value: 'name', label: t('product.sortName') },
              { value: 'stock', label: t('product.sortStock') },
              { value: 'value', label: t('product.sortValue') },
            ]}
          />
        </>
      )}

      {!hasProducts ? (
        <EmptyState
          icon={<Package size={26} />}
          title={t('product.noProducts')}
          description={t('product.noProductsDesc')}
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg transition-transform active:scale-95"
            >
              {t('product.add')}
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-faint">{t('search.empty')}</p>
      ) : (
        <div className="space-y-2.5">
          {visible.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </div>
      )}

      <ProductForm open={adding} onClose={() => setAdding(false)} />
      <CategorySheet open={managingCategories} onClose={() => setManagingCategories(false)} />
    </div>
  );
}
