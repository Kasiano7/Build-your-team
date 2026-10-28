/**
 * Original player card (design v2). Rounded plate with one bevelled corner,
 * gradient tier border, holographic foil on prestige tiers, a pool of light
 * behind the portrait and a glass name plate. Two variants: `full` (auction,
 * details, with stats) and `compact` (on the pitch). All sizes derive from `width`.
 */
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Character, PackMeta } from '@byt/shared';
import { Avatar, Silhouette } from './Avatar';
import { Flag } from './Flag';
import { describeCharacter } from './describe';
import { fonts, tierPalettes } from './tokens';

export interface PlayerCardProps {
  character: Character;
  pack: PackMeta;
  width: number;
  variant?: 'full' | 'compact';
  /** Dim the card (e.g. incompatible slot). */
  muted?: boolean;
  /** Small "hors poste" marker for out-of-position starters. */
  outOfPosition?: boolean;
}

export function cardHeight(width: number, variant: 'full' | 'compact' = 'full'): number {
  return Math.round(width * (variant === 'full' ? 1.42 : 1.3));
}

/** Rounded rectangle whose top-right corner is bevelled — the card's silhouette. */
function plate(w: number, h: number, inset = 0): string {
  const r = w * 0.085;
  const b = w * 0.15;
  const i = inset;
  return [
    `M${r + i} ${i}`,
    `H${w - b - i * 0.4}`,
    `L${w - i} ${b + i * 0.4}`,
    `V${h - r - i}`,
    `Q${w - i} ${h - i} ${w - r - i} ${h - i}`,
    `H${r + i}`,
    `Q${i} ${h - i} ${i} ${h - r - i}`,
    `V${r + i}`,
    `Q${i} ${i} ${r + i} ${i}`,
    'Z',
  ].join(' ');
}

