/**
 * Who won, according to how the room decides the game (`settings.endMode`):
 *  vote      → the vote winner
 *  sim       → the champion of the simulated tournament (there is no vote)
 *  vote_sim  → the vote winner, and separately the tournament champion
 *              (the tournament is a bonus: the two may differ).
 */
import { Text, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import type { EndMode, RoomView } from '@byt/shared';
import { colors, fonts, radii } from '@byt/ui';
import { Body, Eyebrow } from '@/components/ui';
import { useReduceMotion } from '@/state/settings';
import { revealPlan, teamRef } from './Simulation';

/** Effective end mode of a room (results without a simulation are decided by the vote). */
export function endModeOf(view: RoomView): EndMode {
  const mode = view.settings.endMode ?? 'vote';
  if (view.status === 'finished' && !view.result?.simulation) return 'vote';
  return mode;
}

export function tieBreakText(view: RoomView): string | null {
  const t = view.result?.tieBreak;
  return t === 'team_rating'
    ? 'Égalité de votes départagée par la note d’équipe.'
    : t === 'remaining_budget'
      ? 'Égalité départagée par le budget restant.'
      : t === 'seat'
        ? 'Égalité parfaite départagée par l’ordre d’arrivée.'
        : null;
}

export function WinnerHeader({ view, meId, scale = 1 }: { view: RoomView; meId: string | null; scale?: number }) {
  const reduce = useReduceMotion();
  const s = scale;
  const r = view.result!;
  const mode = endModeOf(view);
  const sim = r.simulation;
  // The champion is announced once the tournament reveal below has played.
  const championDelay = sim ? revealPlan(sim).champion : 300;
  const tieText = mode !== 'sim' ? tieBreakText(view) : null;

  if (mode === 'sim' && sim) {
    const champ = teamRef(view, sim.championId);
    const pts = sim.points?.[champ.id];
    return (
      <Animated.View entering={reduce ? undefined : ZoomIn.delay(championDelay).springify().damping(12)} style={{ alignItems: 'center', gap: 4 * s }}>
        <Eyebrow color={colors.gold} style={{ fontSize: 11 * s }}>
          {sim.kind === 'race' ? 'Vainqueur du Grand Prix simulé' : 'Champion du tournoi simulé'}
        </Eyebrow>
        <Text testID="winner-name" style={{ fontFamily: fonts.displayBlack, fontSize: 56 * s, color: champ.color, letterSpacing: 1, textAlign: 'center' }}>
          {champ.nickname.toUpperCase()}
        </Text>
        <Body dim style={{ textAlign: 'center', fontSize: 15 * s }}>
          {pts !== undefined ? `${pts} points · ` : ''}Partie décidée par la simulation, sans vote
          {champ.id === meId ? ' · c’est vous !' : ''}
        </Body>
      </Animated.View>
    );
  }

  const winnerId = r.voteWinnerId ?? r.winnerId;
  const winner = teamRef(view, winnerId);
  const top = r.standings.find((x) => x.participantId === winnerId) ?? r.standings[0]!;
  const voteBlock = (
    <Animated.View entering={reduce ? undefined : FadeInUp.delay(300).duration(500)} style={{ alignItems: 'center', gap: 4 * s }}>
      <Eyebrow color={colors.gold} style={{ fontSize: 11 * s }}>
        {mode === 'vote_sim' ? 'Vainqueur du vote' : 'Vainqueur'}
      </Eyebrow>
      <Text testID="winner-name" style={{ fontFamily: fonts.displayBlack, fontSize: 56 * s, color: winner.color, letterSpacing: 1, textAlign: 'center' }}>
        {winner.nickname.toUpperCase()}
      </Text>
      <Body dim style={{ textAlign: 'center', fontSize: 15 * s }}>
        {top.votes} vote{top.votes > 1 ? 's' : ''} sur {r.totalVotes}
        {winner.id === meId ? ' · c’est vous !' : ''}
      </Body>
      {tieText && <Body dim style={{ fontSize: 13 * s, textAlign: 'center' }}>{tieText}</Body>}
    </Animated.View>
  );
  if (mode !== 'vote_sim' || !sim) return voteBlock;

  const champ = teamRef(view, sim.championId);
  const same = champ.id === winner.id;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 28 * s }}>
      {voteBlock}
      <Animated.View
        entering={reduce ? undefined : ZoomIn.delay(championDelay).springify().damping(12)}
        style={{ alignItems: 'center', gap: 4 * s, paddingHorizontal: 22 * s, paddingVertical: 14 * s, borderRadius: radii.lg * s, borderWidth: 1, borderColor: 'rgba(230,193,112,0.45)', backgroundColor: 'rgba(230,193,112,0.06)' }}
      >
        <Eyebrow color={colors.gold} style={{ fontSize: 10 * s }}>
          {sim.kind === 'race' ? 'Vainqueur du Grand Prix simulé' : 'Champion du tournoi simulé'}
        </Eyebrow>
        <Text testID="champion-name" style={{ fontFamily: fonts.displayBlack, fontSize: 34 * s, color: champ.color, letterSpacing: 0.6, textAlign: 'center' }}>
          {champ.nickname.toUpperCase()}
        </Text>
        <Body dim style={{ fontSize: 13 * s, textAlign: 'center' }}>
          {same ? 'Doublé : vote et tournoi !' : 'Bonus : le vote reste décisif'}
          {champ.id === meId ? ' · c’est vous !' : ''}
        </Body>
      </Animated.View>
    </View>
  );
}
