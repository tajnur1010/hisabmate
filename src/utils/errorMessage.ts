/**
 * Extract a human-readable message from anything thrown.
 *
 * Native `Error`s expose `.message`, but Supabase / PostgREST errors are plain
 * objects ({ message, details, hint, code }) and are NOT `instanceof Error` —
 * so `err instanceof Error ? err.message : fallback` silently swallows the real
 * database reason and shows only a generic fallback. This helper handles both,
 * plus auth errors that use `error_description`.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err == null) return fallback;
  if (typeof err === 'string') return err.trim() || fallback;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const e = err as {
      message?: unknown;
      error_description?: unknown;
      details?: unknown;
    };
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
    if (typeof e.error_description === 'string' && e.error_description.trim()) {
      return e.error_description;
    }
    if (typeof e.details === 'string' && e.details.trim()) return e.details;
  }
  return fallback;
}
