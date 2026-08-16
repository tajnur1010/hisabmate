import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Bike,
  Landmark,
  Wrench,
  Zap,
  Home,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Undo2,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ExpenseCategory, PaymentMethod, TransactionType } from '@/types';
import type { TranslationKey } from '@/i18n/en';
import { METHOD_COLORS, TYPE_TONE } from '@/lib/constants';

/* ── i18n label keys (all guaranteed to exist in the dictionaries) ─────── */
export const methodLabelKey = (m: PaymentMethod): TranslationKey => `method.${m}` as TranslationKey;
export const categoryLabelKey = (c: ExpenseCategory): TranslationKey =>
  `category.${c}` as TranslationKey;
export const typeLabelKey = (t: TransactionType): TranslationKey => `txn.${t}` as TranslationKey;

/* ── Icons ─────────────────────────────────────────────────────────────── */
export const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  bkash: Smartphone,
  nagad: Smartphone,
  bank: Landmark,
  other: Wallet,
};

export const CATEGORY_ICON: Record<ExpenseCategory, LucideIcon> = {
  rent: Home,
  electricity: Zap,
  salary: Users,
  transport: Bike,
  purchase: ShoppingCart,
  food: UtensilsCrossed,
  maintenance: Wrench,
  other: Tag,
};

export const TYPE_ICON: Record<TransactionType, LucideIcon> = {
  received: ArrowDownLeft,
  paid: ArrowUpRight,
  credit_sale: ShoppingBag,
  refund: Undo2,
};

export const methodColor = (m: PaymentMethod): string => METHOD_COLORS[m];
export const typeTone = (t: TransactionType) => TYPE_TONE[t];

/** Tailwind text/bg classes for a transaction type's tone. */
export const TYPE_TONE_CLASS: Record<TransactionType, { text: string; soft: string }> = {
  received: { text: 'text-positive', soft: 'bg-positive-soft' },
  credit_sale: { text: 'text-gold', soft: 'bg-gold-soft' },
  paid: { text: 'text-danger', soft: 'bg-danger-soft' },
  refund: { text: 'text-muted', soft: 'bg-surface-2' },
};
