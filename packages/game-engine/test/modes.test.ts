import { describe, expect, it } from 'vitest';
import { footballRealPack as pack } from '@byt/football';
import { basketballRealPack } from '@byt/basketball';
import type { ContentPack, RoomState } from '@byt/shared';
import {
  addBot,
  addParticipant,
  advance,
  applyChatVotes,
  buildSettings,
  castVote,
  claimAuction,
  closeVoting,
  createRoomState,
  decideBot,
  dutchPrice,
  getCharacter,
  kickParticipant,
  memberIdsOf,
  nextDeadline,
  nextRandom,
  offerTrade,
  passAuction,
  placeBid,
  rematch,
  removeParticipant,
  respondTrade,
  sealBid,
  sellToBank,
  setConnected,
  setMercatoReady,
  simulate,
  startGame,
  stealPrice,
  themeShortfall,
  toRoomView,
  useHalfPrice,
  useSteal,
  useVeto,
  type BotAction,
  type Outcome,
  type SettingsInput,
} from '../src';

let clock = 1_000_000;
const ctxOf = (p: ContentPack = pack) => ({ pack: p, now: clock });

function unwrap(o: Outcome): RoomState {
  if (!o.ok) throw new Error(`Expected ok, got ${o.code} ${JSON.stringify(o.details ?? {})}`);
  return o.state;
}
const code = (o: Outcome) => (o.ok ? 'ok' : o.code);

function room(players: number, extra: Partial<SettingsInput> = {}, p: ContentPack = pack, seed = 42): RoomState {
  clock = 1_000_000;
  const settings = buildSettings(p, { mode: 'quick', maxParticipants: 4, ...extra });
  let s = createRoomState({ code: 'MODES1', settings, host: { id: 'p1', nickname: 'Alice' }, seed, ctx: ctxOf(p) });
  for (let i = 2; i <= players; i++) s = unwrap(addParticipant(s, `p${i}`, `Joueur ${i}`, ctxOf(p)));
  return s;
}

function tick(s: RoomState, p: ContentPack = pack): RoomState {
  const d = nextDeadline(s);
  if (d === null) throw new Error('no deadline');
  clock = Math.max(clock, d);
  return unwrap(advance(s, ctxOf(p)));
}

function open(s: RoomState): RoomState {
  while (s.auction?.stage !== 'open') s = tick(s);
  return s;
}

function rng(seed: number) {
  let st = seed;
  return () => {
    const r = nextRandom(st);
    st = r.state;
    return r.value;
  };
}

/** Plays every bot action available, then advances the clock, until `until` holds. */
function playBots(s: RoomState, until: (s: RoomState) => boolean, p: ContentPack = pack, maxSteps = 6000): RoomState {
  const rand = rng(7);
  for (let i = 0; i < maxSteps && !until(s); i++) {
    let acted = false;
    for (const bot of s.participants.filter((x) => x.bot)) {
      const a = decideBot(s, p, bot.id, clock, rand);
      if (!a) continue;
      const r = applyBot(s, bot.id, a, p);
      if (r.ok && r.state !== s) {
        s = r.state;
        acted = true;
        break;
      }
    }
    if (!acted) {
      if (s.auction?.stage === 'open' && s.auction.style === 'dutch') clock += s.auction.dutch?.stepMs ?? 500;
      const d = nextDeadline(s);
      if (d === null) break;
      if (s.auction?.style !== 'dutch' || s.auction.stage !== 'open') clock = Math.max(clock, d);
      s = unwrap(advance(s, ctxOf(p)));
    }
  }
  return s;
}

function applyBot(s: RoomState, id: string, a: BotAction, p: ContentPack): Outcome {
  const c = ctxOf(p);
  const auctionId = s.auction?.id ?? '';
  switch (a.type) {
    case 'bid':
      return placeBid(s, id, { auctionId, amount: a.amount, bidId: `b${clock}${id}` }, c);
    case 'claim':
      return claimAuction(s, id, { auctionId, bidId: `c${clock}${id}` }, c);
    case 'seal':
      return sealBid(s, id, { auctionId, amount: a.amount, bidId: `s${clock}${id}` }, c);
    case 'pass':
      return passAuction(s, id, { auctionId }, c);
    case 'halfPrice':
      return useHalfPrice(s, id, { auctionId }, c);
    case 'vote':
      return castVote(s, { id, kind: 'participant' }, a.targetId, c);
    case 'respond':
      return respondTrade(s, id, { offerId: a.offerId, accept: a.accept }, c);
    case 'ready':
      return setMercatoReady(s, id, c);
  }
}

