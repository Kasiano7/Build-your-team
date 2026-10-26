/**
 * Client side of the realtime protocol. The client never decides anything:
 * it sends intents, renders the server's RoomView and uses fine-grained events
 * only to trigger animations and sounds.
 */
import { AppState, Platform } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import {
  C2S,
  S2C,
  type Ack,
  type CreateRoomInput,
  type ErrorCode,
  type GameEvent,
  type PackMeta,
  type RoomUpdate,
  type RoomView,
  type SessionAck,
  type SlotRef,
  type SpectatorAck,
} from '@byt/shared';
import { serverUrl } from '@/lib/config';
import { getJSON, keys, removeItem, setJSON } from '@/lib/storage';

export type ConnectionState = 'idle' | 'connecting' | 'online' | 'offline';

export interface GameSnapshot {
  connection: ConnectionState;
  role: 'player' | 'spectator' | null;
  roomCode: string | null;
  participantId: string | null;
  spectatorId: string | null;
  spectatorVote: string | null;
  pack: PackMeta | null;
  view: RoomView | null;
  /** serverNow ≈ Date.now() + offsetMs */
  offsetMs: number;
  /** True when the stored session could not be resumed (expired / unknown room). */
  sessionLost: boolean;
  /** True when the host removed this participant from the lobby. */
  removed: boolean;
}

interface StoredSession {
  token: string;
  participantId: string;
  nickname: string;
  savedAt: number;
}

type EventListener = (events: GameEvent[], view: RoomView) => void;

const newActionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;

export class GameClient {
  private socket: Socket | null = null;
  private snapshot: GameSnapshot = {
    connection: 'idle',
    role: null,
    roomCode: null,
    participantId: null,
    spectatorId: null,
    spectatorVote: null,
    pack: null,
    view: null,
    offsetMs: 0,
    sessionLost: false,
    removed: false,
  };
  private listeners = new Set<() => void>();
  private eventListeners = new Set<EventListener>();
  private token: string | null = null;
  private appStateBound = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;

  onEvents(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  serverNow(): number {
    return Date.now() + this.snapshot.offsetMs;
  }

  private set(patch: Partial<GameSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  /* ---------------------------------------------------------------- */

  ensureConnected(): Socket {
    if (this.socket) return this.socket;
    const socket = io(serverUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });
    this.socket = socket;
    this.set({ connection: 'connecting' });
    socket.on('connect', () => {
      this.set({ connection: 'online' });
      void this.syncClock();
      void this.rejoin();
    });
    socket.on('disconnect', () => this.set({ connection: 'offline' }));
    socket.on('connect_error', () => this.set({ connection: 'offline' }));
    socket.on(S2C.update, (u: RoomUpdate) => this.applyUpdate(u));
    // Phones suspend sockets in the background: reconnect as soon as the app is foregrounded.
    if (Platform.OS !== 'web' && !this.appStateBound) {
      this.appStateBound = true;
      AppState.addEventListener('change', (s) => {
        if (s === 'active' && this.socket && !this.socket.connected) this.socket.connect();
      });
    }
    return socket;
  }

  /** Drop the current socket and connect again (e.g. after the server address changed). */
  reconnect() {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.ensureConnected();
  }

  private applyUpdate(u: RoomUpdate) {
    if (u.view.code !== this.snapshot.roomCode) return;
    const current = this.snapshot.view;
    if (current && u.view.version < current.version) return;
    let spectatorVote = this.snapshot.spectatorVote;
    if (this.snapshot.spectatorId && u.view.voting) {
      spectatorVote = u.view.voting.votes.find((v) => v.voterId === this.snapshot.spectatorId)?.targetId ?? spectatorVote;
    }
    const { role, participantId, roomCode } = this.snapshot;
    if (role === 'player' && participantId && !u.view.participants.some((p) => p.id === participantId)) {
      // Removed by the host: forget the local session.
      if (roomCode) void removeItem(keys.session(roomCode));
      this.token = null;
      this.set({ view: u.view, role: null, participantId: null, removed: true });
      return;
    }
    this.set({ view: u.view, spectatorVote });
    if (u.events.length) for (const l of this.eventListeners) l(u.events, u.view);
  }

  private async syncClock() {
    let best: { rtt: number; offset: number } | null = null;
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const res = await this.request<{ serverNow: number }>(C2S.timeSync, { t0 }, 3000).catch(() => null);
      if (!res || !res.ok) continue;
      const t1 = Date.now();
      const rtt = t1 - t0;
      const offset = res.serverNow + rtt / 2 - t1;
      if (!best || rtt < best.rtt) best = { rtt, offset };
    }
    if (best) this.set({ offsetMs: Math.round(best.offset) });
  }

  /** Re-attach after a reconnection. */
  private async rejoin() {
    const { roomCode, role } = this.snapshot;
    if (!roomCode) return;
    if (role === 'player' && this.token) {
      const res = await this.request<SessionAck>(C2S.resume, { roomCode, sessionToken: this.token });
      if (res.ok) this.acceptSession(res, false);
    } else if (role === 'spectator') {
      await this.spectate(roomCode);
    }
  }

