import { memo } from 'react';
import { CATEGORY_LABELS } from '../labels';
import type { StoredItem } from '../types';
import { ColorDot, ItemImage, cx } from './ui';

interface ItemCardProps {
  item: StoredItem;
  onOpen: (item: StoredItem) => void;
  onToggleStatus: (item: StoredItem) => void;
}

export const ItemCard = memo(function ItemCard({ item, onOpen, onToggleStatus }: ItemCardProps) {
  const inLaundry = item.status === 'laundry';
  return (
    <div className="animate-pop overflow-hidden rounded-3xl bg-card shadow-card">
      <button type="button" className="block w-full text-start" onClick={() => onOpen(item)} aria-label="تفاصيل القطعة">
        <ItemImage
          item={item}
          className="aspect-[4/5] p-4"
          imgClassName={cx('transition-opacity', inLaundry && 'opacity-40 grayscale-[40%]')}
        />
      </button>
      <div className="flex items-center gap-2 px-3 pb-3 pt-2.5">
        <ColorDot hex={item.colorHex} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-bold">{CATEGORY_LABELS[item.category]}</div>
          <div className="truncate text-xs text-muted">{item.colorName}</div>
        </div>
        <button
          type="button"
          onClick={() => onToggleStatus(item)}
          className={cx(
            'h-7 shrink-0 rounded-full px-2.5 text-[11px] font-bold transition-colors',
            inLaundry ? 'bg-wash-soft text-wash' : 'bg-ok-soft text-ok',
          )}
        >
          {inLaundry ? 'في الغسيل' : 'متاح'}
        </button>
      </div>
    </div>
  );
});
