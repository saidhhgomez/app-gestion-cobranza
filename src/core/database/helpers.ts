import type {
  Charge,
  Distribution,
  Meter,
  MonthlyItem,
  Occupancy,
  Participant,
  Receipt,
  Service,
  ServiceConfig,
} from '@/core/contracts';
import { AppError } from '@/core/errors/AppError';
import { calculateDistribution, chargeStatus } from '@/features/billing/domain/finance';
import { periodRange, today, validDate } from '@/shared/formatting';
import * as Crypto from 'expo-crypto';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
export type DB = SQLiteDatabase;
export const uuid = () => Crypto.randomUUID();
export const timestamp = () => new Date().toISOString();
export const requireDate = (d: string) => {
  if (!validDate(d))
    throw new AppError('Revisa las fechas. Deben ser fechas válidas.', 'validation');
};
export const natural = (n: number, label: string, min = 0) => {
  if (!Number.isSafeInteger(n) || n < min)
    throw new AppError(`${label} debe ser un entero mayor o igual a ${min}.`, 'validation');
};
export const previousDay = (d: string) => {
  const date = new Date(`${d}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};
export const dueDate = (period: string, day: number) =>
  `${period}-${String(Math.min(day, Number(periodRange(period)[1].slice(-2)))).padStart(2, '0')}`;
export async function required<T>(
  db: DB,
  sql: string,
  args: SQLiteBindValue[],
  message = 'No se encontró el registro.',
): Promise<T> {
  const row = await db.getFirstAsync<T>(sql, args);
  if (!row) throw new AppError(message);
  return row;
}
export async function audit(
  db: DB,
  type: string,
  id: string,
  action: string,
  details: unknown = {},
) {
  await db.runAsync(
    'INSERT INTO audit_events(id,entity_type,entity_id,action,details,created_at) VALUES(?,?,?,?,?,?)',
    uuid(),
    type,
    id,
    action,
    JSON.stringify(details),
    timestamp(),
  );
}
export const columns = {
  properties: [
    'name',
    'address',
    'district',
    'province',
    'region',
    'kind',
    'description',
    'active',
  ],
  units: ['property_id', 'code', 'name', 'floor', 'kind', 'description', 'notes', 'active'],
  people: [
    'first_name',
    'last_name',
    'document_type',
    'document_number',
    'phone',
    'email',
    'notes',
    'active',
  ],
  occupancies: [
    'unit_id',
    'person_id',
    'kind',
    'start_date',
    'end_date',
    'inhabitants',
    'rent_cents',
    'due_day',
    'notes',
  ],
  property_services: [
    'property_id',
    'name',
    'unit',
    'supports_meter',
    'uses_receipt',
    'allows_independent',
    'criterion',
    'active',
  ],
  meters: ['unit_id', 'service_id', 'serial', 'installed_on', 'initial_reading', 'active', 'notes'],
} as const;
export async function save<T extends object & { id?: string }>(
  db: DB,
  table: keyof typeof columns,
  value: T,
): Promise<string> {
  const id = value.id ?? uuid();
  const entries = new Map(Object.entries(value));
  const keys = columns[table];
  await db.runAsync(
    `INSERT INTO ${table}(id,${keys.join(',')}) VALUES(?,${keys.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${keys.map((k) => `${k}=excluded.${k}`).join(',')}`,
    [id, ...keys.map((k) => (entries.get(k) ?? null) as SQLiteBindValue)],
  );
  await audit(db, table, id, 'GUARDAR');
  return id;
}
export const occupancySelect = `SELECT o.*,u.code unit_code,u.property_id,p.first_name||' '||p.last_name person_name FROM occupancies o JOIN units u ON u.id=o.unit_id JOIN people p ON p.id=o.person_id`;
export const receiptSelect = `SELECT r.*,s.name service_name FROM master_receipts r JOIN property_services s ON s.id=r.service_id`;
export async function applicable(db: DB, propertyId: string, period: string): Promise<Occupancy[]> {
  const [first, last] = periodRange(period);
  return db.getAllAsync<Occupancy>(
    `${occupancySelect} WHERE u.property_id=? AND o.start_date<=? AND (o.end_date IS NULL OR o.end_date>=?) ORDER BY u.code,o.start_date`,
    propertyId,
    last,
    first,
  );
}
export async function termFor(db: DB, o: Occupancy, period: string) {
  const [first, last] = periodRange(period);
  const terms = await db.getAllAsync<{
    effective_from: string;
    inhabitants: number;
    rent_cents: number;
    due_day: number;
  }>(
    'SELECT effective_from,inhabitants,rent_cents,due_day FROM occupancy_terms WHERE occupancy_id=? AND effective_from<=? ORDER BY effective_from DESC',
    o.id,
    last,
  );
  return {
    ...o,
    ...terms[0],
    partial_period:
      o.start_date > first ||
      (o.end_date !== null && o.end_date < last) ||
      terms.some((t) => t.effective_from > first),
  };
}
export async function buildParticipants(
  db: DB,
  serviceId: string,
  period: string,
): Promise<Participant[]> {
  const service = await required<Service>(db, 'SELECT * FROM property_services WHERE id=?', [
    serviceId,
  ]);
  const [first, last] = periodRange(period);
  const result: Participant[] = [];
  for (const o of await applicable(db, service.property_id, period)) {
    const t = await termFor(db, o, period);
    const configs = await db.getAllAsync<ServiceConfig>(
      'SELECT * FROM unit_service_configs WHERE occupancy_id=? AND service_id=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?) ORDER BY effective_from DESC',
      o.id,
      serviceId,
      last,
      first,
    );
    const c = configs[0];
    const meter = await db.getFirstAsync<Meter>(
      'SELECT * FROM meters WHERE unit_id=? AND service_id=? AND installed_on<=? AND (retired_on IS NULL OR retired_on>=?) ORDER BY installed_on DESC',
      o.unit_id,
      serviceId,
      last,
      first,
    );
    const previous = meter
      ? await db.getFirstAsync<{ current_reading: number }>(
          'SELECT m.current_reading FROM meter_readings m JOIN master_receipts r ON r.id=m.receipt_id WHERE m.meter_id=? AND m.period<? AND r.status<>? ORDER BY m.period DESC LIMIT 1',
          meter.id,
          period,
          'ANULADO',
        )
      : null;
    result.push({
      id: uuid(),
      occupancy_id: o.id,
      unit_id: o.unit_id,
      person_id: o.person_id,
      unit_code: o.unit_code ?? '',
      person_name: o.person_name ?? '',
      kind: o.kind,
      mode: c?.mode ?? 'NO_APLICA',
      inhabitants: t.inhabitants,
      fixed_cents: c?.fixed_cents ?? 0,
      previous_reading: meter ? (previous?.current_reading ?? meter.initial_reading) : null,
      current_reading: null,
      meter_id: meter?.id ?? null,
      excluded_reason: !c
        ? 'Servicio sin configuración confirmada para esta ocupación'
        : c.independent
          ? 'Cobro fijo independiente'
          : c.mode === 'NO_APLICA'
            ? 'No participa en este servicio'
            : null,
      partial_period:
        t.partial_period || configs.length > 1 || (c !== undefined && c.effective_from > first),
    });
  }
  return result;
}
export async function getReceipt(db: DB, id: string) {
  return db.getFirstAsync<Receipt>(`${receiptSelect} WHERE r.id=?`, id);
}
export async function getParticipants(db: DB, id: string): Promise<Participant[]> {
  const rows = await db.getAllAsync<
    Omit<Participant, 'partial_period'> & { partial_period: number }
  >('SELECT * FROM receipt_participants WHERE receipt_id=? ORDER BY unit_code,id', id);
  return rows.map((r) => ({ ...r, partial_period: !!r.partial_period }));
}
export async function insertParticipant(db: DB, id: string, p: Participant) {
  await db.runAsync(
    'INSERT INTO receipt_participants(id,receipt_id,occupancy_id,unit_id,person_id,unit_code,person_name,kind,mode,inhabitants,fixed_cents,previous_reading,current_reading,meter_id,excluded_reason,partial_period) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    p.id,
    id,
    p.occupancy_id,
    p.unit_id,
    p.person_id,
    p.unit_code,
    p.person_name,
    p.kind,
    p.mode,
    p.inhabitants,
    p.fixed_cents,
    p.previous_reading,
    p.current_reading,
    p.meter_id,
    p.excluded_reason,
    Number(p.partial_period),
  );
}
export async function distribution(db: DB, id: string, owner: boolean): Promise<Distribution> {
  const r = await required<Receipt & { distribution_json: string | null }>(
    db,
    `${receiptSelect} WHERE r.id=?`,
    [id],
  );
  if (r.distribution_json) return JSON.parse(r.distribution_json) as Distribution;
  const participants = await getParticipants(db, id);
  const meterGroups = new Map<string, Participant[]>();
  for (const p of participants)
    if (!p.excluded_reason && p.mode === 'MEDIDOR' && p.meter_id) {
      const group = meterGroups.get(p.meter_id) ?? [];
      group.push(p);
      meterGroups.set(p.meter_id, group);
    }
  for (const group of meterGroups.values()) {
    const ordered = group
      .filter((p) => p.previous_reading !== null && p.current_reading !== null)
      .sort((a, b) => a.previous_reading! - b.previous_reading!);
    for (let i = 1; i < ordered.length; i++)
      if (ordered[i]!.previous_reading! < ordered[i - 1]!.current_reading!)
        throw new AppError(
          'Dos ocupaciones comparten medidor y sus consumos se superponen. Revisa las lecturas de ingreso y salida y documenta el ajuste.',
        );
  }
  return calculateDistribution({
    total_cents: r.total_cents,
    total_consumption: r.total_consumption,
    criterion: r.criterion,
    participants,
    assume_owner_remainder: owner,
  });
}
export async function chargeRows(
  db: DB,
  propertyId?: string,
  period?: string,
  personId?: string,
): Promise<Charge[]> {
  const data = await db.getAllAsync<Omit<Charge, 'status'> & { cancelled: number }>(
    'SELECT * FROM charge_balances WHERE (? IS NULL OR property_id=?) AND (? IS NULL OR period=?) AND (? IS NULL OR person_id=?) ORDER BY due_on,unit_code,id',
    propertyId ?? null,
    propertyId ?? null,
    period ?? null,
    period ?? null,
    personId ?? null,
    personId ?? null,
  );
  return data.map((c) => ({
    ...c,
    status: chargeStatus(c.amount_cents, c.paid_cents, c.due_on, today(), !!c.cancelled),
  }));
}
export async function insertCharge(
  db: DB,
  value: {
    property_id: string;
    occupancy_id: string;
    person_id: string;
    period: string;
    concept: string;
    amount_cents: number;
    due_on: string;
    receipt_id: string | null;
    source_key: string;
    unit_code: string;
    person_name: string;
  },
) {
  const id = uuid();
  await db.runAsync(
    'INSERT INTO charges(id,property_id,occupancy_id,person_id,period,concept,amount_cents,due_on,receipt_id,source_key,unit_code,person_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    id,
    value.property_id,
    value.occupancy_id,
    value.person_id,
    value.period,
    value.concept,
    value.amount_cents,
    value.due_on,
    value.receipt_id,
    value.source_key,
    value.unit_code,
    value.person_name,
  );
  await db.runAsync(
    'INSERT INTO charge_items(id,charge_id,concept,amount_cents) VALUES(?,?,?,?)',
    uuid(),
    id,
    value.concept,
    value.amount_cents,
  );
}
export async function monthlyItems(
  db: DB,
  propertyId: string,
  period: string,
): Promise<MonthlyItem[]> {
  const [first, last] = periodRange(period);
  const items: MonthlyItem[] = [];
  for (const o of await applicable(db, propertyId, period)) {
    const t = await termFor(db, o, period);
    const base = {
      occupancy_id: o.id,
      person_id: o.person_id,
      unit_code: o.unit_code ?? '',
      person_name: o.person_name ?? '',
      due_on: dueDate(period, t.due_day),
      partial_period: t.partial_period,
      kind: o.kind,
    };
    if (o.kind === 'INQUILINO')
      items.push({
        ...base,
        key: `rent:${o.id}:${period}`,
        concept: 'Alquiler',
        amount_cents: t.rent_cents,
      });
    const configs = await db.getAllAsync<ServiceConfig & { name: string }>(
      'SELECT c.*,s.name FROM unit_service_configs c JOIN property_services s ON s.id=c.service_id WHERE c.occupancy_id=? AND c.mode=? AND c.independent=1 AND c.effective_from<=? AND (c.effective_to IS NULL OR c.effective_to>=?) ORDER BY c.effective_from DESC',
      o.id,
      'FIJO',
      last,
      first,
    );
    const seen = new Set<string>();
    for (const c of configs) {
      if (seen.has(c.service_id)) continue;
      seen.add(c.service_id);
      items.push({
        ...base,
        key: `fixed:${o.id}:${c.service_id}:${period}`,
        concept: c.name,
        amount_cents: c.fixed_cents,
        partial_period: base.partial_period || c.effective_from > first,
      });
    }
  }
  const existing = new Set(
    (
      await db.getAllAsync<{ source_key: string }>(
        'SELECT source_key FROM charges WHERE property_id=? AND period=? UNION ALL SELECT source_key FROM owner_expenses WHERE property_id=? AND period=? AND source_key IS NOT NULL',
        propertyId,
        period,
        propertyId,
        period,
      )
    ).map((c) => c.source_key),
  );
  return items.filter((i) => !existing.has(i.key));
}
