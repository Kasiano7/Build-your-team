/**
 * Full-screen atmosphere: a night stadium seen from the stands — two coloured
 * glows (cyan from the floodlights, emerald from the pitch), faint gold,
 * soft floodlight beams and a fine grain. Static: no runtime cost.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from './tokens';

export const Backdrop = memo(function Backdrop({ intensity = 1 }: { intensity?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="bd-cyan" cx="12%" cy="-8%" rx="62%" ry="70%">
            <Stop offset="0" stopColor="#1FD3C3" stopOpacity={0.2 * intensity} />
            <Stop offset="1" stopColor="#1FD3C3" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bd-pitch" cx="62%" cy="112%" rx="70%" ry="62%">
            <Stop offset="0" stopColor="#139257" stopOpacity={0.24 * intensity} />
            <Stop offset="1" stopColor="#139257" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bd-gold" cx="96%" cy="4%" rx="38%" ry="34%">
            <Stop offset="0" stopColor="#E6C170" stopOpacity={0.08 * intensity} />
            <Stop offset="1" stopColor="#E6C170" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="bd-beam" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.07 * intensity} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="bd-vignette" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.7" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#bd-cyan)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#bd-pitch)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#bd-gold)" />
        <Polygon points="6,0 14,0 46,100 24,100" fill="url(#bd-beam)" />
        <Polygon points="84,0 90,0 78,100 60,100" fill="url(#bd-beam)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#bd-vignette)" />
      </Svg>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="bd-grain" width="4" height="4" patternUnits="userSpaceOnUse">
            <Circle cx="1" cy="1" r="0.55" fill="#FFFFFF" fillOpacity="0.035" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bd-grain)" />
      </Svg>
    </View>
  );
});
