import { useCallback, useEffect, useState } from 'react';

/** Chromium-only event (Android Chrome / Edge / desktop). Not in lib.dom yet. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Navigator {
    /** iOS Safari home-screen web app flag */
    readonly standalone?: boolean;
  }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  const iDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iDevice || iPadOs;
}

/** Safari proper — other iOS browsers (CriOS, FxiOS, EdgiOS…) can't "Add to Home Screen" the same way on older iOS. */
export function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV|Line\//.test(ua);
}

let deferredEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
// Capture as early as possible (the event can fire before React mounts).
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredEvent = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    listeners.forEach((l) => l());
  });
}

export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState<boolean>(() => deferredEvent !== null);
  const [standalone, setStandalone] = useState<boolean>(() => isStandalone());

  useEffect(() => {
    const update = () => setCanPrompt(deferredEvent !== null);
    listeners.add(update);
    const mq = window.matchMedia('(display-mode: standalone)');
    const onMode = () => setStandalone(isStandalone());
    mq.addEventListener('change', onMode);
    return () => {
      listeners.delete(update);
      mq.removeEventListener('change', onMode);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    const ev = deferredEvent;
    if (!ev) return false;
    await ev.prompt();
    const choice = await ev.userChoice;
    deferredEvent = null;
    setCanPrompt(false);
    return choice.outcome === 'accepted';
  }, []);

  return { canPrompt, standalone, promptInstall };
}
