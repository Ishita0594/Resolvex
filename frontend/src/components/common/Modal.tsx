import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  titleId: string;
  title: ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Accessible modal dialog: traps focus, restores focus to the trigger on close,
 * and closes on Escape (unless a submit is in flight). Renders the same Bootstrap
 * modal markup every dialog in the app already used, so no visual change.
 */
export function Modal({ titleId, title, onClose, closeDisabled = false, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose && !closeDisabled) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, closeDisabled]);

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ background: 'rgba(10, 31, 68, 0.55)' }}>
      <div className="modal-dialog modal-dialog-centered" ref={dialogRef}>
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5" id={titleId}>
              {title}
            </h2>
            {onClose ? (
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={closeDisabled} />
            ) : null}
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
