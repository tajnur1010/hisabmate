import { Spinner } from '@/components/ui';

/** Full-screen brand splash shown during auth/data bootstrap. */
export function Splash({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg">
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-brand-fg shadow-fab">
          <LedgerMark />
        </div>
      </div>
      <div className="flex items-center gap-2 text-muted">
        <Spinner size={16} />
        <span className="text-sm font-medium">{label ?? 'Loading…'}</span>
      </div>
    </div>
  );
}

/** HisabMate's abstract "flowing ledger" glyph. */
export function LedgerMark({ className }: { className?: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M7 8.5C7 7.67 7.67 7 8.5 7H23.5C24.33 7 25 7.67 25 8.5V25L21 22.5L18 25L15 22.5L12 25L9 22.5L7 24V8.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M11.5 12.5H20.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M11.5 16.5H17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
