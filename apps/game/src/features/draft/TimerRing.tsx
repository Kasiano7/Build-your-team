import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, fonts } from '@byt/ui';
import { playSound } from '@/lib/sound';
import { useServerNow } from '@/state/hooks';

/** Countdown driven by the server deadline (clock offset applied). */
export function TimerRing({ endsAt, totalMs, size = 112, active }: { endsAt: number; totalMs: number; size?: number; active: boolean }) {
  const now = useServerNow(100, active);
  const remaining = Math.max(0, endsAt - now);
  const frac = Math.min(1, remaining / Math.max(totalMs, 1));
  const secs = Math.ceil(remaining / 1000);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    if (secs <= 3 && secs > 0 && lastTick.current !== secs) {
      lastTick.current = secs;
      playSound('tick');
    }
    if (secs > 3) lastTick.current = null;
  }, [secs, active]);

  const stroke = secs <= 3 ? colors.danger : secs <= 5 ? colors.warn : colors.accent;
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="timer" accessibilityLabel={`${secs} secondes restantes`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="timer-grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={secs <= 5 ? stroke : colors.accent} />
            <Stop offset="1" stopColor={secs <= 5 ? stroke : colors.accent2} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={7} fill="rgba(255,255,255,0.03)" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={stroke} strokeOpacity={0.18} strokeWidth={14} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#timer-grad)" strokeWidth={7} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <Circle key={i} cx={size / 2 + Math.cos(a) * (r - 11)} cy={size / 2 + Math.sin(a) * (r - 11)} r={1.2} fill="rgba(255,255,255,0.18)" />;
        })}
      </Svg>
      <Text style={{ fontFamily: fonts.displayBlack, fontSize: size * 0.32, color: secs <= 3 ? colors.danger : colors.text, fontVariant: ['tabular-nums'] }}>{secs}</Text>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.max(9, size * 0.085), color: colors.textMute, letterSpacing: 2, marginTop: -4 }}>SEC</Text>
    </View>
  );
}
