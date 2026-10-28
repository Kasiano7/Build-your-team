import type { ContentPack, DatasetInfo, Character } from '@byt/shared';
import real from '../data/real-players.v1.json';
import { BASKETBALL_ATTRIBUTES, BASKETBALL_FORMATIONS, BASKETBALL_GROUPS, BASKETBALL_MODES, BASKETBALL_ROLES, BASKETBALL_TIERS } from './definitions';

export * from './definitions';

export interface BasketballDatasetFile {
  dataset: DatasetInfo;
  characters: Character[];
}

/** Build a basketball content pack from any dataset. Same engine, same server, same UI as football. */
export function createBasketballPack(file: BasketballDatasetFile): ContentPack {
  return {
    id: `basketball:${file.dataset.id}@${file.dataset.version}`,
    universeId: 'basketball',
    universeLabel: 'Basketball',
    dataset: file.dataset,
    roles: BASKETBALL_ROLES,
    roleGroups: BASKETBALL_GROUPS,
    attributeSets: { basketball: BASKETBALL_ATTRIBUTES },
    tiers: BASKETBALL_TIERS,
    formations: BASKETBALL_FORMATIONS,
    modes: BASKETBALL_MODES,
    characters: file.characters,
  };
}

/** Real basketball players with Build Your Team ESTIMATED ratings (not official). Private / test use until rights are licensed. */
export const basketballRealPack: ContentPack = createBasketballPack(real as unknown as BasketballDatasetFile);

export const builtInBasketballPacks: ContentPack[] = [basketballRealPack];
