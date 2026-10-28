import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '@byt/ui';

/** Mark: a chamfered card plate (gold tier strip, pitch centre circle) — the product in one glyph. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 40 50">
      <Path d="M2 2 H30 L38 10 V48 H8 L2 42 Z" fill={colors.graphite} stroke={colors.accent} strokeWidth="2.4" />
      <Path d="M1 10 H4.6 V22 H1 Z" fill={colors.gold} />
      <Path d="M8 30 H32" stroke={colors.accent} strokeWidth="2" opacity="0.7" />
      <Path d="M20 24 a6 6 0 1 1 0 12 a6 6 0 1 1 0 -12" stroke={colors.accent} strokeWidth="2" fill="none" opacity="0.7" />
    </Svg>
  );
}

export function Logo({ size = 1, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * size }} accessibilityRole="header" accessibilityLabel="Build Your Team">
      <LogoMark size={26 * size} />
      <View>
        <Text style={{ fontFamily: fonts.hero, fontSize: 17 * size, lineHeight: 20 * size, color: colors.text, letterSpacing: 0.4 }}>
          BUILD YOUR <Text style={{ color: colors.accent }}>TEAM</Text>
        </Text>
        {tagline && (
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9.5 * size, letterSpacing: 3.4 * size, color: colors.textMute, marginTop: 3 }}>
            BID · BUILD · WIN
          </Text>
        )}
      </View>
    </View>
  );
}
