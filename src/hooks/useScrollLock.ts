import { useEffect } from 'react';

/**
 * Prevents the page behind a modal/sheet from scrolling while it is open,
 * restoring the previous overflow value on close.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [active]);
}
