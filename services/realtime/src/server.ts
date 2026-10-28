/**
 * Authoritative realtime game server (Socket.IO over HTTP).
 *
 * Concurrency model: every room owns a promise queue. Commands, timer ticks
 * and connection changes for a room run strictly one after another against
 * the latest state; a command's result is persisted (single DB transaction)
 * before it becomes the new state and is broadcast. Two "simultaneous" bids
 * are therefore ordered, and the second one is validated against the first.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import type { ZodType } from 'zod';
import {
  C2S,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  S2C,
  addBotSchema,
  bidSchema,
  claimSchema,
  closeVoteSchema,
  createRoomSchema,
  formationSchema,
  joinRoomSchema,
  kickSchema,
  leaveSchema,
  halfPriceSchema,
  offerSchema,
  passSchema,
  readySchema,
  rematchSchema,
  respondSchema,
  resumeSchema,
  sealSchema,
  sellSchema,
  stealSchema,
  vetoSchema,
  spectateSchema,
  spectatorVoteSchema,
  startSchema,
  swapSchema,
  timeSyncSchema,
  voteSchema,
  type Ack,
  type BotLevel,
  type ContentPack,
  type ErrorCode,
  type GameEvent,
  type RoomState,
  type RoomUpdate,
  type SessionAck,
  type SpectatorAck,
} from '@byt/shared';
import {
  TIMINGS,
  addBot,
  addParticipant,
  advance,
  applyChatVotes,
  buildSettings,
  castVote,
  changeFormation,
  claimAuction,
  closeVoting,
  createRoomState,
  decideBot,
  kickParticipant,
  memberIdsOf,
  nextDeadline,
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
  startGame,
  swapSlots,
  teamOfMember,
  themeShortfall,
  toPackMeta,
  toRoomView,
  useHalfPrice,
  useSteal,
  useVeto,
  type BotAction,
  type EngineCtx,
  type Outcome,
  type Timings,
} from '@byt/game-engine';
import type { Db } from './db';
import { RoomRepository, type PersistMeta } from './repo';
import { log } from './log';
import { TwitchChat, type ChatVote } from './twitch';

export interface ServerOptions {
  db: Db;
  packs: ContentPack[];
  /** < 1 accelerates every timer (integration tests, demos). */
  timeScale?: number;
  corsOrigin?: string | string[];
  /** Max spectator votes accepted from one IP address per room. */
  spectatorVotesPerIp?: number;
  /** Rooms untouched for this many days are deleted (privacy policy: 30). */
  retentionDays?: number;
}

interface RoomRuntime {
  state: RoomState;
  /** sha256(sessionToken) → participantId */
  sessions: Map<string, string>;
  sockets: Map<string, Set<string>>;
  spectatorIps: Map<string, number>;
  queue: Promise<unknown>;
  timer: NodeJS.Timeout | null;
  lastActivity: number;
  botTimer: NodeJS.Timeout | null;
  twitch: TwitchChat | null;
  chatBuffer: ChatVote[];
  chatTimer: NodeJS.Timeout | null;
}

const BOT_NAMES = ['Robo Rival', 'Turbo Bot', 'Algo FC', 'Byte United', 'Neuro Club', 'Pixel Pro', 'Circuit', 'Silicium'];

interface SocketData {
  roomCode?: string;
  participantId?: string;
  spectatorRoom?: string;
  bucket: { tokens: number; at: number };
}

const MAX_PROCESSED_ACTIONS = 300;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const randomId = (prefix: string, bytes = 9) => `${prefix}_${randomBytes(bytes).toString('base64url')}`;

export class GameServer {
  readonly http: HttpServer;
  readonly io: IOServer;
  private readonly repo: RoomRepository;
  private readonly packs = new Map<string, ContentPack>();
  private readonly rooms = new Map<string, RoomRuntime>();
  private readonly timings: Timings;
  private readonly timeScale: number;
  private sweeper: NodeJS.Timeout | null = null;
  private readonly startedAt = Date.now();

