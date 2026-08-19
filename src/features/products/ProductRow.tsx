import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import type { ProductWithStock } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { Badge, MoneyText } from '@/components/ui';
import { Qty, stockStatusView, unitLabelKey } from './productView';

/** Square tile with the product's initial — deliberately not a round avatar, so
 * a product never reads as a person in the same list style. */
function Thumb({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-2xl border border-line object-cover"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft font-display text-base font-semibold text-brand-strong">
      {initial || <Package size={18} />}
    </span>
  );
}

/** Tappable product list row: identity on the left, stock and price on the right. */
export function ProductRow({ product }: { product: ProductWithStock }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const status = stockStatusView(product.status);

  const sub = product.sku || product.barcode || t(unitLabelKey(product.unit));

  return (
    <button
      type="button"
      onClick={() => navigate(`/products/${product.id}`)}
      className="card flex w-full items-center gap-2.5 p-3 text-left transition-transform duration-150 active:scale-[0.99]"
    >
      <Thumb name={product.name} photoUrl={product.photoUrl} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{product.name}</span>
        <span className="mt-0.5 block truncate text-xs text-faint">{sub}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <MoneyText amount={product.sellingPrice} className="text-[15px] font-semibold text-ink" />
        {product.status === 'ok' ? (
          <span className="text-[11px] font-medium text-faint">
            <Qty value={product.stock} unit={product.unit} />
          </span>
        ) : (
          <Badge tone={status.tone} className="px-2 py-0.5 text-[10.5px]">
            {product.status === 'out' ? (
              t('product.outOfStock')
            ) : (
              <Qty value={product.stock} unit={product.unit} />
            )}
          </Badge>
        )}
      </div>
    </button>
  );
}
