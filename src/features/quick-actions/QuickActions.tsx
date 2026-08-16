import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Mic } from 'lucide-react';
import type { PartyType, TransactionType } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { Sheet } from '@/components/ui';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { ExpenseForm } from '@/features/expenses/ExpenseForm';
import { VoiceEntry } from '@/features/voice/VoiceEntry';
import { TYPE_ICON, TYPE_TONE_CLASS, typeLabelKey } from '@/features/shared/lookups';
import { CATEGORY_ICON } from '@/features/shared/lookups';
import { cn } from '@/utils/cn';

type Active =
  | { kind: 'menu' }
  | { kind: 'txn'; type: TransactionType; partyType: PartyType; partyId?: string }
  | { kind: 'expense' }
  | { kind: 'voice' }
  | null;

interface QuickActionsValue {
  openMenu: () => void;
  openExpense: () => void;
  openVoice: () => void;
  openTransaction: (opts: { type: TransactionType; partyType: PartyType; partyId?: string }) => void;
  close: () => void;
}

const QuickActionsContext = createContext<QuickActionsValue | null>(null);

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [active, setActive] = useState<Active>(null);

  const close = useCallback(() => setActive(null), []);
  const value = useMemo<QuickActionsValue>(
    () => ({
      openMenu: () => setActive({ kind: 'menu' }),
      openExpense: () => setActive({ kind: 'expense' }),
      openVoice: () => setActive({ kind: 'voice' }),
      openTransaction: (opts) => setActive({ kind: 'txn', ...opts }),
      close,
    }),
    [close],
  );

  const menuActions: { type: TransactionType; partyType: PartyType }[] = [
    { type: 'received', partyType: 'customer' },
    { type: 'paid', partyType: 'supplier' },
    { type: 'credit_sale', partyType: 'customer' },
  ];

  return (
    <QuickActionsContext.Provider value={value}>
      {children}

      {/* Quick-action chooser */}
      <Sheet open={active?.kind === 'menu'} onClose={close} title={t('quick.title')}>
        <div className="grid grid-cols-2 gap-3 pb-2">
          {menuActions.map((a) => {
            const Icon = TYPE_ICON[a.type];
            const tone = TYPE_TONE_CLASS[a.type];
            return (
              <button
                key={a.type}
                onClick={() => setActive({ kind: 'txn', type: a.type, partyType: a.partyType })}
                className="flex flex-col items-start gap-3 rounded-3xl border border-line bg-elevated p-4 text-left transition-all active:scale-[0.98] hover:border-line/70"
              >
                <span className={cn('grid h-11 w-11 place-items-center rounded-2xl', tone.soft, tone.text)}>
                  <Icon size={22} />
                </span>
                <span className="text-sm font-semibold text-ink">{t(typeLabelKey(a.type))}</span>
              </button>
            );
          })}

          <button
            onClick={() => setActive({ kind: 'expense' })}
            className="flex flex-col items-start gap-3 rounded-3xl border border-line bg-elevated p-4 text-left transition-all active:scale-[0.98] hover:border-line/70"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
              {(() => {
                const Icon = CATEGORY_ICON.other;
                return <Icon size={22} />;
              })()}
            </span>
            <span className="text-sm font-semibold text-ink">{t('quick.expense')}</span>
          </button>
        </div>

        <button
          onClick={() => setActive({ kind: 'voice' })}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 font-semibold text-brand-fg transition-all active:scale-[0.99]"
        >
          <Mic size={18} />
          {t('quick.voiceEntry')}
        </button>
      </Sheet>

      {/* Entry forms */}
      {active?.kind === 'txn' && (
        <TransactionForm
          open
          type={active.type}
          partyType={active.partyType}
          partyId={active.partyId}
          onClose={close}
        />
      )}
      <ExpenseForm open={active?.kind === 'expense'} onClose={close} />
      <VoiceEntry open={active?.kind === 'voice'} onClose={close} />
    </QuickActionsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useQuickActions(): QuickActionsValue {
  const ctx = useContext(QuickActionsContext);
  if (!ctx) throw new Error('useQuickActions must be used within QuickActionsProvider');
  return ctx;
}
