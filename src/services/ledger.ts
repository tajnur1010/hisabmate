/**
 * HisabMate accounting engine — pure, deterministic ledger math.
 *
 * The golden rule: a party's balance is ALWAYS derived from its opening
 * balance plus the signed effect of its transactions. We never trust a
 * stored "balance" column as the source of truth. Editing or deleting a
 * transaction simply recomputes the whole chain.
 *
 * Balance conventions:
 *   customer.balance > 0 → customer owes you (receivable)
 *   supplier.balance > 0 → you owe the supplier (payable)
 * In both, a credit_sale increases the balance and every cash movement
 * (received / paid / refund) decreases it — so the delta formula is shared.
 */
import type {
  CashFlowPoint,
  DashboardSummary,
  DueStatus,
  Expense,
  LedgerRow,
  Party,
  PartyWithBalance,
  PeriodReport,
  ReportRange,
  Transaction,
  TransactionType,
} from '@/types';
import { addDays, daysBetween, endOfDay, monthKey, startOfDay, toDateInputValue } from '@/utils/date';

/** Signed effect of a transaction on its party's balance. */
export function ledgerDelta(type: TransactionType, amount: number): number {
  const magnitude = Math.abs(amount);
  return type === 'credit_sale' ? magnitude : -magnitude;
}

function isLive(t: { deletedAt?: string | null }): boolean {
  return !t.deletedAt;
}

/** Chronological sort key for deterministic running balances. */
function chronoKey(t: Transaction): number {
  return new Date(t.occurredAt).getTime() || new Date(t.createdAt).getTime();
}

/** Compute a party's current balance from opening balance + live transactions. */
export function computeBalance(party: Pick<Party, 'openingBalance'>, txns: Transaction[]): number {
  return txns.reduce(
    (bal, t) => (isLive(t) ? bal + ledgerDelta(t.type, t.amount) : bal),
    party.openingBalance,
  );
}

/** Ordered ledger rows (oldest → newest) with a running balance per row. */
export function computeLedgerRows(
  party: Pick<Party, 'openingBalance'>,
  txns: Transaction[],
): LedgerRow[] {
  const live = txns.filter(isLive).slice().sort((a, b) => chronoKey(a) - chronoKey(b));
  let running = party.openingBalance;
  return live.map((transaction) => {
    const delta = ledgerDelta(transaction.type, transaction.amount);
    running += delta;
    return { transaction, delta, runningBalance: running };
  });
}

export interface PartyTotals {
  totalCredit: number; // sum of credit_sale
  totalPaid: number; // sum of received (payments in)
  lastPaymentAt: string | null;
  lastTransactionAt: string | null;
}

export function computePartyTotals(txns: Transaction[]): PartyTotals {
  let totalCredit = 0;
  let totalPaid = 0;
  let lastPaymentAt: string | null = null;
  let lastTransactionAt: string | null = null;

  for (const t of txns) {
    if (!isLive(t)) continue;
    if (t.occurredAt > (lastTransactionAt ?? '')) lastTransactionAt = t.occurredAt;
    if (t.type === 'credit_sale') totalCredit += t.amount;
    if (t.type === 'received') {
      totalPaid += t.amount;
      if (t.occurredAt > (lastPaymentAt ?? '')) lastPaymentAt = t.occurredAt;
    }
  }
  return { totalCredit, totalPaid, lastPaymentAt, lastTransactionAt };
}

/** Determine the traffic-light status for an outstanding party. */
export function computeStatus(
  party: Pick<Party, 'dueDate'>,
  balance: number,
  dueSoonDays: number,
  now: Date = new Date(),
): { status: DueStatus; daysOverdue: number } {
  if (balance <= 0.0001) return { status: 'good', daysOverdue: 0 };
  if (!party.dueDate) return { status: 'good', daysOverdue: 0 };

  const due = startOfDay(party.dueDate);
  const today = startOfDay(now);
  const overdueBy = daysBetween(due, today); // positive if past due

  if (overdueBy > 0) return { status: 'overdue', daysOverdue: overdueBy };
  if (overdueBy >= -dueSoonDays) return { status: 'due_soon', daysOverdue: 0 };
  return { status: 'good', daysOverdue: 0 };
}

/** Attach derived balance + status to a list of parties. */
export function withBalances(
  parties: Party[],
  txnsByParty: Map<string, Transaction[]>,
  dueSoonDays: number,
  now: Date = new Date(),
): PartyWithBalance[] {
  return parties
    .filter((p) => !p.archived)
    .map((p) => {
      const txns = txnsByParty.get(p.id) ?? [];
      const balance = computeBalance(p, txns);
      const { status, daysOverdue } = computeStatus(p, balance, dueSoonDays, now);
      const { lastTransactionAt } = computePartyTotals(txns);
      return { ...p, balance, status, daysOverdue, lastTransactionAt };
    });
}

export function groupTransactionsByParty(txns: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (!t.partyId) continue;
    const arr = map.get(t.partyId);
    if (arr) arr.push(t);
    else map.set(t.partyId, [t]);
  }
  return map;
}

