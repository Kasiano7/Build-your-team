/**
 * Voting and results, shared by players and spectators.
 *  - 3–4 players: each participant votes for another team (server enforced).
 *  - 2 players: spectators vote through a shared link; the host may close the vote.
 */
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import type { PackMeta, RoomView } from '@byt/shared';
import { PlayerCard, colors, fonts, radii } from '@byt/ui';
import { Body, Button, Eyebrow, Panel, PlayerBadge, Title, useToast } from '@/components/ui';
import { resultLink, spectatorLink, tvLink } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { playSound } from '@/lib/sound';
import { gameClient } from '@/state/game-client';
import { useServerNow } from '@/state/hooks';
import { SeriesPanel } from './SeriesPanel';
import { SimulationBoard } from './Simulation';
import { TeamBoard, teamStats } from './TeamBoard';
import { Trophy } from './Trophy';
import { TwitchPanel } from './TwitchPanel';
import { WinnerHeader, endModeOf } from './WinnerHeader';

export function EndScreen({
  view,
  pack,
  meId,
  role,
  spectatorVote,
}: {
  view: RoomView;
  pack: PackMeta;
  meId: string | null;
  role: 'player' | 'spectator';
  spectatorVote?: string | null;
}) {
  useEffect(
    () =>
      gameClient.onEvents((events) => {
        if (events.some((e) => e.type === 'game_finished')) playSound('win');
        if (events.some((e) => e.type === 'vote_cast')) playSound('pass');
      }),
    [],
  );
  return view.status === 'finished' && view.result ? <Results view={view} pack={pack} meId={meId} /> : <Voting view={view} pack={pack} meId={meId} role={role} spectatorVote={spectatorVote ?? null} />;
}

function useColumns(n: number) {
  const { width } = useWindowDimensions();
  const cols = width >= 1200 ? Math.min(n, 4) : width >= 760 ? Math.min(n, 2) : 1;
  const boardH = cols === 1 ? Math.min(380, width * 0.9) : cols === 2 ? 340 : 300;
  return { cols, boardH, width };
}

function Countdown({ endsAt }: { endsAt: number }) {
  const now = useServerNow(500);
  const s = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return <Text style={{ fontFamily: fonts.displayBlack, fontSize: 28, color: s <= 10 ? colors.danger : colors.text, fontVariant: ['tabular-nums'] }}>{`${mm}:${ss}`}</Text>;
}

function Voting({ view, pack, meId, role, spectatorVote }: { view: RoomView; pack: PackMeta; meId: string | null; role: 'player' | 'spectator'; spectatorVote: string | null }) {
  const toast = useToast();
  const voting = view.voting!;
  const { cols, boardH } = useColumns(view.participants.length);
  const me = view.participants.find((p) => p.id === meId);
  const myVote = role === 'player' ? voting.votes.find((v) => v.voterId === meId)?.targetId ?? null : spectatorVote;
  const spectatorsMode = voting.mode === 'spectators';
  const canVote = role === 'player' ? !spectatorsMode && !myVote : spectatorsMode && !myVote;
  const link = spectatorLink(view.code);
  const [busy, setBusy] = useState<string | null>(null);

  const vote = async (targetId: string) => {
    setBusy(targetId);
    const res = role === 'player' ? await gameClient.vote(targetId) : await gameClient.spectatorVote(targetId);
    setBusy(null);
    if (!res.ok) toast(errorMessage(res.code), 'error');
    else toast('Vote enregistré', 'success');
  };
  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(link);
        return toast('Lien de vote copié', 'success');
      }
      await Share.share({ message: `Aide-nous à départager nos équipes Build Your Team : ${link}`, url: link });
    } catch {
      await Clipboard.setStringAsync(link);
    }
  };
  const close = async () => {
    const res = await gameClient.closeVote();
    if (!res.ok) toast(errorMessage(res.code), 'error');
  };

  const instructions = spectatorsMode
    ? role === 'player'
      ? 'À deux, un vote croisé ne départagerait personne : ce sont vos amis qui tranchent. Envoyez-leur le lien.'
      : 'Choisissez la composition que vous préférez. Un seul vote par personne.'
    : role === 'player'
      ? 'Votez pour la meilleure équipe — pas la vôtre. Le vote se clôt quand tout le monde a voté.'
      : 'Les joueurs votent entre eux. Résultat à la clôture.';

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 1400, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ gap: 6, flex: 1, minWidth: 260 }}>
            <Eyebrow>Fin des enchères · vote</Eyebrow>
            <Title size={38}>Quelle est la meilleure équipe ?</Title>
            <Body dim>{instructions}</Body>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Countdown endsAt={voting.endsAt} />
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMute }}>
              {voting.votes.length} vote{voting.votes.length > 1 ? 's' : ''}
              {!spectatorsMode ? ` / ${view.participants.length}` : ''}
            </Text>
          </View>
        </View>

        {view.settings.endMode === 'vote_sim' && (
          <Body dim style={{ fontSize: 13 }}>Après le vote, un tournoi simulé désignera aussi son champion, en bonus : seul le vote décide du vainqueur.</Body>
        )}

        <TwitchPanel view={view} />

        {spectatorsMode && role === 'player' && (
          <Panel style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Eyebrow color={colors.textDim}>Lien de vote spectateur</Eyebrow>
              <Text selectable style={{ fontFamily: fonts.bodySemi, color: colors.text, fontSize: 15, marginTop: 4 }} numberOfLines={1}>
                {link}
              </Text>
            </View>
            <Button label="Partager le lien" onPress={share} />
            {me?.isHost && <Button label="Clore le vote" variant="secondary" onPress={close} disabled={voting.votes.length === 0} testID="close-vote" />}
          </Panel>
        )}

        <View style={{ flexDirection: cols === 1 ? 'column' : 'row', flexWrap: 'wrap', gap: 14 }}>
          {view.participants.map((p) => {
            const isMine = p.id === meId;
            const chosen = myVote === p.id;
            return (
              <View key={p.id} style={{ width: cols === 1 ? '100%' : `${100 / cols - 1.5}%` as `${number}%`, flexGrow: 1 }}>
                <TeamBoard
                  view={view}
                  pack={pack}
                  participant={p}
                  height={boardH}
                  highlight={chosen}
                  meId={meId}
                  footer={
                    chosen ? (
                      <View style={{ height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: fonts.display, color: colors.gold, fontSize: 18, letterSpacing: 1 }}>VOTRE VOTE</Text>
                      </View>
                    ) : canVote && !isMine ? (
                      <Button label={`Voter pour ${p.nickname}`} onPress={() => vote(p.id)} loading={busy === p.id} testID={`vote-${p.seat}`} />
                    ) : isMine && !spectatorsMode && role === 'player' ? (
                      <Text style={{ textAlign: 'center', fontFamily: fonts.bodyMedium, color: colors.textMute, fontSize: 13, paddingVertical: 14 }}>Votre équipe</Text>
                    ) : null
                  }
                />
              </View>
            );
          })}
        </View>
        <CompareTable view={view} pack={pack} />
      </View>
    </ScrollView>
  );
}

