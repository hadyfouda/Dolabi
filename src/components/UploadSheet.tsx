import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, ImagePlus, Loader2, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { addItems } from '../db/wardrobeDb';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { CATEGORY_LABELS, CATEGORY_ORDER, DEFAULT_FORMALITY, DEFAULT_SEASON } from '../labels';
import {
  describeProcessingError,
  processGarmentImage,
  type ProcessedImage,
  type ProcessingProgress,
} from '../services/imageProcessor';
import type { Category, WardrobeItem } from '../types';
import { Sheet } from './Sheet';
import { TagEditor, type ItemTags } from './TagEditor';
import { useToast } from './Toast';
import { Chip, ColorDot, PrimaryButton, cx } from './ui';

type DraftStatus = 'queued' | 'processing' | 'ready' | 'error';

interface Draft {
  id: number;
  file: File;
  status: DraftStatus;
  removeBg: boolean;
  result?: ProcessedImage;
  error?: string;
  tags: ItemTags;
  categoryTouched: boolean;
}

function defaultTags(category: Category): ItemTags {
  return {
    category,
    colorName: 'رصاصي',
    colorHex: '#8E9196',
    pattern: 'solid',
    formality: DEFAULT_FORMALITY[category],
    season: DEFAULT_SEASON[category],
  };
}

let draftSeq = 0;

function DraftThumb({ draft }: { draft: Draft }) {
  const url = useObjectUrl(draft.result?.blob ?? draft.file);
  return (
    <div className="cutout-box relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl">
      {url && (
        <img
          src={url}
          alt=""
          className={cx('h-full w-full', draft.result ? 'object-contain p-1.5' : 'object-cover opacity-50 blur-[1px]')}
        />
      )}
      {draft.status === 'processing' && <Loader2 className="absolute size-7 animate-spin text-ink" />}
    </div>
  );
}