describe('options and Éclair pace', () => {
  it('defaults keep the classic game; Éclair shortens timers and transitions', () => {
    const normal = room(2);
    expect(normal.settings.auctionStyle).toBe('english');
    expect(normal.settings.endMode).toBe('vote');
    const eclair = room(2, { pace: 'eclair' });
    expect(eclair.settings.openingTimerSec).toBe(8);
    expect(eclair.settings.bidResetSec).toBe(6);
    const s = unwrap(startGame(eclair, 'p1', ctxOf()));
    expect(s.auction!.revealEndsAt - clock).toBe(700);
  });
});

describe('thematic drafts', () => {
  it('only themed players are drawn', () => {
    let s = unwrap(startGame(room(2, { themeId: 'elite' }), 'p1', ctxOf()));
    expect(s.pool.every((id) => getCharacter(pack, id).overall >= 85)).toBe(true);
    s = playBots(s, (x) => x.status !== 'drafting');
    for (const t of s.participants) for (const id of t.team.starters) expect(getCharacter(pack, id!).overall).toBeGreaterThanOrEqual(85);
  });

  it('refuses a theme with too few players for the number of teams', () => {
    const s = room(4, { themeId: 'ameriques' });
    const r = startGame(s, 'p1', ctxOf());
    expect(code(r)).toBe('THEME_TOO_SMALL');
    expect(code(startGame(room(2, { themeId: 'ameriques' }), 'p1', ctxOf()))).toBe('ok');
  });

  it('every theme of every real-player pack can be played by at least 2 teams', async () => {
    const { rugbyRealPack } = await import('@byt/rugby');
    for (const p of [pack, basketballRealPack, rugbyRealPack]) {
      expect(p.themes!.length).toBeGreaterThan(2);
      for (const t of p.themes!) {
        const playable = p.modes.some((m) => themeShortfall(p, m.id, t.id, 2).length === 0);
        expect(playable, `${p.id} ${t.id}`).toBe(true);
      }
    }
  });

  it('an unknown theme is ignored', () => {
    expect(room(2, { themeId: 'nope' }).settings.themeId).toBeNull();
  });
});

describe('Mystery', () => {
  it('hides rating and stats of the player on the block until the auction closes', () => {
    let s = open(unwrap(startGame(room(2, { mystery: true }), 'p1', ctxOf())));
    const id = s.auction!.characterId;
    const v = toRoomView(s, pack, clock).characters[id]!;
    expect(v.masked).toBe(true);
    expect(v.overall).toBe(0);
    expect(v.attributes).toEqual({});
    expect(v.name).toBe(getCharacter(pack, id).name);
    s = unwrap(placeBid(s, 'p1', { auctionId: s.auction!.id, amount: 10, bidId: 'b1' }, ctxOf()));
    s = tick(s);
    expect(toRoomView(s, pack, clock).characters[id]!.overall).toBe(getCharacter(pack, id).overall);
  });
});

