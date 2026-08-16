import type { ParsedVoiceEntry, PaymentMethod, TransactionType } from '@/types';
import { parseAmount } from '@/utils/money';

interface KnownParty {
  id: string;
  name: string;
}

/** Keyword banks (English + transliterated + Bangla) for each intent. */
const TYPE_KEYWORDS: Record<TransactionType, string[]> = {
  received: ['received', 'receive', 'got', 'collection', 'jama', 'pelam', 'পেলাম', 'পেয়েছি', 'জমা', 'পাইলাম', 'নিলাম'],
  paid: ['paid', 'pay', 'gave', 'dilam', 'diyechi', 'porishodh', 'দিলাম', 'দিয়েছি', 'পরিশোধ', 'দিসি'],
  credit_sale: ['credit', 'baki', 'dhar', 'baaki', 'বাকি', 'ধার', 'বাকিতে', 'বিক্রি'],
  refund: ['refund', 'ferot', 'ferat', 'ফেরত', 'রিফান্ড'],
};

const METHOD_KEYWORDS: Record<PaymentMethod, string[]> = {
  bkash: ['bkash', 'bikash', 'বিকাশ'],
  nagad: ['nagad', 'নগদ'],
  bank: ['bank', 'transfer', 'ব্যাংক', 'ব্যাঙ্ক'],
  cash: ['cash', 'nagad taka', 'ক্যাশ', 'নগদ টাকা', 'হাতে'],
  other: [],
};

function detectType(text: string): { type: TransactionType; hit: boolean } {
  for (const type of Object.keys(TYPE_KEYWORDS) as TransactionType[]) {
    if (TYPE_KEYWORDS[type].some((k) => text.includes(k))) return { type, hit: true };
  }
  return { type: 'received', hit: false };
}

function detectMethod(text: string): PaymentMethod {
  for (const m of ['bkash', 'nagad', 'bank'] as PaymentMethod[]) {
    if (METHOD_KEYWORDS[m].some((k) => text.includes(k))) return m;
  }
  if (METHOD_KEYWORDS.cash.some((k) => text.includes(k))) return 'cash';
  return 'cash';
}

function detectAmount(text: string): number | undefined {
  // Grab the first run of digits (ASCII or Bengali) possibly with separators.
  const match = text.match(/[০-৯0-9][০-৯0-9,.]*/);
  if (!match) return undefined;
  const val = parseAmount(match[0]);
  return val == null || val <= 0 ? undefined : val;
}

function detectParty(text: string, parties: KnownParty[]): string | undefined {
  const lower = text.toLowerCase();
  // Longest name first so "Rahim Store" beats "Rahim".
  const sorted = [...parties].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    if (p.name && lower.includes(p.name.toLowerCase())) return p.id;
  }
  return undefined;
}

/**
 * Best-effort parse of a spoken phrase into a draft transaction. This is a
 * SUGGESTION only — the UI must show it for confirmation before anything is
 * saved (see VoiceEntry). We never auto-commit a parsed entry.
 */
export function parseVoice(rawText: string, parties: KnownParty[]): ParsedVoiceEntry & { partyId?: string } {
  const text = ` ${rawText.toLowerCase().trim()} `;
  const { type, hit: typeHit } = detectType(text);
  const amount = detectAmount(text);
  const method = detectMethod(text);
  const partyId = detectParty(text, parties);

  let score = 0;
  if (amount != null) score += 0.5;
  if (typeHit) score += 0.3;
  if (partyId) score += 0.2;

  return {
    type,
    amount,
    method,
    partyId,
    confidence: score,
    rawText,
  };
}
