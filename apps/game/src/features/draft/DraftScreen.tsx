/**
 * Draft layout. Landscape / wide: pitch on the left (the hero), auction panel
 * on the right. Portrait phones: auction on top, pitch below, so the bid
 * buttons stay within thumb reach and the pitch remains visible.
 */
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { PackMeta, RoomView } from '@byt/shared';
import { colors, fonts } from '@byt/ui';
import { Panel } from '@/components/ui';
import { haptic, playSound } from '@/lib/sound';
import { gameClient } from '@/state/game-client';
import { TeamView } from '../team/TeamView';
import { AuctionPanel } from './AuctionPanel';
import { ParticipantsStrip } from './ParticipantsStrip';

export function DraftScreen({ view, pack, meId }: { view: RoomView; pack: PackMeta; meId: string }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900 || (width > height && width >= 640);
  const short = height < 560;
  const me = view.participants.find((p) => p.id === meId) ?? null;
  const [viewedId, setViewedId] = useState(meId);
  const viewed = view.participants.find((p) => p.id === viewedId) ?? me ?? view.participants[0]!;

  // Sounds & haptics from server events.
  useEffect(
    () =>
      gameClient.onEvents((events) => {
        for (const e of events) {
          if (e.type === 'auction_revealed') playSound('reveal');
          else if (e.type === 'bid_placed') playSound(e.participantId === meId ? 'bid' : 'raise');
          else if (e.type === 'participant_passed' && e.participantId === meId) playSound('pass');
          else if (e.type === 'auction_sold') {
            playSound('sold');
            if (e.participantId === meId) haptic('success');
          } else if (e.type === 'auction_unsold') playSound('unsold');
          else if (e.type === 'participant_joined') playSound('join');
        }
      }),
    [meId],
  );

  // When I win a player, bring my pitch into view so the arrival is visible.
  useEffect(
    () =>
      gameClient.onEvents((events) => {
        if (events.some((e) => e.type === 'auction_sold' && e.participantId === meId)) setViewedId(meId);
      }),
    [meId],
  );

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 4 }}>
      <Text style={{ fontFamily: fonts.heroSemi, fontSize: 16, color: colors.text, letterSpacing: -0.2 }}>
        {viewed.id === meId ? 'Votre équipe' : <>Équipe de <Text style={{ color: viewed.color }}>{viewed.nickname}</Text></>}
      </Text>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textMute }}>
        {viewed.team.starters.filter(Boolean).length}/{viewed.team.starters.length} · {pack.formations.find((f) => f.id === viewed.team.formationId)?.label}
      </Text>
    </View>
  );

  const auction = view.auction ? (
    <AuctionPanel view={view} pack={pack} me={me} compact={!wide || short} dense={wide && short} />
  ) : (
    <Text style={{ color: colors.textDim, fontFamily: fonts.body }}>Finalisation des équipes…</Text>
  );

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', padding: short ? 8 : 14, gap: short ? 8 : 14 }}>
          <View style={{ flex: short ? 1 : 1.25, gap: short ? 4 : 8 }}>
            <ParticipantsStrip view={view} meId={meId} selectedId={viewed.id} onSelect={setViewedId} dense={short} />
            {!short && header}
            <TeamView view={view} pack={pack} participant={viewed} editable={viewed.id === meId} showTarget />
          </View>
          <Panel style={{ flex: 1, maxWidth: 560, padding: short ? 10 : 16 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {auction}
            </ScrollView>
          </Panel>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
      <ParticipantsStrip view={view} meId={meId} selectedId={viewed.id} onSelect={setViewedId} />
      <Panel style={{ padding: 12 }}>{auction}</Panel>
      {header}
      <View style={{ height: Math.max(340, Math.min(width * 1.05, 520)) }}>
        <TeamView view={view} pack={pack} participant={viewed} editable={viewed.id === meId} showTarget />
      </View>
    </ScrollView>
  );
}
