import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PartyType, Transaction, TransactionType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { useSync } from '@/contexts/SyncContext';
import type { TranslationKey } from '@/i18n/en';
import { PAYMENT_METHODS } from '@/lib/constants';
import { ledgerDelta } from '@/services/ledger';
import { parseAmount } from '@/utils/money';
import { toDateInputValue } from '@/utils/date';
import { uuid } from '@/utils/id';
import { validateAmount } from '@/utils/validation';
import { Button, Input, MoneyText, Select, Sheet, Textarea } from '@/components/ui';
import { ChipSelect } from '@/features/shared/ChipSelect';
import { METHOD_ICON, methodLabelKey, typeLabelKey } from '@/features/shared/lookups';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  type: TransactionType;
  partyType: PartyType;
  /** Pre-selected & locked party (used from a party profile). */
  partyId?: string;
  onSaved?: (txn: Transaction) => void;
}

const todayStr = () => toDateInputValue(new Date());

/** Recent-duplicate window: same party/type/amount within this many ms. */
const DUP_WINDOW_MS = 90_000;

export function TransactionForm({ open, onClose, type, partyType, partyId, onSaved }: TransactionFormProps) {
  const { t } = useI18n();
  const { customers, suppliers, transactions, createTransaction, getPartyById } = useData();
  const toast = useToast();
  const { online } = useSync();

  const parties = partyType === 'customer' ? customers : suppliers;

  const [selectedId, setSelectedId] = useState(partyId ?? '');
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const [amountError, setAmountError] = useState<string | null>(null);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // Reset the form each time it opens.
  useEffect(() => {
    if (open) {
      setSelectedId(partyId ?? '');
      setAmountText('');
      setMethod(PAYMENT_METHODS[0]);
      setNote('');
      setDate(todayStr());
      setAmountError(null);
      setPartyError(null);
      setDupWarning(false);
      setSubmitting(false);
      // Focus the amount field shortly after the sheet animates in.
      const id = window.setTimeout(() => amountRef.current?.focus(), 180);
      return () => window.clearTimeout(id);
    }
  }, [open, partyId]);

  const parsedAmount = parseAmount(amountText);
  const activePartyId = partyId ?? selectedId;
  const party = activePartyId ? getPartyById(activePartyId) : undefined;

  const preview = useMemo(() => {
    if (!party || parsedAmount == null) return null;
    const delta = ledgerDelta(type, parsedAmount);
    return { current: party.balance, next: party.balance + delta };
  }, [party, parsedAmount, type]);

  function detectDuplicate(): boolean {
    if (parsedAmount == null) return false;
    const now = Date.now();
    return transactions.some(
      (tx) =>
        !tx.deletedAt &&
        tx.partyId === activePartyId &&
        tx.type === type &&
        Math.abs(tx.amount - parsedAmount) < 0.01 &&
        now - new Date(tx.createdAt).getTime() < DUP_WINDOW_MS,
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const amtErr = validateAmount(parsedAmount);
    const noParty = !activePartyId;
    setAmountError(amtErr ? t(amtErr as TranslationKey) : null);
    setPartyError(noParty ? t('validation.selectParty') : null);
    if (amtErr || noParty || parsedAmount == null) return;

    if (!dupWarning && detectDuplicate()) {
      setDupWarning(true);
      return;
    }

    setSubmitting(true);
    try {
      const occurredAt =
        date === todayStr() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
      const txn = await createTransaction({
        partyId: activePartyId,
        partyType,
        type,
        amount: parsedAmount,
        method,
        note: note.trim() || null,
        occurredAt,
        clientId: uuid(),
      });
      toast.success(online ? t('txn.saved') : t('sync.offline'));
      onSaved?.(txn);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setSubmitting(false);
    }
  }

  const partyOptions = parties.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(typeLabelKey(type))}
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
        {/* Amount */}
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
              setDupWarning(false);
            }}
            error={amountError}
            leftIcon={<span className="font-num text-lg text-muted">৳</span>}
          />
        </div>

        {/* Party selector (hidden when locked to a profile) */}
        {!partyId && (
          <Select
            label={partyType === 'customer' ? t('txn.selectCustomer') : t('txn.selectSupplier')}
            placeholder={t('txn.selectParty')}
            options={partyOptions}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setPartyError(null);
              setDupWarning(false);
            }}
            error={partyError}
          />
        )}

        {/* Balance preview */}
        {preview && (
          <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            <span className="text-muted">{t('txn.newBalance')}</span>
            <span className="flex items-center gap-2">
              <MoneyText amount={Math.abs(preview.current)} className="text-faint line-through" />
              <MoneyText amount={Math.abs(preview.next)} tone="ink" className="font-semibold" />
            </span>
          </div>
        )}

        {/* Payment method */}
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

        {/* Date + note */}
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

        {dupWarning && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{t('txn.duplicateWarning')} — {t('common.confirm').toLowerCase()}?</span>
          </div>
        )}
      </form>
    </Sheet>
  );
}
