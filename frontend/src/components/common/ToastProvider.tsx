import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning';

export interface ToastInput {
  title: string;
  message?: string;
  tone?: ToastTone;
}

interface ToastRecord extends ToastInput {
  id: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_DURATION_MS = 6000;

const TONE_ICON: Record<ToastTone, string> = {
  info: 'bi-info-circle',
  success: 'bi-check-circle',
  warning: 'bi-exclamation-triangle',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      counterRef.current += 1;
      const id = `toast-${counterRef.current}`;
      setToasts((current) => [...current, { tone: 'info', ...toast, id }]);
      window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="rx-toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rx-toast rx-toast--${toast.tone}`}>
            <i className={`bi ${TONE_ICON[toast.tone]}`} aria-hidden="true" />
            <div className="flex-grow-1 min-width-0">
              <p className="mb-0 fw-semibold small">{toast.title}</p>
              {toast.message ? <p className="mb-0 small text-muted">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              className="btn-close"
              style={{ fontSize: '0.7rem' }}
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
