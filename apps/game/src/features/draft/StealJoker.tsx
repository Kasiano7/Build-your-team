/**
 * Steal joker (room option `jokers`): during the draft, take a player from
 * another team for 1.5× what it paid (rounded up to the increment); the victim
 * is refunded. Needs a compatible free slot and enough budget under the
 * reserve rule. The server re-validates everything.
 */
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { bestSlotFor, maxBidFor, stealPrice } from '@byt/game-engine';
import type { PackMeta, Participant, RoomState, RoomView } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { Button, Eyebrow, Title, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { haptic, playSound } from '@/lib/sound';
import { gameClient } from '@/state/game-client';
import { useReduceMotion } from '@/state/settings';
import { enginePack, formationOf } from '../room/derive';
import { PlayerRow } from '../team/PlayerRow';

/** Toasts and sounds for steals, for the thief, the victim and everyone else. */
export function useStealAnnouncements(meId: string) {
  const toast = useToast();
  useEffect(
    () =>
      gameClient.onEvents((events, v) => {
        for (const e of events) {
          if (e.type !== 'joker_steal') continue;
          const name = v.characters[e.characterId]?.name ?? 'un joueur';
          const nick = (id: string) => v.participants.find((p) => p.id === id)?.nickname ?? 'Une équipe';
          if (e.participantId === meId) {
            playSound('sold');
            haptic('success');
            toast(`Joker vol : ${name} rejoint votre équipe (${e.price}M)`, 'success');
          } else if (e.targetId === meId) {
            playSound('unsold');
            haptic('warning');
            toast(`${nick(e.participantId)} vous a volé ${name} ! Vous êtes remboursé.`, 'error');
          } else {
            playSound('raise');
            toast(`${nick(e.participantId)} a volé ${name} à ${nick(e.targetId)} (${e.price}M)`, 'info');
          }
        }
      }),
    [meId, toast],
  );
}

/** Header entry point: visible only when viewing an opponent and my steal joker is unused. */
export function StealJoker({ view, pack, me, victim, onStolen }: { view: RoomView; pack: PackMeta; me: Participant | null; victim: Participant; onStolen?: () => void }) {
  const [open, setOpen] = useState(false);
  if (view.status !== 'drafting' || !view.settings.jokers || !me?.jokers?.steal || victim.id === me.id) return null;
  return (
    <>
      <Pressable
        testID="joker-steal"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Joker vol : prendre un joueur à ${victim.nickname}`}
        style={(state) => [
          {
            alignSelf: 'center',
            marginLeft: 'auto',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 28,
            paddingHorizontal: 12,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: 'rgba(230,193,112,0.55)',
            backgroundColor: 'rgba(230,193,112,0.10)',
            transform: [{ scale: state.pressed ? 0.96 : 1 }],
          },
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
        ]}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, color: colors.gold }}>JOKER VOL</Text>
      </Pressable>
      {open && (
        <StealSheet
          view={view}
          pack={pack}
          me={me}
          victim={victim}
          onClose={() => setOpen(false)}
          onStolen={() => {
            setOpen(false);
            onStolen?.();
          }}
        />
      )}
    </>
  );
}

function StealSheet({ view, pack, me, victim, onClose, onStolen }: { view: RoomView; pack: PackMeta; me: Participant; victim: Participant; onClose: () => void; onStolen: () => void }) {
  const toast = useToast();
  const reduce = useReduceMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ep = enginePack(pack);
  const myFormation = formationOf(pack, me.team.formationId);
  const victimFormation = formationOf(pack, victim.team.formationId);
  const a = view.auction;
  // While I lead the current auction (or have a sealed offer in), my slot is spoken for: the server refuses.
  const leading = !!a && a.stage === 'open' && (a.highBid?.participantId === me.id || (a.style === 'sealed' && a.bids.some((b) => b.participantId === me.id)));
  const state = { settings: view.settings } as RoomState;

  const slots = [
    ...victim.team.starters.map((id, i) => ({ id, label: victimFormation.slots[i]?.label ?? '' })),
    ...victim.team.bench.map((id) => ({ id, label: 'Banc' })),
  ];
  const options = slots.flatMap(({ id, label }) => {
    const c = id ? view.characters[id] : undefined;
    if (!id || !c) return [];
    const { price, refund } = stealPrice(state, victim, id);
    const slot = bestSlotFor(ep, me.team, c);
    const max = slot ? maxBidFor(ep, view.settings, me, c) : 0;
    const dest = slot ? (slot.kind === 'starter' ? (myFormation.slots[slot.index]?.label ?? '') : 'Banc') : null;
    const reason = leading ? 'Vous menez l’enchère en cours' : !slot ? 'Aucune place compatible chez vous' : price > max ? `Budget insuffisant (max ${max}M)` : null;
    return [{ id, c, label, price, refund, dest, reason }];
  });
  const choice = options.find((o) => o.id === picked && !o.reason) ?? null;

  const steal = async () => {
    if (!choice || busy) return;
    setBusy(true);
    const res = await gameClient.steal(victim.id, choice.id);
    setBusy(false);
    if (res.ok) onStolen();
    else {
      playSound('error');
      toast(errorMessage(res.code, res.details), 'error');
    }
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} style={{ flex: 1, backgroundColor: 'rgba(3,5,8,0.82)', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={onClose} accessibilityLabel="Fermer" />
        <Animated.View
          entering={reduce ? undefined : SlideInDown.springify().damping(18)}
          style={{ width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: colors.graphite, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(230,193,112,0.35)', padding: 16, gap: 12 }}
        >
          <View style={{ gap: 4 }}>
            <Eyebrow color={colors.gold}>Joker vol · usage unique</Eyebrow>
            <Title size={20}>
              Voler un joueur à <Text style={{ color: victim.color }}>{victim.nickname}</Text>
            </Title>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.textDim }}>
              Prix : 1,5 × ce qu’il a coûté, arrondi au palier de {view.settings.minIncrement}M. {victim.nickname} est remboursé de son prix d’achat.
            </Text>
            {leading && <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.warn }}>Vous menez l’enchère en cours : attendez qu’elle se termine.</Text>}
          </View>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 4 }}>
            {options.length === 0 && <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMute }}>Cette équipe n’a encore aucun joueur.</Text>}
            {options.map((o) => (
              <PlayerRow
                key={o.id}
                testID={`steal-${o.id}`}
                character={o.c}
                pack={pack}
                caption={o.reason ?? `${o.label} · payé ${o.refund}M → ${o.dest}`}
                selected={picked === o.id && !o.reason}
                accent={colors.gold}
                muted={!!o.reason}
                onPress={o.reason ? undefined : () => setPicked(picked === o.id ? null : o.id)}
                right={
                  <Text style={{ minWidth: 48, textAlign: 'right', fontFamily: fonts.number, fontSize: 14, color: o.reason ? colors.textMute : colors.gold, fontVariant: ['tabular-nums'] }}>
                    {o.price}M
                  </Text>
                }
              />
            ))}
          </ScrollView>
          {choice ? (
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.textDim }}>
              <Text style={{ color: colors.text, fontFamily: fonts.bodyBold }}>{choice.c.name}</Text> ira en {choice.dest} chez vous. Budget {me.budget}M →{' '}
              <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold }}>{me.budget - choice.price}M</Text>, {victim.nickname} récupère {choice.refund}M.
            </Text>
          ) : (
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMute }}>Choisissez le joueur à voler.</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Annuler" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <Button testID="steal-confirm" label={choice ? `Voler · ${choice.price}M` : 'Voler'} variant="gold" style={{ flex: 1 }} disabled={!choice} loading={busy} onPress={steal} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
