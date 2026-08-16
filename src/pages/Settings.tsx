import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Database,
  Download,
  HelpCircle,
  Info,
  LogOut,
  Palette,
  Sparkles,
  Store,
  Trash2,
} from 'lucide-react';
import type { Language, ThemeMode } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Button,
  Card,
  ConfirmDialog,
  Input,
  SegmentedControl,
  Switch,
  Textarea,
} from '@/components/ui';

const APP_VERSION = '1.0.0';

/** App preferences, business profile, and on-device data controls. */
export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { mode, setMode } = useTheme();
  const { settings, update } = useSettings();
  const { business, adapterKind, updateBusiness, exportAll, loadSample, clearData } = useData();
  const { signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(business?.name ?? '');
  const [ownerName, setOwnerName] = useState(business?.ownerName ?? '');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [address, setAddress] = useState(business?.address ?? '');
  const [currency, setCurrency] = useState(business?.currency ?? '৳');
  const [savingBiz, setSavingBiz] = useState(false);

  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveBusiness() {
    if (!name.trim() || !ownerName.trim()) {
      toast.error(t('validation.nameRequired'));
      return;
    }
    setSavingBiz(true);
    try {
      await updateBusiness({
        name: name.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        currency: currency.trim() || '৳',
      });
      toast.success(t('common.done'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
    } finally {
      setSavingBiz(false);
    }
  }

  async function onExport() {
    setBusy(true);
    try {
      const data = await exportAll();
      if (!data) {
        toast.error(t('error.generic'));
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hisabmate-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('settings.exported'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function onLoadSample() {
    setBusy(true);
    try {
      await loadSample();
      toast.success(t('common.done'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    setClearing(true);
    try {
      await clearData();
      setConfirmClear(false);
      toast.success(t('common.done'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6 px-4 py-4 pb-10">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">{t('settings.title')}</h1>
      </header>

      {/* Business profile */}
      <Section title={t('settings.businessProfile')} icon={<Store size={15} />}>
        <Card className="space-y-3">
          <Input
            label={t('onboarding.businessName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={t('onboarding.ownerName')}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          <Input
            label={t('common.phone')}
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label={t('common.address')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Input
            label={t('settings.currency')}
            value={currency}
            maxLength={4}
            onChange={(e) => setCurrency(e.target.value)}
          />
          <Button fullWidth loading={savingBiz} onClick={saveBusiness}>
            {t('common.save')}
          </Button>
        </Card>
      </Section>

      {/* Appearance */}
      <Section title={t('settings.appearance')} icon={<Palette size={15} />}>
        <Card className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-muted">{t('settings.theme')}</p>
            <SegmentedControl<ThemeMode>
              aria-label={t('settings.theme')}
              value={mode}
              onChange={setMode}
              size="sm"
              options={[
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'system', label: t('settings.themeSystem') },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-muted">{t('settings.language')}</p>
            <SegmentedControl<Language>
              aria-label={t('settings.language')}
              value={lang}
              onChange={setLang}
              size="sm"
              options={[
                { value: 'en', label: 'English' },
                { value: 'bn', label: 'বাংলা' },
              ]}
            />
          </div>
          <ToggleRow
            label={t('settings.bengaliNumerals')}
            description={t('settings.bengaliNumeralsDesc')}
            checked={settings.showBengaliNumerals}
            onChange={(v) => update({ showBengaliNumerals: v })}
          />
        </Card>
      </Section>

      {/* Reminders */}
      <Section title={t('settings.reminders')} icon={<Bell size={15} />}>
        <Card className="space-y-3">
          <Textarea
            label={`${t('settings.reminderTemplate')} (EN)`}
            value={settings.reminderTemplateEn}
            onChange={(e) => update({ reminderTemplateEn: e.target.value })}
          />
          <Textarea
            label={`${t('settings.reminderTemplate')} (বাংলা)`}
            value={settings.reminderTemplateBn}
            onChange={(e) => update({ reminderTemplateBn: e.target.value })}
          />
          <Input
            label={t('settings.dueSoonWindow')}
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={String(settings.dueSoonDays)}
            onChange={(e) =>
              update({ dueSoonDays: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })
            }
          />
        </Card>
      </Section>

      {/* Data */}
      <Section title={t('settings.data')} icon={<Database size={15} />}>
        <Card padded={false} className="divide-y divide-line">
          <ActionRow
            icon={<Download size={18} />}
            label={t('settings.export')}
            onClick={onExport}
            disabled={busy}
          />
          {adapterKind === 'mock' && (
            <ActionRow
              icon={<Sparkles size={18} />}
              label={t('common.demoData')}
              onClick={onLoadSample}
              disabled={busy}
            />
          )}
        </Card>
      </Section>

      {/* Help & support */}
      <button
        type="button"
        onClick={() => navigate('/help')}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <HelpCircle size={18} />
        </span>
        <span className="flex-1 text-sm font-medium text-ink">{t('settings.help')}</span>
        <ChevronRight size={18} className="text-faint" />
      </button>

      {/* About */}
      <Section title={t('settings.about')} icon={<Info size={15} />}>
        <Card padded={false} className="divide-y divide-line">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">{t('settings.version')}</span>
            <span className="font-medium text-ink">{APP_VERSION}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">{t('settings.data')}</span>
            <span className="font-medium text-ink">
              {adapterKind === 'supabase' ? 'Supabase (cloud)' : 'On-device (offline)'}
            </span>
          </div>
        </Card>
      </Section>

      {/* Sign out + danger zone */}
      <div className="space-y-3">
        <Button variant="secondary" fullWidth leftIcon={<LogOut size={17} />} onClick={() => void signOut()}>
          {t('settings.logout')}
        </Button>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="w-full py-2 text-center text-sm font-medium text-danger transition-opacity hover:opacity-80"
        >
          {t('settings.clearData')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={onClear}
        loading={clearing}
        title={t('settings.clearData')}
        description={t('settings.clearDataConfirm')}
        confirmLabel={t('common.delete')}
        icon={<Trash2 size={20} />}
      />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-1.5 px-1 text-sm font-semibold text-muted">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
    </button>
  );
}
