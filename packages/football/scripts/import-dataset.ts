/**
 * Import a LICENSED player dataset (CSV or JSON array) into a versioned file.
 *
 *   npm run data:import -- --file players.csv --id acme-2026 --version 1.0.0 \
 *     --label "ACME 2026" --source "ACME Data Ltd (contrat n°…)" --license "Usage commercial in-app, …"
 *
 * Output: packages/football/data/datasets/<id>@<version>.json + a report.
 * The realtime server loads every file in that folder (or DATASETS_DIR).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { datasetMetaSchema, normaliseRows, parseCsv, type DatasetFile } from '../src/import';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    id: { type: 'string' },
    version: { type: 'string' },
    label: { type: 'string' },
    source: { type: 'string' },
    license: { type: 'string' },
    fictional: { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});

if (!values.file) {
  console.error('Missing --file');
  process.exit(1);
}
const meta = datasetMetaSchema.parse({
  id: values.id,
  version: values.version,
  label: values.label,
  fictional: values.fictional,
  source: values.source,
  license: values.license,
});

const text = readFileSync(resolve(values.file), 'utf8');
const rows: unknown[] = extname(values.file).toLowerCase() === '.json' ? JSON.parse(text) : parseCsv(text);
const { characters, report } = normaliseRows(rows, meta.id);

const outDir = resolve(values.out ?? resolve(import.meta.dirname, '../data/datasets'));
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const target = resolve(outDir, `${meta.id}@${meta.version}.json`);
if (existsSync(target)) {
  console.error(`${target} already exists — bump --version instead of overwriting a published dataset.`);
  process.exit(1);
}
const file: DatasetFile = {
  dataset: { ...meta, contentHash: createHash('sha256').update(JSON.stringify(characters)).digest('hex') },
  characters,
};
writeFileSync(target, JSON.stringify(file, null, 1));
writeFileSync(target.replace(/\.json$/, '.report.json'), JSON.stringify(report, null, 2));
console.log(`Accepted ${report.accepted}, rejected ${report.rejected.length}, duplicates ${report.duplicates.length}`);
console.log(`→ ${target}`);
