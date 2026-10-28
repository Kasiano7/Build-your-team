/**
 * Computer-controlled teams. `decideBot` is pure: given the state and a random
 * source it returns the bot's next action, or null when it has nothing to do
 * right now. The server applies the action through the normal engine
 * commands, so bots obey exactly the same rules as people.
 *
 * Valuation: a fair share of the remaining budget per open starter slot,
 * scaled by the player's rating (in Mystery mode the bot does not see it and
 * uses the pack average), then by the bot level.
 */
import type { BotLevel, Character, ContentPack, Participant, RoomState } from '@byt/shared';
import { findParticipant, opts } from './context';
import { dutchPrice, minimumNextBid } from './engine';
import { getCharacter, maxBidFor, needsCharacter, openStarterCount, teamRating } from './team';

export type BotAction =
  | { type: 'bid'; amount: number }
  | { type: 'claim' }
  | { type: 'seal'; amount: number }
  | { type: 'pass' }
  | { type: 'halfPrice' }
  | { type: 'vote'; targetId: string }
  | { type: 'respond'; offerId: string; accept: boolean }
  | { type: 'ready' };

const LEVEL: Record<BotLevel, { mul: number; noise: number }> = {
  easy: { mul: 0.75, noise: 0.25 },
  normal: { mul: 0.95, noise: 0.12 },
  hard: { mul: 1.05, noise: 0.06 },
};

const averageCache = new WeakMap<ContentPack, number>();
function packAverage(pack: ContentPack): number {
  let avg = averageCache.get(pack);
  if (avg === undefined) {
    avg = pack.characters.reduce((s, c) => s + c.overall, 0) / Math.max(1, pack.characters.length);
    averageCache.set(pack, avg);
  }
  return avg;
}

/** Highest price this bot is willing to pay for `c` (0 = not interested). */
export function botValuation(state: RoomState, pack: ContentPack, bot: Participant, c: Character, rand: () => number): number {
  if (!needsCharacter(pack, bot.team, c)) return 0;
  const max = maxBidFor(pack, state.settings, bot, c);
  const open = openStarterCount(bot.team);
  const level = LEVEL[bot.bot?.level ?? 'normal'];
  if (open <= 1 && bot.bot?.level === 'hard') return max;
  const ovr = opts(state.settings).mystery ? packAverage(pack) : c.overall;
  const quality = Math.min(2.6, Math.max(0.3, 0.6 + (ovr - 70) / 12));
  const noise = 1 + (rand() * 2 - 1) * level.noise;
  const fair = bot.budget / Math.max(1, open);
  return Math.min(max, Math.round(fair * quality * level.mul * noise));
}

export function decideBot(state: RoomState, pack: ContentPack, botId: string, now: number, rand: () => number): BotAction | null {
  const bot = findParticipant(state, botId);
  if (!bot?.bot) return null;

  if (state.status === 'drafting' && state.auction) {
    const a = state.auction;
    const c = getCharacter(pack, a.characterId);
    if (
      a.stage === 'reveal' &&
      bot.jokers?.halfPrice &&
      bot.bot.level !== 'easy' &&
      !opts(state.settings).mystery &&
      c.overall >= 87 &&
      needsCharacter(pack, bot.team, c)
    ) {
      return { type: 'halfPrice' };
    }
    if (a.stage !== 'open' || a.endsAt === null || now >= a.endsAt) return null;
    if (!a.eligible.includes(bot.id) || a.passed.includes(bot.id)) return null;
    const value = botValuation(state, pack, bot, c, rand);
    if (a.style === 'sealed') {
      if (a.bids.some((b) => b.participantId === bot.id)) return null;
      if (value < state.settings.reservePrice) return { type: 'pass' };
      const step = state.settings.minIncrement;
      const offer = Math.max(state.settings.reservePrice, Math.floor((value * (0.75 + rand() * 0.2)) / step) * step);
      return { type: 'seal', amount: Math.min(offer, maxBidFor(pack, state.settings, bot, c)) };
    }
    if (a.style === 'dutch') {
      const price = dutchPrice(a, now);
      if (price <= value) return { type: 'claim' };
      return a.dutch && price <= a.dutch.floor ? { type: 'pass' } : null;
    }
    if (a.highBid?.participantId === bot.id) return null;
    const min = minimumNextBid(state);
    if (min > value) return { type: 'pass' };
    // Sometimes jump one extra increment to look less mechanical.
    const jump = rand() < 0.2 && min + state.settings.minIncrement <= value ? state.settings.minIncrement : 0;
    return { type: 'bid', amount: min + jump };
  }

  if (state.status === 'voting' && state.voting?.mode === 'participants') {
    if (state.voting.votes.some((v) => v.voterId === bot.id)) return null;
    const others = state.participants.filter((p) => p.id !== bot.id);
    const noise = LEVEL[bot.bot.level].noise * 20;
    const scored = others.map((p) => ({ id: p.id, s: teamRating(pack, p.team) + rand() * noise }));
    scored.sort((x, y) => y.s - x.s);
    return scored[0] ? { type: 'vote', targetId: scored[0].id } : null;
  }

  if (state.status === 'mercato' && state.mercato) {
    const offer = state.mercato.offers.find((o) => o.status === 'pending' && o.toId === bot.id);
    if (offer) {
      const gain = getCharacter(pack, offer.give).overall - getCharacter(pack, offer.take).overall;
      return { type: 'respond', offerId: offer.id, accept: gain * 15 + offer.cash > 0 };
    }
    if (!state.mercato.ready.includes(bot.id)) return { type: 'ready' };
  }
  return null;
}
