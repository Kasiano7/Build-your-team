/**
 * Twitch chat during the vote. Team numbers follow the seat order (1-based),
 * exactly like `applyChatVotes` on the server.
 *  - spectator vote: each chat account casts one real spectator vote
 *  - participant vote: the chat only cheers (shown, never counted)
 */
import { Text, View } from 'react-native';
import type { RoomView } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { Eyebrow, Panel } from '@/components/ui';

const TWITCH = '#A970FF';

/** Teams by chat number: `!1` is the first seat. */
export function chatNumbering(view: RoomView) {
  return [...view.participants].sort((a, b) => a.seat - b.seat).map((p, i) => ({ n: i + 1, team: p }));
}

export function TwitchPanel({ view, scale = 1 }: { view: RoomView; scale?: number }) {
  const channel = view.settings.twitchChannel;
  const voting = view.voting;
  if (!channel || !voting) return null;
  const s = scale;
  const spectators = voting.mode === 'spectators';
  const counts = voting.chat?.counts ?? {};
  const cheers = voting.chat?.voters.length ?? 0;
  const teams = chatNumbering(view);
  const examples = teams.slice(0, 2).map((t) => `!${t.n}`).join(', ');
  return (
    <Panel style={{ gap: 10 * s, padding: 16 * s, borderColor: 'rgba(169,112,255,0.35)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * s, flexWrap: 'wrap' }}>
        <View style={{ width: 8 * s, height: 8 * s, borderRadius: 4 * s, backgroundColor: TWITCH }} />
        <Eyebrow color={TWITCH} style={{ fontSize: 11 * s }}>
          {spectators ? 'Le chat Twitch vote' : 'Le chat Twitch encourage'}
        </Eyebrow>
      </View>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15 * s, color: colors.text }}>
        Tapez {examples}… dans le chat de <Text style={{ color: TWITCH }}>twitch.tv/{channel}</Text>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * s }}>
        {teams.map(({ n, team }) => (
          <View
            key={team.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * s, paddingHorizontal: 12 * s, paddingVertical: 6 * s, borderRadius: radii.pill, borderWidth: 1, borderColor: `${team.color}66`, backgroundColor: `${team.color}12` }}
          >
            <Text style={{ fontFamily: fonts.displayBlack, fontSize: 14 * s, color: team.color }}>!{n}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 14 * s, color: colors.text }} numberOfLines={1}>
              {team.nickname}
            </Text>
            {!spectators && (
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12 * s, color: colors.textDim, fontVariant: ['tabular-nums'] }}>{counts[team.id] ?? 0}</Text>
            )}
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 12 * s, color: colors.textMute }}>
        {spectators
          ? 'Un vote par compte du chat, compté comme un vote spectateur.'
          : `${cheers} encouragement${cheers > 1 ? 's' : ''} du chat · à titre indicatif, n’entre pas dans le résultat.`}
      </Text>
    </Panel>
  );
}
