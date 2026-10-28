/**
 * Builds the "Formule 1 · pilotes et écuries réels" dataset from
 * real-players.source.ts. Overall ratings are Build Your Team ESTIMATES (not
 * official ratings); stats come from the role archetype, the traits and a
 * small deterministic variation. No photos, no logos: the UI shows neutral
 * silhouettes.
 *
 *   npx tsx packages/motorsport/scripts/generate-real-dataset.ts
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character } from '@byt/shared';
import { CONSTRUCTORS, DRIVERS, PRINCIPALS } from './real-players.source';

interface Archetype {
  keys: string[];
  /** Multipliers applied to the overall rating, one per key. */
  weights: number[];
  /** Trait letter → stat key. Uppercase letter: +5, lowercase: −6. */
  traits: Record<string, string>;
}

const ARCHETYPES: Record<'PIL' | 'ECU' | 'DIR', Archetype> = {
  PIL: {
    keys: ['QUA', 'RYT', 'DEP', 'PLU', 'REG', 'EXP'],
    weights: [1.0, 1.0, 0.96, 0.94, 0.97, 0.9],
    traits: { Q: 'QUA', R: 'RYT', D: 'DEP', W: 'PLU', C: 'REG', E: 'EXP' },
  },
  ECU: {
    keys: ['MOT', 'AER', 'CHA', 'FIA', 'STR', 'STA'],
    weights: [1.0, 1.0, 0.98, 0.96, 0.95, 0.95],
    traits: { M: 'MOT', A: 'AER', H: 'CHA', F: 'FIA', S: 'STR', P: 'STA' },
  },
  DIR: {
    keys: ['LEA', 'STR', 'TEC', 'POL', 'DEV', 'GES'],
    weights: [1.0, 0.98, 0.92, 0.92, 0.96, 0.97],
    traits: { L: 'LEA', S: 'STR', T: 'TEC', P: 'POL', D: 'DEV', G: 'GES' },
  },
};

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
function build(
  prefix: string,
  role: 'PIL' | 'ECU' | 'DIR',
  name: string,
  shortName: string,
  nationality: string,
  affiliation: string,
  overall: number,
  traits = '',
): Character {
  const id = `${prefix}-${slug(name)}`;
  if (seen.has(id)) throw new Error(`duplicate ${id}`);
  seen.add(id);
  const a = ARCHETYPES[role];
  const attributes: Record<string, number> = {};
  a.keys.forEach((k, i) => (attributes[k] = Math.round(overall * a.weights[i]! + ((hash(`${name}:${k}`) % 7) - 3))));
  for (const t of traits) {
    const stat = a.traits[t.toUpperCase()];
    if (!stat) throw new Error(`unknown trait ${t} for ${name}`);
    attributes[stat] = attributes[stat]! + (t === t.toUpperCase() ? 5 : -6);
  }
  for (const k of a.keys) attributes[k] = clamp(attributes[k]!, 30, 98);
  return { id, name, shortName, nationality, roles: [role], overall, attributes, portraitSeed: hash(name), affiliation };
}

const teamNames = new Set(CONSTRUCTORS.map((c) => c[0]));
for (const [name, , , team] of [...DRIVERS, ...PRINCIPALS]) {
  if (!teamNames.has(team)) throw new Error(`unknown team ${team} for ${name}`);
}

const characters: Character[] = [
  ...DRIVERS.map(([name, short, nat, team, overall, traits]) => build('f1', 'PIL', name, short, nat, team, overall, traits)),
  ...CONSTRUCTORS.map(([name, short, nat, pu, overall, traits]) =>
    build('f1-ecu', 'ECU', name, short, nat, `Moteur ${pu}`, overall, traits),
  ),
  ...PRINCIPALS.map(([name, short, nat, team, overall, traits]) => build('f1-dir', 'DIR', name, short, nat, team, overall, traits)),
];

const payload = {
  dataset: {
    id: 'motorsport-real',
    version: '1.0.0',
    label: 'Formule 1 · pilotes et écuries réels · notes estimées par Build Your Team (non officielles)',
    fictional: false,
    source:
      'Liste Build Your Team — grille indicative de la saison 2026 (22 pilotes, 11 écuries, 11 directeurs) ; notes et statistiques estimées par un modèle interne',
    license:
      "Noms de personnes et d'écuries réelles : usage privé et tests uniquement tant que les droits nom/image (pilotes, écuries, Formula One Management, FIA) ne sont pas acquis. Aucune donnée de jeu vidéo ni note officielle. Aucun logo ni livrée.",
    contentHash: createHash('sha256').update(JSON.stringify(characters)).digest('hex'),
  },
  characters,
};
const out = resolve(import.meta.dirname, '../data/real-players.v1.json');
writeFileSync(out, JSON.stringify(payload, null, 1));
console.log(
  `Wrote ${DRIVERS.length} drivers, ${CONSTRUCTORS.length} constructors, ${PRINCIPALS.length} principals (estimated ratings) → ${out}`,
);
