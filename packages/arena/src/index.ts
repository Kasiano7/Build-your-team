import type { ContentPack, DatasetInfo, Character } from '@byt/shared';
import heroes from '../data/heroes.v1.json';
import { ARENA_ATTRIBUTES, ARENA_FORMATIONS, ARENA_GROUPS, ARENA_MODES, ARENA_ROLES, ARENA_TIERS } from './definitions';

export * from './definitions';

export const ARENA_UNIVERSE_LABEL = 'Arènes de Solcendre';

export interface ArenaDatasetFile {
  dataset: DatasetInfo;
  characters: Character[];
}

/** Build an "Arènes de Solcendre" content pack from any dataset. Same engine, same server, same UI as football. */
export function createArenaPack(file: ArenaDatasetFile): ContentPack {
  return {
    id: `arena:${file.dataset.id}@${file.dataset.version}`,
    universeId: 'arena',
    universeLabel: ARENA_UNIVERSE_LABEL,
    dataset: file.dataset,
    roles: ARENA_ROLES,
    roleGroups: ARENA_GROUPS,
    attributeSets: { arena: ARENA_ATTRIBUTES },
    tiers: ARENA_TIERS,
    formations: ARENA_FORMATIONS,
    modes: ARENA_MODES,
    characters: file.characters,
  };
}

/** Original fantasy heroes (invented universe, Build Your Team content). */
export const arenaPack: ContentPack = createArenaPack(heroes as unknown as ArenaDatasetFile);

export const builtInArenaPacks: ContentPack[] = [arenaPack];
