import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { DueStatus } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { Badge } from './Badge';
import type { Tone } from './Badge';

const MAP: Record<DueStatus, { tone: Tone; icon: typeof Clock }> = {
  good: { tone: 'positive', icon: CheckCircle2 },
  due_soon: { tone: 'warning', icon: Clock },
  overdue: { tone: 'danger', icon: AlertTriangle },
};

interface StatusPillProps {
  status: DueStatus;
  /** Extra text appended after the label, e.g. "· 4d". */
  suffix?: string;
  showIcon?: boolean;
}

/** Traffic-light indicator for a party's payment health. */
export function StatusPill({ status, suffix, showIcon = true }: StatusPillProps) {
  const { t } = useI18n();
  const { tone, icon: Icon } = MAP[status];
  const label = status === 'good' ? t('status.good') : status === 'due_soon' ? t('status.due_soon') : t('status.overdue');
  return (
    <Badge tone={tone} icon={showIcon ? <Icon size={12} strokeWidth={2.5} /> : undefined}>
      {label}
      {suffix ? ` ${suffix}` : ''}
    </Badge>
  );
}
