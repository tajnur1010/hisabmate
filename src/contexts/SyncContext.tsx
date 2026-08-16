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
import type { SyncState } from '@/types';
import { getAdapter } from '@/services';

interface SyncContextValue {
  /** Whether the browser currently reports a network connection. */
  online: boolean;
  /** Number of writes queued locally, waiting to reach the server. */
  pending: number;
  /** True while the outbox is being flushed. */
  syncing: boolean;
  /** Coarse state for a single status pill. */
  state: SyncState;
  /** Manually trigger an outbox flush (e.g. from a "retry" button). */
  flush: () => Promise<void>;
  /** Re-read the pending count from the backend. */
  refreshPending: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const POLL_MS = 5000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const adapter = getAdapter();
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshPending = useCallback(() => {
    void adapter
      .getPendingCount()
      .then(setPending)
      .catch(() => setPending(0));
  }, [adapter]);

  const flush = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await adapter.flushOutbox();
      // Let data-holding contexts know fresh rows are available.
      window.dispatchEvent(new CustomEvent('hisab:synced'));
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      refreshPending();
    }
  }, [adapter, refreshPending]);

  // Track connectivity and flush the outbox as soon as we come back online.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flush]);

  // Keep the pending badge roughly in sync.
  useEffect(() => {
    refreshPending();
    const id = window.setInterval(refreshPending, POLL_MS);
    const onChanged = () => refreshPending();
    window.addEventListener('hisab:datachanged', onChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('hisab:datachanged', onChanged);
    };
  }, [refreshPending]);

  const state: SyncState = !online ? 'offline' : syncing || pending > 0 ? 'syncing' : 'synced';

  const value = useMemo<SyncContextValue>(
    () => ({ online, pending, syncing, state, flush, refreshPending }),
    [online, pending, syncing, state, flush, refreshPending],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
