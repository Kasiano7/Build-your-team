import { resolve } from 'node:path';
import { createDb, migrate, type Db } from './db';
import { acquireLock, openLocalDb } from './local-db';
import { loadPacks } from './packs';
import { GameServer } from './server';
import { log } from './log';

const port = Number(process.env.PORT ?? 4000);
const databaseUrl = process.env.DATABASE_URL;
const pgliteDir = process.env.PGLITE_DIR ?? resolve(import.meta.dirname, '../.data/pglite');

let db: Db;
let releaseLock = () => {};
if (databaseUrl) {
  db = await createDb({ databaseUrl });
  const applied = await migrate(db);
  if (applied.length) log('info', 'migrations_applied', { applied });
} else {
  // The anti-double-server lock protects local development (Windows hot reload).
  // In production a single container owns the volume, and a stale lock left on
  // the persistent disk must never block a restart.
  if (process.env.NODE_ENV !== 'production') {
    try {
      releaseLock = acquireLock(pgliteDir);
    } catch (err) {
      log('error', 'local_db_locked', { message: (err as Error).message });
      process.exit(1);
    }
    process.on('exit', () => releaseLock());
  }
  db = await openLocalDb(pgliteDir);
}

const server = new GameServer({
  db,
  packs: loadPacks(process.env.DATASETS_DIR),
  timeScale: process.env.TIME_SCALE ? Number(process.env.TIME_SCALE) : 1,
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
});
await server.start(port);

const shutdown = async () => {
  log('info', 'shutting_down');
  await server.stop();
  await db.close();
  releaseLock();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
