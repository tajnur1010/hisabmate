import type {
  Business,
  Expense,
  ExpenseCategory,
  Language,
  Party,
  PartyType,
  PaymentMethod,
  Product,
  ProductCategory,
  ProductUnit,
  Profile,
  Reminder,
  StockMovement,
  StockMovementReason,
  StockMovementType,
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

/* ── Products & inventory ─────────────────────────────────── */

export interface CreateProductCategoryInput {
  name: string;
}

export interface CreateProductInput {
  name: string;
  categoryId?: string | null;
  sku?: string | null;
  barcode?: string | null;
  unit?: ProductUnit;
  purchasePrice?: number;
  sellingPrice?: number;
  /** Starting quantity. Current stock stays derived from this + movements. */
  openingStock?: number;
  lowStockThreshold?: number;
  photoUrl?: string | null;
  notes?: string | null;
}

export interface CreateStockMovementInput {
  productId: string;
  type: StockMovementType;
  reason?: StockMovementReason;
  /** Positive magnitude; direction comes from `type`. */
  quantity: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  note?: string | null;
  refType?: StockMovement['refType'];
  refId?: string | null;
  occurredAt?: string;
  clientId?: string;
}

export interface ProductQuery {
  categoryId?: string;
  /** Free-text match on name / SKU / barcode. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface StockMovementQuery {
  productId?: string;
  type?: StockMovementType;
  reason?: StockMovementReason;
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

  /* Product categories */
  listProductCategories(businessId: string): Promise<ProductCategory[]>;
  createProductCategory(businessId: string, input: CreateProductCategoryInput): Promise<ProductCategory>;
  updateProductCategory(id: string, patch: CreateProductCategoryInput): Promise<ProductCategory>;
  deleteProductCategory(id: string): Promise<void>;

  /* Products */
  listProducts(businessId: string, query?: ProductQuery): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  /** Barcode/SKU lookup scoped to one shop — powers the scanner. */
  findProductByCode(businessId: string, code: string): Promise<Product | null>;
  createProduct(businessId: string, userId: string, input: CreateProductInput): Promise<Product>;
  updateProduct(id: string, patch: Partial<CreateProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  /* Stock movements */
  listStockMovements(businessId: string, query?: StockMovementQuery): Promise<StockMovement[]>;
  createStockMovement(
    businessId: string,
    userId: string,
    input: CreateStockMovementInput,
  ): Promise<StockMovement>;
  updateStockMovement(id: string, patch: Partial<CreateStockMovementInput>): Promise<StockMovement>;
  deleteStockMovement(id: string): Promise<void>;

  /* Offline sync bookkeeping (no-op for always-online backends) */
  getPendingCount(): Promise<number>;
  flushOutbox(): Promise<void>;

  /* Local utilities (implemented by the on-device backend) */
  loadSample?(businessId: string, userId: string): Promise<void>;
  exportAll?(businessId: string): Promise<unknown>;
  clearAll?(): Promise<void>;
}