describe('sealed auction', () => {
  it('keeps offers secret, highest wins, closes once everyone has decided', () => {
    let s = open(unwrap(startGame(room(3, { auctionStyle: 'sealed' }), 'p1', ctxOf())));
    const auctionId = s.auction!.id;
    expect(code(placeBid(s, 'p1', { auctionId, amount: 10, bidId: 'x' }, ctxOf()))).toBe('WRONG_AUCTION_STYLE');
    s = unwrap(sealBid(s, 'p1', { auctionId, amount: 40, bidId: 's1' }, ctxOf()));
    expect(code(sealBid(s, 'p1', { auctionId, amount: 50, bidId: 's1b' }, ctxOf()))).toBe('ALREADY_OFFERED');
    clock += 100;
    s = unwrap(sealBid(s, 'p2', { auctionId, amount: 60, bidId: 's2' }, ctxOf()));
    const view = toRoomView(s, pack, clock);
    expect(view.auction!.bids.map((b) => b.amount)).toEqual([0, 0]);
    expect(view.auction!.highBid).toBeNull();
    expect(s.auction!.stage).toBe('open');
    s = unwrap(passAuction(s, 'p3', { auctionId }, ctxOf()));
    expect(s.auction!.stage).toBe('closed');
    expect(s.auction!.result).toMatchObject({ type: 'sold', participantId: 'p2', amount: 60 });
    expect(toRoomView(s, pack, clock).auction!.bids.map((b) => b.amount)).toEqual([40, 60]);
  });

  it('a tie goes to the earliest offer', () => {
    let s = open(unwrap(startGame(room(2, { auctionStyle: 'sealed' }), 'p1', ctxOf())));
    const auctionId = s.auction!.id;
    s = unwrap(sealBid(s, 'p2', { auctionId, amount: 30, bidId: 's2' }, ctxOf()));
    clock += 50;
    s = unwrap(sealBid(s, 'p1', { auctionId, amount: 30, bidId: 's1' }, ctxOf()));
    expect(s.auction!.result).toMatchObject({ type: 'sold', participantId: 'p2' });
  });
});

describe('dutch auction', () => {
  it('price drops step by step to the reserve; first claim wins at the current price', () => {
    let s = open(unwrap(startGame(room(3, { auctionStyle: 'dutch' }), 'p1', ctxOf())));
    const a = s.auction!;
    expect(a.dutch!.startPrice).toBeGreaterThan(a.dutch!.floor);
    expect(dutchPrice(a, a.dutch!.openedAt)).toBe(a.dutch!.startPrice);
    expect(dutchPrice(a, a.dutch!.openedAt + a.dutch!.stepMs * 2)).toBe(Math.max(a.dutch!.floor, a.dutch!.startPrice - 2 * a.dutch!.step));
    expect(dutchPrice(a, a.endsAt! - 1)).toBe(a.dutch!.floor);
    clock = a.dutch!.openedAt + a.dutch!.stepMs * 3 + 10;
    const expected = dutchPrice(a, clock);
    s = unwrap(claimAuction(s, 'p2', { auctionId: a.id, bidId: 'c1' }, ctxOf()));
    expect(s.auction!.result).toMatchObject({ type: 'sold', participantId: 'p2', amount: expected });
  });

  it('unsold when everybody passes', () => {
    let s = open(unwrap(startGame(room(2, { auctionStyle: 'dutch' }), 'p1', ctxOf())));
    const auctionId = s.auction!.id;
    s = unwrap(passAuction(s, 'p1', { auctionId }, ctxOf()));
    s = unwrap(passAuction(s, 'p2', { auctionId }, ctxOf()));
    expect(s.auction!.result).toEqual({ type: 'unsold' });
  });
});

