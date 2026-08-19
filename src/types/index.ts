/**
 * HisabMate domain model.
 *
 * Balance convention (see services/ledger.ts):
 *  - customer.balance > 0  → the customer owes you money (receivable)
 *  - customer.balance < 0  → you owe the customer (advance / overpayment)
 *  - supplier.balance > 0  → you owe the supplier (payable)
 *  - supplier.balance < 0  → the supplier owes you
 *
 * Balances are always DERIVED from opening balance + transaction history —
 * never stored as a directly editable field.
 */

export type ID = string;
/** ISO-8601 timestamp string. */
export type ISODateTime = string;

export type Language = 'bn' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';

export type PartyType = 'customer' | 'supplier';

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'bank' | 'other';

export type TransactionType =
  | 'received' // cash into the business from a party
  | 'paid' // cash out of the business to a party
  | 'credit_sale' // goods/credit given to a customer (or credit purchase from a supplier)
  | 'refund'; // money returned

export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'salary'
  | 'transport'
  | 'purchase'
  | 'food'
  | 'maintenance'
  | 'other';

export type DueStatus = 'good' | 'due_soon' | 'overdue';

/**
 * Sync status shown in the top bar.
 * `local` means this session has no server at all (guest / on-device mode), so
 * there is nothing to upload — never claim "syncing" for it.
 */
export type SyncState = 'synced' | 'syncing' | 'offline' | 'local';

export interface Profile {
  id: ID;
  email: string | null;
  fullName: string;
  avatarUrl?: string | null;
  createdAt: ISODateTime;
}

