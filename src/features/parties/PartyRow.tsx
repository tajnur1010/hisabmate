import { useNavigate } from 'react-router-dom';
import type { PartyWithBalance } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { Avatar, MoneyText, StatusPill } from '@/components/ui';
import { relativeDay } from '@/utils/date';
import { partyBalanceView } from './partyView';

/** Tappable customer/supplier list row: identity on the left, balance on the right. */
export function PartyRow({ party }: { party: PartyWithBalance }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const view = partyBalanceView(party);
  const base = party.type === 'customer' ? '/customers' : '/suppliers';

  const sub = party.lastTransactionAt
    ? relativeDay(party.lastTransactionAt, lang)
    : party.phone || t('party.noHistory');

  const showStatus = party.type === 'customer' && party.balance > 0.005 && !!party.dueDate;

  return (
    <button
      type="button"
      onClick={() => navigate(`${base}/${party.id}`)}
      className="card flex w-full items-center gap-3 p-3 text-left transition-transform duration-150 active:scale-[0.99]"
    >
      <Avatar name={party.name} photoUrl={party.photoUrl} />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{party.name}</span>
        <span className="mt-0.5 block truncate text-xs text-faint">{sub}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {view.settled ? (
          <span className="text-sm font-medium text-faint">{t('party.settled')}</span>
        ) : (
          <>
            <MoneyText amount={view.amount} tone={view.tone} className="text-[15px] font-semibold" />
            {showStatus ? (
              <StatusPill
                status={party.status}
                showIcon={false}
                suffix={party.daysOverdue > 0 ? `${party.daysOverdue}d` : undefined}
              />
            ) : (
              <span className="text-[11px] font-medium text-faint">{t(view.labelKey)}</span>
            )}
          </>
        )}
      </div>
    </button>
  );
}
