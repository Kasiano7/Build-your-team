/**
 * Generates the original app icon, adaptive icon layers, splash mark and favicon from SVG.
 *   node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { resolve } from 'node:path';

const out = (f) => resolve(import.meta.dirname, '../assets/images', f);
const ACCENT = '#19E3C8';
const GOLD = '#D9B45F';

// The mark: a chamfered card plate carrying a pitch half-way line and centre circle.
const mark = (stroke = ACCENT, gold = GOLD, fill = '#10161D', sw = 26) => `
  <path d="M232 152 H704 L824 272 V872 H352 L232 752 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
  <rect x="${232 - sw / 2}" y="250" width="${sw * 1.6}" height="250" fill="${gold}"/>
  <path d="M318 560 H738" stroke="${stroke}" stroke-width="${sw * 0.7}" opacity="0.85"/>
  <circle cx="528" cy="560" r="104" fill="none" stroke="${stroke}" stroke-width="${sw * 0.7}" opacity="0.85"/>
  <circle cx="528" cy="560" r="14" fill="${stroke}"/>`;

const background = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="28%" r="80%">
      <stop offset="0" stop-color="#16303A"/>
      <stop offset="0.55" stop-color="#0A1015"/>
      <stop offset="1" stop-color="#05070A"/>
    </radialGradient>
    <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F3F27" stop-opacity="0"/>
      <stop offset="1" stop-color="#0F3F27" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <path d="M120 1024 L330 700 H694 L904 1024 Z" fill="url(#turf)"/>`;

const svg = (body, transparent = false) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${transparent ? '' : background}${body}</svg>`);

// iOS / generic icon: full bleed, no transparency.
await sharp(svg(`<g transform="translate(512 512) scale(0.78) translate(-528 -512)">${mark()}</g>`)).png().toFile(out('icon.png'));
// Android adaptive foreground: transparent, mark inside the 66% safe zone.
await sharp(svg(`<g transform="translate(512 512) scale(0.56) translate(-528 -512)">${mark()}</g>`, true)).png().toFile(out('android-icon-foreground.png'));
await sharp(svg(`<g transform="translate(512 512) scale(0.56) translate(-528 -512)">${mark('#FFFFFF', '#FFFFFF', 'none')}</g>`, true)).png().toFile(out('android-icon-monochrome.png'));
await sharp(svg('', false)).png().toFile(out('android-icon-background.png'));
// Splash mark (rendered on #06080B by expo-splash-screen).
await sharp(svg(`<g transform="translate(512 512) scale(0.9) translate(-528 -512)">${mark()}</g>`, true)).png().toFile(out('splash-icon.png'));
// Favicon.
await sharp(svg(`<g transform="translate(512 512) scale(0.92) translate(-528 -512)">${mark(ACCENT, GOLD, '#10161D', 40)}</g>`)).resize(64, 64).png().toFile(out('favicon.png'));
console.log('icons written');
