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
import { requireSupabase } from '@/lib/supabase';
import { computeBalance } from './ledger';
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

/* Row shapes as stored in Postgres (snake_case). */
type PartyRow = {
  id: string;
  business_id: string;
  type: PartyType;
  name: string;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  opening_balance: number;
  credit_limit: number | null;
  due_date: string | null;
  notes: string | null;
  archived: boolean | null;
  created_at: string;
  updated_at: string;
};

type TxnRow = {
  id: string;
  business_id: string;
  party_id: string | null;
  party_type: PartyType | null;
  type: Transaction['type'];
  amount: number;
  note: string | null;
  method: Transaction['method'];
  occurred_at: string;
  created_at: string;
  created_by: string;
  previous_balance: number;
  new_balance: number;
  client_id: string | null;
  deleted_at: string | null;
};

type ExpenseRow = {
  id: string;
  business_id: string;
  amount: number;
  category: Expense['category'];
  note: string | null;
  method: Expense['method'];
  occurred_at: string;
  receipt_url: string | null;
  created_at: string;
  created_by: string;
  client_id: string | null;
  deleted_at: string | null;
};

const toParty = (r: PartyRow): Party => ({
  id: r.id,
  businessId: r.business_id,
  type: r.type,
  name: r.name,
  phone: r.phone,
  address: r.address,
  photoUrl: r.photo_url,
  openingBalance: Number(r.opening_balance) || 0,
  creditLimit: r.credit_limit,
  dueDate: r.due_date,
  notes: r.notes,
  archived: r.archived ?? false,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toTxn = (r: TxnRow): Transaction => ({
  id: r.id,
  businessId: r.business_id,
  partyId: r.party_id,
  partyType: r.party_type,
  type: r.type,
  amount: Number(r.amount) || 0,
  note: r.note,
  method: r.method,
  occurredAt: r.occurred_at,
  createdAt: r.created_at,
  createdBy: r.created_by,
  previousBalance: Number(r.previous_balance) || 0,
  newBalance: Number(r.new_balance) || 0,
  clientId: r.client_id ?? undefined,
  deletedAt: r.deleted_at,
});

const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  businessId: r.business_id,
  amount: Number(r.amount) || 0,
  category: r.category,
  note: r.note,
  method: r.method,
  occurredAt: r.occurred_at,
  receiptUrl: r.receipt_url,
  createdAt: r.created_at,
  createdBy: r.created_by,
  clientId: r.client_id ?? undefined,
  deletedAt: r.deleted_at,
});

type ProductCategoryRow = {
  id: string;
  business_id: string;
  name: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: Product['unit'];
  purchase_price: number;
  selling_price: number;
  opening_stock: number;
  low_stock_threshold: number;
  photo_url: string | null;
  notes: string | null;
  archived: boolean | null;
  created_at: string;
  updated_at: string;
};

type StockMovementRow = {
  id: string;
  business_id: string;
  product_id: string;
  type: StockMovement['type'];
  reason: StockMovement['reason'];
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  note: string | null;
  ref_type: StockMovement['refType'];
  ref_id: string | null;
  occurred_at: string;
  created_at: string;
  created_by: string;
  client_id: string | null;
  deleted_at: string | null;
};

const toProductCategory = (r: ProductCategoryRow): ProductCategory => ({
  id: r.id,
  businessId: r.business_id,
  name: r.name,
  createdAt: r.created_at,
});

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  businessId: r.business_id,
  categoryId: r.category_id,
  name: r.name,
  sku: r.sku,
  barcode: r.barcode,
  unit: r.unit,
  purchasePrice: Number(r.purchase_price) || 0,
  sellingPrice: Number(r.selling_price) || 0,
  openingStock: Number(r.opening_stock) || 0,
  lowStockThreshold: Number(r.low_stock_threshold) || 0,
  photoUrl: r.photo_url,
  notes: r.notes,
  archived: r.archived ?? false,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toStockMovement = (r: StockMovementRow): StockMovement => ({
  id: r.id,
  businessId: r.business_id,
  productId: r.product_id,
  type: r.type,
  reason: r.reason,
  quantity: Number(r.quantity) || 0,
  unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  note: r.note,
  refType: r.ref_type,
  refId: r.ref_id,
  occurredAt: r.occurred_at,
  createdAt: r.created_at,
  createdBy: r.created_by,
  clientId: r.client_id ?? undefined,
  deletedAt: r.deleted_at,
});

