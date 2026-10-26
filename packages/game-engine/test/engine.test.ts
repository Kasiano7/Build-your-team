import { describe, expect, it } from 'vitest';
import { footballDemoPack as pack } from '@byt/football';
import type { RoomState } from '@byt/shared';
import {
  TIMINGS,
  addParticipant,
  advance,
  bestSlotFor,
  buildSettings,
  castVote,
  changeFormation,
  closeVoting,
  compatibility,
  createRoomState,
  getCharacter,
  getFormation,
  maxBidFor,
  nextDeadline,
  passAuction,
  placeBid,
  startGame,
  swapSlots,
  teamRating,
  validatePack,
  type Outcome,
} from '../src';

let clock = 1_000_000;
const ctx = () => ({ pack, now: clock });

function unwrap(o: Outcome): RoomState {
  if (!o.ok) throw new Error(`Expected ok, got ${o.code} ${JSON.stringify(o.details ?? {})}`);
  return o.state;
}

function makeRoom(players: number, mode: 'quick' | 'classic' = 'quick', seed = 42): RoomState {
  clock = 1_000_000;
  const settings = buildSettings(pack, { mode, maxParticipants: 4 });
  let s = createRoomState({ code: 'ABCDEF', settings, host: { id: 'p1', nickname: 'Alice' }, seed, ctx: ctx() });
  const names = ['Bruno', 'Chloé', 'Driss'];
  for (let i = 2; i <= players; i++) s = unwrap(addParticipant(s, `p${i}`, names[i - 2]!, ctx()));
  return s;
}

/** Move the clock to the next deadline and apply it. */
function tick(s: RoomState): RoomState {
  const d = nextDeadline(s);
  if (d === null) throw new Error('no deadline');
  clock = Math.max(clock, d);
  return unwrap(advance(s, ctx()));
}

function openAuction(s: RoomState): RoomState {
  while (s.auction?.stage !== 'open') s = tick(s);
  return s;
}

describe('content pack', () => {
  it('demo pack is structurally valid and labelled fictional', () => {
    expect(validatePack(pack)).toEqual([]);
    expect(pack.dataset.fictional).toBe(true);
    expect(pack.dataset.label).toMatch(/fictifs/);
  });
});

describe('lobby', () => {
  it('enforces capacity, unique nicknames and host-only start', () => {
    let s = makeRoom(1);
    s = { ...s, settings: { ...s.settings, maxParticipants: 2 } };
    s = unwrap(addParticipant(s, 'p2', 'alice', ctx()));
    expect(s.participants[1]!.nickname).toBe('alice 2');
    const full = addParticipant(s, 'p3', 'Zoé', ctx());
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.code).toBe('ROOM_FULL');
    const notHost = startGame(s, 'p2', ctx());
    expect(!notHost.ok && notHost.code).toBe('NOT_HOST');
  });

  it('refuses to start alone', () => {
    const s = makeRoom(1);
    const r = startGame(s, 'p1', ctx());
    expect(!r.ok && r.code).toBe('NOT_ENOUGH_PLAYERS');
  });
});

