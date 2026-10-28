/**
 * Authoritative auction engine.
 *
 * Every function is pure: it receives the current state, a context holding
 * the content pack and the server clock, and returns a new state plus the
 * events produced (or an error code). The realtime service serialises calls
 * per room, so each command is applied atomically against the latest state.
 *
 * Commands are issued by a *member* (a person). In solo format a member and
 * their team share the same id; in duo format two members control one team.
 */
import type {
  Auction,
  BotLevel,
  ContentPack,
  GameEvent,
  Member,
  Participant,
  RoomSettings,
  RoomState,
  SlotRef,
} from '@byt/shared';
import {
  bump,
  clone,
  fail,
  findParticipant,
  matchesTheme,
  membersOf,
  opts,
  teamOfMember,
  themeOf,
  themeShortfall,
  timingsFor,
  type EngineCtx,
  type Outcome,
} from './context';
import { beginConclusion, finishGame } from './finish';
import { endMercato, startMercato } from './mercato';
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

export { TIMINGS, type EngineCtx, type Outcome, type Timings } from './context';

export const PARTICIPANT_COLORS = ['#5AA9FF', '#FFB547', '#FF6B8A', '#B18CFF'];

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
  format?: RoomSettings['format'];
  auctionStyle?: RoomSettings['auctionStyle'];
  pace?: RoomSettings['pace'];
  themeId?: string | null;
  mystery?: boolean;
  jokers?: boolean;
  mercato?: boolean;
  endMode?: RoomSettings['endMode'];
  twitchChannel?: string | null;
}

export function buildSettings(pack: ContentPack, input: SettingsInput): RoomSettings {
  const mode = pack.modes.find((m) => m.id === input.mode);
  if (!mode) throw new Error(`Mode ${input.mode} not supported by pack ${pack.id}`);
  const formationId =
    input.formationId && mode.formationIds.includes(input.formationId) ? input.formationId : mode.defaultFormationId;
  const budget = input.budget && mode.allowedBudgets.includes(input.budget) ? input.budget : mode.defaultBudget;
  const slots = getFormation(pack, formationId).slots.length;
  const eclair = input.pace === 'eclair';
  return {
    packId: pack.id,
    mode: mode.id,
    maxParticipants: input.maxParticipants,
    budget,
    minIncrement: 10,
    reservePrice: 10,
    openingTimerSec: input.openingTimerSec ?? (eclair ? 8 : mode.id === 'quick' ? 15 : 20),
    bidResetSec: input.bidResetSec ?? (eclair ? 6 : 12),
    formationId,
    benchSize: mode.benchSize,
    voteTimerSec: eclair ? 45 : 75,
    spectatorVoteTimerSec: eclair ? 180 : 300,
    maxAuctions: input.maxParticipants * (slots + mode.benchSize) * 3,
    format: input.format ?? 'solo',
    auctionStyle: input.auctionStyle ?? 'english',
    pace: input.pace ?? 'normal',
    themeId: input.themeId && themeOf(pack, input.themeId) ? input.themeId : null,
    mystery: !!input.mystery,
    jokers: !!input.jokers,
    mercato: !!input.mercato,
    mercatoTimerSec: eclair ? 60 : 90,
    endMode: input.endMode ?? 'vote',
    twitchChannel: input.twitchChannel ?? null,
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
    mercato: null,
  };
  state.participants.push(newTeam(state, host.id, host.nickname, true, ctx));
  return state;
}

function newTeam(state: RoomState, id: string, nickname: string, isHost: boolean, ctx: EngineCtx, bot?: BotLevel): Participant {
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
    members: bot ? [] : [{ id, nickname, connected: true }],
    ...(bot ? { bot: { level: bot } } : {}),
  };
}

/** Display name of a team: its member(s) nicknames. */
function teamName(members: Member[], fallback: string): string {
  return members.length ? members.map((m) => m.nickname).join(' & ') : fallback;
}

