import { useEffect, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { PackMeta, Participant, RoomView } from '@byt/shared';
import { colors, describeCharacter, fonts, radii } from '@byt/ui';
import { Button, Eyebrow, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { haptic, playSound } from '@/lib/sound';
import { gameClient } from '@/state/game-client';
import { useReduceMotion } from '@/state/settings';
import { bidStatus, formationOf, targetSlotFor } from '../room/derive';
import { AuctionStage } from './AuctionStage';
import { TimerRing } from './TimerRing';

export function AuctionPanel({ view, pack, me, compact, dense }: { view: RoomView; pack: PackMeta; me: Participant | null; compact: boolean; dense?: boolean }) {
  const toast = useToast();
  const reduce = useReduceMotion();
  const a = view.auction!;
  const character = view.characters[a.characterId]!;
  const desc = describeCharacter(pack, character);
  const status = bidStatus(pack, view, me);
  const high = a.highBid;
  const leader = high ? view.participants.find((p) => p.id === high.participantId) ?? null : null;
  const winner = a.result?.type === 'sold' ? view.participants.find((p) => p.id === (a.result as { participantId: string }).participantId) ?? null : null;
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const target = me ? targetSlotFor(pack, view, me) : null;
  const targetLabel = me && target ? (target.kind === 'starter' ? formationOf(pack, me.team.formationId).slots[target.index]!.label : 'Banc') : null;

  const [customFor, setCustomFor] = useState(a.id);
  if (customFor !== a.id) {
    setCustomFor(a.id);
    setCustom('');
  }

  const amountPulse = useSharedValue(1);
  useEffect(() => {
    if (!high || reduce) return;
    amountPulse.set(withSequence(withTiming(1.18, { duration: 120 }), withSpring(1, { damping: 9, stiffness: 200 })));
  }, [high?.id, reduce, amountPulse, high]);
  const amountStyle = useAnimatedStyle(() => ({ transform: [{ scale: amountPulse.value }] }));

  const send = async (amount: number) => {
    if (busy) return;
    setBusy(true);
    haptic('light');
    const res = await gameClient.bid(amount);
    setBusy(false);
    if (!res.ok) {
      playSound('error');
      toast(errorMessage(res.code, res.details), 'error');
    } else setCustom('');
  };
  const pass = async () => {
    const res = await gameClient.pass();
    if (!res.ok) toast(errorMessage(res.code), 'error');
  };

  const base = high?.amount ?? 0;
  const quick = [10, 20, 50].map((inc) => ({ inc, amount: Math.max(base + inc, view.settings.reservePrice) }));
  const canBid = status.kind === 'can_bid';
  const customValue = Number(custom);
  const customValid = canBid && Number.isInteger(customValue) && customValue >= status.min && customValue <= status.max;

  const passButton = (
    <Button label="Passer" variant="danger" size={compact ? 'md' : 'lg'} disabled={status.kind !== 'can_bid'} onPress={pass} testID="bid-pass" style={dense ? { paddingHorizontal: 10 } : undefined} />
  );
  const totalMs = (high ? view.settings.bidResetSec : view.settings.openingTimerSec) * 1000;
  const cardW = dense ? 96 : compact ? 132 : 216;

  const statusLine = (() => {
    if (a.stage === 'reveal') return { text: 'Présentation du joueur…', color: colors.textDim };
    if (a.stage === 'closed') return { text: a.result?.type === 'sold' ? (winner?.id === me?.id ? 'Il rejoint votre équipe !' : `Il rejoint ${winner?.nickname}`) : 'Personne n’a enchéri', color: colors.textDim };
    switch (status.kind) {
      case 'leading':
        return { text: 'Vous menez — attendez la fin du chrono', color: colors.accent };
      case 'passed':
        return { text: 'Vous avez passé sur ce joueur', color: colors.textDim };
      case 'not_eligible':
        return { text: status.reason === 'no_slot' ? 'Aucune place compatible dans votre équipe' : 'Budget réservé pour vos postes restants', color: colors.warn };
      case 'can_bid':
        return { text: `Enchère max possible : ${status.max}M`, color: colors.textDim };
      default:
        return { text: '', color: colors.textDim };
    }
  })();

  return (
    <View style={{ gap: dense ? 6 : compact ? 10 : 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>
          Enchère n°{a.no} · {desc.primaryRoleLabel}
        </Eyebrow>
        {targetLabel && a.stage !== 'closed' && (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textDim }}>
            Chez vous : <Text style={{ color: colors.accent }}>{targetLabel}</Text>
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: compact ? 12 : 18, alignItems: 'center' }}>
        <AuctionStage auction={a} character={character} pack={pack} width={cardW} winner={winner} flyTo={compact ? 'down' : 'left'} />
        <View style={{ flex: 1, gap: compact ? 8 : 14, alignItems: 'center' }}>
          {a.stage === 'open' && a.endsAt ? (
            <TimerRing endsAt={a.endsAt} totalMs={totalMs} size={dense ? 62 : compact ? 76 : 116} active />
          ) : (
            <View style={{ height: dense ? 62 : compact ? 76 : 116, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.display, color: colors.textMute, fontSize: 16, letterSpacing: 2 }}>{a.stage === 'reveal' ? 'PRÉPARATION' : 'TERMINÉ'}</Text>
            </View>
          )}
          <View style={{ alignItems: 'center', minHeight: compact ? 54 : 72 }} accessibilityLiveRegion="polite">
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2, color: colors.textMute }}>MEILLEURE OFFRE</Text>
            <Animated.Text testID="high-bid" style={[{ fontFamily: fonts.displayBlack, fontSize: compact ? 34 : 50, color: leader?.color ?? colors.textDim, fontVariant: ['tabular-nums'] }, amountStyle]}>
              {high ? `${high.amount}M` : '—'}
            </Animated.Text>
            {leader ? (
              <Animated.Text key={high!.id} entering={reduce ? undefined : FadeIn.duration(200)} style={{ fontFamily: fonts.display, fontSize: compact ? 15 : 18, color: colors.text, letterSpacing: 0.5 }} numberOfLines={1}>
                {leader.id === me?.id ? 'VOUS' : leader.nickname.toUpperCase()}
              </Animated.Text>
            ) : (
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMute }}>Mise d’ouverture {view.settings.reservePrice}M</Text>
            )}
          </View>
        </View>
      </View>

      {!compact && a.bids.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {a.bids
            .slice(-5)
            .reverse()
            .map((b, i) => {
              const p = view.participants.find((x) => x.id === b.participantId);
              return (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: colors.steel, opacity: i === 0 ? 1 : 0.6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p?.color }} />
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text }}>
                    {p?.nickname} {b.amount}M
                  </Text>
                </View>
              );
            })}
        </View>
      )}

      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: statusLine.color, minHeight: 18 }} testID="bid-status">
        {statusLine.text}
      </Text>

      <View style={{ gap: 8, opacity: a.stage === 'open' ? 1 : 0.35 }} pointerEvents={a.stage === 'open' ? 'auto' : 'none'}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {quick.map((q) => (
            <Button
              key={q.inc}
              label={high ? `+${q.inc}M` : `${q.amount}M`}
              variant={q.inc === 10 ? 'primary' : 'secondary'}
              size={compact ? 'md' : 'lg'}
              disabled={!canBid || q.amount > (canBid ? status.max : 0) || q.amount < (canBid ? status.min : Infinity)}
              onPress={() => send(q.amount)}
              style={{ flex: 1, paddingHorizontal: 4 }}
              accessibilityHint={`Enchérir ${q.amount} millions`}
              testID={`bid-${q.inc}`}
            />
          ))}
          {dense && passButton}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 18, height: compact ? 50 : 58 }}>
            <TextInput
              value={custom}
              onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder={canBid ? `${status.min}–${status.max}` : 'Montant'}
              placeholderTextColor={colors.textMute}
              keyboardType="number-pad"
              editable={canBid}
              onSubmitEditing={() => customValid && send(customValue)}
              accessibilityLabel="Montant personnalisé en millions"
              style={[{ flex: 1, width: 0, minWidth: 0, color: colors.text, fontFamily: fonts.heroSemi, fontSize: 18 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              testID="bid-custom"
            />
            <Text style={{ fontFamily: fonts.display, color: colors.textMute, fontSize: 20 }}>M</Text>
          </View>
          <Button label="Enchérir" variant="secondary" size={compact ? 'md' : 'lg'} disabled={!customValid} onPress={() => send(customValue)} testID="bid-custom-send" style={{ flexShrink: 0 }} />
        </View>
        {!dense && passButton}
      </View>
    </View>
  );
}