/** Build the dashboard summary from raw data. */
export function summarizeDashboard(
  parties: PartyWithBalance[],
  transactions: Transaction[],
  expenses: Expense[],
  now: Date = new Date(),
): DashboardSummary {
  const customers = parties.filter((p) => p.type === 'customer');
  const suppliers = parties.filter((p) => p.type === 'supplier');

  const totalReceivable = customers.reduce((s, c) => s + Math.max(c.balance, 0), 0);
  const totalPayable = suppliers.reduce((s, c) => s + Math.max(c.balance, 0), 0);

  const dayStart = startOfDay(now).getTime();
  const dayEnd = endOfDay(now).getTime();
  const inDay = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= dayStart && t <= dayEnd;
  };

  let todayCollection = 0;
  let todayReceivedCount = 0;
  for (const t of transactions) {
    if (t.deletedAt || !inDay(t.occurredAt)) continue;
    if (t.type === 'received') {
      todayCollection += t.amount;
      todayReceivedCount += 1;
    }
  }

  const todayExpense = expenses
    .filter((e) => !e.deletedAt && inDay(e.occurredAt))
    .reduce((s, e) => s + e.amount, 0);

  const overdueCustomers = customers.filter((c) => c.status === 'overdue');
  const overdueAmount = overdueCustomers.reduce((s, c) => s + Math.max(c.balance, 0), 0);

  return {
    totalReceivable,
    totalPayable,
    todayCollection,
    todayExpense,
    todayReceivedCount,
    customerCount: customers.length,
    supplierCount: suppliers.length,
    overdueAmount,
    overdueCount: overdueCustomers.length,
  };
}

/** Monthly cash-flow series for the last `months` months (chart data). */
export function buildCashFlow(
  transactions: Transaction[],
  expenses: Expense[],
  months: number,
  now: Date = new Date(),
): CashFlowPoint[] {
  const buckets = new Map<string, { inflow: number; outflow: number }>();
  const order: string[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    buckets.set(key, { inflow: 0, outflow: 0 });
    order.push(key);
  }

  for (const t of transactions) {
    if (t.deletedAt) continue;
    const key = monthKey(t.occurredAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.type === 'received') bucket.inflow += t.amount;
    else if (t.type === 'paid' || t.type === 'refund') bucket.outflow += t.amount;
  }
  for (const e of expenses) {
    if (e.deletedAt) continue;
    const bucket = buckets.get(monthKey(e.occurredAt));
    if (bucket) bucket.outflow += e.amount;
  }

  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return order.map((key) => {
    const [, m] = key.split('-');
    const { inflow, outflow } = buckets.get(key)!;
    return { label: MONTHS_SHORT[Number(m) - 1], monthKey: key, inflow, outflow, net: inflow - outflow };
  });
}

function inRange(iso: string, range: ReportRange): boolean {
  const t = new Date(iso).getTime();
  return t >= startOfDay(range.from).getTime() && t <= endOfDay(range.to).getTime();
}

/** Aggregate a report for an arbitrary date range. */
export function buildPeriodReport(
  range: ReportRange,
  transactions: Transaction[],
  expenses: Expense[],
  currentReceivable: number,
  currentPayable: number,
): PeriodReport {
  let sales = 0;
  let collection = 0;
  let refunds = 0;
  let paidOut = 0;

  for (const t of transactions) {
    if (t.deletedAt || !inRange(t.occurredAt, range)) continue;
    if (t.type === 'credit_sale') sales += t.amount;
    else if (t.type === 'received') collection += t.amount;
    else if (t.type === 'refund') refunds += t.amount;
    else if (t.type === 'paid') paidOut += t.amount;
  }

  const expense = expenses
    .filter((e) => !e.deletedAt && inRange(e.occurredAt, range))
    .reduce((s, e) => s + e.amount, 0);

  const netCashFlow = collection - expense - paidOut - refunds;
  const estimatedProfit = collection - expense;

  return {
    range,
    sales,
    collection,
    expense,
    newCredit: sales,
    refunds,
    netCashFlow,
    estimatedProfit,
    outstandingReceivable: currentReceivable,
    outstandingPayable: currentPayable,
  };
}

export function todayRange(now: Date = new Date()): ReportRange {
  // Use the LOCAL calendar date (not UTC). `toISOString().slice(0,10)` would
  // shift the day for non-UTC users (e.g. UTC+6 Bangladesh), making "Today"
  // resolve to yesterday. toDateInputValue formats in local time.
  const iso = toDateInputValue(now);
  return { from: iso, to: iso };
}

export function weekRange(now: Date = new Date()): ReportRange {
  return { from: toDateInputValue(addDays(now, -6)), to: toDateInputValue(now) };
}

export function monthRange(now: Date = new Date()): ReportRange {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toDateInputValue(first), to: toDateInputValue(now) };
}

export function expensesByCategory(
  expenses: Expense[],
  range?: ReportRange,
): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (e.deletedAt) continue;
    if (range && !inRange(e.occurredAt, range)) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}
