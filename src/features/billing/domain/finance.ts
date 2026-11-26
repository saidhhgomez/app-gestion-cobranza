import type { Criterion, Distribution, Participant } from '@/core/contracts';
import { AppError } from '@/core/errors/AppError';
export const ALGORITHM_VERSION = '1.0.0';
function integer(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new AppError(`${label} debe ser un entero mayor o igual a cero.`);
}
export function largestRemainder(
  total: number,
  weights: { id: string; weight: number }[],
): Map<string, number> {
  integer(total, 'El importe');
  const seen = new Set<string>();
  let sum = 0n;
  const rows = weights.map((w) => {
    integer(w.weight, 'El peso');
    if (seen.has(w.id)) throw new AppError('Los participantes están duplicados.');
    seen.add(w.id);
    sum += BigInt(w.weight);
    return { ...w, amount: 0n, remainder: 0n };
  });
  if (sum === 0n) {
    if (total !== 0) throw new AppError('No hay participantes para repartir el importe.');
    return new Map(rows.map((r) => [r.id, 0]));
  }
  let assigned = 0n;
  for (const row of rows) {
    const n = BigInt(total) * BigInt(row.weight);
    row.amount = n / sum;
    row.remainder = n % sum;
    assigned += row.amount;
  }
  let rest = BigInt(total) - assigned;
  const ordered = [...rows].sort((a, b) =>
    a.remainder === b.remainder
      ? a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const row of ordered) {
    if (rest === 0n) break;
    if (row.weight > 0) {
      row.amount++;
      rest--;
    }
  }
  return new Map(rows.map((r) => [r.id, Number(r.amount)]));
}
export function calculateDistribution(input: {
  total_cents: number;
  total_consumption: number | null;
  criterion: Criterion;
  participants: Participant[];
  assume_owner_remainder: boolean;
}): Distribution {
  const { total_cents: total, participants, criterion } = input;
  integer(total, 'La factura');
  if (new Set(participants.map((p) => p.id)).size !== participants.length)
    throw new AppError('Hay participantes duplicados.');
  const eligible = participants.filter((p) => !p.excluded_reason && p.mode !== 'NO_APLICA');
  const meter = eligible.filter((p) => p.mode === 'MEDIDOR');
  const fixed = eligible.filter((p) => p.mode === 'FIJO');
  const shared = eligible.filter((p) => p.mode === 'PRORRATEO');
  const consumptions = new Map<string, number>();
  let sumConsumption = 0n;
  for (const p of meter) {
    if (p.previous_reading === null || p.current_reading === null)
      throw new AppError(`Falta registrar la lectura de ${p.unit_code}.`);
    integer(p.previous_reading, 'La lectura anterior');
    integer(p.current_reading, 'La lectura actual');
    if (p.current_reading < p.previous_reading)
      throw new AppError(`La lectura actual de ${p.unit_code} es menor que la anterior.`);
    const c = p.current_reading - p.previous_reading;
    consumptions.set(p.id, c);
    sumConsumption += BigInt(c);
  }
  const consumption = input.total_consumption ?? 0;
  integer(consumption, 'El consumo de la factura');
  if (sumConsumption > BigInt(consumption))
    throw new AppError('Los consumos individuales superan el consumo de la factura.');
  const amounts = new Map<string, number>();
  let meterTotal = 0;
  if (consumption > 0 && meter.length) {
    const sumNumerator = BigInt(total) * sumConsumption;
    meterTotal = Number((sumNumerator + BigInt(consumption) / 2n) / BigInt(consumption));
    const weights = meter.map((p) => ({ id: p.id, weight: consumptions.get(p.id) ?? 0 }));
    for (const [id, amount] of largestRemainder(meterTotal, weights)) amounts.set(id, amount);
  }
  let fixedTotal = 0n;
  for (const p of fixed) {
    integer(p.fixed_cents, 'El monto fijo');
    fixedTotal += BigInt(p.fixed_cents);
    amounts.set(p.id, p.fixed_cents);
  }
  const remainder = BigInt(total) - BigInt(meterTotal) - fixedTotal;
  if (remainder < 0n)
    throw new AppError(
      `Los medidores y montos fijos exceden la factura en ${Number(-remainder) / 100} soles. Corrige los conceptos antes de finalizar.`,
    );
  let ownerRemainder = 0;
  const warnings: string[] = [];
  if (shared.length) {
    for (const p of shared) {
      integer(p.inhabitants, 'La cantidad de habitantes');
      if (p.inhabitants < 1)
        throw new AppError('Cada participante debe tener al menos un habitante.');
    }
    for (const [id, amount] of largestRemainder(
      Number(remainder),
      shared.map((p) => ({ id: p.id, weight: criterion === 'POR_HABITANTES' ? p.inhabitants : 1 })),
    ))
      amounts.set(id, amount);
  } else if (remainder > 0n) {
    if (!input.assume_owner_remainder)
      throw new AppError(
        'No hay participantes de prorrateo. Confirma que el propietario asumirá el saldo restante.',
      );
    ownerRemainder = Number(remainder);
    warnings.push('El saldo sin participantes será asumido por el propietario.');
  }
  const allocations = participants.map((p) => ({
    participant_id: p.id,
    occupancy_id: p.occupancy_id,
    unit_code: p.unit_code,
    person_name: p.person_name,
    kind: p.kind,
    amount_cents: amounts.get(p.id) ?? 0,
    consumption: consumptions.get(p.id) ?? 0,
  }));
  const ownerCents = allocations
    .filter((a) => a.kind === 'PROPIETARIO')
    .reduce((sum, a) => sum + a.amount_cents, ownerRemainder);
  const tenantCents = allocations
    .filter((a) => a.kind === 'INQUILINO')
    .reduce((sum, a) => sum + a.amount_cents, 0);
  if (BigInt(ownerCents) + BigInt(tenantCents) !== BigInt(total))
    throw new AppError('La distribución no coincide con la factura.');
  return {
    allocations,
    meter_cents: meterTotal,
    fixed_cents: Number(fixedTotal),
    shared_cents: shared.length ? Number(remainder) : 0,
    owner_cents: ownerCents,
    tenant_cents: tenantCents,
    owner_remainder_cents: ownerRemainder,
    total_cents: total,
    warnings,
    algorithm_version: ALGORITHM_VERSION,
  };
}
export function chargeStatus(
  amount: number,
  paid: number,
  due: string,
  date: string,
  cancelled = false,
): string {
  if (cancelled) return 'ANULADO';
  if (paid === amount) return 'PAGADO';
  if (due < date) return 'VENCIDO';
  return paid > 0 ? 'PARCIAL' : 'PENDIENTE';
}
