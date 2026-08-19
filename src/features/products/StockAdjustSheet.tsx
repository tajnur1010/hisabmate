import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { ProductWithStock, StockMovementReason, StockMovementType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { useSync } from '@/contexts/SyncContext';
import { stockDelta } from '@/services/inventory';
import { parseAmount } from '@/utils/money';
import { toDateInputValue } from '@/utils/date';
import { uuid } from '@/utils/id';
import { Button, Input, Sheet, Textarea } from '@/components/ui';
import { ChipSelect } from '@/features/shared/ChipSelect';
import { Qty, reasonLabelKey, reasonsFor, unitLabelKey } from './productView';

interface StockAdjustSheetProps {
  open: boolean;
  onClose: () => void;
  product: ProductWithStock;
  /** Which direction the sheet opens on. */
  defaultType?: StockMovementType;
}

const todayStr = () => toDateInputValue(new Date());

/** Default reason per direction: the most common everyday case. */
const DEFAULT_REASON: Record<StockMovementType, StockMovementReason> = {
  in: 'purchase',
  out: 'sale',
};

/**
 * Records one stock movement. Stock itself is never edited directly — a physical
 * count correction is written as an 'adjust' movement, so the product's history
 * always explains its current quantity.
 */
export function StockAdjustSheet({ open, onClose, product, defaultType = 'in' }: StockAdjustSheetProps) {
  const { t } = useI18n();
  const { createStockMovement } = useData();
  const { online } = useSync();
  const toast = useToast();

  const [type, setType] = useState<StockMovementType>(defaultType);
  const [reason, setReason] = useState<StockMovementReason>(DEFAULT_REASON[defaultType]);
  const [quantityText, setQuantityText] = useState('');
  const [priceText, setPriceText] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setReason(DEFAULT_REASON[defaultType]);
    setQuantityText('');
    setPriceText('');
    setNote('');
    setDate(todayStr());
    setQuantityError(null);
    setSubmitting(false);
    const id = window.setTimeout(() => qtyRef.current?.focus(), 180);
    return () => window.clearTimeout(id);
  }, [open, defaultType]);

  const quantity = parseAmount(quantityText);

  const nextStock = useMemo(() => {
    if (quantity == null) return null;
    return product.stock + stockDelta(type, quantity);
  }, [product.stock, type, quantity]);

  /**
   * A sale needs a selling-price snapshot and a purchase needs a cost snapshot,
   * otherwise product profit would silently follow today's price list forever.
   * Both default to the product's own price, so the common case is one tap.
   */
  const priceField = reason === 'sale' ? 'price' : reason === 'purchase' ? 'cost' : null;

  function switchType(next: StockMovementType) {
    setType(next);
    // Keep 'adjust' when the user is correcting a count in either direction.
    setReason((current) =>
      reasonsFor(next).includes(current) ? current : DEFAULT_REASON[next],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (quantity == null || !(quantity > 0)) {
      setQuantityError(t('validation.amountPositive'));
      return;
    }

    setSubmitting(true);
    try {
      const occurredAt =
        date === todayStr() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
      const snapshot = priceText.trim() ? parseAmount(priceText) : null;
      await createStockMovement({
        productId: product.id,
        type,
        reason,
        quantity,
        unitPrice:
          priceField === 'price' ? (snapshot ?? product.sellingPrice) : null,
        unitCost:
          priceField === 'cost' ? (snapshot ?? product.purchasePrice) : null,
        note: note.trim() || null,
        refType: 'manual',
        occurredAt,
        clientId: uuid(),
      });
      toast.success(online ? t('product.stockSaved') : t('sync.offline'));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('product.adjustStock')}
      description={product.name}
      dismissible={!submitting}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth onClick={onSubmit} loading={submitting}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ChipSelect<StockMovementType>
          value={type}
          onChange={switchType}
          columns={2}
          items={[
            { value: 'in', label: t('product.stockIn'), icon: <ArrowDownLeft size={16} /> },
            { value: 'out', label: t('product.stockOut'), icon: <ArrowUpRight size={16} /> },
          ]}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">
            {t('product.quantity')}
          </label>
          <Input
            ref={qtyRef}
            emphasis
            inputMode="decimal"
            placeholder="0"
            value={quantityText}
            onChange={(e) => {
              setQuantityText(e.target.value);
              setQuantityError(null);
            }}
            error={quantityError}
            rightSlot={<span className="text-sm">{t(unitLabelKey(product.unit))}</span>}
          />
        </div>

        {nextStock != null && (
          <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            <span className="text-muted">{t('product.stock')}</span>
            <span className="flex items-center gap-2">
              <Qty value={product.stock} unit={product.unit} className="text-faint line-through" />
              <Qty
                value={nextStock}
                unit={product.unit}
                className={nextStock < 0 ? 'font-semibold text-danger' : 'font-semibold text-ink'}
              />
            </span>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">{t('product.reason')}</label>
          <ChipSelect<StockMovementReason>
            value={reason}
            onChange={setReason}
            columns={2}
            items={reasonsFor(type).map((r) => ({ value: r, label: t(reasonLabelKey(r)) }))}
          />
        </div>

        {priceField && (
          <Input
            label={priceField === 'price' ? t('product.sellingPrice') : t('product.purchasePrice')}
            inputMode="decimal"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder={String(
              priceField === 'price' ? product.sellingPrice : product.purchasePrice,
            )}
            hint={t('product.profitHint')}
            leftIcon={<span className="font-num text-muted">৳</span>}
          />
        )}

        <Input
          label={t('common.date')}
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
        />
        <Textarea
          label={`${t('common.note')} (${t('common.optional')})`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {nextStock != null && nextStock < 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{t('product.notEnoughStock')}</span>
          </div>
        )}
      </form>
    </Sheet>
  );
}
