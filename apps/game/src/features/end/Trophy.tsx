import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@byt/ui';
import { useReduceMotion } from '@/state/settings';

/** Original trophy: rises in with a spring, then a slow light shimmer and a burst of confetti strips. */
export function Trophy({ size = 140 }: { size?: number }) {
  const reduce = useReduceMotion();
  const rise = useSharedValue(reduce ? 1 : 0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    rise.set(withSpring(1, { damping: 10, stiffness: 80 }));
    glow.set(withDelay(500, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [reduce, rise, glow]);
  const style = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 60 }, { scale: 0.6 + rise.value * 0.4 }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 + glow.value * 0.45, transform: [{ scale: 1 + glow.value * 0.06 }] }));
  return (
    <View style={{ width: size * 1.8, height: size * 1.3, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size * 1.7, height: size * 1.7 }, halo]}>
        <Svg width={size * 1.7} height={size * 1.7}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.gold} stopOpacity="0.32" />
              <Stop offset="0.55" stopColor={colors.gold} stopOpacity="0.08" />
              <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={size * 0.85} cy={size * 0.85} r={size * 0.85} fill="url(#halo)" />
        </Svg>
      </Animated.View>
      {!reduce && <Confetti size={size} />}
      <Animated.View style={style}>
        <Svg width={size} height={size * 1.1} viewBox="0 0 100 110">
          <Defs>
            <LinearGradient id="cup" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F7DFA0" />
              <Stop offset="0.45" stopColor={colors.gold} />
              <Stop offset="1" stopColor="#6E5320" />
            </LinearGradient>
          </Defs>
          <Path d="M24 8 H76 V30 C76 52 64 64 50 66 C36 64 24 52 24 30 Z" fill="url(#cup)" />
          <Path d="M24 14 H12 C12 32 18 40 28 42" stroke="url(#cup)" strokeWidth="6" fill="none" />
          <Path d="M76 14 H88 C88 32 82 40 72 42" stroke="url(#cup)" strokeWidth="6" fill="none" />
          <Rect x="45" y="64" width="10" height="16" fill="url(#cup)" />
          <Path d="M30 80 H70 L74 96 H26 Z" fill="url(#cup)" />
          <Rect x="22" y="96" width="56" height="8" rx="2" fill="#3A2C10" />
          <Path d="M36 14 C34 30 38 44 46 52" stroke="#FFF6D8" strokeOpacity="0.55" strokeWidth="3" fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const PIECES = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37) % 100,
  delay: (i * 97) % 900,
  color: [colors.gold, colors.accent, '#FFFFFF', '#FF6B8A'][i % 4]!,
  rot: (i * 53) % 360,
}));

function Confetti({ size }: { size: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      {PIECES.map((p, i) => (
        <Piece key={i} {...p} h={size * 1.3} w={size * 1.8} />
      ))}
    </View>
  );
}

function Piece({ x, delay, color, rot, h, w }: { x: number; delay: number; color: string; rot: number; h: number; w: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) })));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [{ translateY: -h * 0.2 + t.value * h * 0.9 }, { rotate: `${rot + t.value * 360}deg` }],
  }));
  return <Animated.View style={[{ position: 'absolute', left: (x / 100) * w, top: 0, width: 6, height: 12, borderRadius: 1, backgroundColor: color }, style]} />;
}
