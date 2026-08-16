import type {
  Business,
  Expense,
  ExpenseCategory,
  Language,
  Party,
  PartyType,
  PaymentMethod,
  Profile,
  Reminder,
  Transaction,
  TransactionType,
} from '@/types';

export interface CreateBusinessInput {
  name: string;
  ownerName: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  currency: string;
  language: Language;
}

export interface CreatePartyInput {
  type: PartyType;
  name: string;
  phone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  openingBalance?: number;
  creditLimit?: number | null;
  dueDate?: string | null;
  notes?: string | null;
}

export interface CreateTransactionInput {
  partyId: string | null;
  partyType: PartyType | null;
  type: TransactionType;
  amount: number;
  note?: string | null;
  method: PaymentMethod;
  occurredAt?: string;
  /** Client-generated id used to de-duplicate offline submissions. */
  clientId?: string;
}

export interface CreateExpenseInput {
  amount: number;
  category: ExpenseCategory;
  note?: string | null;
  method: PaymentMethod;
  occurredAt?: string;
  receiptUrl?: string | null;
  clientId?: string;
}

export interface CreateReminderInput {
  partyId: string;
  message: string;
  channel: Reminder['channel'];
}

export interface TransactionQuery {
  partyId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ExpenseQuery {
  category?: ExpenseCategory;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/**
 * The single contract every backend implements. Swapping from the offline
 * mock to live Supabase is just choosing a different implementation of this.
 */
export interface DataAdapter {
  readonly kind: 'mock' | 'supabase';

  /* Business */
  getProfile(userId: string): Promise<Profile | null>;
  ensureProfile(userId: string, email: string | null, fullName: string): Promise<Profile>;
  listBusinesses(userId: string): Promise<Business[]>;
  createBusiness(userId: string, input: CreateBusinessInput): Promise<Business>;
  updateBusiness(id: string, patch: Partial<CreateBusinessInput>): Promise<Business>;

  /* Parties */
  listParties(businessId: string, type?: PartyType): Promise<Party[]>;
  getParty(id: string): Promise<Party | null>;
  createParty(businessId: string, userId: string, input: CreatePartyInput): Promise<Party>;
  updateParty(id: string, patch: Partial<CreatePartyInput>): Promise<Party>;
  deleteParty(id: string): Promise<void>;

  /* Transactions */
  listTransactions(businessId: string, query?: TransactionQuery): Promise<Transaction[]>;
  createTransaction(businessId: string, userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(id: string, patch: Partial<CreateTransactionInput>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  /* Expenses */
  listExpenses(businessId: string, query?: ExpenseQuery): Promise<Expense[]>;
  createExpense(businessId: string, userId: string, input: CreateExpenseInput): Promise<Expense>;
  updateExpense(id: string, patch: Partial<CreateExpenseInput>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;

  /* Reminders */
  listReminders(businessId: string, partyId?: string): Promise<Reminder[]>;
  createReminder(businessId: string, userId: string, input: CreateReminderInput): Promise<Reminder>;

  /* Offline sync bookkeeping (no-op for always-online backends) */
  getPendingCount(): Promise<number>;
  flushOutbox(): Promise<void>;

  /* Local utilities (implemented by the on-device backend) */
  loadSample?(businessId: string, userId: string): Promise<void>;
  exportAll?(businessId: string): Promise<unknown>;
  clearAll?(): Promise<void>;
}
