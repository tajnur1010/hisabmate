import { cn } from '@/utils/cn';

interface SpinnerProps {
  size?: number;
  className?: string;
  /** Accessible label; omit for a purely decorative spinner. */
  label?: string;
}

/** Minimal, brand-tinted loading indicator. */
export function Spinner({ size = 18, className, label }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
    />
  );
}
