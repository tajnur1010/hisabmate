import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const base =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg shadow-soft hover:brightness-[1.04]',
  secondary: 'bg-elevated text-ink border border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-ink hover:bg-surface-2',
  danger: 'bg-danger text-white shadow-soft hover:brightness-[1.05]',
  soft: 'bg-brand-soft text-brand-strong hover:brightness-[0.99]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={size === 'lg' ? 20 : 18} />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-2', loading && 'opacity-0')}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </button>
  );
});

/** Compact square button for a single icon. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; label: string }
>(function IconButton({ variant = 'ghost', size = 'md', label, className, children, ...rest }, ref) {
  const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], dim, 'px-0', className)}
      {...rest}
    >
      {children}
    </button>
  );
});
