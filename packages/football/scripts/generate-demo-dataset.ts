/**
 * Generates the FICTIONAL demo dataset (deterministic).
 * Every name, club and rating is invented. Do not present them as real players.
 *
 *   npm run data:demo
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Character } from '@byt/shared';
import { GK_WEIGHTS, WEIGHTS } from './archetypes';

let seed = 0x5eed2026;
function rand(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface NameStyle {
  first: string[];
  pre: string[];
  suf: string[];
  nations: string[];
}

const STYLES: NameStyle[] = [
  {
    first: ['Mateo', 'Iker', 'Dario', 'Hugo', 'Unai', 'Ruben', 'Alvaro', 'Nico', 'Joel', 'Teo', 'Bruno', 'Ismael'],
    pre: ['Bal', 'Cor', 'Ester', 'Gal', 'Ib', 'Lor', 'Mend', 'Navar', 'Olm', 'Quir', 'Sorr', 'Ved', 'Zub'],
    suf: ['ado', 'aleta', 'eño', 'iz', 'osa', 'uela', 'ancho', 'edo', 'ín'],
    nations: ['ESP', 'ARG', 'URU', 'COL'],
  },
  {
    first: ['Enzo', 'Lucas', 'Yanis', 'Théo', 'Malo', 'Rayan', 'Nolan', 'Bastien', 'Kylan', 'Sacha', 'Ilan', 'Maël'],
    pre: ['Bour', 'Chav', 'Dela', 'Four', 'Gir', 'Lam', 'Mor', 'Perr', 'Roch', 'Valm', 'Tess', 'Brun'],
    suf: ['ard', 'eau', 'ier', 'elle', 'on', 'ault', 'et', 'ac', 'ois'],
    nations: ['FRA', 'BEL', 'SUI'],
  },
  {
    first: ['Tiago', 'Rafael', 'Caio', 'Davi', 'Gustavo', 'Vitor', 'Joao', 'Murilo', 'Renan', 'Otavio', 'Lucio', 'Breno'],
    pre: ['Albu', 'Bar', 'Cav', 'Fern', 'Gou', 'Lacer', 'Mour', 'Penh', 'Quint', 'Sequ', 'Tav', 'Vasc'],
    suf: ['eira', 'ão', 'inho', 'ares', 'oso', 'ela', 'ada', 'ilho'],
    nations: ['BRA', 'POR'],
  },
  {
    first: ['Callum', 'Rhys', 'Jaden', 'Mason', 'Ellis', 'Kieran', 'Owen', 'Archie', 'Leon', 'Tyler', 'Reece', 'Jude'],
    pre: ['Ash', 'Brad', 'Craw', 'Fair', 'Hal', 'Kings', 'Mar', 'Pen', 'Ral', 'Stan', 'Thorn', 'Wick'],
    suf: ['ford', 'ley', 'well', 'ton', 'by', 'wood', 'more', 'ridge', 'field'],
    nations: ['ENG', 'USA', 'SCO'],
  },
  {
    first: ['Lukas', 'Jonas', 'Florian', 'Niklas', 'Timo', 'Felix', 'Moritz', 'Jannik', 'Kai', 'Leon', 'Malte', 'Henrik'],
    pre: ['Brand', 'Eisen', 'Falk', 'Grün', 'Hof', 'Kess', 'Lind', 'Rein', 'Stein', 'Wald', 'Vogt', 'Ross'],
    suf: ['mann', 'berg', 'ler', 'hardt', 'ner', 'feld', 'bach', 'inger'],
    nations: ['GER', 'AUT', 'SUI'],
  },
  {
    first: ['Matteo', 'Lorenzo', 'Davide', 'Federico', 'Riccardo', 'Tommaso', 'Gianluca', 'Pietro', 'Samuele', 'Elia', 'Nicolo', 'Andrea'],
    pre: ['Bell', 'Cast', 'Ferr', 'Gall', 'Lomb', 'Mar', 'Pell', 'Ricc', 'Sant', 'Tamb', 'Vit', 'Zanc'],
    suf: ['ini', 'etti', 'ucci', 'ello', 'one', 'ari', 'otto', 'aldi'],
    nations: ['ITA'],
  },
  {
    first: ['Daan', 'Sem', 'Jesper', 'Mads', 'Sander', 'Thijs', 'Emil', 'Oskar', 'Viktor', 'Anders', 'Rune', 'Joep'],
    pre: ['Berg', 'Dijk', 'Holm', 'Jan', 'Kla', 'Lund', 'Mol', 'Ny', 'Strand', 'Veld', 'Ves', 'Ekk'],
    suf: ['stra', 'sen', 'gaard', 'ink', 'man', 'ström', 'hout', 'by'],
    nations: ['NED', 'DEN', 'NOR', 'SWE'],
  },
  {
    first: ['Moussa', 'Ibrahima', 'Cheikh', 'Yaya', 'Seydou', 'Kofi', 'Amadou', 'Ousmane', 'Idrissa', 'Lamine', 'Kwame', 'Bakary'],
    pre: ['Ba', 'Cama', 'Dia', 'Fo', 'Kou', 'Mbo', 'Nda', 'Sa', 'Tou', 'Diop', 'Kan', 'Sy'],
    suf: ['ra', 'kité', 'ssé', 'mba', 'ye', 'llo', 'gou', 'ré'],
    nations: ['SEN', 'CIV', 'MLI', 'GHA', 'NGA', 'CMR'],
  },
  {
    first: ['Hakim', 'Yassine', 'Sofiane', 'Amine', 'Bilal', 'Ilyes', 'Nabil', 'Riyad', 'Zakaria', 'Adam', 'Walid', 'Karim'],
    pre: ['Ben', 'El', 'Bou', 'Haj', 'Mez', 'Tah', 'Zer', 'Am', 'Sl', 'Far'],
    suf: ['nani', 'aoui', 'rifi', 'ami', 'ouz', 'iri', 'ane', 'ali'],
    nations: ['MAR', 'ALG', 'TUN'],
  },
  {
    first: ['Ivan', 'Luka', 'Marko', 'Filip', 'Dominik', 'Nikola', 'Petar', 'Mateusz', 'Kacper', 'Tomas', 'Josip', 'Stefan'],
    pre: ['Bro', 'Kova', 'Mili', 'Novo', 'Pera', 'Rako', 'Siro', 'Vuko', 'Zele', 'Jano', 'Dar', 'Leko'],
    suf: ['vić', 'čić', 'nko', 'wski', 'lić', 'ševic', 'rek', 'jan'],
    nations: ['CRO', 'SRB', 'POL'],
  },
  {
    first: ['Haruto', 'Ren', 'Sota', 'Minjun', 'Jiho', 'Daichi', 'Kaito', 'Seojun', 'Riku', 'Taiga', 'Hyun', 'Yuto'],
    pre: ['Aki', 'Hara', 'Kano', 'Mori', 'Naka', 'Sato', 'Taka', 'Yama', 'Park', 'Kim', 'Lee', 'Jung'],
    suf: ['moto', 'gawa', 'shita', 'da', 'zawa', 'mura', 'woo', 'ho'],
    nations: ['JPN', 'KOR'],
  },
];

const CLUBS = [
  'Aurora FC', 'Nordhavn SK', 'Atlético Sierra', 'Riverside United', 'Lumen 1907', 'Porto Celeste',
  'Vulcano Calcio', 'Ironbridge Town', 'Sporting Atlas', 'Kaiserwald 04', 'Olympique Littoral', 'Dynamo Kestrel',
  'Real Altamar', 'Union Brightwater', 'AC Solaris', 'Racing Meridian',
];

type Pos = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';
const COUNTS: Record<Pos, number> = { GK: 22, CB: 28, LB: 11, RB: 11, CDM: 14, CM: 18, CAM: 13, LM: 7, RM: 7, LW: 13, RW: 13, ST: 23 };

const SECONDARY: Partial<Record<Pos, Pos[]>> = {
  ST: ['LW', 'RW', 'CAM'],
  LW: ['LM', 'ST', 'RW'],
  RW: ['RM', 'ST', 'LW'],
  CAM: ['CM', 'ST', 'LW', 'RW'],
  CM: ['CDM', 'CAM'],
  CDM: ['CM', 'CB'],
  LM: ['LW', 'LB'],
  RM: ['RW', 'RB'],
  CB: ['CDM', 'RB', 'LB'],
  LB: ['LM', 'CB'],
  RB: ['RM', 'CB'],
};

const usedNames = new Set<string>();
function makeName(): { first: string; last: string; nation: string } {
  for (;;) {
    const style = pick(STYLES);
    const first = pick(style.first);
    const last = pick(style.pre) + pick(style.suf);
    const key = `${first} ${last}`;
    if (usedNames.has(key) || usedNames.has(last)) continue;
    usedNames.add(key);
    usedNames.add(last);
    return { first, last, nation: pick(style.nations) };
  }
}

const characters: Character[] = [];
let n = 0;
for (const [pos, count] of Object.entries(COUNTS) as [Pos, number][]) {
  for (let i = 0; i < count; i++) {
    n++;
    const { first, last, nation } = makeName();
    const overall = 64 + Math.round(29 * Math.pow(rand(), 1.6));
    const weights = pos === 'GK' ? GK_WEIGHTS : WEIGHTS[pos]!;
    const keys = pos === 'GK' ? ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] : ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
    const attributes: Record<string, number> = {};
    keys.forEach((k, idx) => {
      attributes[k] = clamp(Math.round(overall * weights[idx]! + (rand() * 10 - 5)), 25, 99);
    });
    const roles: string[] = [pos];
    const sec = SECONDARY[pos];
    if (sec && rand() < 0.42) roles.push(pick(sec));
    characters.push({
      id: `demo-${String(n).padStart(3, '0')}`,
      name: `${first} ${last}`,
      shortName: last,
      nationality: nation,
      roles,
      overall,
      attributes,
      portraitSeed: Math.floor(rand() * 2 ** 31),
      affiliation: pick(CLUBS),
    });
  }
}

const payload = {
  dataset: {
    id: 'football-demo',
    version: '1.0.0',
    label: 'Données de démonstration — joueurs fictifs',
    fictional: true,
    source: 'Généré par Build Your Team (scripts/generate-demo-dataset.ts)',
    license: 'Propriété Build Your Team — contenu original fictif',
    contentHash: createHash('sha256').update(JSON.stringify(characters)).digest('hex'),
  },
  characters,
};

const out = resolve(import.meta.dirname, '../data/demo-players.v1.json');
writeFileSync(out, JSON.stringify(payload, null, 1));
console.log(`Wrote ${characters.length} fictional players → ${out}`);
