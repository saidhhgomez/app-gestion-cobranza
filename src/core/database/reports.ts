import type { Repository, Row } from '@/core/contracts';
import { dateLabel, money, periodRange, sumCents } from '@/shared/formatting';
import type { DB } from './helpers';
export function createReport(db: DB, getRepo: () => Repository): Repository['report'] {
  return async (kind, propertyId, period, personId) => {
    const repo = getRepo();
    if (kind === 'payments') {
      const rows = (await repo.payments(propertyId, personId)).filter(
        (p) => !period || p.paid_on.startsWith(period),
      );
      return rows.map((p) => ({
        Persona: p.person_name ?? '',
        Departamento: p.unit_code ?? '',
        Fecha: dateLabel(p.paid_on),
        Importe: money(p.amount_cents),
        Método: p.method,
        Estado: p.reversed ? 'Anulado' : 'Recibido',
      }));
    }
    if (kind === 'receipts')
      return (await repo.receipts(propertyId, period)).map((r) => ({
        Servicio: r.service_name ?? '',
        Periodo: r.period,
        Proveedor: r.provider,
        Importe: money(r.total_cents),
        Estado: r.status,
      }));
    if (kind === 'owner') {
      const rows = await db.getAllAsync<{
        period: string;
        concept: string;
        unit_code: string;
        amount_cents: number;
      }>(
        "SELECT e.* FROM owner_expenses e LEFT JOIN master_receipts r ON r.id=e.receipt_id WHERE (? IS NULL OR e.property_id=?) AND (? IS NULL OR e.period=?) AND (r.id IS NULL OR r.status<>'ANULADO')",
        propertyId ?? null,
        propertyId ?? null,
        period ?? null,
        period ?? null,
      );
      return rows.map((r) => ({
        Periodo: r.period,
        Concepto: r.concept,
        Departamento: r.unit_code,
        Importe: money(r.amount_cents),
      }));
    }
    if (kind === 'occupancy')
      return (await repo.occupancies(propertyId, personId))
        .filter(
          (o) =>
            !period ||
            (o.start_date <= periodRange(period)[1] &&
              (!o.end_date || o.end_date >= periodRange(period)[0])),
        )
        .map((o) => ({
          Departamento: o.unit_code ?? '',
          Responsable: o.person_name ?? '',
          Tipo: o.kind,
          Inicio: dateLabel(o.start_date),
          Fin: o.end_date ? dateLabel(o.end_date) : 'Vigente',
          Habitantes: o.inhabitants,
        }));
    if (kind === 'distribution' || kind === 'consumption') {
      const rows = await db.getAllAsync<{
        unit_code: string;
        person_name: string;
        period: string;
        name: string;
        amount_cents: number;
        consumption: number;
        mode: string;
      }>(
        "SELECT p.unit_code,p.person_name,p.mode,r.period,s.name,a.amount_cents,a.consumption FROM receipt_allocations a JOIN receipt_participants p ON p.id=a.participant_id JOIN master_receipts r ON r.id=a.receipt_id JOIN property_services s ON s.id=r.service_id WHERE r.status='FINALIZADO' AND (? IS NULL OR r.property_id=?) AND (? IS NULL OR r.period=?) ORDER BY r.period,p.unit_code",
        propertyId ?? null,
        propertyId ?? null,
        period ?? null,
        period ?? null,
      );
      return rows.map((r) => ({
        Departamento: r.unit_code,
        Responsable: r.person_name,
        Servicio: r.name,
        Periodo: r.period,
        Modalidad: r.mode,
        Consumo: r.consumption / 1000,
        Importe: money(r.amount_cents),
      }));
    }
    const rows = (await repo.charges(propertyId, period, personId)).filter(
      (c) => c.status !== 'ANULADO' && (kind !== 'debts' || c.balance_cents > 0),
    );
    const result: Row[] = rows.map((c) => ({
      Departamento: c.unit_code,
      Responsable: c.person_name,
      Periodo: c.period,
      Concepto: c.concept,
      Vencimiento: dateLabel(c.due_on),
      Importe: money(c.amount_cents),
      Abonado: money(c.paid_cents),
      Saldo: money(c.balance_cents),
      Estado: c.status,
    }));
    if (rows.length)
      result.push({
        Departamento: 'TOTAL',
        Importe: money(sumCents(rows.map((c) => c.amount_cents))),
        Abonado: money(sumCents(rows.map((c) => c.paid_cents))),
        Saldo: money(sumCents(rows.map((c) => c.balance_cents))),
      });
    return result;
  };
}
