import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useScrollLock } from '@/hooks/useScrollLock';
import { Button } from './Button';
import { useI18n } from '@/contexts/I18nContext';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
}

/** Centered modal for short, focused interactions like confirmations. */
export function Dialog({ open, onClose, children, dismissible = true, className }: DialogProps) {
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
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-sm rounded-3xl border border-line/60 bg-surface p-5 shadow-lifted animate-scale-in',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  icon?: ReactNode;
}

/** Ready-made yes/no confirmation with destructive styling option. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading,
  icon,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} dismissible={!loading}>
      {icon && (
        <div
          className={cn(
            'mb-3 grid h-12 w-12 place-items-center rounded-2xl',
            tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand-strong',
          )}
        >
          {icon}
        </div>
      )}
      <h2 className="text-lg font-display font-semibold text-ink">{title ?? t('confirm.deleteTitle')}</h2>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
          {cancelLabel ?? t('common.cancel')}
        </Button>
        <Button variant={tone} fullWidth onClick={onConfirm} loading={loading}>
          {confirmLabel ?? t('common.confirm')}
        </Button>
      </div>
    </Dialog>
  );
}
