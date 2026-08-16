import type { Expense, Party, Transaction } from '@/types';
import { uuid } from '@/utils/id';
import { addDays } from '@/utils/date';
import { ledgerDelta } from './ledger';

interface SeedResult {
  parties: Party[];
  transactions: Transaction[];
  expenses: Expense[];
}

/**
 * Generates a small, realistic set of DEMO data so the app looks alive on
 * first run. This is clearly surfaced as "demo data" in the UI and lives only
 * in the browser (IndexedDB) — it is never presented as real business data.
 */
export function buildSeed(businessId: string, userId: string, now = new Date()): SeedResult {
  const iso = (d: Date) => d.toISOString();
  const parties: Party[] = [];
  const transactions: Transaction[] = [];
  const expenses: Expense[] = [];

  const makeParty = (
    type: Party['type'],
    name: string,
    phone: string | null,
    opts: Partial<Party> = {},
  ): Party => {
    const p: Party = {
      id: uuid(),
      businessId,
      type,
      name,
      phone,
      address: opts.address ?? null,
      photoUrl: null,
      openingBalance: opts.openingBalance ?? 0,
      creditLimit: opts.creditLimit ?? null,
      dueDate: opts.dueDate ?? null,
      notes: opts.notes ?? null,
      createdAt: iso(addDays(now, -120)),
      updatedAt: iso(now),
    };
    parties.push(p);
    return p;
  };

  // Per-party running ledger so stored snapshots stay correct.
  const running = new Map<string, number>();
  const addTxn = (
    party: Party,
    type: Transaction['type'],
    amount: number,
    method: Transaction['method'],
    daysAgo: number,
    note?: string,
  ) => {
    const prev = running.get(party.id) ?? party.openingBalance;
    const next = prev + ledgerDelta(type, amount);
    running.set(party.id, next);
    transactions.push({
      id: uuid(),
      businessId,
      partyId: party.id,
      partyType: party.type,
      type,
      amount,
      note: note ?? null,
      method,
      occurredAt: iso(addDays(now, -daysAgo)),
      createdAt: iso(addDays(now, -daysAgo)),
      createdBy: userId,
      previousBalance: prev,
      newBalance: next,
    });
  };

  // ── Customers ──────────────────────────────────────────────
  const rahim = makeParty('customer', 'রহিম স্টোর', '01712345678', {
    creditLimit: 20000,
    dueDate: iso(addDays(now, -12)).slice(0, 10), // overdue
    address: 'নিউমার্কেট, ঢাকা',
  });
  addTxn(rahim, 'credit_sale', 8000, 'cash', 40, 'চাল ৫ বস্তা');
  addTxn(rahim, 'received', 3000, 'bkash', 30);
  addTxn(rahim, 'credit_sale', 4500, 'cash', 18, 'তেল ও চিনি');
  addTxn(rahim, 'received', 4000, 'nagad', 8);

  const karim = makeParty('customer', 'করিম ট্রেডার্স', '01812345678', {
    creditLimit: 30000,
    dueDate: iso(addDays(now, 2)).slice(0, 10), // due soon
  });
  addTxn(karim, 'credit_sale', 12000, 'cash', 22, 'মাসিক সাপ্লাই');
  addTxn(karim, 'received', 6000, 'bank', 10);

  const ayesha = makeParty('customer', 'আয়েশা এন্টারপ্রাইজ', '01911223344', {
    dueDate: iso(addDays(now, 20)).slice(0, 10),
  });
  addTxn(ayesha, 'credit_sale', 5500, 'cash', 15);
  addTxn(ayesha, 'received', 5500, 'cash', 3, 'সম্পূর্ণ পরিশোধ');

  const sultana = makeParty('customer', 'সুলতানা ভ্যারাইটিজ', '01677889900', {
    creditLimit: 15000,
    dueDate: iso(addDays(now, -3)).slice(0, 10), // just overdue
  });
  addTxn(sultana, 'credit_sale', 9200, 'cash', 26, 'কসমেটিকস');
  addTxn(sultana, 'received', 2000, 'bkash', 14);

  const jamal = makeParty('customer', 'জামাল মিয়া', '01533445566');
  addTxn(jamal, 'credit_sale', 3000, 'cash', 6, 'বাকি');

  const nasir = makeParty('customer', 'নাসির জেনারেল স্টোর', '01744556677', {
    dueDate: iso(addDays(now, 5)).slice(0, 10),
    creditLimit: 25000,
  });
  addTxn(nasir, 'credit_sale', 15000, 'cash', 33, 'পাইকারি অর্ডার');
  addTxn(nasir, 'received', 5000, 'bank', 12);
  addTxn(nasir, 'received', 3000, 'bkash', 4);

  const mitali = makeParty('customer', 'মিতালী শাড়ি ঘর', '01899001122');
  addTxn(mitali, 'credit_sale', 2400, 'cash', 2);

  // ── Suppliers (positive balance = you owe them) ────────────
  const cityDist = makeParty('supplier', 'সিটি ডিস্ট্রিবিউশন', '01710002000', {
    dueDate: iso(addDays(now, -5)).slice(0, 10),
  });
  addTxn(cityDist, 'credit_sale', 25000, 'cash', 20, 'মাল ক্রয়');
  addTxn(cityDist, 'paid', 10000, 'bank', 9);

  const bengalWhole = makeParty('supplier', 'বেঙ্গল হোলসেল', '01820003000', {
    dueDate: iso(addDays(now, 7)).slice(0, 10),
  });
  addTxn(bengalWhole, 'credit_sale', 18000, 'cash', 16);
  addTxn(bengalWhole, 'paid', 8000, 'nagad', 5);

  const padmaAgency = makeParty('supplier', 'পদ্মা এজেন্সি', '01930004000');
  addTxn(padmaAgency, 'credit_sale', 9000, 'cash', 11);
  addTxn(padmaAgency, 'paid', 9000, 'bank', 3, 'পূর্ণ পরিশোধ');

  // ── Today's activity (so the dashboard shows movement) ─────
  addTxn(karim, 'received', 2500, 'bkash', 0, 'আজকের কিস্তি');
  addTxn(rahim, 'received', 1000, 'cash', 0);

  // ── Expenses across categories & months ───────────────────
  const addExpense = (
    amount: number,
    category: Expense['category'],
    method: Expense['method'],
    daysAgo: number,
    note?: string,
  ) => {
    expenses.push({
      id: uuid(),
      businessId,
      amount,
      category,
      note: note ?? null,
      method,
      occurredAt: iso(addDays(now, -daysAgo)),
      createdAt: iso(addDays(now, -daysAgo)),
      createdBy: userId,
      receiptUrl: null,
    });
  };
  addExpense(12000, 'rent', 'cash', 5, 'দোকান ভাড়া');
  addExpense(3200, 'electricity', 'bank', 7);
  addExpense(8000, 'salary', 'cash', 6, 'কর্মচারী বেতন');
  addExpense(1500, 'transport', 'cash', 2);
  addExpense(2300, 'food', 'cash', 0, 'দুপুরের খাবার');
  addExpense(11500, 'rent', 'cash', 35);
  addExpense(3000, 'electricity', 'bank', 38);
  addExpense(8000, 'salary', 'cash', 36);
  addExpense(4200, 'maintenance', 'cash', 70, 'ফ্রিজ মেরামত');
  addExpense(11500, 'rent', 'cash', 66);

  return { parties, transactions, expenses };
}
