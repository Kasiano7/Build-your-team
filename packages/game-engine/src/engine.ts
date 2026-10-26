/**
 * Authoritative auction engine.
 *
 * Every function is pure: it receives the current state, a context holding
 * the content pack and the server clock, and returns a new state plus the
 * events produced (or an error code). The realtime service serialises calls
 * per room, so each command is applied atomically against the latest state.
 */
import type {
  Auction,
  ContentPack,
  ErrorCode,
  GameEvent,
  Participant,
  RoomSettings,
  RoomState,
  SlotRef,
} from '@byt/shared';
import { weightedPick } from './rng';
import {
  applySwap,
  bestSlotFor,
  canBidOn,
  canSwap,
  compatibility,
  emptyTeam,
  getCharacter,
  getFormation,
  isTeamComplete,
  maxBidFor,
  needsCharacter,
  placeCharacter,
  reformTeam,
} from './team';
import { computeResult } from './votes';

export interface EngineCtx {
  pack: ContentPack;
  now: number;
  /** Presentation timings override (tests / accelerated demo servers). */
  timings?: Timings;
}

export type Outcome =
  | { ok: true; state: RoomState; events: GameEvent[] }
  | { ok: false; code: ErrorCode; details?: Record<string, unknown> };

/** Durations of non-configurable presentation phases (ms). */
export const TIMINGS = {
  revealMs: 2600,
  soldDisplayMs: 4200,
  unsoldDisplayMs: 2400,
};
export type Timings = typeof TIMINGS;
const timingsOf = (ctx: EngineCtx): Timings => ctx.timings ?? TIMINGS;

export const PARTICIPANT_COLORS = ['#5AA9FF', '#FFB547', '#FF6B8A', '#B18CFF'];

const fail = (code: ErrorCode, details?: Record<string, unknown>): Outcome => ({ ok: false, code, details });

function clone(state: RoomState): RoomState {
  return structuredClone(state);
}

function bump(state: RoomState, now: number): void {
  state.version += 1;
  state.updatedAt = now;
}

function findParticipant(state: RoomState, id: string): Participant | undefined {
  return state.participants.find((p) => p.id === id);
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface SettingsInput {
  mode: 'quick' | 'classic';
  maxParticipants: 2 | 3 | 4;
  budget?: number;
  openingTimerSec?: number;
  bidResetSec?: number;
  formationId?: string;
}

export function buildSettings(pack: ContentPack, input: SettingsInput): RoomSettings {
  const mode = pack.modes.find((m) => m.id === input.mode);
  if (!mode) throw new Error(`Mode ${input.mode} not supported by pack ${pack.id}`);
  const formationId =
    input.formationId && mode.formationIds.includes(input.formationId) ? input.formationId : mode.defaultFormationId;
  const budget = input.budget && mode.allowedBudgets.includes(input.budget) ? input.budget : mode.defaultBudget;
  const slots = getFormation(pack, formationId).slots.length;
  return {
    packId: pack.id,
    mode: mode.id,
    maxParticipants: input.maxParticipants,
    budget,
    minIncrement: 10,
    reservePrice: 10,
    openingTimerSec: input.openingTimerSec ?? (mode.id === 'quick' ? 15 : 20),
    bidResetSec: input.bidResetSec ?? 12,
    formationId,
    benchSize: mode.benchSize,
    voteTimerSec: 75,
    spectatorVoteTimerSec: 300,
    maxAuctions: input.maxParticipants * (slots + mode.benchSize) * 3,
  };
}

/* ------------------------------------------------------------------ */
/* Lobby                                                               */
/* ------------------------------------------------------------------ */

export function createRoomState(args: {
  code: string;
  settings: RoomSettings;
  host: { id: string; nickname: string };
  seed: number;
  ctx: EngineCtx;
}): RoomState {
  const { code, settings, host, seed, ctx } = args;
  const state: RoomState = {
    code,
    version: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    status: 'lobby',
    settings,
    participants: [],
    pool: [],
    unsold: [],
    auctionCount: 0,
    auction: null,
    history: [],
    rngState: seed >>> 0,
    voting: null,
    result: null,
    processedActions: [],
  };
  state.participants.push(newParticipant(state, host.id, host.nickname, true, ctx));
  return state;
}

function newParticipant(state: RoomState, id: string, nickname: string, isHost: boolean, ctx: EngineCtx): Participant {
  const usedSeats = new Set(state.participants.map((p) => p.seat));
  let seat = 0;
  while (usedSeats.has(seat)) seat++;
  return {
    id,
    nickname,
    seat,
    color: PARTICIPANT_COLORS[seat % PARTICIPANT_COLORS.length]!,
    isHost,
    connected: true,
    joinedAt: ctx.now,
    budget: state.settings.budget,
    team: emptyTeam(getFormation(ctx.pack, state.settings.formationId), state.settings.benchSize),
  };
}

/** Make a nickname unique inside the room ("Alex", "Alex 2", ...). */
export function uniqueNickname(state: RoomState, nickname: string): string {
  const taken = new Set(state.participants.map((p) => p.nickname.toLowerCase()));
  if (!taken.has(nickname.toLowerCase())) return nickname;
  for (let i = 2; i < 10; i++) {
    const candidate = `${nickname.slice(0, 13)} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${nickname.slice(0, 11)} ${Math.floor(Math.random() * 900 + 100)}`;
}

export function addParticipant(state: RoomState, id: string, nickname: string, ctx: EngineCtx): Outcome {
  if (state.status !== 'lobby') return fail('GAME_ALREADY_STARTED');
  if (state.participants.length >= state.settings.maxParticipants) return fail('ROOM_FULL');
  const next = clone(state);
  next.participants.push(newParticipant(next, id, uniqueNickname(next, nickname), false, ctx));
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'participant_joined', participantId: id }] };
}

