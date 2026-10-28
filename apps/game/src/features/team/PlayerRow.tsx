import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { Character, PackMeta } from '@byt/shared';
import { PlayerCard, colors, fonts, radii } from '@byt/ui';

/**
 * Dense, selectable line for a player in a list (mercato rosters, steal joker).
 * Compact card on the left, name + caption, rating, optional trailing content.
 */
export function PlayerRow({
  character,
  pack,
  caption,
  selected,
  accent = colors.accent,
  muted,
  onPress,
  right,
  testID,
}: {
  character: Character;
  pack: PackMeta;
  caption: string;
  selected?: boolean;
  accent?: string;
  muted?: boolean;
  onPress?: () => void;
  right?: ReactNode;
  testID?: string;
}) {
  // The trailing content sits outside the pressable area: on the web a <button> cannot contain another one.
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingRight: right ? 8 : 0,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: selected ? accent : 'transparent',
        backgroundColor: selected ? `${accent}1F` : 'rgba(255,255,255,0.03)',
      }}
    >
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={onPress ? { selected: !!selected } : undefined}
        accessibilityLabel={`${character.name}, ${caption}, ${character.masked ? 'note cachée' : `note ${character.overall}`}`}
        style={(state) => [
          { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, paddingLeft: 6, paddingRight: right ? 0 : 8, opacity: state.pressed ? 0.85 : 1 },
          Platform.OS === 'web' ? ({ cursor: onPress ? 'pointer' : 'default' } as object) : null,
        ]}
      >
        <View style={{ opacity: muted ? 0.45 : 1 }}>
          <PlayerCard character={character} pack={pack} width={32} variant="compact" />
        </View>
        <View style={{ flex: 1, minWidth: 0, opacity: muted ? 0.6 : 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>
            {character.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute }}>
            {caption}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.number, fontSize: 15, color: muted ? colors.textMute : colors.text, fontVariant: ['tabular-nums'], minWidth: 24, textAlign: 'right' }}>
          {character.masked ? '?' : character.overall}
        </Text>
      </Pressable>
      {right}
    </View>
  );
}

/** Small pill action that fits inside a row (Vendre, Retirer, ±10…). */
export function MiniButton({
  label,
  onPress,
  tone = 'neutral',
  disabled,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'danger' | 'accent' | 'gold';
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const fg = tone === 'danger' ? '#FF8A95' : tone === 'accent' ? colors.accent : tone === 'gold' ? colors.gold : colors.text;
  const border = tone === 'danger' ? 'rgba(255,93,108,0.42)' : tone === 'accent' ? 'rgba(43,227,208,0.45)' : tone === 'gold' ? 'rgba(230,193,112,0.5)' : 'rgba(255,255,255,0.14)';
  const bg = tone === 'danger' ? 'rgba(255,93,108,0.08)' : tone === 'accent' ? 'rgba(43,227,208,0.08)' : tone === 'gold' ? 'rgba(230,193,112,0.1)' : 'rgba(255,255,255,0.05)';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={(state) => [
        {
          height: 30,
          minWidth: 30,
          paddingHorizontal: 11,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: state.pressed ? 0.96 : 1 }],
        },
        Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : null,
      ]}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.3, color: fg }}>{label}</Text>
    </Pressable>
  );
}
