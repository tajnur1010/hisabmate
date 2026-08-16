import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface ChipItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Optional accent color (e.g. payment-method brand color) shown when active. */
  color?: string;
}

interface ChipSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: ChipItem<T>[];
  className?: string;
  /** Force a fixed number of columns instead of wrapping. */
  columns?: number;
}

/** Single-select chip group used for payment methods, categories, and types. */
export function ChipSelect<T extends string>({
  value,
  onChange,
  items,
  className,
  columns,
}: ChipSelectProps<T>) {
  return (
    <div
      className={cn('gap-2', columns ? 'grid' : 'flex flex-wrap', className)}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-sm font-semibold tracking-tight transition-all active:scale-[0.97]',
              active
                ? 'border-transparent bg-brand-soft text-brand-strong ring-2 ring-brand/50'
                : 'border-line bg-elevated text-muted hover:border-line/70',
            )}
            style={active && item.color ? { color: item.color, boxShadow: `inset 0 0 0 2px ${item.color}55` } : undefined}
          >
            {item.icon && (
              <span style={item.color ? { color: item.color } : undefined} className={cn(!item.color && (active ? 'text-brand-strong' : 'text-faint'))}>
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
