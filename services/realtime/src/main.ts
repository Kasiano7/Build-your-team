import { resolve } from 'node:path';
import { createDb, migrate } from './db';
import { loadPacks } from './packs';
import { GameServer } from './server';
import { log } from './log';

const port = Number(process.env.PORT ?? 4000);
const databaseUrl = process.env.DATABASE_URL;
const pgliteDir = process.env.PGLITE_DIR ?? resolve(import.meta.dirname, '../.data/pglite');

const db = await createDb(databaseUrl ? { databaseUrl } : { pgliteDir });
const applied = await migrate(db);
if (applied.length) log('info', 'migrations_applied', { applied });

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
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
