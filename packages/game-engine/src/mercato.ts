/**
 * Post-draft mercato: a timed window in which teams trade players
 * (one player each, plus optional cash) or sell a player back to the bank.
 * Ends when every human team is ready or the timer runs out.
 */
import type { GameEvent, Participant, RoomState, SlotRef, Team } from '@byt/shared';
import { bump, clone, fail, findParticipant, teamOfMember, type EngineCtx, type Outcome } from './context';
import { beginConclusion } from './finish';
import { compatibility, getCharacter, getFormation } from './team';

export function startMercato(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  const endsAt = ctx.now + (state.settings.mercatoTimerSec ?? 90) * 1000;
  state.status = 'mercato';
  state.mercato = { startedAt: ctx.now, endsAt, offers: [], ready: [], sales: [] };
  events.push({ type: 'mercato_started', endsAt });
}

export function endMercato(state: RoomState, ctx: EngineCtx, events: GameEvent[]): void {
  for (const o of state.mercato?.offers ?? []) if (o.status === 'pending') o.status = 'cancelled';
  beginConclusion(state, ctx, events);
}

export function locate(team: Team, characterId: string): SlotRef | null {
  const s = team.starters.indexOf(characterId);
  if (s >= 0) return { kind: 'starter', index: s };
  const b = team.bench.indexOf(characterId);
  return b >= 0 ? { kind: 'bench', index: b } : null;
}

function setSlot(team: Team, slot: SlotRef, id: string | null): void {
  if (slot.kind === 'starter') team.starters[slot.index] = id;
  else team.bench[slot.index] = id;
}

function fits(ctx: EngineCtx, team: Team, slot: SlotRef, characterId: string): boolean {
  if (slot.kind === 'bench') return true;
  return compatibility(ctx.pack, getCharacter(ctx.pack, characterId), getFormation(ctx.pack, team.formationId).slots[slot.index]!) > 0;
}

/** Moves the purchase record of a character from one team to another. */
function movePurchase(from: Participant, to: Participant, characterId: string): void {
  const i = from.team.purchases.findIndex((p) => p.characterId === characterId);
  const price = i >= 0 ? from.team.purchases[i]!.price : 0;
  if (i >= 0) from.team.purchases.splice(i, 1);
  to.team.purchases.push({ characterId, price, auctionNo: null, kind: 'trade' });
}

function mercatoActor(state: RoomState, memberId: string) {
  if (state.status !== 'mercato' || !state.mercato) return fail('WRONG_PHASE');
  const team = teamOfMember(state, memberId);
  if (!team) return fail('NOT_IN_ROOM');
  return { team, mercato: state.mercato };
}

export function offerTrade(
  state: RoomState,
  byId: string,
  input: { toId: string; give: string; take: string; cash: number },
  ctx: EngineCtx,
): Outcome {
  const a = mercatoActor(state, byId);
  if ('ok' in a) return a;
  const { team, mercato } = a;
  const to = findParticipant(state, input.toId);
  if (!to || to.id === team.id) return fail('UNKNOWN_TARGET');
  if (!locate(team.team, input.give) || !locate(to.team, input.take)) return fail('NOT_OWNER');
  if (input.cash > team.budget) return fail('NOT_ENOUGH_BUDGET');
  if (mercato.offers.some((o) => o.status === 'pending' && o.fromId === team.id && o.toId === to.id)) return fail('ALREADY_OFFERED');
  const next = clone(state);
  const id = `${state.code}-O${mercato.offers.length + 1}`;
  next.mercato!.offers.push({ id, fromId: team.id, toId: to.id, give: input.give, take: input.take, cash: input.cash, status: 'pending', at: ctx.now });
  next.mercato!.ready = next.mercato!.ready.filter((x) => x !== to.id);
  bump(next, ctx.now);
  return { ok: true, state: next, events: [{ type: 'trade_offered', offerId: id, fromId: team.id, toId: to.id }] };
}

