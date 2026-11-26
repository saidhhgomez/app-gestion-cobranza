import { persistenceError } from '@/core/errors/AppError';
import { recoverRestore } from '@/features/backup/backup';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migration001 } from './migrations/001';
export const SCHEMA_VERSION = 1;
const names = { real: 'mi-inmueble.db', demo: 'mi-inmueble-demo.db' };
let writeQueue: Promise<unknown> = Promise.resolve();
export function serializeOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.catch(() => undefined);
  return next;
}
export async function transaction<T>(
  db: SQLiteDatabase,
  operation: (tx: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  return serializeOperation(async () => {
    const path = db.databasePath;
    const slash = path.lastIndexOf('/');
    const tx = await openDatabaseAsync(
      path.slice(slash + 1),
      { useNewConnection: true },
      path.slice(0, slash),
    );
    let started = false;
    try {
      await tx.execAsync('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
      const enabled = await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
      if (enabled?.foreign_keys !== 1)
        throw new Error('No se pudo activar la integridad de datos.');
      await tx.execAsync('BEGIN IMMEDIATE');
      started = true;
      const result = await operation(tx);
      await tx.execAsync('COMMIT');
      started = false;
      return result;
    } catch (e) {
      if (started) await tx.execAsync('ROLLBACK');
      throw persistenceError(e);
    } finally {
      await tx.closeAsync();
    }
  });
}
export async function openDatabase(demo = false): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(demo ? names.demo : names.real);
  await db.execAsync('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;');
  await recoverRestore(db, demo);
  await transaction(db, async (tx) => {
    const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > SCHEMA_VERSION)
      throw new Error('Esta base de datos requiere una versión más reciente de la aplicación.');
    if ((version?.user_version ?? 0) < 1) {
      await tx.execAsync(migration001);
      await installGuards(tx);
      await tx.execAsync('PRAGMA user_version=1');
    }
  });
  return db;
}
async function installGuards(db: SQLiteDatabase) {
  for (const table of [
    'payments',
    'payment_allocations',
    'payment_reversals',
    'payment_attachments',
    'meter_readings',
    'receipt_allocations',
    'owner_expenses',
    'charge_items',
    'audit_events',
  ])
    for (const action of ['UPDATE', 'DELETE'])
      await db.execAsync(
        `CREATE TRIGGER ${table}_${action.toLowerCase()}_guard BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'El historial confirmado se conserva.'); END;`,
      );
  await db.execAsync(
    "CREATE TRIGGER charges_delete_guard BEFORE DELETE ON charges BEGIN SELECT RAISE(ABORT,'El historial confirmado se conserva.'); END;",
  );
  for (const table of ['receipt_participants', 'receipt_attachments'])
    for (const action of ['UPDATE', 'DELETE'])
      await db.execAsync(
        `CREATE TRIGGER ${table}_${action.toLowerCase()}_guard BEFORE ${action} ON ${table} WHEN (SELECT confirmed_at FROM master_receipts WHERE id=OLD.receipt_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'El recibo confirmado es inmutable.'); END;`,
      );
  for (const table of ['receipt_participants', 'receipt_attachments', 'receipt_allocations'])
    await db.execAsync(
      `CREATE TRIGGER ${table}_insert_guard BEFORE INSERT ON ${table} WHEN (SELECT confirmed_at FROM master_receipts WHERE id=NEW.receipt_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'El recibo confirmado es inmutable.'); END;`,
    );
}
