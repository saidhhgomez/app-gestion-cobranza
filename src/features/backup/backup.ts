import { brand } from '@/core/config/brand';
import type { Attachment, Repository } from '@/core/contracts';
import { serializeOperation } from '@/core/database/database';
import { attachmentFile, attachmentRoot } from '@/core/storage/attachments';
import { fromByteArray, toByteArray } from 'base64-js';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import {
  MAX_BACKUP_BYTES,
  assertBase64,
  canonicalJson,
  decodeEnvelope,
  type Payload,
} from './validation';
const hashString = (text: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
async function hash(bytes: Uint8Array) {
  const result = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    new Uint8Array(bytes).buffer,
  );
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, '0')).join('');
}
const recoveryRoot = (demo: boolean) =>
  new Directory(Paths.document, demo ? 'recovery-demo' : 'recovery-real');
async function put(file: File, value: string | Uint8Array) {
  file.create({ overwrite: true });
  await file.write(value);
}
function marker(root: Directory, name: string, value: unknown) {
  const temp = new File(root, `temp-${Crypto.randomUUID()}.json`);
  temp.create();
  temp.writeSync(JSON.stringify(value));
  temp.moveSync(new File(root, name));
}
function portable(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  if (String.fromCharCode(...copy.slice(0, 15)) !== 'SQLite format 3')
    throw new Error('La instantánea no contiene una base SQLite válida.');
  copy[18] = 1;
  copy[19] = 1;
  return copy;
}
async function check(db: SQLite.SQLiteDatabase) {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version?.user_version !== 1) throw new Error('La versión del esquema no es compatible.');
  const integrity = await db.getAllAsync<Record<string, string>>('PRAGMA integrity_check');
  if (integrity.length !== 1 || Object.values(integrity[0] ?? {})[0] !== 'ok')
    throw new Error('La base de datos está dañada.');
  if ((await db.getAllAsync('PRAGMA foreign_key_check')).length)
    throw new Error('Hay relaciones de datos inconsistentes.');
  const invalid = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) n FROM charge_balances WHERE balance_cents<0 OR paid_cents<0',
  );
  if (invalid?.n) throw new Error('El respaldo contiene saldos inconsistentes.');
  const payments = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) n FROM payments p WHERE p.amount_cents<>coalesce((SELECT sum(a.amount_cents) FROM payment_allocations a WHERE a.payment_id=p.id),0)',
  );
  if (payments?.n) throw new Error('El reparto de los pagos está incompleto.');
}
async function schema(db: SQLite.SQLiteDatabase) {
  return JSON.stringify(
    await db.getAllAsync(
      'SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE ? ORDER BY type,name',
      'sqlite_%',
    ),
  );
}
async function writeBackup(db: SQLite.SQLiteDatabase, demo: boolean): Promise<string> {
  const bytes = portable(await db.serializeAsync());
  const files: Payload['files'] = [];
  let total = bytes.length;
  const references = await db.getAllAsync<Attachment>(
    'SELECT * FROM receipt_attachments UNION ALL SELECT id,payment_id,relative_path,name,mime_type,size,NULL AS meter_id FROM payment_attachments ORDER BY relative_path',
  );
  for (const a of references) {
    const file = attachmentFile(a.relative_path, demo);
    if (!file.exists || file.size !== a.size)
      throw new Error(`Falta el documento ${a.name}. Revisa los adjuntos antes de respaldar.`);
    total += file.size;
    if (total > MAX_BACKUP_BYTES / 1.4)
      throw new Error('El respaldo supera el límite portable de 80 MB.');
    const content = await file.bytes();
    files.push({
      path: a.relative_path,
      size: content.length,
      hash: await hash(content),
      base64: fromByteArray(content),
    });
  }
  const payload: Payload = {
    format: 'mi-inmueble-backup',
    version: 1,
    schemaVersion: 1,
    appVersion: brand.version,
    createdAt: new Date().toISOString(),
    mode: demo ? 'demo' : 'real',
    database: { size: bytes.length, hash: await hash(bytes), base64: fromByteArray(bytes) },
    files,
  };
  const text = JSON.stringify({ payload, hash: await hashString(canonicalJson(payload)) });
  if (text.length > MAX_BACKUP_BYTES) throw new Error('El respaldo supera 80 MB.');
  const directory = new Directory(Paths.document, 'backups');
  directory.create({ idempotent: true, intermediates: true });
  const out = new File(
    directory,
    `mi-inmueble-${demo ? 'demo' : 'real'}-${Crypto.randomUUID()}.json`,
  );
  await put(out, text);
  return out.uri;
}
export async function createBackup(db: SQLite.SQLiteDatabase, repo: Repository, demo: boolean) {
  const uri = await serializeOperation(() => writeBackup(db, demo));
  await repo.setSetting('last_backup', new Date().toISOString());
  return uri;
}
async function candidateFrom(uri: string, expected: SQLite.SQLiteDatabase) {
  const file = new File(uri);
  if (!file.exists || file.size > MAX_BACKUP_BYTES)
    throw new Error('Selecciona un respaldo válido de hasta 80 MB.');
  const envelope = decodeEnvelope(await file.text());
  if ((await hashString(canonicalJson(envelope.payload))) !== envelope.hash)
    throw new Error('El manifiesto del respaldo está dañado.');
  const files = new Map<string, Uint8Array>();
  const entries = [{ ...envelope.payload.database, path: 'database' }, ...envelope.payload.files];
  let database: Uint8Array | undefined;
  for (const entry of entries) {
    assertBase64(entry.base64, entry.size);
    const bytes = toByteArray(entry.base64);
    if (bytes.length !== entry.size || (await hash(bytes)) !== entry.hash)
      throw new Error('El respaldo contiene un archivo corrupto.');
    if (entry.path === 'database') database = portable(bytes);
    else files.set(entry.path, bytes);
  }
  if (!database) throw new Error('Falta la base de datos.');
  const candidate = await SQLite.deserializeDatabaseAsync(database);
  try {
    await candidate.execAsync('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
    if ((await schema(candidate)) !== (await schema(expected)))
      throw new Error('El esquema del respaldo no coincide con esta versión de la aplicación.');
    await check(candidate);
    const refs = await candidate.getAllAsync<Attachment>(
      'SELECT * FROM receipt_attachments UNION ALL SELECT id,payment_id,relative_path,name,mime_type,size,NULL AS meter_id FROM payment_attachments',
    );
    if (
      refs.length !== files.size ||
      refs.some((r) => !files.has(r.relative_path) || files.get(r.relative_path)?.length !== r.size)
    )
      throw new Error('Los documentos no coinciden con sus registros.');
    return { candidate, payload: envelope.payload, files };
  } catch (e) {
    await candidate.closeAsync();
    throw e;
  }
}
export async function inspectBackup(db: SQLite.SQLiteDatabase, uri: string) {
  const value = await candidateFrom(uri, db);
  try {
    return {
      createdAt: value.payload.createdAt,
      mode: value.payload.mode,
      count: value.files.size,
    };
  } finally {
    await value.candidate.closeAsync();
  }
}
interface Journal {
  mode: string;
  hadFiles: boolean;
  phase: 'prepared';
}
async function recoverInternal(db: SQLite.SQLiteDatabase, demo: boolean) {
  const root = recoveryRoot(demo);
  if (!root.exists) return;
  const journalFile = new File(root, 'journal.json');
  const committed = new File(root, 'committed.json');
  const saved = new Directory(root, 'saved');
  if (!journalFile.exists) {
    if (saved.exists && !committed.exists)
      throw new Error('Hay una recuperación incompleta. Se conservaron los archivos originales.');
    root.delete();
    return;
  }
  if (committed.exists) {
    cleanup(root);
    return;
  }
  const journal = JSON.parse(await journalFile.text()) as Journal;
  if (journal.phase !== 'prepared' || journal.mode !== (demo ? 'demo' : 'real'))
    throw new Error('El diario de recuperación no es válido.');
  const rollback = new File(root, 'rollback.db');
  if (!rollback.exists) throw new Error('Falta la base de recuperación.');
  const original = await SQLite.openDatabaseAsync(
    'rollback.db',
    { useNewConnection: true },
    root.uri,
  );
  try {
    await check(original);
    await SQLite.backupDatabaseAsync({ sourceDatabase: original, destDatabase: db });
  } finally {
    await original.closeAsync();
  }
  const active = new Directory(Paths.document, demo ? 'attachments-demo' : 'attachments-real');
  if (saved.exists) {
    if (active.exists) active.delete();
    await saved.move(active);
  } else if (!journal.hadFiles && active.exists) active.delete();
  else if (journal.hadFiles && !active.exists)
    throw new Error('No se encontraron los documentos originales.');
  marker(root, 'committed.json', { outcome: 'rollback' });
  cleanup(root);
}
function cleanup(root: Directory) {
  for (const entry of root.list())
    if (!['journal.json', 'committed.json'].includes(entry.name)) entry.delete();
  const j = new File(root, 'journal.json');
  if (j.exists) j.delete();
  const c = new File(root, 'committed.json');
  if (c.exists) c.delete();
  root.delete();
}
export async function recoverRestore(db: SQLite.SQLiteDatabase, demo: boolean) {
  await serializeOperation(() => recoverInternal(db, demo));
}
export async function restoreBackup(
  db: SQLite.SQLiteDatabase,
  repo: Repository,
  uri: string,
  demo: boolean,
) {
  await serializeOperation(async () => {
    await recoverInternal(db, demo);
    const incoming = await candidateFrom(uri, db);
    const root = recoveryRoot(demo);
    try {
      if (incoming.payload.mode !== (demo ? 'demo' : 'real'))
        throw new Error(
          'El respaldo pertenece a otro modo. No se mezclan datos reales y de demostración.',
        );
      await writeBackup(db, demo);
      root.create({ intermediates: true });
      const staged = new Directory(root, 'incoming');
      staged.create();
      for (const [name, bytes] of incoming.files) {
        const file = new File(staged, name);
        await put(file, bytes);
        if ((await hash(await file.bytes())) !== (await hash(bytes)))
          throw new Error('No se pudo preparar un documento.');
      }
      const rollback = await SQLite.openDatabaseAsync(
        'rollback.db',
        { useNewConnection: true },
        root.uri,
      );
      try {
        await SQLite.backupDatabaseAsync({ sourceDatabase: db, destDatabase: rollback });
        await rollback.execAsync('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;');
      } finally {
        await rollback.closeAsync();
      }
      const active = attachmentRoot(demo);
      marker(root, 'journal.json', {
        mode: demo ? 'demo' : 'real',
        hadFiles: active.exists,
        phase: 'prepared',
      } satisfies Journal);
      if (active.exists) await active.move(new Directory(root, 'saved'));
      await staged.move(
        new Directory(Paths.document, demo ? 'attachments-demo' : 'attachments-real'),
      );
      await SQLite.backupDatabaseAsync({ sourceDatabase: incoming.candidate, destDatabase: db });
      await db.execAsync('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
      await check(db);
      marker(root, 'committed.json', { outcome: 'restored' });
      cleanup(root);
    } catch (e) {
      if (root.exists) await recoverInternal(db, demo);
      throw e;
    } finally {
      await incoming.candidate.closeAsync();
    }
  });
  await repo.setSetting('last_restore', new Date().toISOString());
}