export const PlayerCard = memo(function PlayerCard({ character, pack, width, variant = 'full', muted, outOfPosition }: PlayerCardProps) {
  const d = describeCharacter(pack, character);
  const p = tierPalettes[d.tierStyle];
  const w = width;
  const h = cardHeight(w, variant);
  const full = variant === 'full';
  const prestige = d.tierStyle === 'icon' || d.tierStyle === 'elite';
  const gid = `c-${character.id}-${variant}-${Math.round(w)}`;
  const ratingSize = full ? w * 0.2 : Math.max(12, w * 0.25);
  const portraitSize = full ? w * 0.74 : w * 0.8;
  const nameSize = full ? w * 0.082 : Math.max(8.5, w * 0.118);
  const plateTop = full ? h * 0.52 : h * 0.7;

  return (
    <View style={{ width: w, height: h, opacity: muted ? 0.45 : 1 }} accessible accessibilityLabel={`${character.name}, ${d.primaryRoleLabel}, note ${character.overall}`}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={p.top} />
            <Stop offset="0.62" stopColor={p.bottom} />
            <Stop offset="1" stopColor={p.bottom} />
          </LinearGradient>
          <LinearGradient id={`${gid}-edge`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.edge} />
            <Stop offset="0.55" stopColor={p.edge2} />
            <Stop offset="1" stopColor={p.edge} />
          </LinearGradient>
          {/* Holographic foil: thin bands of tinted light across the plate. */}
          <LinearGradient id={`${gid}-holo`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0.18" stopColor="#7CF7FF" stopOpacity="0" />
            <Stop offset="0.3" stopColor="#7CF7FF" stopOpacity={prestige ? 0.16 : 0.06} />
            <Stop offset="0.38" stopColor="#FF9BE6" stopOpacity={prestige ? 0.12 : 0.04} />
            <Stop offset="0.46" stopColor="#FFE9A8" stopOpacity={prestige ? 0.14 : 0.05} />
            <Stop offset="0.58" stopColor="#FFE9A8" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id={`${gid}-light`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={p.edge} stopOpacity={0.32} />
            <Stop offset="1" stopColor={p.edge} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={`${gid}-plate`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.22" stopColor="#000" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
          </LinearGradient>
        </Defs>
        <Path d={plate(w, h)} fill={`url(#${gid}-bg)`} />
        <Ellipse cx={w * 0.6} cy={h * 0.3} rx={w * 0.48} ry={w * 0.44} fill={`url(#${gid}-light)`} />
        {d.tierStyle === 'icon' && (
          <G opacity={0.07}>
            {Array.from({ length: 14 }).map((_, i) => (
              <Line key={i} x1={-h + i * (w / 5)} y1={h} x2={i * (w / 5)} y2={0} stroke={p.edge} strokeWidth={0.8} />
            ))}
          </G>
        )}
        <Rect x="0" y={plateTop - h * 0.08} width={w} height={h - plateTop + h * 0.08} fill={`url(#${gid}-plate)`} />
        <Path d={plate(w, h)} fill={`url(#${gid}-holo)`} />
        <Path d={plate(w, h, full ? 1.2 : 0.9)} fill="none" stroke={`url(#${gid}-edge)`} strokeWidth={full ? 1.8 : 1.3} />
        {full && <Path d={plate(w, h, 4.5)} fill="none" stroke={p.edge} strokeOpacity={0.18} strokeWidth={0.8} />}
      </Svg>

      <View style={{ position: 'absolute', right: full ? -w * 0.02 : -w * 0.04, top: full ? w * 0.05 : w * 0.04 }}>
        {character.portraitUrl ? (
          <Image source={{ uri: character.portraitUrl }} style={{ width: portraitSize, height: portraitSize }} />
        ) : pack.dataset.fictional ? (
          <Avatar seed={character.portraitSeed} size={portraitSize} />
        ) : (
          <Silhouette seed={character.portraitSeed} size={portraitSize} />
        )}
      </View>

      <View style={{ position: 'absolute', left: w * 0.08, top: w * 0.07, alignItems: 'flex-start' }}>
        <Text style={{ fontFamily: fonts.hero, fontSize: ratingSize, lineHeight: ratingSize * 1.08, color: p.ink, letterSpacing: -0.5 }}>{character.overall}</Text>
        <View
          style={{
            marginTop: full ? w * 0.01 : 0,
            paddingHorizontal: full ? w * 0.03 : w * 0.025,
            paddingVertical: full ? w * 0.006 : 0,
            borderRadius: 999,
            backgroundColor: full ? 'rgba(0,0,0,0.28)' : 'transparent',
            borderWidth: full ? 1 : 0,
            borderColor: `${p.edge}55`,
          }}
        >
          <Text style={{ fontFamily: full ? fonts.heroSemi : fonts.display, fontSize: full ? Math.max(9, w * 0.058) : Math.max(9, w * 0.12), color: p.sub, letterSpacing: full ? 0.4 : 0.6 }}>{d.primaryRole}</Text>
        </View>
        {full && (
          <View style={{ marginTop: w * 0.04, borderRadius: 3, overflow: 'hidden' }}>
            <Flag code={character.nationality} width={w * 0.14} />
          </View>
        )}
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, top: plateTop, alignItems: 'center', paddingHorizontal: w * 0.05 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: nameSize, color: p.ink, letterSpacing: full ? 0.8 : 0.3, textTransform: 'uppercase' }}>
          {full ? character.name : character.shortName}
        </Text>
        {full && character.affiliation ? (
          <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemi, fontSize: w * 0.05, color: p.sub, opacity: 0.8, marginTop: 1 }}>
            {character.affiliation}
          </Text>
        ) : null}
      </View>

      {full && (
        <View style={{ position: 'absolute', left: w * 0.08, right: w * 0.08, top: h * 0.665, flexDirection: 'row', flexWrap: 'wrap', rowGap: w * 0.008 }}>
          {d.stats.map((s) => (
            <View key={s.key} style={{ width: '33.33%', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.heroBold, fontSize: w * 0.074, lineHeight: w * 0.09, color: p.ink }}>{s.value}</Text>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: w * 0.041, lineHeight: w * 0.05, color: p.sub, letterSpacing: 1, opacity: 0.85 }}>{s.key}</Text>
            </View>
          ))}
        </View>
      )}

      {full && (d.secondaryRoles.length > 0 || !pack.dataset.fictional) && (
        <View style={{ position: 'absolute', left: w * 0.08, right: w * 0.08, bottom: w * 0.045, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.max(6.5, w * 0.036), color: p.sub, opacity: 0.7, letterSpacing: 0.8 }}>
            {!pack.dataset.fictional ? 'NOTE ESTIMÉE' : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {d.secondaryRoles.map((r) => (
              <Text key={r} style={{ fontFamily: fonts.bodyBold, fontSize: w * 0.042, color: p.sub, borderWidth: 1, borderColor: `${p.edge}66`, borderRadius: 999, paddingHorizontal: 5, overflow: 'hidden' }}>
                {r}
              </Text>
            ))}
          </View>
        </View>
      )}

      {outOfPosition && (
        <View style={{ position: 'absolute', left: 3, bottom: 3, backgroundColor: '#FFB547', borderRadius: 999, minWidth: Math.max(11, w * 0.16), alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.max(7, w * 0.09), color: '#1A1205' }}>!</Text>
        </View>
      )}
    </View>
  );
});
