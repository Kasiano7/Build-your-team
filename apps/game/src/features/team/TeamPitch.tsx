/**
 * A participant's team on the 2.5D pitch: filled slots show compact cards,
 * empty slots show their tactical label, the slot the current auction would
 * fill pulses, and newly acquired players land with an arrival animation.
 */
import { memo, useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { Character, FormationDef, PackMeta, Team } from '@byt/shared';
import { Court, PlayerCard, Pitch, colors, fonts } from '@byt/ui';
import { useReduceMotion } from '@/state/settings';

export interface TeamPitchProps {
  pack: PackMeta;
  formation: FormationDef;
  team: Team;
  characters: Record<string, Character>;
  /** Slot index the current auction player would land in (for this participant). */
  targetSlot?: number | null;
  selectedSlot?: number | null;
  onSlotPress?: (index: number) => void;
  /** Animate arrivals of characters not present on first render. */
  animateArrivals?: boolean;
  accent?: string;
}

function chamfer(w: number, h: number) {
  const c = w * 0.16;
  const c2 = w * 0.07;
  return `M1 1 H${w - c} L${w - 1} ${c} V${h - 1} H${c2} L1 ${h - c2} Z`;
}

const EmptySlot = memo(function EmptySlot({ w, label, target, selected, reduce }: { w: number; label: string; target: boolean; selected: boolean; reduce: boolean }) {
  const h = w * 1.3;
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (target && !reduce) {
      pulse.set(0);
      pulse.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else pulse.value = 0;
  }, [target, reduce, pulse]);
  const glow = useAnimatedStyle(() => ({ opacity: target ? 0.35 + pulse.value * 0.65 : 1, transform: [{ scale: target ? 1 + pulse.value * 0.05 : 1 }] }));
  const stroke = target ? colors.accent : selected ? colors.text : 'rgba(255,255,255,0.38)';
  return (
    <Animated.View style={[{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }, glow]}>
      <Svg width={w} height={h} style={{ position: 'absolute' }}>
        <Path d={chamfer(w, h)} fill={target ? 'rgba(25,227,200,0.14)' : 'rgba(4,16,10,0.45)'} stroke={stroke} strokeWidth={target ? 2 : 1.2} strokeDasharray={target ? undefined : '5 4'} />
      </Svg>
      <Text style={{ fontFamily: fonts.displayBlack, fontSize: Math.max(12, w * 0.24), color: target ? colors.accent : 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>{label}</Text>
      {target && <Text style={{ fontFamily: fonts.bodyBold, fontSize: Math.max(8, w * 0.1), color: colors.accent, letterSpacing: 1.5, marginTop: 2 }}>CIBLE</Text>}
    </Animated.View>
  );
});

/** Card landing: drops from above with overshoot, plus an expanding ring on the turf. */
function Arrival({ children, w, reduce: reduceNow, animate: animateNow }: { children: React.ReactNode; w: number; reduce: boolean; animate: boolean }) {
  // Decided once, at mount: later renders must not restart or cancel the landing.
  const [animate] = useState(() => animateNow && !reduceNow);
  const reduce = !animate;
  const y = useSharedValue(reduce ? 0 : -w * 1.6);
  const s = useSharedValue(reduce ? 1 : 1.5);
  const o = useSharedValue(reduce ? 1 : 0);
  const ring = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    o.set(withDelay(350, withTiming(1, { duration: 220 })));
    y.set(withDelay(350, withSpring(0, { damping: 13, stiffness: 140 })));
    s.set(withDelay(350, withSpring(1, { damping: 12, stiffness: 140 })));
    ring.set(withDelay(620, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [reduce, o, y, s, ring]);
  const card = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { scale: s.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 1 - ring.value,
    transform: [{ scaleX: 0.6 + ring.value * 1.6 }, { scaleY: 0.25 + ring.value * 0.55 }],
  }));
  return (
    <View style={{ width: w, height: w * 1.3 }}>
      {!reduce && (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: -w * 0.1, right: -w * 0.1, bottom: -w * 0.12, height: w * 0.5, borderRadius: w, borderWidth: 2, borderColor: colors.accent }, ringStyle]}
        />
      )}
      <Animated.View style={card}>{children}</Animated.View>
    </View>
  );
}

export function TeamPitch({ pack, formation, team, characters, targetSlot = null, selectedSlot = null, onSlotPress, animateArrivals = true, accent }: TeamPitchProps) {
  const reduce = useReduceMotion();
  // Cards present when this pitch mounted never animate; later arrivals do (Arrival decides at its own mount).
  const [initial] = useState(() => new Set(team.starters.filter((x): x is string => !!x)));
  const fresh = new Set(team.starters.filter((id): id is string => !!id && !initial.has(id)));

  // The playing surface follows the universe; slots, cards and animations are shared.
  const Surface = pack.universeId === 'basketball' ? Court : Pitch;
  return (
    <Surface
      slots={formation.slots}
      renderSlot={(slot, index, { cardWidth }) => {
        const id = team.starters[index] ?? null;
        const c = id ? characters[id] : undefined;
        const content = c ? (
          <View>
            <PlayerCard character={c} pack={pack} width={cardWidth} variant="compact" outOfPosition={!slot.preferredRoles.some((r) => c.roles.includes(r))} />
            {selectedSlot === index && (
              <View pointerEvents="none" style={{ position: 'absolute', inset: -3, borderWidth: 2, borderColor: accent ?? colors.accent, borderRadius: 4 }} />
            )}
          </View>
        ) : (
          <EmptySlot w={cardWidth} label={slot.label} target={targetSlot === index} selected={selectedSlot === index} reduce={reduce} />
        );
        const body = c ? (
          <Arrival key={c.id} w={cardWidth} reduce={reduce} animate={animateArrivals && fresh.has(c.id)}>
            {content}
          </Arrival>
        ) : (
          <View key={`empty-${index}`}>{content}</View>
        );
        if (!onSlotPress) return body;
        return (
          <Pressable
            onPress={() => onSlotPress(index)}
            accessibilityRole="button"
            accessibilityLabel={c ? `${slot.label} : ${c.name}, ${c.overall}` : `${slot.label} : libre`}
            style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
          >
            {body}
          </Pressable>
        );
      }}
    />
  );
}
