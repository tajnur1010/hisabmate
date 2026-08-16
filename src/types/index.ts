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

export type SyncState = 'synced' | 'syncing' | 'offline';

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
