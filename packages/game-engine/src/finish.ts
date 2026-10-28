/**
 * End of a game: vote, simulated tournament, or both (room option `endMode`),
 * final result and series points.
 */
import type { GameEvent, RoomState } from '@byt/shared';
import { opts, type EngineCtx } from './context';
import { simulate } from './sim';
import { computeResult } from './votes';

/** After the draft (and the mercato, if any): open the vote, or simulate directly. */
export function beginConclusion(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  state.mercato = null;
  if (opts(state.settings).endMode === 'sim') {
    finishGame(state, ctx, events);
    return;
  }
  state.status = 'voting';
  const mode = state.participants.length >= 3 ? 'participants' : 'spectators';
  const duration = mode === 'participants' ? state.settings.voteTimerSec : state.settings.spectatorVoteTimerSec;
  state.voting = { mode, startedAt: ctx.now, endsAt: ctx.now + duration * 1000, votes: [] };
  events.push({ type: 'voting_started', mode, endsAt: state.voting.endsAt });
}

/**
 * Final result. `vote`: ranked by votes. `sim`: ranked by the simulated
 * tournament. `vote_sim`: ranked by votes, and the tournament is played as a
 * bonus (its champion is shown separately).
 * Series points: last place 0, then +1 per place (2 teams: 1/0, 4 teams: 3/2/1/0).
 */
export function finishGame(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const endMode = opts(state.settings).endMode;
  let simulation;
  if (endMode !== 'vote') {
    const sim = simulate(state, ctx.pack);
    simulation = sim.result;
    state.rngState = sim.rngState;
    events.push({ type: 'simulation_done', championId: sim.result.championId });
  }
  const result = computeResult(state, ctx.pack, ctx.now, endMode === 'sim' ? simulation?.ranking : undefined);
  if (simulation) result.simulation = simulation;
  result.voteWinnerId = endMode === 'sim' ? null : result.winnerId;
  state.status = 'finished';
  state.result = result;
  const n = result.standings.length;
  const standings = { ...(state.series?.standings ?? {}) };
  for (const s of result.standings) standings[s.participantId] = (standings[s.participantId] ?? 0) + (n - s.rank);
  state.series = { round: state.series?.round ?? 1, standings };
  events.push({ type: 'game_finished', winnerId: result.winnerId });
}
