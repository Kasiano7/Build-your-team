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
  /** Set by the server in Mystery mode: overall and attributes are hidden until the auction closes. */
  masked?: boolean;
}

/** A thematic draft: restricts which characters can be auctioned. */
export interface ThemeDef {
  id: string;
  label: string;
  description: string;
  filter: {
    minOverall?: number;
    maxOverall?: number;
    nationalities?: string[];
    excludeNationalities?: string[];
    affiliations?: string[];
  };
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
  /** Optional thematic drafts offered at room creation. */
  themes?: ThemeDef[];
  characters: Character[];
}

/* ------------------------------------------------------------------ */
/* Room / game state (server authoritative)                            */
/* ------------------------------------------------------------------ */

export type RoomStatus = 'lobby' | 'drafting' | 'mercato' | 'voting' | 'finished';

export type AuctionStyle = 'english' | 'dutch' | 'sealed';
export type EndMode = 'vote' | 'vote_sim' | 'sim';

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
  /* Game options (all optional so rooms saved before they existed stay valid). */
  /** 'duo': each team is shared by up to two players. */
  format?: 'solo' | 'duo';
  /** english: open ascending bids · dutch: descending price, first claim wins · sealed: one secret offer each. */
  auctionStyle?: AuctionStyle;
  /** 'eclair': shorter timers and transitions. */
  pace?: 'normal' | 'eclair';
  /** Thematic draft restricting the pool (pack theme id). */
  themeId?: string | null;
  /** Mystery: overall and stats hidden until a player is sold. */
  mystery?: boolean;
  /** Each team gets three single-use jokers (veto, half price, steal). */
  jokers?: boolean;
  /** Trading window between the draft and the vote. */
  mercato?: boolean;
  mercatoTimerSec?: number;
  /** How the game is decided: vote, simulated tournament, or both. */
  endMode?: EndMode;
  /** Twitch channel whose chat may vote (spectator mode) or cheer (participant mode). */
  twitchChannel?: string | null;
}

/** Where a character sits in a team. */
export type SlotRef = { kind: 'starter'; index: number } | { kind: 'bench'; index: number };

export interface Purchase {
  characterId: string;
  price: Money;
  auctionNo: number | null;
  kind: 'auction' | 'free_agent' | 'steal' | 'trade';
}

export interface Team {
  formationId: string;
  /** Character id per formation slot index, or null when empty. */
  starters: (string | null)[];
  bench: (string | null)[];
  purchases: Purchase[];
}

/** A person controlling a team (a team has one member, or two in duo format). */
export interface Member {
  id: string;
  nickname: string;
  connected: boolean;
}

export interface Jokers {
  veto: boolean;
  halfPrice: boolean;
  steal: boolean;
}

export type BotLevel = 'easy' | 'normal' | 'hard';

/** A team. Its `id` is the id of the member who created it. */
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
  /** Present on rooms created since duo support; absent means one member with the team id. */
  members?: Member[];
  bot?: { level: BotLevel };
  jokers?: Jokers;
}

export interface Bid {
  id: string;
  participantId: string;
  amount: Money;
  at: number;
}

export type AuctionStage = 'reveal' | 'open' | 'closed';

export type AuctionResult =
  | { type: 'sold'; participantId: string; amount: Money; slot: SlotRef; halfPrice?: boolean }
  | { type: 'unsold' }
  | { type: 'vetoed'; participantId: string };

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
  /** Auction style used (absent = english). */
  style?: AuctionStyle;
  /** Dutch auction: price starts at `startPrice` and drops by `step` every `stepMs` down to `floor`. */
  dutch?: { startPrice: Money; floor: Money; step: Money; stepMs: number; openedAt: number };
  /** Teams that armed their half-price joker on this auction. */
  halfPriceArmed?: string[];
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
  /** Twitch chat cheers in participant mode (informative, not counted). */
  chat?: { counts: Record<string, number>; voters: string[] };
}

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  /** Character given by `fromId`. */
  give: string;
  /** Character requested from `toId`. */
  take: string;
  /** Extra money paid by `fromId` to `toId`. */
  cash: Money;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  at: number;
}

export interface MercatoState {
  startedAt: number;
  endsAt: number;
  offers: TradeOffer[];
  ready: string[];
  /** Characters sold back to the bank: [teamId, characterId, price]. */
  sales: { participantId: string; characterId: string; price: Money }[];
}

export interface SimMatch {
  round: string;
  aId: string;
  bId: string;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  note?: string;
}

export interface SimulationResult {
  kind: 'matches' | 'race';
  scoreLabel: string;
  matches: SimMatch[];
  /** Team ids, best first. */
  ranking: string[];
  championId: string;
  /** Race only: points per team. */
  points?: Record<string, number>;
}

export interface SeriesState {
  round: number;
  /** Cumulative points per team across rematches. */
  standings: Record<string, number>;
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
  /** Who won the vote (absent when the game is decided by simulation only). */
  voteWinnerId?: string | null;
  simulation?: SimulationResult;
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
  mercato?: MercatoState | null;
  series?: SeriesState;
}