export interface Business {
  id: ID;
  ownerId: ID;
  name: string;
  ownerName: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  currency: string;
  language: Language;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type MemberRole = 'owner' | 'manager' | 'staff';

export interface BusinessMember {
  id: ID;
  businessId: ID;
  userId: ID;
  role: MemberRole;
  createdAt: ISODateTime;
}

/** Shared shape for customers and suppliers. */
export interface Party {
  id: ID;
  businessId: ID;
  type: PartyType;
  name: string;
  phone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  /** Signed opening balance in the party convention above. */
  openingBalance: number;
  creditLimit?: number | null;
  /** Day-of-cycle due date for outstanding amounts (ISO date). */
  dueDate?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archived?: boolean;
}

export type Customer = Party & { type: 'customer' };
export type Supplier = Party & { type: 'supplier' };

export interface Transaction {
  id: ID;
  businessId: ID;
  partyId: ID | null;
  partyType: PartyType | null;
  type: TransactionType;
  /** Always a positive magnitude; direction is derived from `type` + party. */
  amount: number;
  note?: string | null;
  method: PaymentMethod;
  /** When the transaction occurred (may differ from createdAt). */
  occurredAt: ISODateTime;
  createdAt: ISODateTime;
  createdBy: ID;
  /** Snapshot of the party balance for receipts/audit — NOT the source of truth. */
  previousBalance: number;
  newBalance: number;
  /** Offline sync bookkeeping. */
  pending?: boolean;
  clientId?: string;
  deletedAt?: ISODateTime | null;
}

export interface Expense {
  id: ID;
  businessId: ID;
  amount: number;
  category: ExpenseCategory;
  note?: string | null;
  method: PaymentMethod;
  occurredAt: ISODateTime;
  receiptUrl?: string | null;
  createdAt: ISODateTime;
  createdBy: ID;
  pending?: boolean;
  clientId?: string;
  deletedAt?: ISODateTime | null;
}

/* ---- Products & inventory ---- */

/** Sale unit. Weight/volume units allow fractional quantities. */
export type ProductUnit =
  | 'pcs'
  | 'kg'
  | 'gram'
  | 'litre'
  | 'ml'
  | 'dozen'
  | 'box'
  | 'metre'
  | 'other';

/**
 * Direction of a stock change. Quantity is always a positive magnitude —
 * direction comes from the type, exactly like TransactionType.
 */
export type StockMovementType = 'in' | 'out';

/** Why stock moved. Drives labelling and product-profit maths. */
export type StockMovementReason =
  | 'opening' // initial stock when the product was created
  | 'purchase' // bought from a supplier
  | 'sale' // sold to a customer
  | 'return_in' // customer returned goods to us
  | 'return_out' // we returned goods to a supplier
  | 'damage' // written off
  | 'adjust' // physical stock-count correction
  | 'transfer'; // moved between shops

/** Traffic-light state for stock on hand. */
export type StockStatus = 'out' | 'low' | 'ok';

export interface ProductCategory {
  id: ID;
  businessId: ID;
  name: string;
  createdAt: ISODateTime;
}

export interface Product {
  id: ID;
  businessId: ID;
  categoryId: ID | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: ProductUnit;
  purchasePrice: number;
  sellingPrice: number;
  /**
   * Stock on hand when the product was added. Current stock is DERIVED from
   * this plus the signed effect of stock movements — never stored directly.
   */
  openingStock: number;
  /** Low-stock alert threshold; 0 disables the alert. */
  lowStockThreshold: number;
  photoUrl?: string | null;
  notes?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archived?: boolean;
}

export interface StockMovement {
  id: ID;
  businessId: ID;
  productId: ID;
  type: StockMovementType;
  reason: StockMovementReason;
  /** Always a positive magnitude; direction is derived from `type`. */
  quantity: number;
  /** Cost/price snapshot at movement time, so profit never rewrites history. */
  unitCost?: number | null;
  unitPrice?: number | null;
  note?: string | null;
  /** The document that caused this movement (invoice/return), when applicable. */
  refType?: 'invoice' | 'return' | 'transaction' | 'manual' | null;
  refId?: ID | null;
  occurredAt: ISODateTime;
  createdAt: ISODateTime;
  createdBy: ID;
  pending?: boolean;
  clientId?: string;
  deletedAt?: ISODateTime | null;
}

export interface Reminder {
  id: ID;
  businessId: ID;
  partyId: ID;
  message: string;
  channel: 'whatsapp' | 'sms' | 'copy';
  sentAt: ISODateTime;
  createdBy: ID;
}

export interface Receipt {
  id: ID;
  businessId: ID;
  transactionId: ID;
  number: string;
  createdAt: ISODateTime;
}

export interface AppSettings {
  reminderTemplateBn: string;
  reminderTemplateEn: string;
  dueSoonDays: number; // "due soon" window before the due date
  showBengaliNumerals: boolean;
  pinLockEnabled: boolean;
}

/* ---- Derived / view models ---- */

export interface PartyWithBalance extends Party {
  balance: number;
  status: DueStatus;
  lastTransactionAt: ISODateTime | null;
  daysOverdue: number;
}

export interface LedgerRow {
  transaction: Transaction;
  /** Signed effect on the party balance. */
  delta: number;
  /** Running balance after this row. */
  runningBalance: number;
}

export interface DashboardSummary {
  totalReceivable: number;
  totalPayable: number;
  todayCollection: number;
  todayExpense: number;
  todayReceivedCount: number;
  customerCount: number;
  supplierCount: number;
  overdueAmount: number;
  overdueCount: number;
}

export interface CashFlowPoint {
  label: string;
  monthKey: string; // YYYY-MM
  inflow: number;
  outflow: number;
  net: number;
}

export interface ReportRange {
  from: string; // ISO date
  to: string; // ISO date
}

export interface PeriodReport {
  range: ReportRange;
  sales: number; // credit sales value
  collection: number; // cash received
  expense: number;
  newCredit: number;
  refunds: number;
  netCashFlow: number;
  estimatedProfit: number;
  outstandingReceivable: number;
  outstandingPayable: number;
}

/** A product with its DERIVED stock on hand and alert state. */
export interface ProductWithStock extends Product {
  /** openingStock + signed effect of every live movement. */
  stock: number;
  status: StockStatus;
  /** Stock valued at purchase price (what it cost) and selling price (retail). */
  stockValueAtCost: number;
  stockValueAtRetail: number;
  lastMovementAt: ISODateTime | null;
}

/** Ordered stock history with a running quantity, mirroring LedgerRow. */
export interface StockLedgerRow {
  movement: StockMovement;
  /** Signed effect on stock (+in / −out). */
  delta: number;
  runningStock: number;
}

/** Per-product sales and realised profit over a period. */
export interface ProductProfit {
  productId: ID;
  name: string;
  unit: ProductUnit;
  /** Quantity sold (net of customer returns). */
  quantitySold: number;
  /** Revenue at the price actually charged. */
  revenue: number;
  /** Cost of goods sold, from the cost snapshot on each movement. */
  cost: number;
  /** revenue − cost. */
  profit: number;
  /** profit / revenue as a percentage; 0 when revenue is 0. */
  margin: number;
}

export interface InventorySummary {
  productCount: number;
  /** Products with stock at or below their threshold (threshold > 0). */
  lowStockCount: number;
  /** Products with stock <= 0. */
  outOfStockCount: number;
  totalStockValueAtCost: number;
  totalStockValueAtRetail: number;
}

/** Parsed result from the voice-entry parser (needs confirmation before saving). */
export interface ParsedVoiceEntry {
  partyName?: string;
  amount?: number;
  type: TransactionType;
  method: PaymentMethod;
  note?: string;
  confidence: number;
  rawText: string;
}
