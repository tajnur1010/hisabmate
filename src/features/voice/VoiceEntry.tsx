import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Mic, RotateCcw } from 'lucide-react';
import type { PaymentMethod, TransactionType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { useSync } from '@/contexts/SyncContext';
import type { TranslationKey } from '@/i18n/en';
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '@/lib/constants';
import { ledgerDelta } from '@/services/ledger';
import { parseAmount } from '@/utils/money';
import { uuid } from '@/utils/id';
import { validateAmount } from '@/utils/validation';
import { Button, Input, MoneyText, Select, Sheet, Textarea } from '@/components/ui';
import { ChipSelect } from '@/features/shared/ChipSelect';
import { METHOD_ICON, methodLabelKey, TYPE_ICON, typeLabelKey } from '@/features/shared/lookups';
import { parseVoice } from './parseVoice';

/* ---- Minimal Web Speech API typings (not in the DOM lib) ---- */
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  0: SpeechAlternative;
  isFinal: boolean;
}
interface SpeechEvent {
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Phase = 'idle' | 'listening' | 'confirm';

interface Draft {
  type: TransactionType;
  partyId: string;
  amountText: string;
  method: PaymentMethod;
  note: string;
}

interface VoiceEntryProps {
  open: boolean;
  onClose: () => void;
}

export function VoiceEntry({ open, onClose }: VoiceEntryProps) {
  const { t, lang } = useI18n();
  const { customers, suppliers, getPartyById, createTransaction } = useData();
  const toast = useToast();
  const { online } = useSync();

  const supported = useMemo(() => getSpeechRecognition() !== null, []);
  const allParties = useMemo(() => [...customers, ...suppliers], [customers, suppliers]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
        rec.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
  }, []);

