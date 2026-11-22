import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, Heart, History, Trash2 } from 'lucide-react';
import { db, isStored, logWear, setFavorite } from '../db/wardrobeDb';
import { CATEGORY_LABELS, OCCASION_LABELS } from '../labels';
import type { Outfit, StoredItem, WearRecord } from '../types';
import { useSettings } from '../hooks/useSettings';
import { ItemsLegend, OutfitActions, OutfitCard, OutfitStack } from '../components/OutfitCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { ItemImage, Segmented } from '../components/ui';

type View = 'favorites' | 'history';

const dayFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' });

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return 'النهارده';
  if (diff === 1) return 'امبارح';
  return dayFmt.format(d);
}

export function SavedScreen({ onGoDress }: { onGoDress: () => void }) {
  const toast = useToast();
  const [settings] = useSettings();
  const [view, setView] = useState<View>('favorites');
  const items = useLiveQuery(async () => (await db.items.toArray()).filter(isStored), []);
  const favorites = useLiveQuery(
    async () => (await db.outfits.orderBy('createdAt').reverse().toArray()).filter((o) => o.isFavorite),
    [],
  );
  const history = useLiveQuery(() => db.wearHistory.orderBy('wornAt').reverse().limit(120).toArray(), []);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const resolve = (ids: number[]) => ids.map((id) => byId.get(id)).filter((x): x is StoredItem => Boolean(x));

  const groupedHistory = useMemo(() => {
    const groups: Array<{ label: string; records: WearRecord[] }> = [];
    for (const r of history ?? []) {
      const label = dayLabel(r.wornAt);
      const g = groups.find((x) => x.label === label);
      if (g) g.records.push(r);
      else groups.push({ label, records: [r] });
    }
    return groups;
  }, [history]);

  const wearFavorite = async (o: Outfit, laundry: boolean) => {
    await logWear(o.itemIds.filter((id) => byId.has(id)), o.id, laundry);
    toast.show(laundry ? 'اتسجّل والقطع راحت الغسيل' : 'اتسجّل في سجل اللبس');
  };

  return (
    <div className="pb-nav">
      <ScreenHeader title="المفضلة والسجل" subtitle="أطقمك المحفوظة وآخر حاجات لبستها">
        <div className="mt-3">
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'favorites', label: `المفضلة${favorites?.length ? ` (${favorites.length})` : ''}`, icon: <Heart className="size-4" /> },
              { value: 'history', label: 'سجل اللبس', icon: <History className="size-4" /> },
            ]}
          />
        </div>
      </ScreenHeader>

      <main className="mx-auto max-w-3xl px-safe">
        {view === 'favorites' ? (
          !favorites?.length ? (
            <Empty
              icon={<Heart className="size-10" />}
              title="لسه مفيش أطقم في المفضلة"
              body='من شاشة "هخرج دلوقتي" اضغط "حفظ في المفضلة" على أي طقم عجبك.'
              cta="نسّق طقم دلوقتي"
              onCta={onGoDress}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {favorites.map((o) => {
                const its = resolve(o.itemIds);
                return (
                  <OutfitCard
                    key={o.id}
                    items={its}
                    title={o.name.split(' — ')[0] || o.name}
                    reasonAr={o.reasonAr}
                    shoeTipAr={o.shoeTipAr}
                    missingCount={o.itemIds.length - its.length}
                    badge={
                      o.occasion !== 'quick' ? (
                        <span className="rounded-full bg-cutout px-2.5 py-1 text-[11px] font-bold text-muted">{OCCASION_LABELS[o.occasion]}</span>
                      ) : undefined
                    }
                    actions={
                      <OutfitActions
                        isFavorite
                        onToggleFavorite={() => {
                          if (o.id !== undefined) void setFavorite(o.id, false).then(() => toast.show('اتشال من المفضلة', 'info'));
                        }}
                        onWear={(laundry) => wearFavorite(o, laundry)}
                        defaultLaundry={settings.autoLaundryOnWear}
                      />
                    }
                  />
                );
              })}
            </div>
          )
        ) : !history?.length ? (
          <Empty
            icon={<CalendarDays className="size-10" />}
            title="السجل فاضي"
            body='لما تضغط "هلبس ده النهارده" على أي طقم، هيتسجل هنا — وده بيساعد المنسّق ميكررش نفس الطقم كل يوم.'
            cta="نسّق طقم دلوقتي"
            onCta={onGoDress}
          />
        ) : (
          <div className="space-y-6">
            {groupedHistory.map((g) => (
              <section key={g.label}>
                <h3 className="mb-2 text-sm font-extrabold text-muted">{g.label}</h3>
                <div className="space-y-3">
                  {g.records.map((r) => {
                    const its = resolve(r.itemIds);
                    return (
                      <div key={r.id} className="flex items-center gap-3 rounded-3xl bg-card p-2.5 shadow-card">
                        <div className="w-24 shrink-0">
                          {its.length >= 2 ? (
                            <OutfitStack items={its} compact />
                          ) : its[0] ? (
                            <ItemImage item={its[0]} className="aspect-square rounded-2xl p-2" />
                          ) : (
                            <div className="cutout-box aspect-square rounded-2xl" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 text-xs font-bold text-faint">{timeFmt.format(new Date(r.wornAt))}</div>
                          {its.length ? (
                            <ItemsLegend items={its} />
                          ) : (
                            <span className="text-sm text-muted">القطع دي اتمسحت من الدولاب</span>
                          )}
                          {its.length < r.itemIds.length && its.length > 0 && (
                            <div className="mt-1 text-xs text-faint">+ {r.itemIds.length - its.length} قطعة اتمسحت</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => r.id !== undefined && void db.wearHistory.delete(r.id)}
                          className="grid size-9 shrink-0 place-items-center self-start rounded-full text-faint active:bg-cutout"
                          aria-label={`مسح من السجل ${its.map((i) => CATEGORY_LABELS[i.category]).join(' ')}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Empty({ icon, title, body, cta, onCta }: { icon: ReactNode; title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div className="mx-auto mt-12 max-w-sm text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-[28px] bg-card text-faint shadow-card">{icon}</div>
      <h2 className="mt-5 text-lg font-extrabold">{title}</h2>
      <p className="mt-1.5 text-sm leading-7 text-muted">{body}</p>
      <button type="button" onClick={onCta} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">
        {cta}
      </button>
    </div>
  );
}
