import { isSupabaseConfigured } from '@/lib/env';
import type { DataAdapter } from './adapter';
import { LocalAdapter } from './localAdapter';
import { SupabaseAdapter } from './supabaseAdapter';

/** Which implementation of `DataAdapter` a session is talking to. `'mock'` is
 *  the historical name of the on-device (IndexedDB) store — the data in it is
 *  real and permanent, it just never leaves the phone. */
export type AdapterKind = DataAdapter['kind'];

const instances = new Map<AdapterKind, DataAdapter>();

/** The backend a normal account session uses, decided by build configuration. */
export function defaultAdapterKind(): AdapterKind {
  return isSupabaseConfigured ? 'supabase' : 'mock';
}

/**
 * Returns the active data backend. Every screen talks to the same
 * `DataAdapter` interface, so this is the single place the choice is made.
 *
 * The kind is a runtime argument rather than a build-time constant because one
 * build serves two kinds of session: an account session syncing with Supabase,
 * and a **guest** session that stores everything on the device and therefore
 * works with no internet at all. Instances are cached per kind, so the value
 * returned is referentially stable and safe to use in hook dependencies.
 */
export function getAdapter(kind: AdapterKind = defaultAdapterKind()): DataAdapter {
  // Asking for the cloud backend without credentials would build an adapter
  // around a null client; fall back rather than crash at the first query.
  const resolved: AdapterKind = kind === 'supabase' && !isSupabaseConfigured ? 'mock' : kind;
  let adapter = instances.get(resolved);
  if (!adapter) {
    adapter = resolved === 'supabase' ? new SupabaseAdapter() : new LocalAdapter();
    instances.set(resolved, adapter);
  }
  return adapter;
}

export type { DataAdapter } from './adapter';
