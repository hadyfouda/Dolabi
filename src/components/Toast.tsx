import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';

type ToastKind = 'success' | 'info' | 'error';
interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (text: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const idRef = useRef(0);

  const show = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-4 pt-safe">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="mt-3 flex max-w-md animate-pop items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-float"
          >
            {t.kind === 'success' && <CheckCircle2 className="size-5 shrink-0 text-emerald-300" />}
            {t.kind === 'info' && <Info className="size-5 shrink-0 text-sky-300" />}
            {t.kind === 'error' && <TriangleAlert className="size-5 shrink-0 text-amber-300" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
