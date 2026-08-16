import { cn } from '@/utils/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/** Pill-style tab switcher used for filters and range selectors. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex w-full items-center gap-1 rounded-2xl bg-surface-2 p-1', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-xl font-semibold tracking-tight transition-all duration-150',
              size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-[0.95rem]',
              active
                ? 'bg-elevated text-ink shadow-soft'
                : 'text-muted hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
