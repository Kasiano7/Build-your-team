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
    fly.value = 0;
    stamp.value = 0;
    if (reduce) {
      flip.value = 0;
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    flip.value = 90;
    scale.value = 0.7;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 260 });
    flip.value = withDelay(80, withSpring(0, { damping: 14, stiffness: 90 }));
    scale.value = withDelay(80, withSpring(1, { damping: 12, stiffness: 110 }));
    sweep.value = -1;
    sweep.value = withDelay(650, withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [auction.id, reduce, flip, scale, opacity, sweep, fly, stamp]);

  // Pulse on new high bid.
  const bidCount = auction.bids.length;
  useEffect(() => {
    if (bidCount === 0 || reduce) return;
    bump.value = withSequence(withTiming(1.06, { duration: 110 }), withSpring(1, { damping: 10, stiffness: 220 }));
  }, [bidCount, reduce, bump]);

  // Closing choreography.
  const closed = auction.stage === 'closed';
  const sold = auction.result?.type === 'sold';
  useEffect(() => {
    if (!closed) return;
    stamp.value = reduce ? 1 : withSpring(1, { damping: 9, stiffness: 160 });
    if (sold && !reduce) fly.value = withDelay(1500, withTiming(1, { duration: 650, easing: Easing.in(Easing.cubic) }));
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
            <Text style={{ fontFamily: fonts.displayBlack, fontSize: width * 0.2, color: sold ? winner?.color ?? colors.accent : colors.textDim, letterSpacing: 3 }}>
              {sold ? 'VENDU' : 'INVENDU'}
            </Text>
            {sold && auction.result?.type === 'sold' && (
              <Text style={{ fontFamily: fonts.display, fontSize: width * 0.085, color: colors.text, letterSpacing: 1 }} numberOfLines={1}>
                {winner?.nickname} · {auction.result.amount}M
              </Text>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
