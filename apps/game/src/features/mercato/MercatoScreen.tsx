/**
 * Mercato: timed trading window between the draft and the vote.
 * A team proposes one-for-one trades (plus optional cash), answers the offers
 * it receives, sells players back to the bank and declares itself ready.
 * Every rule is re-validated by the server: this screen only shows hints.
 *
 * Wide screens: two columns (offers + my squad | trade builder + activity).
 * Phones: one column, received offers first, then my squad, then the builder.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { compatibility, locate } from '@byt/game-engine';
import type { Ack, Character, ErrorCode, PackMeta, Participant, RoomView, SlotRef, TradeOffer } from '@byt/shared';
import { PlayerCard, colors, fonts, radii } from '@byt/ui';
import { Body, Button, Chip, Eyebrow, Panel, PlayerBadge, Title, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { haptic, playSound } from '@/lib/sound';
import { gameClient } from '@/state/game-client';
import { useReduceMotion } from '@/state/settings';
import { TimerRing } from '../draft/TimerRing';
import { teamStats } from '../end/TeamBoard';
import { enginePack, formationOf } from '../room/derive';
import { MiniButton, PlayerRow } from '../team/PlayerRow';

const CASH_STEP = 10;

interface Entry {
  id: string;
  slot: SlotRef;
  slotLabel: string;
  character: Character;
  /** What the team paid for him (null when unknown). */
  paid: number | null;
}

function roster(view: RoomView, pack: PackMeta, p: Participant): Entry[] {
  const f = formationOf(pack, p.team.formationId);
  const paid = (id: string) => p.team.purchases.find((x) => x.characterId === id)?.price ?? null;
  const out: Entry[] = [];
  p.team.starters.forEach((id, index) => {
    const c = id ? view.characters[id] : undefined;
    if (id && c) out.push({ id, slot: { kind: 'starter', index }, slotLabel: f.slots[index]?.label ?? '', character: c, paid: paid(id) });
  });
  p.team.bench.forEach((id, index) => {
    const c = id ? view.characters[id] : undefined;
    if (id && c) out.push({ id, slot: { kind: 'bench', index }, slotLabel: 'Banc', character: c, paid: paid(id) });
  });
  return out;
}

const slotLabelOf = (pack: PackMeta, p: Participant, slot: SlotRef) => (slot.kind === 'starter' ? formationOf(pack, p.team.formationId).slots[slot.index]?.label ?? '' : 'Banc');

/** Compatibility of `c` landing in `slot` of `p` (bench always fits). */
function fitScore(pack: PackMeta, p: Participant, slot: SlotRef, c: Character): number {
  if (slot.kind === 'bench') return 3;
  const s = formationOf(pack, p.team.formationId).slots[slot.index];
  return s ? compatibility(enginePack(pack), c, s) : 0;
}

/**
 * Hints for a one-for-one swap: `aId` leaves team `a` for team `b`, `bId` goes the other way.
 * `problems` mean the server will refuse the trade as things stand (INCOMPATIBLE_SLOT).
 */
function tradeHint(view: RoomView, pack: PackMeta, meId: string, a: Participant, aId: string, b: Participant, bId: string) {
  const problems: string[] = [];
  const notes: string[] = [];
  const where = (p: Participant) => (p.id === meId ? 'dans votre équipe' : `chez ${p.nickname}`);
  const check = (host: Participant, leaving: string, arriving: string) => {
    const slot = locate(host.team, leaving);
    const c = view.characters[arriving];
    if (!slot || !c) return;
    const label = slotLabelOf(pack, host, slot);
    const score = fitScore(pack, host, slot, c);
    if (score === 0) problems.push(`${c.shortName} ne peut pas jouer ${label} ${where(host)}.`);
    else if (score === 1) notes.push(`${c.shortName} jouerait hors poste (${label}) ${where(host)}.`);
    else notes.push(`${c.shortName} prendrait la place ${label} ${where(host)}.`);
  };
  check(a, aId, bId);
  check(b, bId, aId);
  return { problems, notes };
}

