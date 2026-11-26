import type {
  Meter,
  Occupancy,
  Person,
  Property,
  Repository,
  Service,
  ServiceConfig,
  Unit,
} from '@/core/contracts';
import { AppError } from '@/core/errors/AppError';
import { today } from '@/shared/formatting';
import { transaction } from './database';
import {
  audit,
  type DB,
  natural,
  occupancySelect,
  previousDay,
  required,
  requireDate,
  save,
  uuid,
} from './helpers';
export function createAdministrationRepository(
  db: DB,
): Pick<
  Repository,
  | 'properties'
  | 'saveProperty'
  | 'archiveProperty'
  | 'units'
  | 'saveUnit'
  | 'people'
  | 'savePerson'
  | 'occupancies'
  | 'saveOccupancy'
  | 'endOccupancy'
  | 'services'
  | 'changeTerms'
  | 'residents'
  | 'addResident'
  | 'saveService'
  | 'configs'
  | 'saveConfig'
  | 'meters'
  | 'saveMeter'
> {
  return {
    properties: () =>
      db.getAllAsync<Property>('SELECT * FROM properties ORDER BY active DESC,name'),
    saveProperty: (input) =>
      transaction(db, async (tx) => {
        if (!input.name.trim() || !input.address.trim())
          throw new AppError('El nombre y la dirección son obligatorios.');
        return save(tx, 'properties', input);
      }),
    archiveProperty: (id, active) =>
      transaction(db, async (tx) => {
        if (!active) {
          const pending = await tx.getFirstAsync<{ n: number }>(
            `SELECT (SELECT count(*) FROM occupancies o JOIN units u ON u.id=o.unit_id WHERE u.property_id=? AND (o.end_date IS NULL OR o.end_date>=?))+(SELECT count(*) FROM charge_balances WHERE property_id=? AND balance_cents>0 AND cancelled=0)+(SELECT count(*) FROM master_receipts WHERE property_id=? AND status NOT IN('FINALIZADO','ANULADO')) n`,
            id,
            today(),
            id,
            id,
          );
          if (pending?.n)
            throw new AppError(
              'Resuelve las ocupaciones vigentes, deudas o recibos pendientes antes de archivar.',
            );
        }
        await tx.runAsync('UPDATE properties SET active=? WHERE id=?', Number(active), id);
        await audit(tx, 'property', id, active ? 'REACTIVAR' : 'ARCHIVAR');
      }),
    units: (propertyId) =>
      db.getAllAsync<Unit>(
        `SELECT u.*,(SELECT o.kind FROM occupancies o WHERE o.unit_id=u.id AND o.start_date<=? AND (o.end_date IS NULL OR o.end_date>=?)) occupancy_type,(SELECT p.first_name||' '||p.last_name FROM occupancies o JOIN people p ON p.id=o.person_id WHERE o.unit_id=u.id AND o.start_date<=? AND (o.end_date IS NULL OR o.end_date>=?)) person_name FROM units u WHERE u.property_id=? ORDER BY u.code`,
        today(),
        today(),
        today(),
        today(),
        propertyId,
      ),
    saveUnit: (input) =>
      transaction(db, async (tx) => {
        const property = await required<Property>(tx, 'SELECT * FROM properties WHERE id=?', [
          input.property_id,
        ]);
        if (!property.active && input.active)
          throw new AppError('Reactiva el inmueble antes de registrar o activar unidades.');
        if (!input.code.trim() || !input.name.trim())
          throw new AppError('Indica el código y el nombre de la unidad.');
        if (input.id) {
          const old = await tx.getFirstAsync<Unit>('SELECT * FROM units WHERE id=?', input.id);
          if (old && old.property_id !== input.property_id)
            throw new AppError('Una unidad con historial no puede cambiar de inmueble.');
          if (
            !input.active &&
            (await tx.getFirstAsync(
              'SELECT id FROM occupancies WHERE unit_id=? AND (end_date IS NULL OR end_date>=?)',
              input.id,
              today(),
            ))
          )
            throw new AppError('Finaliza primero las ocupaciones vigentes.');
        }
        const duplicate = await tx.getFirstAsync(
          'SELECT id FROM units WHERE property_id=? AND code=? AND id<>?',
          input.property_id,
          input.code.trim(),
          input.id ?? '',
        );
        if (duplicate) throw new AppError('Ya existe este código de unidad en el inmueble.');
        return save(tx, 'units', { ...input, code: input.code.trim() });
      }),
    people: (search = '') => {
      const q = `%${search}%`;
      return db.getAllAsync<Person>(
        "SELECT * FROM people WHERE first_name||' '||last_name LIKE ? OR document_number LIKE ? OR phone LIKE ? ORDER BY first_name,last_name",
        q,
        q,
        q,
      );
    },
    savePerson: (input) =>
      transaction(db, async (tx) => {
        if (!input.first_name.trim() || !input.last_name.trim())
          throw new AppError('Indica nombres y apellidos.');
        if (
          input.document_type === 'DNI' &&
          input.document_number &&
          !/^\d{8}$/.test(input.document_number)
        )
          throw new AppError('El DNI debe tener ocho dígitos.');
        if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
          throw new AppError('Revisa el correo electrónico.');
        if (
          input.document_number &&
          (await tx.getFirstAsync(
            'SELECT id FROM people WHERE document_type=? AND document_number=? AND id<>?',
            input.document_type,
            input.document_number,
            input.id ?? '',
          ))
        )
          throw new AppError('El documento ya pertenece a otra persona registrada.');
        return save(tx, 'people', input);
      }),
    occupancies: (propertyId, personId) =>
      db.getAllAsync<Occupancy>(
        `${occupancySelect} WHERE (? IS NULL OR u.property_id=?) AND (? IS NULL OR o.person_id=?) ORDER BY o.start_date DESC`,
        propertyId ?? null,
        propertyId ?? null,
        personId ?? null,
        personId ?? null,
      ),
    saveOccupancy: (input) =>
      transaction(db, async (tx) => {
        requireDate(input.start_date);
        if (input.end_date) requireDate(input.end_date);
        natural(input.inhabitants, 'La cantidad de habitantes', 1);
        natural(input.rent_cents, 'El alquiler');
        natural(input.due_day, 'El día de vencimiento', 1);
        if (input.due_day > 31)
          throw new AppError('El vencimiento debe ser entre el día 1 y el 31.');
        if (input.kind === 'PROPIETARIO' && input.rent_cents)
          throw new AppError('La ocupación de propietario no genera alquiler.');
        const unit = await required<Unit>(tx, 'SELECT * FROM units WHERE id=?', [input.unit_id]);
        const property = await required<Property>(tx, 'SELECT * FROM properties WHERE id=?', [
          unit.property_id,
        ]);
        if (!property.active)
          throw new AppError('Reactiva el inmueble antes de registrar ocupaciones.');
        const person = await required<Person>(tx, 'SELECT * FROM people WHERE id=?', [
          input.person_id,
        ]);
        if (!unit.active || !person.active)
          throw new AppError('Selecciona una unidad y persona activas.');
        if (input.id) {
          throw new AppError(
            'Para cambiar alquiler o habitantes, registra nuevas condiciones con vigencia desde el detalle de la ocupación.',
          );
        }
        if (
          await tx.getFirstAsync(
            'SELECT id FROM occupancies WHERE unit_id=? AND start_date<=? AND coalesce(end_date,?)>=?',
            input.unit_id,
            input.end_date ?? '9999-12-31',
            '9999-12-31',
            input.start_date,
          )
        )
          throw new AppError('La unidad ya tiene una ocupación en esas fechas.');
        const id = await save(tx, 'occupancies', input);
        await tx.runAsync(
          'INSERT INTO occupancy_terms(id,occupancy_id,effective_from,inhabitants,rent_cents,due_day) VALUES(?,?,?,?,?,?)',
          uuid(),
          id,
          input.start_date,
          input.inhabitants,
          input.rent_cents,
          input.due_day,
        );
        return id;
      }),
    endOccupancy: (id, endDate) =>
      transaction(db, async (tx) => {
        requireDate(endDate);
        const o = await required<Occupancy>(tx, 'SELECT * FROM occupancies WHERE id=?', [id]);
        if (o.end_date) throw new AppError('Esta ocupación ya finalizó.');
        if (endDate < o.start_date)
          throw new AppError('La salida no puede ser anterior al ingreso.');
        if (
          await tx.getFirstAsync(
            'SELECT id FROM charges WHERE occupancy_id=? AND period>? AND cancelled=0',
            id,
            endDate.slice(0, 7),
          )
        )
          throw new AppError(
            'Hay cobros posteriores a esta fecha. Revisa el cierre antes de finalizar.',
          );
        await tx.runAsync('UPDATE occupancies SET end_date=? WHERE id=?', endDate, id);
        await audit(tx, 'occupancy', id, 'FINALIZAR', { endDate });
      }),
    services: (propertyId) =>
      db.getAllAsync<Service>(
        'SELECT * FROM property_services WHERE property_id=? ORDER BY name',
        propertyId,
      ),
    changeTerms: (id, from, rent, inhabitants, dueDay) =>
      transaction(db, async (tx) => {
        requireDate(from);
        natural(rent, 'El alquiler');
        natural(inhabitants, 'Los habitantes', 1);
        natural(dueDay, 'El día de vencimiento', 1);
        if (dueDay > 31) throw new AppError('El día de vencimiento debe ser entre 1 y 31.');
        const o = await required<Occupancy>(tx, 'SELECT * FROM occupancies WHERE id=?', [id]);
        if (o.end_date || from < o.start_date)
          throw new AppError('Selecciona una ocupación vigente y una fecha posterior al ingreso.');
        if (o.kind === 'PROPIETARIO' && rent)
          throw new AppError('El propietario no genera alquiler.');
        if (
          (await tx.getFirstAsync(
            'SELECT id FROM charges WHERE occupancy_id=? AND period>=? AND cancelled=0',
            id,
            from.slice(0, 7),
          )) ||
          (await tx.getFirstAsync(
            'SELECT p.id FROM receipt_participants p JOIN master_receipts r ON r.id=p.receipt_id WHERE p.occupancy_id=? AND r.confirmed_at IS NOT NULL AND r.period>=?',
            id,
            from.slice(0, 7),
          ))
        )
          throw new AppError('Utiliza una fecha posterior a los cobros y recibos confirmados.');
        if (
          await tx.getFirstAsync(
            'SELECT id FROM occupancy_terms WHERE occupancy_id=? AND effective_from>=?',
            id,
            from,
          )
        )
          throw new AppError('Ya hay condiciones desde esa fecha o una fecha posterior.');
        await tx.runAsync(
          'INSERT INTO occupancy_terms(id,occupancy_id,effective_from,inhabitants,rent_cents,due_day) VALUES(?,?,?,?,?,?)',
          uuid(),
          id,
          from,
          inhabitants,
          rent,
          dueDay,
        );
        await audit(tx, 'occupancy', id, 'NUEVAS_CONDICIONES', { from });
      }),
    residents: (occupancyId) =>
      db.getAllAsync<Person>(
        'SELECT p.* FROM occupancy_residents r JOIN people p ON p.id=r.person_id WHERE r.occupancy_id=?',
        occupancyId,
      ),
    addResident: (occupancyId, personId) =>
      transaction(db, async (tx) => {
        await tx.runAsync(
          'INSERT OR IGNORE INTO occupancy_residents(id,occupancy_id,person_id) VALUES(?,?,?)',
          uuid(),
          occupancyId,
          personId,
        );
      }),
    saveService: (input) =>
      transaction(db, async (tx) => {
        const property = await required<Property>(tx, 'SELECT * FROM properties WHERE id=?', [
          input.property_id,
        ]);
        if (!property.active && input.active)
          throw new AppError('Reactiva el inmueble antes de habilitar servicios.');
        if (!input.name.trim()) throw new AppError('Indica el nombre del servicio.');
        if (input.id) {
          const old = await tx.getFirstAsync<Service>(
            'SELECT * FROM property_services WHERE id=?',
            input.id,
          );
          if (old && old.property_id !== input.property_id)
            throw new AppError('El servicio no puede cambiar de inmueble.');
        }
        return save(tx, 'property_services', input);
      }),
    configs: (occupancyId) =>
      db.getAllAsync<ServiceConfig>(
        'SELECT * FROM unit_service_configs WHERE occupancy_id=? ORDER BY effective_from DESC',
        occupancyId,
      ),
    saveConfig: (input) =>
      transaction(db, async (tx) => {
        requireDate(input.effective_from);
        if (input.effective_to) {
          requireDate(input.effective_to);
          if (input.effective_to < input.effective_from)
            throw new AppError('Revisa la fecha final de vigencia.');
        }
        natural(input.fixed_cents, 'El importe fijo');
        const o = await required<Occupancy>(tx, `${occupancySelect} WHERE o.id=?`, [
          input.occupancy_id,
        ]);
        const s = await required<Service>(tx, 'SELECT * FROM property_services WHERE id=?', [
          input.service_id,
        ]);
        if (o.property_id !== s.property_id)
          throw new AppError('La ocupación y el servicio pertenecen a inmuebles diferentes.');
        if (
          input.effective_from < o.start_date ||
          (o.end_date && input.effective_from > o.end_date)
        )
          throw new AppError('La configuración debe comenzar dentro de la ocupación.');
        if (input.mode === 'MEDIDOR' && !s.supports_meter)
          throw new AppError('Este servicio no admite medidores.');
        if (input.independent && (!s.allows_independent || input.mode !== 'FIJO'))
          throw new AppError(
            'Un cargo independiente debe ser fijo y estar habilitado en el servicio.',
          );
        if (
          await tx.getFirstAsync(
            'SELECT rp.id FROM receipt_participants rp JOIN master_receipts r ON r.id=rp.receipt_id WHERE rp.occupancy_id=? AND r.service_id=? AND r.confirmed_at IS NOT NULL AND r.period>=? LIMIT 1',
            o.id,
            s.id,
            input.effective_from.slice(0, 7),
          )
        )
          throw new AppError('Elige una vigencia posterior a los recibos ya confirmados.');
        if (
          await tx.getFirstAsync(
            'SELECT id FROM unit_service_configs WHERE occupancy_id=? AND service_id=? AND effective_from>=?',
            o.id,
            s.id,
            input.effective_from,
          )
        )
          throw new AppError('Ya hay una configuración desde esa fecha o una posterior.');
        await tx.runAsync(
          'UPDATE unit_service_configs SET effective_to=? WHERE occupancy_id=? AND service_id=? AND (effective_to IS NULL OR effective_to>=?)',
          previousDay(input.effective_from),
          o.id,
          s.id,
          input.effective_from,
        );
        const id = uuid();
        await tx.runAsync(
          'INSERT INTO unit_service_configs(id,occupancy_id,service_id,mode,fixed_cents,independent,effective_from,effective_to) VALUES(?,?,?,?,?,?,?,?)',
          id,
          o.id,
          s.id,
          input.mode,
          input.fixed_cents,
          input.independent,
          input.effective_from,
          input.effective_to,
        );
        await audit(tx, 'config', id, 'NUEVA_VIGENCIA');
        return id;
      }),
    meters: (propertyId) =>
      db.getAllAsync<Meter>(
        'SELECT m.* FROM meters m JOIN units u ON u.id=m.unit_id WHERE u.property_id=? ORDER BY m.installed_on DESC',
        propertyId,
      ),
    saveMeter: (input) =>
      transaction(db, async (tx) => {
        requireDate(input.installed_on);
        natural(input.initial_reading, 'La lectura inicial');
        const u = await required<Unit>(tx, 'SELECT * FROM units WHERE id=?', [input.unit_id]);
        const s = await required<Service>(tx, 'SELECT * FROM property_services WHERE id=?', [
          input.service_id,
        ]);
        if (u.property_id !== s.property_id || !s.supports_meter)
          throw new AppError('Selecciona un servicio medido del mismo inmueble.');
        if (input.id) {
          const old = await required<Meter>(tx, 'SELECT * FROM meters WHERE id=?', [input.id]);
          if (
            await tx.getFirstAsync(
              'SELECT id FROM meter_readings WHERE meter_id=? LIMIT 1',
              input.id,
            )
          ) {
            if (
              old.initial_reading !== input.initial_reading ||
              old.unit_id !== input.unit_id ||
              old.service_id !== input.service_id ||
              old.installed_on !== input.installed_on
            )
              throw new AppError(
                'Este medidor tiene lecturas confirmadas. Registra uno nuevo para reemplazarlo.',
              );
          }
          if (old.active && !input.active)
            await tx.runAsync('UPDATE meters SET retired_on=? WHERE id=?', today(), input.id);
        }
        if (
          input.active &&
          (await tx.getFirstAsync(
            'SELECT id FROM meters WHERE unit_id=? AND service_id=? AND active=1 AND id<>?',
            input.unit_id,
            input.service_id,
            input.id ?? '',
          ))
        )
          throw new AppError('Desactiva el medidor anterior antes de instalar uno nuevo.');
        return save(tx, 'meters', input);
      }),
  };
}
