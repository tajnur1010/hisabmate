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
  InventorySummary,
  Party,
  PartyType,
  PartyWithBalance,
  Product,
  ProductCategory,
  ProductProfit,
  ProductWithStock,
  Reminder,
  ReportRange,
  StockLedgerRow,
  StockMovement,
  Transaction,
} from '@/types';
import { getAdapter } from '@/services';
import type {
  CreateBusinessInput,
  CreateExpenseInput,
  CreatePartyInput,
  CreateProductCategoryInput,
  CreateProductInput,
  CreateReminderInput,
  CreateStockMovementInput,
  CreateTransactionInput,
} from '@/services/adapter';
import {
  computeBalance,
  computeLedgerRows,
  groupTransactionsByParty,
  withBalances,
} from '@/services/ledger';
import {
  computeProductProfit,
  computeStockLedgerRows,
  findByCode,
  groupMovementsByProduct,
  lowStockAlerts,
  summarizeInventory,
  withStock,
} from '@/services/inventory';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

interface DataContextValue {
  /** Initial bootstrap finished (profile + business + first data load). */
  ready: boolean;
  /** A background reload is in flight. */
  loading: boolean;
  error: string | null;
  /**
   * The initial load failed, so `business` being null means "unknown", not
   * "this shop owner has no shop yet". Route guards must not send someone to
   * onboarding in this state — they'd create a second shop over the first.
   */
  loadFailed: boolean;

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

  /* Products & inventory */
  productCategories: ProductCategory[];
  products: Product[];
  /** Products with derived stock, status and valuation (archived excluded). */
  productsWithStock: ProductWithStock[];
  stockMovements: StockMovement[];
  /** Out-of-stock first, then low stock — ready for the alerts card. */
  stockAlerts: ProductWithStock[];
  inventorySummary: InventorySummary;

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

  createProductCategory: (input: CreateProductCategoryInput) => Promise<ProductCategory>;
  updateProductCategory: (id: string, patch: CreateProductCategoryInput) => Promise<ProductCategory>;
  deleteProductCategory: (id: string) => Promise<void>;

  createProduct: (input: CreateProductInput) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<CreateProductInput>) => Promise<Product>;
  /** Archives the product: stock history and past profit stay intact. */
  deleteProduct: (id: string) => Promise<void>;
  getProductById: (id: string) => ProductWithStock | undefined;
  /** Scanner/search helper — exact barcode wins, then case-insensitive SKU. */
  lookupProduct: (code: string) => ProductWithStock | undefined;
  productMovements: (productId: string) => StockMovement[];
  productStockLedger: (productId: string) => StockLedgerRow[];
  /** Per-product profit, optionally limited to a date range. */
  productProfit: (range?: ReportRange) => ProductProfit[];

  createStockMovement: (input: CreateStockMovementInput) => Promise<StockMovement>;
  updateStockMovement: (
    id: string,
    patch: Partial<CreateStockMovementInput>,
  ) => Promise<StockMovement>;
  deleteStockMovement: (id: string) => Promise<void>;

  loadSample: () => Promise<void>;
  clearData: () => Promise<void>;
  exportAll: () => Promise<unknown>;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Blank optional text becomes null so partial unique indexes on SKU/barcode
 * never collide on a row of empty strings. */
