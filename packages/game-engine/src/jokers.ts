/**
 * Jokers (room option): each team holds three single-use jokers.
 *  - Veto: remove the player on the block from the draft, before any bid.
 *  - Half price: armed on the current auction; if the team wins it, it pays half.
 *  - Steal: take a player from another team for 1.5× its price; the victim is refunded.
 */
import type { GameEvent, Jokers, Participant, RoomState } from '@byt/shared';
import { bump, clone, fail, findParticipant, opts, teamOfMember, timingsFor, type EngineCtx, type Failure, type Outcome } from './context';
import { locate } from './mercato';
import { bestSlotFor, getCharacter, maxBidFor, placeCharacter } from './team';

function jokerActor(state: RoomState, memberId: string, joker: keyof Jokers) {
  if (state.status !== 'drafting') return fail('WRONG_PHASE');
  if (!opts(state.settings).jokers) return fail('JOKERS_DISABLED');
  const team = teamOfMember(state, memberId);
  if (!team) return fail('NOT_IN_ROOM');
  if (!team.jokers?.[joker]) return fail('JOKER_USED');
  return team;
}

/** The current auction, provided it has not closed and nobody has bid yet (when `noBids`). */
function liveAuction(state: RoomState, auctionId: string, now: number, noBids: boolean) {
  const a = state.auction;
  if (!a) return fail('WRONG_PHASE');
  if (a.id !== auctionId) return fail('STALE_AUCTION');
  if (a.stage === 'closed' || (a.stage === 'open' && a.endsAt !== null && now >= a.endsAt)) return fail('AUCTION_NOT_OPEN');
  if (noBids && a.bids.length > 0) return fail('AUCTION_NOT_OPEN');
  return a;
}

const isFail = (x: unknown): x is Failure => typeof x === 'object' && x !== null && 'ok' in x;

export function useVeto(state: RoomState, byId: string, input: { auctionId: string }, ctx: EngineCtx): Outcome {
  const team = jokerActor(state, byId, 'veto');
  if (isFail(team)) return team;
  const live = liveAuction(state, input.auctionId, ctx.now, true);
  if (isFail(live)) return live;
  const next = clone(state);
  const a = next.auction!;
  findParticipant(next, team.id)!.jokers!.veto = false;
  a.stage = 'closed';
  a.closedAt = ctx.now;
  a.endsAt ??= ctx.now;
  a.result = { type: 'vetoed', participantId: team.id };
  a.nextAt = ctx.now + timingsFor(ctx, next.settings).unsoldDisplayMs;
  next.history.push({ no: a.no, characterId: a.characterId, result: a.result, bidCount: 0 });
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'auction_vetoed', auctionId: a.id, characterId: a.characterId, participantId: team.id }] };
}

export function useHalfPrice(state: RoomState, byId: string, input: { auctionId: string }, ctx: EngineCtx): Outcome {
  const team = jokerActor(state, byId, 'halfPrice');
  if (isFail(team)) return team;
  const live = liveAuction(state, input.auctionId, ctx.now, false);
  if (isFail(live)) return live;
  const next = clone(state);
  const a = next.auction!;
  findParticipant(next, team.id)!.jokers!.halfPrice = false;
  a.halfPriceArmed = [...(a.halfPriceArmed ?? []), team.id];
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'half_price_armed', auctionId: a.id, participantId: team.id }] };
}

/** Price of a steal: 1.5 × what the victim paid, rounded up to the bid increment. */
export function stealPrice(state: RoomState, victim: Participant, characterId: string): { price: number; refund: number } {
  const s = state.settings;
  const refund = victim.team.purchases.find((p) => p.characterId === characterId)?.price ?? s.reservePrice;
  const price = Math.max(s.reservePrice, Math.ceil((refund * 1.5) / s.minIncrement) * s.minIncrement);
  return { price, refund };
}

export function useSteal(state: RoomState, byId: string, input: { targetId: string; characterId: string }, ctx: EngineCtx): Outcome {
  const thief = jokerActor(state, byId, 'steal');
  if (isFail(thief)) return thief;
  const victim = findParticipant(state, input.targetId);
  if (!victim || victim.id === thief.id) return fail('UNKNOWN_TARGET');
  const from = locate(victim.team, input.characterId);
  if (!from) return fail('NOT_OWNER');
  // The thief cannot use a steal while holding the lead on the current auction (its slot is spoken for).
  const a = state.auction;
  if (a && a.stage === 'open' && (a.highBid?.participantId === thief.id || a.bids.some((b) => b.participantId === thief.id && a.style === 'sealed'))) {
    return fail('ALREADY_HIGHEST');
  }
  const c = getCharacter(ctx.pack, input.characterId);
  const slot = bestSlotFor(ctx.pack, thief.team, c);
  if (!slot) return fail('INCOMPATIBLE_SLOT');
  const { price, refund } = stealPrice(state, victim, c.id);
  if (price > maxBidFor(ctx.pack, state.settings, thief, c)) return fail('INSUFFICIENT_BUDGET', { price });

  const next = clone(state);
  const t = findParticipant(next, thief.id)!;
  const v = findParticipant(next, victim.id)!;
  if (from.kind === 'starter') v.team.starters[from.index] = null;
  else v.team.bench[from.index] = null;
  v.team.purchases = v.team.purchases.filter((p) => p.characterId !== c.id);
  v.budget += refund;
  t.budget -= price;
  placeCharacter(t.team, slot, c.id);
  t.team.purchases.push({ characterId: c.id, price, auctionNo: null, kind: 'steal' });
  t.jokers!.steal = false;
  const events: GameEvent[] = [
    { type: 'joker_steal', participantId: t.id, targetId: v.id, characterId: c.id, price },
    { type: 'team_changed', participantId: t.id },
    { type: 'team_changed', participantId: v.id },
  ];
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}
