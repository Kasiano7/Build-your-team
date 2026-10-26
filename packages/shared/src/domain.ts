/**
 * Core domain model — universe-agnostic.
 *
 * Nothing here assumes football: a "character" has roles (primary first),
 * belongs to a role group and carries a free-form attribute map. A content
 * pack (football, basketball, an animation universe...) supplies the roles,
 * groups, attribute sets, formations and the character catalogue.
 */

/** Money is expressed in integer "millions" of the virtual currency. */
export type Money = number;

export interface AttributeDef {
  key: string;
  label: string;
}

export interface RoleDef {
  id: string;
  label: string;
  /** Role group (e.g. GK/DEF/MID/ATT in football). */
  group: string;
}

export interface RoleGroupDef {
  id: string;
  label: string;
  /** Attribute set key used to render this group's stats. */
  attributeSet: string;
}

export interface TierDef {
  id: string;
  label: string;
  /** Inclusive lower bound of the overall rating. */
  minOverall: number;
  /** Visual style key resolved by the UI theme (universe independent). */
  style: 'bronze' | 'silver' | 'gold' | 'elite' | 'icon';
}

export interface Character {
  id: string;
  name: string;
  shortName: string;
  /** ISO 3166-1 alpha-3 style code or a universe specific affiliation code. */
  nationality: string;
  /** roles[0] is the natural (primary) role, the rest are secondary roles. */
  roles: string[];
  overall: number;
  attributes: Record<string, number>;
  /** Licensed portrait URL, if any. Otherwise the UI renders a procedural avatar. */
  portraitUrl?: string;
  /** Seed for the procedural avatar. */
  portraitSeed: number;
  /** Optional free text, e.g. club or faction. */
  affiliation?: string;
}

export interface FormationSlot {
  id: string;
  label: string;
  /** Role group the slot belongs to. */
  group: string;
  /** Roles considered natural for this slot. */
  preferredRoles: string[];
  /** Normalised pitch coordinates: x 0..1 left→right, y 0..1 own goal→opponent goal. */
  x: number;
  y: number;
}

export interface FormationDef {
  id: string;
  label: string;
  slots: FormationSlot[];
}

export interface GameModeDef {
  id: 'quick' | 'classic';
  label: string;
  description: string;
  defaultBudget: Money;
  allowedBudgets: Money[];
  formationIds: string[];
  defaultFormationId: string;
  benchSize: number;
  /** Whether formation can be changed during the draft. */
  formationChangeAllowed: boolean;
}

export interface DatasetInfo {
  id: string;
  version: string;
  label: string;
  /** True when every character is fictional. Shown in the UI. */
  fictional: boolean;
  source: string;
  license: string;
  contentHash?: string;
}

export interface ContentPackInfo {
  id: string;
  universeId: string;
  universeLabel: string;
  dataset: DatasetInfo;
}

/** A content pack: everything universe specific. */
export interface ContentPack extends ContentPackInfo {
  roles: RoleDef[];
  roleGroups: RoleGroupDef[];
  attributeSets: Record<string, AttributeDef[]>;
  tiers: TierDef[];
  formations: FormationDef[];
  modes: GameModeDef[];
  characters: Character[];
}

/* ------------------------------------------------------------------ */
/* Room / game state (server authoritative)                            */
/* ------------------------------------------------------------------ */

export type RoomStatus = 'lobby' | 'drafting' | 'voting' | 'finished';

export interface RoomSettings {
  packId: string;
  mode: 'quick' | 'classic';
  maxParticipants: 2 | 3 | 4;
  budget: Money;
  minIncrement: Money;
  /** Minimum price of a player and amount reserved per open starter slot. */
  reservePrice: Money;
  openingTimerSec: number;
  bidResetSec: number;
  formationId: string;
  benchSize: number;
  voteTimerSec: number;
  spectatorVoteTimerSec: number;
  /** Safety cap on the number of auctions before free-agent completion. */
  maxAuctions: number;
}

/** Where a character sits in a team. */
export type SlotRef = { kind: 'starter'; index: number } | { kind: 'bench'; index: number };

export interface Purchase {
  characterId: string;
  price: Money;
  auctionNo: number | null;
  kind: 'auction' | 'free_agent';
}

export interface Team {
  formationId: string;
  /** Character id per formation slot index, or null when empty. */
  starters: (string | null)[];
  bench: (string | null)[];
  purchases: Purchase[];
}

export interface Participant {
  id: string;
  nickname: string;
  seat: number;
  color: string;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
  budget: Money;
  team: Team;
}

export interface Bid {
  id: string;
  participantId: string;
  amount: Money;
  at: number;
}

export type AuctionStage = 'reveal' | 'open' | 'closed';

export type AuctionResult =
  | { type: 'sold'; participantId: string; amount: Money; slot: SlotRef }
  | { type: 'unsold' };

export interface Auction {
  id: string;
  no: number;
  characterId: string;
  stage: AuctionStage;
  startedAt: number;
  revealEndsAt: number;
  /** Server time at which bidding ends. Set when the auction opens. */
  endsAt: number | null;
  closedAt: number | null;
  /** Server time at which the next auction (or the end of the draft) starts. */
  nextAt: number | null;
  highBid: Bid | null;
  bids: Bid[];
  passed: string[];
  eligible: string[];
  result: AuctionResult | null;
}

export interface AuctionSummary {
  no: number;
  characterId: string;
  result: AuctionResult;
  bidCount: number;
}

export interface Vote {
  voterId: string;
  voterKind: 'participant' | 'spectator';
  targetId: string;
  at: number;
}

export interface VotingState {
  mode: 'participants' | 'spectators';
  startedAt: number;
  endsAt: number;
  votes: Vote[];
}

export interface TeamStanding {
  participantId: string;
  votes: number;
  teamRating: number;
  spent: Money;
  remaining: Money;
  rank: number;
}

export interface GameResult {
  winnerId: string;
  standings: TeamStanding[];
  tieBreak: null | 'team_rating' | 'remaining_budget' | 'seat';
  totalVotes: number;
  biggestPurchase: { participantId: string; characterId: string; price: Money } | null;
  totalBids: number;
  auctionsPlayed: number;
  finishedAt: number;
}

export interface RoomState {
  code: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  status: RoomStatus;
  settings: RoomSettings;
  participants: Participant[];
  /** Remaining character ids that may still be auctioned. */
  pool: string[];
  unsold: string[];
  auctionCount: number;
  auction: Auction | null;
  history: AuctionSummary[];
  rngState: number;
  voting: VotingState | null;
  result: GameResult | null;
  /** Recently processed action ids, for idempotency. */
  processedActions: string[];
}
