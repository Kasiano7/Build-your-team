/**
 * PostgreSQL access.
 *  - Production: real PostgreSQL (Supabase, Neon, RDS…) through `pg`, via DATABASE_URL.
 *  - Local development / tests: PGlite, the actual PostgreSQL engine compiled to WASM,
 *    persisted on disk (PGLITE_DIR) or in memory. Same SQL, same migrations.
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Run a multi-statement script without parameters. */
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  kind: 'pg' | 'pglite';
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createDb(opts: { databaseUrl?: string; pgliteDir?: string } = {}): Promise<Db> {
  if (opts.databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: opts.databaseUrl,
      max: 10,
      ssl: /sslmode=require|supabase|neon/.test(opts.databaseUrl) ? { rejectUnauthorized: false } : undefined,
    });
    return {
      kind: 'pg',
      query: (sql, params) => pool.query(sql, params as unknown[]) as never,
      exec: async (sql) => void (await pool.query(sql)),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn({
            query: (sql, params) => client.query(sql, params as unknown[]) as never,
            exec: async (sql) => void (await client.query(sql)),
          });
          await client.query('COMMIT');
          return out;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  if (opts.pgliteDir) mkdirSync(opts.pgliteDir, { recursive: true });
  const db = opts.pgliteDir ? new PGlite(opts.pgliteDir) : new PGlite();
  await db.waitReady;
  return {
    kind: 'pglite',
    query: (sql, params) => db.query(sql, params) as never,
    exec: async (sql) => void (await db.exec(sql)),
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({ query: (sql, params) => tx.query(sql, params) as never, exec: async (sql) => void (await tx.exec(sql)) }),
      ),
    close: () => db.close(),
  };
}

export function migrationsDir(): string {
  return process.env.MIGRATIONS_DIR ?? resolve(import.meta.dirname, '../../../database/migrations');
}

export async function migrate(db: Db, dir = migrationsDir()): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const sql = readFileSync(resolve(dir, file), 'utf8');
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
    });
    applied.push(file);
  }
  return applied;
}