export function removeParticipant(state: RoomState, id: string, ctx: EngineCtx): Outcome {
  if (state.status !== 'lobby') return fail('WRONG_PHASE');
  const p = findParticipant(state, id);
  if (!p) return fail('NOT_IN_ROOM');
  const next = clone(state);
  next.participants = next.participants.filter((x) => x.id !== id);
  if (p.isHost && next.participants[0]) next.participants[0].isHost = true;
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'participant_left', participantId: id }] };
}

export function setConnected(state: RoomState, id: string, connected: boolean, ctx: EngineCtx): Outcome {
  const p = findParticipant(state, id);
  if (!p) return fail('NOT_IN_ROOM');
  if (p.connected === connected) return { ok: true, state, events: [] };
  const next = clone(state);
  findParticipant(next, id)!.connected = connected;
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'participant_connection', participantId: id, connected }] };
}

export function startGame(state: RoomState, byId: string, ctx: EngineCtx): Outcome {
  const p = findParticipant(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  if (!p.isHost) return fail('NOT_HOST');
  if (state.status !== 'lobby') return fail('GAME_ALREADY_STARTED');
  if (state.participants.length < 2) return fail('NOT_ENOUGH_PLAYERS');
  const next = clone(state);
  const formation = getFormation(ctx.pack, next.settings.formationId);
  next.settings.maxAuctions = next.participants.length * (formation.slots.length + next.settings.benchSize) * 3;
  next.status = 'drafting';
  next.pool = ctx.pack.characters.map((c) => c.id);
  const events: GameEvent[] = [{ type: 'game_started' }];
  startNextAuctionOrFinish(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

/* ------------------------------------------------------------------ */
/* Draft                                                               */
/* ------------------------------------------------------------------ */

/** Characters that at least one participant needs for an empty starter slot and can afford. */
function drawCandidates(state: RoomState, pack: ContentPack): string[] {
  return state.pool.filter((id) => {
    const c = getCharacter(pack, id);
    return state.participants.some(
      (p) => needsCharacter(pack, p.team, c) && canBidOn(pack, state.settings, p, c),
    );
  });
}

function draftIsOver(state: RoomState, pack: ContentPack): boolean {
  if (state.participants.every((p) => isTeamComplete(p.team))) return true;
  if (state.auctionCount >= state.settings.maxAuctions) return true;
  return drawCandidates(state, pack).length === 0;
}

function startNextAuctionOrFinish(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  if (draftIsOver(state, ctx.pack)) {
    finishDraft(state, ctx, events);
    return;
  }
  const candidates = drawCandidates(state, ctx.pack);
  // Stars come up a little more often than squad players, which keeps the room lively.
  const weights = candidates.map((id) => Math.pow(Math.max(1, getCharacter(ctx.pack, id).overall - 58), 1.6));
  const pick = weightedPick(weights, state.rngState);
  state.rngState = pick.state;
  const characterId = candidates[pick.index]!;
  state.pool = state.pool.filter((id) => id !== characterId);
  state.auctionCount += 1;
  const auction: Auction = {
    id: `${state.code}-A${state.auctionCount}`,
    no: state.auctionCount,
    characterId,
    stage: 'reveal',
    startedAt: ctx.now,
    revealEndsAt: ctx.now + timingsOf(ctx).revealMs,
    endsAt: null,
    closedAt: null,
    nextAt: null,
    highBid: null,
    bids: [],
    passed: [],
    eligible: [],
    result: null,
  };
  state.auction = auction;
  events.push({ type: 'auction_revealed', auctionId: auction.id, characterId, no: auction.no });
}

function openAuction(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const auction = state.auction!;
  const character = getCharacter(ctx.pack, auction.characterId);
  auction.stage = 'open';
  auction.eligible = state.participants
    .filter((p) => canBidOn(ctx.pack, state.settings, p, character))
    .map((p) => p.id);
  auction.endsAt = Math.max(ctx.now, auction.revealEndsAt) + state.settings.openingTimerSec * 1000;
  events.push({ type: 'auction_opened', auctionId: auction.id, endsAt: auction.endsAt });
  if (auction.eligible.length === 0) closeAuction(state, ctx, events);
}

function closeAuction(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const auction = state.auction!;
  auction.stage = 'closed';
  auction.closedAt = ctx.now;
  const high = auction.highBid;
  if (high) {
    const winner = findParticipant(state, high.participantId)!;
    const character = getCharacter(ctx.pack, auction.characterId);
    const slot = bestSlotFor(ctx.pack, winner.team, character);
    if (!slot) throw new Error('Invariant violated: winner has no slot');
    winner.budget -= high.amount;
    placeCharacter(winner.team, slot, character.id);
    winner.team.purchases.push({ characterId: character.id, price: high.amount, auctionNo: auction.no, kind: 'auction' });
    auction.result = { type: 'sold', participantId: winner.id, amount: high.amount, slot };
    auction.nextAt = ctx.now + timingsOf(ctx).soldDisplayMs;
    events.push({
      type: 'auction_sold',
      auctionId: auction.id,
      characterId: character.id,
      participantId: winner.id,
      amount: high.amount,
      slotKind: slot.kind,
      slotIndex: slot.index,
    });
  } else {
    auction.result = { type: 'unsold' };
    state.unsold.push(auction.characterId);
    auction.nextAt = ctx.now + timingsOf(ctx).unsoldDisplayMs;
    events.push({ type: 'auction_unsold', auctionId: auction.id, characterId: auction.characterId });
  }
  state.history.push({ no: auction.no, characterId: auction.characterId, result: auction.result, bidCount: auction.bids.length });
}

/** Everyone still able to act has either passed or holds the high bid. */
function maybeCloseEarly(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const auction = state.auction!;
  const active = auction.eligible.filter(
    (id) => !auction.passed.includes(id) && id !== auction.highBid?.participantId,
  );
  if (active.length === 0) closeAuction(state, ctx, events);
}

export function minimumNextBid(state: RoomState): number {
  const a = state.auction;
  if (!a?.highBid) return state.settings.reservePrice;
  return a.highBid.amount + state.settings.minIncrement;
}

export function placeBid(
  state: RoomState,
  byId: string,
  input: { auctionId: string; amount: number; bidId: string },
  ctx: EngineCtx,
): Outcome {
  if (state.status !== 'drafting' || !state.auction) return fail('WRONG_PHASE');
  const auction = state.auction;
  if (auction.id !== input.auctionId) return fail('STALE_AUCTION');
  if (auction.stage !== 'open' || auction.endsAt === null || ctx.now >= auction.endsAt) return fail('AUCTION_NOT_OPEN');
  const participant = findParticipant(state, byId);
  if (!participant) return fail('NOT_IN_ROOM');
  if (!auction.eligible.includes(byId)) return fail('NOT_ELIGIBLE');
  if (auction.passed.includes(byId)) return fail('ALREADY_PASSED');
  if (auction.highBid?.participantId === byId) return fail('ALREADY_HIGHEST');
  const min = minimumNextBid(state);
  if (input.amount < min) return fail('BID_TOO_LOW', { minimum: min, current: auction.highBid?.amount ?? null });
  const character = getCharacter(ctx.pack, auction.characterId);
  const max = maxBidFor(ctx.pack, state.settings, participant, character);
  if (input.amount > max) return fail('INSUFFICIENT_BUDGET', { maximum: max });

  const next = clone(state);
  const a = next.auction!;
  const bid = { id: input.bidId, participantId: byId, amount: input.amount, at: ctx.now };
  a.bids.push(bid);
  a.highBid = bid;
  a.endsAt = Math.max(a.endsAt!, ctx.now + next.settings.bidResetSec * 1000);
  const events: GameEvent[] = [
    { type: 'bid_placed', auctionId: a.id, participantId: byId, amount: input.amount, endsAt: a.endsAt },
  ];
  maybeCloseEarly(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

export function passAuction(state: RoomState, byId: string, input: { auctionId: string }, ctx: EngineCtx): Outcome {
  if (state.status !== 'drafting' || !state.auction) return fail('WRONG_PHASE');
  const auction = state.auction;
  if (auction.id !== input.auctionId) return fail('STALE_AUCTION');
  if (auction.stage !== 'open') return fail('AUCTION_NOT_OPEN');
  if (!findParticipant(state, byId)) return fail('NOT_IN_ROOM');
  if (!auction.eligible.includes(byId)) return fail('NOT_ELIGIBLE');
  if (auction.passed.includes(byId)) return fail('ALREADY_PASSED');
  if (auction.highBid?.participantId === byId) return fail('HIGHEST_CANNOT_PASS');
  const next = clone(state);
  next.auction!.passed.push(byId);
  const events: GameEvent[] = [{ type: 'participant_passed', auctionId: auction.id, participantId: byId }];
  maybeCloseEarly(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

/**
 * Free-agent completion — explicit and identical for everyone:
 * participants in seat order, empty starter slots in formation order; each
 * slot receives the lowest-rated compatible character still available
 * (never auctioned or unsold), at the reserve price.
 */
function completeWithFreeAgents(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const available = new Set([...state.pool, ...state.unsold]);
  const sorted = [...available]
    .map((id) => getCharacter(ctx.pack, id))
    .sort((a, b) => a.overall - b.overall || a.id.localeCompare(b.id));
  for (const p of [...state.participants].sort((a, b) => a.seat - b.seat)) {
    const formation = getFormation(ctx.pack, p.team.formationId);
    formation.slots.forEach((slot, index) => {
      if (p.team.starters[index] !== null) return;
      const pickIdx = sorted.findIndex((c) => available.has(c.id) && compatibility(ctx.pack, c, slot) > 0);
      if (pickIdx < 0) return;
      const c = sorted[pickIdx]!;
      available.delete(c.id);
      const price = Math.min(state.settings.reservePrice, p.budget);
      p.budget -= price;
      p.team.starters[index] = c.id;
      p.team.purchases.push({ characterId: c.id, price, auctionNo: null, kind: 'free_agent' });
      events.push({ type: 'free_agent_assigned', participantId: p.id, characterId: c.id, price });
    });
  }
  state.pool = state.pool.filter((id) => available.has(id));
  state.unsold = state.unsold.filter((id) => available.has(id));
}

function finishDraft(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  completeWithFreeAgents(state, ctx, events);
  state.auction = null;
  state.status = 'voting';
  const mode = state.participants.length >= 3 ? 'participants' : 'spectators';
  const duration = mode === 'participants' ? state.settings.voteTimerSec : state.settings.spectatorVoteTimerSec;
  state.voting = { mode, startedAt: ctx.now, endsAt: ctx.now + duration * 1000, votes: [] };
  events.push({ type: 'draft_finished' }, { type: 'voting_started', mode, endsAt: state.voting.endsAt });
}

/* ------------------------------------------------------------------ */
/* Team management                                                     */
/* ------------------------------------------------------------------ */

export function swapSlots(state: RoomState, byId: string, a: SlotRef, b: SlotRef, ctx: EngineCtx): Outcome {
  if (state.status !== 'drafting') return fail('WRONG_PHASE');
  const p = findParticipant(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  const check = canSwap(ctx.pack, p.team, a, b);
  if (check !== 'ok') return fail(check);
  const next = clone(state);
  applySwap(findParticipant(next, byId)!.team, a, b);
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'team_changed', participantId: byId }] };
}

export function changeFormation(state: RoomState, byId: string, formationId: string, ctx: EngineCtx): Outcome {
  if (state.status !== 'drafting' && state.status !== 'lobby') return fail('WRONG_PHASE');
  const p = findParticipant(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  const mode = ctx.pack.modes.find((m) => m.id === state.settings.mode)!;
  if (!mode.formationChangeAllowed) return fail('FORMATION_LOCKED');
  if (!mode.formationIds.includes(formationId)) return fail('UNKNOWN_FORMATION');
  const reformed = reformTeam(ctx.pack, p.team, getFormation(ctx.pack, formationId));
  if (!reformed) return fail('INCOMPATIBLE_SLOT');
  const next = clone(state);
  findParticipant(next, byId)!.team = reformed;
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'team_changed', participantId: byId }] };
}

/* ------------------------------------------------------------------ */
/* Voting                                                              */
/* ------------------------------------------------------------------ */

export function castVote(
  state: RoomState,
  voter: { id: string; kind: 'participant' | 'spectator' },
  targetId: string,
  ctx: EngineCtx,
): Outcome {
  if (state.status !== 'voting' || !state.voting) return fail('VOTE_CLOSED');
  if (ctx.now >= state.voting.endsAt) return fail('VOTE_CLOSED');
  const expectedKind = state.voting.mode === 'participants' ? 'participant' : 'spectator';
  if (voter.kind !== expectedKind) return fail('WRONG_PHASE');
  if (voter.kind === 'participant' && !findParticipant(state, voter.id)) return fail('NOT_IN_ROOM');
  if (!findParticipant(state, targetId)) return fail('UNKNOWN_TARGET');
  if (voter.id === targetId) return fail('CANNOT_VOTE_OWN_TEAM');
  if (state.voting.votes.some((v) => v.voterId === voter.id)) return fail('ALREADY_VOTED');
  const next = clone(state);
  next.voting!.votes.push({ voterId: voter.id, voterKind: voter.kind, targetId, at: ctx.now });
  const events: GameEvent[] = [{ type: 'vote_cast', voterKind: voter.kind, voterId: voter.id }];
  if (
    next.voting!.mode === 'participants' &&
    next.participants.every((p) => next.voting!.votes.some((v) => v.voterId === p.id))
  ) {
    finishGame(next, ctx, events);
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

export function closeVoting(state: RoomState, byId: string, ctx: EngineCtx): Outcome {
  if (state.status !== 'voting') return fail('VOTE_CLOSED');
  const p = findParticipant(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  if (!p.isHost) return fail('NOT_HOST');
  const next = clone(state);
  const events: GameEvent[] = [];
  finishGame(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

function finishGame(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  state.status = 'finished';
  state.result = computeResult(state, ctx.pack, ctx.now);
  events.push({ type: 'game_finished', winnerId: state.result.winnerId });
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

/** Next server time at which `advance` must run, or null. */
export function nextDeadline(state: RoomState): number | null {
  if (state.status === 'drafting' && state.auction) {
    const a = state.auction;
    if (a.stage === 'reveal') return a.revealEndsAt;
    if (a.stage === 'open') return a.endsAt;
    return a.nextAt;
  }
  if (state.status === 'voting' && state.voting) return state.voting.endsAt;
  return null;
}

/** Apply every time-based transition that is due. Called by the server scheduler. */
export function advance(state: RoomState, ctx: EngineCtx): Outcome {
  const deadline = nextDeadline(state);
  if (deadline === null || ctx.now < deadline) return { ok: true, state, events: [] };
  const next = clone(state);
  const events: GameEvent[] = [];
  for (let guard = 0; guard < 10; guard++) {
    const d = nextDeadline(next);
    if (d === null || ctx.now < d) break;
    if (next.status === 'drafting' && next.auction) {
      const a = next.auction;
      if (a.stage === 'reveal') openAuction(next, ctx, events);
      else if (a.stage === 'open') closeAuction(next, ctx, events);
      else startNextAuctionOrFinish(next, ctx, events);
    } else if (next.status === 'voting') {
      finishGame(next, ctx, events);
    }
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}
