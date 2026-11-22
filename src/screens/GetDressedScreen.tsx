import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, CloudSun, Info, Loader2, Pin, PinOff, Sparkles, X } from 'lucide-react';
import { db, isStored, logWear, recentWear, saveOutfit, setFavorite, setKey } from '../db/wardrobeDb';
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_PLURAL, OCCASION_LABELS, WEATHER_LABELS } from '../labels';
import { generateOutfits, outfitDisplayName, RECENT_WEAR_DAYS } from '../services/outfitEngine';
import { isAiReady } from '../services/settings';
import type { Category, GenerateResult, Occasion, StoredItem, Weather } from '../types';
import { useSettings } from '../hooks/useSettings';
import { OutfitActions, OutfitCard, SourceBadge } from '../components/OutfitCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { Chip, ItemImage, PrimaryButton, Segmented, cx } from '../components/ui';

export interface StyleAnchor {
  itemId: number;
  nonce: number;
}

type Mode = 'quick' | 'context';

const MAX_PINS = 2;

function seasonalWeather(): Weather {
  const m = new Date().getMonth() + 1; // Egypt-friendly default
  if (m === 12 || m <= 2) return 'cold';
  if (m >= 5 && m <= 9) return 'hot';
  return 'mild';
}

const OCCASION_BY_FORMALITY = { formal: 'work', smart_casual: 'smart_casual', casual: 'casual' } as const;