const nick = (view: RoomView, id: string) => view.participants.find((p) => p.id === id)?.nickname ?? 'Une équipe';

const STATUS: Record<TradeOffer['status'], { label: string; color: string }> = {
  pending: { label: 'EN ATTENTE', color: colors.accent },
  accepted: { label: 'ACCEPTÉE', color: colors.success },
  declined: { label: 'REFUSÉE', color: colors.danger },
  cancelled: { label: 'ANNULÉE', color: colors.textMute },
};

export function MercatoScreen({ view, pack, meId }: { view: RoomView; pack: PackMeta; meId: string }) {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [give, setGive] = useState<string | null>(null);
  const [take, setTake] = useState<{ teamId: string; id: string } | null>(null);
  const [cash, setCash] = useState(0);
  const [selling, setSelling] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Sounds, haptics and toasts from server events.
  useEffect(
    () =>
      gameClient.onEvents((events, v) => {
        for (const e of events) {
          if (e.type === 'trade_offered' && e.toId === meId) {
            playSound('reveal');
            haptic('warning');
            toast(`Nouvelle offre de ${nick(v, e.fromId)}`, 'info');
          } else if (e.type === 'trade_resolved') {
            const o = v.mercato?.offers.find((x) => x.id === e.offerId);
            if (!o) continue;
            if (o.fromId === meId && o.status === 'accepted') {
              playSound('sold');
              haptic('success');
              toast(`${nick(v, o.toId)} accepte votre échange`, 'success');
            } else if (o.fromId === meId && o.status === 'declined') {
              playSound('unsold');
              toast(`${nick(v, o.toId)} refuse votre offre`, 'info');
            } else if (o.toId === meId && o.status === 'cancelled') {
              toast(`${nick(v, o.fromId)} retire son offre`, 'info');
            } else if (o.status === 'accepted' && o.toId !== meId) {
              playSound('raise');
            }
          } else if (e.type === 'player_sold_to_bank' && e.participantId !== meId) {
            playSound('pass');
          }
        }
      }),
    [meId, toast],
  );

  const me = view.participants.find((p) => p.id === meId) ?? null;
  const m = view.mercato;
  if (!me || !m) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Body dim>Ouverture du mercato…</Body>
      </View>
    );
  }

  const others = view.participants.filter((p) => p.id !== meId);
  const target = others.find((p) => p.id === targetId) ?? others[0] ?? null;
  const mine = roster(view, pack, me);
  const theirs = target ? roster(view, pack, target) : [];
  const giveE = mine.find((e) => e.id === give) ?? null;
  const takeE = take && target && take.teamId === target.id ? (theirs.find((e) => e.id === take.id) ?? null) : null;
  const maxCash = Math.floor(Math.max(0, me.budget) / CASH_STEP) * CASH_STEP;
  const cashV = Math.min(cash, maxCash);
  const pendingTo = target ? (m.offers.find((o) => o.status === 'pending' && o.fromId === meId && o.toId === target.id) ?? null) : null;
  const incoming = m.offers.filter((o) => o.status === 'pending' && o.toId === meId);
  const outgoing = m.offers.filter((o) => o.fromId === meId).sort((x, y) => y.at - x.at);
  const iReady = m.ready.includes(meId);
  const hint = giveE && takeE && target ? tradeHint(view, pack, meId, me, giveE.id, target, takeE.id) : null;
  const sellEntry = mine.find((e) => e.id === selling) ?? null;

  const run = async (key: string, fn: () => Promise<Ack>, onOk?: () => void, overrides?: Partial<Record<ErrorCode, string>>) => {
    if (busy) return;
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.ok) onOk?.();
    else {
      playSound('error');
      toast(overrides?.[res.code] ?? errorMessage(res.code, res.details), 'error');
    }
  };

  const sendOffer = () => {
    if (!target || !giveE || !takeE) return;
    const to = target;
    void run(
      'offer',
      () => gameClient.offer(to.id, giveE.id, takeE.id, cashV),
      () => {
        haptic('light');
        toast(`Offre envoyée à ${to.nickname}`, 'success');
        setGive(null);
        setTake(null);
        setCash(0);
      },
      { ALREADY_OFFERED: `Une offre est déjà en attente auprès de ${to.nickname}.` },
    );
  };

  const respond = (o: TradeOffer, accept: boolean) =>
    void run(
      `respond-${o.id}`,
      () => gameClient.respond(o.id, accept),
      () => {
        if (accept) {
          playSound('sold');
          haptic('success');
          toast('Échange conclu', 'success');
        }
      },
      { INCOMPATIBLE_SLOT: 'Échange impossible : un joueur n’aurait pas de poste compatible à l’arrivée.' },
    );

  const confirmSell = (e: Entry, price: number) =>
    void run(
      'sell',
      () => gameClient.sell(e.id),
      () => {
        setSelling(null);
        if (give === e.id) setGive(null);
        playSound('sold');
        toast(`${e.character.shortName} vendu à la banque · +${price}M`, 'success');
      },
      { INCOMPATIBLE_SLOT: 'Vente impossible : aucun remplaçant compatible disponible, ou budget insuffisant pour le payer.' },
    );

  const markReady = () => void run('ready', () => gameClient.ready(), () => haptic('success'));

  /* ---------------------------------------------------------------- */

  const header = (
    <Panel style={{ padding: wide ? 16 : 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <TimerRing endsAt={m.endsAt} totalMs={Math.max(1, m.endsAt - m.startedAt)} size={wide ? 88 : 72} active />
        <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
          <Eyebrow>Mercato</Eyebrow>
          <Title size={wide ? 26 : 21}>Fenêtre des transferts</Title>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.textDim }}>
            Échangez un joueur contre un autre (avec un bonus si besoin) ou revendez-en un à la banque pour la moitié de son prix.
          </Text>
        </View>
        <View style={{ alignItems: wide ? 'flex-end' : 'flex-start', gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, color: colors.textMute }}>VOTRE BUDGET</Text>
          <Text testID="mercato-budget" style={{ fontFamily: fonts.displayBlack, fontSize: 24, color: colors.text, fontVariant: ['tabular-nums'] }}>
            {me.budget}M
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel="Équipes prêtes">
          {view.participants.map((p) => {
            const ready = !!p.bot || m.ready.includes(p.id);
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: 4,
                  paddingRight: 10,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: ready ? 'rgba(61,220,151,0.4)' : colors.line,
                  backgroundColor: ready ? 'rgba(61,220,151,0.08)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <PlayerBadge name={p.nickname} color={p.color} size={22} />
                <Text numberOfLines={1} style={{ maxWidth: 110, fontFamily: fonts.bodySemi, fontSize: 12, color: colors.text }}>
                  {p.id === meId ? 'Vous' : p.nickname}
                </Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.2, color: ready ? colors.success : colors.textMute }}>
                  {p.bot ? 'BOT · PRÊT' : ready ? 'PRÊT' : 'EN COURS'}
                </Text>
              </View>
            );
          })}
        </View>
        {iReady ? (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.success, textAlign: wide ? 'right' : 'center' }}>
            Vous êtes prêt · vous pouvez encore échanger jusqu’à la fin
          </Text>
        ) : (
          <Button testID="mercato-ready" label="Je suis prêt" variant="gold" loading={busy === 'ready'} onPress={markReady} accessibilityHint="Le mercato se termine quand toutes les équipes sont prêtes" />
        )}
      </View>
    </Panel>
  );

  const incomingPanel =
    incoming.length > 0 ? (
      <Panel tone="raised" style={{ padding: 14, gap: 12, borderColor: 'rgba(43,227,208,0.45)' }}>
        <SectionTitle title={`Offre${incoming.length > 1 ? 's' : ''} reçue${incoming.length > 1 ? 's' : ''}`} right={<Chip label={String(incoming.length)} color={colors.accent} tint="rgba(43,227,208,0.12)" />} />
        {incoming.map((o) => {
          const from = view.participants.find((p) => p.id === o.fromId);
          const giveC = view.characters[o.give];
          const takeC = view.characters[o.take];
          if (!from || !giveC || !takeC) return null;
          const h = tradeHint(view, pack, meId, me, o.take, from, o.give);
          const takeSlot = locate(me.team, o.take);
          const giveSlot = locate(from.team, o.give);
          return (
            <Animated.View key={o.id} entering={FadeInDown.duration(220)} style={{ gap: 10, padding: 12, borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: colors.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PlayerBadge name={from.nickname} color={from.color} size={24} />
                <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text }} numberOfLines={1}>
                  <Text style={{ color: from.color }}>{from.nickname}</Text> vous propose
                </Text>
              </View>
              <Swap
                pack={pack}
                left={{ title: 'Vous cédez', character: takeC, caption: takeSlot ? slotLabelOf(pack, me, takeSlot) : '' }}
                right={{ title: 'Vous recevez', character: giveC, caption: giveSlot ? slotLabelOf(pack, from, giveSlot) : '', extra: o.cash > 0 ? `+ ${o.cash}M` : undefined }}
              />
              <Hints problems={h.problems} notes={[]} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Refuser" variant="danger" size="sm" style={{ flex: 1 }} disabled={!!busy} onPress={() => respond(o, false)} />
                <Button testID={`offer-accept-${o.id}`} label="Accepter" size="sm" style={{ flex: 1 }} disabled={!!busy} loading={busy === `respond-${o.id}`} onPress={() => respond(o, true)} />
              </View>
            </Animated.View>
          );
        })}
      </Panel>
    ) : null;

  const myStats = teamStats(view, pack, me);
  const squadPanel = (
    <Panel style={{ padding: 14, gap: 10 }}>
      <SectionTitle
        title="Votre effectif"
        right={<Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMute }}>Note {myStats.rating.toFixed(1)}</Text>}
      />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textDim }}>
        Touchez un joueur pour le proposer dans un échange.
      </Text>
      <View style={{ gap: 4 }}>
        {mine.map((e) => {
          const price = Math.floor((e.paid ?? view.settings.reservePrice) / 2);
          return (
            <PlayerRow
              key={e.id}
              testID={`mine-${e.id}`}
              character={e.character}
              pack={pack}
              caption={`${e.slotLabel}${e.paid !== null ? ` · payé ${e.paid}M` : ''}`}
              selected={give === e.id}
              accent={colors.accent}
              onPress={() => setGive(give === e.id ? null : e.id)}
              right={<MiniButton label={`Vendre ${price}M`} tone="danger" accessibilityLabel={`Vendre ${e.character.name} à la banque pour ${price} millions`} onPress={() => setSelling(e.id)} disabled={!!busy} />}
            />
          );
        })}
      </View>
    </Panel>
  );

  const builder = (
    <Panel style={{ padding: 14, gap: 12 }}>
      <SectionTitle title="Proposer un échange" />
      {others.length === 0 ? (
        <Body dim>Aucune autre équipe.</Body>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
            {others.map((p) => {
              const on = target?.id === p.id;
              const pending = m.offers.some((o) => o.status === 'pending' && o.fromId === meId && o.toId === p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setTargetId(p.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Équipe de ${p.nickname}, budget ${p.budget} millions`}
                  style={[
                    {
                      minWidth: 132,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 7,
                      paddingLeft: 7,
                      paddingRight: 12,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: on ? `${p.color}AA` : colors.line,
                      backgroundColor: on ? `${p.color}18` : 'rgba(255,255,255,0.03)',
                    },
                    Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
                  ]}
                >
                  <PlayerBadge name={p.nickname} color={p.color} size={26} ring={on} />
                  <View style={{ flexShrink: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 14, color: colors.text }}>
                      {p.nickname}
                    </Text>
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: pending ? colors.accent : colors.textMute }}>
                      {pending ? 'Offre en cours' : `${p.budget}M${p.bot ? ' · bot' : ''}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {target && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textDim, marginBottom: 2 }}>
                Touchez le joueur de <Text style={{ color: target.color, fontFamily: fonts.bodyBold }}>{target.nickname}</Text> que vous voulez recevoir.
              </Text>
              {theirs.map((e) => (
                <PlayerRow
                  key={e.id}
                  testID={`theirs-${e.id}`}
                  character={e.character}
                  pack={pack}
                  caption={`${e.slotLabel}${e.paid !== null ? ` · payé ${e.paid}M` : ''}`}
                  selected={takeE?.id === e.id}
                  accent={target.color}
                  onPress={() => setTake(takeE?.id === e.id ? null : { teamId: target.id, id: e.id })}
                />
              ))}
            </View>
          )}

          {target && (
            <View style={{ gap: 12, padding: 12, borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: colors.line }}>
              <Swap
                pack={pack}
                left={{ title: 'Vous donnez', character: giveE?.character ?? null, caption: giveE?.slotLabel ?? '', placeholder: 'Choisissez dans votre effectif' }}
                right={{ title: 'Vous recevez', character: takeE?.character ?? null, caption: takeE?.slotLabel ?? '', placeholder: `Choisissez chez ${target.nickname}` }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text }}>Bonus versé</Text>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMute }}>De 0 à {maxCash}M, payé par vous</Text>
                </View>
                <MiniButton label="−10" accessibilityLabel="Retirer 10 millions" disabled={cashV <= 0} onPress={() => setCash(Math.max(0, cashV - CASH_STEP))} />
                <Text testID="mercato-cash" style={{ minWidth: 58, textAlign: 'center', fontFamily: fonts.displayBlack, fontSize: 18, color: cashV > 0 ? colors.gold : colors.text, fontVariant: ['tabular-nums'] }}>
                  {cashV}M
                </Text>
                <MiniButton label="+10" accessibilityLabel="Ajouter 10 millions" disabled={cashV + CASH_STEP > maxCash} onPress={() => setCash(Math.min(maxCash, cashV + CASH_STEP))} />
              </View>
              {hint && <Hints problems={hint.problems} notes={hint.notes} />}
              {hint && hint.problems.length > 0 && (
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMute }}>
                  Le serveur refusera l’échange tant que ce poste reste incompatible (les compositions peuvent encore changer).
                </Text>
              )}
              {pendingTo ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent }}>
                    Une offre attend déjà la réponse de {target.nickname}.
                  </Text>
                  <MiniButton label="Retirer" tone="danger" disabled={!!busy} onPress={() => respond(pendingTo, false)} />
                </View>
              ) : (
                <Button
                  testID="mercato-send"
                  label={giveE && takeE ? `Proposer à ${target.nickname}` : 'Choisissez les deux joueurs'}
                  disabled={!giveE || !takeE || !!busy}
                  loading={busy === 'offer'}
                  onPress={sendOffer}
                />
              )}
            </View>
          )}
        </>
      )}
    </Panel>
  );

  const outgoingPanel =
    outgoing.length > 0 ? (
      <Panel style={{ padding: 14, gap: 8 }}>
        <SectionTitle title="Vos offres" />
        {outgoing.map((o) => (
          <OfferLine key={o.id} view={view} offer={o} meId={meId} action={o.status === 'pending' ? <MiniButton label="Retirer" tone="danger" disabled={!!busy} onPress={() => respond(o, false)} /> : null} />
        ))}
      </Panel>
    ) : null;

  const marketOffers = m.offers.filter((o) => o.fromId !== meId && !(o.toId === meId && o.status === 'pending')).sort((x, y) => y.at - x.at);
  const sales = [...m.sales].reverse();
  const activityPanel = (
    <Panel style={{ padding: 14, gap: 8 }}>
      <SectionTitle title="Activité du marché" />
      {sales.length === 0 && marketOffers.length === 0 ? (
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textMute }}>Aucun mouvement pour l’instant.</Text>
      ) : (
        <>
          {sales.map((s, i) => {
            const c = view.characters[s.characterId];
            return (
              <View key={`${s.characterId}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Chip label="VENTE" color={colors.gold} tint="rgba(230,193,112,0.1)" style={{ paddingHorizontal: 8, paddingVertical: 3 }} />
                <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textDim }} numberOfLines={2}>
                  <Text style={{ color: colors.text, fontFamily: fonts.bodySemi }}>{s.participantId === meId ? 'Vous' : nick(view, s.participantId)}</Text>
                  {s.participantId === meId ? ' avez vendu ' : ' a vendu '}
                  <Text style={{ color: colors.text, fontFamily: fonts.bodySemi }}>{c?.shortName ?? 'un joueur'}</Text> à la banque
                </Text>
                <Text style={{ fontFamily: fonts.number, fontSize: 13, color: colors.gold }}>+{s.price}M</Text>
              </View>
            );
          })}
          {marketOffers.map((o) => (
            <OfferLine key={o.id} view={view} offer={o} meId={meId} />
          ))}
        </>
      )}
    </Panel>
  );

  const sheet = sellEntry ? (
    <SellDialog
      entry={sellEntry}
      pack={pack}
      budget={me.budget}
      reserve={view.settings.reservePrice}
      hasPending={m.offers.some((o) => o.status === 'pending' && (o.give === sellEntry.id || o.take === sellEntry.id))}
      busy={busy === 'sell'}
      onCancel={() => setSelling(null)}
      onConfirm={(price) => confirmSell(sellEntry, price)}
    />
  ) : null;

  if (wide) {
    return (
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, width: '100%', maxWidth: 1280, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {header}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
            {incomingPanel}
            {squadPanel}
          </View>
          <View style={{ flex: 1.1, minWidth: 0, gap: 14 }}>
            {builder}
            {outgoingPanel}
            {activityPanel}
          </View>
        </View>
        {sheet}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      {header}
      {incomingPanel}
      {squadPanel}
      {builder}
      {outgoingPanel}
      {activityPanel}
      {sheet}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ flex: 1, fontFamily: fonts.heroSemi, fontSize: 15, color: colors.text, letterSpacing: -0.2 }}>{title}</Text>
      {right}
    </View>
  );
}

function Hints({ problems, notes }: { problems: string[]; notes: string[] }) {
  if (problems.length === 0 && notes.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      {problems.map((t) => (
        <Text key={t} style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.warn }}>
          ⚠ {t}
        </Text>
      ))}
      {notes.map((t) => (
        <Text key={t} style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textDim }}>
          {t}
        </Text>
      ))}
    </View>
  );
}

interface SwapSide {
  title: string;
  character: Character | null;
  caption: string;
  placeholder?: string;
  extra?: string;
}

/** Two players face to face with an exchange arrow. */
function Swap({ pack, left, right }: { pack: PackMeta; left: SwapSide; right: SwapSide }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <SwapCard pack={pack} side={left} />
      <Text style={{ fontFamily: fonts.heroBold, fontSize: 18, color: colors.textMute }} accessibilityElementsHidden importantForAccessibility="no">
        ⇄
      </Text>
      <SwapCard pack={pack} side={right} />
    </View>
  );
}

function SwapCard({ pack, side }: { pack: PackMeta; side: SwapSide }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, color: colors.textMute }}>{side.title.toUpperCase()}</Text>
      {side.character ? (
        <>
          <PlayerCard character={side.character} pack={pack} width={60} variant="compact" />
          <Text numberOfLines={1} style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text, maxWidth: '100%' }}>
            {side.character.shortName}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMute, marginTop: -4 }}>
            {side.caption}
          </Text>
          {side.extra ? <Text style={{ fontFamily: fonts.number, fontSize: 13, color: colors.gold }}>{side.extra}</Text> : null}
        </>
      ) : (
        <View style={{ width: 60, height: 78, borderRadius: radii.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.heroBold, fontSize: 18, color: colors.textMute }}>?</Text>
        </View>
      )}
      {!side.character && side.placeholder ? (
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMute, textAlign: 'center' }}>{side.placeholder}</Text>
      ) : null}
    </View>
  );
}

function OfferLine({ view, offer, meId, action }: { view: RoomView; offer: TradeOffer; meId: string; action?: ReactNode }) {
  const st = STATUS[offer.status];
  const g = view.characters[offer.give]?.shortName ?? '?';
  const t = view.characters[offer.take]?.shortName ?? '?';
  const from = offer.fromId === meId ? 'Vous' : nick(view, offer.fromId);
  const to = offer.toId === meId ? 'vous' : nick(view, offer.toId);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text }}>
          {g} ⇄ {t}
          {offer.cash > 0 ? <Text style={{ color: colors.gold }}> + {offer.cash}M</Text> : null}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textMute }}>
          {from} → {to}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.2, color: st.color }}>{st.label}</Text>
      {action}
    </View>
  );
}

function SellDialog({
  entry,
  pack,
  budget,
  reserve,
  hasPending,
  busy,
  onCancel,
  onConfirm,
}: {
  entry: Entry;
  pack: PackMeta;
  budget: number;
  reserve: number;
  hasPending: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (price: number) => void;
}) {
  const reduce = useReduceMotion();
  const paid = entry.paid ?? reserve;
  const price = Math.floor(paid / 2);
  const starter = entry.slot.kind === 'starter';
  const net = starter ? price - reserve : price;
  const cannotPay = starter && budget + price < reserve;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onCancel}>
      <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} style={{ flex: 1, backgroundColor: 'rgba(3,5,8,0.82)', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={onCancel} accessibilityLabel="Fermer" />
        <Animated.View
          entering={reduce ? undefined : ZoomIn.springify().damping(16)}
          style={{ width: '100%', maxWidth: 380, backgroundColor: colors.graphite, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 }}
        >
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <PlayerCard character={entry.character} pack={pack} width={64} variant="compact" />
            <View style={{ flex: 1, gap: 2 }}>
              <Eyebrow color={colors.gold}>Vente à la banque</Eyebrow>
              <Title size={20}>Vendre {entry.character.shortName} ?</Title>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute }}>{entry.slotLabel}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 21, color: colors.textDim }}>
            Vous récupérez <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold }}>{price}M</Text>, la moitié des {paid}M payés.
          </Text>
          {starter ? (
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 21, color: colors.textDim }}>
              Titulaire : il sera remplacé en {entry.slotLabel} par le joueur libre compatible le moins bien noté, payé au prix de réserve ({reserve}M). Bilan :{' '}
              <Text style={{ color: net >= 0 ? colors.success : colors.warn, fontFamily: fonts.bodyBold }}>
                {net >= 0 ? '+' : ''}
                {net}M
              </Text>
              .
            </Text>
          ) : (
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 21, color: colors.textDim }}>Remplaçant : sa place sur le banc restera libre.</Text>
          )}
          {hasPending && <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.warn }}>Les offres en cours qui le concernent seront annulées.</Text>}
          {cannotPay && <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.warn }}>Budget insuffisant pour payer le remplaçant : la vente sera refusée.</Text>}
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute }}>Définitif : le joueur retourne dans la liste des joueurs libres.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Annuler" variant="secondary" size="md" style={{ flex: 1 }} onPress={onCancel} />
            <Button testID="sell-confirm" label={`Vendre · ${price}M`} variant="danger" size="md" style={{ flex: 1 }} loading={busy} disabled={busy} onPress={() => onConfirm(price)} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
