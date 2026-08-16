import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Full-height, phone-width column used by screens that sit outside the main
 * app shell (auth, onboarding, errors). On large screens the content stays
 * centered at a comfortable phone width — HisabMate is a phone-first app.
 */
export function CenteredScreen({
  children,
  className,
  scroll = true,
}: {
  children: ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh justify-center bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-brand-flow opacity-[0.55]" aria-hidden />
      <div
        className={cn(
          'relative flex w-full max-w-[480px] flex-col px-6 pb-safe pt-safe',
          scroll && 'overflow-y-auto',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