export function GetDressedScreen({ anchor, onGoWardrobe }: { anchor: StyleAnchor | null; onGoWardrobe: () => void }) {
  const toast = useToast();
  const [settings] = useSettings();
  const allItems = useLiveQuery(async () => (await db.items.toArray()).filter(isStored), []);
  const outfits = useLiveQuery(() => db.outfits.toArray(), []);

  const [mode, setMode] = useState<Mode>('quick');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pinned, setPinned] = useState<number[]>([]);
  const [occasion, setOccasion] = useState<Occasion>('smart_casual');
  const [weather, setWeather] = useState<Weather>(seasonalWeather);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const handledNonce = useRef<number | null>(null);

  const byId = useMemo(() => new Map((allItems ?? []).map((i) => [i.id, i])), [allItems]);
  const available = useMemo(() => (allItems ?? []).filter((i) => i.status === 'available'), [allItems]);
  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((c) => ({ category: c, items: available.filter((i) => i.category === c) })).filter((g) => g.items.length > 0),
    [available],
  );
  const favoriteKeys = useMemo(
    () => new Map((outfits ?? []).filter((o) => o.isFavorite).map((o) => [setKey(o.itemIds), o.id])),
    [outfits],
  );

  // drop selections for items that went to the laundry / were deleted
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => byId.get(id)?.status === 'available'));
      return next.size === s.size ? s : next;
    });
  }, [byId]);

  const run = useCallback(
    async (opts: { mode: Mode; pinnedIds: number[]; occasion?: Occasion; weather?: Weather; selectedIds?: Set<number> }) => {
      if (!allItems) return;
      setLoading(true);
      setResult(null);
      try {
        const pinnedItems = opts.pinnedIds.map((id) => byId.get(id)).filter((x): x is StoredItem => Boolean(x));
        let pool: StoredItem[] =
          opts.mode === 'quick' ? available.filter((i) => opts.selectedIds?.has(i.id)) : [...available];
        for (const p of pinnedItems) if (!pool.some((i) => i.id === p.id)) pool = [...pool, p];
        const res = await generateOutfits({
          pool,
          pinnedIds: opts.pinnedIds,
          occasion: opts.mode === 'context' ? opts.occasion : undefined,
          weather: opts.mode === 'context' ? opts.weather : undefined,
          recentWear: await recentWear(RECENT_WEAR_DAYS),
          mode: opts.mode,
        });
        setResult(res);
        if (res.fallbackReason) toast.show(res.fallbackReason, 'info');
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      } finally {
        setLoading(false);
      }
    },
    [allItems, available, byId, toast],
  );

  // "نسّق لي طقم على القطعة دي" from the wardrobe drawer
  useEffect(() => {
    if (!anchor || !allItems || handledNonce.current === anchor.nonce) return;
    handledNonce.current = anchor.nonce;
    const item = byId.get(anchor.itemId);
    if (!item) return;
    const occ: Occasion = OCCASION_BY_FORMALITY[item.formality];
    setMode('context');
    setPinned([item.id]);
    setOccasion(occ);
    void run({ mode: 'context', pinnedIds: [item.id], occasion: occ, weather });
  }, [anchor, allItems, byId, run, weather]);

  const toggleSelect = (id: number) => {
    const wasSelected = selected.has(id);
    setSelected((s) => {
      const next = new Set(s);
      if (wasSelected) next.delete(id);
      else next.add(id);
      return next;
    });
    if (wasSelected) setPinned((p) => p.filter((x) => x !== id));
  };

  const togglePin = (id: number) => {
    setPinned((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= MAX_PINS) {
        toast.show('تقدر تثبّت قطعتين بالكتير', 'info');
        return p;
      }
      return [...p, id];
    });
    setSelected((s) => new Set(s).add(id));
  };

  const selectedItems = available.filter((i) => selected.has(i.id));
  const selCount = (cats: Category[]) => selectedItems.filter((i) => cats.includes(i.category)).length;
  const quickReady = selCount(['pants']) > 0 && selCount(['shirt', 'tshirt', 'pullover']) > 0;
  const quickHint = !selCount(['pants'])
    ? 'اختار بنطلون واحد على الأقل'
    : !selCount(['shirt', 'tshirt', 'pullover'])
      ? 'اختار قميص أو تيشيرت أو بلوفر'
      : `${selectedItems.length} قطع مختارة${pinned.length ? ` · ${pinned.length} مثبتة` : ''}`;

  const toggleFavorite = async (itemIds: number[], meta: { title: string; reasonAr: string; shoeTipAr: string }) => {
    const existingId = favoriteKeys.get(setKey(itemIds));
    if (existingId !== undefined) {
      await setFavorite(existingId, false);
      toast.show('اتشال من المفضلة', 'info');
      return;
    }
    const items = itemIds.map((id) => byId.get(id)).filter((x): x is StoredItem => Boolean(x));
    await saveOutfit({
      name: `${meta.title} — ${outfitDisplayName(items)}`,
      itemIds,
      occasion: mode === 'context' ? occasion : 'quick',
      reasonAr: meta.reasonAr,
      shoeTipAr: meta.shoeTipAr,
      isFavorite: true,
      createdAt: Date.now(),
    });
    toast.show('اتحفظ في المفضلة ❤️');
  };

  const wear = async (itemIds: number[], meta: { title: string; reasonAr: string; shoeTipAr: string }, laundry: boolean) => {
    const items = itemIds.map((id) => byId.get(id)).filter((x): x is StoredItem => Boolean(x));
    const outfitId = await saveOutfit({
      name: `${meta.title} — ${outfitDisplayName(items)}`,
      itemIds,
      occasion: mode === 'context' ? occasion : 'quick',
      reasonAr: meta.reasonAr,
      shoeTipAr: meta.shoeTipAr,
      isFavorite: false,
      createdAt: Date.now(),
    });
    await logWear(itemIds, outfitId, laundry);
    toast.show(laundry ? 'اتسجّل في السجل والقطع راحت الغسيل' : 'اتسجّل في سجل اللبس');
  };

  if (allItems === undefined) return <div className="grid min-h-[60dvh] place-items-center text-muted">...</div>;

  const aiOn = isAiReady(settings);

  return (
    <div className="pb-nav">
      <ScreenHeader
        title="هخرج دلوقتي"
        subtitle={aiOn ? 'الستايليست الذكي شغال ✨' : 'المنسّق الداخلي — شغال من غير نت'}
      >
        <div className="mt-3">
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m);
              setResult(null);
            }}
            options={[
              { value: 'quick', label: 'من المتاح قدامي', icon: <Check className="size-4" /> },
              { value: 'context', label: 'حسب الخروجة', icon: <CloudSun className="size-4" /> },
            ]}
          />
        </div>
      </ScreenHeader>

      <main className="mx-auto max-w-3xl px-safe">
        {available.length === 0 ? (
          <div className="mt-14 text-center">
            <p className="text-lg font-extrabold">مفيش هدوم متاحة دلوقتي</p>
            <p className="mt-1 text-sm text-muted">ضيف قطع للدولاب أو رجّع القطع اللي في الغسيل.</p>
            <button type="button" onClick={onGoWardrobe} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">
              روح للدولاب
            </button>
          </div>
        ) : mode === 'quick' ? (
          <section>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[13px] font-semibold leading-6 text-muted">
                علّم على القطع اللي قدامك دلوقتي. اضغط <Pin className="inline size-3.5" /> لو لازم تلبس قطعة معيّنة.
              </p>
              <button
                type="button"
                className="shrink-0 text-xs font-bold text-ink underline underline-offset-4"
                onClick={() => {
                  if (selected.size === available.length) {
                    setSelected(new Set());
                    setPinned([]);
                  } else setSelected(new Set(available.map((i) => i.id)));
                }}
              >
                {selected.size === available.length ? 'مسح الكل' : 'اختار الكل'}
              </button>
            </div>

            {grouped.map((g) => (
              <div key={g.category} className="mt-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-extrabold">
                  {CATEGORY_PLURAL[g.category]}
                  <span className="text-xs font-bold text-faint">
                    {g.items.filter((i) => selected.has(i.id)).length}/{g.items.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {g.items.map((item) => {
                    const isSel = selected.has(item.id);
                    const isPin = pinned.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={cx(
                          'relative overflow-hidden rounded-2xl border-2 bg-card transition-all',
                          isSel ? 'border-ink' : 'border-transparent',
                        )}
                      >
                        <button type="button" onClick={() => toggleSelect(item.id)} className="block w-full" aria-pressed={isSel}>
                          <ItemImage item={item} className={cx('aspect-square p-2', !isSel && 'opacity-80')} />
                          <div className="truncate px-1.5 py-1 text-center text-[11px] font-bold text-ink-soft">
                            {item.colorName}
                          </div>
                        </button>
                        {isSel && (
                          <span className="pointer-events-none absolute start-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink text-white">
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => togglePin(item.id)}
                          aria-label={isPin ? 'إلغاء التثبيت' : 'تثبيت'}
                          className={cx(
                            'absolute end-1.5 top-1.5 grid size-7 place-items-center rounded-full transition-colors',
                            isPin ? 'bg-amber-400 text-ink' : 'bg-white/90 text-faint',
                          )}
                        >
                          <Pin className={cx('size-3.5', isPin && 'fill-current')} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="sticky bottom-nav-offset z-20 mt-5">
              <PrimaryButton
                disabled={!quickReady || loading}
                onClick={() => void run({ mode: 'quick', pinnedIds: pinned, selectedIds: selected })}
                className="shadow-float"
              >
                {loading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
                طلّع لي أطقم لايقة
              </PrimaryButton>
              <p className="mt-1.5 text-center text-xs font-semibold text-muted">{quickHint}</p>
            </div>
          </section>
        ) : (
          <section>
            <div className="mt-2 text-[13px] font-bold text-muted">رايح فين؟</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
                <Chip key={o} active={occasion === o} onClick={() => setOccasion(o)} className="h-12 justify-center rounded-2xl text-[15px]">
                  {OCCASION_LABELS[o]}
                </Chip>
              ))}
            </div>
            <div className="mt-5 text-[13px] font-bold text-muted">الجو عامل إزاي؟</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.keys(WEATHER_LABELS) as Weather[]).map((w) => (
                <Chip key={w} active={weather === w} onClick={() => setWeather(w)} className="h-12 justify-center rounded-2xl">
                  {w === 'cold' ? '🧥 ' : w === 'mild' ? '🌤️ ' : '☀️ '}
                  {WEATHER_LABELS[w]}
                </Chip>
              ))}
            </div>

            {pinned.length > 0 && (
              <div className="mt-5">
                <div className="text-[13px] font-bold text-muted">قطع لازم تتلبس</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pinned.map((id) => {
                    const it = byId.get(id);
                    if (!it) return null;
                    return (
                      <span key={id} className="flex items-center gap-2 rounded-2xl bg-card p-1.5 pe-2 shadow-card">
                        <ItemImage item={it} className="size-10 rounded-xl p-1" />
                        <span className="text-sm font-bold">
                          {CATEGORY_LABELS[it.category]} {it.colorName}
                        </span>
                        <button type="button" onClick={() => setPinned((p) => p.filter((x) => x !== id))} aria-label="إلغاء" className="grid size-7 place-items-center rounded-full bg-cutout">
                          <PinOff className="size-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="sticky bottom-nav-offset z-20 mt-6">
              <PrimaryButton disabled={loading} onClick={() => void run({ mode: 'context', pinnedIds: pinned, occasion, weather })} className="shadow-float">
                {loading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
                طلّع لي أطقم
              </PrimaryButton>
              <p className="mt-1.5 text-center text-xs font-semibold text-muted">من كل الـ {available.length} قطعة المتاحة في دولابك</p>
            </div>
          </section>
        )}

        <div ref={resultsRef} className="scroll-mt-40">
          {loading && (
            <div className="mt-8 flex flex-col items-center gap-3 text-muted">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-sm font-bold">{aiOn ? 'الستايليست بيفكّر...' : 'بنظبط الألوان والطبقات...'}</span>
            </div>
          )}
          {result && !loading && (
            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">الأطقم المقترحة</h2>
                <button type="button" onClick={() => setResult(null)} className="grid size-8 place-items-center rounded-full bg-cutout text-muted" aria-label="إخفاء">
                  <X className="size-4" />
                </button>
              </div>
              {result.fallbackReason && (
                <div className="mb-3 flex items-start gap-2 rounded-2xl bg-ai-soft p-3 text-[13px] font-semibold leading-6 text-ai">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  {result.fallbackReason}
                </div>
              )}
              {result.errorAr && (
                <div className="rounded-3xl bg-card p-5 text-center shadow-card">
                  <p className="font-bold">{result.errorAr}</p>
                </div>
              )}
              <div className="flex flex-col gap-4">
                {result.suggestions.map((s, idx) => {
                  const items = s.itemIds.map((id) => byId.get(id)).filter((x): x is StoredItem => Boolean(x));
                  const meta = { title: s.title, reasonAr: s.reasonAr, shoeTipAr: s.shoeTipAr };
                  return (
                    <OutfitCard
                      key={s.key}
                      items={items}
                      title={s.title}
                      reasonAr={s.reasonAr}
                      shoeTipAr={s.shoeTipAr}
                      warnings={s.warnings}
                      missingCount={s.itemIds.length - items.length}
                      badge={<SourceBadge source={s.source} rank={idx} />}
                      actions={
                        <OutfitActions
                          isFavorite={favoriteKeys.has(setKey(s.itemIds))}
                          onToggleFavorite={() => void toggleFavorite(s.itemIds, meta)}
                          onWear={(laundry) => wear(s.itemIds, meta, laundry)}
                          defaultLaundry={settings.autoLaundryOnWear}
                        />
                      }
                    />
                  );
                })}
              </div>
              {result.suggestions.length === 1 && (
                <p className="mt-3 text-center text-xs font-semibold text-muted">ده الطقم الوحيد اللايق من القطع دي — ضيف قطع أكتر لاختيارات أكتر.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
