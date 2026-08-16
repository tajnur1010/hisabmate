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
import { idb } from './db';
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

  /* ── Offline outbox ─────────────────────────────────────── */
  async getPendingCount(): Promise<number> {
    const [txns, expenses] = await Promise.all([
      idb.getAll<Transaction>('transactions'),
      idb.getAll<Expense>('expenses'),
    ]);
    return txns.filter((t) => t.pending).length + expenses.filter((e) => e.pending).length;
  }

  async flushOutbox(): Promise<void> {
    if (!this.isOnline()) return;
    const [txns, expenses] = await Promise.all([
      idb.getAll<Transaction>('transactions'),
      idb.getAll<Expense>('expenses'),
    ]);
    await Promise.all([
      ...txns.filter((t) => t.pending).map((t) => idb.put('transactions', { ...t, pending: false })),
      ...expenses.filter((e) => e.pending).map((e) => idb.put('expenses', { ...e, pending: false })),
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
    const [parties, transactions, expenses, reminders, business] = await Promise.all([
      this.listParties(businessId),
      this.listTransactions(businessId),
      this.listExpenses(businessId),
      this.listReminders(businessId),
      idb.get<Business>('businesses', businessId),
    ]);
    return { exportedAt: new Date().toISOString(), business, parties, transactions, expenses, reminders };
  }

  async clearAll(): Promise<void> {
    await idb.clearAll();
  }
}