/** The receiver accepts or declines; the sender may cancel (accept = false). */
export function respondTrade(state: RoomState, byId: string, input: { offerId: string; accept: boolean }, ctx: EngineCtx): Outcome {
  const a = mercatoActor(state, byId);
  if ('ok' in a) return a;
  const { team, mercato } = a;
  const offer = mercato.offers.find((o) => o.id === input.offerId);
  if (!offer) return fail('UNKNOWN_TARGET');
  if (offer.status !== 'pending') return fail('OFFER_NOT_PENDING');
  const isReceiver = offer.toId === team.id;
  if (!isReceiver && !(offer.fromId === team.id && !input.accept)) return fail('NOT_OWNER');
  const next = clone(state);
  const o = next.mercato!.offers.find((x) => x.id === offer.id)!;
  if (!input.accept) {
    o.status = isReceiver ? 'declined' : 'cancelled';
    bump(next, ctx.now);
    return { ok: true, state: next, events: [{ type: 'trade_resolved', offerId: o.id, accepted: false }] };
  }
  const from = findParticipant(next, o.fromId)!;
  const to = findParticipant(next, o.toId)!;
  const sFrom = locate(from.team, o.give);
  const sTo = locate(to.team, o.take);
  if (!sFrom || !sTo) return fail('NOT_OWNER');
  if (o.cash > from.budget) return fail('NOT_ENOUGH_BUDGET');
  if (!fits(ctx, from.team, sFrom, o.take) || !fits(ctx, to.team, sTo, o.give)) return fail('INCOMPATIBLE_SLOT');
  setSlot(from.team, sFrom, o.take);
  setSlot(to.team, sTo, o.give);
  movePurchase(from, to, o.give);
  movePurchase(to, from, o.take);
  from.budget -= o.cash;
  to.budget += o.cash;
  o.status = 'accepted';
  // Other pending offers involving either player are void.
  for (const x of next.mercato!.offers) {
    if (x.status === 'pending' && [o.give, o.take].some((id) => id === x.give || id === x.take)) x.status = 'cancelled';
  }
  bump(next, ctx.now);
  return {
    ok: true,
    state: next,
    events: [
      { type: 'trade_resolved', offerId: o.id, accepted: true },
      { type: 'team_changed', participantId: from.id },
      { type: 'team_changed', participantId: to.id },
    ],
  };
}

/**
 * Sell a player back to the bank for half its price. A starter is replaced
 * by the lowest-rated compatible free agent at the reserve price.
 */
export function sellToBank(state: RoomState, byId: string, input: { characterId: string }, ctx: EngineCtx): Outcome {
  const a = mercatoActor(state, byId);
  if ('ok' in a) return a;
  const slot = locate(a.team.team, input.characterId);
  if (!slot) return fail('NOT_OWNER');
  const next = clone(state);
  const t = findParticipant(next, a.team.id)!;
  const purchase = t.team.purchases.find((p) => p.characterId === input.characterId);
  const price = Math.floor((purchase?.price ?? next.settings.reservePrice) / 2);
  const events: GameEvent[] = [];
  if (slot.kind === 'starter') {
    const formationSlot = getFormation(ctx.pack, t.team.formationId).slots[slot.index]!;
    const replacement = [...next.pool, ...next.unsold]
      .map((id) => getCharacter(ctx.pack, id))
      .filter((c) => compatibility(ctx.pack, c, formationSlot) > 0)
      .sort((x, y) => x.overall - y.overall || x.id.localeCompare(y.id))[0];
    if (!replacement || t.budget + price < next.settings.reservePrice) return fail('INCOMPATIBLE_SLOT');
    next.pool = next.pool.filter((id) => id !== replacement.id);
    next.unsold = next.unsold.filter((id) => id !== replacement.id);
    setSlot(t.team, slot, replacement.id);
    t.budget -= next.settings.reservePrice;
    t.team.purchases.push({ characterId: replacement.id, price: next.settings.reservePrice, auctionNo: null, kind: 'free_agent' });
    events.push({ type: 'free_agent_assigned', participantId: t.id, characterId: replacement.id, price: next.settings.reservePrice });
  } else {
    setSlot(t.team, slot, null);
  }
  t.team.purchases = t.team.purchases.filter((p) => p.characterId !== input.characterId);
  t.budget += price;
  next.unsold.push(input.characterId);
  next.mercato!.sales.push({ participantId: t.id, characterId: input.characterId, price });
  for (const x of next.mercato!.offers) {
    if (x.status === 'pending' && (x.give === input.characterId || x.take === input.characterId)) x.status = 'cancelled';
  }
  events.unshift({ type: 'player_sold_to_bank', participantId: t.id, characterId: input.characterId, price });
  events.push({ type: 'team_changed', participantId: t.id });
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}

/** Mark the team ready. When every human team is ready the mercato ends. */
export function setMercatoReady(state: RoomState, byId: string, ctx: EngineCtx): Outcome {
  const a = mercatoActor(state, byId);
  if ('ok' in a) return a;
  if (a.mercato.ready.includes(a.team.id)) return { ok: true, state, events: [] };
  const next = clone(state);
  next.mercato!.ready.push(a.team.id);
  const events: GameEvent[] = [{ type: 'team_changed', participantId: a.team.id }];
  if (next.participants.every((p) => p.bot || next.mercato!.ready.includes(p.id))) endMercato(next, ctx, events);
  bump(next, ctx.now);
  return { ok: true, state: next, events };
}
