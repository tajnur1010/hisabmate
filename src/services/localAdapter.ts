import type {
  Business,
  Expense,
  Party,
  PartyType,
  Product,
  ProductCategory,
  Profile,
  Reminder,
  StockMovement,
  Transaction,
} from '@/types';
import { uuid } from '@/utils/id';
import { idb } from './db';
import { computeBalance } from './ledger';
import { buildSeed } from './seed';
import type {
  CreateBusinessInput,
  CreateExpenseInput,
  CreatePartyInput,
  CreateProductCategoryInput,
  CreateProductInput,
  CreateReminderInput,
  CreateStockMovementInput,
  CreateTransactionInput,
  DataAdapter,
  ExpenseQuery,
  ProductQuery,
  StockMovementQuery,
  TransactionQuery,
} from './adapter';

/**
 * On-device backend backed by IndexedDB. This is a fully real, persistent
 * data store — everything the user enters is saved locally and survives
 * reloads and offline use. It also powers the offline outbox so entries made
 * while disconnected are flushed when connectivity returns.
 */
export class LocalAdapter implements DataAdapter {
  readonly kind = 'mock' as const;

  private isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  /* ── Profile & business ─────────────────────────────────── */
  async getProfile(userId: string): Promise<Profile | null> {
    return (await idb.get<Profile>('profiles', userId)) ?? null;
  }

  async ensureProfile(userId: string, email: string | null, fullName: string): Promise<Profile> {
    const existing = await idb.get<Profile>('profiles', userId);
    if (existing) return existing;
    const profile: Profile = {
      id: userId,
      email,
      fullName,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };
    return idb.put('profiles', profile);
  }

  async listBusinesses(userId: string): Promise<Business[]> {
    return idb.getByIndex<Business>('businesses', 'ownerId', userId);
  }

  async createBusiness(userId: string, input: CreateBusinessInput): Promise<Business> {
    const now = new Date().toISOString();
    const business: Business = {
      id: uuid(),
      ownerId: userId,
      name: input.name,
      ownerName: input.ownerName,
      phone: input.phone ?? null,
      address: input.address ?? null,
      logoUrl: input.logoUrl ?? null,
      currency: input.currency,
      language: input.language,
      createdAt: now,
      updatedAt: now,
    };
    await idb.put('businesses', business);
    await idb.put('members', {
      id: uuid(),
      businessId: business.id,
      userId,
      role: 'owner',
      createdAt: now,
    });
    return business;
  }

  async updateBusiness(id: string, patch: Partial<CreateBusinessInput>): Promise<Business> {
    const existing = await idb.get<Business>('businesses', id);
    if (!existing) throw new Error('Business not found');
    const updated: Business = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return idb.put('businesses', updated);
  }

  /* ── Parties ────────────────────────────────────────────── */
  async listParties(businessId: string, type?: PartyType): Promise<Party[]> {
    const all = await idb.getByIndex<Party>('parties', 'businessId', businessId);
    const live = all.filter((p) => !p.archived);
    return type ? live.filter((p) => p.type === type) : live;
  }

  async getParty(id: string): Promise<Party | null> {
    return (await idb.get<Party>('parties', id)) ?? null;
  }

