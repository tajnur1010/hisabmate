import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  Business,
  Expense,
  Party,
  PartyType,
  PartyWithBalance,
  Reminder,
  Transaction,
} from '@/types';
import { getAdapter } from '@/services';
import type {
  CreateBusinessInput,
  CreateExpenseInput,
  CreatePartyInput,
  CreateReminderInput,
  CreateTransactionInput,
} from '@/services/adapter';
import {
  computeBalance,
  computeLedgerRows,
  groupTransactionsByParty,
  withBalances,
} from '@/services/ledger';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

interface DataContextValue {
  /** Initial bootstrap finished (profile + business + first data load). */
  ready: boolean;
  /** A background reload is in flight. */
  loading: boolean;
  error: string | null;

  business: Business | null;
  hasBusiness: boolean;
  adapterKind: 'mock' | 'supabase';

  parties: Party[];
  partiesWithBalance: PartyWithBalance[];
  customers: PartyWithBalance[];
  suppliers: PartyWithBalance[];
  transactions: Transaction[];
  expenses: Expense[];
  txnsByParty: Map<string, Transaction[]>;

  refresh: () => Promise<void>;

  createBusiness: (input: CreateBusinessInput) => Promise<Business>;
  updateBusiness: (patch: Partial<CreateBusinessInput>) => Promise<void>;

  createParty: (input: CreatePartyInput) => Promise<Party>;
  updateParty: (id: string, patch: Partial<CreatePartyInput>) => Promise<Party>;
  deleteParty: (id: string) => Promise<void>;
  getPartyById: (id: string) => PartyWithBalance | undefined;
  partyTransactions: (partyId: string) => Transaction[];
  partyLedger: (partyId: string) => ReturnType<typeof computeLedgerRows>;

  createTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  updateTransaction: (id: string, patch: Partial<CreateTransactionInput>) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;

  createExpense: (input: CreateExpenseInput) => Promise<Expense>;
  updateExpense: (id: string, patch: Partial<CreateExpenseInput>) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;

  createReminder: (input: CreateReminderInput) => Promise<Reminder>;

  loadSample: () => Promise<void>;
  clearData: () => Promise<void>;
  exportAll: () => Promise<unknown>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const adapter = getAdapter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [business, setBusiness] = useState<Business | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Guards against writes before a business exists and against stale reloads.
  const businessRef = useRef<Business | null>(null);
  businessRef.current = business;

  const loadData = useCallback(
    async (businessId: string) => {
      const [p, t, e] = await Promise.all([
        adapter.listParties(businessId),
        adapter.listTransactions(businessId),
        adapter.listExpenses(businessId),
      ]);
      setParties(p);
      setTransactions(t);
      setExpenses(e);
    },
    [adapter],
  );

  const bootstrap = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await adapter.ensureProfile(user.id, user.email, user.fullName);
      const businesses = await adapter.listBusinesses(user.id);
      const biz = businesses[0] ?? null;
      setBusiness(biz);
      if (biz) await loadData(biz.id);
      else {
        setParties([]);
        setTransactions([]);
        setExpenses([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setReady(true);
      setLoading(false);
    }
  }, [adapter, user, loadData]);

  // Re-bootstrap whenever the signed-in user changes.
  useEffect(() => {
    if (!user) {
      setBusiness(null);
      setParties([]);
      setTransactions([]);
      setExpenses([]);
      setReady(false);
      return;
    }
    void bootstrap();
  }, [user, bootstrap]);

  // After the offline outbox flushes on reconnect, pull fresh data.
  useEffect(() => {
    const onSynced = () => {
      const biz = businessRef.current;
      if (biz) void loadData(biz.id);
    };
    window.addEventListener('hisab:synced', onSynced);
    return () => window.removeEventListener('hisab:synced', onSynced);
  }, [loadData]);

