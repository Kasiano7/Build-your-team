/**
 * Dataset import layer, independent from any provider.
 *
 * Accepts CSV or JSON rows from a LICENSED source, validates them against a
 * strict schema, normalises them into Characters, removes duplicates and
 * reports every rejected row. Hashing and file I/O live in the CLI script so
 * this module stays runtime agnostic (Node, React Native, browser).
 */
import { z } from 'zod';
import type { Character, DatasetInfo } from '@byt/shared';
import { FOOTBALL_ROLES } from './definitions';

const ROLE_IDS = FOOTBALL_ROLES.map((r) => r.id) as [string, ...string[]];
const stat = z.coerce.number().int().min(1).max(99);
const optionalStat = z.preprocess((v) => (v === '' || v === null ? undefined : v), stat.optional());

export const importedPlayerSchema = z
  .object({
    externalId: z.string().trim().min(1).max(64),
    name: z.string().trim().min(2).max(64),
    shortName: z.string().trim().min(1).max(24).optional(),
    nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2,3}$/),
    position: z.enum(ROLE_IDS),
    secondaryPositions: z
      .preprocess(
        (v) => (typeof v === 'string' ? v.split(/[|;,]/).map((s) => s.trim()).filter(Boolean) : v ?? []),
        z.array(z.enum(ROLE_IDS)).max(3),
      )
      .default([]),
    overall: stat,
    birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    club: z.string().trim().max(64).optional(),
    portraitUrl: z.string().url().optional(),
    PAC: optionalStat,
    SHO: optionalStat,
    PAS: optionalStat,
    DRI: optionalStat,
    DEF: optionalStat,
    PHY: optionalStat,
    DIV: optionalStat,
    HAN: optionalStat,
    KIC: optionalStat,
    REF: optionalStat,
    SPD: optionalStat,
    POS: optionalStat,
  })
  .superRefine((row, ctx) => {
    const keys = row.position === 'GK' ? (['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] as const) : (['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const);
    for (const k of keys) {
      if (row[k] === undefined) ctx.addIssue({ code: 'custom', path: [k], message: `missing ${k} for ${row.position}` });
    }
  });
export type ImportedPlayer = z.infer<typeof importedPlayerSchema>;

export const datasetMetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,48}$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  label: z.string().min(3).max(80),
  fictional: z.boolean(),
  source: z.string().min(3).max(200),
  license: z.string().min(3).max(500),
});

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()])));
}

export interface ImportReport {
  accepted: number;
  rejected: { row: number; errors: string[] }[];
  duplicates: { row: number; reason: string; keptExternalId: string }[];
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Validate and normalise rows. Duplicates are detected by externalId and by
 * (name, birthDate, nationality); the first occurrence wins.
 */
export function normaliseRows(rows: unknown[], datasetId: string): { characters: Character[]; report: ImportReport } {
  const report: ImportReport = { accepted: 0, rejected: [], duplicates: [] };
  const byExternal = new Map<string, string>();
  const byIdentity = new Map<string, string>();
  const characters: Character[] = [];
  rows.forEach((raw, i) => {
    const parsed = importedPlayerSchema.safeParse(raw);
    if (!parsed.success) {
      report.rejected.push({ row: i + 1, errors: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`) });
      return;
    }
    const p = parsed.data;
    const identity = `${p.name.toLowerCase()}|${p.birthDate ?? ''}|${p.nationality}`;
    const dupExt = byExternal.get(p.externalId);
    const dupId = byIdentity.get(identity);
    if (dupExt || dupId) {
      report.duplicates.push({ row: i + 1, reason: dupExt ? 'externalId' : 'identity', keptExternalId: (dupExt ?? dupId)! });
      return;
    }
    byExternal.set(p.externalId, p.externalId);
    byIdentity.set(identity, p.externalId);
    const keys = p.position === 'GK' ? (['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] as const) : (['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const);
    const attributes: Record<string, number> = {};
    for (const k of keys) attributes[k] = p[k]!;
    const roles = [p.position, ...p.secondaryPositions.filter((r) => r !== p.position)];
    characters.push({
      id: `${datasetId}:${p.externalId}`,
      name: p.name,
      shortName: p.shortName ?? p.name.split(' ').slice(-1)[0]!,
      nationality: p.nationality,
      roles,
      overall: p.overall,
      attributes,
      portraitSeed: hashSeed(p.externalId),
      ...(p.portraitUrl ? { portraitUrl: p.portraitUrl } : {}),
      ...(p.club ? { affiliation: p.club } : {}),
    });
    report.accepted++;
  });
  return { characters, report };
}

export interface DatasetFile {
  dataset: DatasetInfo;
  characters: Character[];
}
