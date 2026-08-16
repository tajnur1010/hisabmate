import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useScrollLock } from '@/hooks/useScrollLock';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** When false, backdrop clicks and Escape won't close (e.g. mid-submit). */
  dismissible?: boolean;
  /** Hide the default header row. */
  hideHeader?: boolean;
  className?: string;
}

/**
 * Bottom sheet — HisabMate's primary surface for forms and quick actions on a
 * phone. Docked to the bottom and centered within the app frame on wide
 * screens. Content scrolls; the header and footer stay put.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  hideHeader = false,
  className,
}: SheetProps) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[88vh] w-full max-w-[480px] flex-col rounded-t-3xl border border-line/60 bg-surface shadow-lifted animate-sheet-in',
          className,
        )}
      >
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>

        {!hideHeader && (title || dismissible) && (
          <div className="flex items-start gap-3 px-5 pb-2 pt-2">
            <div className="min-w-0 flex-1">
              {title && <h2 className="truncate text-lg font-display font-semibold text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            {dismissible && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1">{children}</div>

        {footer && <div className="border-t border-line bg-surface px-5 py-3 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
