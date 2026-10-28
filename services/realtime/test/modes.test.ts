/**
 * Integration of the game modes on a real GameServer (Socket.IO + PostgreSQL
 * via PGlite): bots driven by the server, duo teams, sealed auctions, jokers,
 * mercato, simulated end, rematch series persisted in SQL, Twitch chat votes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { footballRealPack } from '@byt/football';
import { C2S, S2C, type RoomUpdate, type RoomView, type SessionAck } from '@byt/shared';
import { createDb, migrate, type Db } from '../src/db';
import { GameServer } from '../src/server';

process.env.LOG_LEVEL = 'silent';
process.env.TWITCH_DISABLED = '1';
const TIME_SCALE = 0.05;

let db: Db;
let server: GameServer;
let url = '';
const sockets: Socket[] = [];

beforeAll(async () => {
  db = await createDb();
  await migrate(db);
  server = new GameServer({ db, packs: [footballRealPack], timeScale: TIME_SCALE });
  url = `http://127.0.0.1:${await server.start(0)}`;
});

afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await server.stop();
  await db.close();
});

class Client {
  socket: Socket;
  view: RoomView | null = null;
  participantId = '';
  constructor(readonly name: string) {
    this.socket = connect(url, { transports: ['websocket'], forceNew: true });
    sockets.push(this.socket);
    this.socket.on(S2C.update, (u: RoomUpdate) => {
      if (!this.view || u.view.version >= this.view.version) this.view = u.view;
    });
  }
  emit<T = any>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => this.socket.emit(event, payload, resolve));
  }
  act(event: string, payload: Record<string, unknown> = {}) {
    return this.emit<{ ok: boolean; code?: string }>(event, { actionId: randomUUID(), ...payload });
  }
  async session(event: string, payload: unknown) {
    const ack = await this.emit<{ ok: boolean; code?: string } & SessionAck>(event, payload);
    if (ack.ok) {
      this.participantId = ack.participantId;
      this.view = ack.view;
    }
    return ack;
  }
  waitFor(pred: (v: RoomView) => boolean, timeout = 30000): Promise<RoomView> {
    return new Promise((resolve, reject) => {
      if (this.view && pred(this.view)) return resolve(this.view);
      const timer = setTimeout(() => {
        this.socket.off(S2C.update, on);
        reject(new Error(`${this.name}: timeout (status=${this.view?.status} stage=${this.view?.auction?.stage})`));
      }, timeout);
      const on = () => {
        if (this.view && pred(this.view)) {
          clearTimeout(timer);
          this.socket.off(S2C.update, on);
          resolve(this.view);
        }
      };
      this.socket.on(S2C.update, on);
    });
  }
}

const base = { packId: footballRealPack.id, mode: 'quick' as const };

describe('bots and simulated tournament', () => {
  it('one person and three server bots play a full game, then a rematch persisted as round 2', async () => {
    const host = new Client('host');
    const created = await host.session(C2S.create, { ...base, nickname: 'Solo', maxParticipants: 4, endMode: 'sim', jokers: true });
    expect(created.ok).toBe(true);
    for (const level of ['easy', 'normal', 'hard']) expect((await host.act(C2S.addBot, { level })).ok).toBe(true);
    expect((await host.act(C2S.addBot, { level: 'easy' })).code).toBe('ROOM_FULL');
    expect(host.view!.participants.filter((p) => p.bot)).toHaveLength(3);
    expect((await host.act(C2S.start)).ok).toBe(true);
    // The person passes on everything: bots buy, the server drives them with real timers.
    host.socket.on(S2C.update, (u: RoomUpdate) => {
      const a = u.view.auction;
      if (a?.stage === 'open' && a.eligible.includes(host.participantId) && !a.passed.includes(host.participantId)) {
        void host.act(C2S.pass, { auctionId: a.id });
      }
    });
    const end = await host.waitFor((v) => v.status === 'finished', 90000);
    host.socket.removeAllListeners(S2C.update);
    host.socket.on(S2C.update, (u: RoomUpdate) => {
      if (!host.view || u.view.version >= host.view.version) host.view = u.view;
    });
    expect(end.result!.simulation!.matches).toHaveLength(4);
    expect(end.result!.winnerId).toBe(end.result!.simulation!.championId);
    const botBuys = end.participants.filter((p) => p.bot).flatMap((p) => p.team.purchases.filter((x) => x.kind === 'auction'));
    expect(botBuys.length).toBeGreaterThan(3);
    expect(end.series!.round).toBe(1);

    expect((await host.act(C2S.rematch)).ok).toBe(true);
    const lobby = await host.waitFor((v) => v.status === 'lobby');
    expect(lobby.series!.round).toBe(2);
    expect(lobby.participants).toHaveLength(4);
    const code = lobby.code;
    const rows = await db.query<{ round: number; n: string }>('SELECT round, count(*)::text AS n FROM team_assignments WHERE room_code=$1 GROUP BY round', [code]);
    expect(rows.rows.map((r) => r.round)).toEqual([1]);
    const results = await db.query('SELECT round FROM results WHERE room_code=$1', [code]);
    expect(results.rows).toHaveLength(1);
  }, 120000);
});

describe('duo teams', () => {
  it('two people share a team; kicking the team revokes both sessions', async () => {
    const a = new Client('a');
    await a.session(C2S.create, { ...base, nickname: 'Alice', maxParticipants: 2, format: 'duo' });
    const code = a.view!.code;
    const b = new Client('b');
    const joinedB = await b.session(C2S.join, { roomCode: code, nickname: 'Bob', teamId: a.participantId });
    expect(joinedB.ok).toBe(true);
    const c = new Client('c');
    await c.session(C2S.join, { roomCode: code, nickname: 'Chloé' });
    const d = new Client('d');
    await d.session(C2S.join, { roomCode: code, nickname: 'Driss' });
    const v = await a.waitFor((x) => x.participants.reduce((n, p) => n + (p.members?.length ?? 1), 0) === 4);
    expect(v.participants.map((p) => p.nickname)).toEqual(['Alice & Bob', 'Chloé & Driss']);
    const teamC = v.participants[1]!.id;
    expect((await a.act(C2S.kick, { participantId: teamC })).ok).toBe(true);
    await a.waitFor((x) => x.participants.length === 1);
    expect((await d.act(C2S.start)).code).toBe('NOT_IN_ROOM');
    // The partner (not the creator) has host rights for the team.
    const e = new Client('e');
    await e.session(C2S.join, { roomCode: code, nickname: 'Emma' });
    await b.waitFor((x) => x.participants.length === 2);
    expect((await b.act(C2S.start)).ok).toBe(true);
  }, 30000);
});

describe('sealed auction, jokers, mercato and chat votes over sockets', () => {
  it('plays the options end to end', async () => {
    const a = new Client('a');
    await a.session(C2S.create, { ...base, nickname: 'Alice', maxParticipants: 2, auctionStyle: 'sealed', jokers: true, mercato: true, twitchChannel: 'mychannel' });
    const b = new Client('b');
    await b.session(C2S.join, { roomCode: a.view!.code, nickname: 'Bob' });
    expect((await a.act(C2S.start)).ok).toBe(true);

    // Veto the first player while it is revealed.
    const first = await a.waitFor((v) => v.auction?.stage === 'reveal');
    expect((await a.act(C2S.veto, { auctionId: first.auction!.id })).ok).toBe(true);
    const vetoed = await a.waitFor((v) => v.auction?.result?.type === 'vetoed');
    expect(vetoed.participants[0]!.jokers!.veto).toBe(false);

    // Sealed: offers are hidden in the broadcast view until the close.
    const open = await a.waitFor((v) => v.auction?.stage === 'open' && v.auction.id !== first.auction!.id);
    expect((await a.act(C2S.bid, { auctionId: open.auction!.id, amount: 10 })).code).toBe('WRONG_AUCTION_STYLE');
    expect((await a.act(C2S.seal, { auctionId: open.auction!.id, amount: 30 })).ok).toBe(true);
    const hidden = await b.waitFor((v) => (v.auction?.bids.length ?? 0) === 1);
    expect(hidden.auction!.bids[0]!.amount).toBe(0);
    expect((await b.act(C2S.seal, { auctionId: open.auction!.id, amount: 20 })).ok).toBe(true);
    const sold = await a.waitFor((v) => v.auction?.id === open.auction!.id && v.auction.stage === 'closed');
    expect(sold.auction!.result).toMatchObject({ type: 'sold', participantId: a.participantId, amount: 30 });

    // Everyone passes the rest of the draft: free agents complete the teams, then the mercato opens.
    for (const c of [a, b]) {
      c.socket.on(S2C.update, (u: RoomUpdate) => {
        const x = u.view.auction;
        if (x?.stage === 'open' && x.eligible.includes(c.participantId) && !x.passed.includes(c.participantId) && !x.bids.some((bd) => bd.participantId === c.participantId)) {
          void c.act(C2S.pass, { auctionId: x.id });
        }
      });
    }
    const merc = await a.waitFor((v) => v.status === 'mercato', 60000);
    const [ta, tb] = merc.participants;
    const give = ta!.team.starters[4]!;
    const take = tb!.team.starters[4]!;
    expect((await a.act(C2S.offer, { toId: tb!.id, give, take, cash: 0 })).ok).toBe(true);
    const offered = await b.waitFor((v) => (v.mercato?.offers.length ?? 0) === 1);
    expect(offered.characters[give]).toBeDefined();
    expect((await b.act(C2S.respond, { offerId: offered.mercato!.offers[0]!.id, accept: true })).ok).toBe(true);
    const traded = await a.waitFor((v) => v.mercato?.offers[0]?.status === 'accepted');
    expect(traded.participants[0]!.team.starters[4]).toBe(take);
    const sql = await db.query<{ participant_id: string; kind: string }>(
      'SELECT participant_id, kind FROM team_assignments WHERE room_code=$1 AND character_id=$2',
      [merc.code, give],
    );
    expect(sql.rows[0]).toEqual({ participant_id: tb!.id, kind: 'trade' });
    expect((await a.act(C2S.ready)).ok).toBe(true);
    expect((await b.act(C2S.ready)).ok).toBe(true);

    // Two teams: spectator vote, where each chatter counts once.
    await a.waitFor((v) => v.status === 'voting');
    server.queueChatVote(merc.code, { user: 'viewer1', team: 2 });
    server.queueChatVote(merc.code, { user: 'viewer1', team: 1 });
    server.queueChatVote(merc.code, { user: 'viewer2', team: 2 });
    const voted = await a.waitFor((v) => (v.voting?.votes.length ?? 0) === 2);
    expect(voted.voting!.votes.every((x) => x.targetId === tb!.id)).toBe(true);
    expect((await a.act(C2S.closeVote)).ok).toBe(true);
    const end = await a.waitFor((v) => v.status === 'finished');
    expect(end.result!.winnerId).toBe(tb!.id);
  }, 120000);
});