describe('jokers', () => {
  it('are refused when the option is off', () => {
    const s = open(unwrap(startGame(room(2), 'p1', ctxOf())));
    expect(code(useVeto(s, 'p1', { auctionId: s.auction!.id }, ctxOf()))).toBe('JOKERS_DISABLED');
  });

  it('veto removes the player before any bid, once', () => {
    let s = unwrap(startGame(room(2, { jokers: true }), 'p1', ctxOf()));
    const id = s.auction!.characterId;
    s = unwrap(useVeto(s, 'p1', { auctionId: s.auction!.id }, ctxOf()));
    expect(s.auction!.result).toEqual({ type: 'vetoed', participantId: 'p1' });
    expect(s.unsold).not.toContain(id);
    expect(s.pool).not.toContain(id);
    s = open(tick(s));
    expect(code(useVeto(s, 'p1', { auctionId: s.auction!.id }, ctxOf()))).toBe('JOKER_USED');
    s = unwrap(placeBid(s, 'p1', { auctionId: s.auction!.id, amount: 10, bidId: 'b' }, ctxOf()));
    expect(code(useVeto(s, 'p2', { auctionId: s.auction!.id }, ctxOf()))).toBe('AUCTION_NOT_OPEN');
  });

  it('half price: the winner pays half of the winning bid', () => {
    let s = open(unwrap(startGame(room(2, { jokers: true }), 'p1', ctxOf())));
    const auctionId = s.auction!.id;
    s = unwrap(useHalfPrice(s, 'p2', { auctionId }, ctxOf()));
    s = unwrap(placeBid(s, 'p2', { auctionId, amount: 50, bidId: 'b' }, ctxOf()));
    s = unwrap(passAuction(s, 'p1', { auctionId }, ctxOf()));
    expect(s.auction!.result).toMatchObject({ type: 'sold', participantId: 'p2', amount: 25, halfPrice: true });
    expect(s.participants[1]!.budget).toBe(s.settings.budget - 25);
  });

  it('steal: thief pays 1.5×, the victim is refunded and loses the player', () => {
    let s = open(unwrap(startGame(room(2, { jokers: true }), 'p1', ctxOf())));
    const auctionId = s.auction!.id;
    const cid = s.auction!.characterId;
    s = unwrap(placeBid(s, 'p2', { auctionId, amount: 40, bidId: 'b' }, ctxOf()));
    s = unwrap(passAuction(s, 'p1', { auctionId }, ctxOf()));
    const victimBudget = s.participants[1]!.budget;
    const { price, refund } = stealPrice(s, s.participants[1]!, cid);
    expect(price).toBe(60);
    expect(refund).toBe(40);
    s = unwrap(useSteal(s, 'p1', { targetId: 'p2', characterId: cid }, ctxOf()));
    expect(s.participants[0]!.team.starters).toContain(cid);
    expect(s.participants[1]!.team.starters).not.toContain(cid);
    expect(s.participants[0]!.budget).toBe(s.settings.budget - 60);
    expect(s.participants[1]!.budget).toBe(victimBudget + 40);
    expect(code(useSteal(s, 'p1', { targetId: 'p2', characterId: cid }, ctxOf()))).toBe('JOKER_USED');
  });
});

describe('duo format', () => {
  it('pairs players into teams, one vote per team, either member acts', () => {
    clock = 1_000_000;
    const settings = buildSettings(pack, { mode: 'quick', maxParticipants: 3, format: 'duo' });
    let s = createRoomState({ code: 'DUOXXX', settings, host: { id: 'm1', nickname: 'Alice' }, seed: 3, ctx: ctxOf() });
    s = unwrap(addParticipant(s, 'm2', 'Bob', ctxOf(), 'm1'));
    s = unwrap(addParticipant(s, 'm3', 'Chloé', ctxOf()));
    s = unwrap(addParticipant(s, 'm4', 'Driss', ctxOf()));
    s = unwrap(addParticipant(s, 'm5', 'Emma', ctxOf()));
    // Room full of teams: the next person joins a team with a free place.
    s = unwrap(addParticipant(s, 'm6', 'Farid', ctxOf()));
    expect(s.participants).toHaveLength(3);
    expect(s.participants[0]!.nickname).toBe('Alice & Bob');
    expect(s.participants.map((p) => p.members!.length)).toEqual([2, 2, 2]);
    expect(code(addParticipant(s, 'm7', 'Gaby', ctxOf()))).toBe('ROOM_FULL');
    expect(memberIdsOf(s, 'm1')).toEqual(['m1', 'm2']);
    // Partner disconnects: team still online.
    s = unwrap(setConnected(s, 'm2', false, ctxOf()));
    expect(s.participants[0]!.connected).toBe(true);
    // The partner (not the creator) may start the game: host rights belong to the team.
    s = open(unwrap(startGame(s, 'm2', ctxOf())));
    s = unwrap(placeBid(s, 'm2', { auctionId: s.auction!.id, amount: 10, bidId: 'b' }, ctxOf()));
    expect(s.auction!.highBid!.participantId).toBe('m1');
    expect(code(placeBid(s, 'm1', { auctionId: s.auction!.id, amount: 20, bidId: 'b2' }, ctxOf()))).toBe('ALREADY_HIGHEST');
  });

  it('a member leaving the lobby keeps the team', () => {
    clock = 1_000_000;
    let s = createRoomState({ code: 'DUOXXY', settings: buildSettings(pack, { mode: 'quick', maxParticipants: 2, format: 'duo' }), host: { id: 'm1', nickname: 'Alice' }, seed: 3, ctx: ctxOf() });
    s = unwrap(addParticipant(s, 'm2', 'Bob', ctxOf(), 'm1'));
    s = unwrap(removeParticipant(s, 'm1', ctxOf()));
    expect(s.participants).toHaveLength(1);
    expect(s.participants[0]!.nickname).toBe('Bob');
    expect(s.participants[0]!.isHost).toBe(true);
  });
});

