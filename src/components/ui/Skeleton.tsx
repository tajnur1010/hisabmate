import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  /** Shape preset. */
  variant?: 'line' | 'block' | 'circle';
}

/** Shimmering placeholder shown while data loads. */
export function Skeleton({ className, variant = 'block' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton',
        variant === 'line' && 'h-3.5 rounded-md',
        variant === 'block' && 'h-full w-full rounded-2xl',
        variant === 'circle' && 'rounded-full',
        className,
      )}
    />
  );
}

/** A stack of shimmer lines approximating a paragraph or list row. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="line"
          className={i === lines - 1 ? 'w-2/3' : 'w-full'}
        />
      ))}
    </div>
  );
}
