import type { AppSettings } from '../types';

const KEY = 'dolabi.settings.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  aiEnabled: false,
  aiProvider: 'gemini',
  geminiKey: '',
  anthropicKey: '',
  geminiModel: 'gemini-3.6-flash',
  anthropicModel: 'claude-haiku-5-5',
  autoLaundryOnWear: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: AppSettings | null = null;

function safeParse(raw: string | null): Partial<AppSettings> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return typeof v === 'object' && v !== null ? (v as Partial<AppSettings>) : {};
  } catch {
    return {};
  }
}

export function getSettings(): AppSettings {
  if (cache) return cache;
  let stored: Partial<AppSettings> = {};
  try {
    stored = safeParse(localStorage.getItem(KEY));
  } catch {
    // storage blocked (private mode) — run on defaults
  }
  cache = { ...DEFAULT_SETTINGS, ...stored };
  return cache;
}

export function updateSettings(patch: Partial<AppSettings>): void {
  cache = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // ignore quota / private-mode errors; in-memory value still applies
  }
  listeners.forEach((l) => l());
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function activeApiKey(s: AppSettings): string {
  return (s.aiProvider === 'gemini' ? s.geminiKey : s.anthropicKey).trim();
}

export function isAiReady(s: AppSettings): boolean {
  return s.aiEnabled && activeApiKey(s).length > 10;
}