function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Finite and non-negative; an empty number input (NaN) collapses to 0. */
function nonNegative(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Sanitizes product input before it reaches a backend, so both the offline and
 * the Supabase adapter receive identical, constraint-safe values.
 */
function normalizeProduct(input: CreateProductInput): CreateProductInput;
function normalizeProduct(input: Partial<CreateProductInput>): Partial<CreateProductInput>;
function normalizeProduct(input: Partial<CreateProductInput>): Partial<CreateProductInput> {
  const out: Partial<CreateProductInput> = { ...input };

  if (out.name !== undefined) {
    out.name = out.name.trim();
    if (!out.name) throw new Error('Product name is required');
  }
  if (out.sku !== undefined) out.sku = cleanText(out.sku);
  if (out.barcode !== undefined) out.barcode = cleanText(out.barcode);
  if (out.notes !== undefined) out.notes = cleanText(out.notes);
  if (out.photoUrl !== undefined) out.photoUrl = cleanText(out.photoUrl);
  if (out.categoryId !== undefined) out.categoryId = cleanText(out.categoryId);
  if (out.purchasePrice !== undefined) out.purchasePrice = nonNegative(out.purchasePrice);
  if (out.sellingPrice !== undefined) out.sellingPrice = nonNegative(out.sellingPrice);
  if (out.lowStockThreshold !== undefined) out.lowStockThreshold = nonNegative(out.lowStockThreshold);
  if (out.openingStock !== undefined) {
    out.openingStock = Number.isFinite(out.openingStock) ? out.openingStock : 0;
  }
  return out;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, adapterKind } = useAuth();
  const { settings } = useSettings();
  // A guest session is served by the on-device store, an account session by the
  // configured backend, so the adapter follows the session rather than the build.
  const adapter = getAdapter(adapterKind);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [business, setBusiness] = useState<Business | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // Guards against writes before a business exists and against stale reloads.
  const businessRef = useRef<Business | null>(null);
  businessRef.current = business;

  /** Empties every per-business collection — used on sign-out and shop switch. */
  const resetCollections = useCallback(() => {
    setParties([]);
    setTransactions([]);
    setExpenses([]);
    setProductCategories([]);
    setProducts([]);
    setStockMovements([]);
  }, []);

  const loadData = useCallback(
    async (businessId: string) => {
      const [p, t, e, cats, prods, moves] = await Promise.all([
        adapter.listParties(businessId),
        adapter.listTransactions(businessId),
        adapter.listExpenses(businessId),
        adapter.listProductCategories(businessId),
        adapter.listProducts(businessId),
        adapter.listStockMovements(businessId),
      ]);
      setParties(p);
      setTransactions(t);
      setExpenses(e);
      setProductCategories(cats);
      setProducts(prods);
      setStockMovements(moves);
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
      else resetCollections();
      setLoadFailed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      // Keep whatever was already on screen and record that this is a failure,
      // not an empty account — the difference decides where routing sends the user.
      setLoadFailed(true);
    } finally {
      setReady(true);
      setLoading(false);
    }
  }, [adapter, user, loadData, resetCollections]);

  // Re-bootstrap whenever the signed-in user changes.
  useEffect(() => {
    if (!user) {
      setBusiness(null);
      resetCollections();
      setReady(false);
      setLoadFailed(false);
      setError(null);
      return;
    }
    void bootstrap();
  }, [user, bootstrap, resetCollections]);

  // Coming back online after a failed cloud load: retry once, automatically, so
  // the user isn't left staring at the retry screen they didn't cause.
  useEffect(() => {
    if (!loadFailed || !user) return;
    const onOnline = () => void bootstrap();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [loadFailed, user, bootstrap]);

  // A backend that queues writes announces `hisab:synced` once they land, so we
  // reload. Neither current adapter queues anything (see SyncContext), so this
  // is a hook for future backends rather than something that fires today.
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

  /* ── Product categories ───────────────────────────────────────────────── */
  const createProductCategory = useCallback<DataContextValue['createProductCategory']>(
    async (input) => {
      const { businessId } = requireContext();
      const name = input.name.trim();
      if (!name) throw new Error('Category name is required');
      const category = await adapter.createProductCategory(businessId, { name });
      await loadData(businessId);
      return category;
    },
    [adapter, requireContext, loadData],
  );

  const updateProductCategory = useCallback<DataContextValue['updateProductCategory']>(
    async (id, patch) => {
      const { businessId } = requireContext();
      const name = patch.name.trim();
      if (!name) throw new Error('Category name is required');
      const category = await adapter.updateProductCategory(id, { name });
      await loadData(businessId);
      return category;
    },
    [adapter, requireContext, loadData],
  );

  const deleteProductCategory = useCallback<DataContextValue['deleteProductCategory']>(
    async (id) => {
      const { businessId } = requireContext();
      await adapter.deleteProductCategory(id);
      await loadData(businessId);
    },
    [adapter, requireContext, loadData],
  );

  /* ── Products ─────────────────────────────────────────────────────────── */
  const createProduct = useCallback<DataContextValue['createProduct']>(
    async (input) => {
      const { userId, businessId } = requireContext();
      const product = await adapter.createProduct(businessId, userId, normalizeProduct(input));
      await loadData(businessId);
      return product;
    },
    [adapter, requireContext, loadData],
  );

  const updateProduct = useCallback<DataContextValue['updateProduct']>(
    async (id, patch) => {
      const { businessId } = requireContext();
      const product = await adapter.updateProduct(id, normalizeProduct(patch));
      await loadData(businessId);
      return product;
    },
    [adapter, requireContext, loadData],
  );

  const deleteProduct = useCallback<DataContextValue['deleteProduct']>(
    async (id) => {
      const { businessId } = requireContext();
      await adapter.deleteProduct(id);
      await loadData(businessId);
    },
    [adapter, requireContext, loadData],
  );

  /* ── Stock movements ──────────────────────────────────────────────────── */
  const createStockMovement = useCallback<DataContextValue['createStockMovement']>(
    async (input) => {
      const { userId, businessId } = requireContext();
      // The DB enforces quantity > 0 too; fail here so the user gets a message
      // instead of a Postgres constraint error.
      if (!(Math.abs(input.quantity) > 0)) throw new Error('Quantity must be greater than zero');
      const movement = await adapter.createStockMovement(businessId, userId, {
        ...input,
        quantity: Math.abs(input.quantity),
      });
      await loadData(businessId);
      return movement;
    },
    [adapter, requireContext, loadData],
  );

  const updateStockMovement = useCallback<DataContextValue['updateStockMovement']>(
    async (id, patch) => {
      const { businessId } = requireContext();
      if (patch.quantity !== undefined && !(Math.abs(patch.quantity) > 0)) {
        throw new Error('Quantity must be greater than zero');
      }
      const movement = await adapter.updateStockMovement(id, {
        ...patch,
        ...(patch.quantity === undefined ? {} : { quantity: Math.abs(patch.quantity) }),
      });
      await loadData(businessId);
      return movement;
    },
    [adapter, requireContext, loadData],
  );

  const deleteStockMovement = useCallback<DataContextValue['deleteStockMovement']>(
    async (id) => {
      const { businessId } = requireContext();
      await adapter.deleteStockMovement(id);
      await loadData(businessId);
    },
    [adapter, requireContext, loadData],
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
    resetCollections();
    await bootstrap();
  }, [adapter, bootstrap, resetCollections]);

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

  /* ── Derived inventory views ──────────────────────────────────────────── */
  const movesByProduct = useMemo(() => groupMovementsByProduct(stockMovements), [stockMovements]);

  const productsWithStock = useMemo(
    () => withStock(products, movesByProduct),
    [products, movesByProduct],
  );

  const stockAlerts = useMemo(() => lowStockAlerts(productsWithStock), [productsWithStock]);
  const inventorySummary = useMemo(() => summarizeInventory(productsWithStock), [productsWithStock]);

  const productById = useMemo(() => {
    const map = new Map<string, ProductWithStock>();
    for (const p of productsWithStock) map.set(p.id, p);
    return map;
  }, [productsWithStock]);

  const getProductById = useCallback((id: string) => productById.get(id), [productById]);

  const lookupProduct = useCallback(
    (code: string) => findByCode(productsWithStock, code),
    [productsWithStock],
  );

  const productMovements = useCallback(
    (productId: string) => movesByProduct.get(productId) ?? [],
    [movesByProduct],
  );

  const productStockLedger = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return [];
      return computeStockLedgerRows(product, movesByProduct.get(productId) ?? []);
    },
    [products, movesByProduct],
  );

  const productProfit = useCallback(
    (range?: ReportRange) => computeProductProfit(products, stockMovements, range),
    [products, stockMovements],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      loading,
      error,
      loadFailed,
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
      productCategories,
      products,
      productsWithStock,
      stockMovements,
      stockAlerts,
      inventorySummary,
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
      createProductCategory,
      updateProductCategory,
      deleteProductCategory,
      createProduct,
      updateProduct,
      deleteProduct,
      getProductById,
      lookupProduct,
      productMovements,
      productStockLedger,
      productProfit,
      createStockMovement,
      updateStockMovement,
      deleteStockMovement,
      loadSample,
      clearData,
      exportAll,
    }),
    [
      ready,
      loading,
      error,
      loadFailed,
      business,
      adapter.kind,
      parties,
      partiesWithBalance,
      customers,
      suppliers,
      transactions,
      expenses,
      txnsByParty,
      productCategories,
      products,
      productsWithStock,
      stockMovements,
      stockAlerts,
      inventorySummary,
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
      createProductCategory,
      updateProductCategory,
      deleteProductCategory,
      createProduct,
      updateProduct,
      deleteProduct,
      getProductById,
      lookupProduct,
      productMovements,
      productStockLedger,
      productProfit,
      createStockMovement,
      updateStockMovement,
      deleteStockMovement,
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
