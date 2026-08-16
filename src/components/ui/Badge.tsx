import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type Tone = 'neutral' | 'brand' | 'positive' | 'warning' | 'danger' | 'gold';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand-strong',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  gold: 'bg-gold-soft text-gold',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
}

export function Badge({ tone = 'neutral', dot, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}
