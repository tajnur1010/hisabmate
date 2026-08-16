import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Spine = 'none' | 'brand' | 'positive' | 'warning' | 'danger';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevated adds a stronger shadow for hero/summary cards. */
  elevated?: boolean;
  /** Colored ledger edge on the left — HisabMate's signature accent. */
  spine?: Spine;
  /** Adds interactive affordances (press feedback) for tappable cards. */
  interactive?: boolean;
  padded?: boolean;
}

const spineClass: Record<Spine, string> = {
  none: '',
  brand: 'spine spine-brand',
  positive: 'spine spine-positive',
  warning: 'spine spine-warning',
  danger: 'spine spine-danger',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevated, spine = 'none', interactive, padded = true, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        elevated ? 'card-lifted' : 'card',
        padded && 'p-4',
        spineClass[spine],
        interactive && 'cursor-pointer transition-transform duration-150 active:scale-[0.99] hover:border-line/80',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
