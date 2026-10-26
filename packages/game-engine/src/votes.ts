/**
 * Final ranking. Order: votes ↓, team rating ↓, remaining budget ↓, seat ↑.
 * The criterion that separated the top two teams is reported as `tieBreak`.
 */
import type { ContentPack, GameResult, RoomState, TeamStanding } from '@byt/shared';
import { teamRating, teamSpent } from './team';

export function computeResult(state: RoomState, pack: ContentPack, now: number): GameResult {
  const votes = state.voting?.votes ?? [];
  const rows = state.participants.map((p) => ({
    participantId: p.id,
    seat: p.seat,
    votes: votes.filter((v) => v.targetId === p.id).length,
    teamRating: teamRating(pack, p.team),
    spent: teamSpent(p.team),
    remaining: p.budget,
  }));
  rows.sort(
    (a, b) => b.votes - a.votes || b.teamRating - a.teamRating || b.remaining - a.remaining || a.seat - b.seat,
  );

  let tieBreak: GameResult['tieBreak'] = null;
  const [first, second] = rows;
  if (first && second && first.votes === second.votes) {
    if (first.teamRating !== second.teamRating) tieBreak = 'team_rating';
    else if (first.remaining !== second.remaining) tieBreak = 'remaining_budget';
    else tieBreak = 'seat';
  }

  const standings: TeamStanding[] = rows.map((r, i) => ({
    participantId: r.participantId,
    votes: r.votes,
    teamRating: r.teamRating,
    spent: r.spent,
    remaining: r.remaining,
    rank: i + 1,
  }));

  let biggestPurchase: GameResult['biggestPurchase'] = null;
  for (const p of state.participants) {
    for (const purchase of p.team.purchases) {
      if (purchase.kind !== 'auction') continue;
      if (!biggestPurchase || purchase.price > biggestPurchase.price) {
        biggestPurchase = { participantId: p.id, characterId: purchase.characterId, price: purchase.price };
      }
    }
  }

  return {
    winnerId: rows[0]!.participantId,
    standings,
    tieBreak,
    totalVotes: votes.length,
    biggestPurchase,
    totalBids: state.history.reduce((acc, h) => acc + h.bidCount, 0),
    auctionsPlayed: state.history.length,
    finishedAt: now,
  };
}
