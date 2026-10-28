/**
 * Big-screen draft and mercato (spectator, read only). Authored on the
 * 1920×1080 TV stage: sizes are stage pixels.
 */
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { dutchPrice } from '@byt/game-engine';
import type { Auction, PackMeta, Participant, RoomView, TradeOffer } from '@byt/shared';
import { colors, describeCharacter, fonts, radii } from '@byt/ui';
import { Eyebrow, Panel, PlayerBadge } from '@/components/ui';
import { useServerNow } from '@/state/hooks';
import { useReduceMotion } from '@/state/settings';
import { AuctionStage } from '../draft/AuctionStage';
import { TimerRing } from '../draft/TimerRing';
import { filledCount } from '../room/derive';

const STYLE_LABEL: Record<string, string> = { english: 'Enchères classiques', dutch: 'Enchère hollandaise', sealed: 'Offres secrètes' };

/* ------------------------------------------------------------------ */
/* Teams strip                                                          */
/* ------------------------------------------------------------------ */

type Tag = { text: string; color: string } | null;

function auctionTag(a: Auction | null, p: Participant): Tag {
  if (!a) return null;
  if (a.stage === 'closed') {
    if (a.result?.type === 'sold' && a.result.participantId === p.id) return { text: 'REMPORTE', color: p.color };
    if (a.result?.type === 'vetoed' && a.result.participantId === p.id) return { text: 'VETO', color: colors.warn };
    return null;
  }
  if (a.stage !== 'open') return null;
  if (a.style === 'sealed') {
    if (a.bids.some((b) => b.participantId === p.id)) return { text: 'OFFRE SCELLÉE', color: colors.accent };
  } else if (a.highBid?.participantId === p.id) return { text: 'EN TÊTE', color: p.color };
  if (a.passed.includes(p.id)) return { text: 'PASSE', color: colors.textMute };
  if (!a.eligible.includes(p.id)) return { text: 'HORS COURSE', color: colors.textMute };
  if (a.halfPriceArmed?.includes(p.id)) return { text: '½ PRIX ARMÉ', color: colors.gold };
  return null;
}

export function TvTeams({ view, tagFor }: { view: RoomView; tagFor?: (p: Participant) => Tag }) {
  return (
    <View style={{ flexDirection: 'row', gap: 20 }}>
      {view.participants.map((p) => {
        const slots = p.team.starters.length;
        const filled = filledCount(p);
        const tag = tagFor?.(p) ?? null;
        return (
          <View
            key={p.id}
            accessible
            accessibilityLabel={`${p.nickname}, budget ${p.budget} millions, ${filled} sur ${slots} joueurs`}
            style={{
              flex: 1,
              padding: 20,
              gap: 12,
              borderRadius: radii.lg,
              borderWidth: 2,
              borderColor: tag && tag.color === p.color ? p.color : 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(12,18,25,0.72)',
              opacity: p.connected || p.bot ? 1 : 0.6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <PlayerBadge name={p.nickname} color={p.color} size={54} ring={!!tag && tag.color === p.color} />
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 30, color: colors.text }} numberOfLines={1}>
                {p.nickname}
              </Text>
              <Text style={{ fontFamily: fonts.displayBlack, fontSize: 40, color: colors.text, fontVariant: ['tabular-nums'] }}>{p.budget}M</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {Array.from({ length: slots }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < filled ? p.color : 'rgba(255,255,255,0.12)' }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 26 }}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 20, color: colors.textDim }}>
                {filled}/{slots} joueurs{p.bot ? ' · bot' : ''}
              </Text>
              {tag ? (
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, letterSpacing: 1.6, color: tag.color }}>{tag.text}</Text>
              ) : !p.connected && !p.bot ? (
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, letterSpacing: 1.6, color: colors.warn }}>HORS LIGNE</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Draft                                                                */
/* ------------------------------------------------------------------ */

function DutchPrice({ auction }: { auction: Auction }) {
  const now = useServerNow(100);
  const price = dutchPrice(auction, now);
  const d = auction.dutch!;
  return (
    <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: 3, color: colors.textMute }}>PRIX QUI BAISSE</Text>
      <Text style={{ fontFamily: fonts.displayBlack, fontSize: 130, lineHeight: 146, color: price <= d.floor ? colors.warn : colors.accent, fontVariant: ['tabular-nums'] }}>{price}M</Text>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 24, color: colors.textDim }}>
        Le premier qui prend l’emporte · plancher {d.floor}M
      </Text>
    </View>
  );
}

