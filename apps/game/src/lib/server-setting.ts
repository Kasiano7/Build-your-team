/**
 * Game-server address chosen by a tester (preview/dev builds only), persisted
 * on the device and applied before the first connection.
 */
import { useSyncExternalStore } from 'react';
import { gameClient } from '@/state/game-client';
import { canOverrideServer, normaliseServerUrl, serverUrl, setServerOverride } from './config';
import { getItem, keys, removeItem, setItem } from './storage';

let ready = !canOverrideServer;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Resolves once the stored address (if any) is applied. */
export const serverSettingReady: Promise<void> = canOverrideServer
  ? getItem(keys.serverUrl).then((saved) => {
      if (saved) {
        setServerOverride(saved);
        gameClient.reconnect(); // no-op unless a socket was already opened
      }
      ready = true;
      notify();
    })
  : Promise.resolve();

export async function saveServerUrl(input: string | null): Promise<string | null> {
  const url = input ? normaliseServerUrl(input) : null;
  if (input && !url) throw new Error('INVALID_URL');
  if (url) await setItem(keys.serverUrl, url);
  else await removeItem(keys.serverUrl);
  setServerOverride(url);
  gameClient.reconnect();
  notify();
  return url;
}

/** GET /health on a candidate server. */
export async function probeServer(input: string): Promise<{ ok: true; db: string } | { ok: false; reason: string }> {
  const url = normaliseServerUrl(input);
  if (!url) return { ok: false, reason: 'Adresse invalide' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    const body = (await res.json()) as { ok?: boolean; db?: string };
    return body.ok ? { ok: true, db: body.db ?? '?' } : { ok: false, reason: `Réponse inattendue (${res.status})` };
  } catch {
    return { ok: false, reason: 'Serveur injoignable (même Wi-Fi ? pare-feu ?)' };
  } finally {
    clearTimeout(timer);
  }
}

export function useServerSetting(): { ready: boolean; url: string } {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
  return { ready, url: serverUrl() };
}
