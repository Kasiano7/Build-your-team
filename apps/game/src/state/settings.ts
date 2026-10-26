import { useSyncExternalStore } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { getJSON, keys, setJSON } from '@/lib/storage';

export interface Settings {
  volume: number;
  muted: boolean;
  /** 'system' follows the OS accessibility setting. */
  reduceMotion: 'system' | 'on' | 'off';
  haptics: boolean;
}

const DEFAULTS: Settings = { volume: 0.7, muted: false, reduceMotion: 'system', haptics: true };

let current: Settings = DEFAULTS;
const listeners = new Set<() => void>();

void getJSON<Partial<Settings>>(keys.settings).then((saved) => {
  if (saved) {
    current = { ...DEFAULTS, ...saved };
    listeners.forEach((l) => l());
  }
});

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  void setJSON(keys.settings, current);
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

/** Whether animations should be reduced (user setting or OS preference). */
export function useReduceMotion(): boolean {
  const s = useSettings();
  const system = useReducedMotion();
  return s.reduceMotion === 'on' || (s.reduceMotion === 'system' && system);
}