/** Make a nickname unique inside the room ("Alex", "Alex 2", ...). */
export function uniqueNickname(state: RoomState, nickname: string): string {
  const taken = new Set(
    state.participants.flatMap((p) => [p.nickname, ...membersOf(p).map((m) => m.nickname)]).map((n) => n.toLowerCase()),
  );
  if (!taken.has(nickname.toLowerCase())) return nickname;
  for (let i = 2; i < 10; i++) {
    const candidate = `${nickname.slice(0, 13)} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${nickname.slice(0, 11)} ${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * A person joins the lobby. Solo: they get a new team. Duo: they join `teamId`
 * when given, otherwise a new team while there is room, otherwise the first
 * human team that still has a free place.
 */
export function addParticipant(state: RoomState, id: string, nickname: string, ctx: EngineCtx, teamId?: string): Outcome {
  if (state.status !== 'lobby') return fail('GAME_ALREADY_STARTED');
  const duo = opts(state.settings).format === 'duo';
  const next = clone(state);
  const name = uniqueNickname(next, nickname);
  let partnerOf: Participant | undefined;
  if (duo && teamId) {
    partnerOf = findParticipant(next, teamId);
    if (!partnerOf || partnerOf.bot) return fail('UNKNOWN_TARGET');
    if (membersOf(partnerOf).length >= 2) return fail('ROOM_FULL');
  } else if (next.participants.length >= next.settings.maxParticipants) {
    if (!duo) return fail('ROOM_FULL');
    partnerOf = next.participants.find((p) => !p.bot && membersOf(p).length < 2);
    if (!partnerOf) return fail('ROOM_FULL');
  }
  if (partnerOf) {
    const members = [...membersOf(partnerOf), { id, nickname: name, connected: true }];
    partnerOf.members = members;
    partnerOf.nickname = teamName(members, partnerOf.nickname);
    partnerOf.connected = true;
  } else {
    next.participants.push(newTeam(next, id, name, false, ctx));
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'participant_joined', participantId: id }] };
}

/** Host adds a computer-controlled team (lobby only). */
export function addBot(state: RoomState, byId: string, bot: { id: string; nickname: string; level: BotLevel }, ctx: EngineCtx): Outcome {
  const host = teamOfMember(state, byId);
  if (!host) return fail('NOT_IN_ROOM');
  if (!host.isHost) return fail('NOT_HOST');
  if (state.status !== 'lobby') return fail('GAME_ALREADY_STARTED');
  if (state.participants.length >= state.settings.maxParticipants) return fail('ROOM_FULL');
  const next = clone(state);
  next.participants.push(newTeam(next, bot.id, uniqueNickname(next, bot.nickname), false, ctx, bot.level));
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'bot_added', participantId: bot.id }] };
}

function dropTeam(state: RoomState, teamId: string): void {
  const team = findParticipant(state, teamId)!;
  state.participants = state.participants.filter((x) => x.id !== teamId);
  if (team.isHost) {
    const heir = state.participants.find((p) => !p.bot);
    if (heir) heir.isHost = true;
  }
}

export function removeParticipant(state: RoomState, memberId: string, ctx: EngineCtx): Outcome {
  if (state.status !== 'lobby' && state.status !== 'finished') return fail('WRONG_PHASE');
  const team = teamOfMember(state, memberId);
  if (!team) return fail('NOT_IN_ROOM');
  const next = clone(state);
  const t = findParticipant(next, team.id)!;
  const members = membersOf(t);
  if (members.length > 1) {
    t.members = members.filter((m) => m.id !== memberId);
    t.nickname = teamName(t.members, t.nickname);
    t.connected = t.members.some((m) => m.connected);
  } else {
    dropTeam(next, t.id);
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'participant_left', participantId: memberId }] };
}

/** Member ids controlling a team (used by the server to revoke sessions on kick). */
export function memberIdsOf(state: RoomState, teamId: string): string[] {
  const t = findParticipant(state, teamId);
  return t ? membersOf(t).map((m) => m.id) : [];
}

/** Host removes a team (offensive nickname, unwanted bot...). Lobby only. */
export function kickParticipant(state: RoomState, hostId: string, targetId: string, ctx: EngineCtx): Outcome {
  const host = teamOfMember(state, hostId);
  if (!host) return fail('NOT_IN_ROOM');
  if (!host.isHost) return fail('NOT_HOST');
  if (state.status !== 'lobby') return fail('WRONG_PHASE');
  if (targetId === host.id || !findParticipant(state, targetId)) return fail('UNKNOWN_TARGET');
  const next = clone(state);
  dropTeam(next, targetId);
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'participant_left', participantId: targetId }] };
}

export function setConnected(state: RoomState, memberId: string, connected: boolean, ctx: EngineCtx): Outcome {
  const team = teamOfMember(state, memberId);
  if (!team) return fail('NOT_IN_ROOM');
  const member = membersOf(team).find((m) => m.id === memberId);
  if ((member?.connected ?? team.connected) === connected) return { ok: true, state, events: [] };
  const next = clone(state);
  const t = findParticipant(next, team.id)!;
  if (t.members) {
    const m = t.members.find((x) => x.id === memberId);
    if (m) m.connected = connected;
    t.connected = t.members.some((x) => x.connected);
  } else {
    t.connected = connected;
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'participant_connection', participantId: team.id, connected: t.connected }] };
}

export function startGame(state: RoomState, byId: string, ctx: EngineCtx): Outcome {
  const p = teamOfMember(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  if (!p.isHost) return fail('NOT_HOST');
  if (state.status !== 'lobby') return fail('GAME_ALREADY_STARTED');
  if (state.participants.length < 2) return fail('NOT_ENOUGH_PLAYERS');
  const o = opts(state.settings);
  const short = themeShortfall(ctx.pack, state.settings.mode, o.themeId, state.participants.length);
  if (short.length) return fail('THEME_TOO_SMALL', { groups: short });
  const next = clone(state);
  const formation = getFormation(ctx.pack, next.settings.formationId);
  next.settings.maxAuctions = next.participants.length * (formation.slots.length + next.settings.benchSize) * 3;
  next.status = 'drafting';
  next.pool = ctx.pack.characters.filter((c) => matchesTheme(ctx.pack, o.themeId, c)).map((c) => c.id);
  for (const t of next.participants) {
    if (o.jokers) t.jokers = { veto: true, halfPrice: true, steal: true };
    else delete t.jokers;
  }
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
    return state.participants.some((p) => needsCharacter(pack, p.team, c) && canBidOn(pack, state.settings, p, c));
  });
}

function draftIsOver(state: RoomState, pack: ContentPack): boolean {
  if (state.participants.every((p) => isTeamComplete(p.team))) return true;
  if (state.auctionCount >= state.settings.maxAuctions) return true;
  return drawCandidates(state, pack).length === 0;
}

export function startNextAuctionOrFinish(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
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
  const style = opts(state.settings).auctionStyle;
  const auction: Auction = {
    // Rematches reuse the room code: later games carry their round in the id.
    id: `${state.code}${(state.series?.round ?? 1) > 1 ? `-R${state.series!.round}` : ''}-A${state.auctionCount}`,
    no: state.auctionCount,
    characterId,
    stage: 'reveal',
    startedAt: ctx.now,
    revealEndsAt: ctx.now + timingsFor(ctx, state.settings).revealMs,
    endsAt: null,
    closedAt: null,
    nextAt: null,
    highBid: null,
    bids: [],
    passed: [],
    eligible: [],
    result: null,
    ...(style !== 'english' ? { style } : {}),
  };
  state.auction = auction;
  events.push({ type: 'auction_revealed', auctionId: auction.id, characterId, no: auction.no });
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/**
 * Dutch auction parameters: the price starts high (scaled on the player's
 * rating and the richest eligible team), then drops by one step at a regular
 * pace to the reserve price, which it reaches at 85 % of the timer.
 */
function dutchParams(state: RoomState, pack: ContentPack, eligible: Participant[], characterId: string, openedAt: number) {
  const s = state.settings;
  const c = getCharacter(pack, characterId);
  const slots = getFormation(pack, s.formationId).slots.length;
  const fair = s.budget / slots;
  const scale = Math.max(0.8, 0.8 + ((c.overall - 70) / 10) * 1.1);
  const richest = Math.max(...eligible.map((p) => maxBidFor(pack, s, p, c)));
  const startPrice = Math.max(s.reservePrice, Math.min(richest, roundTo(fair * scale * 1.8, s.minIncrement)));
  const span = startPrice - s.reservePrice;
  const step = span <= 0 ? s.minIncrement : Math.max(s.minIncrement, roundTo(span / 14, s.minIncrement));
  const steps = Math.max(1, Math.ceil(span / step));
  return { startPrice, floor: s.reservePrice, step, stepMs: Math.round((s.openingTimerSec * 1000 * 0.85) / steps), openedAt };
}

/** Current price of an open dutch auction at server time `now`. */
export function dutchPrice(auction: Auction, now: number): number {
  const d = auction.dutch;
  if (!d) return 0;
  const steps = Math.floor(Math.max(0, now - d.openedAt) / d.stepMs);
  return Math.max(d.floor, d.startPrice - steps * d.step);
}

function openAuction(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const auction = state.auction!;
  const character = getCharacter(ctx.pack, auction.characterId);
  auction.stage = 'open';
  const eligible = state.participants.filter((p) => canBidOn(ctx.pack, state.settings, p, character));
  auction.eligible = eligible.map((p) => p.id);
  const openedAt = Math.max(ctx.now, auction.revealEndsAt);
  auction.endsAt = openedAt + state.settings.openingTimerSec * 1000;
  if (auction.style === 'dutch' && eligible.length) {
    auction.dutch = dutchParams(state, ctx.pack, eligible, auction.characterId, openedAt);
  }
  events.push({ type: 'auction_opened', auctionId: auction.id, endsAt: auction.endsAt });
  if (auction.eligible.length === 0) closeAuction(state, ctx, events);
}

/** Sealed auction: highest offer wins, the earliest one on a tie. */
function sealedWinner(auction: Auction) {
  let best: Auction['highBid'] = null;
  for (const b of auction.bids) if (!best || b.amount > best.amount || (b.amount === best.amount && b.at < best.at)) best = b;
  return best;
}

export function closeAuction(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const auction = state.auction!;
  const timings = timingsFor(ctx, state.settings);
  auction.stage = 'closed';
  auction.closedAt = ctx.now;
  if (auction.style === 'sealed') auction.highBid = sealedWinner(auction);
  const high = auction.highBid;
  const winner = high ? findParticipant(state, high.participantId) : undefined;
  const character = getCharacter(ctx.pack, auction.characterId);
  const slot = winner ? bestSlotFor(ctx.pack, winner.team, character) : null;
  if (high && winner && slot) {
    const half = !!auction.halfPriceArmed?.includes(winner.id);
    const price = half ? Math.ceil(high.amount / 2) : high.amount;
    winner.budget -= price;
    placeCharacter(winner.team, slot, character.id);
    winner.team.purchases.push({ characterId: character.id, price, auctionNo: auction.no, kind: 'auction' });
    auction.result = { type: 'sold', participantId: winner.id, amount: price, slot, ...(half ? { halfPrice: true } : {}) };
    auction.nextAt = ctx.now + timings.soldDisplayMs;
    events.push({
      type: 'auction_sold',
      auctionId: auction.id,
      characterId: character.id,
      participantId: winner.id,
      amount: price,
      slotKind: slot.kind,
      slotIndex: slot.index,
    });
  } else {
    auction.result = { type: 'unsold' };
    state.unsold.push(auction.characterId);
    auction.nextAt = ctx.now + timings.unsoldDisplayMs;
    events.push({ type: 'auction_unsold', auctionId: auction.id, characterId: auction.characterId });
  }
  state.history.push({ no: auction.no, characterId: auction.characterId, result: auction.result, bidCount: auction.bids.length });
}

/** Everyone still able to act has passed, holds the high bid, or (sealed) has made an offer. */
function maybeCloseEarly(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const auction = state.auction!;
  const done = (id: string) =>
    auction.passed.includes(id) ||
    (auction.style === 'sealed' ? auction.bids.some((b) => b.participantId === id) : id === auction.highBid?.participantId);
  if (auction.eligible.every(done)) closeAuction(state, ctx, events);
}

export function minimumNextBid(state: RoomState): number {
  const a = state.auction;
  if (!a?.highBid) return state.settings.reservePrice;
  return a.highBid.amount + state.settings.minIncrement;
}

/** Common checks for an action on the current open auction. */
function auctionActor(state: RoomState, memberId: string, auctionId: string, now: number) {
  if (state.status !== 'drafting' || !state.auction) return fail('WRONG_PHASE');
  const auction = state.auction;
  if (auction.id !== auctionId) return fail('STALE_AUCTION');
  if (auction.stage !== 'open' || auction.endsAt === null || now >= auction.endsAt) return fail('AUCTION_NOT_OPEN');
  const team = teamOfMember(state, memberId);
  if (!team) return fail('NOT_IN_ROOM');
  if (!auction.eligible.includes(team.id)) return fail('NOT_ELIGIBLE');
  if (auction.passed.includes(team.id)) return fail('ALREADY_PASSED');
  return { auction, team };
}

/** English auction: open ascending bid. */
export function placeBid(
  state: RoomState,
  byId: string,
  input: { auctionId: string; amount: number; bidId: string },
  ctx: EngineCtx,
): Outcome {
  const a0 = auctionActor(state, byId, input.auctionId, ctx.now);
  if ('ok' in a0) return a0;
  const { auction, team } = a0;
  if (auction.style && auction.style !== 'english') return fail('WRONG_AUCTION_STYLE');
  if (auction.highBid?.participantId === team.id) return fail('ALREADY_HIGHEST');
  const min = minimumNextBid(state);
  if (input.amount < min) return fail('BID_TOO_LOW', { minimum: min, current: auction.highBid?.amount ?? null });
  const max = maxBidFor(ctx.pack, state.settings, team, getCharacter(ctx.pack, auction.characterId));
  if (input.amount > max) return fail('INSUFFICIENT_BUDGET', { maximum: max });

  const next = clone(state);
  const a = next.auction!;
  const bid = { id: input.bidId, participantId: team.id, amount: input.amount, at: ctx.now };
  a.bids.push(bid);
  a.highBid = bid;
  a.endsAt = Math.max(a.endsAt!, ctx.now + next.settings.bidResetSec * 1000);
  const events: GameEvent[] = [
    { type: 'bid_placed', auctionId: a.id, participantId: team.id, amount: input.amount, endsAt: a.endsAt },
  ];
  maybeCloseEarly(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

/** Dutch auction: take the player at the current price. First claim wins. */
export function claimAuction(state: RoomState, byId: string, input: { auctionId: string; bidId: string }, ctx: EngineCtx): Outcome {
  const a0 = auctionActor(state, byId, input.auctionId, ctx.now);
  if ('ok' in a0) return a0;
  const { auction, team } = a0;
  if (auction.style !== 'dutch' || !auction.dutch) return fail('WRONG_AUCTION_STYLE');
  const price = dutchPrice(auction, ctx.now);
  const max = maxBidFor(ctx.pack, state.settings, team, getCharacter(ctx.pack, auction.characterId));
  if (price > max) return fail('INSUFFICIENT_BUDGET', { maximum: max, price });
  const next = clone(state);
  const a = next.auction!;
  const bid = { id: input.bidId, participantId: team.id, amount: price, at: ctx.now };
  a.bids.push(bid);
  a.highBid = bid;
  const events: GameEvent[] = [{ type: 'bid_placed', auctionId: a.id, participantId: team.id, amount: price, endsAt: ctx.now }];
  closeAuction(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

/** Sealed auction: one secret offer per team, revealed when the auction closes. */
export function sealBid(
  state: RoomState,
  byId: string,
  input: { auctionId: string; amount: number; bidId: string },
  ctx: EngineCtx,
): Outcome {
  const a0 = auctionActor(state, byId, input.auctionId, ctx.now);
  if ('ok' in a0) return a0;
  const { auction, team } = a0;
  if (auction.style !== 'sealed') return fail('WRONG_AUCTION_STYLE');
  if (auction.bids.some((b) => b.participantId === team.id)) return fail('ALREADY_OFFERED');
  if (input.amount < state.settings.reservePrice) return fail('BID_TOO_LOW', { minimum: state.settings.reservePrice, current: null });
  const max = maxBidFor(ctx.pack, state.settings, team, getCharacter(ctx.pack, auction.characterId));
  if (input.amount > max) return fail('INSUFFICIENT_BUDGET', { maximum: max });
  const next = clone(state);
  next.auction!.bids.push({ id: input.bidId, participantId: team.id, amount: input.amount, at: ctx.now });
  const events: GameEvent[] = [{ type: 'sealed_offer', auctionId: auction.id, participantId: team.id }];
  maybeCloseEarly(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

export function passAuction(state: RoomState, byId: string, input: { auctionId: string }, ctx: EngineCtx): Outcome {
  if (state.status !== 'drafting' || !state.auction) return fail('WRONG_PHASE');
  const auction = state.auction;
  if (auction.id !== input.auctionId) return fail('STALE_AUCTION');
  if (auction.stage !== 'open') return fail('AUCTION_NOT_OPEN');
  const team = teamOfMember(state, byId);
  if (!team) return fail('NOT_IN_ROOM');
  if (!auction.eligible.includes(team.id)) return fail('NOT_ELIGIBLE');
  if (auction.passed.includes(team.id)) return fail('ALREADY_PASSED');
  if (auction.highBid?.participantId === team.id) return fail('HIGHEST_CANNOT_PASS');
  if (auction.style === 'sealed' && auction.bids.some((b) => b.participantId === team.id)) return fail('ALREADY_OFFERED');
  const next = clone(state);
  next.auction!.passed.push(team.id);
  const events: GameEvent[] = [{ type: 'participant_passed', auctionId: auction.id, participantId: team.id }];
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
export function completeWithFreeAgents(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
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
  events.push({ type: 'draft_finished' });
  if (opts(state.settings).mercato) startMercato(state, ctx, events);
  else beginConclusion(state, ctx, events);
}

/* ------------------------------------------------------------------ */
/* Team management                                                     */
/* ------------------------------------------------------------------ */

export function swapSlots(state: RoomState, byId: string, a: SlotRef, b: SlotRef, ctx: EngineCtx): Outcome {
  if (state.status !== 'drafting' && state.status !== 'mercato') return fail('WRONG_PHASE');
  const p = teamOfMember(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  const check = canSwap(ctx.pack, p.team, a, b);
  if (check !== 'ok') return fail(check);
  const next = clone(state);
  applySwap(findParticipant(next, p.id)!.team, a, b);
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'team_changed', participantId: p.id }] };
}

export function changeFormation(state: RoomState, byId: string, formationId: string, ctx: EngineCtx): Outcome {
  if (state.status !== 'drafting' && state.status !== 'lobby' && state.status !== 'mercato') return fail('WRONG_PHASE');
  const p = teamOfMember(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  const mode = ctx.pack.modes.find((m) => m.id === state.settings.mode)!;
  if (!mode.formationChangeAllowed) return fail('FORMATION_LOCKED');
  if (!mode.formationIds.includes(formationId)) return fail('UNKNOWN_FORMATION');
  const reformed = reformTeam(ctx.pack, p.team, getFormation(ctx.pack, formationId));
  if (!reformed) return fail('INCOMPATIBLE_SLOT');
  const next = clone(state);
  findParticipant(next, p.id)!.team = reformed;
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'team_changed', participantId: p.id }] };
}

/* ------------------------------------------------------------------ */
/* Voting                                                              */
/* ------------------------------------------------------------------ */

/** A participant votes on behalf of their team (one vote per team); a spectator votes for themself. */
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
  let voterId = voter.id;
  if (voter.kind === 'participant') {
    const team = teamOfMember(state, voter.id);
    if (!team) return fail('NOT_IN_ROOM');
    voterId = team.id;
  }
  if (!findParticipant(state, targetId)) return fail('UNKNOWN_TARGET');
  if (voterId === targetId) return fail('CANNOT_VOTE_OWN_TEAM');
  if (state.voting.votes.some((v) => v.voterId === voterId)) return fail('ALREADY_VOTED');
  const next = clone(state);
  next.voting!.votes.push({ voterId, voterKind: voter.kind, targetId, at: ctx.now });
  const events: GameEvent[] = [{ type: 'vote_cast', voterKind: voter.kind, voterId }];
  if (next.voting!.mode === 'participants' && next.participants.every((p) => next.voting!.votes.some((v) => v.voterId === p.id))) {
    finishGame(next, ctx, events);
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

/**
 * Twitch chat votes, applied in batches. `team` is the team number shown on
 * screen (seat order, 1-based). Spectator mode: each chatter counts as one
 * spectator vote. Participant mode: chat cheers are tallied apart and never
 * change the result.
 */
export function applyChatVotes(state: RoomState, votes: { user: string; team: number }[], ctx: EngineCtx): Outcome {
  if (state.status !== 'voting' || !state.voting || ctx.now >= state.voting.endsAt) return { ok: true, state, events: [] };
  const bySeat = [...state.participants].sort((a, b) => a.seat - b.seat);
  const next = clone(state);
  const v = next.voting!;
  const events: GameEvent[] = [];
  for (const { user, team } of votes) {
    const target = bySeat[team - 1];
    if (!target) continue;
    const voterId = `twitch:${user.toLowerCase()}`;
    if (v.mode === 'spectators') {
      if (v.votes.some((x) => x.voterId === voterId)) continue;
      v.votes.push({ voterId, voterKind: 'spectator', targetId: target.id, at: ctx.now });
      events.push({ type: 'vote_cast', voterKind: 'spectator', voterId });
    } else {
      v.chat ??= { counts: {}, voters: [] };
      if (v.chat.voters.includes(voterId)) continue;
      v.chat.voters.push(voterId);
      v.chat.counts[target.id] = (v.chat.counts[target.id] ?? 0) + 1;
    }
  }
  if (next.voting!.votes.length === state.voting.votes.length && JSON.stringify(v.chat) === JSON.stringify(state.voting.chat)) {
    return { ok: true, state, events: [] };
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

export function closeVoting(state: RoomState, byId: string, ctx: EngineCtx): Outcome {
  if (state.status !== 'voting') return fail('VOTE_CLOSED');
  const p = teamOfMember(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  if (!p.isHost) return fail('NOT_HOST');
  const next = clone(state);
  const events: GameEvent[] = [];
  finishGame(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

/* ------------------------------------------------------------------ */
/* Rematch                                                             */
/* ------------------------------------------------------------------ */

/**
 * Host starts the next game of a series: same teams and settings, empty
 * squads, full budgets. Series points are kept (see finishGame).
 */
export function rematch(state: RoomState, byId: string, ctx: EngineCtx): Outcome {
  const p = teamOfMember(state, byId);
  if (!p) return fail('NOT_IN_ROOM');
  if (!p.isHost) return fail('NOT_HOST');
  if (state.status !== 'finished') return fail('WRONG_PHASE');
  const next = clone(state);
  const formation = getFormation(ctx.pack, next.settings.formationId);
  for (const t of next.participants) {
    t.budget = next.settings.budget;
    t.team = emptyTeam(formation, next.settings.benchSize);
    delete t.jokers;
  }
  next.status = 'lobby';
  next.pool = [];
  next.unsold = [];
  next.auctionCount = 0;
  next.auction = null;
  next.history = [];
  next.voting = null;
  next.result = null;
  next.mercato = null;
  const round = (next.series?.round ?? 1) + 1;
  next.series = { round, standings: next.series?.standings ?? {} };
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'rematch_started', round }] };
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
  if (state.status === 'mercato' && state.mercato) return state.mercato.endsAt;
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
    } else if (next.status === 'mercato') {
      endMercato(next, ctx, events);
    } else if (next.status === 'voting') {
      finishGame(next, ctx, events);
    }
  }
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}
