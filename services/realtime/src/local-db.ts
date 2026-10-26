/**
 * Local development database (PGlite on disk) safety:
 *  - a lock file prevents two servers from opening the same data folder
 *    (concurrent writers corrupt it);
 *  - if the folder is corrupted anyway (e.g. the process was killed while
 *    writing, which hot reload on Windows does), a fresh database is created in
 *    a new folder (recorded in `<base>.current`), with a clear log line.
 *    Production uses DATABASE_URL.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createDb, migrate, type Db } from './db';
import { log } from './log';

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function acquireLock(dataDir: string): () => void {
  mkdirSync(dirname(dataDir), { recursive: true });
  const lock = `${dataDir}.lock`;
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    if (pid && pid !== process.pid && isAlive(pid)) {
      throw new Error(
        `Un autre serveur de jeu (PID ${pid}) utilise déjà la base locale ${dataDir}. Arrêtez-le, ou lancez celui-ci avec un autre PGLITE_DIR.`,
      );
    }
  }
  writeFileSync(lock, String(process.pid));
  return () => {
    try {
      if (Number(readFileSync(lock, 'utf8')) === process.pid) rmSync(lock);
    } catch {
      // already gone
    }
  };
}

/** The active data folder may differ from the base one after a recovery (see `${base}.current`). */
function activeDir(base: string): string {
  const pointer = `${base}.current`;
  if (existsSync(pointer)) {
    const name = readFileSync(pointer, 'utf8').trim();
    if (name) return join(dirname(base), name);
  }
  return base;
}

export async function openLocalDb(base: string): Promise<Db> {
  const dir = activeDir(base);
  try {
    const db = await createDb({ pgliteDir: dir });
    await migrate(db);
    return db;
  } catch (err) {
    // Windows keeps the crashed folder's files open: never rename/delete it here, start a new one.
    const name = `${basename(base)}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const fresh = join(dirname(base), name);
    log('warn', 'local_db_corrupted', { corrupted: dir, newDir: fresh, err: String(err).slice(0, 160) });
    const db = await createDb({ pgliteDir: fresh });
    await migrate(db);
    writeFileSync(`${base}.current`, name);
    log('warn', 'local_db_recreated', {
      dir: fresh,
      note: `Base locale neuve (dev uniquement, parties précédentes perdues). Vous pouvez supprimer ${dir} une fois le serveur arrêté.`,
    });
    return db;
  }
}
