/**
 * Minimal promise-based IndexedDB wrapper — no dependencies.
 * Powers the offline-first mock backend and any local outbox.
 */

const DB_NAME = 'hisabmate';
const DB_VERSION = 1;

export type StoreName =
  | 'profiles'
  | 'businesses'
  | 'members'
  | 'parties'
  | 'transactions'
  | 'expenses'
  | 'reminders';

const STORES: { name: StoreName; indexes?: { name: string; keyPath: string }[] }[] = [
  { name: 'profiles' },
  { name: 'businesses', indexes: [{ name: 'ownerId', keyPath: 'ownerId' }] },
  { name: 'members', indexes: [{ name: 'businessId', keyPath: 'businessId' }] },
  { name: 'parties', indexes: [{ name: 'businessId', keyPath: 'businessId' }] },
  { name: 'transactions', indexes: [{ name: 'businessId', keyPath: 'businessId' }, { name: 'partyId', keyPath: 'partyId' }] },
  { name: 'expenses', indexes: [{ name: 'businessId', keyPath: 'businessId' }] },
  { name: 'reminders', indexes: [{ name: 'businessId', keyPath: 'businessId' }] },
];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store.name)) {
          const os = db.createObjectStore(store.name, { keyPath: 'id' });
          for (const idx of store.indexes ?? []) {
            os.createIndex(idx.name, idx.keyPath, { unique: false });
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (os: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = fn(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const idb = {
  get<T>(store: StoreName, id: string): Promise<T | undefined> {
    return tx<T | undefined>(store, 'readonly', (os) => os.get(id));
  },
  getAll<T>(store: StoreName): Promise<T[]> {
    return tx<T[]>(store, 'readonly', (os) => os.getAll());
  },
  async getByIndex<T>(store: StoreName, index: string, value: string): Promise<T[]> {
    const db = await openDb();
    return new Promise<T[]>((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  },
  put<T>(store: StoreName, value: T): Promise<T> {
    return tx(store, 'readwrite', (os) => os.put(value)).then(() => value);
  },
  delete(store: StoreName, id: string): Promise<void> {
    return tx<void>(store, 'readwrite', (os) => os.delete(id)).then(() => undefined);
  },
  async clearAll(): Promise<void> {
    const db = await openDb();
    await Promise.all(
      STORES.map(
        (s) =>
          new Promise<void>((resolve, reject) => {
            const req = db.transaction(s.name, 'readwrite').objectStore(s.name).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          }),
      ),
    );
  },
};
