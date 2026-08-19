import type { ProductUnit, StockMovementReason, StockMovementType, StockStatus } from '@/types';
import type { Tone } from '@/components/ui';
import type { TranslationKey } from '@/i18n/en';
import { useI18n } from '@/contexts/I18nContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toBengaliDigits } from '@/utils/money';
import { cn } from '@/utils/cn';

/** Every unit a shopkeeper can pick, in the order they appear in the picker. */
export const PRODUCT_UNITS: readonly ProductUnit[] = [
  'pcs',
  'kg',
  'gram',
  'litre',
  'ml',
  'dozen',
  'box',
  'metre',
  'other',
] as const;

/**
 * Reasons a user may choose by hand. 'opening' is deliberately absent — opening
 * stock lives on the product itself, and offering it here would double-count.
 * 'transfer' arrives with multi-shop support, so it is hidden until then.
 */
export const IN_REASONS: readonly StockMovementReason[] = ['purchase', 'return_in', 'adjust'] as const;
export const OUT_REASONS: readonly StockMovementReason[] = [
  'sale',
  'return_out',
  'damage',
  'adjust',
] as const;

export function reasonsFor(type: StockMovementType): readonly StockMovementReason[] {
  return type === 'in' ? IN_REASONS : OUT_REASONS;
}

/**
 * Explicit maps rather than a computed `unit.${x}` template: `Record<ProductUnit,
 * TranslationKey>` makes a missing translation key a compile error.
 */
const UNIT_LABEL: Record<ProductUnit, TranslationKey> = {
  pcs: 'unit.pcs',
  kg: 'unit.kg',
  gram: 'unit.gram',
  litre: 'unit.litre',
  ml: 'unit.ml',
  dozen: 'unit.dozen',
  box: 'unit.box',
  metre: 'unit.metre',
  other: 'unit.other',
};

const REASON_LABEL: Record<StockMovementReason, TranslationKey> = {
  opening: 'reason.opening',
  purchase: 'reason.purchase',
  sale: 'reason.sale',
  return_in: 'reason.return_in',
  return_out: 'reason.return_out',
  damage: 'reason.damage',
  adjust: 'reason.adjust',
  transfer: 'reason.transfer',
};

export function unitLabelKey(unit: ProductUnit): TranslationKey {
  return UNIT_LABEL[unit];
}

export function reasonLabelKey(reason: StockMovementReason): TranslationKey {
  return REASON_LABEL[reason];
}

interface StatusView {
  labelKey: TranslationKey;
  tone: Tone;
}

const STATUS_VIEW: Record<StockStatus, StatusView> = {
  out: { labelKey: 'product.outOfStock', tone: 'danger' },
  low: { labelKey: 'product.lowStock', tone: 'warning' },
  ok: { labelKey: 'product.inStock', tone: 'positive' },
};

export function stockStatusView(status: StockStatus): StatusView {
  return STATUS_VIEW[status];
}

/** 2.500 → "2.5", 3.000 → "3". Quantities keep up to 3 decimals. */
export function trimQuantity(value: number): string {
  return (Math.round((value + Number.EPSILON) * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
}

interface QtyProps {
  value: number;
  unit: ProductUnit;
  /** Show a leading + / − (used in the stock history). */
  signed?: boolean;
  /** Hide the unit label and show the bare number. */
  noUnit?: boolean;
  className?: string;
}

/**
 * The canonical way to render a quantity: respects the Bengali-numeral setting
 * and the translated unit, and uses tabular figures so columns line up.
 */
export function Qty({ value, unit, signed, noUnit, className }: QtyProps) {
  const { t } = useI18n();
  const { settings } = useSettings();

  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  const digits = trimQuantity(Math.abs(value));
  const number = settings.showBengaliNumerals ? toBengaliDigits(digits) : digits;

  return (
    <span className={cn('font-num tabular', className)}>
      {sign}
      {number}
      {!noUnit && <span className="ml-1 text-[0.85em] font-normal">{t(unitLabelKey(unit))}</span>}
    </span>
  );
}
