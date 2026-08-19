import type { TranslationKey } from '@/i18n/en';

/**
 * Turns an auth failure into a message the shop owner can act on.
 *
 * `'offline'` is our own sentinel, not something a server said: it means the
 * request was never attempted because the phone has no connection. Showing the
 * generic "something went wrong" for it would send someone hunting for a typo
 * in their password when all they need is a network.
 */
export function authErrorMessage(
  error: string | undefined,
  t: (key: TranslationKey) => string,
): string {
  if (error === 'offline') return t('error.offline');
  return error ?? t('error.generic');
}
