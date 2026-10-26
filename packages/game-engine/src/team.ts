/**
 * Team composition rules: slot compatibility, automatic assignment,
 * budget reserve and team rating. Universe independent.
 */
import type {
  Character,
  ContentPack,
  FormationDef,
  FormationSlot,
  Money,
  Participant,
  RoomSettings,
  SlotRef,
  Team,
} from '@byt/shared';

const characterIndexCache = new WeakMap<ContentPack, Map<string, Character>>();

export function characterIndex(pack: ContentPack): Map<string, Character> {
  let index = characterIndexCache.get(pack);
  if (!index) {
    index = new Map(pack.characters.map((c) => [c.id, c]));
    characterIndexCache.set(pack, index);
  }
  return index;
}

export function getCharacter(pack: ContentPack, id: string): Character {
  const c = characterIndex(pack).get(id);
  if (!c) throw new Error(`Unknown character ${id}`);
  return c;
}

export function getFormation(pack: ContentPack, id: string): FormationDef {
  const f = pack.formations.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown formation ${id}`);
  return f;
}

export function roleGroup(pack: ContentPack, roleId: string): string | undefined {
  return pack.roles.find((r) => r.id === roleId)?.group;
}

/**
 * Compatibility score between a character and a tactical slot.
 *  3 — natural role is preferred for the slot
 *  2 — a secondary role is preferred for the slot
 *  1 — natural role belongs to the slot's group ("out of position" but allowed)
 *  0 — incompatible
 */
export function compatibility(pack: ContentPack, character: Character, slot: FormationSlot): 0 | 1 | 2 | 3 {
  const [primary, ...secondary] = character.roles;
  if (primary && slot.preferredRoles.includes(primary)) return 3;
  if (secondary.some((r) => slot.preferredRoles.includes(r))) return 2;
  if (primary && roleGroup(pack, primary) === slot.group) return 1;
  return 0;
}

export function emptyTeam(formation: FormationDef, benchSize: number): Team {
  return {
    formationId: formation.id,
    starters: formation.slots.map(() => null),
    bench: Array.from({ length: benchSize }, () => null),
    purchases: [],
  };
}

export function openStarterCount(team: Team): number {
  return team.starters.filter((s) => s === null).length;
}

export function isTeamComplete(team: Team): boolean {
  return openStarterCount(team) === 0;
}

/**
 * Deterministic placement of a newly acquired character:
 * best compatibility score among empty starter slots, ties broken by slot
 * order; otherwise the first empty bench slot; otherwise null (cannot acquire).
 */
export function bestSlotFor(pack: ContentPack, team: Team, character: Character): SlotRef | null {
  const formation = getFormation(pack, team.formationId);
  let best: { index: number; score: number } | null = null;
  formation.slots.forEach((slot, index) => {
    if (team.starters[index] !== null) return;
    const score = compatibility(pack, character, slot);
    if (score > 0 && (!best || score > best.score)) best = { index, score };
  });
  if (best) return { kind: 'starter', index: (best as { index: number }).index };
  const benchIndex = team.bench.findIndex((s) => s === null);
  if (benchIndex >= 0) return { kind: 'bench', index: benchIndex };
  return null;
}

/**
 * Highest amount a participant may bid for a character without making it
 * impossible to fill their remaining starter slots at the reserve price.
 */
export function maxBidFor(
  pack: ContentPack,
  settings: RoomSettings,
  participant: Participant,
  character: Character,
): Money {
  const target = bestSlotFor(pack, participant.team, character);
  if (!target) return 0;
  const remainingAfter = openStarterCount(participant.team) - (target.kind === 'starter' ? 1 : 0);
  return Math.max(0, participant.budget - settings.reservePrice * remainingAfter);
}

export function canBidOn(
  pack: ContentPack,
  settings: RoomSettings,
  participant: Participant,
  character: Character,
): boolean {
  return maxBidFor(pack, settings, participant, character) >= settings.reservePrice;
}

/** Whether this participant still needs this character for an empty starter slot. */
export function needsCharacter(pack: ContentPack, team: Team, character: Character): boolean {
  const target = bestSlotFor(pack, team, character);
  return target?.kind === 'starter';
}

export function placeCharacter(team: Team, slot: SlotRef, characterId: string): void {
  if (slot.kind === 'starter') team.starters[slot.index] = characterId;
  else team.bench[slot.index] = characterId;
}

export function readSlot(team: Team, slot: SlotRef): string | null | undefined {
  return slot.kind === 'starter' ? team.starters[slot.index] : team.bench[slot.index];
}

/** Average overall of starters, one decimal. Empty slots count as 0. */
export function teamRating(pack: ContentPack, team: Team): number {
  if (team.starters.length === 0) return 0;
  const sum = team.starters.reduce((acc, id) => acc + (id ? getCharacter(pack, id).overall : 0), 0);
  return Math.round((sum / team.starters.length) * 10) / 10;
}

export function teamSpent(team: Team): Money {
  return team.purchases.reduce((acc, p) => acc + p.price, 0);
}

/**
 * Validate a swap between two positions of the same team. A character may only
 * be moved to a starter slot it is compatible with (score > 0). The bench
 * accepts anyone.
 */
export function canSwap(pack: ContentPack, team: Team, a: SlotRef, b: SlotRef): 'ok' | 'INVALID_SLOT' | 'INCOMPATIBLE_SLOT' {
  const formation = getFormation(pack, team.formationId);
  const inRange = (s: SlotRef) =>
    s.kind === 'starter' ? s.index < formation.slots.length : s.index < team.bench.length;
  if (!inRange(a) || !inRange(b)) return 'INVALID_SLOT';
  if (a.kind === b.kind && a.index === b.index) return 'INVALID_SLOT';
  const idA = readSlot(team, a) ?? null;
  const idB = readSlot(team, b) ?? null;
  if (!idA && !idB) return 'INVALID_SLOT';
  const fits = (id: string | null, target: SlotRef) => {
    if (!id || target.kind === 'bench') return true;
    return compatibility(pack, getCharacter(pack, id), formation.slots[target.index]!) > 0;
  };
  if (!fits(idA, b) || !fits(idB, a)) return 'INCOMPATIBLE_SLOT';
  return 'ok';
}

export function applySwap(team: Team, a: SlotRef, b: SlotRef): void {
  const idA = readSlot(team, a) ?? null;
  const idB = readSlot(team, b) ?? null;
  if (a.kind === 'starter') team.starters[a.index] = idB;
  else team.bench[a.index] = idB;
  if (b.kind === 'starter') team.starters[b.index] = idA;
  else team.bench[b.index] = idA;
}

/**
 * Re-seat every character of a team into a new formation using the same
 * deterministic rules as automatic assignment, best players first.
 * Returns null when the new formation cannot host all current starters.
 */
export function reformTeam(pack: ContentPack, team: Team, formation: FormationDef): Team | null {
  const ids = [...team.starters, ...team.bench].filter((x): x is string => !!x);
  const chars = ids.map((id) => getCharacter(pack, id)).sort((x, y) => y.overall - x.overall || x.id.localeCompare(y.id));
  const next: Team = {
    formationId: formation.id,
    starters: formation.slots.map(() => null),
    bench: team.bench.map(() => null),
    purchases: team.purchases,
  };
  // First pass: natural / secondary fits (score ≥ 2), then any compatible slot.
  const leftovers: Character[] = [];
  for (const c of chars) {
    let best: { index: number; score: number } | null = null;
    formation.slots.forEach((slot, index) => {
      if (next.starters[index] !== null) return;
      const score = compatibility(pack, c, slot);
      if (score >= 2 && (!best || score > best.score)) best = { index, score };
    });
    if (best) next.starters[(best as { index: number }).index] = c.id;
    else leftovers.push(c);
  }
  for (const c of leftovers) {
    const slot = bestSlotFor(pack, next, c);
    if (!slot) return null;
    placeCharacter(next, slot, c.id);
  }
  return next;
}