/**
 * Live backend. Every query is scoped by business and further protected by
 * Row-Level Security in Postgres (see supabase/migrations). Balances are still
 * computed by the shared ledger engine to keep one source of truth.
 */
export class SupabaseAdapter implements DataAdapter {
  readonly kind = 'supabase' as const;
  private get sb() {
    return requireSupabase();
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const { data } = await this.sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!data) return null;
    return { id: data.id, email: data.email, fullName: data.full_name, avatarUrl: data.avatar_url, createdAt: data.created_at };
  }

  async ensureProfile(userId: string, email: string | null, fullName: string): Promise<Profile> {
    const { data, error } = await this.sb
      .from('profiles')
      .upsert({ id: userId, email, full_name: fullName }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, email: data.email, fullName: data.full_name, avatarUrl: data.avatar_url, createdAt: data.created_at };
  }

  async listBusinesses(userId: string): Promise<Business[]> {
    const { data, error } = await this.sb.from('businesses').select('*').eq('owner_id', userId);
    if (error) throw error;
    return (data ?? []).map((b) => ({
      id: b.id,
      ownerId: b.owner_id,
      name: b.name,
      ownerName: b.owner_name,
      phone: b.phone,
      address: b.address,
      logoUrl: b.logo_url,
      currency: b.currency,
      language: b.language,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }));
  }

  async createBusiness(userId: string, input: CreateBusinessInput): Promise<Business> {
    const { data, error } = await this.sb
      .from('businesses')
      .insert({
        owner_id: userId,
        name: input.name,
        owner_name: input.ownerName,
        phone: input.phone ?? null,
        address: input.address ?? null,
        logo_url: input.logoUrl ?? null,
        currency: input.currency,
        language: input.language,
      })
      .select()
      .single();
    if (error) throw error;
    await this.sb.from('business_members').insert({ business_id: data.id, user_id: userId, role: 'owner' });
    return {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      ownerName: data.owner_name,
      phone: data.phone,
      address: data.address,
      logoUrl: data.logo_url,
      currency: data.currency,
      language: data.language,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateBusiness(id: string, patch: Partial<CreateBusinessInput>): Promise<Business> {
    const { data, error } = await this.sb
      .from('businesses')
      .update({
        name: patch.name,
        owner_name: patch.ownerName,
        phone: patch.phone,
        address: patch.address,
        logo_url: patch.logoUrl,
        currency: patch.currency,
        language: patch.language,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      ownerName: data.owner_name,
      phone: data.phone,
      address: data.address,
      logoUrl: data.logo_url,
      currency: data.currency,
      language: data.language,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listParties(businessId: string, type?: PartyType): Promise<Party[]> {
    let q = this.sb.from('parties').select('*').eq('business_id', businessId).neq('archived', true);
    if (type) q = q.eq('type', type);
    const { data, error } = await q;
    if (error) throw error;
    return (data as PartyRow[]).map(toParty);
  }

  async getParty(id: string): Promise<Party | null> {
    const { data } = await this.sb.from('parties').select('*').eq('id', id).maybeSingle();
    return data ? toParty(data as PartyRow) : null;
  }

  async createParty(businessId: string, _userId: string, input: CreatePartyInput): Promise<Party> {
    const { data, error } = await this.sb
      .from('parties')
      .insert({
        business_id: businessId,
        type: input.type,
        name: input.name.trim(),
        phone: input.phone ?? null,
        address: input.address ?? null,
        photo_url: input.photoUrl ?? null,
        opening_balance: input.openingBalance ?? 0,
        credit_limit: input.creditLimit ?? null,
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return toParty(data as PartyRow);
  }

  async updateParty(id: string, patch: Partial<CreatePartyInput>): Promise<Party> {
    const { data, error } = await this.sb
      .from('parties')
      .update({
        name: patch.name,
        phone: patch.phone,
        address: patch.address,
        photo_url: patch.photoUrl,
        opening_balance: patch.openingBalance,
        credit_limit: patch.creditLimit,
        due_date: patch.dueDate,
        notes: patch.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toParty(data as PartyRow);
  }

  async deleteParty(id: string): Promise<void> {
    const { error } = await this.sb.from('parties').update({ archived: true }).eq('id', id);
    if (error) throw error;
  }

  async listTransactions(businessId: string, query: TransactionQuery = {}): Promise<Transaction[]> {
    let q = this.sb
      .from('transactions')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false });
    if (query.partyId) q = q.eq('party_id', query.partyId);
    if (query.type) q = q.eq('type', query.type);
    if (query.from) q = q.gte('occurred_at', query.from);
    if (query.to) q = q.lte('occurred_at', query.to + 'T23:59:59.999Z');
    if (query.limit != null) q = q.range(query.offset ?? 0, (query.offset ?? 0) + query.limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return (data as TxnRow[]).map(toTxn);
  }

  async createTransaction(
    businessId: string,
    userId: string,
    input: CreateTransactionInput,
  ): Promise<Transaction> {
    if (input.clientId) {
      const { data: existing } = await this.sb
        .from('transactions')
        .select('*')
        .eq('client_id', input.clientId)
        .maybeSingle();
      if (existing) return toTxn(existing as TxnRow);
    }

    let previousBalance = 0;
    if (input.partyId) {
      const party = await this.getParty(input.partyId);
      const partyTxns = await this.listTransactions(businessId, { partyId: input.partyId });
      previousBalance = party ? computeBalance(party, partyTxns) : 0;
    }
    const delta = input.type === 'credit_sale' ? Math.abs(input.amount) : -Math.abs(input.amount);

    const { data, error } = await this.sb
      .from('transactions')
      .insert({
        business_id: businessId,
        party_id: input.partyId,
        party_type: input.partyType,
        type: input.type,
        amount: Math.abs(input.amount),
        note: input.note ?? null,
        method: input.method,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        created_by: userId,
        previous_balance: previousBalance,
        new_balance: previousBalance + delta,
        client_id: input.clientId ?? uuid(),
      })
      .select()
      .single();
    if (error) throw error;
    return toTxn(data as TxnRow);
  }

  async updateTransaction(id: string, patch: Partial<CreateTransactionInput>): Promise<Transaction> {
    const { data, error } = await this.sb
      .from('transactions')
      .update({
        amount: patch.amount != null ? Math.abs(patch.amount) : undefined,
        note: patch.note,
        method: patch.method,
        occurred_at: patch.occurredAt,
        type: patch.type,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toTxn(data as TxnRow);
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.sb
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async listExpenses(businessId: string, query: ExpenseQuery = {}): Promise<Expense[]> {
    let q = this.sb
      .from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false });
    if (query.category) q = q.eq('category', query.category);
    if (query.from) q = q.gte('occurred_at', query.from);
    if (query.to) q = q.lte('occurred_at', query.to + 'T23:59:59.999Z');
    if (query.limit != null) q = q.range(query.offset ?? 0, (query.offset ?? 0) + query.limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return (data as ExpenseRow[]).map(toExpense);
  }

  async createExpense(businessId: string, userId: string, input: CreateExpenseInput): Promise<Expense> {
    if (input.clientId) {
      const { data: existing } = await this.sb
        .from('expenses')
        .select('*')
        .eq('client_id', input.clientId)
        .maybeSingle();
      if (existing) return toExpense(existing as ExpenseRow);
    }
    const { data, error } = await this.sb
      .from('expenses')
      .insert({
        business_id: businessId,
        amount: Math.abs(input.amount),
        category: input.category,
        note: input.note ?? null,
        method: input.method,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        receipt_url: input.receiptUrl ?? null,
        created_by: userId,
        client_id: input.clientId ?? uuid(),
      })
      .select()
      .single();
    if (error) throw error;
    return toExpense(data as ExpenseRow);
  }

  async updateExpense(id: string, patch: Partial<CreateExpenseInput>): Promise<Expense> {
    const { data, error } = await this.sb
      .from('expenses')
      .update({
        amount: patch.amount != null ? Math.abs(patch.amount) : undefined,
        category: patch.category,
        note: patch.note,
        method: patch.method,
        occurred_at: patch.occurredAt,
        receipt_url: patch.receiptUrl,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toExpense(data as ExpenseRow);
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await this.sb
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async listReminders(businessId: string, partyId?: string): Promise<Reminder[]> {
    let q = this.sb
      .from('reminders')
      .select('*')
      .eq('business_id', businessId)
      .order('sent_at', { ascending: false });
    if (partyId) q = q.eq('party_id', partyId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      businessId: r.business_id,
      partyId: r.party_id,
      message: r.message,
      channel: r.channel,
      sentAt: r.sent_at,
      createdBy: r.created_by,
    }));
  }

  async createReminder(businessId: string, userId: string, input: CreateReminderInput): Promise<Reminder> {
    const { data, error } = await this.sb
      .from('reminders')
      .insert({
        business_id: businessId,
        party_id: input.partyId,
        message: input.message,
        channel: input.channel,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      businessId: data.business_id,
      partyId: data.party_id,
      message: data.message,
      channel: data.channel,
      sentAt: data.sent_at,
      createdBy: data.created_by,
    };
  }

  /* ── Product categories ─────────────────────────────────── */
  async listProductCategories(businessId: string): Promise<ProductCategory[]> {
    const { data, error } = await this.sb
      .from('product_categories')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data as ProductCategoryRow[]).map(toProductCategory);
  }

  async createProductCategory(
    businessId: string,
    input: CreateProductCategoryInput,
  ): Promise<ProductCategory> {
    const { data, error } = await this.sb
      .from('product_categories')
      .insert({ business_id: businessId, name: input.name.trim() })
      .select()
      .single();
    if (error) throw error;
    return toProductCategory(data as ProductCategoryRow);
  }

  async updateProductCategory(
    id: string,
    patch: CreateProductCategoryInput,
  ): Promise<ProductCategory> {
    const { data, error } = await this.sb
      .from('product_categories')
      .update({ name: patch.name.trim() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toProductCategory(data as ProductCategoryRow);
  }

  async deleteProductCategory(id: string): Promise<void> {
    // Products keep existing, uncategorised — the FK is ON DELETE SET NULL.
    const { error } = await this.sb.from('product_categories').delete().eq('id', id);
    if (error) throw error;
  }

  /* ── Products ───────────────────────────────────────────── */
  async listProducts(businessId: string, query: ProductQuery = {}): Promise<Product[]> {
    let q = this.sb
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .neq('archived', true)
      .order('name', { ascending: true });
    if (query.categoryId) q = q.eq('category_id', query.categoryId);
    if (query.search) {
      const needle = query.search.trim().replace(/[%,]/g, '');
      if (needle) q = q.or(`name.ilike.%${needle}%,sku.ilike.%${needle}%,barcode.ilike.%${needle}%`);
    }
    if (query.limit != null) q = q.range(query.offset ?? 0, (query.offset ?? 0) + query.limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return (data as ProductRow[]).map(toProduct);
  }

  async getProduct(id: string): Promise<Product | null> {
    const { data } = await this.sb.from('products').select('*').eq('id', id).maybeSingle();
    return data ? toProduct(data as ProductRow) : null;
  }

  async findProductByCode(businessId: string, code: string): Promise<Product | null> {
    const needle = code.trim();
    if (!needle) return null;
    // Barcode wins over SKU — a scanner always reads a barcode.
    const { data: byBarcode } = await this.sb
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('barcode', needle)
      .neq('archived', true)
      .maybeSingle();
    if (byBarcode) return toProduct(byBarcode as ProductRow);

    const { data: bySku } = await this.sb
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('sku', needle)
      .neq('archived', true)
      .maybeSingle();
    return bySku ? toProduct(bySku as ProductRow) : null;
  }

  async createProduct(
    businessId: string,
    _userId: string,
    input: CreateProductInput,
  ): Promise<Product> {
    const { data, error } = await this.sb
      .from('products')
      .insert({
        business_id: businessId,
        category_id: input.categoryId ?? null,
        name: input.name.trim(),
        sku: input.sku?.trim() || null,
        barcode: input.barcode?.trim() || null,
        unit: input.unit ?? 'pcs',
        purchase_price: Math.abs(input.purchasePrice ?? 0),
        selling_price: Math.abs(input.sellingPrice ?? 0),
        // Opening stock only — writing an 'opening' movement too would double count.
        opening_stock: input.openingStock ?? 0,
        low_stock_threshold: Math.abs(input.lowStockThreshold ?? 0),
        photo_url: input.photoUrl ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return toProduct(data as ProductRow);
  }

  async updateProduct(id: string, patch: Partial<CreateProductInput>): Promise<Product> {
    const { data, error } = await this.sb
      .from('products')
      .update({
        category_id: patch.categoryId,
        name: patch.name?.trim(),
        sku: patch.sku !== undefined ? patch.sku?.trim() || null : undefined,
        barcode: patch.barcode !== undefined ? patch.barcode?.trim() || null : undefined,
        unit: patch.unit,
        purchase_price: patch.purchasePrice != null ? Math.abs(patch.purchasePrice) : undefined,
        selling_price: patch.sellingPrice != null ? Math.abs(patch.sellingPrice) : undefined,
        opening_stock: patch.openingStock,
        low_stock_threshold:
          patch.lowStockThreshold != null ? Math.abs(patch.lowStockThreshold) : undefined,
        photo_url: patch.photoUrl,
        notes: patch.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toProduct(data as ProductRow);
  }

  async deleteProduct(id: string): Promise<void> {
    // Archive rather than delete: stock movements and past profit stay intact.
    const { error } = await this.sb.from('products').update({ archived: true }).eq('id', id);
    if (error) throw error;
  }

  /* ── Stock movements ────────────────────────────────────── */
  async listStockMovements(
    businessId: string,
    query: StockMovementQuery = {},
  ): Promise<StockMovement[]> {
    let q = this.sb
      .from('stock_movements')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false });
    if (query.productId) q = q.eq('product_id', query.productId);
    if (query.type) q = q.eq('type', query.type);
    if (query.reason) q = q.eq('reason', query.reason);
    if (query.from) q = q.gte('occurred_at', query.from);
    if (query.to) q = q.lte('occurred_at', query.to + 'T23:59:59.999Z');
    if (query.limit != null) q = q.range(query.offset ?? 0, (query.offset ?? 0) + query.limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return (data as StockMovementRow[]).map(toStockMovement);
  }

  async createStockMovement(
    businessId: string,
    userId: string,
    input: CreateStockMovementInput,
  ): Promise<StockMovement> {
    if (input.clientId) {
      const { data: existing } = await this.sb
        .from('stock_movements')
        .select('*')
        .eq('client_id', input.clientId)
        .maybeSingle();
      if (existing) return toStockMovement(existing as StockMovementRow);
    }
    const { data, error } = await this.sb
      .from('stock_movements')
      .insert({
        business_id: businessId,
        product_id: input.productId,
        type: input.type,
        reason: input.reason ?? 'adjust',
        quantity: Math.abs(input.quantity),
        unit_cost: input.unitCost ?? null,
        unit_price: input.unitPrice ?? null,
        note: input.note ?? null,
        ref_type: input.refType ?? 'manual',
        ref_id: input.refId ?? null,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        created_by: userId,
        client_id: input.clientId ?? uuid(),
      })
      .select()
      .single();
    if (error) throw error;
    return toStockMovement(data as StockMovementRow);
  }

  async updateStockMovement(
    id: string,
    patch: Partial<CreateStockMovementInput>,
  ): Promise<StockMovement> {
    const { data, error } = await this.sb
      .from('stock_movements')
      .update({
        type: patch.type,
        reason: patch.reason,
        quantity: patch.quantity != null ? Math.abs(patch.quantity) : undefined,
        unit_cost: patch.unitCost,
        unit_price: patch.unitPrice,
        note: patch.note,
        occurred_at: patch.occurredAt,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toStockMovement(data as StockMovementRow);
  }

  async deleteStockMovement(id: string): Promise<void> {
    const { error } = await this.sb
      .from('stock_movements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  // Supabase writes are online & transactional, so there is no local outbox.
  async getPendingCount(): Promise<number> {
    return 0;
  }
  async flushOutbox(): Promise<void> {
    /* no-op */
  }
}
