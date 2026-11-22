import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** prevent closing by backdrop while busy */
  locked?: boolean;
}

/** Mobile bottom sheet (centered dialog on desktop). Locks body scroll while open. */
export function Sheet({ open, onClose, title, children, footer, locked = false }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, locked, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]"
        onClick={() => !locked && onClose()}
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col rounded-t-[28px] bg-card shadow-float md:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line md:hidden" />
        {title !== undefined && (
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <h2 className="text-lg font-extrabold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={locked}
              className="grid size-9 place-items-center rounded-full bg-cutout text-muted disabled:opacity-40"
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-safe pt-3 [&>*]:mb-3">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}
