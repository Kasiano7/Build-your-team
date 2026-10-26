/**
 * Client ⇄ server realtime contract (Socket.IO).
 *
 * Every client command is validated with these schemas on the server.
 * Mutating commands carry an `actionId` (client generated, unique) so a
 * retried command is applied at most once.
 */
import { z } from 'zod';
import type {
  Auction,
  AuctionSummary,
  Character,
  ContentPack,
  GameResult,
  Participant,
  RoomSettings,
  RoomStatus,
  VotingState,
} from './domain';

export const ROOM_CODE_LENGTH = 6;
/** Unambiguous alphabet: no 0/O, 1/I/L. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, 'NICKNAME_TOO_SHORT')
  .max(16, 'NICKNAME_TOO_LONG')
  .regex(/^[\p{L}\p{N} _.\-']+$/u, 'NICKNAME_INVALID');

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`));

export const actionIdSchema = z.string().min(8).max(64);

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  packId: z.string().min(1).max(64),
  mode: z.enum(['quick', 'classic']),
  maxParticipants: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  budget: z.number().int().min(50).max(2000).optional(),
  openingTimerSec: z.number().int().min(8).max(60).optional(),
  bidResetSec: z.number().int().min(5).max(30).optional(),
  formationId: z.string().max(32).optional(),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({ roomCode: roomCodeSchema, nickname: nicknameSchema });
export const resumeSchema = z.object({ roomCode: roomCodeSchema, sessionToken: z.string().min(20).max(128) });
export const startSchema = z.object({ actionId: actionIdSchema });
export const bidSchema = z.object({
  actionId: actionIdSchema,
  auctionId: z.string().min(1).max(64),
  amount: z.number().int().positive().max(100000),
});
export const passSchema = z.object({ actionId: actionIdSchema, auctionId: z.string().min(1).max(64) });

export const slotRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('starter'), index: z.number().int().min(0).max(30) }),
  z.object({ kind: z.literal('bench'), index: z.number().int().min(0).max(10) }),
]);
export const swapSchema = z.object({ actionId: actionIdSchema, a: slotRefSchema, b: slotRefSchema });
export const formationSchema = z.object({ actionId: actionIdSchema, formationId: z.string().min(1).max(32) });
export const voteSchema = z.object({ actionId: actionIdSchema, targetId: z.string().min(1).max(64) });
export const closeVoteSchema = z.object({ actionId: actionIdSchema });
export const leaveSchema = z.object({ actionId: actionIdSchema });

export const spectateSchema = z.object({
  roomCode: roomCodeSchema,
  spectatorId: z.string().min(16).max(64).optional(),
});
export const spectatorVoteSchema = z.object({
  roomCode: roomCodeSchema,
  spectatorId: z.string().min(16).max(64),
  targetId: z.string().min(1).max(64),
});
export const timeSyncSchema = z.object({ t0: z.number() });

/** Socket event names. */
export const C2S = {
  create: 'room:create',
  join: 'room:join',
  resume: 'room:resume',
  leave: 'room:leave',
  start: 'room:start',
  bid: 'auction:bid',
  pass: 'auction:pass',
  swap: 'team:swap',
  formation: 'team:formation',
  vote: 'vote:cast',
  closeVote: 'vote:close',
  spectate: 'spectator:join',
  spectatorVote: 'spectator:vote',
  timeSync: 'time:sync',
} as const;

export const S2C = {
  update: 'room:update',
} as const;

export type ErrorCode =
  | 'INVALID_PAYLOAD'
  | 'RATE_LIMITED'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'NOT_IN_ROOM'
  | 'INVALID_SESSION'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'WRONG_PHASE'
  | 'STALE_AUCTION'
  | 'AUCTION_NOT_OPEN'
  | 'NOT_ELIGIBLE'
  | 'ALREADY_PASSED'
  | 'ALREADY_HIGHEST'
  | 'BID_TOO_LOW'
  | 'INSUFFICIENT_BUDGET'
  | 'HIGHEST_CANNOT_PASS'
  | 'INVALID_SLOT'
  | 'INCOMPATIBLE_SLOT'
  | 'FORMATION_LOCKED'
  | 'UNKNOWN_FORMATION'
  | 'CANNOT_VOTE_OWN_TEAM'
  | 'ALREADY_VOTED'
  | 'UNKNOWN_TARGET'
  | 'VOTE_CLOSED'
  | 'UNKNOWN_PACK'
  | 'INTERNAL';

export type Ack<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; code: ErrorCode; message?: string; details?: Record<string, unknown> };

/** Public, client-safe projection of a room. Never contains session tokens or the RNG state. */
export interface RoomView {
  code: string;
  version: number;
  status: RoomStatus;
  settings: RoomSettings;
  participants: Participant[];
  poolSize: number;
  auctionCount: number;
  auction: Auction | null;
  history: AuctionSummary[];
  voting: VotingState | null;
  result: GameResult | null;
  /** Characters referenced by the view (current auction, teams, history). */
  characters: Record<string, Character>;
  serverNow: number;
}

/** Content pack metadata sent once on join (no catalogue). */
export type PackMeta = Omit<ContentPack, 'characters'>;

export interface RoomUpdate {
  view: RoomView;
  events: GameEvent[];
}

export interface SessionAck {
  roomCode: string;
  participantId: string;
  sessionToken: string;
  pack: PackMeta;
  view: RoomView;
}

export interface SpectatorAck {
  roomCode: string;
  spectatorId: string;
  hasVoted: boolean;
  votedFor: string | null;
  pack: PackMeta;
  view: RoomView;
}

/** Fine grained events used by clients to drive animations and sounds. */
export type GameEvent =
  | { type: 'participant_joined'; participantId: string }
  | { type: 'participant_left'; participantId: string }
  | { type: 'participant_connection'; participantId: string; connected: boolean }
  | { type: 'game_started' }
  | { type: 'auction_revealed'; auctionId: string; characterId: string; no: number }
  | { type: 'auction_opened'; auctionId: string; endsAt: number }
  | { type: 'bid_placed'; auctionId: string; participantId: string; amount: number; endsAt: number }
  | { type: 'participant_passed'; auctionId: string; participantId: string }
  | {
      type: 'auction_sold';
      auctionId: string;
      characterId: string;
      participantId: string;
      amount: number;
      slotKind: 'starter' | 'bench';
      slotIndex: number;
    }
  | { type: 'auction_unsold'; auctionId: string; characterId: string }
  | { type: 'team_changed'; participantId: string }
  | { type: 'free_agent_assigned'; participantId: string; characterId: string; price: number }
  | { type: 'draft_finished' }
  | { type: 'voting_started'; mode: 'participants' | 'spectators'; endsAt: number }
  | { type: 'vote_cast'; voterKind: 'participant' | 'spectator'; voterId: string }
  | { type: 'game_finished'; winnerId: string };