describe('bots', () => {
  it('host adds bots; a full game plays with bots only obeying the rules', () => {
    let s = room(1, { mode: 'classic' });
    expect(code(addBot(s, 'p2', { id: 'b1', nickname: 'Robo', level: 'easy' }, ctxOf()))).toBe('NOT_IN_ROOM');
    s = unwrap(addBot(s, 'p1', { id: 'b1', nickname: 'Robo', level: 'easy' }, ctxOf()));
    s = unwrap(addBot(s, 'p1', { id: 'b2', nickname: 'Robo', level: 'normal' }, ctxOf()));
    s = unwrap(addBot(s, 'p1', { id: 'b3', nickname: 'Robo', level: 'hard' }, ctxOf()));
    expect(s.participants.map((p) => p.nickname)).toEqual(['Alice', 'Robo', 'Robo 2', 'Robo 3']);
    expect(code(addBot(s, 'p1', { id: 'b4', nickname: 'X', level: 'hard' }, ctxOf()))).toBe('ROOM_FULL');
    s = unwrap(kickParticipant(s, 'p1', 'b3', ctxOf()));
    s = unwrap(addBot(s, 'p1', { id: 'b3', nickname: 'Robo', level: 'hard' }, ctxOf()));
    s = unwrap(startGame(s, 'p1', ctxOf()));
    s = playBots(s, (x) => x.status !== 'drafting');
    expect(s.status).toBe('voting');
    const bought = s.participants.filter((p) => p.bot).flatMap((p) => p.team.purchases.filter((x) => x.kind === 'auction'));
    expect(bought.length).toBeGreaterThan(10);
    for (const p of s.participants) {
      expect(p.budget).toBeGreaterThanOrEqual(0);
      expect(p.team.starters.every(Boolean)).toBe(true);
    }
    // Bots vote for another team; the human vote completes the round.
    s = playBots(s, (x) => x.voting!.votes.length >= 3);
    expect(s.voting!.votes.every((v) => v.voterId !== v.targetId)).toBe(true);
    s = unwrap(castVote(s, { id: 'p1', kind: 'participant' }, 'b2', ctxOf()));
    expect(s.status).toBe('finished');
  });

  it('bots play sealed and dutch auctions too', () => {
    for (const auctionStyle of ['sealed', 'dutch'] as const) {
      let s = room(1, { auctionStyle });
      s = unwrap(addBot(s, 'p1', { id: 'b1', nickname: 'Robo', level: 'normal' }, ctxOf()));
      s = unwrap(addBot(s, 'p1', { id: 'b2', nickname: 'Robo', level: 'hard' }, ctxOf()));
      s = playBots(unwrap(startGame(s, 'p1', ctxOf())), (x) => x.status !== 'drafting');
      expect(s.status).toBe('voting');
      const sold = s.history.filter((h) => h.result.type === 'sold' && s.participants.find((p) => p.id === (h.result as { participantId: string }).participantId)?.bot);
      expect(sold.length).toBeGreaterThan(3);
    }
  });

  it('Mystery: bots do not use the hidden rating', () => {
    let s = room(1, { mystery: true });
    s = unwrap(addBot(s, 'p1', { id: 'b1', nickname: 'Robo', level: 'hard' }, ctxOf()));
    s = open(unwrap(startGame(s, 'p1', ctxOf())));
    const a = decideBot(s, pack, 'b1', clock, () => 0.5);
    const b = decideBot({ ...s, settings: { ...s.settings, mystery: false } }, pack, 'b1', clock, () => 0.5);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });
});

