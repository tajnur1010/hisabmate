import type { ElementType } from 'react';
import { env } from '@/lib/env';
import { formatCompact, formatMoney } from '@/utils/money';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/utils/cn';

type MoneyTone = 'inherit' | 'ink' | 'muted' | 'positive' | 'danger' | 'brand' | 'gold' | 'auto';
type MoneySize = 'inherit' | 'sm' | 'md' | 'lg' | 'balance' | 'balance-lg';

interface MoneyTextProps {
  amount: number;
  tone?: MoneyTone;
  size?: MoneySize;
  signed?: boolean;
  compact?: boolean;
  noSymbol?: boolean;
  currency?: string;
  as?: ElementType;
  className?: string;
}

const toneClass: Record<Exclude<MoneyTone, 'auto'>, string> = {
  inherit: '',
  ink: 'text-ink',
  muted: 'text-muted',
  positive: 'text-positive',
  danger: 'text-danger',
  brand: 'text-brand-strong',
  gold: 'text-gold',
};

const sizeClass: Record<MoneySize, string> = {
  inherit: '',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  balance: 'text-balance leading-none',
  'balance-lg': 'text-balance-lg leading-none',
};

/**
 * The canonical way to render an amount. Reads the Bengali-numeral preference
 * from settings and applies HisabMate's tabular numeric styling so columns of
 * figures line up cleanly.
 */
export function MoneyText({
  amount,
  tone = 'inherit',
  size = 'inherit',
  signed = false,
  compact = false,
  noSymbol = false,
  currency = env.defaultCurrency,
  as: Tag = 'span',
  className,
}: MoneyTextProps) {
  const { settings } = useSettings();
  const bn = settings.showBengaliNumerals;

  const resolvedTone: Exclude<MoneyTone, 'auto'> =
    tone === 'auto' ? (amount > 0 ? 'positive' : amount < 0 ? 'danger' : 'muted') : tone;

  const text = compact
    ? (amount < 0 ? '−' : signed && amount > 0 ? '+' : '') +
      (noSymbol ? '' : currency) +
      formatCompact(Math.abs(amount), bn)
    : formatMoney(amount, { currency, bengaliNumerals: bn, signed, noSymbol });

  return (
    <Tag className={cn('font-num tabular', toneClass[resolvedTone], sizeClass[size], className)}>
      {text}
    </Tag>
  );
}
