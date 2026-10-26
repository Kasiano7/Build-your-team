/**
 * Short UI sounds (synthesised originals in assets/sounds, see scripts/generate-sounds.mjs).
 * Respect the volume / mute settings. Players are created lazily once.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { getSettings } from '@/state/settings';

const SOURCES = {
  reveal: require('../../assets/sounds/reveal.wav'),
  bid: require('../../assets/sounds/bid.wav'),
  raise: require('../../assets/sounds/raise.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  sold: require('../../assets/sounds/sold.wav'),
  unsold: require('../../assets/sounds/unsold.wav'),
  pass: require('../../assets/sounds/pass.wav'),
  join: require('../../assets/sounds/join.wav'),
  error: require('../../assets/sounds/error.wav'),
  win: require('../../assets/sounds/win.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

function player(name: SoundName): AudioPlayer | null {
  try {
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players.set(name, p);
    }
    return p;
  } catch {
    return null;
  }
}

export function playSound(name: SoundName) {
  const { muted, volume } = getSettings();
  if (muted || volume <= 0) return;
  if (!modeSet) {
    modeSet = true;
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
  }
  const p = player(name);
  if (!p) return;
  try {
    p.volume = volume;
    void p.seekTo(0);
    p.play();
  } catch {
    // Autoplay restrictions on the web before the first user gesture.
  }
}

export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web' || !getSettings().haptics) return;
  if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

/** Preload on web after the first interaction so the first auction is not silent. */
export function warmUpSounds() {
  (Object.keys(SOURCES) as SoundName[]).forEach((n) => player(n));
}
