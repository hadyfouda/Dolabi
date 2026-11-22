import { useSyncExternalStore } from 'react';
import { getSettings, subscribeSettings, updateSettings } from '../services/settings';
import type { AppSettings } from '../types';

export function useSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const settings = useSyncExternalStore(subscribeSettings, getSettings, getSettings);
  return [settings, updateSettings];
}
