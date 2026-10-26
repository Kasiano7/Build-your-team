/**
 * Integration: a real GameServer (Socket.IO + PostgreSQL via PGlite) driven by
 * four independent socket.io-client connections. Covers the mandatory
 * multiplayer scenarios end to end. Timers are accelerated (TIME_SCALE).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { footballDemoPack } from '@byt/football';
import { C2S, S2C, type RoomUpdate, type RoomView, type SessionAck, type SpectatorAck } from '@byt/shared';
import { createDb, migrate, type Db } from '../src/db';
import { GameServer } from '../src/server';

process.env.LOG_LEVEL = 'silent';
const TIME_SCALE = 0.08;

let db: Db;
let server: GameServer;
let url = '';
const sockets: Socket[] = [];

beforeAll(async () => {
  db = await createDb();
  await migrate(db);
  server = new GameServer({ db, packs: [footballDemoPack], timeScale: TIME_SCALE });
  const port = await server.start(0);
  url = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await server.stop();
  await db.close();
});

class Client {
  socket: Socket;
  view: RoomView | null = null;
  updates: RoomUpdate[] = [];
  participantId = '';
  token = '';
  constructor(readonly name: string) {
    this.socket = connect(url, { transports: ['websocket'], forceNew: true });
    sockets.push(this.socket);
    this.socket.on(S2C.update, (u: RoomUpdate) => {
      if (!this.view || u.view.version >= this.view.version) this.view = u.view;
      this.updates.push(u);
    });
  }
  emit<T = any>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => this.socket.emit(event, payload, resolve));
  }
  async session(event: string, payload: unknown) {
    const ack = await this.emit<{ ok: boolean } & SessionAck>(event, payload);
    if (ack.ok) {
      this.participantId = ack.participantId;
      this.token = ack.sessionToken;
      this.view = ack.view;
    }
    return ack;
  }
  waitFor(pred: (v: RoomView) => boolean, timeout = 15000): Promise<RoomView> {
    return new Promise((resolve, reject) => {
      if (this.view && pred(this.view)) return resolve(this.view);
      const timer = setTimeout(() => {
        this.socket.off(S2C.update, onUpdate);
        reject(new Error(`${this.name}: timeout waiting for condition (status=${this.view?.status} stage=${this.view?.auction?.stage})`));
      }, timeout);
      const onUpdate = () => {
        if (this.view && pred(this.view)) {
          clearTimeout(timer);
          this.socket.off(S2C.update, onUpdate);
          resolve(this.view);
        }
      };
      this.socket.on(S2C.update, onUpdate);
    });
  }
}

const me = (c: Client) => c.view!.participants.find((p) => p.id === c.participantId)!;

describe('four-client multiplayer game', () => {
  let alice: Client, bruno: Client, chloe: Client, driss: Client;
  let all: Client[] = [];
  let code = '';
  beforeAll(() => {
    alice = new Client('alice');
    bruno = new Client('bruno');
    chloe = new Client('chloe');
    driss = new Client('driss');
    all = [alice, bruno, chloe, driss];
  });

  it('1. host creates a room', async () => {
    const ack = await alice.session(C2S.create, {
      nickname: 'Alice',
      packId: footballDemoPack.id,
      mode: 'quick',
      maxParticipants: 4,
    });
    expect(ack.ok).toBe(true);
    code = ack.roomCode;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(ack.pack.dataset.fictional).toBe(true);
    expect(alice.view!.settings.budget).toBe(200);
    // Persisted in PostgreSQL.
    const rows = await db.query('SELECT status FROM rooms WHERE code = $1', [code]);
    expect(rows.rows[0]).toMatchObject({ status: 'lobby' });
  });

  it('rejects malformed payloads and unknown rooms', async () => {
    const bad = await bruno.emit(C2S.join, { roomCode: 'zz', nickname: 'B' });
    expect(bad).toMatchObject({ ok: false, code: 'INVALID_PAYLOAD' });
    const missing = await bruno.emit(C2S.join, { roomCode: 'ZZZZZZ', nickname: 'Bruno' });
    expect(missing).toMatchObject({ ok: false, code: 'ROOM_NOT_FOUND' });
  });

  it('2. three friends join', async () => {
    for (const [c, n] of [[bruno, 'Bruno'], [chloe, 'Chloé'], [driss, 'Driss']] as const) {
      const ack = await c.session(C2S.join, { roomCode: code, nickname: n });
      expect(ack.ok).toBe(true);
    }
    const v = await alice.waitFor((x) => x.participants.length === 4);
    expect(v.participants.map((p) => p.nickname)).toEqual(['Alice', 'Bruno', 'Chloé', 'Driss']);
    const extra = new Client('extra');
    const full = await extra.emit(C2S.join, { roomCode: code, nickname: 'Eve' });
    expect(full).toMatchObject({ ok: false, code: 'ROOM_FULL' });
  });

  it('3. only the host can start; start is idempotent', async () => {
    const notHost = await bruno.emit(C2S.start, { actionId: randomUUID() });
    expect(notHost).toMatchObject({ ok: false, code: 'NOT_HOST' });
    const actionId = randomUUID();
    const [a, b] = await Promise.all([alice.emit(C2S.start, { actionId }), alice.emit(C2S.start, { actionId })]);
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: true, duplicate: true });
  });

  it('4. everyone receives the same player at the same time', async () => {
    const views = await Promise.all(all.map((c) => c.waitFor((v) => v.auction?.stage === 'open')));
    const ids = new Set(views.map((v) => v.auction!.id + v.auction!.characterId + v.auction!.endsAt));
    expect(ids.size).toBe(1);
    expect(views[0]!.characters[views[0]!.auction!.characterId]).toBeDefined();
  });

  it('5–9. concurrent bids, budget refusal, pass, attribution, budget debit, auto placement', async () => {
    const auction = alice.view!.auction!;
    // 5. Two bids sent almost simultaneously for the same amount: exactly one wins.
    const [rb, rc] = await Promise.all([
      bruno.emit(C2S.bid, { actionId: randomUUID(), auctionId: auction.id, amount: 30 }),
      chloe.emit(C2S.bid, { actionId: randomUUID(), auctionId: auction.id, amount: 30 }),
    ]);
    const oks = [rb, rc].filter((r) => r.ok);
    const kos = [rb, rc].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(kos[0]).toMatchObject({ code: 'BID_TOO_LOW' });
    const leader = rb.ok ? bruno : chloe;
    const other = rb.ok ? chloe : bruno;

    // 6. Refused for lack of budget (max = 200 − 4×10 = 160).
    const tooMuch = await driss.emit(C2S.bid, { actionId: randomUUID(), auctionId: auction.id, amount: 170 });
    expect(tooMuch).toMatchObject({ ok: false, code: 'INSUFFICIENT_BUDGET', details: { maximum: 160 } });

    // Leader cannot outbid themself.
    const self = await leader.emit(C2S.bid, { actionId: randomUUID(), auctionId: auction.id, amount: 50 });
    expect(self).toMatchObject({ ok: false, code: 'ALREADY_HIGHEST' });

    const raise = await driss.emit(C2S.bid, { actionId: randomUUID(), auctionId: auction.id, amount: 60 });
    expect(raise.ok).toBe(true);

    // 7. Others pass → the auction closes immediately on the server.
    for (const c of [alice, leader, other]) {
      const r = await c.emit(C2S.pass, { actionId: randomUUID(), auctionId: auction.id });
      expect(r.ok).toBe(true);
    }
    const closed = await alice.waitFor((v) => v.auction?.id === auction.id && v.auction.stage === 'closed');
    // 8. Attribution to the right participant.
    expect(closed.auction!.result).toMatchObject({ type: 'sold', participantId: driss.participantId, amount: 60 });
    // 9. Budget debited and player placed on the pitch for every client.
    for (const c of all) {
      const v = await c.waitFor((x) => x.version >= closed.version);
      const d = v.participants.find((p) => p.id === driss.participantId)!;
      expect(d.budget).toBe(140);
      expect(d.team.starters).toContain(auction.characterId);
    }
    const dbBids = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM bids WHERE auction_id = $1', [auction.id]);
    expect(dbBids.rows[0]!.count).toBe(2);
    const assign = await db.query('SELECT participant_id, price FROM team_assignments WHERE character_id = $1', [auction.characterId]);
    expect(assign.rows[0]).toMatchObject({ participant_id: driss.participantId, price: 60 });
  });

  it('10–11. disconnection and reconnection without data loss', async () => {
    const before = me(bruno);
    bruno.socket.disconnect();
    await alice.waitFor((v) => v.participants.find((p) => p.id === bruno.participantId)!.connected === false);
    const reborn = new Client('bruno-2');
    const ack = await reborn.session(C2S.resume, { roomCode: code, sessionToken: bruno.token });
    expect(ack.ok).toBe(true);
    expect(ack.participantId).toBe(bruno.participantId);
    const after = ack.view.participants.find((p) => p.id === bruno.participantId)!;
    expect(after.budget).toBe(before.budget);
    expect(after.team).toEqual(before.team);
    await alice.waitFor((v) => v.participants.find((p) => p.id === bruno.participantId)!.connected === true);
    const forged = await new Client('forger').emit(C2S.resume, { roomCode: code, sessionToken: 'x'.repeat(43) });
    expect(forged).toMatchObject({ ok: false, code: 'INVALID_SESSION' });
    all[1] = reborn;
  });

  it('12. draft ends with complete teams (server-side timers, no client action needed for closure)', async () => {
    // Each auction: the first eligible participant without a bid takes it at the reserve price,
    // everyone else passes. Some auctions are left to expire on the server timer.
    let n = 0;
    const handled = new Set<string>();
    while (alice.view!.status === 'drafting') {
      const v = await alice.waitFor((x) => x.status !== 'drafting' || (x.auction?.stage === 'open' && !handled.has(x.auction.id)), 20000);
      if (v.status !== 'drafting') break;
      const a = v.auction!;
      handled.add(a.id);
      n++;
      if (n % 4 === 0) continue; // let the server timer close it (unsold)
      const buyerId = a.eligible[0]!;
      const buyer = all.find((c) => c.participantId === buyerId)!;
      const r = await buyer.emit(C2S.bid, { actionId: randomUUID(), auctionId: a.id, amount: 10 });
      expect(r.ok).toBe(true);
      await Promise.all(
        a.eligible
          .filter((id) => id !== buyerId)
          .map((id) => all.find((c) => c.participantId === id)!.emit(C2S.pass, { actionId: randomUUID(), auctionId: a.id })),
      );
    }
    const v = await alice.waitFor((x) => x.status === 'voting', 20000);
    for (const p of v.participants) {
      expect(p.team.starters.every(Boolean)).toBe(true);
      expect(p.budget).toBeGreaterThanOrEqual(0);
    }
    expect(v.voting!.mode).toBe('participants');
    expect(v.history.some((h) => h.result.type === 'unsold')).toBe(true);
  }, 120000);

  it('13–14. votes and results', async () => {
    const own = await alice.emit(C2S.vote, { actionId: randomUUID(), targetId: alice.participantId });
    expect(own).toMatchObject({ ok: false, code: 'CANNOT_VOTE_OWN_TEAM' });
    const targets: Record<string, Client> = {
      alice: chloe, // alice → chloe
      'bruno-2': chloe,
      chloe: driss,
      driss: chloe,
    };
    for (const c of all) {
      const r = await c.emit(C2S.vote, { actionId: randomUUID(), targetId: targets[c.name]!.participantId });
      expect(r.ok).toBe(true);
    }
    const v = await alice.waitFor((x) => x.status === 'finished');
    expect(v.result!.winnerId).toBe(chloe.participantId);
    expect(v.result!.standings[0]!.votes).toBe(3);
    expect(v.result!.auctionsPlayed).toBeGreaterThan(0);
    const res = await db.query('SELECT winner_id FROM results WHERE room_code = $1', [code]);
    expect(res.rows[0]).toMatchObject({ winner_id: chloe.participantId });
    const votes = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM votes WHERE room_code = $1', [code]);
    expect(votes.rows[0]!.count).toBe(4);
  });
});

describe('two-player game with spectator voting', () => {
  it('spectators vote through a link, with one vote per spectator and an IP cap', async () => {
    const a = new Client('host2');
    const b = new Client('guest2');
    const created = await a.session(C2S.create, { nickname: 'Hana', packId: footballDemoPack.id, mode: 'quick', maxParticipants: 2 });
    const code = created.roomCode;
    await b.session(C2S.join, { roomCode: code, nickname: 'Ilan' });
    await a.emit(C2S.start, { actionId: randomUUID() });
    // Nobody bids: every auction expires on the server; free agents complete both teams.
    const v = await a.waitFor((x) => x.status === 'voting', 90000);
    expect(v.voting!.mode).toBe('spectators');
    for (const p of v.participants) expect(p.team.starters.every(Boolean)).toBe(true);

    const playerVote = await a.emit(C2S.vote, { actionId: randomUUID(), targetId: b.participantId });
    expect(playerVote).toMatchObject({ ok: false, code: 'WRONG_PHASE' });

    const spectators = [new Client('s1'), new Client('s2'), new Client('s3'), new Client('s4')];
    const acks: SpectatorAck[] = [];
    for (const s of spectators) acks.push(await s.emit(C2S.spectate, { roomCode: code }));
    expect(acks.every((x: any) => x.ok)).toBe(true);
    const r1 = await spectators[0]!.emit(C2S.spectatorVote, { roomCode: code, spectatorId: acks[0]!.spectatorId, targetId: b.participantId });
    expect(r1.ok).toBe(true);
    const again = await spectators[0]!.emit(C2S.spectatorVote, { roomCode: code, spectatorId: acks[0]!.spectatorId, targetId: a.participantId });
    expect(again).toMatchObject({ ok: false, code: 'ALREADY_VOTED' });
    await spectators[1]!.emit(C2S.spectatorVote, { roomCode: code, spectatorId: acks[1]!.spectatorId, targetId: b.participantId });
    await spectators[2]!.emit(C2S.spectatorVote, { roomCode: code, spectatorId: acks[2]!.spectatorId, targetId: a.participantId });
    // 4th vote from the same IP is refused (cap = 3 per IP per room).
    const capped = await spectators[3]!.emit(C2S.spectatorVote, { roomCode: code, spectatorId: acks[3]!.spectatorId, targetId: a.participantId });
    expect(capped).toMatchObject({ ok: false, code: 'RATE_LIMITED' });

    const close = await a.emit(C2S.closeVote, { actionId: randomUUID() });
    expect(close.ok).toBe(true);
    const done = await a.waitFor((x) => x.status === 'finished');
    expect(done.result!.winnerId).toBe(b.participantId);
    expect(done.result!.totalVotes).toBe(3);
  }, 120000);
});

describe('server restart', () => {
  it('reloads an in-progress room from PostgreSQL and keeps running its timers', async () => {
    const a = new Client('r1');
    const b = new Client('r2');
    const created = await a.session(C2S.create, { nickname: 'Rui', packId: footballDemoPack.id, mode: 'quick', maxParticipants: 2 });
    await b.session(C2S.join, { roomCode: created.roomCode, nickname: 'Sam' });
    await a.emit(C2S.start, { actionId: randomUUID() });
    await a.waitFor((x) => x.auction?.stage === 'open');

    // A second server instance on the same database (simulates a restart).
    const second = new GameServer({ db, packs: [footballDemoPack], timeScale: TIME_SCALE });
    const port = await second.start(0);
    const c = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
    sockets.push(c);
    const ack: any = await new Promise((resolve) =>
      c.emit(C2S.resume, { roomCode: created.roomCode, sessionToken: a.token }, resolve),
    );
    expect(ack.ok).toBe(true);
    expect(ack.view.status).toBe('drafting');
    const advanced = await new Promise<RoomView>((resolve) =>
      c.on(S2C.update, (u: RoomUpdate) => {
        if (u.view.auctionCount > ack.view.auctionCount) resolve(u.view);
      }),
    );
    expect(advanced.auctionCount).toBeGreaterThan(ack.view.auctionCount);
    c.disconnect();
    await second.stop();
  }, 60000);
});
