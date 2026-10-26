import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { teamRating, teamSpent } from '@byt/game-engine';
import type { PackMeta, Participant, RoomView } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { enginePack, formationOf } from '../room/derive';
import { TeamPitch } from '../team/TeamPitch';

export function teamStats(view: RoomView, pack: PackMeta, p: Participant) {
  const ep = { ...enginePack(pack), characters: Object.values(view.characters) };
  const ids = p.team.starters.filter((x): x is string => !!x);
  const best = ids.map((id) => view.characters[id]!).filter(Boolean).sort((a, b) => b.overall - a.overall)[0] ?? null;
  return {
    rating: teamRating(ep, p.team),
    spent: teamSpent(p.team),
    remaining: p.budget,
    best,
    auctionBuys: p.team.purchases.filter((x) => x.kind === 'auction').length,
    freeAgents: p.team.purchases.filter((x) => x.kind === 'free_agent').length,
  };
}

export function TeamBoard({
  view,
  pack,
  participant,
  height,
  highlight,
  footer,
  meId,
}: {
  view: RoomView;
  pack: PackMeta;
  participant: Participant;
  height: number;
  highlight?: boolean;
  footer?: ReactNode;
  meId?: string | null;
}) {
  const s = teamStats(view, pack, participant);
  return (
    <View
      style={{
        flex: 1,
        minWidth: 260,
        borderRadius: radii.lg,
        borderWidth: highlight ? 2 : 1,
        borderColor: highlight ? colors.gold : colors.line,
        backgroundColor: 'rgba(16,22,29,0.86)',
        overflow: 'hidden',
      }}
      accessibilityLabel={`Équipe de ${participant.nickname}, note ${s.rating}, dépensé ${s.spent} millions`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingBottom: 6 }}>
        <View style={{ width: 6, height: 26, borderRadius: 3, backgroundColor: participant.color }} />
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 21, color: colors.text, letterSpacing: 0.5 }} numberOfLines={1}>
          {participant.nickname}
          {participant.id === meId ? <Text style={{ color: colors.textMute, fontSize: 15 }}> · vous</Text> : null}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.displayBlack, fontSize: 26, color: highlight ? colors.gold : colors.text }}>{s.rating.toFixed(1)}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: colors.textMute, marginTop: -3 }}>NOTE ÉQUIPE</Text>
        </View>
      </View>
      <View style={{ height }} pointerEvents="none">
        <TeamPitch pack={pack} formation={formationOf(pack, participant.team.formationId)} team={participant.team} characters={view.characters} animateArrivals={false} />
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line }}>
        {[
          ['Dépensé', `${s.spent}M`],
          ['Restant', `${s.remaining}M`],
          ['Star', s.best ? `${s.best.shortName} ${s.best.overall}` : '—'],
        ].map(([k, v]) => (
          <View key={k} style={{ flex: 1, padding: 10, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.5, color: colors.textMute }}>{k!.toUpperCase()}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text }} numberOfLines={1}>
              {v}
            </Text>
          </View>
        ))}
      </View>
      {footer ? <View style={{ padding: 12, paddingTop: 0 }}>{footer}</View> : null}
    </View>
  );
}
