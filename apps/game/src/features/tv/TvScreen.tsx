/**
 * TV / big-screen mode: a read-only spectator view laid out on a fixed
 * 1920×1080 stage, scaled to fit the window (letterboxed), readable from a
 * sofa. No interactive control: players act on their own phones.
 */
import { useEffect, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { PackMeta, RoomView } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { LogoMark } from '@/components/Logo';
import { QrCode } from '@/components/QrCode';
import { ConnectionBadge, Eyebrow, Panel, PlayerBadge } from '@/components/ui';
import { inviteLink, spectatorLink } from '@/lib/config';
import { playSound } from '@/lib/sound';
import { gameClient, type ConnectionState } from '@/state/game-client';
import { useServerNow } from '@/state/hooks';
import { useReduceMotion } from '@/state/settings';
import { SeriesPanel } from '../end/SeriesPanel';
import { SimulationBoard, revealPlan } from '../end/Simulation';
import { TeamBoard } from '../end/TeamBoard';
import { Trophy } from '../end/Trophy';
import { TwitchPanel } from '../end/TwitchPanel';
import { WinnerHeader, endModeOf } from '../end/WinnerHeader';
import { TvDraft, TvMercato } from './TvDraft';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** Fixed 16:9 stage scaled to the window. */
export function TvStage({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const k = Math.max(0.1, Math.min(width / STAGE_W, height / STAGE_H));
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View style={{ width: STAGE_W * k, height: STAGE_H * k, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            width: STAGE_W,
            height: STAGE_H,
            left: (STAGE_W * k - STAGE_W) / 2,
            top: (STAGE_H * k - STAGE_H) / 2,
            transform: [{ scale: k }],
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const PHASE: Record<RoomView['status'], string> = {
  lobby: 'Salon',
  drafting: 'Enchères',
  mercato: 'Mercato',
  voting: 'Vote',
  finished: 'Résultats',
};

function hostOf(url: string) {
  return url.replace(/^https?:\/\//, '');
}

export function TvScreen({ view, pack, connection }: { view: RoomView; pack: PackMeta; connection: ConnectionState }) {
  // The big screen is the shared speaker of the room: key moments make a sound.
  useEffect(
    () =>
      gameClient.onEvents((events) => {
        for (const e of events) {
          if (e.type === 'auction_revealed') playSound('reveal');
          else if (e.type === 'bid_placed' || e.type === 'sealed_offer') playSound('raise');
          else if (e.type === 'auction_sold') playSound('sold');
          else if (e.type === 'auction_unsold') playSound('unsold');
          else if (e.type === 'participant_joined') playSound('join');
          else if (e.type === 'game_finished') playSound('win');
        }
      }),
    [],
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: 56, paddingVertical: 36, gap: 32 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, height: 72 }}>
        <LogoMark size={40} />
        <Text style={{ fontFamily: fonts.hero, fontSize: 30, color: colors.text, letterSpacing: 0.6 }}>
          BUILD YOUR <Text style={{ color: colors.accent }}>TEAM</Text>
        </Text>
        <View style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: 'rgba(43,227,208,0.35)', backgroundColor: 'rgba(43,227,208,0.08)' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: 2.4, color: colors.accent }}>{PHASE[view.status].toUpperCase()}</Text>
        </View>
        {view.series && view.series.round > 1 ? (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 22, color: colors.textDim }}>Série · manche {view.series.round}</Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {view.status === 'drafting' && (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 22, color: colors.textMute }}>
            {view.auctionCount} enchère{view.auctionCount > 1 ? 's' : ''} · {view.poolSize} joueurs restants
          </Text>
        )}
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, letterSpacing: 2, color: colors.textMute }}>SALON</Text>
        <Text style={{ fontFamily: fonts.hero, fontSize: 34, letterSpacing: 6, color: colors.text }}>{view.code}</Text>
        <View style={{ transform: [{ scale: 1.4 }], marginLeft: 16 }}>
          <ConnectionBadge state={connection} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {view.status === 'lobby' && <TvLobby view={view} pack={pack} />}
        {view.status === 'drafting' && <TvDraft view={view} pack={pack} />}
        {view.status === 'mercato' && <TvMercato view={view} />}
        {view.status === 'voting' && view.voting && <TvVoting view={view} pack={pack} />}
        {view.status === 'finished' && view.result && <TvFinished view={view} />}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Lobby                                                                */
/* ------------------------------------------------------------------ */