  constructor(private readonly opts: ServerOptions) {
    this.repo = new RoomRepository(opts.db);
    for (const p of opts.packs) this.packs.set(p.id, p);
    this.timeScale = opts.timeScale ?? 1;
    this.timings = {
      revealMs: Math.round(TIMINGS.revealMs * this.timeScale),
      soldDisplayMs: Math.round(TIMINGS.soldDisplayMs * this.timeScale),
      unsoldDisplayMs: Math.round(TIMINGS.unsoldDisplayMs * this.timeScale),
    };
    this.http = createHttpServer((req, res) => this.handleHttp(req, res));
    this.io = new IOServer(this.http, {
      cors: { origin: opts.corsOrigin ?? '*' },
      pingInterval: 10000,
      pingTimeout: 8000,
      connectionStateRecovery: undefined,
    });
    this.io.on('connection', (socket) => this.onConnection(socket));
  }

  async start(port: number): Promise<number> {
    for (const pack of this.packs.values()) await this.repo.registerPack(pack);
    for (const state of await this.repo.loadActiveRooms()) {
      if (!this.packs.has(state.settings.packId)) continue;
      const rt = this.makeRuntime(state, await this.repo.loadSessions(state.code));
      for (const p of rt.state.participants) p.connected = false;
      this.rooms.set(state.code, rt);
      this.schedule(rt);
    }
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    void this.purge();
    await new Promise<void>((resolve) => this.http.listen(port, resolve));
    const address = this.http.address();
    const actual = typeof address === 'object' && address ? address.port : port;
    log('info', 'server_started', { port: actual, rooms: this.rooms.size, db: this.opts.db.kind });
    return actual;
  }

