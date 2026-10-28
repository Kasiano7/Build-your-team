/**
 * Shared engine plumbing: context, outcomes, option defaults, timings,
 * themes and team/member lookups. Pure functions only.
 */
import type { Character, ContentPack, ErrorCode, GameEvent, Member, Participant, RoomSettings, RoomState } from '@byt/shared';

export interface EngineCtx {
  pack: ContentPack;
  now: number;
  /** Presentation timings override (tests / accelerated demo servers). */
  timings?: Timings;
}

export type Outcome =
  | { ok: true; state: RoomState; events: GameEvent[] }
  | { ok: false; code: ErrorCode; details?: Record<string, unknown> };

/** Durations of non-configurable presentation phases (ms). */
export const TIMINGS = {
  revealMs: 1000,
  soldDisplayMs: 2400,
  unsoldDisplayMs: 1200,
};
export type Timings = typeof TIMINGS;

export type Failure = Extract<Outcome, { ok: false }>;
export const fail = (code: ErrorCode, details?: Record<string, unknown>): Failure => ({ ok: false, code, details });

export function clone(state: RoomState): RoomState {
  return structuredClone(state);
}

export function bump(state: RoomState, now: number): void {
  state.version += 1;
  state.updatedAt = now;
}

/** Game options with their defaults (rooms saved before an option existed keep working). */
export function opts(s: RoomSettings) {
  return {
    format: s.format ?? 'solo',
    auctionStyle: s.auctionStyle ?? 'english',
    pace: s.pace ?? 'normal',
    themeId: s.themeId ?? null,
    mystery: !!s.mystery,
    jokers: !!s.jokers,
    mercato: !!s.mercato,
    mercatoTimerSec: s.mercatoTimerSec ?? 90,
    endMode: s.endMode ?? 'vote',
    twitchChannel: s.twitchChannel ?? null,
  } as const;
}

/** Presentation timings for a room (Éclair pace shortens them). */
export function timingsFor(ctx: EngineCtx, settings: RoomSettings): Timings {
  const base = ctx.timings ?? TIMINGS;
  if (opts(settings).pace !== 'eclair') return base;
  return { revealMs: Math.round(base.revealMs * 0.7), soldDisplayMs: Math.round(base.soldDisplayMs * 0.65), unsoldDisplayMs: Math.round(base.unsoldDisplayMs * 0.6) };
}

export function findParticipant(state: RoomState, id: string): Participant | undefined {
  return state.participants.find((p) => p.id === id);
}

export function membersOf(p: Participant): Member[] {
  return p.members ?? [{ id: p.id, nickname: p.nickname, connected: p.connected }];
}

/** Team controlled by a member (in solo the team id equals the member id). */
export function teamOfMember(state: RoomState, memberId: string): Participant | undefined {
  return state.participants.find((p) => p.id === memberId || p.members?.some((m) => m.id === memberId));
}

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

export function themeOf(pack: ContentPack, themeId: string | null | undefined) {
  return themeId ? pack.themes?.find((t) => t.id === themeId) ?? null : null;
}

export function matchesTheme(pack: ContentPack, themeId: string | null | undefined, c: Character): boolean {
  const t = themeOf(pack, themeId);
  if (!t) return true;
  const f = t.filter;
  if (f.minOverall !== undefined && c.overall < f.minOverall) return false;
  if (f.maxOverall !== undefined && c.overall > f.maxOverall) return false;
  if (f.nationalities && !f.nationalities.includes(c.nationality)) return false;
  if (f.excludeNationalities && f.excludeNationalities.includes(c.nationality)) return false;
  if (f.affiliations && !(c.affiliation && f.affiliations.includes(c.affiliation))) return false;
  return true;
}

/**
 * Groups for which a theme leaves too few characters for `teams` teams in a
 * mode (every formation of the mode must be fillable). Empty = playable.
 */
export function themeShortfall(pack: ContentPack, modeId: string, themeId: string | null | undefined, teams: number): string[] {
  if (!themeId) return [];
  const mode = pack.modes.find((m) => m.id === modeId);
  if (!mode) return ['mode'];
  const groupOf = new Map(pack.roles.map((r) => [r.id, r.group]));
  const available = new Map<string, number>();
  for (const c of pack.characters) {
    if (!matchesTheme(pack, themeId, c)) continue;
    const g = groupOf.get(c.roles[0] ?? '');
    if (g) available.set(g, (available.get(g) ?? 0) + 1);
  }
  const needed = new Map<string, number>();
  for (const fid of mode.formationIds) {
    const f = pack.formations.find((x) => x.id === fid);
    if (!f) continue;
    const perGroup = new Map<string, number>();
    for (const s of f.slots) perGroup.set(s.group, (perGroup.get(s.group) ?? 0) + 1);
    for (const [g, n] of perGroup) needed.set(g, Math.max(needed.get(g) ?? 0, n));
  }
  return [...needed].filter(([g, n]) => (available.get(g) ?? 0) < n * teams).map(([g]) => g);
}
