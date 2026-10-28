/**
 * The auctioned card and its choreography:
 *  reveal  → flip-in with a light sweep
 *  open    → idle float, pulse on every new high bid
 *  closed  → "VENDU" stamp in the winner's colour and transfer flight toward the pitch,
 *            or "INVENDU" fade.
 */
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { Auction, Character, PackMeta, Participant } from '@byt/shared';
import { PlayerCard, cardHeight, colors, fonts } from '@byt/ui';
import { useReduceMotion } from '@/state/settings';

export function AuctionStage({
  auction,
  character,
  pack,
  width,
  winner,
  flyTo = 'left',
}: {
  auction: Auction;
  character: Character;
  pack: PackMeta;
  width: number;
  winner: Participant | null;
  flyTo?: 'left' | 'down';
}) {
  const reduce = useReduceMotion();
  const h = cardHeight(width);
  const flip = useSharedValue(reduce ? 0 : 90);
  const scale = useSharedValue(reduce ? 1 : 0.7);
  const opacity = useSharedValue(reduce ? 1 : 0);
  const sweep = useSharedValue(-1);
  const fly = useSharedValue(0);
  const bump = useSharedValue(1);
  const stamp = useSharedValue(0);

  // Reveal on every new auction.
  useEffect(() => {
    fly.set(0);
    stamp.set(0);
    if (reduce) {
      flip.set(0);
      scale.set(1);
      opacity.set(1);
      return;
    }
    flip.set(90);
    scale.set(0.7);
    opacity.set(0);
    opacity.set(withTiming(1, { duration: 260 }));
    flip.set(withDelay(40, withSpring(0, { damping: 16, stiffness: 170 })));
    scale.set(withDelay(40, withSpring(1, { damping: 13, stiffness: 180 })));
    sweep.set(-1);
    sweep.set(withDelay(300, withTiming(1.4, { duration: 650, easing: Easing.inOut(Easing.cubic) })));
  }, [auction.id, reduce, flip, scale, opacity, sweep, fly, stamp]);

  // Pulse on new high bid.
  const bidCount = auction.bids.length;
  useEffect(() => {
    if (bidCount === 0 || reduce) return;
    bump.set(withSequence(withTiming(1.06, { duration: 110 }), withSpring(1, { damping: 10, stiffness: 220 })));
  }, [bidCount, reduce, bump]);

  // Closing choreography.
  const closed = auction.stage === 'closed';
  const sold = auction.result?.type === 'sold';
  useEffect(() => {
    if (!closed) return;
    stamp.set(reduce ? 1 : withSpring(1, { damping: 9, stiffness: 160 }));
    if (sold && !reduce) fly.set(withDelay(850, withTiming(1, { duration: 500, easing: Easing.in(Easing.cubic) })));
  }, [closed, sold, reduce, stamp, fly]);

  const cardStyle = useAnimatedStyle(() => {
    const dx = flyTo === 'left' ? -width * 1.8 * fly.value : 0;
    const dy = flyTo === 'down' ? h * 1.2 * fly.value : 0;
    return {
      opacity: opacity.value * (1 - fly.value * 0.9),
      transform: [
        { perspective: 900 },
        { translateX: dx },
        { translateY: dy },
        { rotateY: `${flip.value}deg` },
        { scale: scale.value * bump.value * (1 - fly.value * 0.55) },
      ],
    };
  });
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value * width * 1.4 }, { rotate: '20deg' }] }));
  const stampStyle = useAnimatedStyle(() => ({ opacity: stamp.value, transform: [{ scale: 1.6 - stamp.value * 0.6 }, { rotate: '-8deg' }] }));

  return (
    <View style={{ width, height: h }}>
      <Animated.View style={[{ width, height: h }, cardStyle]}>
        <View style={{ opacity: closed && !sold ? 0.45 : 1 }}>
          <PlayerCard character={character} pack={pack} width={width} />
        </View>
        {!reduce && (
          <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <Animated.View style={[{ position: 'absolute', top: -h * 0.3, bottom: -h * 0.3, width: width * 0.35 }, sweepStyle]}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Animated.View>
          </View>
        )}
      </Animated.View>
      {closed && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -12, right: -12, top: h * 0.36, alignItems: 'center' }, stampStyle]}>
          <View
            style={{
              borderWidth: 3,
              borderColor: sold ? winner?.color ?? colors.accent : colors.textDim,
              backgroundColor: 'rgba(6,8,11,0.82)',
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.hero, fontSize: width * (sold ? 0.15 : 0.12), color: sold ? winner?.color ?? colors.accent : colors.textDim, letterSpacing: 1.5 }}>
              {sold ? 'VENDU' : 'INVENDU'}
            </Text>
            {sold && auction.result?.type === 'sold' && (
              <Text style={{ fontFamily: fonts.display, fontSize: width * 0.075, color: colors.text, letterSpacing: 0.4 }} numberOfLines={1}>
                {winner?.nickname} · {auction.result.amount}M
              </Text>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