  // Turn a final transcript into an editable, unsaved draft (never auto-saves).
  const finalize = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) {
        setPhase('idle');
        setError(t('voice.noMatch'));
        return;
      }
      const parsed = parseVoice(clean, allParties);
      setDraft({
        type: parsed.type,
        partyId: parsed.partyId ?? '',
        amountText: parsed.amount != null ? String(parsed.amount) : '',
        method: parsed.method,
        note: '',
      });
      setAmountError(null);
      setPartyError(null);
      setPhase('confirm');
    },
    [allParties, t],
  );

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    stopRecognition();
    setError(null);
    setTranscript('');

    const rec = new Ctor();
    rec.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const results = Array.from(e.results as ArrayLike<SpeechResult>);
      const text = results.map((r) => r[0]?.transcript ?? '').join('');
      setTranscript(text);
      if (results.length > 0 && results[results.length - 1].isFinal) {
        stopRecognition();
        finalize(text);
      }
    };
    rec.onerror = (e) => {
      stopRecognition();
      setPhase('idle');
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? t('voice.permission')
        : t('voice.noMatch'));
    };
    rec.onend = () => {
      setPhase((p) => (p === 'listening' ? 'idle' : p));
    };

    recognitionRef.current = rec;
    setPhase('listening');
    try {
      rec.start();
    } catch {
      // start() throws if called while already running — reset gracefully.
      setPhase('idle');
    }
  }, [finalize, lang, stopRecognition, t]);

  // Reset everything whenever the sheet opens; tear down mic when it closes.
  useEffect(() => {
    if (open) {
      setPhase('idle');
      setTranscript('');
      setError(null);
      setDraft(null);
      setAmountError(null);
      setPartyError(null);
      setSaving(false);
    } else {
      stopRecognition();
    }
    return () => stopRecognition();
  }, [open, stopRecognition]);

  const partyOptions = useMemo(
    () => allParties.map((p) => ({ value: p.id, label: p.name })),
    [allParties],
  );

  const previewParty = draft?.partyId ? getPartyById(draft.partyId) : undefined;
  const previewAmount = draft ? parseAmount(draft.amountText) : null;
  const preview = useMemo(() => {
    if (!draft || !previewParty || previewAmount == null) return null;
    const delta = ledgerDelta(draft.type, previewAmount);
    return { current: previewParty.balance, next: previewParty.balance + delta };
  }, [draft, previewParty, previewAmount]);

  async function handleSave() {
    if (!draft || saving) return;
    const parsed = parseAmount(draft.amountText);
    const amtErr = validateAmount(parsed);
    const noParty = !draft.partyId;
    setAmountError(amtErr ? t(amtErr as TranslationKey) : null);
    setPartyError(noParty ? t('validation.selectParty') : null);
    if (amtErr || noParty || parsed == null) return;

    const party = getPartyById(draft.partyId);
    if (!party) {
      setPartyError(t('validation.selectParty'));
      return;
    }

    setSaving(true);
    try {
      await createTransaction({
        partyId: draft.partyId,
        partyType: party.type,
        type: draft.type,
        amount: parsed,
        method: draft.method,
        note: draft.note.trim() || null,
        occurredAt: new Date().toISOString(),
        clientId: uuid(),
      });
      toast.success(online ? t('txn.saved') : t('sync.offline'));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
      setSaving(false);
    }
  }

  const isConfirm = phase === 'confirm';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('voice.title')}
      description={isConfirm ? t('voice.confirmDesc') : undefined}
      dismissible={!saving}
      footer={
        isConfirm ? (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setPhase('idle');
              }}
              disabled={saving}
              leftIcon={<RotateCcw size={16} />}
            >
              {t('voice.tryAgain')}
            </Button>
            <Button fullWidth onClick={handleSave} loading={saving}>
              {t('voice.save')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {/* Capture view */}
      {!isConfirm && (
        <div className="flex flex-col items-center px-2 py-4 text-center">
          {!supported ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-warning-soft text-warning">
                <AlertTriangle size={26} />
              </span>
              <p className="max-w-[16rem] text-sm text-muted">{t('voice.notSupported')}</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={phase === 'listening' ? stopRecognition : start}
                aria-label={t('voice.tapToSpeak')}
                className="relative grid h-28 w-28 place-items-center rounded-full outline-none"
              >
                {phase === 'listening' && (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand/25" />
                    <span className="absolute inset-2 animate-pulse rounded-full bg-brand/20" />
                  </>
                )}
                <span
                  className={
                    'relative grid h-24 w-24 place-items-center rounded-full text-white shadow-fab transition-transform active:scale-95 ' +
                    (phase === 'listening' ? 'bg-brand-strong scale-105' : 'bg-brand')
                  }
                >
                  <Mic size={40} />
                </span>
              </button>

              <p className="mt-6 text-base font-semibold text-ink">
                {phase === 'listening' ? t('voice.listening') : t('voice.tapToSpeak')}
              </p>

              {/* Live transcript while listening */}
              {phase === 'listening' && transcript && (
                <p className="mt-2 max-w-[18rem] text-sm text-muted">“{transcript}”</p>
              )}

              {/* Example hint (idle) */}
              {phase === 'idle' && !error && (
                <p className="mt-2 max-w-[18rem] text-sm text-faint">{t('voice.example')}</p>
              )}

              {/* Error */}
              {error && phase === 'idle' && (
                <p className="mt-3 max-w-[18rem] text-sm font-medium text-danger">{error}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Confirm view — user MUST review before anything is saved */}
      {isConfirm && draft && (
        <div className="space-y-4">
          {transcript && (
            <div className="rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">{t('voice.detected')}</p>
              <p className="mt-1 text-sm text-ink">“{transcript}”</p>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">{t('txn.type')}</label>
            <ChipSelect
              value={draft.type}
              onChange={(type) => setDraft((d) => (d ? { ...d, type } : d))}
              columns={2}
              items={TRANSACTION_TYPES.map((ty) => {
                const Icon = TYPE_ICON[ty];
                return { value: ty, label: t(typeLabelKey(ty)), icon: <Icon size={16} /> };
              })}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">{t('common.amount')}</label>
            <Input
              emphasis
              inputMode="decimal"
              placeholder="0"
              value={draft.amountText}
              onChange={(e) => {
                const amountText = e.target.value;
                setDraft((d) => (d ? { ...d, amountText } : d));
                setAmountError(null);
              }}
              error={amountError}
              leftIcon={<span className="font-num text-lg text-muted">৳</span>}
            />
          </div>

          {/* Party */}
          <Select
            label={t('txn.forWhom')}
            placeholder={t('txn.selectParty')}
            options={partyOptions}
            value={draft.partyId}
            onChange={(e) => {
              const partyId = e.target.value;
              setDraft((d) => (d ? { ...d, partyId } : d));
              setPartyError(null);
            }}
            error={partyError}
          />

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

          {/* Method */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">{t('common.method')}</label>
            <ChipSelect
              value={draft.method}
              onChange={(method) => setDraft((d) => (d ? { ...d, method } : d))}
              columns={3}
              items={PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICON[m];
                return { value: m, label: t(methodLabelKey(m)), icon: <Icon size={16} /> };
              })}
            />
          </div>

          {/* Note */}
          <Textarea
            label={`${t('common.note')} (${t('common.optional')})`}
            placeholder={t('txn.addNote')}
            value={draft.note}
            onChange={(e) => {
              const note = e.target.value;
              setDraft((d) => (d ? { ...d, note } : d));
            }}
          />
        </div>
      )}
    </Sheet>
  );
}