describe('auction rules', () => {
  it('reveals then opens an auction with a server deadline', () => {
    let s = unwrap(startGame(makeRoom(4), 'p1', ctx()));
    expect(s.status).toBe('drafting');
    expect(s.auction?.stage).toBe('reveal');
    const bidDuringReveal = placeBid(s, 'p2', { auctionId: s.auction!.id, amount: 10, bidId: 'b0' }, ctx());
    expect(!bidDuringReveal.ok && bidDuringReveal.code).toBe('AUCTION_NOT_OPEN');
    s = openAuction(s);
    expect(s.auction!.endsAt).toBe(s.auction!.revealEndsAt + s.settings.openingTimerSec * 1000);
    expect(s.auction!.eligible).toHaveLength(4);
  });

  it('validates increments, own high bid, stale auctions and resets the timer to 12s', () => {
    let s = openAuction(unwrap(startGame(makeRoom(4), 'p1', ctx())));
    const id = s.auction!.id;
    const low = placeBid(s, 'p1', { auctionId: id, amount: 5, bidId: 'b1' }, ctx());
    expect(!low.ok && low.code).toBe('BID_TOO_LOW');
    s = unwrap(placeBid(s, 'p1', { auctionId: id, amount: 10, bidId: 'b1' }, ctx()));
    const again = placeBid(s, 'p1', { auctionId: id, amount: 30, bidId: 'b2' }, ctx());
    expect(!again.ok && again.code).toBe('ALREADY_HIGHEST');
    const tooLow = placeBid(s, 'p2', { auctionId: id, amount: 15, bidId: 'b3' }, ctx());
    expect(!tooLow.ok && tooLow.code).toBe('BID_TOO_LOW');
    const stale = placeBid(s, 'p2', { auctionId: 'X', amount: 20, bidId: 'b3' }, ctx());
    expect(!stale.ok && stale.code).toBe('STALE_AUCTION');

    clock = s.auction!.endsAt! - 2000; // 2 s left
    s = unwrap(placeBid(s, 'p2', { auctionId: id, amount: 50, bidId: 'b4' }, ctx()));
    expect(s.auction!.endsAt).toBe(clock + 12_000);
    expect(s.auction!.highBid).toMatchObject({ participantId: 'p2', amount: 50 });
  });

  it('serialises near-simultaneous bids: the second identical bid is rejected as too low', () => {
    let s = openAuction(unwrap(startGame(makeRoom(4), 'p1', ctx())));
    const id = s.auction!.id;
    const first = placeBid(s, 'p2', { auctionId: id, amount: 10, bidId: 'x1' }, ctx());
    s = unwrap(first);
    const second = placeBid(s, 'p3', { auctionId: id, amount: 10, bidId: 'x2' }, ctx());
    expect(!second.ok && second.code).toBe('BID_TOO_LOW');
    expect(s.auction!.highBid!.participantId).toBe('p2');
  });

  it('caps bids by the reserve needed for remaining slots', () => {
    let s = openAuction(unwrap(startGame(makeRoom(2), 'p1', ctx())));
    const c = getCharacter(pack, s.auction!.characterId);
    const p1 = s.participants[0]!;
    // 200 budget, 5 open slots → 4 must remain reserved at 10 → max 160.
    expect(maxBidFor(pack, s.settings, p1, c)).toBe(160);
    const r = placeBid(s, 'p1', { auctionId: s.auction!.id, amount: 170, bidId: 'big' }, ctx());
    expect(!r.ok && r.code).toBe('INSUFFICIENT_BUDGET');
    s = unwrap(placeBid(s, 'p1', { auctionId: s.auction!.id, amount: 160, bidId: 'ok' }, ctx()));
    expect(s.auction!.highBid!.amount).toBe(160);
  });

  it('pass rules, early close, budget debit and automatic placement', () => {
    let s = openAuction(unwrap(startGame(makeRoom(3), 'p1', ctx())));
    const id = s.auction!.id;
    const characterId = s.auction!.characterId;
    s = unwrap(placeBid(s, 'p2', { auctionId: id, amount: 40, bidId: 'b' }, ctx()));
    const highPass = passAuction(s, 'p2', { auctionId: id }, ctx());
    expect(!highPass.ok && highPass.code).toBe('HIGHEST_CANNOT_PASS');
    s = unwrap(passAuction(s, 'p1', { auctionId: id }, ctx()));
    const twice = passAuction(s, 'p1', { auctionId: id }, ctx());
    expect(!twice.ok && twice.code).toBe('ALREADY_PASSED');
    const bidAfterPass = placeBid(s, 'p1', { auctionId: id, amount: 60, bidId: 'c' }, ctx());
    expect(!bidAfterPass.ok && bidAfterPass.code).toBe('ALREADY_PASSED');
    s = unwrap(passAuction(s, 'p3', { auctionId: id }, ctx()));
    // Everyone else passed → closed immediately, without waiting for the timer.
    expect(s.auction!.stage).toBe('closed');
    expect(s.auction!.result).toMatchObject({ type: 'sold', participantId: 'p2', amount: 40 });
    const winner = s.participants.find((p) => p.id === 'p2')!;
    expect(winner.budget).toBe(160);
    const formation = getFormation(pack, winner.team.formationId);
    const slotIndex = winner.team.starters.indexOf(characterId);
    expect(slotIndex).toBeGreaterThanOrEqual(0);
    expect(compatibility(pack, getCharacter(pack, characterId), formation.slots[slotIndex]!)).toBeGreaterThan(0);
  });

  it('closes on the server deadline without any client action and handles unsold players', () => {
    let s = openAuction(unwrap(startGame(makeRoom(2), 'p1', ctx())));
    const characterId = s.auction!.characterId;
    s = tick(s); // deadline reached, nobody bid
    expect(s.auction!.result).toEqual({ type: 'unsold' });
    expect(s.unsold).toContain(characterId);
    s = tick(s); // next auction
    expect(s.auction!.no).toBe(2);
    expect(s.auction!.stage).toBe('reveal');
  });

  it('a disconnected highest bidder still wins at the deadline', () => {
    let s = openAuction(unwrap(startGame(makeRoom(2), 'p1', ctx())));
    s = unwrap(placeBid(s, 'p2', { auctionId: s.auction!.id, amount: 20, bidId: 'z' }, ctx()));
    s = { ...s, participants: s.participants.map((p) => (p.id === 'p2' ? { ...p, connected: false } : p)) };
    s = tick(s);
    expect(s.auction!.result).toMatchObject({ type: 'sold', participantId: 'p2' });
  });
});

