/**
 * Small key/value storage: SecureStore on iOS/Android (guest session tokens are
 * credentials), localStorage on the web. All failures are swallowed — the game
 * must still work in private browsing, only without reconnection memory.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  try {
    if (web) return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (web) localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (web) localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const setJSON = (key: string, value: unknown) => setItem(key, JSON.stringify(value));

/** SecureStore keys only allow [A-Za-z0-9._-]. */
export const keys = {
  session: (code: string) => `byt.session.${code}`,
  lastRoom: 'byt.lastRoom',
  spectator: (code: string) => `byt.spectator.${code}`,
  settings: 'byt.settings',
  nickname: 'byt.nickname',
  serverUrl: 'byt.serverUrl',
};
