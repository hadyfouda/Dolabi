import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bot,
  Database,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  WashingMachine,
} from 'lucide-react';
import { clearAllData, db, exportBackup, importBackup } from '../db/wardrobeDb';
import { testAiConnection } from '../services/aiStylist';
import { activeApiKey, DEFAULT_SETTINGS } from '../services/settings';
import type { AiProvider } from '../types';
import { useInstallPrompt, isIosSafari } from '../hooks/useInstallPrompt';
import { useSettings } from '../hooks/useSettings';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { Segmented, cx } from '../components/ui';

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-[28px] bg-card p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
        <span className="grid size-8 place-items-center rounded-xl bg-cutout">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-1 text-start">
      <div className="flex-1">
        <div className="text-[15px] font-bold">{label}</div>
        {hint && <div className="mt-0.5 text-xs leading-5 text-muted">{hint}</div>}
      </div>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-line')}>
        <span className={cx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'start-[22px]' : 'start-0.5')} />
      </span>
    </button>
  );
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'نسخة دولابي الاحتياطية' });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function SettingsScreen() {
  const toast = useToast();
  const [settings, update] = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const { canPrompt, standalone, promptInstall } = useInstallPrompt();
  const counts = useLiveQuery(async () => ({
    items: await db.items.count(),
    outfits: await db.outfits.count(),
    wear: await db.wearHistory.count(),
  }), []);

  const refreshStorage = async () => {
    if (!navigator.storage?.estimate) return;
    const est = await navigator.storage.estimate();
    const persisted = (await navigator.storage.persisted?.()) ?? false;
    setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
  };

  useEffect(() => {
    void refreshStorage();
  }, [counts]);

  const keyField = settings.aiProvider === 'gemini' ? 'geminiKey' : 'anthropicKey';
  const modelField = settings.aiProvider === 'gemini' ? 'geminiModel' : 'anthropicModel';

  const test = async () => {
    setTesting(true);
    try {
      await testAiConnection(settings);
      toast.show('المفتاح شغال ✓');
    } catch (err) {
      toast.show(`المفتاح مش شغال: ${err instanceof Error ? err.message.slice(0, 80) : ''}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const doExport = async () => {
    setBusy('export');
    try {
      const blob = await exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      await shareOrDownload(blob, `dolabi-backup-${date}.json`);
    } catch (err) {
      console.error(err);
      toast.show('حصلت مشكلة في التصدير', 'error');
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    if (!window.confirm('الاستيراد هيستبدل كل الهدوم والأطقم الموجودة دلوقتي. نكمّل؟')) return;
    setBusy('import');
    try {
      const s = await importBackup(file);
      toast.show(`اتسترجع ${s.items} قطعة و${s.outfits} طقم`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'فشل الاستيراد', 'error');
    } finally {
      setBusy(null);
    }
  };

  const clearCache = async () => {
    if (!('caches' in window)) return;
    const names = await caches.keys();
    // keep the precached app shell so the app still opens offline
    const toDelete = names.filter((n) => !n.startsWith('workbox-precache'));
    await Promise.all(toDelete.map((n) => caches.delete(n)));
    await refreshStorage();
    toast.show(toDelete.length ? 'اتمسح الكاش (نموذج القص هيتنزّل تاني أول ما تحتاجه)' : 'الكاش فاضي أصلًا', 'info');
  };

  const wipe = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      setTimeout(() => setConfirmWipe(false), 4000);
      return;
    }
    await clearAllData();
    setConfirmWipe(false);
    toast.show('اتمسحت كل البيانات', 'info');
  };

  return (
    <div className="pb-nav">
      <ScreenHeader title="الإعدادات" />
      <main className="mx-auto max-w-2xl px-safe">
        {!standalone && (canPrompt || isIosSafari()) && (
          <Card icon={<Smartphone className="size-4" />} title="تثبيت التطبيق">
            {canPrompt ? (
              <button
                type="button"
                onClick={() => void promptInstall()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-bold text-white"
              >
                <Download className="size-4" /> ثبّت دولابي كتطبيق على موبايلك
              </button>
            ) : (
              <p className="text-sm leading-7 text-ink-soft">
                لتثبيت التطبيق على الآيفون: اضغط على زر المشاركة (Share) بالأسفل، ثم اختر (إضافة إلى الشاشة الرئيسية / Add to Home Screen).
              </p>
            )}
          </Card>
        )}

        <Card icon={<Bot className="size-4" />} title="الستايليست الذكي (اختياري)">
          <Toggle
            checked={settings.aiEnabled}
            onChange={(v) => update({ aiEnabled: v })}
            label="استخدم AI لتنسيق أذكى"
            hint="لو مفيش نت أو حصل خطأ، التطبيق بيرجع تلقائيًا للمنسّق الداخلي."
          />
          {settings.aiEnabled && (
            <div className="mt-4 space-y-3">
              <Segmented<AiProvider>
                value={settings.aiProvider}
                onChange={(v) => update({ aiProvider: v })}
                options={[
                  { value: 'gemini', label: 'Gemini' },
                  { value: 'anthropic', label: 'Claude' },
                ]}
              />
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold text-muted">
                  مفتاح {settings.aiProvider === 'gemini' ? 'Gemini' : 'Claude'} API
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-cutout px-3">
                  <input
                    type={showKey ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="off"
                    spellCheck={false}
                    value={settings[keyField]}
                    onChange={(e) => update({ [keyField]: e.target.value.trim() })}
                    placeholder={settings.aiProvider === 'gemini' ? 'AIza...' : 'sk-ant-...'}
                    className="h-12 min-w-0 flex-1 bg-transparent outline-none"
                  />
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="text-muted" aria-label="إظهار المفتاح">
                    {showKey ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold text-muted">الموديل</span>
                <input
                  dir="ltr"
                  value={settings[modelField]}
                  onChange={(e) => update({ [modelField]: e.target.value })}
                  placeholder={DEFAULT_SETTINGS[modelField]}
                  className="h-12 w-full rounded-2xl border border-line bg-cutout px-3 outline-none"
                />
              </label>
              <button
                type="button"
                disabled={testing || activeApiKey(settings).length < 10}
                onClick={() => void test()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line text-sm font-bold disabled:opacity-50"
              >
                {testing && <Loader2 className="size-4 animate-spin" />} جرّب المفتاح
              </button>
              <p className="flex items-start gap-2 rounded-2xl bg-cutout p-3 text-xs leading-6 text-muted">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                المفتاح متخزّن على موبايلك بس. بنبعت بيانات وصفية خفيفة (النوع، اللون، الرسمية) — مش صور هدومك.
              </p>
            </div>
          )}
        </Card>

        <Card icon={<WashingMachine className="size-4" />} title="الغسيل">
          <Toggle
            checked={settings.autoLaundryOnWear}
            onChange={(v) => update({ autoLaundryOnWear: v })}
            label='اقترح "للغسيل" كاختيار أساسي'
            hint='لما تضغط "هلبس ده النهارده" هيبقى زرار الغسيل هو الأساسي.'
          />
        </Card>

        <Card icon={<Database className="size-4" />} title="نسخة احتياطية">
          <p className="mb-3 text-sm leading-6 text-muted">
            {counts ? `${counts.items} قطعة · ${counts.outfits} طقم · ${counts.wear} مرة لبس` : '...'} — كله متخزّن على الجهاز ده بس.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void doExport()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-bold text-white disabled:opacity-60"
            >
              {busy === 'export' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} تصدير
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => importRef.current?.click()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line text-sm font-bold disabled:opacity-60"
            >
              {busy === 'import' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} استيراد
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void doImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Card>

        <Card icon={<HardDrive className="size-4" />} title="التخزين">
          {storage && (
            <div className="mb-3 text-sm leading-7 text-ink-soft">
              <div>
                مستخدم: <b dir="ltr">{formatBytes(storage.usage)}</b>
                {storage.quota > 0 && <span className="text-muted"> من {formatBytes(storage.quota)}</span>}
              </div>
              <div className={storage.persisted ? 'text-ok' : 'text-wash'}>
                {storage.persisted ? '✓ التخزين محمي — المتصفح مش هيمسح بياناتك' : 'التخزين مش محمي بالكامل — ثبّت التطبيق عشان بياناتك تتحفظ دايمًا'}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void clearCache()} className="h-12 rounded-2xl border border-line text-sm font-bold">
              مسح الكاش
            </button>
            <button
              type="button"
              onClick={() => void wipe()}
              className={cx(
                'flex h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold',
                confirmWipe ? 'bg-danger text-white' : 'bg-danger-soft text-danger',
              )}
            >
              <Trash2 className="size-4" />
              {confirmWipe ? 'متأكد؟ اضغط تاني' : 'مسح كل البيانات'}
            </button>
          </div>
        </Card>

        <p className="mb-2 mt-6 text-center text-xs font-semibold text-faint">دولابي v1.0 · التفريغ بيتم على جهازك بالكامل</p>
      </main>
    </div>
  );
}
