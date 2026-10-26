import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Realtime server URL.
 *  1. EXPO_PUBLIC_SERVER_URL (production / preview builds)
 *  2. web dev: same host as the page, port 4000
 *  3. native dev: the Metro host (LAN IP), port 4000
 */
export function serverUrl(): string {
  const env = process.env.EXPO_PUBLIC_SERVER_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

/** Public web origin used in invitation and spectator links. */
export function webOrigin(): string {
  const env = process.env.EXPO_PUBLIC_WEB_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'https://buildyourteam.app';
}

export const inviteLink = (code: string) => `${webOrigin()}/r/${code}`;
export const spectatorLink = (code: string) => `${webOrigin()}/vote/${code}`;
export const resultLink = (code: string) => `${webOrigin()}/vote/${code}`;
