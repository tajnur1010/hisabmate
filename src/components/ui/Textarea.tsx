import { forwardRef, useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={!!error}
        className={cn(
          'input-base h-auto resize-none py-3 leading-relaxed',
          error && 'border-danger focus:border-danger focus:ring-danger/30',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-faint">{hint}</p>
      ) : null}
    </div>
  );
});