describe('mercato', () => {
  function toMercato(players = 2): RoomState {
    let s = room(players, { mercato: true });
    s = unwrap(startGame(s, 'p1', ctxOf()));
    while (s.status === 'drafting') s = tick(s);
    return s;
  }

  it('opens after the draft with a timer, then the vote', () => {
    const s = toMercato();
    expect(s.status).toBe('mercato');
    expect(s.mercato!.endsAt).toBe(clock + 90_000);
    const v = tick(s);
    expect(v.status).toBe('voting');
  });

  it('trade: offer, accept, players and cash swap; stale offers are cancelled', () => {
    let s = toMercato();
    const a = s.participants[0]!;
    const b = s.participants[1]!;
    const give = a.team.starters[4]!;
    const take = b.team.starters[4]!;
    expect(code(offerTrade(s, 'p1', { toId: 'p2', give: take, take: give, cash: 0 }, ctxOf()))).toBe('NOT_OWNER');
    expect(code(offerTrade(s, 'p1', { toId: 'p2', give, take, cash: 99999 }, ctxOf()))).toBe('NOT_ENOUGH_BUDGET');
    s = unwrap(offerTrade(s, 'p1', { toId: 'p2', give, take, cash: 0 }, ctxOf()));
    expect(code(offerTrade(s, 'p1', { toId: 'p2', give, take, cash: 0 }, ctxOf()))).toBe('ALREADY_OFFERED');
    const offerId = s.mercato!.offers[0]!.id;
    expect(code(respondTrade(s, 'p1', { offerId, accept: true }, ctxOf()))).toBe('NOT_OWNER');
    const budgets = [a.budget, b.budget];
    s = unwrap(respondTrade(s, 'p2', { offerId, accept: true }, ctxOf()));
    expect(s.participants[0]!.team.starters[4]).toBe(take);
    expect(s.participants[1]!.team.starters[4]).toBe(give);
    expect([s.participants[0]!.budget, s.participants[1]!.budget]).toEqual(budgets);
    expect(code(respondTrade(s, 'p2', { offerId, accept: true }, ctxOf()))).toBe('OFFER_NOT_PENDING');
  });

  it('sell to the bank: half price back, starter replaced by a free agent', () => {
    let s = toMercato();
    const p = s.participants[0]!;
    const cid = p.team.starters[4]!;
    const paid = p.team.purchases.find((x) => x.characterId === cid)!.price;
    s = unwrap(sellToBank(s, 'p1', { characterId: cid }, ctxOf()));
    const after = s.participants[0]!;
    expect(after.team.starters[4]).not.toBe(cid);
    expect(after.team.starters[4]).toBeTruthy();
    expect(after.budget).toBe(p.budget + Math.floor(paid / 2) - s.settings.reservePrice);
    expect(s.unsold).toContain(cid);
  });

  it('ends when every human team is ready (bots excluded)', () => {
    let s = room(1, { mercato: true });
    s = unwrap(addBot(s, 'p1', { id: 'b1', nickname: 'Robo', level: 'normal' }, ctxOf()));
    s = unwrap(startGame(s, 'p1', ctxOf()));
    s = playBots(s, (x) => x.status !== 'drafting');
    expect(s.status).toBe('mercato');
    s = unwrap(setMercatoReady(s, 'p1', ctxOf()));
    expect(s.status).toBe('voting');
  });
});

