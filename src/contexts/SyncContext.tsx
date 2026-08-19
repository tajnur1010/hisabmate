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
import { useAuth } from './AuthContext';

interface SyncContextValue {
  /** Whether the browser currently reports a network connection. */
  online: boolean;
  /**
   * Writes waiting to reach the server. Both adapters currently report 0: the
   * on-device store *is* the destination, and Supabase writes are online and
   * transactional. Kept in the contract because a future queued-write backend
   * would surface here — never inflate it to imply a sync that isn't happening.
   */
  pending: number;
  /** True while a flush is in flight. */
  syncing: boolean;
  /** Coarse state for a single status pill. */
  state: SyncState;
  /** Ask the backend to push anything queued (no-op on both current adapters). */
  flush: () => Promise<void>;
  /** Re-read the pending count from the backend. */
  refreshPending: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const POLL_MS = 5000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const { adapterKind } = useAuth();
  const adapter = getAdapter(adapterKind);
  // An on-device session has no server behind it. Nothing is ever queued for
  // upload, so counting "pending" rows or promising a sync would be a lie.
  const serverBacked = adapter.kind === 'supabase';
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshPending = useCallback(() => {
    if (!serverBacked) {
      setPending(0);
      return;
    }
    void adapter
      .getPendingCount()
      .then(setPending)
      .catch(() => setPending(0));
  }, [adapter, serverBacked]);

  const flush = useCallback(async () => {
    if (syncingRef.current || !serverBacked) return;
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
  }, [adapter, refreshPending, serverBacked]);

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

  // Keep the pending badge roughly in sync. Skipped entirely for on-device
  // sessions — there is no queue to poll.
  useEffect(() => {
    if (!serverBacked) {
      setPending(0);
      return;
    }
    refreshPending();
    const id = window.setInterval(refreshPending, POLL_MS);
    const onChanged = () => refreshPending();
    window.addEventListener('hisab:datachanged', onChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('hisab:datachanged', onChanged);
    };
  }, [refreshPending, serverBacked]);

  const state: SyncState = !serverBacked
    ? 'local'
    : !online
      ? 'offline'
      : syncing || pending > 0
        ? 'syncing'
        : 'synced';

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
