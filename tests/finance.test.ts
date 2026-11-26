import type { Participant } from '@/core/contracts';
import {
  calculateDistribution,
  chargeStatus,
  largestRemainder,
} from '@/features/billing/domain/finance';
const participant = (
  id: string,
  mode: Participant['mode'],
  extra: Partial<Participant> = {},
): Participant => ({
  id,
  occupancy_id: `o-${id}`,
  unit_id: `u-${id}`,
  person_id: `p-${id}`,
  unit_code: id,
  person_name: id,
  kind: 'INQUILINO',
  mode,
  inhabitants: 1,
  fixed_cents: 0,
  previous_reading: null,
  current_reading: null,
  meter_id: null,
  excluded_reason: null,
  partial_period: false,
  ...extra,
});
const calculate = (
  participants: Participant[],
  overrides: Partial<Parameters<typeof calculateDistribution>[0]> = {},
) =>
  calculateDistribution({
    total_cents: 40000,
    total_consumption: 500000,
    criterion: 'EQUITATIVO',
    participants,
    assume_owner_remainder: false,
    ...overrides,
  });
describe('Motor financiero', () => {
  test('ejemplo obligatorio: S/400, medidores, fijo, prorrateo y departamento vacío', () => {
    const d = calculate([
      participant('101', 'MEDIDOR', { previous_reading: 100000, current_reading: 250000 }),
      participant('102', 'MEDIDOR', { previous_reading: 100000, current_reading: 200000 }),
      participant('201', 'FIJO', { fixed_cents: 5000 }),
      participant('202', 'PRORRATEO'),
      participant('301', 'PRORRATEO'),
      participant('302', 'NO_APLICA', { excluded_reason: 'Desocupado' }),
    ]);
    expect(d.allocations.map((a) => a.amount_cents)).toEqual([12000, 8000, 5000, 7500, 7500, 0]);
    expect(d.tenant_cents + d.owner_cents).toBe(40000);
  });
  test('fijos exactos y cero', () => {
    expect(calculate([participant('a', 'FIJO', { fixed_cents: 40000 })]).fixed_cents).toBe(40000);
    expect(calculate([participant('a', 'FIJO')], { total_cents: 0 }).total_cents).toBe(0);
  });
  test('por habitantes solo cuenta participantes de prorrateo', () => {
    const d = calculate(
      [
        participant('a', 'PRORRATEO', { inhabitants: 1 }),
        participant('b', 'PRORRATEO', { inhabitants: 3 }),
        participant('c', 'NO_APLICA', { inhabitants: 100, excluded_reason: 'No participa' }),
      ],
      { criterion: 'POR_HABITANTES' },
    );
    expect(d.allocations.map((a) => a.amount_cents)).toEqual([10000, 30000, 0]);
  });
  test('propietario participante es gasto y no deuda de inquilino', () => {
    const d = calculate([
      participant('a', 'PRORRATEO'),
      participant('b', 'PRORRATEO', { kind: 'PROPIETARIO' }),
    ]);
    expect(d.tenant_cents).toBe(20000);
    expect(d.owner_cents).toBe(20000);
  });
  test('propietario excluido no participa', () => {
    const d = calculate([
      participant('a', 'PRORRATEO'),
      participant('b', 'PRORRATEO', { kind: 'PROPIETARIO', excluded_reason: 'No participa' }),
    ]);
    expect(d.tenant_cents).toBe(40000);
    expect(d.owner_cents).toBe(0);
  });
  test('sin participantes requiere confirmación expresa del propietario', () => {
    expect(() => calculate([])).toThrow(/propietario/);
    expect(calculate([], { assume_owner_remainder: true }).owner_cents).toBe(40000);
  });
  test('saldo sin prorrateo puede ser asumido', () => {
    const d = calculate([participant('a', 'FIJO', { fixed_cents: 10000 })], {
      assume_owner_remainder: true,
    });
    expect(d.owner_remainder_cents).toBe(30000);
  });
  test('saldo negativo bloquea', () => {
    expect(() => calculate([participant('a', 'FIJO', { fixed_cents: 50000 })])).toThrow(/exceden/);
  });
  test('consumo superior al total bloquea', () => {
    expect(() =>
      calculate([participant('a', 'MEDIDOR', { previous_reading: 0, current_reading: 500001 })]),
    ).toThrow(/superan/);
  });
  test('consumo cero permite medidor cero y prorrateo del resto', () => {
    const d = calculate(
      [
        participant('a', 'MEDIDOR', { previous_reading: 1, current_reading: 1 }),
        participant('b', 'PRORRATEO'),
      ],
      { total_consumption: 0 },
    );
    expect(d.meter_cents).toBe(0);
    expect(d.shared_cents).toBe(40000);
  });
  test.each([
    { previous_reading: -1, current_reading: 2 },
    { previous_reading: 2, current_reading: 1 },
    { previous_reading: null, current_reading: 1 },
    { previous_reading: 1, current_reading: null },
  ])('lecturas inválidas se rechazan %o', (reading) => {
    expect(() => calculate([participant('a', 'MEDIDOR', reading)])).toThrow();
  });
  test('lecturas de excluidos no se exigen', () => {
    expect(
      calculate([participant('a', 'MEDIDOR', { excluded_reason: 'No aplica' })], {
        assume_owner_remainder: true,
      }).owner_cents,
    ).toBe(40000);
  });
  test('céntimos y empates se resuelven por identificador estable', () => {
    expect(
      [
        ...largestRemainder(100, [
          { id: 'c', weight: 1 },
          { id: 'b', weight: 1 },
          { id: 'a', weight: 1 },
        ]),
      ].sort(),
    ).toEqual([
      ['a', 34],
      ['b', 33],
      ['c', 33],
    ]);
  });
  test('montos elevados con BigInt en productos', () => {
    const total = Number.MAX_SAFE_INTEGER;
    const d = calculate([participant('a', 'PRORRATEO'), participant('b', 'PRORRATEO')], {
      total_cents: total,
    });
    expect(BigInt(d.tenant_cents) + BigInt(d.owner_cents)).toBe(BigInt(total));
  });
  test('conservación exacta y determinismo en 1000 distribuciones', () => {
    for (let total = 0; total < 1000; total++) {
      const ps = [
        participant('a', 'PRORRATEO', { inhabitants: 3 }),
        participant('b', 'PRORRATEO', { inhabitants: 7 }),
        participant('c', 'PRORRATEO', { kind: 'PROPIETARIO', inhabitants: 2 }),
      ];
      const d = calculate(ps, { total_cents: total, criterion: 'POR_HABITANTES' });
      const reversed = calculate([...ps].reverse(), {
        total_cents: total,
        criterion: 'POR_HABITANTES',
      });
      expect(d.tenant_cents + d.owner_cents).toBe(total);
      expect(d.allocations.map((a) => a.amount_cents)).toEqual(
        reversed.allocations.map((a) => a.amount_cents).reverse(),
      );
    }
  });
  test.each([
    [100, 0, '2026-11-30', '2026-11-25', 'PENDIENTE'],
    [100, 40, '2026-11-30', '2026-11-25', 'PARCIAL'],
    [100, 100, '2026-11-01', '2026-11-25', 'PAGADO'],
    [100, 40, '2026-11-01', '2026-11-25', 'VENCIDO'],
  ] as const)('estado derivado', (amount, paid, due, now, state) =>
    expect(chargeStatus(amount, paid, due, now)).toBe(state),
  );
});
