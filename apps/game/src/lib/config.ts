import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppVariant = 'development' | 'preview' | 'production';
export const appVariant: AppVariant = (Constants.expoConfig?.extra?.appVariant as AppVariant | undefined) ?? 'production';

/** Test builds (and local dev) let testers point the app at any game server. */
export const canOverrideServer = appVariant !== 'production' || __DEV__;

let override: string | null = null;

/** "192.168.1.20" → "http://192.168.1.20:4000"; keeps explicit schemes and ports. */
export function normaliseServerUrl(input: string): string | null {
  let s = input.trim().replace(/\/+$/, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    if (!u.port && u.protocol === 'http:') u.port = '4000';
    return u.origin;
  } catch {
    return null;
  }
}

export function setServerOverride(url: string | null) {
  override = url ? normaliseServerUrl(url) : null;
}

function defaultServerUrl(): string | null {
  const env = process.env.EXPO_PUBLIC_SERVER_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  // Native dev: the Metro host (LAN IP). Absent in standalone builds.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000` : null;
}

/**
 * Realtime server URL, by priority:
 *  1. address entered in Réglages (test builds only)
 *  2. EXPO_PUBLIC_SERVER_URL (baked at build time)
 *  3. web: same host as the page, port 4000 · native dev: the Metro host, port 4000
 */
export function serverUrl(): string {
  if (canOverrideServer && override) return override;
  return defaultServerUrl() ?? 'http://localhost:4000';
}

/** False when a standalone test build has no server to talk to yet. */
export function hasServerConfigured(): boolean {
  return (canOverrideServer && !!override) || defaultServerUrl() !== null;
}

/** Public web origin used in invitation and spectator links. */
export function webOrigin(): string {
  const env = process.env.EXPO_PUBLIC_WEB_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  // Test build talking to a PC on the LAN: invitations open that PC's web app (npm run dev:web, port 8081).
  if (canOverrideServer && override?.startsWith('http://')) {
    const u = new URL(override);
    return `http://${u.hostname}:8081`;
  }
  // Placeholder until the public domain exists: production builds must set EXPO_PUBLIC_WEB_URL (eas.json).
  return 'https://buildyourteam.app';
}

export const inviteLink = (code: string) => `${webOrigin()}/r/${code}`;
export const spectatorLink = (code: string) => `${webOrigin()}/vote/${code}`;
export const resultLink = (code: string) => `${webOrigin()}/vote/${code}`;
