import type { Transaction } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { MoneyText } from '@/components/ui';
import { relativeDay } from '@/utils/date';
import { TYPE_ICON, TYPE_TONE_CLASS, methodLabelKey, typeLabelKey } from '@/features/shared/lookups';
import { cn } from '@/utils/cn';

interface TransactionRowProps {
  txn: Transaction;
  /** Show this party name as the row title (e.g. on the all-ledger screen). */
  partyName?: string;
  onClick?: () => void;
}

/** A single ledger entry. Icon + tone convey direction; amount is on the right. */
export function TransactionRow({ txn, partyName, onClick }: TransactionRowProps) {
  const { t, lang } = useI18n();
  const Icon = TYPE_ICON[txn.type];
  const tone = TYPE_TONE_CLASS[txn.type];
  const sign = txn.type === 'received' ? '+' : txn.type === 'paid' || txn.type === 'refund' ? '−' : '';

  const typeLabel = t(typeLabelKey(txn.type));
  const meta = `${t(methodLabelKey(txn.method))} · ${relativeDay(txn.occurredAt, lang)}`;
  const title = partyName ?? typeLabel;
  const subtitle = partyName
    ? `${typeLabel} · ${relativeDay(txn.occurredAt, lang)}`
    : txn.note
      ? `${txn.note} · ${meta}`
      : meta;

  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 py-2.5 text-left',
        onClick && 'transition-transform duration-150 active:scale-[0.99]',
      )}
    >
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', tone.soft, tone.text)}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-faint">{subtitle}</span>
      </div>
      <span className={cn('flex shrink-0 items-baseline gap-0.5 font-num font-semibold', tone.text)}>
        {sign && <span aria-hidden>{sign}</span>}
        <MoneyText amount={txn.amount} tone="inherit" />
      </span>
    </Comp>
  );
}
