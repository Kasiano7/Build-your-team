import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFootballPack, normaliseRows, parseCsv } from '../src';
import { validatePack } from '../../game-engine/src';

const csv = readFileSync(resolve(import.meta.dirname, '../data/samples/sample-import.csv'), 'utf8');

describe('dataset import layer', () => {
  it('parses CSV with quoted fields', () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(7);
    expect(rows[2]!.name).toBe('Doe, Jane');
  });

  it('validates, normalises and de-duplicates', () => {
    const { characters, report } = normaliseRows(parseCsv(csv), 'acme-test');
    expect(report.accepted).toBe(3);
    expect(report.duplicates.map((d) => d.reason)).toEqual(['externalId', 'identity']);
    expect(report.rejected.map((r) => r.row)).toEqual([6, 7]);
    expect(report.rejected[1]!.errors.join()).toMatch(/SHO/);
    const st = characters.find((c) => c.id === 'acme-test:x-001')!;
    expect(st.roles).toEqual(['ST', 'LW', 'RW']);
    expect(st.attributes).toEqual({ PAC: 88, SHO: 85, PAS: 74, DRI: 83, DEF: 40, PHY: 78 });
    const gk = characters.find((c) => c.roles[0] === 'GK')!;
    expect(Object.keys(gk.attributes)).toEqual(['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS']);
  });

  it('a small imported dataset is rejected by pack validation (not enough players per position)', () => {
    const { characters } = normaliseRows(parseCsv(csv), 'acme-test');
    const pack = createFootballPack({
      dataset: { id: 'acme-test', version: '1.0.0', label: 'Test', fictional: true, source: 'test', license: 'test' },
      characters,
    });
    expect(validatePack(pack).length).toBeGreaterThan(0);
  });
});
