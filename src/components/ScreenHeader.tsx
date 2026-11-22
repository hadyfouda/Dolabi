import type { ReactNode } from 'react';

export function ScreenHeader({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-canvas/90 pt-safe backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-safe pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-[13px] font-semibold text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </header>
  );
}
