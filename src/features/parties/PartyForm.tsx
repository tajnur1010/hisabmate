import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Party, PartyType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import type { TranslationKey } from '@/i18n/en';
import { parseAmount } from '@/utils/money';
import { toDateInputValue } from '@/utils/date';
import { validateName, validatePhone } from '@/utils/validation';
import { Button, Input, Sheet, Textarea } from '@/components/ui';

/** Opening balance may be negative (an advance), so parse a leading sign too. */
function parseSigned(input: string): number {
  const negative = /^\s*[-−]/.test(input);
  const value = parseAmount(input) ?? 0;
  return negative ? -value : value;
}

interface PartyFormProps {
  open: boolean;
  onClose: () => void;
  type: PartyType;
  /** When provided, the form edits this party instead of creating one. */
  party?: Party;
  onSaved?: (party: Party) => void;
}

export function PartyForm({ open, onClose, type, party, onSaved }: PartyFormProps) {
  const { t } = useI18n();
  const { createParty, updateParty } = useData();
  const toast = useToast();
  const editing = !!party;
  const isCustomer = type === 'customer';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingText, setOpeningText] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(party?.name ?? '');
    setPhone(party?.phone ?? '');
    setAddress(party?.address ?? '');
    setOpeningText(party?.openingBalance ? String(party.openingBalance) : '');
    setCreditLimit(party?.creditLimit != null ? String(party.creditLimit) : '');
    setDueDate(party?.dueDate ? toDateInputValue(party.dueDate) : '');
    setNotes(party?.notes ?? '');
    setErrors({});
    setSubmitting(false);
  }, [open, party]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const nameErr = validateName(name);
    const phoneErr = validatePhone(phone);
    if (nameErr || phoneErr) {
      setErrors({
        name: nameErr ? t(nameErr as TranslationKey) : undefined,
        phone: phoneErr ? t(phoneErr as TranslationKey) : undefined,
      });
      return;
    }

    setSubmitting(true);
    const input = {
      type,
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      creditLimit: creditLimit.trim() ? parseAmount(creditLimit) : null,
      dueDate: dueDate || null,
      notes: notes.trim() || null,
      ...(editing ? {} : { openingBalance: openingText.trim() ? parseSigned(openingText) : 0 }),
    };

    try {
      const saved = editing
        ? await updateParty(party!.id, input)
        : await createParty(input);
      toast.success(t('common.done'));
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setSubmitting(false);
    }
  }

  const title = editing
    ? isCustomer
      ? t('party.editCustomer')
      : t('party.editSupplier')
    : isCustomer
      ? t('party.newCustomer')
      : t('party.newSupplier');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
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
        <Input
          label={t('common.name')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((x) => ({ ...x, name: undefined }));
          }}
          error={errors.name}
          autoFocus
        />
        <Input
          label={`${t('common.phone')} (${t('common.optional')})`}
          type="tel"
          inputMode="tel"
          placeholder="01XXXXXXXXX"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setErrors((x) => ({ ...x, phone: undefined }));
          }}
          error={errors.phone}
        />

        {!editing && (
          <Input
            label={`${t('party.openingBalance')} (${t('common.optional')})`}
            inputMode="decimal"
            placeholder="0"
            value={openingText}
            onChange={(e) => setOpeningText(e.target.value)}
            hint={isCustomer ? t('party.openingBalanceHint') : undefined}
            leftIcon={<span className="font-num text-muted">৳</span>}
          />
        )}

        {isCustomer && (
          <>
            <Input
              label={`${t('party.creditLimit')} (${t('common.optional')})`}
              inputMode="decimal"
              placeholder="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              leftIcon={<span className="font-num text-muted">৳</span>}
            />
            <Input
              label={`${t('party.dueDate')} (${t('common.optional')})`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </>
        )}

        <Input
          label={`${t('common.address')} (${t('common.optional')})`}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Textarea
          label={`${t('common.notes')} (${t('common.optional')})`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Sheet>
  );
}
