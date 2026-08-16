import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Wallet } from 'lucide-react';
import type { Expense, ExpenseCategory } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { Card, ConfirmDialog, EmptyState, IconButton, MoneyText } from '@/components/ui';
import { CATEGORY_ICON, categoryLabelKey, methodLabelKey } from '@/features/shared/lookups';
import { expensesByCategory } from '@/services/ledger';
import { monthKey, relativeDay } from '@/utils/date';
import { cn } from '@/utils/cn';

/** Monthly expense log with an at-a-glance category breakdown. */
export default function Expenses() {
  const { t, lang } = useI18n();
  const { expenses, deleteExpense } = useData();
  const toast = useToast();

  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [pending, setPending] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const key = monthKey(cursor);
  const isCurrentMonth = key === monthKey(new Date());

  const monthExpenses = useMemo(
    () =>
      expenses
        .filter((e) => !e.deletedAt && monthKey(e.occurredAt) === key)
        .slice()
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [expenses, key],
  );

  const total = useMemo(() => monthExpenses.reduce((s, e) => s + e.amount, 0), [monthExpenses]);
  const byCat = useMemo(() => expensesByCategory(monthExpenses), [monthExpenses]);

  const monthLabel = cursor.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  async function onConfirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await deleteExpense(pending.id);
      toast.success(t('common.done'));
      setPending(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">{t('expense.title')}</h1>
      </header>

      {/* Month switcher + total */}
      <Card elevated spine="danger">
        <div className="flex items-center justify-between">
          <IconButton size="sm" variant="ghost" label={t('common.back')} onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <span className="text-sm font-semibold text-ink">{monthLabel}</span>
          <IconButton
            size="sm"
            variant="ghost"
            label={t('common.next')}
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
          >
            <ChevronRight size={20} />
          </IconButton>
        </div>
        <div className="mt-2 text-center">
          <p className="text-xs text-muted">{t('expense.total')}</p>
          <MoneyText amount={total} tone="danger" size="balance" className="mt-0.5 block" />
        </div>
      </Card>

      {monthExpenses.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Wallet size={26} />}
          title={t('expense.noExpenses')}
          description={t('expense.noExpensesDesc')}
        />
      ) : (
        <>
          {byCat.length > 1 && (
            <Card className="space-y-2.5">
              <h2 className="text-sm font-semibold text-muted">{t('reports.byCategory')}</h2>
              {byCat.map(({ category, total: catTotal }) => {
                const pct = total > 0 ? (catTotal / total) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-ink">{t(categoryLabelKey(category as ExpenseCategory))}</span>
                      <MoneyText amount={catTotal} className="text-muted" />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-danger" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          <div className="divide-y divide-line/70">
            {monthExpenses.map((e) => {
              const Icon = CATEGORY_ICON[e.category];
              return (
                <div key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {t(categoryLabelKey(e.category))}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {e.note ? `${e.note} · ` : ''}
                      {t(methodLabelKey(e.method))} · {relativeDay(e.occurredAt, lang)}
                    </span>
                  </div>
                  <MoneyText amount={e.amount} tone="danger" className="shrink-0 font-semibold" />
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label={t('common.delete')}
                    onClick={() => setPending(e)}
                  >
                    <Trash2 size={16} className={cn('text-faint')} />
                  </IconButton>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={onConfirmDelete}
        loading={deleting}
        title={t('confirm.deleteTitle')}
        description={t('confirm.cannotUndo')}
        confirmLabel={t('common.delete')}
        icon={<Trash2 size={20} />}
      />
    </div>
  );
}
