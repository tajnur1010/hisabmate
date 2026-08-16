import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Info, X } from 'lucide-react';
import { cn } from '@/utils/cn';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `t${counter.current++}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => remove(id), 3200);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-3 pt-safe">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-3.5 py-3 shadow-lifted animate-slide-up',
              t.type === 'success' && 'border-positive/30 bg-positive-soft text-ink',
              t.type === 'error' && 'border-danger/30 bg-danger-soft text-ink',
              t.type === 'info' && 'border-line bg-elevated text-ink',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white',
                t.type === 'success' && 'bg-positive',
                t.type === 'error' && 'bg-danger',
                t.type === 'info' && 'bg-brand',
              )}
            >
              {t.type === 'error' ? <X size={13} strokeWidth={3} /> : t.type === 'info' ? <Info size={13} /> : <Check size={13} strokeWidth={3} />}
            </span>
            <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="text-faint transition-colors hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
