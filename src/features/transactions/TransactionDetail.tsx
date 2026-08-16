import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Transaction } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDateTime } from '@/utils/date';
import { Button, ConfirmDialog, MoneyText, Sheet } from '@/components/ui';
import { TYPE_ICON, TYPE_TONE_CLASS, methodLabelKey, typeLabelKey } from '@/features/shared/lookups';
import { cn } from '@/utils/cn';

interface TransactionDetailProps {
  open: boolean;
  onClose: () => void;
  txn: Transaction | null;
  partyName?: string;
}

/** Read-only transaction detail with a guarded delete (balances recompute). */
export function TransactionDetail({ open, onClose, txn, partyName }: TransactionDetailProps) {
  const { t, lang } = useI18n();
  const { deleteTransaction } = useData();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!txn) return null;

  const Icon = TYPE_ICON[txn.type];
  const tone = TYPE_TONE_CLASS[txn.type];
  const heroTone =
    txn.type === 'received' ? 'positive' : txn.type === 'credit_sale' ? 'gold' : 'danger';

  const rows: [string, string][] = [];
  if (partyName) rows.push([t('txn.forWhom'), partyName]);
  rows.push([t('common.method'), t(methodLabelKey(txn.method))]);
  rows.push([t('common.date'), formatDateTime(txn.occurredAt, lang)]);
  if (txn.note) rows.push([t('common.note'), txn.note]);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteTransaction(txn!.id);
      toast.success(t('common.done'));
      setConfirming(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setDeleting(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t(typeLabelKey(txn.type))}
        dismissible={!deleting}
        footer={
          <Button
            variant="danger"
            fullWidth
            onClick={() => setConfirming(true)}
            leftIcon={<Trash2 size={16} />}
          >
            {t('common.delete')}
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2.5 py-1">
            <span className={cn('grid h-14 w-14 place-items-center rounded-3xl', tone.soft, tone.text)}>
              <Icon size={26} />
            </span>
            <MoneyText amount={txn.amount} tone={heroTone} size="balance" />
          </div>

          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="shrink-0 text-muted">{k}</span>
                <span className="text-right font-medium text-ink">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            <span className="text-muted">{t('txn.newBalance')}</span>
            <span className="flex items-center gap-2">
              <MoneyText amount={Math.abs(txn.previousBalance)} className="text-faint line-through" />
              <MoneyText amount={Math.abs(txn.newBalance)} tone="ink" className="font-semibold" />
            </span>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onDelete}
        loading={deleting}
        title={t('confirm.deleteTitle')}
        description={t('txn.deleteConfirm')}
        confirmLabel={t('common.delete')}
        icon={<Trash2 size={20} />}
      />
    </>
  );
}
