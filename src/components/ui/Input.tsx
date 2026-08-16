import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  /** Large, prominent field used for amount entry. */
  emphasis?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, emphasis, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            'input-base',
            leftIcon && 'pl-11',
            rightSlot && 'pr-12',
            emphasis && 'h-16 text-balance-sm font-num font-semibold tabular',
            error && 'border-danger focus:border-danger focus:ring-danger/30',
            className,
          )}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">{rightSlot}</span>
        )}
      </div>
      {error ? (
        <p id={`${fieldId}-err`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-sm text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
