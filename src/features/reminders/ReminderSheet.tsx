import { useEffect, useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import type { PartyWithBalance } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/contexts/ToastContext';
import { formatMoney } from '@/utils/money';
import { Button, MoneyText, Sheet, Textarea } from '@/components/ui';

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return out;
}

interface ReminderSheetProps {
  open: boolean;
  onClose: () => void;
  party: PartyWithBalance | null;
}

/** Compose an editable payment-reminder message and share via WhatsApp / copy. */
export function ReminderSheet({ open, onClose, party }: ReminderSheetProps) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const { business, createReminder } = useData();
  const toast = useToast();
  const [message, setMessage] = useState('');

  const amount = party ? Math.abs(party.balance) : 0;

  useEffect(() => {
    if (!open || !party) return;
    const tpl = lang === 'bn' ? settings.reminderTemplateBn : settings.reminderTemplateEn;
    setMessage(
      fillTemplate(tpl, {
        name: party.name,
        amount: formatMoney(amount, {
          currency: business?.currency ?? '৳',
          bengaliNumerals: settings.showBengaliNumerals,
        }),
        business: business?.name ?? '',
      }),
    );
  }, [open, party, lang, settings, business, amount]);

  if (!party) return null;

  const record = async (channel: 'whatsapp' | 'copy') => {
    try {
      await createReminder({ partyId: party.id, message, channel });
    } catch {
      /* recording a reminder is best-effort; never block sharing */
    }
  };

  const onWhatsApp = () => {
    const phone = (party.phone ?? '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(message);
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
    void record('whatsapp');
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success(t('reminder.copied'));
    } catch {
      toast.error(t('error.generic'));
    }
    void record('copy');
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('reminder.title')}
      description={party.name}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCopy} leftIcon={<Copy size={16} />}>
            {t('reminder.copy')}
          </Button>
          <Button fullWidth onClick={onWhatsApp} leftIcon={<MessageCircle size={16} />}>
            {t('reminder.whatsapp')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-muted">{t('party.currentBalance')}</span>
          <MoneyText amount={amount} tone="gold" className="text-lg font-semibold" />
        </div>
        <Textarea
          label={t('reminder.template')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
        />
        {!party.phone && <p className="text-sm text-warning">{t('reminder.noPhone')}</p>}
      </div>
    </Sheet>
  );
}
