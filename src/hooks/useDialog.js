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
      const dialogs=[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
      if(dialogs.at(-1)!==container)return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const firstItem = items[0], lastItem = items[items.length - 1];
      if (!firstItem) { event.preventDefault(); container.focus(); }
      else if(!container.contains(document.activeElement)){event.preventDefault();(event.shiftKey?lastItem:firstItem).focus();}
      else if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === container)) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener('keydown', onKeyDown,true);
    return () => { document.removeEventListener('keydown', onKeyDown,true); previous?.focus(); };
  }, []);
  return dialogRef;
}
