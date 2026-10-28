/**
 * Rematch series: cumulative points across games played in the same room
 * (last place 0, then +1 per place), and the host's "Revanche" button.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { RoomView } from '@byt/shared';
import { colors, fonts } from '@byt/ui';
import { Body, Button, Eyebrow, Panel, PlayerBadge, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { gameClient } from '@/state/game-client';
import { teamRef } from './Simulation';

export function seriesRows(view: RoomView) {
  const series = view.series;
  if (!series) return [];
  const n = view.result?.standings.length ?? view.participants.length;
  const gained = new Map(view.result?.standings.map((s) => [s.participantId, n - s.rank]) ?? []);
  return view.participants
    .map((p) => ({ team: teamRef(view, p.id), total: series.standings[p.id] ?? 0, gained: gained.get(p.id) ?? 0, seat: p.seat }))
    .sort((a, b) => b.total - a.total || a.seat - b.seat);
}

export function SeriesPanel({ view, meId, interactive = true, scale = 1 }: { view: RoomView; meId: string | null; interactive?: boolean; scale?: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const series = view.series;
  if (!series) return null;
  const s = scale;
  const rows = seriesRows(view);
  const isHost = !!meId && !!view.participants.find((p) => p.id === meId)?.isHost;
  const n = view.participants.length;

  const rematch = async () => {
    setBusy(true);
    const res = await gameClient.rematch();
    setBusy(false);
    if (!res.ok) toast(errorMessage(res.code), 'error');
  };

  return (
    <Panel style={{ width: '100%', gap: 10 * s, padding: 18 * s }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Eyebrow style={{ fontSize: 11 * s }}>Série — manche {series.round}</Eyebrow>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12 * s, color: colors.textMute }}>
          {n > 1 ? `1er : ${n - 1} pt${n - 1 > 1 ? 's' : ''} · dernier : 0` : ''}
        </Text>
      </View>
      {rows.map((r, i) => (
        <View key={r.team.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * s, paddingVertical: 4 * s }}>
          <Text style={{ width: 24 * s, fontFamily: fonts.displayBlack, fontSize: 20 * s, color: i === 0 ? colors.gold : colors.textMute }}>{i + 1}</Text>
          <PlayerBadge name={r.team.nickname} color={r.team.color} size={28 * s} ring={i === 0} />
          <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 17 * s, color: colors.text }} numberOfLines={1}>
            {r.team.nickname}
            {r.team.id === meId ? <Text style={{ color: colors.textMute }}> · vous</Text> : null}
          </Text>
          {view.status === 'finished' && (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12 * s, color: r.gained > 0 ? colors.accent : colors.textMute }}>+{r.gained}</Text>
          )}
          <Text style={{ minWidth: 64 * s, textAlign: 'right', fontFamily: fonts.displayBlack, fontSize: 20 * s, color: colors.text, fontVariant: ['tabular-nums'] }}>
            {r.total}
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11 * s, color: colors.textMute }}> PTS</Text>
          </Text>
        </View>
      ))}
      {view.status === 'finished' &&
        (isHost && interactive ? (
          <Button label="Revanche" variant="gold" onPress={rematch} loading={busy} accessibilityHint="Relance une partie avec les mêmes équipes, les points de série sont conservés" testID="rematch" />
        ) : (
          <Body dim style={{ fontSize: 13 * s, textAlign: 'center' }}>En attente de la revanche de l’hôte…</Body>
        ))}
    </Panel>
  );
}
