/**
 * Builds the "Basket · joueurs réels" dataset from real-players.source.ts.
 * Overall ratings are Build Your Team ESTIMATES (not official ratings);
 * stats come from the position archetype, the player's traits and a small
 * deterministic variation. No photos: the UI shows a neutral silhouette.
 *
 *   npm run data:basketball
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character } from '@byt/shared';
import { REAL_PLAYERS } from './real-players.source';

const KEYS = ['SHT', 'INS', 'PAS', 'DRI', 'DEF', 'REB'] as const;
/** Multipliers applied to the overall rating, per natural position. */
const ARCHETYPES: Record<string, number[]> = {
  PG: [0.95, 0.8, 1.05, 1.05, 0.82, 0.6],
  SG: [1.04, 0.86, 0.9, 0.98, 0.84, 0.62],
  SF: [0.95, 0.92, 0.86, 0.9, 0.9, 0.78],
  PF: [0.84, 1.0, 0.8, 0.8, 0.92, 0.96],
  C: [0.7, 1.04, 0.76, 0.64, 0.95, 1.06],
};
const TRAIT: Record<string, (typeof KEYS)[number]> = { S: 'SHT', I: 'INS', A: 'PAS', D: 'DRI', F: 'DEF', R: 'REB' };

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
const characters: Character[] = REAL_PLAYERS.map(([name, shortName, nationality, rolesStr, team, overall, traits = '']) => {
  const id = `bk-${slug(name)}`;
  if (seen.has(id)) throw new Error(`duplicate ${id}`);
  seen.add(id);
  const roles = rolesStr.split('/');
  const w = ARCHETYPES[roles[0]!];
  if (!w) throw new Error(`unknown position ${roles[0]} for ${name}`);
  const attributes: Record<string, number> = {};
  KEYS.forEach((k, i) => (attributes[k] = Math.round(overall * w[i]! + ((hash(`${name}:${k}`) % 7) - 3))));
  for (const t of traits) {
    const stat = TRAIT[t];
    if (stat) attributes[stat] = attributes[stat]! + 5;
  }
  for (const k of KEYS) attributes[k] = clamp(attributes[k]!, 30, 98);
  return { id, name, shortName, nationality, roles, overall, attributes, portraitSeed: hash(name), affiliation: team };
});

const payload = {
  dataset: {
    id: 'basketball-real',
    version: '1.0.0',
    label: 'Basket · joueurs réels · notes estimées par Build Your Team (non officielles)',
    fictional: false,
    source: 'Liste Build Your Team — effectifs indicatifs saison 2025-2026 ; notes et statistiques estimées par un modèle interne',
    license:
      'Noms de personnes réelles : usage privé et tests uniquement tant que les droits nom/image (syndicat des joueurs, ligue) ne sont pas acquis. Aucune donnée de jeu vidéo ni note officielle.',
    contentHash: createHash('sha256').update(JSON.stringify(characters)).digest('hex'),
  },
  characters,
};
const out = resolve(import.meta.dirname, '../data/real-players.v1.json');
writeFileSync(out, JSON.stringify(payload, null, 1));
console.log(`Wrote ${characters.length} basketball players (estimated ratings) → ${out}`);
