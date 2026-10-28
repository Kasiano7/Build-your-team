import type { ContentPack, DatasetInfo, Character } from '@byt/shared';
import real from '../data/real-players.v1.json';
import {
  CONSTRUCTOR_ATTRIBUTES,
  DRIVER_ATTRIBUTES,
  MOTORSPORT_FORMATIONS,
  MOTORSPORT_GROUPS,
  MOTORSPORT_MODES,
  MOTORSPORT_ROLES,
  MOTORSPORT_TIERS,
  PRINCIPAL_ATTRIBUTES,
} from './definitions';

export * from './definitions';

export interface MotorsportDatasetFile {
  dataset: DatasetInfo;
  characters: Character[];
}

/** Build a Formula 1 content pack from any dataset. Same engine, same server, same UI as football. */
export function createMotorsportPack(file: MotorsportDatasetFile): ContentPack {
  return {
    id: `motorsport:${file.dataset.id}@${file.dataset.version}`,
    universeId: 'motorsport',
    universeLabel: 'Formule 1',
    dataset: file.dataset,
    roles: MOTORSPORT_ROLES,
    roleGroups: MOTORSPORT_GROUPS,
    attributeSets: { driver: DRIVER_ATTRIBUTES, constructor: CONSTRUCTOR_ATTRIBUTES, principal: PRINCIPAL_ATTRIBUTES },
    tiers: MOTORSPORT_TIERS,
    formations: MOTORSPORT_FORMATIONS,
    modes: MOTORSPORT_MODES,
    characters: file.characters,
  };
}

/** Real 2026 F1 drivers, constructors and team principals with Build Your Team ESTIMATED ratings (not official). Private / test use until rights are licensed. */
export const motorsportRealPack: ContentPack = createMotorsportPack(real as unknown as MotorsportDatasetFile);

export const builtInMotorsportPacks: ContentPack[] = [motorsportRealPack];
