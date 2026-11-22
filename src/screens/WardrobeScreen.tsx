import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Plus, Shirt, Sparkles, WandSparkles } from 'lucide-react';
import { db, isStored, toggleItemStatus } from '../db/wardrobeDb';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../labels';
import { seedDemoItems } from '../services/demoItems';
import type { Category, StoredItem } from '../types';
import { ItemCard } from '../components/ItemCard';
import { ItemDrawer } from '../components/ItemDrawer';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { UploadSheet } from '../components/UploadSheet';
import { Chip, ColorDot, PrimaryButton, SecondaryButton, cx } from '../components/ui';

export function WardrobeScreen({ onStyleAround }: { onStyleAround: (item: StoredItem) => void }) {
  const toast = useToast();
  const items = useLiveQuery(async () => (await db.items.orderBy('createdAt').reverse().toArray()).filter(isStored), []);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [color, setColor] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const all = useMemo(() => items ?? [], [items]);
  const selected = useMemo(() => all.find((i) => i.id === selectedId) ?? null, [all, selectedId]);

  const categoriesPresent = useMemo(() => CATEGORY_ORDER.filter((c) => all.some((i) => i.category === c)), [all]);
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of all) if (!map.has(i.colorName)) map.set(i.colorName, i.colorHex);
    return [...map.entries()];
  }, [all]);

  const filtered = useMemo(
    () =>
      all.filter(
        (i) =>
          (category === 'all' || i.category === category) &&
          (!color || i.colorName === color) &&
          (!availableOnly || i.status === 'available'),
      ),
    [all, category, color, availableOnly],
  );

  const availableCount = all.filter((i) => i.status === 'available').length;
  const laundryCount = all.length - availableCount;

  const onOpen = useCallback((item: StoredItem) => setSelectedId(item.id), []);
  const onToggle = useCallback((item: StoredItem) => void toggleItemStatus(item), []);

  const seed = async () => {
    setSeeding(true);
    try {
      await seedDemoItems();
      toast.show('اتضافت 6 قطع تجريبية — جرّب "هخرج دلوقتي"');
    } finally {
      setSeeding(false);
    }
  };

  if (items === undefined) {
    return <div className="grid min-h-[60dvh] place-items-center text-muted">...</div>;
  }

  return (
    <div className="pb-nav">
      <ScreenHeader
        title="دولابي"
        subtitle={all.length ? `${all.length} قطعة · ${availableCount} متاحة${laundryCount ? ` · ${laundryCount} في الغسيل` : ''}` : 'منسّق ملابسك الذكي'}
      >
        {all.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none">
              <Chip active={availableOnly} onClick={() => setAvailableOnly((v) => !v)} className={availableOnly ? '!border-ok !bg-ok' : ''}>
                المتاح فقط
              </Chip>
              <span className="my-auto h-5 w-px shrink-0 bg-line" />
              <Chip active={category === 'all'} onClick={() => setCategory('all')}>
                الكل
              </Chip>
              {categoriesPresent.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? 'all' : c)}>
                  {CATEGORY_LABELS[c]}
                </Chip>
              ))}
            </div>
            {colors.length > 1 && (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none">
                {colors.map(([name, hex]) => (
                  <Chip key={name} active={color === name} onClick={() => setColor(color === name ? null : name)} className="h-8 px-3 text-xs">
                    <ColorDot hex={hex} size="size-3" />
                    {name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </ScreenHeader>

      <main className="mx-auto max-w-5xl px-safe">
        {all.length === 0 ? (
          <div className="mx-auto mt-6 max-w-md animate-pop text-center">
            <div className="relative mx-auto grid size-36 place-items-center rounded-[40px] bg-card shadow-card">
              <Shirt className="size-16 text-ink" strokeWidth={1.5} />
              <span className="absolute -bottom-2 -left-2 grid size-12 place-items-center rounded-2xl bg-ink text-white shadow-float">
                <WandSparkles className="size-6" />
              </span>
            </div>
            <h2 className="mt-7 text-2xl font-extrabold">دولابك لسه فاضي</h2>
            <p className="mt-2 text-[15px] leading-7 text-muted">
              صوّر هدومك، وإحنا هنفرّغ الخلفية ونقص القطعة بدقة، وبعدين ننسّق لك أطقم لايقة في ثانية — كله على موبايلك ومن غير نت.
            </p>
            <div className="mt-6 space-y-3">
              <PrimaryButton onClick={() => setUploadOpen(true)}>
                <Camera className="size-5" /> ضيف أول قطعة
              </PrimaryButton>
              <SecondaryButton onClick={() => void seed()} disabled={seeding}>
                <Sparkles className="size-4" /> جرّب بقطع افتراضية (Demo)
              </SecondaryButton>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-muted">
            <p className="font-bold">مفيش قطع بالفلاتر دي</p>
            <button
              type="button"
              className="mt-3 text-sm font-bold text-ink underline underline-offset-4"
              onClick={() => {
                setCategory('all');
                setColor(null);
                setAvailableOnly(false);
              }}
            >
              امسح الفلاتر
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={onOpen} onToggleStatus={onToggle} />
            ))}
          </div>
        )}
      </main>

      {all.length > 0 && (
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          aria-label="إضافة هدوم"
          className={cx(
            'fixed bottom-nav-offset end-5 z-40 grid size-15 place-items-center rounded-full bg-ink text-white shadow-float transition-transform active:scale-95',
          )}
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </button>
      )}

      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <ItemDrawer
        item={selected}
        onClose={() => setSelectedId(null)}
        onStyleAround={(item) => {
          setSelectedId(null);
          onStyleAround(item);
        }}
      />
    </div>
  );
}