function CompareTable({ view, pack }: { view: RoomView; pack: PackMeta }) {
  const rows = view.participants.map((p) => ({ p, s: teamStats(view, pack, p) }));
  const best = (f: (x: (typeof rows)[number]) => number) => Math.max(...rows.map(f));
  const metrics: { k: string; f: (x: (typeof rows)[number]) => number; fmt: (v: number) => string }[] = [
    { k: 'Note équipe', f: (x) => x.s.rating, fmt: (v) => v.toFixed(1) },
    { k: 'Meilleur joueur', f: (x) => x.s.best?.overall ?? 0, fmt: (v) => String(v) },
    { k: 'Budget dépensé', f: (x) => x.s.spent, fmt: (v) => `${v}M` },
    { k: 'Budget restant', f: (x) => x.s.remaining, fmt: (v) => `${v}M` },
    { k: 'Achats aux enchères', f: (x) => x.s.auctionBuys, fmt: (v) => String(v) },
  ];
  return (
    <Panel style={{ gap: 4 }}>
      <Eyebrow>Comparer</Eyebrow>
      <ScrollView horizontal>
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
            <Text style={{ width: 170 }} />
            {rows.map(({ p }) => (
              <Text key={p.id} style={{ width: 120, fontFamily: fonts.display, fontSize: 16, color: p.color }} numberOfLines={1}>
                {p.nickname}
              </Text>
            ))}
          </View>
          {metrics.map((m) => {
            const top = best(m.f);
            return (
              <View key={m.k} style={{ flexDirection: 'row', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.line }}>
                <Text style={{ width: 170, fontFamily: fonts.body, fontSize: 14, color: colors.textDim }}>{m.k}</Text>
                {rows.map((r) => (
                  <Text key={r.p.id} style={{ width: 120, fontFamily: fonts.bodySemi, fontSize: 14, color: m.f(r) === top && m.k !== 'Budget dépensé' ? colors.accent : colors.text }}>
                    {m.fmt(m.f(r))}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Panel>
  );
}

/** Mode TV: a new browser tab on the web (keeps this player session), the TV route on native. */
function openTv(code: string) {
  if (Platform.OS === 'web') void Linking.openURL(tvLink(code));
  else router.push(`/tv/${code}`);
}

function Results({ view, pack, meId }: { view: RoomView; pack: PackMeta; meId: string | null }) {
  const toast = useToast();
  const r = view.result!;
  const mode = endModeOf(view);
  const sim = r.simulation;
  const { cols, boardH, width } = useColumns(view.participants.length);
  const byId = (id: string) => view.participants.find((p) => p.id === id)!;
  const big = r.biggestPurchase;
  const bigChar = big ? view.characters[big.characterId] : undefined;
  const simRank = new Map(sim?.ranking.map((id, i) => [id, i + 1]) ?? []);

  const share = async () => {
    const link = resultLink(view.code);
    const winner = byId(r.winnerId);
    const lines = r.standings.map((s) => {
      const pts = sim?.points?.[s.participantId];
      const detail =
        mode === 'sim'
          ? `${pts !== undefined ? `${pts} pts · ` : ''}note ${s.teamRating.toFixed(1)}`
          : `${s.votes} vote${s.votes > 1 ? 's' : ''} · note ${s.teamRating.toFixed(1)}`;
      return `${s.rank}. ${byId(s.participantId).nickname} — ${detail}`;
    });
    const head =
      mode === 'sim'
        ? `🏆 ${winner.nickname} remporte le ${sim?.kind === 'race' ? 'Grand Prix' : 'tournoi'} simulé Build Your Team !`
        : `🏆 ${winner.nickname} remporte la partie Build Your Team !`;
    const extra = mode === 'vote_sim' && sim ? `\nChampion du tournoi simulé : ${byId(sim.championId).nickname}` : '';
    const text = `${head}\n${lines.join('\n')}${extra}\n${link}`;
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(text);
        return toast('Résultat copié', 'success');
      }
      await Share.share({ message: text, url: link });
    } catch {
      await Clipboard.setStringAsync(text);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 1400, gap: 18, alignItems: 'center' }}>
        <Trophy size={120} />
        <WinnerHeader view={view} meId={meId} />

        {sim && (
          <View style={{ width: '100%', maxWidth: 980 }}>
            <SimulationBoard view={view} sim={sim} compact={width < 700} />
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', justifyContent: 'center' }}>
          <Panel style={{ minWidth: 260, flex: 1, gap: 8 }}>
            <Eyebrow>{mode === 'sim' ? (sim?.kind === 'race' ? 'Classement du Grand Prix' : 'Classement du tournoi') : 'Classement du vote'}</Eyebrow>
            {r.standings.map((s) => {
              const p = byId(s.participantId);
              const pts = sim?.points?.[s.participantId];
              const detail =
                mode === 'sim'
                  ? `${pts !== undefined ? `${pts} pts · ` : ''}note ${s.teamRating.toFixed(1)} · reste ${s.remaining}M`
                  : `${s.votes} vote${s.votes > 1 ? 's' : ''} · ${s.teamRating.toFixed(1)} · reste ${s.remaining}M${mode === 'vote_sim' && simRank.has(s.participantId) ? ` · tournoi ${simRank.get(s.participantId) === 1 ? '1er' : `${simRank.get(s.participantId)}e`}` : ''}`;
              return (
                <View key={s.participantId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
                  <Text style={{ width: 26, fontFamily: fonts.displayBlack, fontSize: 24, color: s.rank === 1 ? colors.gold : colors.textMute }}>{s.rank}</Text>
                  <PlayerBadge name={p.nickname} color={p.color} size={30} ring={s.rank === 1} />
                  <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 19, color: colors.text }} numberOfLines={1}>
                    {p.nickname}
                  </Text>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textDim, flexShrink: 1, textAlign: 'right' }}>{detail}</Text>
                </View>
              );
            })}
          </Panel>
          <Panel style={{ minWidth: 260, flex: 1, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {bigChar && big ? (
              <>
                <PlayerCard character={bigChar} pack={pack} width={110} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Eyebrow>Plus gros achat</Eyebrow>
                  <Text style={{ fontFamily: fonts.displayBlack, fontSize: 40, color: colors.text }}>{big.price}M</Text>
                  <Body dim>
                    {bigChar.name} · {byId(big.participantId).nickname}
                  </Body>
                  <Body dim style={{ fontSize: 13 }}>
                    {r.auctionsPlayed} enchères · {r.totalBids} offres
                  </Body>
                </View>
              </>
            ) : (
              <Body dim>Aucun achat aux enchères.</Body>
            )}
          </Panel>
        </View>

        {view.series && (
          <View style={{ width: '100%', maxWidth: 720 }}>
            <SeriesPanel view={view} meId={meId} />
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button label="Partager le résultat" variant="gold" onPress={share} />
          <Button label="Mode TV" variant="secondary" onPress={() => openTv(view.code)} accessibilityHint="Affiche la partie en grand écran pour une télévision" testID="open-tv" />
          <Button label="Nouvelle partie" variant="secondary" onPress={() => { gameClient.reset(); router.replace('/'); }} />
        </View>

        <View style={{ flexDirection: cols === 1 ? 'column' : 'row', flexWrap: 'wrap', gap: 14, width: '100%' }}>
          {r.standings.map((s) => (
            <View key={s.participantId} style={{ width: cols === 1 ? '100%' : (`${100 / cols - 1.5}%` as `${number}%`), flexGrow: 1 }}>
              <TeamBoard view={view} pack={pack} participant={byId(s.participantId)} height={boardH} highlight={s.rank === 1} meId={meId} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