  const refresh = useCallback(async () => {
    const biz = businessRef.current;
    if (!biz) {
      await bootstrap();
      return;
    }
    setLoading(true);
    try {
      await loadData(biz.id);
    } finally {
      setLoading(false);
    }
  }, [bootstrap, loadData]);

  /* Helpers that require an active business + user. */
  const requireContext = useCallback(() => {
    if (!user) throw new Error('Not signed in');
    const biz = businessRef.current;
    if (!biz) throw new Error('No business selected');
    return { userId: user.id, businessId: biz.id };
  }, [user]);

  /* ── Business ─────────────────────────────────────────────────────────── */
  const createBusiness = useCallback<DataContextValue['createBusiness']>(
    async (input) => {
      if (!user) throw new Error('Not signed in');
      const biz = await adapter.createBusiness(user.id, input);
      setBusiness(biz);
      await loadData(biz.id);
      return biz;
    },
    [adapter, user, loadData],
  );

  const updateBusiness = useCallback<DataContextValue['updateBusiness']>(
    async (patch) => {
      const biz = businessRef.current;
      if (!biz) throw new Error('No business selected');
      const updated = await adapter.updateBusiness(biz.id, patch);
      setBusiness(updated);
    },
    [adapter],
  );

  /* ── Parties ──────────────────────────────────────────────────────────── */
  const createParty = useCallback<DataContextValue['createParty']>(
    async (input) => {
      const { userId, businessId } = requireContext();
      const party = await adapter.createParty(businessId, userId, input);
      await loadData(businessId);
      return party;
    },
    [adapter, requireContext, loadData],
  );

  const updateParty = useCallback<DataContextValue['updateParty']>(
    async (id, patch) => {
      const { businessId } = requireContext();
      const party = await adapter.updateParty(id, patch);
      await loadData(businessId);
      return party;
    },
    [adapter, requireContext, loadData],
  );

  const deleteParty = useCallback<DataContextValue['deleteParty']>(
    async (id) => {
      const { businessId } = requireContext();
      await adapter.deleteParty(id);
      await loadData(businessId);
    },
    [adapter, requireContext, loadData],
  );

  /* ── Transactions ─────────────────────────────────────────────────────── */
  const createTransaction = useCallback<DataContextValue['createTransaction']>(
    async (input) => {
      const { userId, businessId } = requireContext();
      if (!(Math.abs(input.amount) > 0)) throw new Error('Amount must be greater than zero');
      const txn = await adapter.createTransaction(businessId, userId, input);
      await loadData(businessId);
      return txn;
    },
    [adapter, requireContext, loadData],
  );

  const updateTransaction = useCallback<DataContextValue['updateTransaction']>(
    async (id, patch) => {
      const { businessId } = requireContext();
      const txn = await adapter.updateTransaction(id, patch);
      await loadData(businessId);
      return txn;
    },
    [adapter, requireContext, loadData],
  );

  const deleteTransaction = useCallback<DataContextValue['deleteTransaction']>(
    async (id) => {
      const { businessId } = requireContext();
      await adapter.deleteTransaction(id);
      await loadData(businessId);
    },
    [adapter, requireContext, loadData],
  );

  /* ── Expenses ─────────────────────────────────────────────────────────── */
  const createExpense = useCallback<DataContextValue['createExpense']>(
    async (input) => {
      const { userId, businessId } = requireContext();
      if (!(Math.abs(input.amount) > 0)) throw new Error('Amount must be greater than zero');
      const expense = await adapter.createExpense(businessId, userId, input);
      await loadData(businessId);
      return expense;
    },
    [adapter, requireContext, loadData],
  );

  const updateExpense = useCallback<DataContextValue['updateExpense']>(
    async (id, patch) => {
      const { businessId } = requireContext();
      const expense = await adapter.updateExpense(id, patch);
      await loadData(businessId);
      return expense;
    },
    [adapter, requireContext, loadData],
  );