/** Play a full draft where the lowest-seat eligible participant always buys at the minimum price. */
function playDraft(s: RoomState, strategy: 'buy' | 'idle' = 'buy'): RoomState {
  let guard = 0;
  while (s.status === 'drafting' && guard++ < 2000) {
    if (s.auction?.stage === 'open' && strategy === 'buy') {
      const buyer = s.auction.eligible[0];
      if (buyer && !s.auction.highBid) {
        s = unwrap(placeBid(s, buyer, { auctionId: s.auction.id, amount: s.settings.reservePrice, bidId: `b${guard}` }, ctx()));
        for (const other of s.auction!.eligible.filter((x) => x !== buyer)) {
          if (s.auction?.stage === 'open') s = unwrap(passAuction(s, other, { auctionId: s.auction.id }, ctx()));
        }
        continue;
      }
    }
    s = tick(s);
  }
  return s;
}

describe('full draft', () => {
  it('fills every team (quick mode, 4 players) and moves to participant voting', () => {
    const s = playDraft(unwrap(startGame(makeRoom(4), 'p1', ctx())));
    expect(s.status).toBe('voting');
    expect(s.voting!.mode).toBe('participants');
    for (const p of s.participants) {
      expect(p.team.starters.every(Boolean)).toBe(true);
      expect(p.budget).toBeGreaterThanOrEqual(0);
      const spent = p.team.purchases.reduce((a, x) => a + x.price, 0);
      expect(p.budget + spent).toBe(s.settings.budget);
    }
    const all = s.participants.flatMap((p) => p.team.starters);
    expect(new Set(all).size).toBe(all.length); // nobody owned twice
  });

  it('completes idle teams with free agents (lowest-rated compatible, reserve price)', () => {
    const s = playDraft(unwrap(startGame(makeRoom(2), 'p1', ctx())), 'idle');
    expect(s.status).toBe('voting');
    expect(s.voting!.mode).toBe('spectators');
    for (const p of s.participants) {
      expect(p.team.starters.every(Boolean)).toBe(true);
      expect(p.team.purchases.every((x) => x.kind === 'free_agent' && x.price === 10)).toBe(true);
    }
    expect(s.auctionCount).toBeLessThanOrEqual(s.settings.maxAuctions);
  });

  it('classic mode: 11 starters, formation change and bench swaps', () => {
    let s = unwrap(startGame(makeRoom(2, 'classic'), 'p1', ctx()));
    expect(s.participants[0]!.team.starters).toHaveLength(11);
    expect(s.participants[0]!.team.bench).toHaveLength(3);
    s = unwrap(changeFormation(s, 'p1', '4-4-2', ctx()));
    expect(s.participants[0]!.team.formationId).toBe('4-4-2');
    const locked = changeFormation(makeRoom(2), 'p1', '4-4-2', ctx());
    expect(!locked.ok && locked.code).toBe('FORMATION_LOCKED');
    s = playDraft(s);
    expect(s.status).toBe('voting');
    for (const p of s.participants) expect(p.team.starters.every(Boolean)).toBe(true);
  });
});

describe('team management', () => {
  it('rejects incompatible swaps (goalkeeper to attack)', () => {
    let s = playDraft(unwrap(startGame(makeRoom(2), 'p1', ctx())));
    // Re-open drafting artificially to test swap validation on a full team.
    s = { ...s, status: 'drafting' };
    const r = swapSlots(s, 'p1', { kind: 'starter', index: 0 }, { kind: 'starter', index: 3 }, ctx());
    expect(!r.ok && r.code).toBe('INCOMPATIBLE_SLOT');
    const ok = swapSlots(s, 'p1', { kind: 'starter', index: 3 }, { kind: 'starter', index: 4 }, ctx());
    expect(ok.ok).toBe(true);
  });

  it('auto-assigns to the best compatible slot deterministically', () => {
    const s = makeRoom(1);
    const team = s.participants[0]!.team;
    const st = pack.characters.find((c) => c.roles[0] === 'ST')!;
    expect(bestSlotFor(pack, team, st)).toEqual({ kind: 'starter', index: 3 });
    const gk = pack.characters.find((c) => c.roles[0] === 'GK')!;
    expect(bestSlotFor(pack, team, gk)).toEqual({ kind: 'starter', index: 0 });
  });
});

