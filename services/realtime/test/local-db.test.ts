import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireLock, openLocalDb } from '../src/local-db';

process.env.LOG_LEVEL = 'silent';

describe('local development database', () => {
  it('refuses a second server on the same data folder', () => {
    const base = join(mkdtempSync(join(tmpdir(), 'byt-')), 'pglite');
    writeFileSync(`${base}.lock`, String(process.ppid)); // a live process that is not us
    expect(() => acquireLock(base)).toThrow(/utilise déjà/);
    writeFileSync(`${base}.lock`, '999999'); // stale lock (dead pid) is taken over
    const release = acquireLock(base);
    expect(readFileSync(`${base}.lock`, 'utf8')).toBe(String(process.pid));
    release();
    expect(existsSync(`${base}.lock`)).toBe(false);
  });

  it('recovers from a corrupted folder into a fresh one', async () => {
    const base = join(mkdtempSync(join(tmpdir(), 'byt-')), 'pglite');
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, 'PG_VERSION'), 'garbage');
    const db = await openLocalDb(base);
    const res = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM rooms');
    expect(res.rows[0]!.n).toBe(0);
    await db.close();
    expect(existsSync(`${base}.current`)).toBe(true);
    // Next start reuses the recovered folder.
    const again = await openLocalDb(base);
    await again.query('SELECT 1');
    await again.close();
  });
});
