import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Pencil, Phone, Trash2, UserX } from 'lucide-react';
import type { Transaction } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { useQuickActions } from '@/features/quick-actions/QuickActions';
import { computePartyTotals } from '@/services/ledger';
import { formatDate } from '@/utils/date';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  MoneyText,
  StatusPill,
} from '@/components/ui';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';
import { PartyForm } from '@/features/parties/PartyForm';
import { ReminderSheet } from '@/features/reminders/ReminderSheet';
import { partyBalanceView } from '@/features/parties/partyView';
import { TYPE_ICON } from '@/features/shared/lookups';

/** Party profile: hero balance, quick actions, derived totals, and full ledger. */
export default function PartyProfile() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const { getPartyById, partyTransactions, partyLedger, deleteParty } = useData();
  const { openTransaction } = useQuickActions();

  const [detail, setDetail] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const party = id ? getPartyById(id) : undefined;

  const totals = useMemo(
    () => computePartyTotals(id ? partyTransactions(id) : []),
    [id, partyTransactions],
  );

  // Ledger is oldest → newest; show the most recent activity first.
  const history = useMemo(() => (id ? partyLedger(id).slice().reverse() : []), [id, partyLedger]);

  if (!party) {
    return (
      <div className="grid min-h-full place-items-center px-6 py-16">
        <EmptyState
          icon={<UserX size={26} />}
          title={t('error.notFound')}
          description={t('error.notFoundDesc')}
          action={<Button onClick={() => navigate('/')}>{t('error.goHome')}</Button>}
        />
      </div>
    );
  }

  const isCustomer = party.type === 'customer';
  const base = isCustomer ? '/customers' : '/suppliers';
  const view = partyBalanceView(party);
  const showStatus = isCustomer && party.balance > 0.005 && !!party.dueDate;

  async function onDelete() {
    if (!party) return;
    setDeleting(true);
    try {
      await deleteParty(party.id);
      toast.success(t('common.done'));
      navigate(base, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setDeleting(false);
    }
  }

  const detailRows: { label: string; value: ReactNode }[] = [
    {
      label: t('party.totalCredit'),
      value: <MoneyText amount={totals.totalCredit} tone="gold" className="font-semibold" />,
    },
    {
      label: t('party.totalPaid'),
      value: <MoneyText amount={totals.totalPaid} tone="positive" className="font-semibold" />,
    },
    {
      label: t('party.lastPayment'),
      value: (
        <span className="font-medium text-ink">
          {totals.lastPaymentAt ? formatDate(totals.lastPaymentAt, lang) : '—'}
        </span>
      ),
    },
  ];
  if (Math.abs(party.openingBalance) > 0.005) {
    detailRows.push({
      label: t('party.openingBalance'),
      value: <MoneyText amount={party.openingBalance} signed tone="ink" className="font-semibold" />,
    });
  }
  if (isCustomer && party.creditLimit != null) {
    detailRows.push({
      label: t('party.creditLimit'),
      value: <MoneyText amount={party.creditLimit} tone="ink" className="font-semibold" />,
    });
  }
  if (isCustomer && party.dueDate) {
    detailRows.push({
      label: t('party.dueDate'),
      value: <span className="font-medium text-ink">{formatDate(party.dueDate, lang)}</span>,
    });
  }
  if (party.address) {
    detailRows.push({
      label: t('common.address'),
      value: <span className="text-right font-medium text-ink">{party.address}</span>,
    });
  }
  if (party.notes) {
    detailRows.push({
      label: t('common.notes'),
      value: <span className="text-right font-medium text-ink">{party.notes}</span>,
    });
  }

  const ReceiveIcon = TYPE_ICON.received;
  const PayIcon = TYPE_ICON.paid;
  const CreditIcon = TYPE_ICON.credit_sale;

  return (
    <div className="pb-10">
      {/* Contextual sub-header (back / edit / delete) */}
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-line/70 bg-surface/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <IconButton size="sm" label={t('common.back')} onClick={() => navigate(base)}>
          <ArrowLeft size={20} />
        </IconButton>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate font-semibold leading-tight text-ink">{party.name}</p>
          <p className="truncate text-[11px] leading-tight text-faint">
            {isCustomer ? t('party.customers') : t('party.suppliers')}
          </p>
        </div>
        <IconButton size="sm" label={t('common.edit')} onClick={() => setEditing(true)}>
          <Pencil size={18} />
        </IconButton>
        <IconButton size="sm" label={t('common.delete')} onClick={() => setConfirming(true)}>
          <Trash2 size={18} />
        </IconButton>
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* Hero balance */}
        <Card elevated spine="brand" className="flex flex-col items-center gap-2 py-6 text-center">
          <Avatar name={party.name} photoUrl={party.photoUrl} size="xl" />
          <p className="mt-1 text-sm text-muted">{t(view.labelKey)}</p>
          {view.settled ? (
            <span className="font-display text-2xl font-semibold text-faint">{t('party.settled')}</span>
          ) : (
            <MoneyText amount={view.amount} tone={view.tone} size="balance" className="block" />
          )}
          {showStatus && (
            <StatusPill
              status={party.status}
              suffix={party.daysOverdue > 0 ? `${party.daysOverdue}d` : undefined}
            />
          )}
        </Card>

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-3">
          {isCustomer ? (
            <>
              <Button
                size="lg"
                leftIcon={<ReceiveIcon size={18} />}
                onClick={() =>
                  openTransaction({ type: 'received', partyType: 'customer', partyId: party.id })
                }
              >
                {t('party.receiveMoney')}
              </Button>
              <Button
                size="lg"
                variant="soft"
                leftIcon={<CreditIcon size={18} />}
                onClick={() =>
                  openTransaction({ type: 'credit_sale', partyType: 'customer', partyId: party.id })
                }
              >
                {t('party.addCreditSale')}
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="col-span-2"
              leftIcon={<PayIcon size={18} />}
              onClick={() =>
                openTransaction({ type: 'paid', partyType: 'supplier', partyId: party.id })
              }
            >
              {t('party.giveMoney')}
            </Button>
          )}
        </div>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            leftIcon={<MessageCircle size={17} />}
            onClick={() => setReminding(true)}
          >
            {t('party.sendReminder')}
          </Button>
          {party.phone ? (
            <a
              href={`tel:${party.phone}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-elevated px-5 text-[0.95rem] font-semibold text-ink transition-all duration-150 hover:bg-surface-2 active:scale-[0.98]"
            >
              <Phone size={17} />
              {t('party.call')}
            </a>
          ) : (
            <Button variant="secondary" disabled leftIcon={<Phone size={17} />}>
              {t('party.call')}
            </Button>
          )}
        </div>

        {/* Derived details */}
        <Card padded={false} className="divide-y divide-line">
          {detailRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span className="shrink-0 text-muted">{row.label}</span>
              {row.value}
            </div>
          ))}
        </Card>

        {/* Ledger history */}
        <section>
          <h2 className="mb-1 px-1 text-sm font-semibold text-muted">{t('party.history')}</h2>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-faint">{t('party.noHistory')}</p>
          ) : (
            <div className="divide-y divide-line/70">
              {history.map((row) => (
                <TransactionRow
                  key={row.transaction.id}
                  txn={row.transaction}
                  onClick={() => setDetail(row.transaction)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sheets & dialogs */}
      <TransactionDetail
        open={!!detail}
        onClose={() => setDetail(null)}
        txn={detail}
        partyName={party.name}
      />
      <ReminderSheet open={reminding} onClose={() => setReminding(false)} party={party} />
      <PartyForm open={editing} onClose={() => setEditing(false)} type={party.type} party={party} />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onDelete}
        loading={deleting}
        title={t('confirm.deleteTitle')}
        description={isCustomer ? t('confirm.deleteCustomer') : t('confirm.cannotUndo')}
        confirmLabel={t('common.delete')}
        icon={<Trash2 size={20} />}
      />
    </div>
  );
}
