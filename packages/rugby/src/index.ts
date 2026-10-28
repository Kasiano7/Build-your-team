import type { ContentPack, DatasetInfo, Character } from '@byt/shared';
import real from '../data/real-players.v1.json';
import { RUGBY_ATTRIBUTES, RUGBY_FORMATIONS, RUGBY_GROUPS, RUGBY_MODES, RUGBY_ROLES, RUGBY_THEMES, RUGBY_TIERS } from './definitions';

export * from './definitions';

export interface RugbyDatasetFile {
  dataset: DatasetInfo;
  characters: Character[];
}

/** Build a rugby union content pack from any dataset. Same engine, same server, same UI as football. */
export function createRugbyPack(file: RugbyDatasetFile): ContentPack {
  return {
    id: `rugby:${file.dataset.id}@${file.dataset.version}`,
    universeId: 'rugby',
    universeLabel: 'Rugby',
    dataset: file.dataset,
    roles: RUGBY_ROLES,
    roleGroups: RUGBY_GROUPS,
    attributeSets: { rugby: RUGBY_ATTRIBUTES },
    tiers: RUGBY_TIERS,
    formations: RUGBY_FORMATIONS,
    modes: RUGBY_MODES,
    themes: RUGBY_THEMES,
    characters: file.characters,
  };
}

/** Real rugby union players with Build Your Team ESTIMATED ratings (not official). Private / test use until rights are licensed. */
export const rugbyRealPack: ContentPack = createRugbyPack(real as unknown as RugbyDatasetFile);

export const builtInRugbyPacks: ContentPack[] = [rugbyRealPack];
