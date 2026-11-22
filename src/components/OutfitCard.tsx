import { useState, type ReactNode } from 'react';
import { Check, Footprints, Heart, Shirt, Sparkles, TriangleAlert, WashingMachine } from 'lucide-react';
import { CATEGORY_LABELS } from '../labels';
import { sortByLayer } from '../services/outfitRules';
import type { StoredItem } from '../types';
import { ColorDot, ItemImage, cx } from './ui';

/** Visual lookbook stack: layered tops → pants → shoes. */
export function OutfitStack({ items, compact = false }: { items: StoredItem[]; compact?: boolean }) {
  const sorted = sortByLayer(items);
  const tops = sorted.filter((i) => ['jacket', 'pullover', 'shirt', 'tshirt'].includes(i.category));
  const pants = sorted.find((i) => i.category === 'pants');
  const feet = sorted.filter((i) => i.category === 'shoes' || i.category === 'accessory');
  const topH = compact ? 'h-24' : 'h-40';
  const pantsH = compact ? 'h-28' : 'h-52';

  return (
    <div className={cx('cutout-box rounded-3xl', compact ? 'p-2' : 'p-4')}>
      <div className={cx('flex items-end justify-center', tops.length > 1 ? '-space-x-4 space-x-reverse' : '')}>
        {tops.map((t, idx) => (
          <ItemImage
            key={t.id}
            item={t}
            alt={CATEGORY_LABELS[t.category]}
            className={cx(
              'bg-transparent',
              topH,
              tops.length === 1 ? 'w-3/5' : tops.length === 2 ? 'w-1/2' : 'w-1/3',
              idx === 0 && tops.length > 1 && 'z-10',
            )}
            imgClassName="drop-shadow-[0_6px_10px_rgba(0,0,0,0.08)]"
          />
        ))}
      </div>
      {pants && (
        <ItemImage
          item={pants}
          alt="بنطلون"
          className={cx('mx-auto bg-transparent', pantsH, compact ? 'mt-1 w-2/3' : 'mt-2 w-1/2')}
          imgClassName="drop-shadow-[0_6px_10px_rgba(0,0,0,0.08)]"
        />
      )}
      {feet.length > 0 && (
        <div className="mt-1 flex justify-center gap-2">
          {feet.map((f) => (
            <ItemImage key={f.id} item={f} className={cx('bg-transparent', compact ? 'h-10 w-14' : 'h-16 w-24')} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ItemsLegend({ items }: { items: StoredItem[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sortByLayer(items).map((i) => (
        <span key={i.id} className="inline-flex items-center gap-1.5 rounded-full bg-cutout px-2.5 py-1 text-xs font-semibold text-ink-soft">
          <ColorDot hex={i.colorHex} size="size-2.5" />
          {CATEGORY_LABELS[i.category]} {i.colorName}
        </span>
      ))}
    </div>
  );
}

interface OutfitCardProps {
  items: StoredItem[];
  title: string;
  reasonAr: string;
  shoeTipAr: string;
  badge?: ReactNode;
  warnings?: string[];
  missingCount?: number;
  actions: ReactNode;
}

export function OutfitCard({ items, title, reasonAr, shoeTipAr, badge, warnings = [], missingCount = 0, actions }: OutfitCardProps) {
  return (
    <article className="animate-pop overflow-hidden rounded-[28px] bg-card p-3 shadow-card">
      <OutfitStack items={items} />
      <div className="px-1.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold">{title}</h3>
          {badge}
        </div>
        <div className="mt-2">
          <ItemsLegend items={items} />
        </div>
        <p className="mt-3 text-[14px] leading-7 text-ink-soft">{reasonAr}</p>
        {shoeTipAr && (
          <div className="mt-2 flex items-start gap-2 rounded-2xl bg-cutout p-3 text-[13px] leading-6 text-ink-soft">
            <Footprints className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>{shoeTipAr}</span>
          </div>
        )}
        {(warnings.length > 0 || missingCount > 0) && (
          <div className="mt-2 flex items-start gap-2 rounded-2xl bg-wash-soft p-3 text-[13px] leading-6 text-wash">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {[...warnings, missingCount > 0 ? `${missingCount} قطعة من الطقم ده اتمسحت من الدولاب.` : '']
                .filter(Boolean)
                .join(' ')}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3">{actions}</div>
    </article>
  );
}

export function SourceBadge({ source, rank }: { source: 'rules' | 'ai'; rank?: number }) {
  if (source === 'ai') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ai-soft px-2.5 py-1 text-[11px] font-bold text-ai">
        <Sparkles className="size-3.5" /> ستايليست AI
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cutout px-2.5 py-1 text-[11px] font-bold text-muted">
      <Shirt className="size-3.5" /> {rank === 0 ? 'الاختيار الأول' : `اقتراح ${rank !== undefined ? rank + 1 : ''}`}
    </span>
  );
}

interface OutfitActionsProps {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onWear: (markLaundry: boolean) => Promise<void>;
  defaultLaundry: boolean;
}

export function OutfitActions({ isFavorite, onToggleFavorite, onWear, defaultLaundry }: OutfitActionsProps) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'done'>('idle');
  const [busy, setBusy] = useState(false);

  const wear = async (laundry: boolean) => {
    setBusy(true);
    try {
      await onWear(laundry);
      setStep('done');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'confirm') {
    return (
      <div className="animate-fade-in rounded-2xl bg-cutout p-3">
        <div className="mb-2 text-sm font-bold">تحط القطع دي في الغسيل بعد ما تلبسها؟</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void wear(true)}
            className={cx('flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold', defaultLaundry ? 'bg-ink text-white' : 'bg-card')}
          >
            <WashingMachine className="size-4" /> أيوه، للغسيل
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void wear(false)}
            className={cx('h-11 rounded-xl text-sm font-bold', defaultLaundry ? 'bg-card' : 'bg-ink text-white')}
          >
            لا، سجّل بس
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        className={cx(
          'flex h-12 items-center justify-center gap-1.5 rounded-2xl border px-4 text-sm font-bold transition-colors',
          isFavorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-line bg-card',
        )}
      >
        <Heart className={cx('size-5', isFavorite && 'fill-current')} />
        {isFavorite ? 'في المفضلة' : 'حفظ في المفضلة'}
      </button>
      <button
        type="button"
        disabled={step === 'done'}
        onClick={() => setStep('confirm')}
        className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-ink text-sm font-bold text-white disabled:bg-ok"
      >
        {step === 'done' ? (
          <>
            <Check className="size-5" /> اتسجّل — يومك حلو!
          </>
        ) : (
          'هلبس ده النهارده'
        )}
      </button>
    </div>
  );
}
