/**
 * HisabMate inventory engine — pure, deterministic stock and profit maths.
 *
 * The golden rule from services/ledger.ts applies to stock too: a product's
 * stock on hand is ALWAYS derived from its opening stock plus the signed effect
 * of its movements. We never trust a stored "current stock" column. Editing or
 * deleting a movement simply recomputes the chain.
 *
 * Stock conventions:
 *   movement.type === 'in'  → stock increases (purchase, customer return)
 *   movement.type === 'out' → stock decreases (sale, damage, supplier return)
 * quantity is always a positive magnitude, so the delta formula is shared.
 *
 * Writer-side invariant: a product records its starting quantity EITHER in
 * `openingStock` OR as a movement with reason 'opening' — never both, or the
 * quantity would be counted twice. The app's create-product path sets
 * `openingStock` and writes no movement; CSV import may do the reverse.
 */
import type {
  ID,
  InventorySummary,
  Product,
  ProductProfit,
  ProductWithStock,
  ReportRange,
  StockLedgerRow,
  StockMovement,
  StockMovementType,
  StockStatus,
} from '@/types';
import { endOfDay, startOfDay } from '@/utils/date';

/** Money is rounded only on the way out, so sums never accumulate float drift. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Quantities allow 3 decimals (kg, litre). */
function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Signed effect of a movement on stock on hand. */
export function stockDelta(type: StockMovementType, quantity: number): number {
  const magnitude = Math.abs(quantity);
  return type === 'in' ? magnitude : -magnitude;
}

function isLive(m: { deletedAt?: string | null }): boolean {
  return !m.deletedAt;
}

/** Chronological sort key for deterministic running stock. */
function chronoKey(m: StockMovement): number {
  return new Date(m.occurredAt).getTime() || new Date(m.createdAt).getTime();
}

function inRange(iso: string, range: ReportRange): boolean {
  const t = new Date(iso).getTime();
  return t >= startOfDay(range.from).getTime() && t <= endOfDay(range.to).getTime();
}

/** Compute stock on hand from opening stock + live movements. */
export function computeStock(
  product: Pick<Product, 'openingStock'>,
  movements: StockMovement[],
): number {
  const raw = movements.reduce(
    (qty, m) => (isLive(m) ? qty + stockDelta(m.type, m.quantity) : qty),
    product.openingStock,
  );
  return round3(raw);
}

/** Ordered stock history (oldest → newest) with a running quantity per row. */
export function computeStockLedgerRows(
  product: Pick<Product, 'openingStock'>,
  movements: StockMovement[],
): StockLedgerRow[] {
  const live = movements.filter(isLive).slice().sort((a, b) => chronoKey(a) - chronoKey(b));
  let running = product.openingStock;
  return live.map((movement) => {
    const delta = stockDelta(movement.type, movement.quantity);
    running += delta;
    return { movement, delta, runningStock: round3(running) };
  });
}

/**
 * Traffic-light stock state. A threshold of 0 disables the low-stock warning,
 * but "out of stock" always applies — you can't sell what you don't have.
 */
export function computeStockStatus(stock: number, lowStockThreshold: number): StockStatus {
  if (stock <= 0) return 'out';
  if (lowStockThreshold > 0 && stock <= lowStockThreshold) return 'low';
  return 'ok';
}

export function groupMovementsByProduct(movements: StockMovement[]): Map<ID, StockMovement[]> {
  const map = new Map<ID, StockMovement[]>();
  for (const m of movements) {
    if (!m.productId) continue;
    const arr = map.get(m.productId);
    if (arr) arr.push(m);
    else map.set(m.productId, [m]);
  }
  return map;
}

/** Attach derived stock, status and valuation to a list of products. */
export function withStock(
  products: Product[],
  movementsByProduct: Map<ID, StockMovement[]>,
): ProductWithStock[] {
  return products
    .filter((p) => !p.archived)
    .map((p) => {
      const movements = movementsByProduct.get(p.id) ?? [];
      const stock = computeStock(p, movements);
      // Value only positive stock: a negative balance is a data problem to fix,
      // not an asset worth money.
      const sellable = Math.max(stock, 0);
      let lastMovementAt: string | null = null;
      for (const m of movements) {
        if (!isLive(m)) continue;
        if (m.occurredAt > (lastMovementAt ?? '')) lastMovementAt = m.occurredAt;
      }
      return {
        ...p,
        stock,
        status: computeStockStatus(stock, p.lowStockThreshold),
        stockValueAtCost: round2(sellable * p.purchasePrice),
        stockValueAtRetail: round2(sellable * p.sellingPrice),
        lastMovementAt,
      };
    });
}

