import { useApp } from '@/core/AppProvider';
import type { Occupancy } from '@/core/contracts';
import { errorMessage } from '@/core/errors/AppError';
import { FormDialog, RecordForm } from '@/shared/components/RecordForm';
import { PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  AppInput,
  CurrencyInput,
  DateField,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
  StatusBadge,
  StepIndicator,
  confirm,
} from '@/shared/components/ui';
import { dateLabel, money, scaled, today, unscale, validDate } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';
export default function Occupancies() {
  const { repo, propertyId, revision, refresh } = useApp();
  const [wizard, setWizard] = React.useState(false);
  const [ending, setEnding] = React.useState<Occupancy>();
  const [terms, setTerms] = React.useState<Occupancy>();
  const [resident, setResident] = React.useState<Occupancy>();
  const [residentId, setResidentId] = React.useState('');
  const { data, loading, error, reload } = useQuery(
    async () => ({
      occupancies: await repo.occupancies(propertyId || undefined),
      people: await repo.people(),
    }),
    [repo, propertyId, revision],
  );
  return (
    <Screen title="Ocupaciones y alquileres">
      <PropertySelector allowAll={false} />
      <AppButton
        title="Registrar ocupación"
        disabled={!propertyId}
        onPress={() => setWizard(true)}
      />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.occupancies.length === 0 && (
        <EmptyState
          title="Sin ocupaciones"
          description="Registra quién habita cada departamento. Los disponibles no participan en cobros nuevos."
        />
      )}
      {data?.occupancies
        .filter((o) => o.property_id === propertyId)
        .map((o) => (
          <AppCard key={o.id}>
            <Text>
              {o.unit_code} · {o.person_name}
            </Text>
            <Text>
              {o.kind} · {o.inhabitants} habitantes · Alquiler inicial {money(o.rent_cents)}
            </Text>
            <Text>
              Ingreso {dateLabel(o.start_date)} · Salida
              {o.end_date ? dateLabel(o.end_date) : 'Sin fecha'}
            </Text>
            <StatusBadge label={o.end_date ? 'FINALIZADA' : 'VIGENTE'} />
            <AppButton
              title="Revisar servicios de esta ocupación"
              variant="secondary"
              onPress={() => router.push({ pathname: '/services', params: { occupancy: o.id } })}
            />
            {!o.end_date && (
              <>
                <AppButton
                  title="Cambiar alquiler o habitantes con vigencia"
                  variant="secondary"
                  onPress={() => setTerms(o)}
                />
                <AppButton
                  title="Agregar habitante identificado (opcional)"
                  variant="secondary"
                  onPress={() => setResident(o)}
                />
                <AppButton
                  title="Finalizar ocupación"
                  variant="danger"
                  onPress={() => setEnding(o)}
                />
              </>
            )}
          </AppCard>
        ))}
      {wizard && (
        <FormDialog title="Registrar ocupación" onClose={() => setWizard(false)}>
          <OccupancyWizard onDone={() => setWizard(false)} />
        </FormDialog>
      )}
      {ending && (
        <FormDialog title="Finalizar ocupación" onClose={() => setEnding(undefined)}>
          <Text>
            Las deudas y pagos se conservan a nombre de la misma persona. No se generan nuevos
            cobros en meses posteriores a la salida.
          </Text>
          <RecordForm
            fields={[
              {
                name: 'date',
                label: 'Fecha de salida',
                type: 'date',
                required: true,
                defaultValue: today(),
              },
            ]}
            onSave={async (v) => {
              await repo.endOccupancy(ending.id, v.date ?? '');
              refresh();
              setEnding(undefined);
            }}
          />
        </FormDialog>
      )}
      {terms && (
        <FormDialog title="Nuevas condiciones" onClose={() => setTerms(undefined)}>
          <Text>
            Los cambios solo afectan periodos futuros. Los cobros confirmados conservan sus
            importes.
          </Text>
          <RecordForm
            fields={[
              {
                name: 'from',
                label: 'Vigente desde',
                type: 'date',
                required: true,
                defaultValue: today(),
              },
              {
                name: 'rent',
                label: 'Alquiler mensual (S/)',
                type: 'money',
                required: true,
                defaultValue: unscale(terms.rent_cents),
              },
              {
                name: 'inhabitants',
                label: 'Habitantes',
                type: 'number',
                required: true,
                defaultValue: String(terms.inhabitants),
              },
              {
                name: 'due',
                label: 'Día de vencimiento',
                type: 'number',
                required: true,
                defaultValue: String(terms.due_day),
              },
            ]}
            onSave={async (v) => {
              await repo.changeTerms(
                terms.id,
                v.from ?? '',
                scaled(v.rent ?? ''),
                Number(v.inhabitants),
                Number(v.due),
              );
              refresh();
              setTerms(undefined);
            }}
          />
        </FormDialog>
      )}
      {resident && (
        <FormDialog title="Habitantes adicionales" onClose={() => setResident(undefined)}>
          <Text>
            No es obligatorio identificar a todos. La cantidad de habitantes para el reparto se
            configura por separado.
          </Text>
          <SelectField
            label="Persona"
            value={residentId}
            onChange={setResidentId}
            options={(data?.people ?? [])
              .filter((p) => p.id !== resident.person_id)
              .map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id }))}
          />
          <AppButton
            title="Agregar habitante"
            disabled={!residentId}
            onPress={() => {
              void repo
                .addResident(resident.id, residentId)
                .then(() => {
                  refresh();
                  setResident(undefined);
                })
                .catch((e) => Alert.alert('No se pudo agregar', errorMessage(e)));
            }}
          />
          <ResidentList id={resident.id} />
        </FormDialog>
      )}
    </Screen>
  );
}
function ResidentList({ id }: { id: string }) {
  const { repo } = useApp();
  const { data } = useQuery(() => repo.residents(id), [repo, id]);
  return (
    <>
      {data?.map((p) => (
        <Text key={p.id}>
          {p.first_name} {p.last_name}
        </Text>
      ))}
    </>
  );
}
function OccupancyWizard({ onDone }: { onDone: () => void }) {
  const { repo, propertyId, refresh } = useApp();
  const [step, setStep] = React.useState(1);
  const [unit, setUnit] = React.useState('');
  const [person, setPerson] = React.useState('');
  const [start, setStart] = React.useState(today());
  const [inhabitants, setInhabitants] = React.useState('1');
  const [kind, setKind] = React.useState('INQUILINO');
  const [rent, setRent] = React.useState('0.00');
  const [due, setDue] = React.useState('5');
  const [busy, setBusy] = React.useState(false);
  const { data } = useQuery(
    async () => ({
      units: await repo.units(propertyId),
      people: await repo.people(),
      services: await repo.services(propertyId),
    }),
    [repo, propertyId],
  );
  const next = () => {
    try {
      if (step === 1 && !unit) throw new Error('Selecciona una unidad.');
      if (step === 2 && !person) throw new Error('Selecciona una persona.');
      if (step === 3 && !validDate(start)) throw new Error('Revisa la fecha de ingreso.');
      if (step === 4 && (!Number.isSafeInteger(Number(inhabitants)) || Number(inhabitants) < 1))
        throw new Error('Indica al menos un habitante.');
      if (step === 5) {
        scaled(rent);
        if (Number(due) < 1 || Number(due) > 31 || !Number.isInteger(Number(due)))
          throw new Error('Indica un día entre 1 y 31.');
      }
      setStep((s) => s + 1);
    } catch (e) {
      Alert.alert('Revisa los datos', errorMessage(e));
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const id = await repo.saveOccupancy({
        unit_id: unit,
        person_id: person,
        kind: kind as 'INQUILINO' | 'PROPIETARIO',
        start_date: start,
        end_date: null,
        inhabitants: Number(inhabitants),
        rent_cents: kind === 'PROPIETARIO' ? 0 : scaled(rent),
        due_day: Number(due),
        notes: '',
      });
      refresh();
      onDone();
      router.push({ pathname: '/services', params: { occupancy: id } });
    } catch (e) {
      Alert.alert('No se pudo registrar', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <StepIndicator current={step} total={7} />
      {step === 1 && (
        <SelectField
          label="Departamento"
          value={unit}
          onChange={setUnit}
          options={(data?.units ?? [])
            .filter((u) => u.active)
            .map((u) => ({
              label: `${u.code} · ${u.occupancy_type ? 'Revisar fechas de ocupación' : 'Disponible'}`,
              value: u.id,
            }))}
        />
      )}
      {step === 2 && (
        <>
          <SelectField
            label="Persona responsable"
            value={person}
            onChange={setPerson}
            options={(data?.people ?? [])
              .filter((p) => p.active)
              .map((p) => ({ label: `${p.first_name} ${p.last_name}`, value: p.id }))}
          />
          <AppButton
            title="Registrar otra persona"
            variant="secondary"
            onPress={() => router.push('/people')}
          />
          <SelectField
            label="Tipo de ocupación"
            value={kind}
            onChange={setKind}
            options={[
              { label: 'Inquilino', value: 'INQUILINO' },
              { label: 'Propietario', value: 'PROPIETARIO' },
            ]}
          />
        </>
      )}
      {step === 3 && <DateField label="Fecha de ingreso" value={start} onChange={setStart} />}
      {step === 4 && (
        <AppInput
          label="Cantidad de habitantes"
          value={inhabitants}
          onChangeText={setInhabitants}
          keyboardType="number-pad"
        />
      )}
      {step === 5 && (
        <>
          <CurrencyInput
            label="Alquiler mensual acordado (S/)"
            value={kind === 'PROPIETARIO' ? '0.00' : rent}
            onChangeText={setRent}
            editable={kind !== 'PROPIETARIO'}
          />
          <AppInput
            label="Día de vencimiento"
            value={due}
            onChangeText={setDue}
            keyboardType="number-pad"
          />
        </>
      )}
      {step === 6 && (
        <AppCard>
          <Text>
            Al confirmar revisarás los servicios de esta nueva ocupación. Las configuraciones
            anteriores no se activan automáticamente.
          </Text>
          <Text>
            {data?.services.map((s) => s.name).join(' · ') ||
              'Puedes habilitar servicios después de registrar la ocupación.'}
          </Text>
          <Text>
            El propietario puede participar por medidor, fijo o prorrateo; su importe se registra
            como gasto propio.
          </Text>
        </AppCard>
      )}
      {step === 7 && (
        <AppCard>
          <Text>Unidad: {data?.units.find((u) => u.id === unit)?.code}</Text>
          <Text>Persona: {data?.people.find((p) => p.id === person)?.first_name}</Text>
          <Text>
            Ingreso: {dateLabel(start)} · {inhabitants} habitantes
          </Text>
          <Text>
            Alquiler: {money(kind === 'PROPIETARIO' ? 0 : scaled(rent))} · Día {due}
          </Text>
          {start.slice(-2) !== '01' && (
            <Text>
              Ingreso a mitad del mes: revisa manualmente el alquiler y los participantes en los
              asistentes mensuales. No se divide automáticamente por días.
            </Text>
          )}
        </AppCard>
      )}
      {step < 7 ? (
        <AppButton title="Siguiente" onPress={next} />
      ) : (
        <AppButton
          title="Confirmar ocupación y revisar servicios"
          loading={busy}
          onPress={() =>
            confirm(
              'Registrar ocupación',
              'Confirma los datos y revisa después los servicios que corresponden.',
              save,
            )
          }
        />
      )}
      {step > 1 && (
        <AppButton title="Atrás" variant="secondary" onPress={() => setStep((s) => s - 1)} />
      )}
    </>
  );
}
