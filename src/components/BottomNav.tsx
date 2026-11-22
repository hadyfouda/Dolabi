import { Heart, Settings, Shirt, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import { cx } from './ui';

export type Tab = 'wardrobe' | 'dress' | 'saved' | 'settings';

const TABS: Array<{ id: Tab; label: string; Icon: ComponentType<{ className?: string; strokeWidth?: number }> }> = [
  { id: 'wardrobe', label: 'الدولاب', Icon: Shirt },
  { id: 'dress', label: 'هخرج دلوقتي', Icon: Sparkles },
  { id: 'saved', label: 'المفضلة والسجل', Icon: Heart },
  { id: 'settings', label: 'الإعدادات', Icon: Settings },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 pb-safe backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-4">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-0.5"
            >
              <span
                className={cx(
                  'grid h-8 w-14 place-items-center rounded-full transition-colors',
                  active ? (id === 'dress' ? 'bg-ink text-white' : 'bg-cutout text-ink') : 'text-faint',
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cx('text-[11px] font-bold', active ? 'text-ink' : 'text-faint')}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
