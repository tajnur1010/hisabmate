import type { Expense } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { MoneyText } from '@/components/ui';
import { relativeDay } from '@/utils/date';
import { CATEGORY_ICON, categoryLabelKey, methodLabelKey } from '@/features/shared/lookups';
import { cn } from '@/utils/cn';

interface ExpenseRowProps {
  expense: Expense;
  onClick?: () => void;
}

/** A single expense entry — always money out, shown in the danger tone. */
export function ExpenseRow({ expense, onClick }: ExpenseRowProps) {
  const { t, lang } = useI18n();
  const Icon = CATEGORY_ICON[expense.category];
  const meta = `${t(methodLabelKey(expense.method))} · ${relativeDay(expense.occurredAt, lang)}`;

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
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">
          {t(categoryLabelKey(expense.category))}
        </span>
        <span className="block truncate text-xs text-faint">
          {expense.note ? `${expense.note} · ${meta}` : meta}
        </span>
      </div>
      <span className="flex shrink-0 items-baseline gap-0.5 font-num font-semibold text-danger">
        <span aria-hidden>−</span>
        <MoneyText amount={expense.amount} tone="inherit" />
      </span>
    </Comp>
  );
}
