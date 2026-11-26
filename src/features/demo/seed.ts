import type { Mode, Participant, Repository } from '@/core/contracts';
import { currentPeriod } from '@/shared/formatting';
export async function seedDemo(repo: Repository) {
  if ((await repo.setting('demo_seeded')) === '1') return;
  const period = currentPeriod();
  const start = `${period}-01`;
  const property = 'demo-property-1';
  for (let i = 1; i <= 2; i++)
    await repo.saveProperty({
      id: `demo-property-${i}`,
      name: i === 1 ? 'Edificio Los Olivos · EJEMPLO' : 'Casa Primavera · EJEMPLO',
      address: i === 1 ? 'Av. Ejemplo 123' : 'Jr. Demostración 456',
      district: 'Los Olivos',
      province: 'Lima',
      region: 'Lima',
      kind: i === 1 ? 'Edificio' : 'Casa',
      description: 'Datos ficticios separados de tu gestión real.',
      active: 1,
    });
  const codes = ['101', '102', '201', '202', '301', '302'];
  const occupancies = await repo.occupancies(property);
  for (let i = 0; i < codes.length; i++) {
    await repo.saveUnit({
      id: `demo-unit-${i}`,
      property_id: property,
      code: codes[i]!,
      name: `Departamento ${codes[i]}`,
      floor: String(Math.floor(i / 2) + 1),
      kind: 'Departamento',
      description: 'Ejemplo',
      notes: '',
      active: 1,
    });
    if (i === 5) continue;
    await repo.savePerson({
      id: `demo-person-${i}`,
      first_name: ['Lucía', 'Carlos', 'Ana', 'Luis', 'Rosa'][i]!,
      last_name: 'Ejemplo',
      document_type: 'Otro',
      document_number: `DEMO${i}`,
      phone: '',
      email: '',
      notes: 'Persona ficticia',
      active: 1,
    });
    if (!occupancies.some((o) => o.id === `demo-occupancy-${i}`)) {
      const existing = (await repo.occupancies(property)).find(
        (o) => o.unit_id === `demo-unit-${i}`,
      );
      if (!existing)
        await repo.saveOccupancy({
          unit_id: `demo-unit-${i}`,
          person_id: `demo-person-${i}`,
          kind: i === 4 ? 'PROPIETARIO' : 'INQUILINO',
          start_date: start,
          end_date: null,
          inhabitants: (i % 3) + 1,
          rent_cents: i === 4 ? 0 : 50000 + i * 10000,
          due_day: 5,
          notes: 'Ejemplo',
        });
    }
  }
  await repo.saveUnit({
    id: 'demo-casa-unit',
    property_id: 'demo-property-2',
    code: 'A',
    name: 'Casa completa disponible',
    floor: '1',
    kind: 'Casa',
    description: '',
    notes: '',
    active: 1,
  });
  const service = 'demo-service-luz';
  await repo.saveService({
    id: service,
    property_id: property,
    name: 'Luz',
    unit: 'kWh',
    supports_meter: 1,
    uses_receipt: 1,
    allows_independent: 1,
    criterion: 'EQUITATIVO',
    active: 1,
  });
  await repo.saveService({
    id: 'demo-service-agua',
    property_id: property,
    name: 'Agua',
    unit: 'm³',
    supports_meter: 1,
    uses_receipt: 1,
    allows_independent: 1,
    criterion: 'POR_HABITANTES',
    active: 1,
  });
  for (const o of await repo.occupancies(property)) {
    const index = Number(o.unit_id.split('-').pop());
    if (!(await repo.configs(o.id)).some((c) => c.service_id === service)) {
      const mode: Mode = index < 2 ? 'MEDIDOR' : index === 2 ? 'FIJO' : 'PRORRATEO';
      await repo.saveConfig({
        occupancy_id: o.id,
        service_id: service,
        mode,
        fixed_cents: index === 2 ? 5000 : 0,
        independent: 0,
        effective_from: start,
        effective_to: null,
      });
    }
    if (index < 2 && !(await repo.meters(property)).some((m) => m.unit_id === o.unit_id))
      await repo.saveMeter({
        unit_id: o.unit_id,
        service_id: service,
        serial: `DEMO-${index}`,
        installed_on: start,
        initial_reading: 100000,
        active: 1,
        notes: 'Medidor ficticio',
      });
  }
  let receipt = (await repo.receipts(property, period)).find((r) => r.service_id === service);
  if (!receipt) {
    const id = await repo.saveReceipt({
      property_id: property,
      service_id: service,
      period,
      provider: 'Empresa de ejemplo',
      supply_number: 'DEMO',
      receipt_number: 'DEMO-001',
      total_cents: 40000,
      total_consumption: 500000,
      issued_on: start,
      due_on: `${period}-15`,
      consumption_start: start,
      consumption_end: null,
      notes: 'Ejemplo de modalidades combinadas',
    });
    receipt = (await repo.receipt(id)) ?? undefined;
  }
  if (receipt && !receipt.confirmed_at) {
    const ps = (await repo.receiptParticipants(receipt.id)).map((p): Participant => ({
      ...p,
      current_reading: p.mode === 'MEDIDOR' ? (p.unit_code === '101' ? 250000 : 200000) : null,
    }));
    await repo.saveParticipants(receipt.id, ps);
    await repo.finalizeReceipt(receipt.id, false);
  }
  const monthly = await repo.monthlyPreview(property, period);
  await repo.generateMonthly(property, period, monthly);
  const debts = (await repo.charges(property, period)).filter((c) => c.concept === 'Alquiler');
  for (let i = 0; i < 2; i++) {
    const debt = debts.find((c) => c.unit_code === (i === 0 ? '101' : '102'));
    if (debt)
      await repo.recordPayment({
        id: `demo-payment-${i}`,
        property_id: property,
        person_id: debt.person_id,
        occupancy_id: debt.occupancy_id,
        paid_on: start,
        amount_cents: i === 0 ? debt.amount_cents : 10000,
        method: i === 0 ? 'Yape' : 'Efectivo',
        operation_number: `DEMO-${i}`,
        notes: 'Ejemplo de pago completo o parcial',
        allocations: [{ charge_id: debt.id, amount_cents: i === 0 ? debt.amount_cents : 10000 }],
      });
  }
  await repo.setSetting('onboarding_complete', '1');
  await repo.setSetting('administrator_name', 'Rosa (demostración)');
  await repo.setSetting('demo_seeded', '1');
}