/** Products needing attention — out of stock first, then low, then by name. */
export function lowStockAlerts(products: ProductWithStock[]): ProductWithStock[] {
  const rank: Record<StockStatus, number> = { out: 0, low: 1, ok: 2 };
  return products
    .filter((p) => p.status !== 'ok')
    .sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
}

/**
 * Per-product sales and realised profit.
 *
 * Revenue and cost come from the snapshots stored on each movement
 * (unitPrice / unitCost) so that changing a price today never rewrites past
 * profit. When a snapshot is missing — e.g. a hand-entered stock-out — we fall
 * back to the product's current prices, which is an approximation; invoice-
 * driven movements always carry snapshots.
 *
 * Customer returns ('return_in') reverse the corresponding sale, so the figures
 * are net of returns.
 */
export function computeProductProfit(
  products: Product[],
  movements: StockMovement[],
  range?: ReportRange,
): ProductProfit[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const acc = new Map<ID, { qty: number; revenue: number; cost: number }>();

  for (const m of movements) {
    if (!isLive(m)) continue;
    if (m.reason !== 'sale' && m.reason !== 'return_in') continue;
    if (range && !inRange(m.occurredAt, range)) continue;

    const product = byId.get(m.productId);
    if (!product) continue;

    const price = m.unitPrice ?? product.sellingPrice;
    const cost = m.unitCost ?? product.purchasePrice;
    // A sale is an 'out'; a customer return is an 'in' that cancels it out.
    const sign = m.reason === 'sale' ? 1 : -1;
    const qty = Math.abs(m.quantity) * sign;

    const entry = acc.get(m.productId) ?? { qty: 0, revenue: 0, cost: 0 };
    entry.qty += qty;
    entry.revenue += qty * price;
    entry.cost += qty * cost;
    acc.set(m.productId, entry);
  }

  return [...acc.entries()]
    .map(([productId, { qty, revenue, cost }]) => {
      const roundedRevenue = round2(revenue);
      const roundedCost = round2(cost);
      const profit = round2(roundedRevenue - roundedCost);
      const product = byId.get(productId)!;
      return {
        productId,
        name: product.name,
        unit: product.unit,
        quantitySold: round3(qty),
        revenue: roundedRevenue,
        cost: roundedCost,
        profit,
        margin: roundedRevenue > 0 ? round2((profit / roundedRevenue) * 100) : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

/** Total profit across every product in a ProductProfit list. */
export function totalProductProfit(rows: ProductProfit[]): {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
} {
  const revenue = round2(rows.reduce((s, r) => s + r.revenue, 0));
  const cost = round2(rows.reduce((s, r) => s + r.cost, 0));
  const profit = round2(revenue - cost);
  return { revenue, cost, profit, margin: revenue > 0 ? round2((profit / revenue) * 100) : 0 };
}

export function summarizeInventory(products: ProductWithStock[]): InventorySummary {
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalStockValueAtCost = 0;
  let totalStockValueAtRetail = 0;

  for (const p of products) {
    if (p.status === 'low') lowStockCount += 1;
    if (p.status === 'out') outOfStockCount += 1;
    totalStockValueAtCost += p.stockValueAtCost;
    totalStockValueAtRetail += p.stockValueAtRetail;
  }

  return {
    productCount: products.length,
    lowStockCount,
    outOfStockCount,
    totalStockValueAtCost: round2(totalStockValueAtCost),
    totalStockValueAtRetail: round2(totalStockValueAtRetail),
  };
}

/** Find a product by scanned barcode (exact match) or SKU, within one shop. */
export function findByCode<T extends Pick<Product, 'barcode' | 'sku'>>(
  products: T[],
  code: string,
): T | undefined {
  const needle = code.trim();
  if (!needle) return undefined;
  return (
    products.find((p) => p.barcode && p.barcode === needle) ??
    products.find((p) => p.sku && p.sku.toLowerCase() === needle.toLowerCase())
  );
}

/** Format a quantity with its unit, trimming trailing zeros (2.500 → "2.5 kg"). */
export function formatQuantity(quantity: number, unit: string): string {
  const trimmed = round3(quantity)
    .toFixed(3)
    .replace(/\.?0+$/, '');
  return `${trimmed} ${unit}`;
}