function settingChips(view: RoomView, pack: PackMeta): string[] {
  const s = view.settings;
  const out = [pack.universeLabel, pack.modes.find((m) => m.id === s.mode)?.label ?? s.mode, `Budget ${s.budget}M`];
  if (s.format === 'duo') out.push('Duo');
  if (s.auctionStyle === 'dutch') out.push('Enchères hollandaises');
  if (s.auctionStyle === 'sealed') out.push('Offres secrètes');
  if (s.pace === 'eclair') out.push('Éclair');
  const theme = s.themeId ? pack.themes?.find((t) => t.id === s.themeId)?.label : null;
  if (theme) out.push(theme);
  if (s.mystery) out.push('Mystère');
  if (s.jokers) out.push('Jokers');
  if (s.mercato) out.push('Mercato');
  out.push(s.endMode === 'sim' ? 'Tournoi simulé' : s.endMode === 'vote_sim' ? 'Vote + tournoi simulé' : 'Vote');
  if (s.twitchChannel) out.push(`Twitch : ${s.twitchChannel}`);
  return out;
}

function TvLobby({ view, pack }: { view: RoomView; pack: PackMeta }) {
  const reduce = useReduceMotion();
  const link = inviteLink(view.code);
  const max = view.settings.maxParticipants;
  const free = Math.max(0, max - view.participants.length);
  const now = useServerNow(1000);
  const blink = Math.floor(now / 1000) % 2 === 0;
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 64 }}>
      <View style={{ flex: 1.15, justifyContent: 'center', gap: 34 }}>
        <Eyebrow style={{ fontSize: 22 }}>Rejoignez la partie</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 18 }} accessible accessibilityLabel={`Code du salon ${view.code.split('').join(' ')}`}>
          {view.code.split('').map((ch, i) => (
            <View key={i} style={{ width: 150, height: 190, borderRadius: radii.lg, borderWidth: 2, borderColor: 'rgba(43,227,208,0.35)', backgroundColor: 'rgba(12,18,25,0.72)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.hero, fontSize: 130, color: colors.text }}>{ch}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 32, color: colors.textDim }}>
          Scannez le QR code ou allez sur <Text style={{ color: colors.text }}>{hostOf(link)}</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {settingChips(view, pack).map((c) => (
            <View key={c} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 20, color: colors.textDim }}>{c}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ width: 640, gap: 28, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 28, alignItems: 'center' }}>
          <QrCode value={link} size={300} label={`QR code pour rejoindre le salon ${view.code}`} />
          <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 26, color: colors.textDim }}>Un téléphone par équipe : scannez pour entrer dans le salon.</Text>
        </View>
        <Panel style={{ gap: 16, padding: 24 }}>
          <Eyebrow style={{ fontSize: 16 }}>
            Équipes · {view.participants.length}/{max}
          </Eyebrow>
          {view.participants.map((p) => (
            <Animated.View key={p.id} entering={reduce ? undefined : FadeIn.duration(400)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <PlayerBadge name={p.nickname} color={p.color} size={50} ring />
              <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 32, color: colors.text }} numberOfLines={1}>
                {p.nickname}
                {p.members && p.members.length > 1 ? <Text style={{ color: colors.textMute, fontSize: 22 }}> · {p.members.map((m) => m.nickname).join(' & ')}</Text> : null}
              </Text>
              {p.isHost && <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, letterSpacing: 1.6, color: colors.gold }}>HÔTE</Text>}
              {p.bot && <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, letterSpacing: 1.6, color: colors.textMute }}>BOT</Text>}
            </Animated.View>
          ))}
          {Array.from({ length: free }).map((_, i) => (
            <View key={`free-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, opacity: 0.45 }}>
              <View style={{ width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.textMute }} />
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 26, color: colors.textMute }}>Place libre</Text>
            </View>
          ))}
        </Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, opacity: reduce || blink ? 1 : 0.3 }} />
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 24, color: colors.textDim }}>En attente du lancement par l’hôte…</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Voting                                                               */
/* ------------------------------------------------------------------ */

function TvVoting({ view, pack }: { view: RoomView; pack: PackMeta }) {
  const voting = view.voting!;
  const now = useServerNow(500);
  const secs = Math.max(0, Math.ceil((voting.endsAt - now) / 1000));
  const spectators = voting.mode === 'spectators';
  const counts = new Map<string, number>();
  for (const v of voting.votes) counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);
  const maxVotes = Math.max(1, ...counts.values());
  const link = spectatorLink(view.code);
  const n = view.participants.length;
  const boardH = n >= 4 ? 380 : n === 3 ? 420 : 470;
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 40 }}>
      <View style={{ flex: 1, gap: 26 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 30 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Eyebrow style={{ fontSize: 18 }}>{spectators ? 'Vote du public' : 'Vote des joueurs'}</Eyebrow>
            <Text style={{ fontFamily: fonts.hero, fontSize: 52, color: colors.text, letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
              Quelle est la meilleure équipe{'\u00A0'}?
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.displayBlack, fontSize: 72, color: secs <= 10 ? colors.danger : colors.text, fontVariant: ['tabular-nums'] }}>
              {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
            </Text>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 22, color: colors.textMute }}>
              {voting.votes.length} vote{voting.votes.length > 1 ? 's' : ''}
              {spectators ? '' : ` / ${n}`}
            </Text>
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
          {view.participants.map((p) => {
            const c = counts.get(p.id) ?? 0;
            return (
              <View key={p.id} style={{ flex: 1 }}>
                <TeamBoard
                  view={view}
                  pack={pack}
                  participant={p}
                  height={boardH}
                  footer={
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 1.6, color: colors.textMute }}>VOTES</Text>
                        <Text style={{ fontFamily: fonts.displayBlack, fontSize: 40, color: c > 0 ? p.color : colors.textMute, fontVariant: ['tabular-nums'] }}>{c}</Text>
                      </View>
                      <View style={{ height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <View style={{ width: `${Math.round((c / maxVotes) * 100)}%`, height: '100%', borderRadius: 6, backgroundColor: p.color }} />
                      </View>
                    </View>
                  }
                />
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ width: 440, gap: 24, justifyContent: 'center' }}>
        <Panel style={{ alignItems: 'center', gap: 18, padding: 28 }}>
          <QrCode value={link} size={300} label="QR code de la page de vote spectateur" />
          <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.text, textAlign: 'center' }}>{spectators ? 'Scannez pour voter' : 'Suivez le vote sur votre téléphone'}</Text>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 20, color: colors.textDim, textAlign: 'center' }}>
            {spectators ? 'Un vote par personne. ' : 'Les joueurs votent entre eux. '}
            {hostOf(link)}
          </Text>
        </Panel>
        <TwitchPanel view={view} scale={1.5} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Finished                                                             */
/* ------------------------------------------------------------------ */

function Podium({ view }: { view: RoomView }) {
  const reduce = useReduceMotion();
  const r = view.result!;
  const mode = endModeOf(view);
  const sim = r.simulation;
  const top = r.standings.slice(0, 3);
  const order = top.length === 3 ? [top[1]!, top[0]!, top[2]!] : top.length === 2 ? [top[1]!, top[0]!] : top;
  const heights: Record<number, number> = { 1: 200, 2: 145, 3: 105 };
  // With a simulation, the podium rises once the tournament has crowned its champion.
  const base = sim ? revealPlan(sim).champion + 300 : 400;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 18 }}>
      {order.map((s) => {
        const p = view.participants.find((x) => x.id === s.participantId)!;
        const pts = sim?.points?.[s.participantId];
        const detail = mode === 'sim' ? (pts !== undefined ? `${pts} pts` : `note ${s.teamRating.toFixed(1)}`) : `${s.votes} vote${s.votes > 1 ? 's' : ''}`;
        return (
          <Animated.View key={s.participantId} entering={reduce ? undefined : FadeIn.delay(base + (3 - s.rank) * 250).duration(500)} style={{ width: 230, alignItems: 'center', gap: 10 }}>
            <PlayerBadge name={p.nickname} color={p.color} size={s.rank === 1 ? 76 : 60} ring={s.rank === 1} />
            <Text style={{ fontFamily: fonts.display, fontSize: s.rank === 1 ? 32 : 26, color: colors.text }} numberOfLines={1}>
              {p.nickname}
            </Text>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 20, color: colors.textDim }}>{detail}</Text>
            <View
              style={{
                width: '100%',
                height: heights[s.rank] ?? 90,
                borderTopLeftRadius: radii.md,
                borderTopRightRadius: radii.md,
                borderWidth: 1,
                borderColor: s.rank === 1 ? colors.gold : colors.line,
                backgroundColor: s.rank === 1 ? 'rgba(230,193,112,0.14)' : 'rgba(255,255,255,0.05)',
                alignItems: 'center',
                paddingTop: 12,
              }}
            >
              <Text style={{ fontFamily: fonts.hero, fontSize: 56, color: s.rank === 1 ? colors.gold : colors.textDim }}>{s.rank}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function TvFinished({ view }: { view: RoomView }) {
  const sim = view.result!.simulation;
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 48 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <Trophy size={110} />
        <WinnerHeader view={view} meId={null} scale={1.25} />
        <View style={{ height: 16 }} />
        <Podium view={view} />
      </View>
      <View style={{ width: sim ? 880 : 640, justifyContent: 'center', gap: 24 }}>
        {sim && <SimulationBoard view={view} sim={sim} scale={1.3} />}
        {view.series && <SeriesPanel view={view} meId={null} interactive={false} scale={1.2} />}
      </View>
    </View>
  );
}
