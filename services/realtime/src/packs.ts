/**
 * Content pack registry: the built-in fictional demo pack plus every licensed
 * dataset found in DATASETS_DIR (produced by `npm run data:import`).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ContentPack } from '@byt/shared';
import { builtInBasketballPacks } from '@byt/basketball';
import { builtInFootballPacks, createFootballPack, type DatasetFile } from '@byt/football';
import { validatePack } from '@byt/game-engine';
import { log } from './log';

export function loadPacks(datasetsDir?: string): ContentPack[] {
  const packs: ContentPack[] = [...builtInFootballPacks, ...builtInBasketballPacks];
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
