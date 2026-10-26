/**
 * Design tokens — see docs/DESIGN_SYSTEM.md.
 * Stadium at night: graphite surfaces, one turquoise accent for interaction,
 * gold reserved for prestige tiers, a deep natural pitch green.
 */
export const colors = {
  ink: '#06080B',
  night: '#0A0E13',
  graphite: '#10161D',
  steel: '#18212B',
  steelHi: '#222D39',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',
  text: '#EEF3F6',
  textDim: '#A7B3BE',
  textMute: '#6E7B88',
  accent: '#19E3C8',
  accentDeep: '#0B8F80',
  accentInk: '#03211D',
  gold: '#D9B45F',
  goldDeep: '#7A5E24',
  danger: '#FF5D6C',
  warn: '#FFB547',
  success: '#3DDC97',
  grass: '#0F3F27',
  grassDeep: '#0A2C1B',
  grassStripe: '#124A2E',
  chalk: 'rgba(240,255,248,0.62)',
} as const;

export const fonts = {
  display: 'BigShouldersDisplay_800ExtraBold',
  displayBlack: 'BigShouldersDisplay_900Black',
  displayBold: 'BigShouldersDisplay_700Bold',
  displaySemi: 'BigShouldersDisplay_600SemiBold',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  bodySemi: 'Archivo_600SemiBold',
  bodyBold: 'Archivo_700Bold',
} as const;

export const radii = { sm: 6, md: 10, lg: 16, xl: 22 } as const;
export const space = (n: number) => n * 4;

export type TierStyle = 'bronze' | 'silver' | 'gold' | 'elite' | 'icon';

export interface TierPalette {
  top: string;
  bottom: string;
  edge: string;
  ink: string;
  sub: string;
  sheen: string;
}

/** Card palettes per tier style. Universe independent: a pack maps ratings → style. */
export const tierPalettes: Record<TierStyle, TierPalette> = {
  bronze: { top: '#4A3424', bottom: '#1A120C', edge: '#B98457', ink: '#F4E3D3', sub: '#C9A88A', sheen: 'rgba(255,214,170,0.10)' },
  silver: { top: '#3E4650', bottom: '#14181D', edge: '#C7D0D8', ink: '#F1F5F8', sub: '#A9B4BE', sheen: 'rgba(255,255,255,0.10)' },
  gold: { top: '#5A4619', bottom: '#17120A', edge: '#D9B45F', ink: '#FBF1D8', sub: '#D7BE85', sheen: 'rgba(255,226,150,0.12)' },
  elite: { top: '#0D4643', bottom: '#061615', edge: '#19E3C8', ink: '#E8FFFB', sub: '#8FDCD1', sheen: 'rgba(120,255,235,0.12)' },
  icon: { top: '#2A2416', bottom: '#080706', edge: '#E9C877', ink: '#FFF6DD', sub: '#E0C98F', sheen: 'rgba(255,230,160,0.18)' },
};
