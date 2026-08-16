import type {
  Business,
  Expense,
  Party,
  PartyType,
  Profile,
  Reminder,
  Transaction,
} from '@/types';
import { uuid } from '@/utils/id';
import { requireSupabase } from '@/lib/supabase';
import { computeBalance } from './ledger';
import { buildSeed } from './seed';
import type {
  CreateBusinessInput,
  CreateExpenseInput,
  CreatePartyInput,
  CreateReminderInput,
  CreateTransactionInput,
  DataAdapter,
  ExpenseQuery,
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

  // Supabase writes are online & transactional, so there is no local outbox.
  async getPendingCount(): Promise<number> {
    return 0;
  }
  async flushOutbox(): Promise<void> {
    /* no-op */
  }

  async loadSample(businessId: string, userId: string): Promise<void> {
    const { parties, transactions, expenses } = buildSeed(businessId, userId);
    await this.sb.from('parties').insert(
      parties.map((p) => ({
        id: p.id,
        business_id: p.businessId,
        type: p.type,
        name: p.name,
        phone: p.phone,
        address: p.address,
        opening_balance: p.openingBalance,
        credit_limit: p.creditLimit,
        due_date: p.dueDate,
        notes: p.notes,
      })),
    );
    await this.sb.from('transactions').insert(
      transactions.map((t) => ({
        id: t.id,
        business_id: t.businessId,
        party_id: t.partyId,
        party_type: t.partyType,
        type: t.type,
        amount: t.amount,
        note: t.note,
        method: t.method,
        occurred_at: t.occurredAt,
        created_by: t.createdBy,
        previous_balance: t.previousBalance,
        new_balance: t.newBalance,
      })),
    );
    await this.sb.from('expenses').insert(
      expenses.map((e) => ({
        id: e.id,
        business_id: e.businessId,
        amount: e.amount,
        category: e.category,
        note: e.note,
        method: e.method,
        occurred_at: e.occurredAt,
        created_by: e.createdBy,
      })),
    );
  }
}