export function UploadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [batchCategory, setBatchCategory] = useState<Category>('shirt');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const busyRef = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // reset when closed
  useEffect(() => {
    if (!open) {
      setDrafts([]);
      setProgress(null);
      setExpanded(null);
    }
  }, [open]);

  // sequential processing queue (one image at a time keeps mobile memory low)
  useEffect(() => {
    if (busyRef.current || !open) return;
    const next = drafts.find((d) => d.status === 'queued');
    if (!next) return;
    busyRef.current = true;
    setDrafts((ds) => ds.map((d) => (d.id === next.id ? { ...d, status: 'processing' } : d)));
    processGarmentImage(next.file, { removeBackground: next.removeBg, onProgress: setProgress })
      .then((result) => {
        setDrafts((ds) =>
          ds.map((d) =>
            d.id === next.id
              ? { ...d, status: 'ready', result, tags: { ...d.tags, colorName: result.color.nameAr, colorHex: result.colorHex } }
              : d,
          ),
        );
      })
      .catch((err: unknown) => {
        console.error('[dolabi] processing failed', err);
        setDrafts((ds) => ds.map((d) => (d.id === next.id ? { ...d, status: 'error', error: describeProcessingError(err) } : d)));
      })
      .finally(() => {
        busyRef.current = false;
        setProgress(null);
        setTick((t) => t + 1);
      });
  }, [drafts, tick, open]);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
      setDrafts((ds) => [
        ...ds,
        ...list.map<Draft>((file) => ({
          id: ++draftSeq,
          file,
          status: 'queued',
          removeBg: true,
          tags: defaultTags(batchCategory),
          categoryTouched: false,
        })),
      ]);
    },
    [batchCategory],
  );

  const changeBatchCategory = (c: Category) => {
    setBatchCategory(c);
    setDrafts((ds) =>
      ds.map((d) =>
        d.categoryTouched
          ? d
          : { ...d, tags: { ...d.tags, category: c, formality: DEFAULT_FORMALITY[c], season: DEFAULT_SEASON[c] } },
      ),
    );
  };

  const patchDraft = (id: number, patch: Partial<ItemTags>) => {
    setDrafts((ds) =>
      ds.map((d) => {
        if (d.id !== id) return d;
        const tags = { ...d.tags, ...patch };
        if (patch.category && patch.category !== d.tags.category) {
          tags.formality = DEFAULT_FORMALITY[patch.category];
          tags.season = DEFAULT_SEASON[patch.category];
        }
        return { ...d, tags, categoryTouched: d.categoryTouched || Boolean(patch.category) };
      }),
    );
  };

  const retry = (id: number, removeBg: boolean) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, status: 'queued', removeBg, error: undefined } : d)));

  const removeDraft = (id: number) => setDrafts((ds) => ds.filter((d) => d.id !== id));

  const processing = drafts.some((d) => d.status === 'queued' || d.status === 'processing');
  const ready = drafts.filter((d) => d.status === 'ready' && d.result);
  const doneCount = drafts.filter((d) => d.status === 'ready' || d.status === 'error').length;

  const save = async () => {
    if (!ready.length) return;
    setSaving(true);
    try {
      const now = Date.now();
      const items: Omit<WardrobeItem, 'id'>[] = ready.map((d, i) => ({
        imageBlob: (d.result as ProcessedImage).blob,
        ...d.tags,
        status: 'available',
        createdAt: now + i,
      }));
      await addItems(items);
      toast.show(items.length === 1 ? 'اتضافت القطعة للدولاب' : `اتضاف ${items.length} قطع للدولاب`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.show('مقدرناش نحفظ — يمكن مساحة التخزين خلصت', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      locked={processing || saving}
      title="إضافة هدوم"
      footer={
        drafts.length > 0 ? (
          <PrimaryButton disabled={!ready.length || processing || saving} onClick={() => void save()}>
            {processing ? (
              <>
                <Loader2 className="size-5 animate-spin" /> بنجهّز الصور ({doneCount}/{drafts.length})
              </>
            ) : (
              `حفظ ${ready.length} ${ready.length === 1 ? 'قطعة' : 'قطع'} في الدولاب`
            )}
          </PrimaryButton>
        ) : undefined
      }
    >
      <div className="text-[13px] font-bold text-muted">بتضيف إيه؟</div>
      <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
        {CATEGORY_ORDER.map((c) => (
          <Chip key={c} active={batchCategory === c} onClick={() => changeBatchCategory(c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-3xl bg-ink font-bold text-white active:scale-[0.98]"
        >
          <Camera className="size-7" />
          صوّر دلوقتي
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-3xl border border-line bg-cutout font-bold active:scale-[0.98]"
        >
          <ImagePlus className="size-7" />
          من المعرض (أكتر من صورة)
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {drafts.length === 0 && (
        <p className="mt-4 rounded-2xl bg-cutout p-3 text-[13px] leading-6 text-muted">
          💡 للحصول على أحسن قص: افرد القطعة على سرير أو أرضية سادة، وصوّرها من فوق بإضاءة كويسة. التفريغ بيتم على موبايلك
          نفسه — صورك مش بتطلع برّه الجهاز.
        </p>
      )}

      {progress && (
        <div className="mt-4 rounded-2xl bg-ai-soft p-3">
          <div className="flex items-center justify-between text-sm font-bold text-ai">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {progress.messageAr}
            </span>
            {progress.stage === 'loading-model' && progress.ratio > 0 && <span dir="ltr">{Math.round(progress.ratio * 100)}%</span>}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className={cx('h-full rounded-full bg-ai transition-all duration-300', progress.ratio === 0 && 'w-1/3 animate-pulse')}
              style={progress.ratio > 0 ? { width: `${Math.max(6, progress.ratio * 100)}%` } : undefined}
            />
          </div>
          {progress.stage === 'loading-model' && (
            <p className="mt-2 text-xs text-ai/80">أول مرة بس — بعد كده القص هيشتغل حتى من غير نت.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {drafts.map((d) => (
          <div key={d.id} className="rounded-3xl border border-line p-2.5">
            <div className="flex items-center gap-3">
              <DraftThumb draft={d} />
              <div className="min-w-0 flex-1">
                {d.status === 'error' ? (
                  <div className="flex items-start gap-1.5 text-[13px] font-semibold leading-5 text-danger">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>{d.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-bold">{CATEGORY_LABELS[d.tags.category]}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      {d.status === 'ready' ? (
                        <>
                          <ColorDot hex={d.tags.colorHex} />
                          {d.tags.colorName}
                          {d.result && !d.result.backgroundRemoved && <span>· بدون تفريغ</span>}
                        </>
                      ) : d.status === 'processing' ? (
                        'جاري التفريغ...'
                      ) : (
                        'في الانتظار...'
                      )}
                    </div>
                  </>
                )}
              </div>
              {d.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="flex h-9 items-center gap-1 rounded-full bg-cutout px-3 text-xs font-bold"
                >
                  تعديل
                  <ChevronDown className={cx('size-4 transition-transform', expanded === d.id && 'rotate-180')} />
                </button>
              )}
              {d.status !== 'processing' && (
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  className="grid size-9 place-items-center rounded-full text-faint active:bg-cutout"
                  aria-label="شيل الصورة"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>
            {d.status === 'error' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => retry(d.id, true)} className="flex h-9 items-center justify-center gap-1 rounded-xl bg-cutout text-xs font-bold">
                  <RotateCcw className="size-3.5" /> حاول تاني
                </button>
                <button type="button" onClick={() => retry(d.id, false)} className="h-9 rounded-xl bg-ink text-xs font-bold text-white">
                  احفظها من غير تفريغ
                </button>
              </div>
            )}
            {expanded === d.id && d.status === 'ready' && (
              <div className="px-1 pb-2">
                <TagEditor value={d.tags} onChange={(p) => patchDraft(d.id, p)} suggestedHex={d.result?.colorHex} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
