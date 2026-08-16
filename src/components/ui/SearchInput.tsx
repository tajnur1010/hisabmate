import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
}

/** Rounded search field with a leading icon and a clear affordance. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onValueChange, onClear, className, placeholder, ...rest },
  ref,
) {
  return (
    <div className="relative w-full">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
      <input
        ref={ref}
        type="search"
        inputMode="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn('input-base h-11 pl-11 pr-10 [&::-webkit-search-cancel-button]:hidden', className)}
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => {
            onValueChange('');
            onClear?.();
          }}
          className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
});
