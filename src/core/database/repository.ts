import type {
  Attachment,
  Charge,
  Dashboard,
  Occupancy,
  Payment,
  PaymentAttachment,
  Property,
  Receipt,
  Repository,
  Service,
} from '@/core/contracts';
import { AppError } from '@/core/errors/AppError';
import { dateLabel, money, periodRange, sumCents, today } from '@/shared/formatting';
import { createAdministrationRepository } from './administration';
import { transaction } from './database';
import {
  audit,
  buildParticipants,
  chargeRows,
  type DB,
  distribution,
  getParticipants,
  getReceipt,
  insertCharge,
  insertParticipant,
  monthlyItems,
  natural,
  occupancySelect,
  receiptSelect,
  required,
  requireDate,
  timestamp,
  uuid,
} from './helpers';
import { createReport } from './reports';
export function createRepository(db: DB): Repository {
  const repo: Repository = {
    ...createAdministrationRepository(db),
    participants: (serviceId, period) => buildParticipants(db, serviceId, period),
    receipts: (propertyId, period) =>
      db.getAllAsync<Receipt>(
        `${receiptSelect} WHERE (? IS NULL OR r.property_id=?) AND (? IS NULL OR r.period=?) ORDER BY r.period DESC,s.name`,
        propertyId ?? null,
        propertyId ?? null,
        period ?? null,
        period ?? null,
      ),
    receipt: (id) => getReceipt(db, id),
    saveReceipt: (input) =>
      transaction(db, async (tx) => {
        periodRange(input.period);
        requireDate(input.issued_on);
        requireDate(input.due_on);
        if (input.due_on < input.issued_on)
          throw new AppError('El vencimiento no puede ser anterior a la emisión.');
        if (input.consumption_start) requireDate(input.consumption_start);
        if (input.consumption_end) requireDate(input.consumption_end);
        if (
          input.consumption_start &&
          input.consumption_end &&
          input.consumption_end < input.consumption_start
        )
          throw new AppError('Revisa las fechas del consumo.');
        natural(input.total_cents, 'El total');
        if (input.total_consumption !== null) natural(input.total_consumption, 'El consumo total');
        const s = await required<Service>(tx, 'SELECT * FROM property_services WHERE id=?', [
          input.service_id,
        ]);
        const property = await required<Property>(tx, 'SELECT * FROM properties WHERE id=?', [
          input.property_id,
        ]);
        if (!property.active && !input.id)
          throw new AppError('Reactiva el inmueble antes de registrar una factura nueva.');
        if (s.property_id !== input.property_id || !s.uses_receipt)
          throw new AppError('Selecciona un servicio con recibo del mismo inmueble.');
        if (!s.active && !input.id)
          throw new AppError('Activa el servicio antes de registrar un nuevo recibo.');
        const original = input.id ? await getReceipt(tx, input.id) : null;
        if (original?.confirmed_at || original?.status === 'ANULADO')
          throw new AppError('El recibo cerrado no puede editarse.');
        if (
          original &&
          (original.period !== input.period ||
            original.service_id !== input.service_id ||
            original.property_id !== input.property_id)
        )
          throw new AppError('Crea otro borrador para cambiar el inmueble, servicio o periodo.');
        if (
          await tx.getFirstAsync(
            "SELECT id FROM master_receipts WHERE property_id=? AND service_id=? AND period=? AND status<>'ANULADO' AND id<>?",
            input.property_id,
            input.service_id,
            input.period,
            input.id ?? '',
          )
        )
          throw new AppError('Ya existe un recibo de este servicio en el periodo.');
        const id = input.id ?? uuid();
        await tx.runAsync(
          'INSERT INTO master_receipts(id,property_id,service_id,period,provider,supply_number,receipt_number,total_cents,total_consumption,issued_on,due_on,consumption_start,consumption_end,notes,status,criterion) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,supply_number=excluded.supply_number,receipt_number=excluded.receipt_number,total_cents=excluded.total_cents,total_consumption=excluded.total_consumption,issued_on=excluded.issued_on,due_on=excluded.due_on,consumption_start=excluded.consumption_start,consumption_end=excluded.consumption_end,notes=excluded.notes',
          id,
          input.property_id,
          input.service_id,
          input.period,
          input.provider,
          input.supply_number,
          input.receipt_number,
          input.total_cents,
          input.total_consumption,
          input.issued_on,
          input.due_on,
          input.consumption_start,
          input.consumption_end,
          input.notes,
          'BORRADOR',
          s.criterion,
        );
        if (!original)
          for (const p of await buildParticipants(tx, s.id, input.period))
            await insertParticipant(tx, id, p);
        await audit(tx, 'receipt', id, 'GUARDAR_BORRADOR');
        return id;
      }),
    receiptParticipants: (id) => getParticipants(db, id),
    saveParticipants: (id, participants) =>
      transaction(db, async (tx) => {
        const r = await required<Receipt>(tx, 'SELECT * FROM master_receipts WHERE id=?', [id]);
        if (r.confirmed_at || r.status === 'ANULADO')
          throw new AppError('El recibo cerrado no puede editarse.');
        const originals = await getParticipants(tx, id);
        if (
          originals.length !== participants.length ||
          new Set(participants.map((p) => p.id)).size !== participants.length
        )
          throw new AppError('La lista de participantes no coincide con el borrador.');
        for (const p of participants) {
          const old = originals.find((row) => row.id === p.id);
          if (!old) throw new AppError('Participante desconocido.');
          for (const key of [
            'occupancy_id',
            'unit_id',
            'person_id',
            'kind',
            'mode',
            'fixed_cents',
            'meter_id',
            'unit_code',
            'person_name',
          ] as const)
            if (p[key] !== old[key])
              throw new AppError('No se pueden sustituir las condiciones del participante.');
          if (old.excluded_reason && !p.excluded_reason)
            throw new AppError(
              'Configura el servicio y crea un nuevo borrador para incluir esta ocupación.',
            );
          natural(p.inhabitants, 'La cantidad de habitantes', 1);
          if (p.previous_reading !== null) natural(p.previous_reading, 'La lectura anterior');
          if (p.current_reading !== null) natural(p.current_reading, 'La lectura actual');
          if (p.previous_reading !== old.previous_reading && !r.notes.trim())
            throw new AppError(
              'Documenta el motivo del ajuste de lectura anterior en las observaciones del recibo.',
            );
          if (
            p.current_reading !== null &&
            p.previous_reading !== null &&
            p.current_reading < p.previous_reading
          )
            throw new AppError('La lectura actual no puede ser menor que la anterior.');
          await tx.runAsync(
            'UPDATE receipt_participants SET previous_reading=?,current_reading=?,inhabitants=?,excluded_reason=? WHERE id=? AND receipt_id=?',
            p.previous_reading,
            p.current_reading,
            p.inhabitants,
            p.excluded_reason,
            p.id,
            id,
          );
        }
        const missing = participants.some(
          (p) =>
            !p.excluded_reason &&
            p.mode === 'MEDIDOR' &&
            (p.previous_reading === null || p.current_reading === null),
        );
        await tx.runAsync(
          'UPDATE master_receipts SET status=? WHERE id=?',
          missing ? 'PENDIENTE_LECTURAS' : 'LISTO_PARA_CONFIRMAR',
          id,
        );
      }),
    previewReceipt: (id, owner) => distribution(db, id, owner),
    finalizeReceipt: (id, owner) =>
      transaction(db, async (tx) => {
        const r = await required<Receipt>(tx, `${receiptSelect} WHERE r.id=?`, [id]);
        if (r.status === 'FINALIZADO') return;
        if (r.status === 'ANULADO') throw new AppError('Esta factura fue anulada.');
        const d = await distribution(tx, id, owner);
        const ps = await getParticipants(tx, id);
        const recordedMeters = new Set<string>();
        for (const a of d.allocations) {
          const p = ps.find((p) => p.id === a.participant_id);
          if (!p) throw new AppError('Falta un participante.');
          if (!p.excluded_reason && p.mode === 'MEDIDOR') {
            if (!p.meter_id || p.previous_reading === null || p.current_reading === null)
              throw new AppError('Instala un medidor y completa sus lecturas.');
            if (!recordedMeters.has(p.meter_id)) {
              const group = ps.filter(
                (row) =>
                  !row.excluded_reason && row.mode === 'MEDIDOR' && row.meter_id === p.meter_id,
              );
              await tx.runAsync(
                'INSERT INTO meter_readings(id,meter_id,receipt_id,period,previous_reading,current_reading,adjustment_reason) VALUES(?,?,?,?,?,?,?)',
                uuid(),
                p.meter_id,
                id,
                r.period,
                Math.min(...group.map((row) => row.previous_reading!)),
                Math.max(...group.map((row) => row.current_reading!)),
                r.notes,
              );
              recordedMeters.add(p.meter_id);
            }
          }
          await tx.runAsync(
            'INSERT INTO receipt_allocations(id,receipt_id,participant_id,amount_cents,consumption) VALUES(?,?,?,?,?)',
            uuid(),
            id,
            p.id,
            a.amount_cents,
            a.consumption,
          );
          if (a.amount_cents > 0) {
            if (p.kind === 'PROPIETARIO')
              await tx.runAsync(
                'INSERT INTO owner_expenses(id,property_id,receipt_id,period,concept,amount_cents,unit_code) VALUES(?,?,?,?,?,?,?)',
                uuid(),
                r.property_id,
                id,
                r.period,
                r.service_name ?? 'Servicio',
                a.amount_cents,
                p.unit_code,
              );
            else
              await insertCharge(tx, {
                property_id: r.property_id,
                occupancy_id: p.occupancy_id,
                person_id: p.person_id,
                period: r.period,
                concept: r.service_name ?? 'Servicio',
                amount_cents: a.amount_cents,
                due_on: r.due_on,
                receipt_id: id,
                source_key: `receipt:${id}:${p.occupancy_id}`,
                unit_code: p.unit_code,
                person_name: p.person_name,
              });
          }
        }
        if (d.owner_remainder_cents)
          await tx.runAsync(
            'INSERT INTO owner_expenses(id,property_id,receipt_id,period,concept,amount_cents,unit_code) VALUES(?,?,?,?,?,?,?)',
            uuid(),
            r.property_id,
            id,
            r.period,
            'Saldo de factura asumido',
            d.owner_remainder_cents,
            '',
          );
        await tx.runAsync(
          'UPDATE master_receipts SET status=?,confirmed_at=?,distribution_json=? WHERE id=?',
          'FINALIZADO',
          timestamp(),
          JSON.stringify(d),
          id,
        );
        await audit(tx, 'receipt', id, 'FINALIZAR', { algorithm: d.algorithm_version });
      }),
    cancelReceipt: (id, reason) =>
      transaction(db, async (tx) => {
        if (!reason.trim()) throw new AppError('Escribe un motivo para anular.');
        const r = await required<Receipt>(tx, 'SELECT * FROM master_receipts WHERE id=?', [id]);
        if (r.status === 'ANULADO') return;
        if (
          await tx.getFirstAsync(
            'SELECT id FROM charge_balances WHERE receipt_id=? AND paid_cents>0',
            id,
          )
        )
          throw new AppError('Primero anula los pagos asociados a esta factura.');
        await tx.runAsync('UPDATE charges SET cancelled=1 WHERE receipt_id=?', id);
        await tx.runAsync(
          'UPDATE master_receipts SET status=?,cancel_reason=?,cancelled_at=? WHERE id=?',
          'ANULADO',
          reason.trim(),
          timestamp(),
          id,
        );
        await audit(tx, 'receipt', id, 'ANULAR', { reason });
      }),
    monthlyPreview: (propertyId, period) => monthlyItems(db, propertyId, period),
    generateMonthly: (propertyId, period, items) =>
      transaction(db, async (tx) => {
        periodRange(period);
        const allowed = await monthlyItems(tx, propertyId, period);
        const keys = new Set<string>();
        for (const item of items) {
          if (keys.has(item.key)) throw new AppError('Hay conceptos duplicados.');
          keys.add(item.key);
          const original = allowed.find((i) => i.key === item.key);
          if (!original) {
            if (
              await tx.getFirstAsync(
                'SELECT id FROM charges WHERE source_key=? UNION ALL SELECT id FROM owner_expenses WHERE source_key=?',
                item.key,
                item.key,
              )
            )
              continue;
            throw new AppError('La vista previa cambió. Vuelve a revisar el periodo.');
          }
          natural(item.amount_cents, 'El importe acordado');
          if (original.kind === 'PROPIETARIO') {
            await tx.runAsync(
              'INSERT INTO owner_expenses(id,property_id,receipt_id,period,concept,amount_cents,unit_code,source_key) VALUES(?,?,NULL,?,?,?,?,?)',
              uuid(),
              propertyId,
              period,
              original.concept,
              item.amount_cents,
              original.unit_code,
              item.key,
            );
            continue;
          }
          await insertCharge(tx, {
            ...original,
            amount_cents: item.amount_cents,
            property_id: propertyId,
            period,
            receipt_id: null,
            source_key: item.key,
          });
        }
        await tx.runAsync(
          'INSERT OR IGNORE INTO billing_periods(id,property_id,period) VALUES(?,?,?)',
          uuid(),
          propertyId,
          period,
        );
        await audit(tx, 'monthly', `${propertyId}:${period}`, 'GENERAR');
      }),
    charges: (propertyId, period, personId) => chargeRows(db, propertyId, period, personId),
    payments: (propertyId, personId) =>
      db.getAllAsync<Payment>(
        `SELECT p.*,EXISTS(SELECT 1 FROM payment_reversals r WHERE r.payment_id=p.id) reversed,o.unit_id,u.code unit_code,pe.first_name||' '||pe.last_name person_name FROM payments p JOIN occupancies o ON o.id=p.occupancy_id JOIN units u ON u.id=o.unit_id JOIN people pe ON pe.id=p.person_id WHERE (? IS NULL OR p.property_id=?) AND (? IS NULL OR p.person_id=?) ORDER BY p.paid_on DESC,p.created_at DESC`,
        propertyId ?? null,
        propertyId ?? null,
        personId ?? null,
        personId ?? null,
      ),
    paymentDetails: async (paymentId) => {
      const payment = await required<Payment>(db, 'SELECT * FROM payments WHERE id=?', [paymentId]);
      const reversed = await db.getFirstAsync(
        'SELECT id FROM payment_reversals WHERE payment_id=?',
        paymentId,
      );
      const applied = await db.getAllAsync<Charge & { applied_cents: number }>(
        'SELECT c.*,a.amount_cents applied_cents FROM payment_allocations a JOIN charge_balances c ON c.id=a.charge_id WHERE a.payment_id=? ORDER BY c.due_on,c.concept',
        paymentId,
      );
      return applied.map((c) => ({
        Departamento: c.unit_code,
        Responsable: c.person_name,
        Periodo: c.period,
        Concepto: c.concept,
        Importe: money(c.amount_cents),
        Este_pago: money(c.applied_cents),
        Pagos_vigentes: money(c.paid_cents),
        Saldo_actual: money(c.balance_cents),
        Fecha: dateLabel(payment.paid_on),
        Método: payment.method,
        Operación: payment.operation_number,
        Estado: reversed ? 'Anulado' : 'Recibido',
      }));
    },
    recordPayment: (input) =>
      transaction(db, async (tx) => {
        requireDate(input.paid_on);
        natural(input.amount_cents, 'El pago', 1);
        if (input.paid_on > today())
          throw new AppError('La fecha del pago recibido no puede ser futura.');
        const existing = await tx.getFirstAsync<Payment>(
          'SELECT * FROM payments WHERE id=?',
          input.id,
        );
        if (existing) {
          if (
            existing.amount_cents !== input.amount_cents ||
            existing.person_id !== input.person_id
          )
            throw new AppError('Este identificador de pago ya se utilizó.');
          return;
        }
        const o = await required<Occupancy>(tx, `${occupancySelect} WHERE o.id=?`, [
          input.occupancy_id,
        ]);
        if (o.person_id !== input.person_id || o.property_id !== input.property_id)
          throw new AppError('El pago no corresponde a esta persona y ocupación.');
        let sum = 0n;
        const seen = new Set<string>();
        for (const a of input.allocations) {
          natural(a.amount_cents, 'El abono', 1);
          if (seen.has(a.charge_id)) throw new AppError('No dupliques un cobro en el reparto.');
          seen.add(a.charge_id);
          sum += BigInt(a.amount_cents);
          const c = await required<Charge & { cancelled: number }>(
            tx,
            'SELECT * FROM charge_balances WHERE id=?',
            [a.charge_id],
          );
          if (
            c.cancelled ||
            c.occupancy_id !== o.id ||
            c.person_id !== input.person_id ||
            c.property_id !== input.property_id ||
            a.amount_cents > c.balance_cents
          )
            throw new AppError('El abono supera el saldo o pertenece a otro responsable.');
        }
        if (sum !== BigInt(input.amount_cents))
          throw new AppError(
            'La suma de los abonos debe coincidir exactamente con el pago recibido.',
          );
        await tx.runAsync(
          'INSERT INTO payments(id,property_id,occupancy_id,person_id,paid_on,amount_cents,method,operation_number,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
          input.id,
          input.property_id,
          input.occupancy_id,
          input.person_id,
          input.paid_on,
          input.amount_cents,
          input.method,
          input.operation_number,
          input.notes,
          timestamp(),
        );
        for (const a of input.allocations)
          await tx.runAsync(
            'INSERT INTO payment_allocations(id,payment_id,charge_id,amount_cents) VALUES(?,?,?,?)',
            uuid(),
            input.id,
            a.charge_id,
            a.amount_cents,
          );
        await audit(tx, 'payment', input.id, 'RECIBIR');
      }),
    reversePayment: (id, reason) =>
      transaction(db, async (tx) => {
        if (!reason.trim()) throw new AppError('Escribe el motivo de la anulación.');
        await required<Payment>(tx, 'SELECT * FROM payments WHERE id=?', [id]);
        if (await tx.getFirstAsync('SELECT id FROM payment_reversals WHERE payment_id=?', id))
          return;
        await tx.runAsync(
          'INSERT INTO payment_reversals(id,payment_id,reason,created_at) VALUES(?,?,?,?)',
          uuid(),
          id,
          reason,
          timestamp(),
        );
        await audit(tx, 'payment', id, 'ANULAR', { reason });
      }),
    dashboard: async (propertyId, period) => {
      const [first, last] = periodRange(period);
      const charges = await chargeRows(db, propertyId, period);
      const active = charges.filter((c) => c.status !== 'ANULADO');
      const payments = await repo.payments(propertyId);
      const receipts = await repo.receipts(propertyId, period);
      const units = await db.getAllAsync<{ id: string; occupied: number }>(
        `SELECT u.id,EXISTS(SELECT 1 FROM occupancies o WHERE o.unit_id=u.id AND o.start_date<=? AND (o.end_date IS NULL OR o.end_date>=?)) occupied FROM units u WHERE u.active=1 AND (? IS NULL OR u.property_id=?)`,
        today(),
        today(),
        propertyId ?? null,
        propertyId ?? null,
      );
      const expenses = await db.getFirstAsync<{ total: number }>(
        "SELECT coalesce(sum(e.amount_cents),0) total FROM owner_expenses e LEFT JOIN master_receipts r ON r.id=e.receipt_id WHERE e.period=? AND (? IS NULL OR e.property_id=?) AND (r.id IS NULL OR r.status<>'ANULADO')",
        period,
        propertyId ?? null,
        propertyId ?? null,
      );
      return {
        charged_cents: sumCents(active.map((c) => c.amount_cents)),
        collected_cents: sumCents(
          payments
            .filter((p) => !p.reversed && p.paid_on >= first && p.paid_on <= last)
            .map((p) => p.amount_cents),
        ),
        pending_cents: sumCents(active.map((c) => c.balance_cents)),
        overdue_cents: sumCents(
          active.filter((c) => c.due_on < today()).map((c) => c.balance_cents),
        ),
        supplier_cents: sumCents(
          receipts.filter((r) => r.status === 'FINALIZADO').map((r) => r.total_cents),
        ),
        owner_cents: sumCents([expenses?.total ?? 0]),
        occupied_units: units.filter((u) => u.occupied).length,
        available_units: units.filter((u) => !u.occupied).length,
        pending_receipts: receipts.filter((r) => !['FINALIZADO', 'ANULADO'].includes(r.status))
          .length,
        upcoming: active.filter((c) => c.balance_cents > 0).slice(0, 5),
      } satisfies Dashboard;
    },
    setting: async (key) =>
      (await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key=?', key))
        ?.value ?? null,
    setSetting: (key, value) =>
      transaction(db, async (tx) => {
        await tx.runAsync(
          'INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          key,
          value,
        );
      }),
    attachments: (receiptId) =>
      db.getAllAsync<Attachment>('SELECT * FROM receipt_attachments WHERE receipt_id=?', receiptId),
    addAttachment: (input) =>
      transaction(db, async (tx) => {
        const r = await required<Receipt>(tx, 'SELECT * FROM master_receipts WHERE id=?', [
          input.receipt_id,
        ]);
        if (r.confirmed_at || r.status === 'ANULADO')
          throw new AppError('Solo se adjuntan documentos a borradores.');
        if (!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|heic|pdf)$/i.test(input.relative_path))
          throw new AppError('El nombre del archivo no es válido.');
        if (input.meter_id) {
          const meter = await required<{ service_id: string }>(
            tx,
            'SELECT service_id FROM meters WHERE id=?',
            [input.meter_id],
          );
          if (meter.service_id !== r.service_id)
            throw new AppError('El medidor no corresponde al servicio del recibo.');
        }
        await tx.runAsync(
          'INSERT INTO receipt_attachments(id,receipt_id,relative_path,name,mime_type,size,meter_id) VALUES(?,?,?,?,?,?,?)',
          input.id,
          input.receipt_id,
          input.relative_path,
          input.name,
          input.mime_type,
          input.size,
          input.meter_id ?? null,
        );
      }),
    deleteAttachment: (id) =>
      transaction(db, async (tx) => {
        const a = await required<Attachment>(tx, 'SELECT * FROM receipt_attachments WHERE id=?', [
          id,
        ]);
        const r = await required<Receipt>(tx, 'SELECT * FROM master_receipts WHERE id=?', [
          a.receipt_id,
        ]);
        if (r.confirmed_at || r.status === 'ANULADO')
          throw new AppError('Los adjuntos de un recibo cerrado se conservan.');
        await tx.runAsync('DELETE FROM receipt_attachments WHERE id=?', id);
      }),
    paymentAttachments: (paymentId) =>
      db.getAllAsync<PaymentAttachment>(
        'SELECT * FROM payment_attachments WHERE payment_id=?',
        paymentId,
      ),
    addPaymentAttachment: (value) =>
      transaction(db, async (tx) => {
        await required<Payment>(tx, 'SELECT * FROM payments WHERE id=?', [value.payment_id]);
        if (!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|heic|pdf)$/i.test(value.relative_path))
          throw new AppError('El nombre del documento no es válido.');
        await tx.runAsync(
          'INSERT INTO payment_attachments(id,payment_id,relative_path,name,mime_type,size) VALUES(?,?,?,?,?,?)',
          value.id,
          value.payment_id,
          value.relative_path,
          value.name,
          value.mime_type,
          value.size,
        );
        await audit(tx, 'payment', value.payment_id, 'ADJUNTAR_EVIDENCIA');
      }),
    report: createReport(db, () => repo),
  };
  return repo;
}