describe('simulation, end modes and series', () => {
  function drafted(players: number, extra: Partial<SettingsInput>, p: ContentPack = pack, seed = 42): RoomState {
    let s = unwrap(startGame(room(players, extra, p, seed), 'p1', ctxOf(p)));
    while (s.status === 'drafting') s = tick(s, p);
    return s;
  }

  it('is deterministic and covers every team count', () => {
    for (const n of [2, 3, 4]) {
      const s = drafted(n, { endMode: 'vote' });
      const a = simulate(s, pack);
      const b = simulate(s, pack);
      expect(a).toEqual(b);
      expect(new Set(a.result.ranking).size).toBe(n);
      expect(a.result.matches).toHaveLength(n === 2 ? 1 : n === 3 ? 3 : 4);
      expect(a.result.championId).toBe(a.result.ranking[0]);
      if (n !== 3) for (const m of a.result.matches) expect(m.winnerId).not.toBeNull();
    }
  });

  it('a stronger team wins far more often', () => {
    const s = drafted(2, {});
    const [x, y] = s.participants;
    // Give team x the best players of the pack.
    const best = [...pack.characters].sort((m, n) => n.overall - m.overall);
    const weak = [...pack.characters].sort((m, n) => m.overall - n.overall);
    const strong = { ...s, participants: [{ ...x!, team: { ...x!.team, starters: x!.team.starters.map((_, i) => best[i]!.id) } }, { ...y!, team: { ...y!.team, starters: y!.team.starters.map((_, i) => weak[i]!.id) } }] };
    let wins = 0;
    for (let seed = 0; seed < 200; seed++) if (simulate({ ...strong, rngState: seed * 7919 }, pack).result.championId === x!.id) wins++;
    expect(wins).toBeGreaterThan(150);
  });

  it('basketball model never ends level', () => {
    const s = drafted(3, {}, basketballRealPack);
    for (let seed = 0; seed < 50; seed++) {
      for (const m of simulate({ ...s, rngState: seed }, basketballRealPack).result.matches) expect(m.scoreA).not.toBe(m.scoreB);
    }
  });

  it("endMode 'sim' skips the vote and ranks by the tournament", () => {
    const s = drafted(4, { endMode: 'sim' });
    expect(s.status).toBe('finished');
    expect(s.result!.simulation!.ranking).toEqual(s.result!.standings.map((x) => x.participantId));
    expect(s.result!.winnerId).toBe(s.result!.simulation!.championId);
    expect(s.result!.voteWinnerId).toBeNull();
  });

  it("endMode 'vote_sim': the vote decides, the tournament is a bonus", () => {
    let s = drafted(2, { endMode: 'vote_sim' });
    expect(s.status).toBe('voting');
    s = unwrap(closeVoting(s, 'p1', ctxOf()));
    expect(s.result!.simulation).toBeDefined();
    expect(s.result!.voteWinnerId).toBe(s.result!.winnerId);
  });

  it('rematch keeps teams and series points, resets squads and budgets', () => {
    let s = drafted(3, { endMode: 'sim', jokers: true });
    const first = s.result!.standings;
    expect(s.series).toEqual({ round: 1, standings: Object.fromEntries(first.map((x) => [x.participantId, 3 - x.rank])) });
    expect(code(rematch(s, 'p2', ctxOf()))).toBe('NOT_HOST');
    s = unwrap(rematch(s, 'p1', ctxOf()));
    expect(s.status).toBe('lobby');
    expect(s.series!.round).toBe(2);
    for (const p of s.participants) {
      expect(p.budget).toBe(s.settings.budget);
      expect(p.team.starters.every((x) => x === null)).toBe(true);
    }
    s = unwrap(startGame(s, 'p1', ctxOf()));
    expect(s.participants.every((p) => p.jokers?.steal)).toBe(true);
    while (s.status === 'drafting') s = tick(s);
    const total = Object.values(s.series!.standings).reduce((a, b) => a + b, 0);
    expect(total).toBe(6);
    expect(s.series!.round).toBe(2);
  });
});

describe('Twitch chat votes', () => {
  function voting(players: number): RoomState {
    let s = unwrap(startGame(room(players), 'p1', ctxOf()));
    while (s.status === 'drafting') s = tick(s);
    return s;
  }

  it('spectator mode: one vote per chatter, mapped by team number', () => {
    let s = voting(2);
    expect(s.voting!.mode).toBe('spectators');
    s = unwrap(applyChatVotes(s, [{ user: 'Zed', team: 2 }, { user: 'zed', team: 1 }, { user: 'amy', team: 1 }, { user: 'bob', team: 9 }], ctxOf()));
    expect(s.voting!.votes.map((v) => [v.voterId, v.targetId])).toEqual([
      ['twitch:zed', 'p2'],
      ['twitch:amy', 'p1'],
    ]);
  });

  it('participant mode: chat cheers are tallied apart and do not count', () => {
    let s = voting(3);
    expect(s.voting!.mode).toBe('participants');
    s = unwrap(applyChatVotes(s, [{ user: 'a', team: 1 }, { user: 'b', team: 1 }, { user: 'a', team: 2 }], ctxOf()));
    expect(s.voting!.votes).toHaveLength(0);
    expect(s.voting!.chat!.counts).toEqual({ p1: 2 });
  });
});