function PriceBlock({ view, auction }: { view: RoomView; auction: Auction }) {
  const reduce = useReduceMotion();
  const a = auction;
  // The amount stays on screen and pulses on every new high bid (no remount, always readable).
  const pulse = useSharedValue(1);
  const highId = a.highBid?.id;
  useEffect(() => {
    if (!highId || reduce) return;
    pulse.set(withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 9, stiffness: 200 })));
  }, [highId, reduce, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const team = (id: string) => view.participants.find((p) => p.id === id);
  if (a.stage === 'reveal') {
    return <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.textDim, letterSpacing: 2 }} numberOfLines={1}>PRÉSENTATION DU JOUEUR…</Text>;
  }
  if (a.stage === 'closed') {
    const r = a.result;
    if (r?.type === 'sold') {
      const w = team(r.participantId);
      return (
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: 3, color: colors.textMute }}>ADJUGÉ</Text>
          <Text style={{ fontFamily: fonts.displayBlack, fontSize: 130, lineHeight: 146, color: w?.color ?? colors.accent, fontVariant: ['tabular-nums'] }}>{r.amount}M</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.text }} numberOfLines={1}>
            {w?.nickname.toUpperCase()}
            {r.halfPrice ? <Text style={{ color: colors.gold, fontSize: 28 }}> · joker ½ prix</Text> : null}
          </Text>
        </View>
      );
    }
    if (r?.type === 'vetoed') {
      return <Text style={{ fontFamily: fonts.display, fontSize: 48, color: colors.warn }}>VETO DE {team(r.participantId)?.nickname.toUpperCase()}</Text>;
    }
    return <Text style={{ fontFamily: fonts.display, fontSize: 48, color: colors.textDim }}>INVENDU</Text>;
  }
  if (a.style === 'dutch' && a.dutch) return <DutchPrice auction={a} />;
  if (a.style === 'sealed') {
    const sealed = a.bids.length;
    // Teams that passed can no longer make an offer.
    const able = a.eligible.filter((id) => !a.passed.includes(id) || a.bids.some((b) => b.participantId === id)).length;
    return (
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: 3, color: colors.textMute }}>OFFRES SECRÈTES</Text>
        <Text style={{ fontFamily: fonts.displayBlack, fontSize: 110, lineHeight: 126, color: colors.text, fontVariant: ['tabular-nums'] }}>
          {sealed}
          <Text style={{ fontSize: 56, color: colors.textMute }}>/{able}</Text>
        </Text>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 24, color: colors.textDim }}>offres scellées · montants révélés à la clôture</Text>
      </View>
    );
  }
  const high = a.highBid;
  const leader = high ? team(high.participantId) : undefined;
  return (
    <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: 3, color: colors.textMute }}>MEILLEURE OFFRE</Text>
      <Animated.Text style={[{ alignSelf: 'flex-start', transformOrigin: 'left center', fontFamily: fonts.displayBlack, fontSize: 130, lineHeight: 146, color: leader?.color ?? colors.textDim, fontVariant: ['tabular-nums'] }, pulseStyle]}>
        {high ? `${high.amount}M` : '—'}
      </Animated.Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.text }} numberOfLines={1}>
        {leader ? leader.nickname.toUpperCase() : `Mise d’ouverture ${view.settings.reservePrice}M`}
      </Text>
    </View>
  );
}

