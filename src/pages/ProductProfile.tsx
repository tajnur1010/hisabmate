import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  PackageX,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { StockMovementType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { computeProductProfit } from '@/services/inventory';
import { formatDate } from '@/utils/date';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  MoneyText,
} from '@/components/ui';
import { ProductForm } from '@/features/products/ProductForm';
import { StockAdjustSheet } from '@/features/products/StockAdjustSheet';
import { Qty, reasonLabelKey, stockStatusView, unitLabelKey } from '@/features/products/productView';

/**
 * Product profile: derived stock on hand, realised profit, and the full stock
 * history that explains the current quantity.
 */
export default function ProductProfile() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    getProductById,
    productCategories,
    productMovements,
    productStockLedger,
    deleteProduct,
  } = useData();

  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState<StockMovementType | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const product = id ? getProductById(id) : undefined;

  // History is oldest → newest; the newest movement is the most useful on top.
  const history = useMemo(
    () => (id ? productStockLedger(id).slice().reverse() : []),
    [id, productStockLedger],
  );

  const profit = useMemo(() => {
    if (!product) return null;
    return computeProductProfit([product], productMovements(product.id))[0] ?? null;
  }, [product, productMovements]);

  if (!product) {
    return (
      <div className="grid min-h-full place-items-center px-6 py-16">
        <EmptyState
          icon={<PackageX size={26} />}
          title={t('product.notFound')}
          description={t('error.notFoundDesc')}
          action={<Button onClick={() => navigate('/products')}>{t('product.title')}</Button>}
        />
      </div>
    );
  }

  const status = stockStatusView(product.status);
  const category = productCategories.find((c) => c.id === product.categoryId);

  async function onDelete() {
    if (!product) return;
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      toast.success(t('product.archived'));
      navigate('/products', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setDeleting(false);
    }
  }

  const detailRows: { label: string; value: ReactNode }[] = [
    {
      label: t('product.purchasePrice'),
      value: <MoneyText amount={product.purchasePrice} tone="ink" className="font-semibold" />,
    },
    {
      label: t('product.sellingPrice'),
      value: <MoneyText amount={product.sellingPrice} tone="gold" className="font-semibold" />,
    },
    {
      label: t('product.stockValue'),
      value: <MoneyText amount={product.stockValueAtCost} tone="brand" className="font-semibold" />,
    },
    {
      label: t('product.unit'),
      value: <span className="font-medium text-ink">{t(unitLabelKey(product.unit))}</span>,
    },
  ];
  if (category) {
    detailRows.push({
      label: t('product.category'),
      value: <span className="font-medium text-ink">{category.name}</span>,
    });
  }
  if (product.sku) {
    detailRows.push({
      label: t('product.sku'),
      value: <span className="font-num text-right font-medium text-ink">{product.sku}</span>,
    });
  }
  if (product.barcode) {
    detailRows.push({
      label: t('product.barcode'),
      value: <span className="font-num text-right font-medium text-ink">{product.barcode}</span>,
    });
  }
  if (product.lowStockThreshold > 0) {
    detailRows.push({
      label: t('product.lowStockThreshold'),
      value: (
        <span className="font-medium text-ink">
          <Qty value={product.lowStockThreshold} unit={product.unit} />
        </span>
      ),
    });
  }
  if (product.notes) {
    detailRows.push({
      label: t('common.notes'),
      value: <span className="text-right font-medium text-ink">{product.notes}</span>,
    });
  }

  return (
    <div className="pb-10">
      {/* Slim action bar — the page's only header, since AppLayout hides the
          global TopBar on detail routes. The product name lives in the card
          below so two name-bearing headers never stack. */}
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-line/70 bg-surface/95 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <IconButton size="sm" label={t('common.back')} onClick={() => navigate('/products')}>
          <ArrowLeft size={20} />
        </IconButton>
        <span className="flex-1" />
        <IconButton size="sm" label={t('common.edit')} onClick={() => setEditing(true)}>
          <Pencil size={18} />
        </IconButton>
        <IconButton size="sm" label={t('common.delete')} onClick={() => setConfirming(true)}>
          <Trash2 size={18} />
        </IconButton>
      </div>

      <div className="space-y-4 px-4 pb-4 pt-6">
        {/* Identity + live stock on hand */}
        <Card elevated spine="brand" className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="space-y-0.5">
            <p className="font-display text-lg font-semibold leading-tight text-ink">
              {product.name}
            </p>
            <p className="text-xs text-faint">{category?.name ?? t('product.uncategorized')}</p>
          </div>
          <p className="mt-1 text-sm text-muted">{t('product.stock')}</p>
          <Qty
            value={product.stock}
            unit={product.unit}
            className={
              product.status === 'out'
                ? 'text-balance leading-none text-danger'
                : product.status === 'low'
                  ? 'text-balance leading-none text-warning'
                  : 'text-balance leading-none text-ink'
            }
          />
          {product.status !== 'ok' && <Badge tone={status.tone}>{t(status.labelKey)}</Badge>}
        </Card>

        {/* Stock in / out */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            leftIcon={<ArrowDownLeft size={18} />}
            onClick={() => setAdjusting('in')}
          >
            {t('product.stockIn')}
          </Button>
          <Button
            size="lg"
            variant="soft"
            leftIcon={<ArrowUpRight size={18} />}
            onClick={() => setAdjusting('out')}
          >
            {t('product.stockOut')}
          </Button>
        </div>

        {/* Realised profit — only meaningful once something has been sold. */}
        {profit && profit.quantitySold !== 0 && (
          <Card spine="positive">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{t('product.profitTitle')}</h2>
              <MoneyText
                amount={profit.profit}
                tone={profit.profit >= 0 ? 'positive' : 'danger'}
                size="md"
                className="font-semibold"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-muted">{t('product.sold')}</p>
                <Qty
                  value={profit.quantitySold}
                  unit={product.unit}
                  className="mt-0.5 block text-sm font-semibold text-ink"
                />
              </div>
              <div>
                <p className="text-[11px] text-muted">{t('product.revenue')}</p>
                <MoneyText
                  amount={profit.revenue}
                  tone="ink"
                  className="mt-0.5 block text-sm font-semibold"
                />
              </div>
              <div>
                <p className="text-[11px] text-muted">{t('product.cost')}</p>
                <MoneyText
                  amount={profit.cost}
                  tone="muted"
                  className="mt-0.5 block text-sm font-semibold"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Static details */}
        <Card padded={false} className="divide-y divide-line">
          {detailRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="shrink-0 text-muted">{row.label}</span>
              {row.value}
            </div>
          ))}
        </Card>

        {/* Stock history — newest first, with the running quantity that proves
            the current stock figure. */}
        <section>
          <h2 className="mb-1 px-1 text-sm font-semibold text-muted">{t('product.stockHistory')}</h2>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-faint">{t('product.noStockHistory')}</p>
          ) : (
            <div className="divide-y divide-line/70">
              {history.map((row) => (
                <div key={row.movement.id} className="flex items-center gap-3 py-3">
                  <span
                    className={
                      row.delta >= 0
                        ? 'grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-positive-soft text-positive'
                        : 'grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-danger-soft text-danger'
                    }
                  >
                    {row.delta >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {t(reasonLabelKey(row.movement.reason))}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-faint">
                      {formatDate(row.movement.occurredAt, lang)}
                      {row.movement.note ? ` · ${row.movement.note}` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <Qty
                      value={row.delta}
                      unit={product.unit}
                      signed
                      className={
                        row.delta >= 0
                          ? 'text-[15px] font-semibold text-positive'
                          : 'text-[15px] font-semibold text-danger'
                      }
                    />
                    <Qty
                      value={row.runningStock}
                      unit={product.unit}
                      className="text-[11px] text-faint"
                    />
                  </div>
                </div>
              ))}
              {/* The opening figure closes the chain, so the oldest running total
                  is always explainable. */}
              <div className="flex items-center justify-between py-3 text-sm">
                <span className="text-muted">{t('product.openingRow')}</span>
                <Qty
                  value={product.openingStock}
                  unit={product.unit}
                  className="font-semibold text-ink"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      <ProductForm open={editing} onClose={() => setEditing(false)} product={product} />
      {adjusting && (
        <StockAdjustSheet
          open={!!adjusting}
          onClose={() => setAdjusting(null)}
          product={product}
          defaultType={adjusting}
        />
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onDelete}
        loading={deleting}
        title={t('confirm.deleteTitle')}
        description={t('product.deleteConfirm')}
        confirmLabel={t('common.delete')}
        icon={<Trash2 size={20} />}
      />
    </div>
  );
}