describe('voting', () => {
  it('participants cannot vote for themselves; game ends when all voted', () => {
    let s = playDraft(unwrap(startGame(makeRoom(3), 'p1', ctx())));
    const own = castVote(s, { id: 'p1', kind: 'participant' }, 'p1', ctx());
    expect(!own.ok && own.code).toBe('CANNOT_VOTE_OWN_TEAM');
    s = unwrap(castVote(s, { id: 'p1', kind: 'participant' }, 'p2', ctx()));
    const dup = castVote(s, { id: 'p1', kind: 'participant' }, 'p3', ctx());
    expect(!dup.ok && dup.code).toBe('ALREADY_VOTED');
    s = unwrap(castVote(s, { id: 'p2', kind: 'participant' }, 'p3', ctx()));
    expect(s.status).toBe('voting');
    s = unwrap(castVote(s, { id: 'p3', kind: 'participant' }, 'p2', ctx()));
    expect(s.status).toBe('finished');
    expect(s.result!.winnerId).toBe('p2');
    expect(s.result!.standings[0]!.votes).toBe(2);
    expect(s.result!.tieBreak).toBeNull();
  });

  it('ties are broken by team rating', () => {
    let s = playDraft(unwrap(startGame(makeRoom(4), 'p1', ctx())));
    s = unwrap(castVote(s, { id: 'p1', kind: 'participant' }, 'p2', ctx()));
    s = unwrap(castVote(s, { id: 'p2', kind: 'participant' }, 'p1', ctx()));
    s = unwrap(castVote(s, { id: 'p3', kind: 'participant' }, 'p4', ctx()));
    s = unwrap(castVote(s, { id: 'p4', kind: 'participant' }, 'p3', ctx()));
    expect(s.status).toBe('finished');
    const ratings = s.participants.map((p) => teamRating(pack, p.team));
    const best = Math.max(...ratings);
    const winner = s.participants.find((p) => p.id === s.result!.winnerId)!;
    expect(teamRating(pack, winner.team)).toBe(best);
    expect(s.result!.tieBreak).not.toBeNull();
  });

  it('two players: spectators vote, participants cannot, host closes', () => {
    let s = playDraft(unwrap(startGame(makeRoom(2), 'p1', ctx())));
    const p = castVote(s, { id: 'p1', kind: 'participant' }, 'p2', ctx());
    expect(!p.ok && p.code).toBe('WRONG_PHASE');
    s = unwrap(castVote(s, { id: 'spec-aaaaaaaaaaaaaaaa', kind: 'spectator' }, 'p2', ctx()));
    s = unwrap(castVote(s, { id: 'spec-bbbbbbbbbbbbbbbb', kind: 'spectator' }, 'p2', ctx()));
    s = unwrap(castVote(s, { id: 'spec-cccccccccccccccc', kind: 'spectator' }, 'p1', ctx()));
    const dup = castVote(s, { id: 'spec-cccccccccccccccc', kind: 'spectator' }, 'p2', ctx());
    expect(!dup.ok && dup.code).toBe('ALREADY_VOTED');
    const notHost = closeVoting(s, 'p2', ctx());
    expect(!notHost.ok && notHost.code).toBe('NOT_HOST');
    s = unwrap(closeVoting(s, 'p1', ctx()));
    expect(s.result!.winnerId).toBe('p2');
    expect(s.result!.totalVotes).toBe(3);
  });

  it('voting closes on the server deadline', () => {
    let s = playDraft(unwrap(startGame(makeRoom(3), 'p1', ctx())));
    s = tick(s);
    expect(s.status).toBe('finished');
    expect(s.result).not.toBeNull();
  });
});

describe('timings', () => {
  it('sold display gives clients time for the transfer animation', () => {
    expect(TIMINGS.soldDisplayMs).toBeGreaterThanOrEqual(3000);
  });
});

describe('moderation & host tools', () => {
  it('host can remove a participant in the lobby only', async () => {
    const { kickParticipant } = await import('../src');
    let s = makeRoom(3);
    const notHost = kickParticipant(s, 'p2', 'p3', ctx());
    expect(!notHost.ok && notHost.code).toBe('NOT_HOST');
    const self = kickParticipant(s, 'p1', 'p1', ctx());
    expect(!self.ok && self.code).toBe('UNKNOWN_TARGET');
    s = unwrap(kickParticipant(s, 'p1', 'p3', ctx()));
    expect(s.participants.map((p) => p.id)).toEqual(['p1', 'p2']);
    const started = unwrap(startGame(s, 'p1', ctx()));
    const late = kickParticipant(started, 'p1', 'p2', ctx());
    expect(!late.ok && late.code).toBe('WRONG_PHASE');
  });

  it('blocks offensive nicknames, including leetspeak and accents', async () => {
    const { nicknameSchema } = await import('@byt/shared');
    for (const bad of ['Connard', 'c0nn4rd', 'FuCk you', 'NTM', 'Enculé']) expect(nicknameSchema.safeParse(bad).success).toBe(false);
    // Short blocked terms only match whole words: no false positive on real names.
    for (const ok of ['Camille', 'Zoé', 'Ntmanga', 'Dickson', 'Alex 2']) expect(nicknameSchema.safeParse(ok).success).toBe(true);
  });
});
