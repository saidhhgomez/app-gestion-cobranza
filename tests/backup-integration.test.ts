import { openDatabase } from '@/core/database/database';
import { createRepository } from '@/core/database/repository';
import {
  attachmentRoot,
  importAttachment,
  reconcileAttachmentStore,
} from '@/core/storage/attachments';
import { createBackup, inspectBackup, restoreBackup } from '@/features/backup/backup';
import { randomUUID } from 'node:crypto';
import { utimesSync } from 'node:fs';
import {
  backupDatabaseAsync,
  clean,
  Directory,
  File,
  initialize,
  root,
} from './support/nativeAdapters';
jest.mock('expo-sqlite', () => require('./support/nativeAdapters').sqlite);
jest.mock('expo-file-system', () => require('./support/nativeAdapters').fileSystem);
jest.mock('expo-crypto', () => require('./support/nativeAdapters').nativeCrypto);
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-sharing', () => ({}));
beforeAll(initialize);
afterAll(clean);
test('limpia solo adjuntos conocidos sin referencia y con más de un día', async () => {
  const db = await openDatabase(true);
  const directory = attachmentRoot(true);
  const old = new File(directory.uri, `${randomUUID()}.pdf`);
  const recent = new File(directory.uri, `${randomUUID()}.pdf`);
  const unknown = new File(directory.uri, 'conservar.pdf');
  for (const file of [old, recent, unknown]) {
    file.create();
    await file.write('prueba');
  }
  const past = new Date(Date.now() - 2 * 86400000);
  for (const file of [old, unknown]) utimesSync(file.uri, past, past);
  await reconcileAttachmentStore(db, true);
  expect(old.exists).toBe(false);
  expect(recent.exists).toBe(true);
  expect(unknown.exists).toBe(true);
});
test('respaldo y restauración coordinan SQLite real y archivos reales; integridad y rollback', async () => {
  const db = await openDatabase();
  const repo = createRepository(db);
  const property = await repo.saveProperty({
    name: 'Original',
    address: 'Lima',
    district: 'Lima',
    province: 'Lima',
    region: 'Lima',
    kind: 'Casa',
    description: '',
    active: 1,
  });
  const service = await repo.saveService({
    property_id: property,
    name: 'Internet',
    unit: '',
    supports_meter: 0,
    uses_receipt: 1,
    allows_independent: 1,
    criterion: 'EQUITATIVO',
    active: 1,
  });
  const receipt = await repo.saveReceipt({
    property_id: property,
    service_id: service,
    period: '2026-11',
    provider: 'Ejemplo',
    supply_number: '',
    receipt_number: '',
    total_cents: 1000,
    total_consumption: null,
    issued_on: '2026-11-01',
    due_on: '2026-11-30',
    consumption_start: null,
    consumption_end: null,
    notes: '',
  });
  const source = new File(root, 'source.pdf');
  source.create();
  await source.write('%PDF-1.4 evidencia de prueba');
  await importAttachment(repo, receipt, false, {
    uri: source.uri,
    name: 'evidencia.pdf',
    mimeType: 'application/pdf',
  });
  await importAttachment(repo, receipt, false, {
    uri: source.uri,
    name: 'evidencia.pdf',
    mimeType: 'application/pdf',
  });
  const attachments = await repo.attachments(receipt);
  expect(new Set(attachments.map((a) => a.relative_path)).size).toBe(2);
  const uri = await createBackup(db, repo, false);
  expect((await inspectBackup(db, uri)).count).toBe(2);
  const current = (await repo.properties())[0]!;
  await repo.saveProperty({ ...current, name: 'Modificado' });
  await restoreBackup(db, repo, uri, false);
  expect((await repo.properties())[0]?.name).toBe('Original');
  expect(await repo.attachments(receipt)).toHaveLength(2);
  expect(new Directory(root, 'backups').list().length).toBeGreaterThanOrEqual(2);
  await repo.saveProperty({ ...current, name: 'Estado antes del fallo' });
  // The first call saves rollback.db; the second simulates a failure replacing live data.
  const implementation = backupDatabaseAsync.getMockImplementation()!;
  backupDatabaseAsync
    .mockImplementationOnce(implementation)
    .mockRejectedValueOnce(new Error('Fallo de escritura controlado'));
  await expect(restoreBackup(db, repo, uri, false)).rejects.toThrow(/Fallo/);
  expect((await repo.properties())[0]?.name).toBe('Estado antes del fallo');
  expect(await repo.attachments(receipt)).toHaveLength(2);
  const corrupt = new File(root, `${randomUUID()}.json`);
  corrupt.create();
  await corrupt.write((await new File(uri).text()).replace('mi-inmueble-backup', 'alterado'));
  await expect(inspectBackup(db, corrupt.uri)).rejects.toThrow();
  await expect(restoreBackup(db, repo, uri, true)).rejects.toThrow(/otro modo/);
});
