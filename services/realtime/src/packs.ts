/**
 * Content pack registry: every built-in universe pack (football and
 * basketball real players, rugby real players, Formula 1 real drivers and
 * constructors — all with estimated, non-official ratings — and the original
 * fictional "Arènes de Solcendre" heroes), plus every licensed football
 * dataset found in DATASETS_DIR (produced by `npm run data:import`).
 * There is no fictional football demo pack: football is real players only.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ContentPack } from '@byt/shared';
import { builtInArenaPacks } from '@byt/arena';
import { builtInBasketballPacks } from '@byt/basketball';
import { builtInFootballPacks, createFootballPack, type DatasetFile } from '@byt/football';
import { validatePack } from '@byt/game-engine';
import { builtInMotorsportPacks } from '@byt/motorsport';
import { builtInRugbyPacks } from '@byt/rugby';
import { log } from './log';

export function loadPacks(datasetsDir?: string): ContentPack[] {
  const packs: ContentPack[] = [
    ...builtInFootballPacks,
    ...builtInBasketballPacks,
    ...builtInRugbyPacks,
    ...builtInMotorsportPacks,
    ...builtInArenaPacks,
  ];
  const dir = datasetsDir ?? resolve(import.meta.dirname, '../../../packages/football/data/datasets');
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.report.json'))) {
      const data = JSON.parse(readFileSync(resolve(dir, file), 'utf8')) as DatasetFile;
      packs.push(createFootballPack(data));
    }
  }
  return packs.filter((p) => {
    const errors = validatePack(p);
    if (errors.length) log('error', 'invalid_pack', { pack: p.id, errors: errors.slice(0, 10) });
    return errors.length === 0;
  });
}
