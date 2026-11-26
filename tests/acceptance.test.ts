import { openDatabase } from '@/core/database/database';
import { createRepository } from '@/core/database/repository';
import { createBackup, restoreBackup } from '@/features/backup/backup';
import { seedDemo } from '@/features/demo/seed';
import { currentPeriod, today } from '@/shared/formatting';
import { randomUUID } from 'node:crypto';
import { clean, initialize } from './support/nativeAdapters';
jest.mock('expo-sqlite', () => require('./support/nativeAdapters').sqlite);
jest.mock('expo-file-system', () => require('./support/nativeAdapters').fileSystem);
jest.mock('expo-crypto', () => require('./support/nativeAdapters').nativeCrypto);
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-sharing', () => ({}));
beforeAll(initialize);
afterAll(clean);
test('flujo integrado de demostración, aislamiento, reparto 400, pagos, historial y respaldo', async () => {
  const realDb = await openDatabase(false);
  const real = createRepository(realDb);
  await real.setSetting('administrator_name', 'Persona real');
  expect(await real.properties()).toHaveLength(0);
  const db = await openDatabase(true);
  const repo = createRepository(db);
  await seedDemo(repo);
  await seedDemo(repo);
  expect(await repo.properties()).toHaveLength(2);
  expect(await repo.units('demo-property-1')).toHaveLength(6);
  const units = await repo.units('demo-property-1');
  expect(units.find((u) => u.code === '302')?.occupancy_type).toBeNull();
  expect(units.find((u) => u.code === '301')?.occupancy_type).toBe('PROPIETARIO');
  const receipt = (await repo.receipts('demo-property-1', currentPeriod()))[0]!;
  const result = await repo.previewReceipt(receipt.id, false);
  expect(result.total_cents).toBe(40000);
  expect(result.tenant_cents).toBe(32500);
  expect(result.owner_cents).toBe(7500);
  expect(result.allocations.map((a) => a.amount_cents).sort((a, b) => a - b)).toEqual([
    5000, 7500, 7500, 8000, 12000,
  ]);
  const partial = (await repo.charges('demo-property-1')).find(
    (c) => c.concept === 'Alquiler' && c.unit_code === '102',
  )!;
  expect(partial.paid_cents).toBe(10000);
  const id = randomUUID();
  await repo.recordPayment({
    id,
    property_id: partial.property_id,
    person_id: partial.person_id,
    occupancy_id: partial.occupancy_id,
    paid_on: today(),
    amount_cents: partial.balance_cents,
    method: 'Yape',
    operation_number: '',
    notes: 'Cierre',
    allocations: [{ charge_id: partial.id, amount_cents: partial.balance_cents }],
  });
  expect((await repo.charges('demo-property-1')).find((c) => c.id === partial.id)?.status).toBe(
    'PAGADO',
  );
  const ps = await repo.receiptParticipants(receipt.id);
  const occupancy = ps.find((p) => p.unit_code === '101')!;
  await repo.saveConfig({
    occupancy_id: occupancy.occupancy_id,
    service_id: receipt.service_id,
    mode: 'FIJO',
    fixed_cents: 999,
    independent: 0,
    effective_from: '2099-01-01',
    effective_to: null,
  });
  expect(await repo.previewReceipt(receipt.id, false)).toEqual(result);
  const oldBalance = (await repo.charges('demo-property-1'))
    .filter((c) => c.occupancy_id === occupancy.occupancy_id)
    .reduce((s, c) => s + c.balance_cents, 0);
  await repo.endOccupancy(occupancy.occupancy_id, today());
  expect(
    (await repo.monthlyPreview('demo-property-1', '2099-02')).filter(
      (c) => c.occupancy_id === occupancy.occupancy_id,
    ),
  ).toEqual([]);
  expect(
    (await repo.charges('demo-property-1'))
      .filter((c) => c.occupancy_id === occupancy.occupancy_id)
      .reduce((s, c) => s + c.balance_cents, 0),
  ).toBe(oldBalance);
  const copy = await createBackup(db, repo, true);
  await repo.setSetting('administrator_name', 'Cambiado');
  await restoreBackup(db, repo, copy, true);
  expect(await repo.setting('administrator_name')).toBe('Rosa (demostración)');
  expect(await real.setting('administrator_name')).toBe('Persona real');
  expect(await real.properties()).toHaveLength(0);
  expect((await repo.charges('demo-property-1')).find((c) => c.id === partial.id)?.status).toBe(
    'PAGADO',
  );
});