  async stop(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const rt of this.rooms.values()) this.dispose(rt);
    await Promise.allSettled([...this.rooms.values()].map((rt) => rt.queue));
    await new Promise<void>((resolve) => this.io.close(() => resolve()));
  }

  /* -------------------------------------------------------------- */

  private ctx(state: RoomState): EngineCtx {
    const pack = this.packs.get(state.settings.packId);
    if (!pack) throw new Error(`Pack ${state.settings.packId} not loaded`);
    return { pack, now: Date.now(), timings: this.timings };
  }

  private makeRuntime(state: RoomState, sessions = new Map<string, string>()): RoomRuntime {
    return {
      state,
      sessions,
      sockets: new Map(),
      spectatorIps: new Map(),
      queue: Promise.resolve(),
      timer: null,
      lastActivity: Date.now(),
      botTimer: null,
      twitch: null,
      chatBuffer: [],
      chatTimer: null,
    };
  }

  /** Stop every timer and connection owned by a room runtime. */
  private dispose(rt: RoomRuntime): void {
    if (rt.timer) clearTimeout(rt.timer);
    if (rt.botTimer) clearTimeout(rt.botTimer);
    if (rt.chatTimer) clearTimeout(rt.chatTimer);
    rt.twitch?.close();
    rt.twitch = null;
  }

  private async getRuntime(code: string): Promise<RoomRuntime | null> {
    const existing = this.rooms.get(code);
    if (existing) return existing;
    const state = await this.repo.loadRoom(code);
    if (!state || !this.packs.has(state.settings.packId)) return null;
    if (this.rooms.has(code)) return this.rooms.get(code)!;
    const rt = this.makeRuntime(state, await this.repo.loadSessions(code));
    for (const p of rt.state.participants) p.connected = false;
    this.rooms.set(code, rt);
    this.schedule(rt);
    return rt;
  }

  /** Serialise work on a room. */
  private run<T>(rt: RoomRuntime, fn: () => Promise<T>): Promise<T> {
    const next = rt.queue.then(fn, fn);
    rt.queue = next.catch(() => undefined);
    rt.lastActivity = Date.now();
    return next;
  }

  /**
   * Persist then publish an engine outcome. Must be called inside `run`.
   * The new state replaces the old one only after the DB commit succeeded.
   */
  private async commit(rt: RoomRuntime, outcome: Outcome, meta: PersistMeta & { actionId?: string } = {}): Promise<Ack> {
    if (!outcome.ok) return { ok: false, code: outcome.code, details: outcome.details };
    if (outcome.state === rt.state) return { ok: true };
    const next = outcome.state;
    if (meta.actionId) {
      next.processedActions = [...next.processedActions, meta.actionId].slice(-MAX_PROCESSED_ACTIONS);
    }
    try {
      await this.repo.persist(next, outcome.events, meta);
    } catch (err) {
      log('error', 'persist_failed', { room: next.code, err: String(err) });
      return { ok: false, code: 'INTERNAL' };
    }
    rt.state = next;
    this.schedule(rt);
    this.broadcast(rt, outcome.events);
    for (const e of outcome.events) {
      if (['game_started', 'auction_sold', 'auction_unsold', 'draft_finished', 'game_finished'].includes(e.type)) {
        log('info', e.type, { room: next.code, ...e });
      }
    }
    return { ok: true };
  }

  private broadcast(rt: RoomRuntime, events: GameEvent[]): void {
    const update: RoomUpdate = { view: toRoomView(rt.state, this.ctx(rt.state).pack, Date.now()), events };
    this.io.to(`room:${rt.state.code}`).emit(S2C.update, update);
  }

  private schedule(rt: RoomRuntime): void {
    if (rt.timer) clearTimeout(rt.timer);
    rt.timer = null;
    this.scheduleBots(rt);
    this.syncTwitch(rt);
    const deadline = nextDeadline(rt.state);
    if (deadline === null) return;
    const delay = Math.max(0, deadline - Date.now()) + 5;
    rt.timer = setTimeout(() => {
      void this.run(rt, async () => {
        const result = await this.commit(rt, advance(rt.state, this.ctx(rt.state)));
        if (!result.ok) {
          // Retry shortly: the deadline is still due.
          rt.timer = setTimeout(() => this.schedule(rt), 500);
        }
      });
    }, delay);
  }

  private lastPurge = 0;
  private async purge(): Promise<void> {
    this.lastPurge = Date.now();
    try {
      const n = await this.repo.purgeOlderThan(this.opts.retentionDays ?? 30);
      if (n) log('info', 'rooms_purged', { count: n });
    } catch (err) {
      log('error', 'purge_failed', { err: String(err) });
    }
  }

  private sweep(): void {
    const now = Date.now();
    if (now - this.lastPurge > 24 * 3600_000) void this.purge();
    for (const [code, rt] of this.rooms) {
      const idle = now - rt.lastActivity;
      const connected = [...rt.sockets.values()].some((s) => s.size > 0);
      const finishedIdle = rt.state.status === 'finished' && idle > 30 * 60_000;
      const abandoned = !connected && idle > 6 * 3600_000;
      if (finishedIdle || abandoned) {
        this.dispose(rt);
        this.rooms.delete(code);
      }
    }
  }

  private async newRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code) && !(await this.repo.roomExists(code))) return code;
    }
    throw new Error('Could not allocate a room code');
  }

  /* -------------------------------------------------------------- */
  /* Sockets                                                         */
  /* -------------------------------------------------------------- */

  private onConnection(socket: Socket): void {
    const data = socket.data as SocketData;
    data.bucket = { tokens: 30, at: Date.now() };

    const handle = <T>(event: string, schema: ZodType<T>, fn: (input: T) => Promise<Ack<Record<string, unknown>>>) => {
      socket.on(event, async (payload: unknown, ack?: (res: unknown) => void) => {
        const reply = typeof ack === 'function' ? ack : () => undefined;
        if (!this.takeToken(data)) return reply({ ok: false, code: 'RATE_LIMITED' });
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          return reply({ ok: false, code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message });
        }
        try {
          reply(await fn(parsed.data));
        } catch (err) {
          log('error', 'handler_failed', { event, err: String(err) });
          reply({ ok: false, code: 'INTERNAL' });
        }
      });
    };

    handle(C2S.timeSync, timeSyncSchema, async ({ t0 }) => ({ ok: true, t0, serverNow: Date.now() }));

    handle(C2S.create, createRoomSchema, async (input) => {
      const pack = this.packs.get(input.packId);
      if (!pack) return fail('UNKNOWN_PACK');
      if (input.themeId && themeShortfall(pack, input.mode, input.themeId, 2).length) return fail('THEME_TOO_SMALL');
      this.detach(socket);
      const code = await this.newRoomCode();
      const participantId = randomId('p');
      const token = randomBytes(32).toString('base64url');
      const settings = this.scaleSettings(buildSettings(pack, input));
      const state = createRoomState({
        code,
        settings,
        host: { id: participantId, nickname: input.nickname },
        seed: randomInt(2 ** 31),
        ctx: { pack, now: Date.now(), timings: this.timings },
      });
      const rt = this.makeRuntime(state);
      this.rooms.set(code, rt);
      return this.run(rt, async () => {
        try {
          await this.repo.persist(state, [{ type: 'participant_joined', participantId }], {
            actorId: participantId,
            newParticipant: { id: participantId, tokenHash: sha256(token) },
          });
        } catch (err) {
          this.rooms.delete(code);
          log('error', 'create_failed', { err: String(err) });
          return fail('INTERNAL');
        }
        rt.sessions.set(sha256(token), participantId);
        this.attach(socket, rt, participantId);
        log('info', 'room_created', { room: code, mode: settings.mode, max: settings.maxParticipants });
        return { ok: true, ...this.sessionAck(rt, participantId, token) };
      });
    });

    handle(C2S.join, joinRoomSchema, async ({ roomCode, nickname, teamId }) => {
      const rt = await this.getRuntime(roomCode);
      if (!rt) return fail('ROOM_NOT_FOUND');
      this.detach(socket);
      return this.run(rt, async () => {
        const participantId = randomId('p');
        const token = randomBytes(32).toString('base64url');
        const result = await this.commit(rt, addParticipant(rt.state, participantId, nickname, this.ctx(rt.state), teamId), {
          actorId: participantId,
          newParticipant: { id: participantId, tokenHash: sha256(token) },
        });
        if (!result.ok) return result;
        rt.sessions.set(sha256(token), participantId);
        this.attach(socket, rt, participantId);
        return { ok: true, ...this.sessionAck(rt, participantId, token) };
      });
    });

    handle(C2S.resume, resumeSchema, async ({ roomCode, sessionToken }) => {
      const rt = await this.getRuntime(roomCode);
      if (!rt) return fail('ROOM_NOT_FOUND');
      return this.run(rt, async () => {
        const participantId = rt.sessions.get(sha256(sessionToken));
        if (!participantId || !teamOfMember(rt.state, participantId)) return fail('INVALID_SESSION');
        this.detach(socket);
        this.attach(socket, rt, participantId);
        await this.commit(rt, setConnected(rt.state, participantId, true, this.ctx(rt.state)));
        return { ok: true, ...this.sessionAck(rt, participantId, sessionToken) };
      });
    });

    const member = async (
      actionId: string,
      fn: (rt: RoomRuntime, participantId: string, ctx: EngineCtx) => Outcome,
      meta: PersistMeta = {},
    ): Promise<Ack> => {
      const code = data.roomCode;
      const participantId = data.participantId;
      if (!code || !participantId) return fail('NOT_IN_ROOM');
      const rt = this.rooms.get(code);
      if (!rt) return fail('ROOM_NOT_FOUND');
      return this.run(rt, async () => {
        // Idempotency: an action id already applied is acknowledged without being re-applied.
        if (rt.state.processedActions.includes(actionId)) return { ok: true, duplicate: true } as Ack;
        return this.commit(rt, fn(rt, participantId, this.ctx(rt.state)), { ...meta, actorId: participantId, actionId });
      });
    };

    handle(C2S.start, startSchema, ({ actionId }) => member(actionId, (rt, pid, ctx) => startGame(rt.state, pid, ctx)));
    handle(C2S.bid, bidSchema, ({ actionId, auctionId, amount }) =>
      member(actionId, (rt, pid, ctx) => placeBid(rt.state, pid, { auctionId, amount, bidId: actionId }, ctx), { bidId: actionId }),
    );
    handle(C2S.pass, passSchema, ({ actionId, auctionId }) =>
      member(actionId, (rt, pid, ctx) => passAuction(rt.state, pid, { auctionId }, ctx)),
    );
    handle(C2S.swap, swapSchema, ({ actionId, a, b }) => member(actionId, (rt, pid, ctx) => swapSlots(rt.state, pid, a, b, ctx)));
    handle(C2S.formation, formationSchema, ({ actionId, formationId }) =>
      member(actionId, (rt, pid, ctx) => changeFormation(rt.state, pid, formationId, ctx)),
    );
    handle(C2S.vote, voteSchema, ({ actionId, targetId }) =>
      member(actionId, (rt, pid, ctx) => castVote(rt.state, { id: pid, kind: 'participant' }, targetId, ctx)),
    );
    handle(C2S.closeVote, closeVoteSchema, ({ actionId }) => member(actionId, (rt, pid, ctx) => closeVoting(rt.state, pid, ctx)));
    handle(C2S.claim, claimSchema, ({ actionId, auctionId }) =>
      member(actionId, (rt, pid, ctx) => claimAuction(rt.state, pid, { auctionId, bidId: actionId }, ctx), { bidId: actionId }),
    );
    handle(C2S.seal, sealSchema, ({ actionId, auctionId, amount }) =>
      member(actionId, (rt, pid, ctx) => sealBid(rt.state, pid, { auctionId, amount, bidId: actionId }, ctx)),
    );
    handle(C2S.veto, vetoSchema, ({ actionId, auctionId }) => member(actionId, (rt, pid, ctx) => useVeto(rt.state, pid, { auctionId }, ctx)));
    handle(C2S.halfPrice, halfPriceSchema, ({ actionId, auctionId }) =>
      member(actionId, (rt, pid, ctx) => useHalfPrice(rt.state, pid, { auctionId }, ctx)),
    );
    handle(C2S.steal, stealSchema, ({ actionId, targetId, characterId }) =>
      member(actionId, (rt, pid, ctx) => useSteal(rt.state, pid, { targetId, characterId }, ctx)),
    );
    handle(C2S.offer, offerSchema, ({ actionId, toId, give, take, cash }) =>
      member(actionId, (rt, pid, ctx) => offerTrade(rt.state, pid, { toId, give, take, cash }, ctx)),
    );
    handle(C2S.respond, respondSchema, ({ actionId, offerId, accept }) =>
      member(actionId, (rt, pid, ctx) => respondTrade(rt.state, pid, { offerId, accept }, ctx)),
    );
    handle(C2S.sell, sellSchema, ({ actionId, characterId }) => member(actionId, (rt, pid, ctx) => sellToBank(rt.state, pid, { characterId }, ctx)));
    handle(C2S.ready, readySchema, ({ actionId }) => member(actionId, (rt, pid, ctx) => setMercatoReady(rt.state, pid, ctx)));
    handle(C2S.rematch, rematchSchema, ({ actionId }) => member(actionId, (rt, pid, ctx) => rematch(rt.state, pid, ctx)));
    handle(C2S.addBot, addBotSchema, ({ actionId, level }) =>
      member(actionId, (rt, pid, ctx) => {
        const used = new Set(rt.state.participants.map((p) => p.nickname));
        const nickname = BOT_NAMES.find((n) => !used.has(n)) ?? 'Bot';
        return addBot(rt.state, pid, { id: randomId('bot'), nickname, level }, ctx);
      }),
    );
    handle(C2S.leave, leaveSchema, async ({ actionId }) => {
      const code = data.roomCode;
      const pid = data.participantId;
      const res = await member(actionId, (rt, p, ctx) => removeParticipant(rt.state, p, ctx));
      if (res.ok && code && pid) {
        const rt = this.rooms.get(code);
        if (rt) for (const [hash, id] of rt.sessions) if (id === pid) rt.sessions.delete(hash);
        this.detach(socket, true);
      }
      return res;
    });

    handle(C2S.kick, kickSchema, async ({ actionId, participantId: target }) => {
      const code = data.roomCode;
      // Every member of the kicked team loses their session (duo: both people).
      let kicked: string[] = [];
      const res = await member(actionId, (rt, pid, ctx) => {
        kicked = memberIdsOf(rt.state, target);
        return kickParticipant(rt.state, pid, target, ctx);
      });
      const rt = code ? this.rooms.get(code) : undefined;
      if (res.ok && rt) {
        for (const [hash, id] of rt.sessions) if (kicked.includes(id)) rt.sessions.delete(hash);
        for (const memberId of kicked) {
          for (const sid of rt.sockets.get(memberId) ?? []) {
            const s = this.io.sockets.sockets.get(sid);
            if (s) {
              // The kicked client still receives this last update, then is detached.
              s.emit(S2C.update, { view: toRoomView(rt.state, this.ctx(rt.state).pack, Date.now()), events: [] });
              this.detach(s, true);
            }
          }
          rt.sockets.delete(memberId);
        }
      }
      return res;
    });

    handle(C2S.spectate, spectateSchema, async ({ roomCode, spectatorId }) => {
      const rt = await this.getRuntime(roomCode);
      if (!rt) return fail('ROOM_NOT_FOUND');
      const id = spectatorId ?? randomId('spec', 16);
      if (data.spectatorRoom) void socket.leave(`room:${data.spectatorRoom}`);
      data.spectatorRoom = roomCode;
      void socket.join(`room:${roomCode}`);
      const vote = rt.state.voting?.votes.find((v) => v.voterId === id) ?? null;
      const ack: SpectatorAck = {
        roomCode,
        spectatorId: id,
        hasVoted: !!vote,
        votedFor: vote?.targetId ?? null,
        pack: toPackMeta(this.ctx(rt.state).pack),
        view: toRoomView(rt.state, this.ctx(rt.state).pack, Date.now()),
      };
      return { ok: true, ...ack };
    });

    handle(C2S.spectatorVote, spectatorVoteSchema, async ({ roomCode, spectatorId, targetId }) => {
      const rt = await this.getRuntime(roomCode);
      if (!rt) return fail('ROOM_NOT_FOUND');
      if (rt.state.participants.some((p) => p.id === spectatorId)) return fail('WRONG_PHASE');
      const ipHash = sha256(`byt:${clientIp(socket)}`);
      return this.run(rt, async () => {
        const limit = this.opts.spectatorVotesPerIp ?? 3;
        const used = rt.spectatorIps.get(ipHash) ?? 0;
        if (used >= limit) return fail('RATE_LIMITED');
        const res = await this.commit(
          rt,
          castVote(rt.state, { id: spectatorId, kind: 'spectator' }, targetId, this.ctx(rt.state)),
          { actorId: spectatorId, ipHash },
        );
        if (res.ok) rt.spectatorIps.set(ipHash, used + 1);
        return res;
      });
    });

    socket.on('disconnect', () => this.detach(socket));
  }

  private takeToken(data: SocketData): boolean {
    const now = Date.now();
    const b = data.bucket;
    b.tokens = Math.min(30, b.tokens + ((now - b.at) / 1000) * 12);
    b.at = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private scaleSettings(settings: RoomState['settings']): RoomState['settings'] {
    if (this.timeScale === 1) return settings;
    const s = this.timeScale;
    return {
      ...settings,
      openingTimerSec: settings.openingTimerSec * s,
      bidResetSec: settings.bidResetSec * s,
      voteTimerSec: settings.voteTimerSec * s,
      spectatorVoteTimerSec: settings.spectatorVoteTimerSec * s,
      mercatoTimerSec: (settings.mercatoTimerSec ?? 90) * s,
    };
  }

  /* -------------------------------------------------------------- */
  /* Bots                                                            */
  /* -------------------------------------------------------------- */

  /**
   * Bots act like people: after a short, random "thinking" delay one bot plays
   * one action through the normal engine command, then the room is
   * re-evaluated. In a dutch auction a waiting bot re-checks at each price step.
   */
  private scheduleBots(rt: RoomRuntime): void {
    if (rt.botTimer) clearTimeout(rt.botTimer);
    rt.botTimer = null;
    const bots = rt.state.participants.filter((p) => p.bot);
    if (!bots.length || rt.state.status === 'lobby' || rt.state.status === 'finished') return;
    const ctx = this.ctx(rt.state);
    const pending = bots.some((b) => decideBot(rt.state, ctx.pack, b.id, ctx.now, Math.random) !== null);
    const a = rt.state.auction;
    const waitingDutch =
      a?.stage === 'open' && a.style === 'dutch' && !!a.dutch && bots.some((b) => a.eligible.includes(b.id) && !a.passed.includes(b.id));
    let delay: number;
    if (pending) delay = (700 + Math.random() * 1800) * this.timeScale;
    else if (waitingDutch) delay = a!.dutch!.stepMs;
    else return;
    rt.botTimer = setTimeout(() => {
      rt.botTimer = null;
      void this.run(rt, async () => {
        const c = this.ctx(rt.state);
        for (const b of [...bots].sort(() => Math.random() - 0.5)) {
          const action = decideBot(rt.state, c.pack, b.id, c.now, Math.random);
          if (!action) continue;
          let outcome = this.botOutcome(rt.state, b.id, action, c);
          // A trade the bot wanted to accept may have become impossible: decline it instead.
          if (!outcome.ok && action.type === 'respond' && action.accept) {
            outcome = this.botOutcome(rt.state, b.id, { ...action, accept: false }, c);
          }
          if (outcome.ok && outcome.state !== rt.state) {
            await this.commit(rt, outcome, { actorId: b.id, bidId: outcome.state.auction?.highBid?.id });
            return;
          }
        }
        this.scheduleBots(rt);
      });
    }, delay);
  }

  private botOutcome(state: RoomState, botId: string, a: BotAction, ctx: EngineCtx): Outcome {
    const auctionId = state.auction?.id ?? '';
    const bidId = randomId('bb');
    switch (a.type) {
      case 'bid':
        return placeBid(state, botId, { auctionId, amount: a.amount, bidId }, ctx);
      case 'claim':
        return claimAuction(state, botId, { auctionId, bidId }, ctx);
      case 'seal':
        return sealBid(state, botId, { auctionId, amount: a.amount, bidId }, ctx);
      case 'pass':
        return passAuction(state, botId, { auctionId }, ctx);
      case 'halfPrice':
        return useHalfPrice(state, botId, { auctionId }, ctx);
      case 'vote':
        return castVote(state, { id: botId, kind: 'participant' }, a.targetId, ctx);
      case 'respond':
        return respondTrade(state, botId, { offerId: a.offerId, accept: a.accept }, ctx);
      case 'ready':
        return setMercatoReady(state, botId, ctx);
    }
  }

  /* -------------------------------------------------------------- */
  /* Twitch chat                                                     */
  /* -------------------------------------------------------------- */

  /** Listen to the room's Twitch chat while the game is running; chat votes are applied in 2 s batches. */
  private syncTwitch(rt: RoomRuntime): void {
    const channel = rt.state.settings.twitchChannel;
    if (!channel || rt.state.status === 'finished' || process.env.TWITCH_DISABLED) {
      rt.twitch?.close();
      rt.twitch = null;
      return;
    }
    if (rt.twitch?.channel === channel) return;
    rt.twitch?.close();
    rt.twitch = new TwitchChat(channel, (v) => this.queueChatVote(rt.state.code, v));
  }

  /** Buffers a chat vote (also used by tests to inject chat messages without a network connection). */
  queueChatVote(code: string, v: ChatVote): void {
    const rt = this.rooms.get(code);
    if (!rt || rt.state.status !== 'voting') return;
    rt.chatBuffer.push(v);
    if (rt.chatTimer) return;
    rt.chatTimer = setTimeout(() => {
      rt.chatTimer = null;
      const batch = rt.chatBuffer.splice(0);
      void this.run(rt, () => this.commit(rt, applyChatVotes(rt.state, batch, this.ctx(rt.state)), { actorId: 'twitch' }));
    }, 2000 * this.timeScale);
  }

  private sessionAck(rt: RoomRuntime, participantId: string, sessionToken: string): SessionAck {
    const pack = this.ctx(rt.state).pack;
    return {
      roomCode: rt.state.code,
      participantId,
      sessionToken,
      pack: toPackMeta(pack),
      view: toRoomView(rt.state, pack, Date.now()),
    };
  }

  private attach(socket: Socket, rt: RoomRuntime, participantId: string): void {
    const data = socket.data as SocketData;
    data.roomCode = rt.state.code;
    data.participantId = participantId;
    void socket.join(`room:${rt.state.code}`);
    const set = rt.sockets.get(participantId) ?? new Set<string>();
    set.add(socket.id);
    rt.sockets.set(participantId, set);
  }

  /** Remove the socket from its room; mark the participant offline when it was their last socket. */
  private detach(socket: Socket, left = false): void {
    const data = socket.data as SocketData;
    const code = data.roomCode;
    const pid = data.participantId;
    data.roomCode = undefined;
    data.participantId = undefined;
    if (!code || !pid) return;
    void socket.leave(`room:${code}`);
    const rt = this.rooms.get(code);
    if (!rt) return;
    const set = rt.sockets.get(pid);
    set?.delete(socket.id);
    if (left || (set && set.size > 0)) return;
    void this.run(rt, () => this.commit(rt, setConnected(rt.state, pid, false, this.ctx(rt.state))));
  }

  /* -------------------------------------------------------------- */
  /* HTTP                                                            */
  /* -------------------------------------------------------------- */

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (url.pathname === '/health') {
      return json(res, 200, {
        ok: true,
        db: this.opts.db.kind,
        rooms: this.rooms.size,
        uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      });
    }
    if (url.pathname === '/api/packs') {
      return json(res, 200, {
        packs: [...this.packs.values()].map((p) => ({ id: p.id, universeId: p.universeId, universeLabel: p.universeLabel, dataset: p.dataset })),
      });
    }
    if (url.pathname === '/api/time') return json(res, 200, { serverNow: Date.now() });
    json(res, 404, { ok: false });
  }
}

function fail(code: ErrorCode): Ack {
  return { ok: false, code };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Client IP for spectator-vote anti-abuse. Proxy headers are only trusted when
 * TRUST_PROXY is set (they can be forged otherwise). Fly.io sets Fly-Client-IP;
 * with a generic proxy the LAST X-Forwarded-For hop is the one it appended.
 */
function clientIp(socket: Socket): string {
  if (process.env.TRUST_PROXY) {
    const h = socket.handshake.headers;
    const fly = h['fly-client-ip'];
    if (typeof fly === 'string' && fly) return fly;
    const fwd = h['x-forwarded-for'];
    const hops = (Array.isArray(fwd) ? fwd.join(',') : fwd ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1]!;
  }
  return socket.handshake.address || 'unknown';
}