  const deleteExpense = useCallback<DataContextValue['deleteExpense']>(
    async (id) => {
      const { businessId } = requireContext();
      await adapter.deleteExpense(id);
      await loadData(businessId);
    },
    [adapter, requireContext, loadData],
  );

  /* ── Reminders ────────────────────────────────────────────────────────── */
  const createReminder = useCallback<DataContextValue['createReminder']>(
    async (input) => {
      const { userId, businessId } = requireContext();
      return adapter.createReminder(businessId, userId, input);
    },
    [adapter, requireContext],
  );

  /* ── Utilities (sample data / export / wipe) ──────────────────────────── */
  const loadSample = useCallback(async () => {
    const { userId, businessId } = requireContext();
    if (!adapter.loadSample) throw new Error('Sample data is not available on this backend');
    await adapter.loadSample(businessId, userId);
    await loadData(businessId);
  }, [adapter, requireContext, loadData]);

  const clearData = useCallback(async () => {
    if (adapter.clearAll) await adapter.clearAll();
    setBusiness(null);
    setParties([]);
    setTransactions([]);
    setExpenses([]);
    await bootstrap();
  }, [adapter, bootstrap]);

  const exportAll = useCallback(async () => {
    const biz = businessRef.current;
    if (!biz || !adapter.exportAll) return null;
    return adapter.exportAll(biz.id);
  }, [adapter]);

  /* ── Derived, memoized views ──────────────────────────────────────────── */
  const txnsByParty = useMemo(() => groupTransactionsByParty(transactions), [transactions]);

  const partiesWithBalance = useMemo(
    () => withBalances(parties, txnsByParty, settings.dueSoonDays, new Date()),
    [parties, txnsByParty, settings.dueSoonDays],
  );

  const customers = useMemo(
    () => partiesWithBalance.filter((p) => p.type === 'customer'),
    [partiesWithBalance],
  );
  const suppliers = useMemo(
    () => partiesWithBalance.filter((p) => p.type === 'supplier'),
    [partiesWithBalance],
  );

  const balanceById = useMemo(() => {
    const map = new Map<string, PartyWithBalance>();
    for (const p of partiesWithBalance) map.set(p.id, p);
    return map;
  }, [partiesWithBalance]);

  const getPartyById = useCallback((id: string) => balanceById.get(id), [balanceById]);
  const partyTransactions = useCallback(
    (partyId: string) => txnsByParty.get(partyId) ?? [],
    [txnsByParty],
  );
  const partyLedger = useCallback(
    (partyId: string) => {
      const party = parties.find((p) => p.id === partyId);
      if (!party) return [];
      return computeLedgerRows(party, txnsByParty.get(partyId) ?? []);
    },
    [parties, txnsByParty],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      loading,
      error,
      business,
      hasBusiness: !!business,
      adapterKind: adapter.kind,
      parties,
      partiesWithBalance,
      customers,
      suppliers,
      transactions,
      expenses,
      txnsByParty,
      refresh,
      createBusiness,
      updateBusiness,
      createParty,
      updateParty,
      deleteParty,
      getPartyById,
      partyTransactions,
      partyLedger,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createExpense,
      updateExpense,
      deleteExpense,
      createReminder,
      loadSample,
      clearData,
      exportAll,
    }),
    [
      ready,
      loading,
      error,
      business,
      adapter.kind,
      parties,
      partiesWithBalance,
      customers,
      suppliers,
      transactions,
      expenses,
      txnsByParty,
      refresh,
      createBusiness,
      updateBusiness,
      createParty,
      updateParty,
      deleteParty,
      getPartyById,
      partyTransactions,
      partyLedger,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createExpense,
      updateExpense,
      deleteExpense,
      createReminder,
      loadSample,
      clearData,
      exportAll,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// Balance helper re-exported for screens that need a one-off compute.
export { computeBalance };

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePartyType(type: PartyType) {
  const { customers, suppliers } = useData();
  return type === 'customer' ? customers : suppliers;
}
