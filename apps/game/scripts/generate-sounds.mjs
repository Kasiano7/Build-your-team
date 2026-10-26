/**
 * Synthesises the game's short UI sounds (original, royalty free) as 16-bit WAV.
 *   node scripts/generate-sounds.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RATE = 44100;
const out = (name, samples) => {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.85 / peak : 1;
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * norm)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  writeFileSync(resolve(import.meta.dirname, '../assets/sounds', `${name}.wav`), Buffer.concat([header, data]));
};
const buf = (sec) => new Float64Array(Math.round(sec * RATE));
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
/** Add a tone with exponential decay and optional pitch glide. */
function tone(b, { start = 0, dur, f0, f1 = f0, amp = 1, attack = 0.004, decay = 6, harmonics = [1] }) {
  const s0 = Math.round(start * RATE);
  const n = Math.round(dur * RATE);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < b.length; i++) {
    const t = i / RATE;
    const f = f0 * Math.pow(f1 / f0, i / n);
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    let v = 0;
    harmonics.forEach((h, k) => (v += Math.sin(phase * (k + 1)) * h));
    b[s0 + i] += v * env * amp;
  }
}
function hiss(b, { start = 0, dur, amp = 1, attack = 0.01, decay = 8, lp = 0.2, rise = false }) {
  const s0 = Math.round(start * RATE);
  const n = Math.round(dur * RATE);
  let y = 0;
  for (let i = 0; i < n && s0 + i < b.length; i++) {
    const t = i / RATE;
    const a = rise ? lp * (0.2 + (0.8 * i) / n) : lp;
    y += a * (noise() - y);
    const env = rise ? Math.pow(i / n, 1.5) * Math.exp(-decay * Math.max(0, t - dur * 0.85)) : Math.min(1, t / attack) * Math.exp(-decay * t);
    b[s0 + i] += y * env * amp;
  }
}

// Card reveal: filtered rising whoosh + bright chord.
{ const b = buf(0.9); hiss(b, { dur: 0.55, amp: 0.9, lp: 0.12, rise: true, decay: 30 });
  tone(b, { start: 0.5, dur: 0.4, f0: 659, amp: 0.35, decay: 7, harmonics: [1, 0.3] });
  tone(b, { start: 0.5, dur: 0.4, f0: 988, amp: 0.25, decay: 8 }); out('reveal', b); }
// Bid: crisp pluck.
{ const b = buf(0.22); tone(b, { dur: 0.22, f0: 1320, f1: 1180, amp: 0.8, decay: 22, harmonics: [1, 0.4, 0.15] });
  tone(b, { dur: 0.1, f0: 2640, amp: 0.2, decay: 50 }); out('bid', b); }
// Outbid alert (someone else raised).
{ const b = buf(0.25); tone(b, { dur: 0.12, f0: 880, amp: 0.6, decay: 18 }); tone(b, { start: 0.09, dur: 0.15, f0: 1175, amp: 0.6, decay: 16 }); out('raise', b); }
// Countdown tick.
{ const b = buf(0.08); tone(b, { dur: 0.08, f0: 1900, amp: 0.6, decay: 60, harmonics: [1, 0.2] }); out('tick', b); }
// Sold: gavel thump + chime.
{ const b = buf(1.0); tone(b, { dur: 0.25, f0: 140, f1: 70, amp: 1, decay: 18 }); hiss(b, { dur: 0.06, amp: 0.5, lp: 0.5, decay: 60 });
  [784, 988, 1175].forEach((f, i) => tone(b, { start: 0.12 + i * 0.07, dur: 0.7, f0: f, amp: 0.3, decay: 4.5, harmonics: [1, 0.25] })); out('sold', b); }
// Unsold: low descending.
{ const b = buf(0.5); tone(b, { dur: 0.45, f0: 330, f1: 196, amp: 0.6, decay: 6, harmonics: [1, 0.3] }); out('unsold', b); }
// Pass: soft tap.
{ const b = buf(0.12); tone(b, { dur: 0.12, f0: 420, f1: 360, amp: 0.5, decay: 30 }); out('pass', b); }
// Join: two-note blip.
{ const b = buf(0.3); tone(b, { dur: 0.12, f0: 587, amp: 0.5, decay: 14 }); tone(b, { start: 0.1, dur: 0.18, f0: 880, amp: 0.5, decay: 12 }); out('join', b); }
// Error: muted buzz.
{ const b = buf(0.22); tone(b, { dur: 0.22, f0: 160, amp: 0.6, decay: 10, harmonics: [1, 0.5, 0.33, 0.25] }); out('error', b); }
// Win: fanfare arpeggio + shimmer.
{ const b = buf(1.8); [523, 659, 784, 1047].forEach((f, i) => tone(b, { start: i * 0.12, dur: 1.2, f0: f, amp: 0.4, decay: 2.8, harmonics: [1, 0.4, 0.2] }));
  tone(b, { start: 0.48, dur: 1.3, f0: 1568, amp: 0.15, decay: 2.5 }); hiss(b, { start: 0.45, dur: 1.2, amp: 0.15, lp: 0.6, decay: 3 }); out('win', b); }
console.log('sounds written');
