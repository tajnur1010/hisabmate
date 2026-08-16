import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Friendly placeholder for empty lists and zero-result states. */
export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-brand-strong">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-display font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
