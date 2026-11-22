import { useEffect, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { deleteItem, updateItem } from '../db/wardrobeDb';
import { CATEGORY_LABELS } from '../labels';
import type { StoredItem } from '../types';
import { Sheet } from './Sheet';
import { TagEditor, type ItemTags } from './TagEditor';
import { useToast } from './Toast';
import { ItemImage, PrimaryButton, cx } from './ui';

interface ItemDrawerProps {
  item: StoredItem | null;
  onClose: () => void;
  onStyleAround: (item: StoredItem) => void;
}

export function ItemDrawer({ item, onClose, onStyleAround }: ItemDrawerProps) {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setConfirmDelete(false), [item?.id]);

  if (!item) return null;

  const tags: ItemTags = {
    category: item.category,
    colorName: item.colorName,
    colorHex: item.colorHex,
    pattern: item.pattern,
    formality: item.formality,
    season: item.season,
  };

  const patch = (p: Partial<ItemTags>) => {
    void updateItem(item.id, p);
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteItem(item.id);
    toast.show('اتمسحت القطعة');
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${CATEGORY_LABELS[item.category]} ${item.colorName}`}
      footer={
        <PrimaryButton onClick={() => onStyleAround(item)}>
          <Sparkles className="size-5" />
          نسّق لي طقم على القطعة دي
        </PrimaryButton>
      }
    >
      <ItemImage item={item} className="mx-auto aspect-square w-full max-w-72 rounded-3xl p-6" />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void updateItem(item.id, { status: item.status === 'available' ? 'laundry' : 'available' })}
          className={cx(
            'h-11 rounded-2xl text-sm font-bold',
            item.status === 'laundry' ? 'bg-wash-soft text-wash' : 'bg-ok-soft text-ok',
          )}
        >
          {item.status === 'laundry' ? 'في الغسيل — اضغط لو رجعت' : 'متاحة — اضغط لو في الغسيل'}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          className={cx(
            'flex h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold',
            confirmDelete ? 'bg-danger text-white' : 'bg-danger-soft text-danger',
          )}
        >
          <Trash2 className="size-4" />
          {confirmDelete ? 'متأكد؟ اضغط تاني' : 'مسح القطعة'}
        </button>
      </div>

      <TagEditor value={tags} onChange={patch} />
    </Sheet>
  );
}
