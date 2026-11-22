import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { luminance } from '../services/colorUtils';
import { itemImageKey, useObjectUrl } from '../hooks/useObjectUrl';
import type { WardrobeItem } from '../types';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function ColorDot({ hex, size = 'size-3.5' }: { hex: string; size?: string }) {
  const light = luminance(hex) > 0.75;
  return (
    <span
      className={cx('inline-block shrink-0 rounded-full', size, light ? 'ring-1 ring-black/15' : 'ring-1 ring-black/5')}
      style={{ backgroundColor: hex }}
    />
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function Chip({ active = false, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink-soft active:bg-cutout',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="grid rounded-2xl bg-cutout p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-all',
            value === o.value ? 'bg-card text-ink shadow-card' : 'text-muted',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-base font-bold text-white transition-transform active:scale-[0.98] disabled:bg-faint disabled:active:scale-100',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card px-4 text-sm font-bold text-ink transition-transform active:scale-[0.98] disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Garment cutout on the neutral #F2F2F5 surface so colors read accurately. */
export function ItemImage({
  item,
  className,
  imgClassName,
  alt = '',
}: {
  item: Pick<WardrobeItem, 'id' | 'createdAt' | 'imageBlob'>;
  className?: string;
  imgClassName?: string;
  alt?: string;
}) {
  const url = useObjectUrl(item.imageBlob, itemImageKey(item));
  return (
    <div className={cx('cutout-box flex items-center justify-center overflow-hidden', className)}>
      {url && (
        <img src={url} alt={alt} draggable={false} className={cx('h-full w-full object-contain', imgClassName)} />
      )}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h3 className="text-[13px] font-bold tracking-wide text-muted">{children}</h3>
      {action}
    </div>
  );
}
