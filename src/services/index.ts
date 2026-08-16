import { isSupabaseConfigured } from '@/lib/env';
import type { DataAdapter } from './adapter';
import { LocalAdapter } from './localAdapter';
import { SupabaseAdapter } from './supabaseAdapter';

let instance: DataAdapter | null = null;

/**
 * Returns the active data backend. Choosing between the on-device store and
 * live Supabase is a single decision made from environment configuration —
 * every screen talks to the same `DataAdapter` interface either way.
 */
export function getAdapter(): DataAdapter {
  if (!instance) {
    instance = isSupabaseConfigured ? new SupabaseAdapter() : new LocalAdapter();
  }
  return instance;
}

export type { DataAdapter } from './adapter';
