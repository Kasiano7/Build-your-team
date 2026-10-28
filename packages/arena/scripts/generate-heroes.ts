/**
 * Builds the "Arènes de Solcendre · héros originaux" dataset from heroes.source.ts.
 * Every hero is an original Build Your Team creation (invented universe).
 * Stats come from the role archetype, the hero's traits and a small
 * deterministic variation. No portraits: the UI renders a procedural avatar.
 *
 *   npx tsx packages/arena/scripts/generate-heroes.ts
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character } from '@byt/shared';
import { HEROES, REALMS } from './heroes.source';

const KEYS = ['FOR', 'AGI', 'ARN', 'DEF', 'VIT', 'ESP'] as const;
const ROLES = ['GAR', 'LAM', 'ARC', 'MAG', 'SOI', 'AUG'];
/** Multipliers applied to the overall rating, per natural role. */
const ARCHETYPES: Record<string, number[]> = {
  GAR: [0.95, 0.68, 0.55, 1.06, 1.04, 0.8],
  LAM: [1.04, 1.02, 0.55, 0.82, 0.9, 0.72],
  ARC: [0.78, 1.06, 0.62, 0.66, 0.8, 0.9],
  MAG: [0.5, 0.75, 1.07, 0.62, 0.72, 0.98],
  SOI: [0.55, 0.72, 0.95, 0.74, 0.88, 1.04],
  AUG: [0.62, 0.84, 0.94, 0.7, 0.8, 1.03],
};
const TRAIT: Record<string, (typeof KEYS)[number]> = { F: 'FOR', A: 'AGI', R: 'ARN', D: 'DEF', V: 'VIT', E: 'ESP' };

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
    .replace(/œ/g, 'oe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const seen = new Set<string>();
const characters: Character[] = HEROES.map(([name, shortName, realm, rolesStr, overall, traits = '']) => {
  const id = `ar-${slug(name)}`;
  if (seen.has(id)) throw new Error(`duplicate ${id}`);
  seen.add(id);
  const affiliation = REALMS[realm];
  if (!affiliation) throw new Error(`unknown realm ${realm} for ${name}`);
  if (overall < 65 || overall > 97) throw new Error(`overall out of range for ${name}`);
  const roles = rolesStr.split('/');
  for (const r of roles) if (!ROLES.includes(r)) throw new Error(`unknown role ${r} for ${name}`);
  const w = ARCHETYPES[roles[0]!]!;
  const attributes: Record<string, number> = {};
  KEYS.forEach((k, i) => (attributes[k] = Math.round(overall * w[i]! + ((hash(`${name}:${k}`) % 7) - 3))));
  for (const t of traits) {
    const stat = TRAIT[t];
    if (stat) attributes[stat] = attributes[stat]! + 5;
  }
  for (const k of KEYS) attributes[k] = clamp(attributes[k]!, 25, 99);
  return { id, name, shortName, nationality: realm, roles, overall, attributes, portraitSeed: hash(`arena:${name}`), affiliation };
});

const payload = {
  dataset: {
    id: 'arena-heroes',
    version: '1.0.0',
    label: 'Arènes de Solcendre · héros originaux (univers inventé)',
    fictional: true,
    source: 'Contenu original Build Your Team (packages/arena/scripts/generate-heroes.ts) — univers, royaumes et héros inventés',
    license: 'Propriété Build Your Team — contenu original fictif, sans référence à une œuvre existante',
    contentHash: createHash('sha256').update(JSON.stringify(characters)).digest('hex'),
  },
  characters,
};
const out = resolve(import.meta.dirname, '../data/heroes.v1.json');
writeFileSync(out, JSON.stringify(payload, null, 1));
console.log(`Wrote ${characters.length} original heroes → ${out}`);