  async createParty(businessId: string, _userId: string, input: CreatePartyInput): Promise<Party> {
    const now = new Date().toISOString();
    const party: Party = {
      id: uuid(),
      businessId,
      type: input.type,
      name: input.name.trim(),
      phone: input.phone ?? null,
      address: input.address ?? null,
      photoUrl: input.photoUrl ?? null,
      openingBalance: input.openingBalance ?? 0,
      creditLimit: input.creditLimit ?? null,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    return idb.put('parties', party);
  }

  async updateParty(id: string, patch: Partial<CreatePartyInput>): Promise<Party> {
    const existing = await idb.get<Party>('parties', id);
    if (!existing) throw new Error('Party not found');
    const updated: Party = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    return idb.put('parties', updated);
  }

  async deleteParty(id: string): Promise<void> {
    const txns = await idb.getByIndex<Transaction>('transactions', 'partyId', id);
    await Promise.all(txns.map((t) => idb.delete('transactions', t.id)));
    await idb.delete('parties', id);
  }

  /* ── Transactions ───────────────────────────────────────── */
  async listTransactions(businessId: string, query: TransactionQuery = {}): Promise<Transaction[]> {
    let rows = await idb.getByIndex<Transaction>('transactions', 'businessId', businessId);
    rows = rows.filter((t) => !t.deletedAt);
    if (query.partyId) rows = rows.filter((t) => t.partyId === query.partyId);
    if (query.type) rows = rows.filter((t) => t.type === query.type);
    if (query.from) rows = rows.filter((t) => t.occurredAt >= query.from!);
    if (query.to) rows = rows.filter((t) => t.occurredAt <= query.to! + 'T23:59:59.999Z');
    rows.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    const offset = query.offset ?? 0;
    const limit = query.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async createTransaction(
    businessId: string,
    userId: string,
    input: CreateTransactionInput,
  ): Promise<Transaction> {
    // Idempotency: never double-record the same client submission.
    if (input.clientId) {
      const all = await idb.getByIndex<Transaction>('transactions', 'businessId', businessId);
      const dup = all.find((t) => t.clientId === input.clientId);
      if (dup) return dup;
    }

    let previousBalance = 0;
    if (input.partyId) {
      const party = await idb.get<Party>('parties', input.partyId);
      const partyTxns = await idb.getByIndex<Transaction>('transactions', 'partyId', input.partyId);
      previousBalance = party ? computeBalance(party, partyTxns.filter((t) => !t.deletedAt)) : 0;
    }

    const delta = input.type === 'credit_sale' ? Math.abs(input.amount) : -Math.abs(input.amount);
    const now = new Date().toISOString();
    const txn: Transaction = {
      id: uuid(),
      businessId,
      partyId: input.partyId,
      partyType: input.partyType,
      type: input.type,
      amount: Math.abs(input.amount),
      note: input.note ?? null,
      method: input.method,
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
      createdBy: userId,
      previousBalance,
      newBalance: previousBalance + delta,
      pending: !this.isOnline(),
      clientId: input.clientId,
      deletedAt: null,
    };
    return idb.put('transactions', txn);
  }

  async updateTransaction(id: string, patch: Partial<CreateTransactionInput>): Promise<Transaction> {
    const existing = await idb.get<Transaction>('transactions', id);
    if (!existing) throw new Error('Transaction not found');
    const updated: Transaction = {
      ...existing,
      ...patch,
      amount: patch.amount != null ? Math.abs(patch.amount) : existing.amount,
    };
    return idb.put('transactions', updated);
  }

  async deleteTransaction(id: string): Promise<void> {
    const existing = await idb.get<Transaction>('transactions', id);
    if (!existing) return;
    // Soft delete keeps an audit trail; balances recompute ignoring it.
    await idb.put('transactions', { ...existing, deletedAt: new Date().toISOString() });
  }

  /* ── Expenses ───────────────────────────────────────────── */
  async listExpenses(businessId: string, query: ExpenseQuery = {}): Promise<Expense[]> {
    let rows = await idb.getByIndex<Expense>('expenses', 'businessId', businessId);
    rows = rows.filter((e) => !e.deletedAt);
    if (query.category) rows = rows.filter((e) => e.category === query.category);
    if (query.from) rows = rows.filter((e) => e.occurredAt >= query.from!);
    if (query.to) rows = rows.filter((e) => e.occurredAt <= query.to! + 'T23:59:59.999Z');
    rows.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    const offset = query.offset ?? 0;
    const limit = query.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async createExpense(businessId: string, userId: string, input: CreateExpenseInput): Promise<Expense> {
    if (input.clientId) {
      const all = await idb.getByIndex<Expense>('expenses', 'businessId', businessId);
      const dup = all.find((e) => e.clientId === input.clientId);
      if (dup) return dup;
    }
    const now = new Date().toISOString();
    const expense: Expense = {
      id: uuid(),
      businessId,
      amount: Math.abs(input.amount),
      category: input.category,
      note: input.note ?? null,
      method: input.method,
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
      createdBy: userId,
      receiptUrl: input.receiptUrl ?? null,
      pending: !this.isOnline(),
      clientId: input.clientId,
      deletedAt: null,
    };
    return idb.put('expenses', expense);
  }

  async updateExpense(id: string, patch: Partial<CreateExpenseInput>): Promise<Expense> {
    const existing = await idb.get<Expense>('expenses', id);
    if (!existing) throw new Error('Expense not found');
    const updated: Expense = {
      ...existing,
      ...patch,
      amount: patch.amount != null ? Math.abs(patch.amount) : existing.amount,
    };
    return idb.put('expenses', updated);
  }

  async deleteExpense(id: string): Promise<void> {
    const existing = await idb.get<Expense>('expenses', id);
    if (!existing) return;
    await idb.put('expenses', { ...existing, deletedAt: new Date().toISOString() });
  }

  /* ── Reminders ──────────────────────────────────────────── */
  async listReminders(businessId: string, partyId?: string): Promise<Reminder[]> {
    const rows = await idb.getByIndex<Reminder>('reminders', 'businessId', businessId);
    const filtered = partyId ? rows.filter((r) => r.partyId === partyId) : rows;
    return filtered.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  }

  async createReminder(
    businessId: string,
    userId: string,
    input: CreateReminderInput,
  ): Promise<Reminder> {
    const reminder: Reminder = {
      id: uuid(),
      businessId,
      partyId: input.partyId,
      message: input.message,
      channel: input.channel,
      sentAt: new Date().toISOString(),
      createdBy: userId,
    };
    return idb.put('reminders', reminder);
  }

  /* ── Product categories ─────────────────────────────────── */
  async listProductCategories(businessId: string): Promise<ProductCategory[]> {
    const rows = await idb.getByIndex<ProductCategory>('productCategories', 'businessId', businessId);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createProductCategory(
    businessId: string,
    input: CreateProductCategoryInput,
  ): Promise<ProductCategory> {
    const name = input.name.trim();
    const existing = await this.listProductCategories(businessId);
    // Mirrors the case-insensitive unique index in 0003_inventory.sql.
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Category already exists');
    }
    const category: ProductCategory = {
      id: uuid(),
      businessId,
      name,
      createdAt: new Date().toISOString(),
    };
    return idb.put('productCategories', category);
  }

  async updateProductCategory(id: string, patch: CreateProductCategoryInput): Promise<ProductCategory> {
    const existing = await idb.get<ProductCategory>('productCategories', id);
    if (!existing) throw new Error('Category not found');
    const name = patch.name.trim();
    const siblings = await this.listProductCategories(existing.businessId);
    if (siblings.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Category already exists');
    }
    return idb.put('productCategories', { ...existing, name });
  }

  async deleteProductCategory(id: string): Promise<void> {
    const existing = await idb.get<ProductCategory>('productCategories', id);
    if (!existing) return;
    // Products survive their category, just uncategorised (ON DELETE SET NULL).
    const products = await idb.getByIndex<Product>('products', 'businessId', existing.businessId);
    await Promise.all(
      products
        .filter((p) => p.categoryId === id)
        .map((p) => idb.put('products', { ...p, categoryId: null })),
    );
    await idb.delete('productCategories', id);
  }

  /* ── Products ───────────────────────────────────────────── */
  async listProducts(businessId: string, query: ProductQuery = {}): Promise<Product[]> {
    let rows = await idb.getByIndex<Product>('products', 'businessId', businessId);
    rows = rows.filter((p) => !p.archived);
    if (query.categoryId) rows = rows.filter((p) => p.categoryId === query.categoryId);
    if (query.search) {
      const needle = query.search.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.sku ?? '').toLowerCase().includes(needle) ||
          (p.barcode ?? '').toLowerCase().includes(needle),
      );
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const offset = query.offset ?? 0;
    const limit = query.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async getProduct(id: string): Promise<Product | null> {
    return (await idb.get<Product>('products', id)) ?? null;
  }

  async findProductByCode(businessId: string, code: string): Promise<Product | null> {
    const needle = code.trim();
    if (!needle) return null;
    const rows = await this.listProducts(businessId);
    const byBarcode = rows.find((p) => p.barcode && p.barcode === needle);
    if (byBarcode) return byBarcode;
    const bySku = rows.find((p) => p.sku && p.sku.toLowerCase() === needle.toLowerCase());
    return bySku ?? null;
  }

  /** Enforces the per-shop SKU/barcode uniqueness that the SQL schema requires. */
  private async assertCodesFree(
    businessId: string,
    codes: { sku?: string | null; barcode?: string | null },
    ignoreId?: string,
  ): Promise<void> {
    const rows = await idb.getByIndex<Product>('products', 'businessId', businessId);
    const others = rows.filter((p) => p.id !== ignoreId);
    if (codes.sku && others.some((p) => p.sku === codes.sku)) {
      throw new Error('SKU already in use');
    }
    if (codes.barcode && others.some((p) => p.barcode === codes.barcode)) {
      throw new Error('Barcode already in use');
    }
  }

  async createProduct(
    businessId: string,
    _userId: string,
    input: CreateProductInput,
  ): Promise<Product> {
    const sku = input.sku?.trim() || null;
    const barcode = input.barcode?.trim() || null;
    await this.assertCodesFree(businessId, { sku, barcode });

    const now = new Date().toISOString();
    const product: Product = {
      id: uuid(),
      businessId,
      categoryId: input.categoryId ?? null,
      name: input.name.trim(),
      sku,
      barcode,
      unit: input.unit ?? 'pcs',
      purchasePrice: Math.abs(input.purchasePrice ?? 0),
      sellingPrice: Math.abs(input.sellingPrice ?? 0),
      // Opening stock only — no 'opening' movement, or it would double count.
      openingStock: input.openingStock ?? 0,
      lowStockThreshold: Math.abs(input.lowStockThreshold ?? 0),
      photoUrl: input.photoUrl ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    return idb.put('products', product);
  }

  async updateProduct(id: string, patch: Partial<CreateProductInput>): Promise<Product> {
    const existing = await idb.get<Product>('products', id);
    if (!existing) throw new Error('Product not found');
    const sku = patch.sku !== undefined ? patch.sku?.trim() || null : existing.sku;
    const barcode = patch.barcode !== undefined ? patch.barcode?.trim() || null : existing.barcode;
    await this.assertCodesFree(existing.businessId, { sku, barcode }, id);

    const updated: Product = {
      ...existing,
      ...patch,
      sku,
      barcode,
      name: patch.name?.trim() ?? existing.name,
      purchasePrice:
        patch.purchasePrice != null ? Math.abs(patch.purchasePrice) : existing.purchasePrice,
      sellingPrice: patch.sellingPrice != null ? Math.abs(patch.sellingPrice) : existing.sellingPrice,
      lowStockThreshold:
        patch.lowStockThreshold != null
          ? Math.abs(patch.lowStockThreshold)
          : existing.lowStockThreshold,
      updatedAt: new Date().toISOString(),
    };
    return idb.put('products', updated);
  }

  async deleteProduct(id: string): Promise<void> {
    const existing = await idb.get<Product>('products', id);
    if (!existing) return;
    // Archive rather than delete, matching the Supabase backend: stock movements
    // and past product profit stay intact and reports don't develop holes.
    await idb.put('products', { ...existing, archived: true, updatedAt: new Date().toISOString() });
  }

  /* ── Stock movements ────────────────────────────────────── */
  async listStockMovements(
    businessId: string,
    query: StockMovementQuery = {},
  ): Promise<StockMovement[]> {
    let rows = await idb.getByIndex<StockMovement>('stockMovements', 'businessId', businessId);
    rows = rows.filter((m) => !m.deletedAt);
    if (query.productId) rows = rows.filter((m) => m.productId === query.productId);
    if (query.type) rows = rows.filter((m) => m.type === query.type);
    if (query.reason) rows = rows.filter((m) => m.reason === query.reason);
    if (query.from) rows = rows.filter((m) => m.occurredAt >= query.from!);
    if (query.to) rows = rows.filter((m) => m.occurredAt <= query.to! + 'T23:59:59.999Z');
    rows.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    const offset = query.offset ?? 0;
    const limit = query.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async createStockMovement(
    businessId: string,
    userId: string,
    input: CreateStockMovementInput,
  ): Promise<StockMovement> {
    if (input.clientId) {
      const all = await idb.getByIndex<StockMovement>('stockMovements', 'businessId', businessId);
      const dup = all.find((m) => m.clientId === input.clientId);
      if (dup) return dup;
    }
    const now = new Date().toISOString();
    const movement: StockMovement = {
      id: uuid(),
      businessId,
      productId: input.productId,
      type: input.type,
      reason: input.reason ?? 'adjust',
      quantity: Math.abs(input.quantity),
      unitCost: input.unitCost ?? null,
      unitPrice: input.unitPrice ?? null,
      note: input.note ?? null,
      refType: input.refType ?? 'manual',
      refId: input.refId ?? null,
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
      createdBy: userId,
      pending: !this.isOnline(),
      clientId: input.clientId,
      deletedAt: null,
    };
    return idb.put('stockMovements', movement);
  }

  async updateStockMovement(
    id: string,
    patch: Partial<CreateStockMovementInput>,
  ): Promise<StockMovement> {
    const existing = await idb.get<StockMovement>('stockMovements', id);
    if (!existing) throw new Error('Stock movement not found');
    const updated: StockMovement = {
      ...existing,
      ...patch,
      quantity: patch.quantity != null ? Math.abs(patch.quantity) : existing.quantity,
    };
    return idb.put('stockMovements', updated);
  }

  async deleteStockMovement(id: string): Promise<void> {
    const existing = await idb.get<StockMovement>('stockMovements', id);
    if (!existing) return;
    // Soft delete: stock recomputes ignoring it, audit trail survives.
    await idb.put('stockMovements', { ...existing, deletedAt: new Date().toISOString() });
  }

  /* ── Offline outbox ─────────────────────────────────────── */
  async getPendingCount(): Promise<number> {
    const [txns, expenses, movements] = await Promise.all([
      idb.getAll<Transaction>('transactions'),
      idb.getAll<Expense>('expenses'),
      idb.getAll<StockMovement>('stockMovements'),
    ]);
    return (
      txns.filter((t) => t.pending).length +
      expenses.filter((e) => e.pending).length +
      movements.filter((m) => m.pending).length
    );
  }

  async flushOutbox(): Promise<void> {
    if (!this.isOnline()) return;
    const [txns, expenses, movements] = await Promise.all([
      idb.getAll<Transaction>('transactions'),
      idb.getAll<Expense>('expenses'),
      idb.getAll<StockMovement>('stockMovements'),
    ]);
    await Promise.all([
      ...txns.filter((t) => t.pending).map((t) => idb.put('transactions', { ...t, pending: false })),
      ...expenses.filter((e) => e.pending).map((e) => idb.put('expenses', { ...e, pending: false })),
      ...movements
        .filter((m) => m.pending)
        .map((m) => idb.put('stockMovements', { ...m, pending: false })),
    ]);
  }

  /* ── Local utilities ────────────────────────────────────── */
  async loadSample(businessId: string, userId: string): Promise<void> {
    const { parties, transactions, expenses } = buildSeed(businessId, userId);
    await Promise.all([
      ...parties.map((p) => idb.put('parties', p)),
      ...transactions.map((t) => idb.put('transactions', t)),
      ...expenses.map((e) => idb.put('expenses', e)),
    ]);
  }

  async exportAll(businessId: string): Promise<unknown> {
    const [parties, transactions, expenses, reminders, categories, products, stockMovements, business] =
      await Promise.all([
        this.listParties(businessId),
        this.listTransactions(businessId),
        this.listExpenses(businessId),
        this.listReminders(businessId),
        this.listProductCategories(businessId),
        this.listProducts(businessId),
        this.listStockMovements(businessId),
        idb.get<Business>('businesses', businessId),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      business,
      parties,
      transactions,
      expenses,
      reminders,
      categories,
      products,
      stockMovements,
    };
  }

  async clearAll(): Promise<void> {
    await idb.clearAll();
  }
}
