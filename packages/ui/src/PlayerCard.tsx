/**
 * Original player card. Chamfered plate, tier-coloured edge, procedural
 * portrait. Two variants: `full` (auction / details, with stats) and
 * `compact` (on the pitch). All sizes derive from `width`.
 */
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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

export const PlayerCard = memo(function PlayerCard({ character, pack, width, variant = 'full', muted, outOfPosition }: PlayerCardProps) {
  const d = describeCharacter(pack, character);
  const p = tierPalettes[d.tierStyle];
  const w = width;
  const h = cardHeight(w, variant);
  const cut = w * 0.16;
  const cut2 = w * 0.07;
  const shape = `M0 0 H${w - cut} L${w} ${cut} V${h} H${cut2} L0 ${h - cut2} Z`;
  const inner = `M2 2 H${w - cut - 0.8} L${w - 2} ${cut + 0.8} V${h - 2} H${cut2 + 0.8} L2 ${h - cut2 - 0.8} Z`;
  const gid = `g-${character.id}-${variant}-${Math.round(w)}`;
  const full = variant === 'full';
  const ratingSize = full ? w * 0.25 : Math.max(13, w * 0.3);
  const portraitSize = full ? w * 0.7 : w * 0.78;
  const nameSize = full ? w * 0.105 : Math.max(9, w * 0.14);
  const nameTop = full ? h * 0.555 : h * 0.68;

  return (
    <View style={{ width: w, height: h, opacity: muted ? 0.45 : 1 }} accessible accessibilityLabel={`${character.name}, ${d.primaryRoleLabel}, note ${character.overall}`}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={p.top} />
            <Stop offset="1" stopColor={p.bottom} />
          </LinearGradient>
          <LinearGradient id={`${gid}-sh`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0.25" stopColor="#fff" stopOpacity="0" />
            <Stop offset="0.42" stopColor="#fff" stopOpacity={d.tierStyle === 'icon' ? 0.16 : 0.08} />
            <Stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`${gid}-fade`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.bottom} stopOpacity="0" />
            <Stop offset="1" stopColor={p.bottom} stopOpacity="0.95" />
          </LinearGradient>
        </Defs>
        <Path d={shape} fill={`url(#${gid}-bg)`} />
        <Path d={shape} fill={`url(#${gid}-sh)`} />
        {/* Portrait fade so the name band reads cleanly */}
        <Rect x="0" y={nameTop - h * 0.16} width={w} height={h * 0.18} fill={`url(#${gid}-fade)`} />
        <Path d={inner} fill="none" stroke={p.edge} strokeOpacity={0.85} strokeWidth={full ? 1.4 : 1.1} />
        {/* Tier edge strip */}
        <Rect x="0" y={h * 0.12} width={full ? 3 : 2.2} height={h * 0.42} fill={p.edge} />
      </Svg>

      <View style={{ position: 'absolute', right: full ? w * 0.02 : 0, top: full ? w * 0.08 : w * 0.06 }}>
        {character.portraitUrl ? (
          <Image source={{ uri: character.portraitUrl }} style={{ width: portraitSize, height: portraitSize }} />
        ) : pack.dataset.fictional ? (
          <Avatar seed={character.portraitSeed} size={portraitSize} />
        ) : (
          <Silhouette seed={character.portraitSeed} size={portraitSize} />
        )}
      </View>

      <View style={{ position: 'absolute', left: w * 0.08, top: w * 0.06, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.displayBlack, fontSize: ratingSize, lineHeight: ratingSize * 1.02, color: p.ink }}>{character.overall}</Text>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: full ? w * 0.09 : Math.max(8, w * 0.13), color: p.sub, letterSpacing: 0.5, marginTop: -2 }}>
          {d.primaryRole}
        </Text>
        {full && (
          <View style={{ marginTop: w * 0.035 }}>
            <Flag code={character.nationality} width={w * 0.15} />
          </View>
        )}
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, top: nameTop, alignItems: 'center', paddingHorizontal: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: nameSize, color: p.ink, letterSpacing: full ? 0.6 : 0.2, textTransform: 'uppercase' }}>
          {full ? character.name : character.shortName}
        </Text>
        {full && <View style={{ height: 1, width: w * 0.62, backgroundColor: p.edge, opacity: 0.45, marginTop: w * 0.015 }} />}
      </View>

      {full && (
        <View style={{ position: 'absolute', left: w * 0.1, right: w * 0.1, top: h * 0.68, flexDirection: 'row', flexWrap: 'wrap' }}>
          {d.stats.map((s) => (
            <View key={s.key} style={{ width: '50%', flexDirection: 'row', alignItems: 'baseline', paddingVertical: w * 0.006, paddingLeft: w * 0.02 }}>
              <Text style={{ fontFamily: fonts.displayBlack, fontSize: w * 0.092, color: p.ink, width: w * 0.16 }}>{s.value}</Text>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: w * 0.06, color: p.sub, letterSpacing: 0.8 }}>{s.key}</Text>
            </View>
          ))}
        </View>
      )}

      {full && d.secondaryRoles.length > 0 && (
        <View style={{ position: 'absolute', right: w * 0.06, bottom: w * 0.05, flexDirection: 'row', gap: 3 }}>
          {d.secondaryRoles.map((r) => (
            <Text key={r} style={{ fontFamily: fonts.bodySemi, fontSize: w * 0.052, color: p.sub, borderWidth: 1, borderColor: p.edge, borderRadius: 3, paddingHorizontal: 3, opacity: 0.8 }}>
              {r}
            </Text>
          ))}
        </View>
      )}

      {full && !pack.dataset.fictional && (
        <Text style={{ position: 'absolute', left: w * 0.1, bottom: w * 0.05, fontFamily: fonts.bodySemi, fontSize: Math.max(7, w * 0.042), color: p.sub, opacity: 0.75, letterSpacing: 0.6 }}>
          NOTE ESTIMÉE
        </Text>
      )}

      {outOfPosition && (
        <View style={{ position: 'absolute', left: 3, bottom: 3, backgroundColor: '#FFB547', borderRadius: 3, paddingHorizontal: 3 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.max(7, w * 0.09), color: '#1A1205' }}>!</Text>
        </View>
      )}
    </View>
  );
});