function History({ view }: { view: RoomView }) {
  const items = view.history.slice(-7).reverse();
  return (
    <Panel style={{ flex: 1, gap: 14, padding: 24 }}>
      <Eyebrow style={{ fontSize: 16 }}>Derniers transferts</Eyebrow>
      {items.length === 0 ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 22, color: colors.textMute }}>Aucune vente pour l’instant.</Text>
      ) : (
        items.map((h) => {
          const c = view.characters[h.characterId];
          const r = h.result;
          const p = r.type === 'sold' || r.type === 'vetoed' ? view.participants.find((x) => x.id === r.participantId) : undefined;
          return (
            <View key={h.no} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 8, height: 34, borderRadius: 4, backgroundColor: r.type === 'sold' ? p?.color ?? colors.accent : 'rgba(255,255,255,0.12)' }} />
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: r.type === 'sold' ? colors.text : colors.textMute }} numberOfLines={1}>
                {c?.shortName ?? '—'}
              </Text>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 22, color: colors.textDim }} numberOfLines={1}>
                {r.type === 'sold' ? `${p?.nickname ?? ''} · ` : r.type === 'vetoed' ? `veto ${p?.nickname ?? ''}` : 'invendu'}
              </Text>
              {r.type === 'sold' && <Text style={{ fontFamily: fonts.displayBlack, fontSize: 24, color: colors.text, fontVariant: ['tabular-nums'] }}>{r.amount}M</Text>}
            </View>
          );
        })
      )}
    </Panel>
  );
}

export function TvDraft({ view, pack }: { view: RoomView; pack: PackMeta }) {
  const a = view.auction;
  if (!a) {
    return (
      <View style={{ flex: 1, gap: 36 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.hero, fontSize: 64, color: colors.text }}>Finalisation des équipes…</Text>
        </View>
        <TvTeams view={view} />
      </View>
    );
  }
  const c = view.characters[a.characterId]!;
  const desc = describeCharacter(pack, c);
  const winner = a.result?.type === 'sold' ? view.participants.find((p) => p.id === (a.result as { participantId: string }).participantId) ?? null : null;
  const style = a.style ?? 'english';
  const totalMs = (style === 'english' && a.highBid ? view.settings.bidResetSec : view.settings.openingTimerSec) * 1000;
  return (
    <View style={{ flex: 1, gap: 32 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 48 }}>
        <View style={{ width: 440, alignItems: 'center', justifyContent: 'center' }}>
          <AuctionStage auction={a} character={c} pack={pack} width={420} winner={winner} flyTo="down" />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
          <Eyebrow style={{ fontSize: 18 }}>
            Enchère n°{a.no} · {desc.primaryRoleLabel} · {STYLE_LABEL[style]}
          </Eyebrow>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.hero, fontSize: 68, lineHeight: 78, color: colors.text, letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
              {c.name}
            </Text>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 28, color: colors.textDim }} numberOfLines={1}>
              Note {c.masked ? '?' : c.overall}
              {c.masked ? ' · mode Mystère' : ''}
              {c.affiliation ? ` · ${c.affiliation}` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 48 }}>
            <View style={{ flex: 1 }}>
              <PriceBlock view={view} auction={a} />
            </View>
            {a.stage === 'open' && a.endsAt ? <TimerRing endsAt={a.endsAt} totalMs={totalMs} size={230} active /> : <View style={{ width: 230 }} />}
          </View>
        </View>
        <View style={{ width: 460 }}>
          <History view={view} />
        </View>
      </View>
      <TvTeams view={view} tagFor={(p) => auctionTag(a, p)} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Mercato                                                              */
/* ------------------------------------------------------------------ */

const OFFER_STATUS: Record<TradeOffer['status'], { text: string; color: string }> = {
  pending: { text: 'EN ATTENTE', color: colors.warn },
  accepted: { text: 'ACCEPTÉE', color: colors.success },
  declined: { text: 'REFUSÉE', color: colors.danger },
  cancelled: { text: 'ANNULÉE', color: colors.textMute },
};

