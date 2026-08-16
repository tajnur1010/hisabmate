import type { PartyWithBalance } from '@/types';
import type { TranslationKey } from '@/i18n/en';

export type BalanceTone = 'gold' | 'danger' | 'positive' | 'muted';

export interface BalanceView {
  /** Absolute magnitude for display. */
  amount: number;
  /** Signed balance (party convention). */
  raw: number;
  settled: boolean;
  tone: BalanceTone;
  /** "You'll get" / "You'll give" / "Settled". */
  labelKey: TranslationKey;
}

/**
 * Translate a party's signed balance into a display view. Balance sign follows
 * the domain convention (see types/index.ts); this maps it to the shopkeeper's
 * mental model of "money I'll get" vs "money I'll give".
 */
export function partyBalanceView(p: Pick<PartyWithBalance, 'type' | 'balance'>): BalanceView {
  const raw = p.balance;
  const amount = Math.abs(raw);

  if (amount < 0.005) {
    return { amount: 0, raw: 0, settled: true, tone: 'muted', labelKey: 'party.settled' };
  }

  if (p.type === 'customer') {
    // + → customer owes you (receivable); − → advance you owe them
    return raw > 0
      ? { amount, raw, settled: false, tone: 'gold', labelKey: 'dashboard.youWillGet' }
      : { amount, raw, settled: false, tone: 'positive', labelKey: 'dashboard.youWillGive' };
  }

  // supplier: + → you owe them (payable); − → they owe you
  return raw > 0
    ? { amount, raw, settled: false, tone: 'danger', labelKey: 'dashboard.youWillGive' }
    : { amount, raw, settled: false, tone: 'positive', labelKey: 'dashboard.youWillGet' };
}
