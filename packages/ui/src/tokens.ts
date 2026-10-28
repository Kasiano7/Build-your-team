/**
 * Design tokens v2 — "stadium night, premium". See docs/DESIGN_SYSTEM.md.
 * Deep night surfaces with real depth (glass, glows), one cyan→mint accent
 * for interaction, gold reserved for prestige, a rich natural pitch green.
 */
export const colors = {
  ink: '#05070A',
  night: '#080C11',
  graphite: '#0E141B',
  steel: '#161F29',
  steelHi: '#202B37',
  glass: 'rgba(255,255,255,0.045)',
  glassHi: 'rgba(255,255,255,0.08)',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',
  text: '#F3F6F8',
  textDim: '#A6B1BC',
  textMute: '#66727E',
  accent: '#2BE3D0',
  accent2: '#8DF7C4',
  accentDeep: '#0B8F80',
  accentInk: '#021C19',
  accentGlow: 'rgba(43,227,208,0.35)',
  gold: '#E6C170',
  gold2: '#B98A3A',
  goldDeep: '#7A5E24',
  danger: '#FF5D6C',
  warn: '#FFB547',
  success: '#3DDC97',
  grass: '#0E4429',
  grassDeep: '#082A19',
  grassStripe: '#125234',
  chalk: 'rgba(240,255,248,0.66)',
} as const;

/** Gradients as [from, to] pairs (expo-linear-gradient / SVG). */
export const gradients = {
  accent: ['#2BE3D0', '#8DF7C4'] as const,
  gold: ['#F3D58C', '#B98A3A'] as const,
  danger: ['#FF7A86', '#E0465A'] as const,
  hairline: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)'] as const,
};

/**
 * Two families:
 *  - Unbounded: titles and every number that matters (ratings, money, timer).
 *  - Manrope: interface text, labels, names.
 * Legacy keys are kept so every component maps onto the new scale.
 */
export const fonts = {
  hero: 'Unbounded_800ExtraBold',
  heroBold: 'Unbounded_700Bold',
  heroSemi: 'Unbounded_600SemiBold',
  number: 'Unbounded_700Bold',
  display: 'Manrope_800ExtraBold',
  displayBlack: 'Unbounded_800ExtraBold',
  displayBold: 'Manrope_700Bold',
  displaySemi: 'Manrope_600SemiBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

export const radii = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 } as const;
export const space = (n: number) => n * 4;

export type TierStyle = 'bronze' | 'silver' | 'gold' | 'elite' | 'icon';

export interface TierPalette {
  top: string;
  bottom: string;
  edge: string;
  edge2: string;
  ink: string;
  sub: string;
  sheen: string;
}

/** Card palettes per tier style. Universe independent: a pack maps ratings → style. */
export const tierPalettes: Record<TierStyle, TierPalette> = {
  bronze: { top: '#5A3E2A', bottom: '#150E09', edge: '#D49A66', edge2: '#7A4E2C', ink: '#F7E7D7', sub: '#D3AE8D', sheen: 'rgba(255,214,170,0.14)' },
  silver: { top: '#4A535E', bottom: '#0F1317', edge: '#E3EAF0', edge2: '#7D8A96', ink: '#F4F7FA', sub: '#B3BEC8', sheen: 'rgba(255,255,255,0.14)' },
  gold: { top: '#6B5320', bottom: '#120E07', edge: '#F3D58C', edge2: '#9C7530', ink: '#FFF5DC', sub: '#E1C88E', sheen: 'rgba(255,226,150,0.16)' },
  elite: { top: '#0B5550', bottom: '#04110F', edge: '#8DF7C4', edge2: '#1FA99A', ink: '#EBFFFA', sub: '#97E4D7', sheen: 'rgba(141,247,196,0.16)' },
  icon: { top: '#3A2F16', bottom: '#070605', edge: '#FFE3A1', edge2: '#B98A3A', ink: '#FFF8E4', sub: '#EBD39A', sheen: 'rgba(255,230,160,0.24)' },
};
