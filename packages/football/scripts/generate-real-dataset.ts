/**
 * Builds the "Joueurs réels" dataset from real-players.source.ts.
 * Overall ratings are Build Your Team ESTIMATES (not EA SPORTS FC ratings);
 * detailed stats come from the position archetype, the player's traits and a
 * small deterministic variation. No photos: the UI shows a neutral silhouette.
 *
 *   npm run data:real
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character } from '@byt/shared';
import { GK_KEYS, GK_WEIGHTS, OUTFIELD_KEYS, WEIGHTS } from './archetypes';
import { REAL_PLAYERS } from './real-players.source';

const TRAIT_STAT: Record<string, (typeof OUTFIELD_KEYS)[number]> = { P: 'PAC', S: 'SHO', A: 'PAS', D: 'DRI', F: 'DEF', H: 'PHY' };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const seen = new Set<string>();
const characters: Character[] = REAL_PLAYERS.map(([name, shortName, nationality, rolesStr, club, overall, traits = '']) => {
  const id = `real-${slug(name)}`;
  if (seen.has(id)) throw new Error(`duplicate ${id}`);
  seen.add(id);
  const roles = rolesStr.split('/');
  const primary = roles[0]!;
  const seed = hash(name);
  const jitter = (k: string) => ((hash(`${name}:${k}`) % 7) - 3); // −3..+3
  const attributes: Record<string, number> = {};
  if (primary === 'GK') {
    GK_KEYS.forEach((k, i) => (attributes[k] = clamp(Math.round(overall * GK_WEIGHTS[i]! + jitter(k)), 30, 97)));
  } else {
    const w = WEIGHTS[primary];
    if (!w) throw new Error(`unknown position ${primary} for ${name}`);
    OUTFIELD_KEYS.forEach((k, i) => (attributes[k] = Math.round(overall * w[i]! + jitter(k))));
    for (const t of traits) {
      const stat = TRAIT_STAT[t];
      if (stat) attributes[stat] = attributes[stat]! + 6;
    }
    for (const k of OUTFIELD_KEYS) attributes[k] = clamp(attributes[k]!, 30, 97);
  }
  return { id, name, shortName, nationality, roles, overall, attributes, portraitSeed: seed, affiliation: club };
});

const payload = {
  dataset: {
    id: 'football-real',
    version: '1.0.0',
    label: 'Joueurs réels · notes estimées par Build Your Team (non officielles)',
    fictional: false,
    source: 'Liste Build Your Team — effectifs indicatifs saison 2025-2026 ; notes et statistiques estimées par un modèle interne',
    license:
      "Noms de personnes réelles : usage privé et tests uniquement tant que les droits nom/image (FIFPRO, joueurs) ne sont pas acquis. Aucune donnée EA SPORTS FC.",
    contentHash: createHash('sha256').update(JSON.stringify(characters)).digest('hex'),
  },
  characters,
};
const out = resolve(import.meta.dirname, '../data/real-players.v1.json');
writeFileSync(out, JSON.stringify(payload, null, 1));
console.log(`Wrote ${characters.length} real players (estimated ratings) → ${out}`);
