/**
 * Builds the "Rugby · joueurs réels" dataset from real-players.source.ts.
 * Overall ratings are Build Your Team ESTIMATES (not official ratings);
 * stats come from the position archetype, the player's traits and a small
 * deterministic variation. No photos: the UI shows a neutral silhouette.
 *
 *   npx tsx packages/rugby/scripts/generate-real-dataset.ts
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character } from '@byt/shared';
import { REAL_PLAYERS } from './real-players.source';

const KEYS = ['VIT', 'PUI', 'PLA', 'JEU', 'MAI', 'END'] as const;
/** Multipliers applied to the overall rating, per natural position. */
const ARCHETYPES: Record<string, number[]> = {
  PIL: [0.62, 1.06, 0.92, 0.45, 0.66, 0.9],
  TAL: [0.7, 1.0, 0.95, 0.48, 0.78, 0.92],
  '2L': [0.68, 1.02, 0.96, 0.46, 0.74, 0.96],
  '3L': [0.86, 0.94, 1.04, 0.5, 0.8, 1.02],
  N8: [0.83, 1.03, 0.96, 0.52, 0.86, 0.98],
  DM: [0.92, 0.64, 0.8, 0.9, 1.06, 0.96],
  DO: [0.88, 0.62, 0.76, 1.06, 1.03, 0.9],
  CEN: [0.95, 0.92, 0.96, 0.72, 0.9, 0.92],
  AIL: [1.06, 0.8, 0.78, 0.7, 0.86, 0.9],
  ARR: [1.0, 0.76, 0.84, 0.96, 0.9, 0.9],
};
const TRAIT: Record<string, (typeof KEYS)[number]> = { V: 'VIT', P: 'PUI', T: 'PLA', J: 'JEU', M: 'MAI', E: 'END' };

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
  const id = `rg-${slug(name)}`;
  if (seen.has(id)) throw new Error(`duplicate ${id}`);
  seen.add(id);
  const roles = rolesStr.split('/');
  const w = ARCHETYPES[roles[0]!];
  if (!w) throw new Error(`unknown position ${roles[0]} for ${name}`);
  for (const r of roles) if (!ARCHETYPES[r]) throw new Error(`unknown secondary position ${r} for ${name}`);
  const attributes: Record<string, number> = {};
  KEYS.forEach((k, i) => (attributes[k] = Math.round(overall * w[i]! + ((hash(`${name}:${k}`) % 7) - 3))));
  for (const t of traits) {
    const stat = TRAIT[t];
    if (!stat) throw new Error(`unknown trait ${t} for ${name}`);
    attributes[stat] = attributes[stat]! + 5;
  }
  for (const k of KEYS) attributes[k] = clamp(attributes[k]!, 30, 98);
  return { id, name, shortName, nationality, roles, overall, attributes, portraitSeed: hash(name), affiliation: club };
});

const payload = {
  dataset: {
    id: 'rugby-real',
    version: '1.0.0',
    label: 'Rugby · joueurs réels · notes estimées par Build Your Team (non officielles)',
    fictional: false,
    source: 'Liste Build Your Team — internationaux, clubs indicatifs saison 2025-2026 ; notes et statistiques estimées par un modèle interne',
    license:
      'Noms de personnes réelles : usage privé et tests uniquement tant que les droits nom/image (joueurs, fédérations, ligues) ne sont pas acquis. Aucune donnée de jeu vidéo ni note officielle.',
    contentHash: createHash('sha256').update(JSON.stringify(characters)).digest('hex'),
  },
  characters,
};
const out = resolve(import.meta.dirname, '../data/real-players.v1.json');
writeFileSync(out, JSON.stringify(payload, null, 1));
const groups: Record<string, string> = { PIL: 'AV', TAL: 'AV', '2L': 'AV', '3L': 'AV', N8: 'AV', DM: 'DE', DO: 'DE', CEN: 'TQ', AIL: 'TQ', ARR: 'TQ' };
const count: Record<string, number> = {};
for (const c of characters) count[groups[c.roles[0]!]!] = (count[groups[c.roles[0]!]!] ?? 0) + 1;
console.log(`Wrote ${characters.length} rugby players (estimated ratings) ${JSON.stringify(count)} → ${out}`);
