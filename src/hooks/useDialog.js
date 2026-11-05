import { useEffect, useRef } from "react";

// Dialogs mount only while open. Keep keyboard focus inside and return it to
// the invoking control on close, including when closed with Escape.
export function useDialog(onClose) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const container = dialogRef.current;
    if (!container) return undefined;
    const previous = document.activeElement;
    const focusable = () => [...container.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => !el.hidden && el.getAttribute('aria-hidden') !== 'true');
    const first = focusable()[0];
    (first || container).focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const firstItem = items[0], lastItem = items[items.length - 1];
      if (!firstItem) { event.preventDefault(); container.focus(); }
      else if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === container)) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => { container.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, []);
  return dialogRef;
}