  private request<T>(event: string, payload: unknown, timeoutMs = 8000): Promise<Ack<T>> {
    const socket = this.ensureConnected();
    return new Promise((resolve, reject) => {
      socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: Ack<T>) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  /** Mutating command: one actionId, retried once on timeout (the server is idempotent). */
  private async act(event: string, payload: Record<string, unknown>): Promise<Ack> {
    const body = { actionId: newActionId(), ...payload };
    try {
      return await this.request(event, body);
    } catch {
      try {
        return await this.request(event, body);
      } catch {
        return { ok: false, code: 'INTERNAL', message: 'timeout' };
      }
    }
  }

  private acceptSession(ack: SessionAck, persist = true) {
    this.token = ack.sessionToken;
    this.set({
      role: 'player',
      roomCode: ack.roomCode,
      participantId: ack.participantId,
      pack: ack.pack,
      view: ack.view,
      sessionLost: false,
      removed: false,
    });
    if (persist) {
      const me = ack.view.participants.find((p) => p.id === ack.participantId);
      const stored: StoredSession = { token: ack.sessionToken, participantId: ack.participantId, nickname: me?.nickname ?? '', savedAt: Date.now() };
      void setJSON(keys.session(ack.roomCode), stored);
      void setJSON(keys.lastRoom, { code: ack.roomCode, savedAt: Date.now() });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                         */
  /* ---------------------------------------------------------------- */

  async create(input: CreateRoomInput): Promise<Ack<SessionAck>> {
    const res = await this.request<SessionAck>(C2S.create, input).catch(() => offline<SessionAck>());
    if (res.ok) this.acceptSession(res);
    return res;
  }

  async join(roomCode: string, nickname: string): Promise<Ack<SessionAck>> {
    const res = await this.request<SessionAck>(C2S.join, { roomCode, nickname }).catch(() => offline<SessionAck>());
    if (res.ok) this.acceptSession(res);
    return res;
  }

  /** Resume a stored guest session for this room, if any. */
  async resume(roomCode: string): Promise<Ack<SessionAck> | null> {
    if (this.snapshot.roomCode === roomCode && this.snapshot.role === 'player' && this.snapshot.view) {
      return null;
    }
    const stored = await getJSON<StoredSession>(keys.session(roomCode));
    if (!stored) return null;
    this.token = stored.token;
    this.set({ roomCode, role: 'player' });
    const res = await this.request<SessionAck>(C2S.resume, { roomCode, sessionToken: stored.token }).catch(() => offline<SessionAck>());
    if (res.ok) this.acceptSession(res);
    else if (res.code === 'INVALID_SESSION' || res.code === 'ROOM_NOT_FOUND') {
      await removeItem(keys.session(roomCode));
      this.set({ sessionLost: true, role: null });
    }
    return res;
  }

  async spectate(roomCode: string): Promise<Ack<SpectatorAck>> {
    const storedId = await getJSON<string>(keys.spectator(roomCode));
    const res = await this.request<SpectatorAck>(C2S.spectate, { roomCode, ...(storedId ? { spectatorId: storedId } : {}) }).catch(() =>
      offline<SpectatorAck>(),
    );
    if (res.ok) {
      void setJSON(keys.spectator(roomCode), res.spectatorId);
      this.set({
        role: 'spectator',
        roomCode,
        spectatorId: res.spectatorId,
        spectatorVote: res.votedFor,
        pack: res.pack,
        view: res.view,
      });
    }
    return res;
  }

  async spectatorVote(targetId: string): Promise<Ack> {
    const { roomCode, spectatorId } = this.snapshot;
    if (!roomCode || !spectatorId) return { ok: false, code: 'NOT_IN_ROOM' };
    const res = await this.request(C2S.spectatorVote, { roomCode, spectatorId, targetId }).catch(() => offline());
    if (res.ok) this.set({ spectatorVote: targetId });
    return res;
  }

  start = () => this.act(C2S.start, {});
  bid = (amount: number) => this.act(C2S.bid, { auctionId: this.snapshot.view?.auction?.id ?? '', amount });
  pass = () => this.act(C2S.pass, { auctionId: this.snapshot.view?.auction?.id ?? '' });
  swap = (a: SlotRef, b: SlotRef) => this.act(C2S.swap, { a, b });
  formation = (formationId: string) => this.act(C2S.formation, { formationId });
  vote = (targetId: string) => this.act(C2S.vote, { targetId });
  closeVote = () => this.act(C2S.closeVote, {});
  kick = (participantId: string) => this.act(C2S.kick, { participantId });

  async leave(): Promise<void> {
    const { roomCode, view } = this.snapshot;
    if (roomCode && view?.status === 'lobby' && this.snapshot.role === 'player') await this.act(C2S.leave, {});
    if (roomCode) await removeItem(keys.session(roomCode));
    await removeItem(keys.lastRoom);
    this.reset();
  }

  /** Forget the current room locally (does not leave it server side). */
  reset() {
    this.token = null;
    this.set({ role: null, roomCode: null, participantId: null, spectatorId: null, spectatorVote: null, view: null, sessionLost: false, removed: false });
  }
}

function offline<T>(): Ack<T> {
  return { ok: false, code: 'INTERNAL' as ErrorCode, message: 'offline' };
}

export const gameClient = new GameClient();
