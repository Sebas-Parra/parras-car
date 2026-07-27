import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createToast } from './toastUtils.js';

const ToastContext = createContext(null);

const TYPE_CONFIG = {
  success: {
    title: 'Listo',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    iconClassName: 'bg-emerald-500',
  },
  error: {
    title: 'Error',
    className: 'border-red-200 bg-red-50 text-red-900',
    iconClassName: 'bg-red-500',
  },
  warning: {
    title: 'Atención',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    iconClassName: 'bg-amber-500',
  },
  info: {
    title: 'Información',
    className: 'border-sky-200 bg-sky-50 text-sky-900',
    iconClassName: 'bg-sky-500',
  },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toastInput) => {
    const toast = createToast(toastInput);
    setToasts((current) => [...current, toast].slice(-4));

    if (toast.duration > 0) {
      window.setTimeout(() => dismiss(toast.id), toast.duration);
    }

    return toast.id;
  }, [dismiss]);

  const value = useMemo(() => ({
    showToast,
    dismissToast: dismiss,
    success: (message, options = {}) => showToast({ ...options, message, type: 'success' }),
    error: (message, options = {}) => showToast({ ...options, message, type: 'error' }),
    warning: (message, options = {}) => showToast({ ...options, message, type: 'warning' }),
    info: (message, options = {}) => showToast({ ...options, message, type: 'info' }),
  }), [dismiss, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => {
          const config = TYPE_CONFIG[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
              className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 ${config.className}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${config.iconClassName}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  <p className="mt-0.5 text-sm leading-5 opacity-90">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="rounded p-1 text-current opacity-60 transition hover:bg-current/10 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/30"
                  aria-label="Cerrar notificación"
                >
                  x
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
};
