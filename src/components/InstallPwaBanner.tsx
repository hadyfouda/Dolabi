import { useState } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { isIosSafari, useInstallPrompt } from '../hooks/useInstallPrompt';

const DISMISS_KEY = 'dolabi.installBanner.dismissedAt';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Smart install prompt:
 *  - hidden when already running as an installed app (standalone)
 *  - Android Chrome/Edge: 1-tap native install via `beforeinstallprompt`
 *  - iOS Safari: step-by-step "Share → Add to Home Screen" guide
 */
export function InstallPwaBanner() {
  const { canPrompt, standalone, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState<boolean>(() => recentlyDismissed());
  const [ios] = useState<boolean>(() => isIosSafari());

  if (standalone || dismissed) return null;
  if (!canPrompt && !ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-nav-offset z-40 flex justify-center px-3">
      <div className="relative w-full max-w-lg animate-pop rounded-3xl bg-ink p-4 text-white shadow-float">
        <button
          type="button"
          onClick={dismiss}
          className="absolute start-auto end-3 top-3 grid size-8 place-items-center rounded-full bg-white/10"
          aria-label="إخفاء"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3 pe-10">
          <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="size-12 rounded-2xl" />
          <div>
            <div className="font-extrabold">ثبّت دولابي كتطبيق على موبايلك</div>
            <div className="text-xs text-white/70">يفتح على طول، ويشتغل من غير نت</div>
          </div>
        </div>

        {canPrompt ? (
          <button
            type="button"
            onClick={() => void promptInstall().then((ok) => ok && setDismissed(true))}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-ink active:scale-[0.98]"
          >
            <Download className="size-4" />
            تثبيت التطبيق
          </button>
        ) : (
          <div className="mt-3 rounded-2xl bg-white/10 p-3 text-[13px] leading-7">
            <div className="font-bold">لتثبيت التطبيق على الآيفون:</div>
            <div className="flex flex-wrap items-center gap-1">
              ١. اضغط على زر المشاركة (Share)
              <Share className="inline size-4" />
              بالأسفل
            </div>
            <div className="flex flex-wrap items-center gap-1">
              ٢. اختر (إضافة إلى الشاشة الرئيسية / Add to Home Screen)
              <PlusSquare className="inline size-4" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