export function TvMercato({ view }: { view: RoomView }) {
  const reduce = useReduceMotion();
  const m = view.mercato;
  const team = (id: string) => view.participants.find((p) => p.id === id);
  const name = (id: string) => view.characters[id]?.shortName ?? '—';
  const offers = [...(m?.offers ?? [])].sort((a, b) => b.at - a.at).slice(0, 7);
  const sales = [...(m?.sales ?? [])].reverse().slice(0, 7);
  const ready = m?.ready.length ?? 0;
  return (
    <View style={{ flex: 1, gap: 32 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 40 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Eyebrow style={{ fontSize: 18 }}>Mercato · échanges entre équipes</Eyebrow>
          <Text style={{ fontFamily: fonts.hero, fontSize: 72, color: colors.text, letterSpacing: -1 }}>Le marché est ouvert</Text>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 28, color: colors.textDim }}>
            {ready}/{view.participants.length} équipe{view.participants.length > 1 ? 's' : ''} prête{ready > 1 ? 's' : ''}
          </Text>
        </View>
        {m && <TimerRing endsAt={m.endsAt} totalMs={(view.settings.mercatoTimerSec ?? 90) * 1000} size={200} active />}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 32 }}>
        <Panel style={{ flex: 1.4, gap: 16, padding: 24 }}>
          <Eyebrow style={{ fontSize: 16 }}>Offres d’échange</Eyebrow>
          {offers.length === 0 ? (
            <Text style={{ fontFamily: fonts.body, fontSize: 24, color: colors.textMute }}>Aucune offre pour l’instant.</Text>
          ) : (
            offers.map((o) => {
              const from = team(o.fromId);
              const to = team(o.toId);
              const st = OFFER_STATUS[o.status];
              return (
                <Animated.View key={o.id} entering={reduce ? undefined : FadeInDown.duration(260)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={{ width: 170, fontFamily: fonts.display, fontSize: 24, color: from?.color ?? colors.text }} numberOfLines={1}>
                    {from?.nickname}
                  </Text>
                  <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 24, color: colors.text }} numberOfLines={1}>
                    {name(o.give)} <Text style={{ color: colors.textMute }}>⇄</Text> {name(o.take)}
                    {o.cash > 0 ? <Text style={{ color: colors.gold }}> + {o.cash}M</Text> : null}
                  </Text>
                  <Text style={{ width: 170, fontFamily: fonts.display, fontSize: 24, color: to?.color ?? colors.text, textAlign: 'right' }} numberOfLines={1}>
                    {to?.nickname}
                  </Text>
                  <Text style={{ width: 150, textAlign: 'right', fontFamily: fonts.bodyBold, fontSize: 16, letterSpacing: 1.4, color: st.color }}>{st.text}</Text>
                </Animated.View>
              );
            })
          )}
        </Panel>
        <Panel style={{ flex: 1, gap: 16, padding: 24 }}>
          <Eyebrow style={{ fontSize: 16 }}>Ventes à la banque</Eyebrow>
          {sales.length === 0 ? (
            <Text style={{ fontFamily: fonts.body, fontSize: 24, color: colors.textMute }}>Aucune vente.</Text>
          ) : (
            sales.map((sale, i) => {
              const p = team(sale.participantId);
              return (
                <View key={`${sale.characterId}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 8, height: 30, borderRadius: 4, backgroundColor: p?.color ?? colors.textMute }} />
                  <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 24, color: colors.text }} numberOfLines={1}>
                    {p?.nickname} vend {name(sale.characterId)}
                  </Text>
                  <Text style={{ fontFamily: fonts.displayBlack, fontSize: 24, color: colors.text }}>{sale.price}M</Text>
                </View>
              );
            })
          )}
        </Panel>
      </View>
      <TvTeams view={view} tagFor={(p) => (m?.ready.includes(p.id) ? { text: 'PRÊT', color: colors.success } : null)} />
    </View>
  );
}
