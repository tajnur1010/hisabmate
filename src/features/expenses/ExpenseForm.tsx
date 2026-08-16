import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Expense, ExpenseCategory } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { useSync } from '@/contexts/SyncContext';
import type { TranslationKey } from '@/i18n/en';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants';
import { parseAmount } from '@/utils/money';
import { toDateInputValue } from '@/utils/date';
import { uuid } from '@/utils/id';
import { validateAmount } from '@/utils/validation';
import { Button, Input, Sheet, Textarea } from '@/components/ui';
import { ChipSelect } from '@/features/shared/ChipSelect';
import { CATEGORY_ICON, categoryLabelKey, METHOD_ICON, methodLabelKey } from '@/features/shared/lookups';

interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (expense: Expense) => void;
}

const todayStr = () => toDateInputValue(new Date());

export function ExpenseForm({ open, onClose, onSaved }: ExpenseFormProps) {
  const { t } = useI18n();
  const { createExpense } = useData();
  const toast = useToast();
  const { online } = useSync();

  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(EXPENSE_CATEGORIES[0]);
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAmountText('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setMethod(PAYMENT_METHODS[0]);
      setNote('');
      setDate(todayStr());
      setAmountError(null);
      setSubmitting(false);
      const id = window.setTimeout(() => amountRef.current?.focus(), 180);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const parsed = parseAmount(amountText);
    const amtErr = validateAmount(parsed);
    setAmountError(amtErr ? t(amtErr as TranslationKey) : null);
    if (amtErr || parsed == null) return;

    setSubmitting(true);
    try {
      const occurredAt =
        date === todayStr() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
      const expense = await createExpense({
        amount: parsed,
        category,
        method,
        note: note.trim() || null,
        occurredAt,
        clientId: uuid(),
      });
      toast.success(online ? t('expense.add') : t('sync.offline'));
      onSaved?.(expense);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('expense.new')}
      dismissible={!submitting}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth onClick={onSubmit} loading={submitting}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">{t('common.amount')}</label>
          <Input
            ref={amountRef}
            emphasis
            inputMode="decimal"
            placeholder="0"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value);
              setAmountError(null);
            }}
            error={amountError}
            leftIcon={<span className="font-num text-lg text-muted">৳</span>}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">{t('expense.category')}</label>
          <ChipSelect
            value={category}
            onChange={setCategory}
            columns={2}
            items={EXPENSE_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICON[c];
              return { value: c, label: t(categoryLabelKey(c)), icon: <Icon size={16} /> };
            })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">{t('common.method')}</label>
          <ChipSelect
            value={method}
            onChange={setMethod}
            columns={3}
            items={PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICON[m];
              return { value: m, label: t(methodLabelKey(m)), icon: <Icon size={16} /> };
            })}
          />
        </div>

        <Input
          label={t('common.date')}
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
        />
        <Textarea
          label={`${t('common.note')} (${t('common.optional')})`}
          placeholder={t('txn.addNote')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </form>
    </Sheet>
  );
}
