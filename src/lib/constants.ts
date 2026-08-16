import type {
  ExpenseCategory,
  PaymentMethod,
  TransactionType,
} from '@/types';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'bkash', 'nagad', 'bank', 'other'];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'rent',
  'electricity',
  'salary',
  'transport',
  'purchase',
  'food',
  'maintenance',
  'other',
];

export const TRANSACTION_TYPES: TransactionType[] = ['received', 'paid', 'credit_sale', 'refund'];

/** Brand tints associated with each mobile-money / payment channel. */
export const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: '#0D9F6E',
  bkash: '#E2136E',
  nagad: '#EE7924',
  bank: '#1E63C7',
  other: '#7A8A84',
};

/** Which semantic colour a transaction type uses in the ledger. */
export const TYPE_TONE: Record<TransactionType, 'positive' | 'danger' | 'gold' | 'muted'> = {
  received: 'positive',
  credit_sale: 'gold',
  paid: 'danger',
  refund: 'muted',
};

export const DEFAULT_REMINDER_TEMPLATE_BN =
  'প্রিয় {name}, আপনার কাছে আমাদের বকেয়া {amount}। সুবিধামতো সময়ে পরিশোধ করার অনুরোধ রইলো। ধন্যবাদ — {business}।';

export const DEFAULT_REMINDER_TEMPLATE_EN =
  'Hello {name}, your outstanding balance is {amount}. Please make the payment when convenient. Thank you — {business}.';

export const PAGE_SIZE = 20;
