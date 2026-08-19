import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Product, ProductUnit } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import type { TranslationKey } from '@/i18n/en';
import { parseAmount } from '@/utils/money';
import { validateName } from '@/utils/validation';
import { Button, Input, MoneyText, Select, Sheet, Textarea } from '@/components/ui';
import { PRODUCT_UNITS, unitLabelKey } from './productView';

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the form edits this product instead of creating one. */
  product?: Product;
  onSaved?: (product: Product) => void;
}

/** Empty input means "not set", not zero — keeps optional prices truly optional. */
function num(text: string): number {
  return text.trim() ? (parseAmount(text) ?? 0) : 0;
}

/**
 * Maps a backend uniqueness failure onto the field that caused it. The offline
 * adapter throws "SKU already in use"; Postgres reports the index name
 * (products_business_sku_key), so matching on the word covers both.
 */
function codeConflict(message: string): 'sku' | 'barcode' | null {
  if (/sku/i.test(message)) return 'sku';
  if (/barcode/i.test(message)) return 'barcode';
  return null;
}

export function ProductForm({ open, onClose, product, onSaved }: ProductFormProps) {
  const { t } = useI18n();
  const { productCategories, createProduct, updateProduct } = useData();
  const toast = useToast();
  const editing = !!product;

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [openingStock, setOpeningStock] = useState('');
  const [lowStock, setLowStock] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; sku?: string; barcode?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? '');
    setCategoryId(product?.categoryId ?? '');
    setSku(product?.sku ?? '');
    setBarcode(product?.barcode ?? '');
    setUnit(product?.unit ?? 'pcs');
    setPurchasePrice(product?.purchasePrice ? String(product.purchasePrice) : '');
    setSellingPrice(product?.sellingPrice ? String(product.sellingPrice) : '');
    setOpeningStock('');
    setLowStock(product?.lowStockThreshold ? String(product.lowStockThreshold) : '');
    setNotes(product?.notes ?? '');
    setErrors({});
    setSubmitting(false);
  }, [open, product]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const nameErr = validateName(name);
    if (nameErr) {
      setErrors({ name: t(nameErr as TranslationKey) });
      return;
    }

    setSubmitting(true);
    // Opening stock is only offered while creating. Afterwards, corrections go
    // through a stock movement so the change leaves an audit trail instead of
    // silently rewriting history.
    const input = {
      name: name.trim(),
      categoryId: categoryId || null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      unit,
      purchasePrice: num(purchasePrice),
      sellingPrice: num(sellingPrice),
      lowStockThreshold: num(lowStock),
      notes: notes.trim() || null,
      ...(editing ? {} : { openingStock: num(openingStock) }),
    };

    try {
      const saved = editing ? await updateProduct(product!.id, input) : await createProduct(input);
      toast.success(t('common.done'));
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const field = codeConflict(message);
      if (field === 'sku') setErrors({ sku: t('product.skuTaken') });
      else if (field === 'barcode') setErrors({ barcode: t('product.barcodeTaken') });
      else toast.error(message || t('error.saveFailed'));
      setSubmitting(false);
    }
  }

  const marginPerUnit = num(sellingPrice) - num(purchasePrice);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t('product.edit') : t('product.new')}
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
        <Input
          label={t('common.name')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((x) => ({ ...x, name: undefined }));
          }}
          error={errors.name}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('product.purchasePrice')}
            inputMode="decimal"
            placeholder="0"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            leftIcon={<span className="font-num text-muted">৳</span>}
          />
          <Input
            label={t('product.sellingPrice')}
            inputMode="decimal"
            placeholder="0"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            leftIcon={<span className="font-num text-muted">৳</span>}
          />
        </div>

        {marginPerUnit !== 0 && (
          <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">
            <span className="text-muted">{t('product.marginPerUnit')}</span>
            <MoneyText
              amount={marginPerUnit}
              tone={marginPerUnit > 0 ? 'positive' : 'danger'}
              className="font-semibold"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('product.unit')}
            options={PRODUCT_UNITS.map((u) => ({ value: u, label: t(unitLabelKey(u)) }))}
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnit)}
          />
          {!editing ? (
            <Input
              label={t('product.openingStock')}
              inputMode="decimal"
              placeholder="0"
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
            />
          ) : (
            <Input
              label={t('product.lowStockThreshold')}
              inputMode="decimal"
              placeholder="0"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
            />
          )}
        </div>

        {!editing && (
          <Input
            label={t('product.lowStockThreshold')}
            inputMode="decimal"
            placeholder="0"
            value={lowStock}
            onChange={(e) => setLowStock(e.target.value)}
            hint={t('product.lowStockHint')}
          />
        )}

        <Select
          label={`${t('product.category')} (${t('common.optional')})`}
          options={[
            { value: '', label: t('product.uncategorized') },
            ...productCategories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`${t('product.sku')} (${t('common.optional')})`}
            value={sku}
            onChange={(e) => {
              setSku(e.target.value);
              setErrors((x) => ({ ...x, sku: undefined }));
            }}
            error={errors.sku}
          />
          <Input
            label={`${t('product.barcode')} (${t('common.optional')})`}
            inputMode="numeric"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setErrors((x) => ({ ...x, barcode: undefined }));
            }}
            error={errors.barcode}
          />
        </div>

        <Textarea
          label={`${t('common.notes')} (${t('common.optional')})`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Sheet>
  );
}
