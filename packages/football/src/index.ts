import type { ContentPack } from '@byt/shared';
import real from '../data/real-players.v1.json';
import {
  FOOTBALL_FORMATIONS,
  FOOTBALL_GROUPS,
  FOOTBALL_MODES,
  FOOTBALL_ROLES,
  FOOTBALL_TIERS,
  GOALKEEPER_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
} from './definitions';
import type { DatasetFile } from './import';

export * from './definitions';
export * from './import';

/** Build a football content pack from any dataset (demo or licensed import). */
export function createFootballPack(file: DatasetFile): ContentPack {
  return {
    id: `football:${file.dataset.id}@${file.dataset.version}`,
    universeId: 'football',
    universeLabel: 'Football',
    dataset: file.dataset,
    roles: FOOTBALL_ROLES,
    roleGroups: FOOTBALL_GROUPS,
    attributeSets: { outfield: OUTFIELD_ATTRIBUTES, goalkeeper: GOALKEEPER_ATTRIBUTES },
    tiers: FOOTBALL_TIERS,
    formations: FOOTBALL_FORMATIONS,
    modes: FOOTBALL_MODES,
    characters: file.characters,
  };
}

/** Real footballers with Build Your Team ESTIMATED ratings (not official). Private / test use until name & image rights are licensed. */
export const footballRealPack: ContentPack = createFootballPack(real as unknown as DatasetFile);

/** Packs shipped with the app, default first. */
export const builtInFootballPacks: ContentPack[] = [footballRealPack];
