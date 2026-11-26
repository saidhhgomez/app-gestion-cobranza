import type { ReceiptInput, Repository } from '@/core/contracts';
import { openDatabase } from '@/core/database/database';
import { createRepository } from '@/core/database/repository';
import { currentPeriod, today } from '@/shared/formatting';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import initSqlJs, { type Database as SqlDatabase } from 'sql.js';
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('@/features/backup/backup', () => ({
  recoverRestore: jest.fn().mockResolvedValue(undefined),
}));
let sql: SqlDatabase;
let db: SQLiteDatabase;
let repo: Repository;
let property: string;
let unit: string;
let person: string;
let occupancy: string;
let service: string;
const period = currentPeriod();
const start = `${period}-01`;
function adapter(database: SqlDatabase): SQLiteDatabase {
  const params = (args: unknown[]) =>
    args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  return {
    databasePath: '/test/mi-inmueble.db',
    execAsync: async (q: string) => {
      database.exec(q);
    },
    runAsync: async (q: string, ...args: unknown[]) => {
      database.run(q, params(args));
      return { changes: database.getRowsModified(), lastInsertRowId: 0 };
    },
    getAllAsync: async (q: string, ...args: unknown[]) => {
      const st = database.prepare(q);
      try {
        st.bind(params(args));
        const rows = [];
        while (st.step()) rows.push(st.getAsObject());
        return rows;
      } finally {
        st.free();
      }
    },
    getFirstAsync: async (q: string, ...args: unknown[]) => {
      const st = database.prepare(q);
      try {
        st.bind(params(args));
        return st.step() ? st.getAsObject() : null;
      } finally {
        st.free();
      }
    },
    closeAsync: async () => undefined,
  } as unknown as SQLiteDatabase;
}
beforeEach(async () => {
  const SQL = await initSqlJs({
    wasmBinary: new Uint8Array(readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))).buffer,
  });
  sql = new SQL.Database();
  db = adapter(sql);
  jest.mocked(openDatabaseAsync).mockResolvedValue(db);
  await openDatabase();
  repo = createRepository(db);
  property = await repo.saveProperty({
    name: 'Pruebas',
    address: 'Av. Ejemplo',
    district: 'Lima',
    province: 'Lima',
    region: 'Lima',
    kind: 'Edificio',
    description: '',
    active: 1,
  });
  unit = await repo.saveUnit({
    property_id: property,
    code: '101',
    name: 'Unidad 101',
    floor: '1',
    kind: 'Departamento',
    description: '',
    notes: '',
    active: 1,
  });
  person = await repo.savePerson({
    first_name: 'Persona',
    last_name: 'Prueba',
    document_type: 'DNI',
    document_number: '12345678',
    phone: '',
    email: '',
    notes: '',
    active: 1,
  });
  occupancy = await repo.saveOccupancy({
    unit_id: unit,
    person_id: person,
    kind: 'INQUILINO',
    start_date: start,
    end_date: null,
    inhabitants: 2,
    rent_cents: 50000,
    due_day: 5,
    notes: '',
  });
  service = await repo.saveService({
    property_id: property,
    name: 'Luz',
    unit: 'kWh',
    supports_meter: 1,
    uses_receipt: 1,
    allows_independent: 1,
    criterion: 'EQUITATIVO',
    active: 1,
  });
});
afterEach(() => sql.close());
const receipt = (): ReceiptInput => ({
  property_id: property,
  service_id: service,
  period,
  provider: 'Proveedor',
  supply_number: '',
  receipt_number: '',
  total_cents: 40000,
  total_consumption: 500000,
  issued_on: start,
  due_on: `${period}-28`,
  consumption_start: null,
  consumption_end: null,
  notes: '',
});
const generate = async () => {
  const items = await repo.monthlyPreview(property, period);
  await repo.generateMonthly(property, period, items);
  return (await repo.charges(property, period))[0]!;
};
test('migración real e integridad referencial', async () => {
  await openDatabase();
  expect((await repo.properties()).length).toBe(1);
  expect(await db.getFirstAsync('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
  await expect(
    db.runAsync(
      'INSERT INTO units(id,property_id,code,name,kind,active) VALUES(?,?,?,?,?,?)',
      'bad',
      'missing',
      'X',
      'X',
      'Casa',
      1,
    ),
  ).rejects.toThrow();
});
test('unidad duplicada y ocupaciones superpuestas se rechazan', async () => {
  await expect(
    repo.saveUnit({
      property_id: property,
      code: '101',
      name: 'Otra',
      floor: '',
      kind: 'Casa',
      description: '',
      notes: '',
      active: 1,
    }),
  ).rejects.toThrow();
  await expect(
    repo.saveOccupancy({
      unit_id: unit,
      person_id: person,
      kind: 'INQUILINO',
      start_date: start,
      end_date: null,
      inhabitants: 1,
      rent_cents: 0,
      due_day: 1,
      notes: '',
    }),
  ).rejects.toThrow(/ocupación/);
  expect((await repo.occupancies(property)).length).toBe(1);
});
test('generación idempotente; pago parcial, completo, reverso y deuda tras salida', async () => {
  const c = await generate();
  await repo.generateMonthly(property, period, await repo.monthlyPreview(property, period));
  expect((await repo.charges(property, period)).length).toBe(1);
  const payment = {
    id: randomUUID(),
    property_id: property,
    occupancy_id: occupancy,
    person_id: person,
    paid_on: today(),
    amount_cents: 10000,
    method: 'Efectivo',
    operation_number: '',
    notes: '',
    allocations: [{ charge_id: c.id, amount_cents: 10000 }],
  };
  await repo.recordPayment(payment);
  await repo.recordPayment(payment);
  expect((await repo.charges(property, period))[0]?.balance_cents).toBe(40000);
  await repo.recordPayment({
    ...payment,
    id: randomUUID(),
    amount_cents: 40000,
    allocations: [{ charge_id: c.id, amount_cents: 40000 }],
  });
  expect((await repo.charges(property, period))[0]?.status).toBe('PAGADO');
  await repo.reversePayment(payment.id, 'Prueba de reverso');
  expect((await repo.charges(property, period))[0]?.balance_cents).toBe(10000);
  await repo.endOccupancy(occupancy, today());
  expect((await repo.charges(property, period))[0]?.balance_cents).toBe(10000);
  expect(await repo.monthlyPreview(property, '2099-01')).toEqual([]);
});
test('pago excesivo falla sin dejar registros; rollback', async () => {
  const c = await generate();
  await expect(
    repo.recordPayment({
      id: randomUUID(),
      property_id: property,
      occupancy_id: occupancy,
      person_id: person,
      paid_on: today(),
      amount_cents: 60000,
      method: 'Yape',
      operation_number: '',
      notes: '',
      allocations: [{ charge_id: c.id, amount_cents: 60000 }],
    }),
  ).rejects.toThrow();
  expect(await repo.payments(property)).toHaveLength(0);
  expect((await repo.charges(property, period))[0]?.paid_cents).toBe(0);
});
test('recibo duplicado, snapshot inmutable, pagos y anulación', async () => {
  await repo.saveConfig({
    occupancy_id: occupancy,
    service_id: service,
    mode: 'PRORRATEO',
    fixed_cents: 0,
    independent: 0,
    effective_from: start,
    effective_to: null,
  });
  const id = await repo.saveReceipt(receipt());
  await expect(repo.saveReceipt(receipt())).rejects.toThrow(/existe/);
  await repo.finalizeReceipt(id, false);
  await repo.finalizeReceipt(id, false);
  expect((await repo.charges(property, period)).length).toBe(1);
  const original = await repo.previewReceipt(id, false);
  await repo.saveConfig({
    occupancy_id: occupancy,
    service_id: service,
    mode: 'FIJO',
    fixed_cents: 1000,
    independent: 0,
    effective_from: '2099-01-01',
    effective_to: null,
  });
  expect(await repo.previewReceipt(id, false)).toEqual(original);
  await expect(repo.saveReceipt({ ...receipt(), id, total_cents: 1 })).rejects.toThrow();
  await expect(
    db.runAsync('UPDATE receipt_participants SET inhabitants=99 WHERE receipt_id=?', id),
  ).rejects.toThrow();
  await expect(
    db.runAsync('UPDATE charges SET amount_cents=1 WHERE receipt_id=?', id),
  ).rejects.toThrow();
  await repo.cancelReceipt(id, 'Recibo incorrecto');
  expect((await repo.charges(property, period))[0]?.status).toBe('ANULADO');
  expect((await repo.previewReceipt(id, true)).total_cents).toBe(40000);
});
test('sin ocupados registra toda la factura como gasto del dueño', async () => {
  await repo.endOccupancy(occupancy, start);
  const r = await repo.saveReceipt({
    ...receipt(),
    period: '2099-02',
    issued_on: '2099-02-01',
    due_on: '2099-02-20',
  });
  await repo.finalizeReceipt(r, true);
  expect(await repo.charges(property, '2099-02')).toHaveLength(0);
  expect((await repo.previewReceipt(r, true)).owner_cents).toBe(40000);
});
test('medidores: límites e historial posterior bloquean sin efectos parciales', async () => {
  await repo.saveConfig({
    occupancy_id: occupancy,
    service_id: service,
    mode: 'MEDIDOR',
    fixed_cents: 0,
    independent: 0,
    effective_from: start,
    effective_to: null,
  });
  await repo.saveMeter({
    unit_id: unit,
    service_id: service,
    serial: 'M1',
    installed_on: start,
    initial_reading: 100000,
    active: 1,
    notes: '',
  });
  const id = await repo.saveReceipt(receipt());
  const ps = await repo.receiptParticipants(id);
  await repo.saveParticipants(
    id,
    ps.map((p) => ({ ...p, current_reading: 350000 })),
  );
  await repo.finalizeReceipt(id, true);
  expect((await repo.previewReceipt(id, true)).meter_cents).toBe(20000);
  expect((await db.getAllAsync('SELECT * FROM meter_readings')).length).toBe(1);
  await expect(db.runAsync('UPDATE meter_readings SET current_reading=1')).rejects.toThrow();
});
test('los inmuebles no mezclan cobros ni pagos', async () => {
  await generate();
  const other = await repo.saveProperty({
    name: 'Otro',
    address: 'Otra',
    district: 'Lima',
    province: 'Lima',
    region: 'Lima',
    kind: 'Casa',
    description: '',
    active: 1,
  });
  expect(await repo.charges(other, period)).toHaveLength(0);
  expect((await repo.dashboard(other, period)).pending_cents).toBe(0);
});
test('pago distribuido entre alquiler y fijo independiente conserva suma y evita excesos', async () => {
  await repo.saveConfig({
    occupancy_id: occupancy,
    service_id: service,
    mode: 'FIJO',
    fixed_cents: 3000,
    independent: 1,
    effective_from: start,
    effective_to: null,
  });
  await repo.generateMonthly(property, period, await repo.monthlyPreview(property, period));
  const debts = await repo.charges(property, period);
  expect(debts).toHaveLength(2);
  const id = randomUUID();
  await repo.recordPayment({
    id,
    property_id: property,
    occupancy_id: occupancy,
    person_id: person,
    paid_on: today(),
    amount_cents: 53000,
    method: 'Transferencia bancaria',
    operation_number: 'OPER-1',
    notes: '',
    allocations: debts.map((c) => ({ charge_id: c.id, amount_cents: c.amount_cents })),
  });
  expect((await repo.charges(property, period)).every((c) => c.status === 'PAGADO')).toBe(true);
  await repo.reversePayment(id, 'Devolución');
  expect((await repo.charges(property, period)).reduce((s, c) => s + c.balance_cents, 0)).toBe(
    53000,
  );
});
test('propietario con fijo independiente genera gasto propio idempotente', async () => {
  await repo.endOccupancy(occupancy, start);
  const owner = await repo.saveOccupancy({
    unit_id: unit,
    person_id: person,
    kind: 'PROPIETARIO',
    start_date: `${period}-02`,
    end_date: null,
    inhabitants: 1,
    rent_cents: 0,
    due_day: 5,
    notes: '',
  });
  await repo.saveConfig({
    occupancy_id: owner,
    service_id: service,
    mode: 'FIJO',
    fixed_cents: 3000,
    independent: 1,
    effective_from: `${period}-02`,
    effective_to: null,
  });
  const items = await repo.monthlyPreview(property, period);
  await repo.generateMonthly(property, period, items);
  await repo.generateMonthly(property, period, items);
  expect((await repo.dashboard(property, period)).owner_cents).toBe(3000);
  expect(
    (await repo.charges(property, period)).filter((c) => c.occupancy_id === owner),
  ).toHaveLength(0);
});
test('anulación de factura exige revertir pagos; permite reemplazo sin borrar historial', async () => {
  await repo.saveConfig({
    occupancy_id: occupancy,
    service_id: service,
    mode: 'PRORRATEO',
    fixed_cents: 0,
    independent: 0,
    effective_from: start,
    effective_to: null,
  });
  const id = await repo.saveReceipt(receipt());
  await repo.finalizeReceipt(id, false);
  const charge = (await repo.charges(property, period))[0]!;
  const payment = randomUUID();
  await repo.recordPayment({
    id: payment,
    property_id: property,
    occupancy_id: occupancy,
    person_id: person,
    paid_on: today(),
    amount_cents: 1000,
    method: 'Efectivo',
    operation_number: '',
    notes: '',
    allocations: [{ charge_id: charge.id, amount_cents: 1000 }],
  });
  await expect(repo.cancelReceipt(id, 'Corregir factura')).rejects.toThrow(/pagos/);
  await repo.reversePayment(payment, 'Corrección');
  await repo.cancelReceipt(id, 'Corregir factura');
  const replacement = await repo.saveReceipt(receipt());
  expect(replacement).not.toBe(id);
  expect(await repo.receipts(property, period)).toHaveLength(2);
  expect((await repo.receipt(id))?.status).toBe('ANULADO');
});
test('recibo anterior con lectura incompatible hace rollback de todo el reparto', async () => {
  await repo.saveConfig({
    occupancy_id: occupancy,
    service_id: service,
    mode: 'MEDIDOR',
    fixed_cents: 0,
    independent: 0,
    effective_from: start,
    effective_to: null,
  });
  await repo.saveMeter({
    unit_id: unit,
    service_id: service,
    serial: 'Histórico',
    installed_on: start,
    initial_reading: 100000,
    active: 1,
    notes: '',
  });
  const later = await repo.saveReceipt({
    ...receipt(),
    period: '2099-03',
    issued_on: '2099-03-01',
    due_on: '2099-03-28',
  });
  await repo.saveParticipants(
    later,
    (await repo.receiptParticipants(later)).map((p) => ({ ...p, current_reading: 300000 })),
  );
  await repo.finalizeReceipt(later, true);
  const earlier = await repo.saveReceipt({
    ...receipt(),
    period: '2099-02',
    issued_on: '2099-02-01',
    due_on: '2099-02-28',
  });
  await repo.saveParticipants(
    earlier,
    (await repo.receiptParticipants(earlier)).map((p) => ({ ...p, current_reading: 350000 })),
  );
  await expect(repo.finalizeReceipt(earlier, true)).rejects.toThrow(/historial/);
  expect((await repo.receipt(earlier))?.confirmed_at).toBeNull();
  expect(await repo.charges(property, '2099-02')).toHaveLength(0);
});

test('archivar conserva historial y bloquea nuevas operaciones hasta reactivar', async () => {
  await expect(repo.archiveProperty(property, false)).rejects.toThrow(/ocupaciones/);
  await repo.endOccupancy(occupancy, start);
  await repo.archiveProperty(property, false);
  const input = {
    unit_id: unit,
    person_id: person,
    kind: 'INQUILINO' as const,
    start_date: `${period}-02`,
    end_date: null,
    inhabitants: 1,
    rent_cents: 0,
    due_day: 5,
    notes: '',
  };
  await expect(repo.saveOccupancy(input)).rejects.toThrow(/Reactiva/);
  await expect(repo.saveReceipt(receipt())).rejects.toThrow(/Reactiva/);
  await repo.archiveProperty(property, true);
  await expect(repo.saveOccupancy(input)).resolves.toEqual(expect.any(String));
  expect(await repo.occupancies(property)).toHaveLength(2);
});
