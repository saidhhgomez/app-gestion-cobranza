import { useApp } from '@/core/AppProvider';
import type { Criterion, Mode, Service } from '@/core/contracts';
import { FormDialog, options, RecordForm, type Field } from '@/shared/components/RecordForm';
import { PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
  styles,
} from '@/shared/components/ui';
import { dateLabel, money, scaled, today } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
const fields: Field[] = [
  { name: 'name', label: 'Nombre del servicio', required: true },
  { name: 'unit', label: 'Unidad de medida (kWh, m³ o vacío)' },
  {
    name: 'supports_meter',
    label: '¿Admite medidor?',
    defaultValue: '0',
    options: [
      { label: 'Sí', value: '1' },
      { label: 'No', value: '0' },
    ],
  },
  {
    name: 'uses_receipt',
    label: '¿Utiliza factura general?',
    defaultValue: '1',
    options: [
      { label: 'Sí', value: '1' },
      { label: 'No', value: '0' },
    ],
  },
  {
    name: 'allows_independent',
    label: '¿Permite cargos fijos independientes?',
    defaultValue: '1',
    options: [
      { label: 'Sí', value: '1' },
      { label: 'No', value: '0' },
    ],
  },
  {
    name: 'criterion',
    label: 'Criterio de prorrateo del inmueble',
    defaultValue: 'EQUITATIVO',
    options: [
      { label: 'Equitativo', value: 'EQUITATIVO' },
      { label: 'Por habitantes', value: 'POR_HABITANTES' },
    ],
  },
  {
    name: 'active',
    label: 'Estado del servicio',
    defaultValue: '1',
    options: [
      { label: 'Activo', value: '1' },
      { label: 'Inactivo', value: '0' },
    ],
  },
];
export default function Services() {
  const params = useLocalSearchParams<{ occupancy?: string }>();
  const { repo, propertyId, revision, refresh } = useApp();
  const [occupancy, setOccupancy] = React.useState(params.occupancy ?? '');
  const [editing, setEditing] = React.useState<Service | null | undefined>();
  const [config, setConfig] = React.useState<Service>();
  const { data, loading, error, reload } = useQuery(
    async () => ({
      services: propertyId ? await repo.services(propertyId) : [],
      occupancies: propertyId ? await repo.occupancies(propertyId) : [],
    }),
    [repo, propertyId, revision],
  );
  const configs = useQuery(
    () => (occupancy ? repo.configs(occupancy) : Promise.resolve([])),
    [repo, occupancy, revision],
  );
  return (
    <Screen title="Servicios" subtitle="Configura cómo participa cada ocupación.">
      <PropertySelector allowAll={false} />
      <AppButton
        title="Habilitar servicio"
        disabled={!propertyId}
        onPress={() => setEditing(null)}
      />
      <AppCard>
        <Text>
          Catálogo inicial: Luz, Agua, Internet, Mantenimiento, Limpieza y Otros. También puedes
          crear servicios personalizados.
        </Text>
      </AppCard>
      <SelectField
        label="Ocupación para revisar servicios"
        value={occupancy}
        onChange={setOccupancy}
        options={(data?.occupancies ?? []).map((o) => ({
          label: `${o.unit_code} · ${o.person_name}${o.end_date ? ' · Finalizada' : ''}`,
          value: o.id,
        }))}
      />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.services.length === 0 && (
        <EmptyState
          title="Todavía no hay servicios habilitados"
          description="Comienza con Luz o Agua, o crea el servicio que necesites."
        />
      )}
      {data?.services.map((s) => (
        <AppCard key={s.id}>
          <Text style={styles.cardTitle}>
            {s.name} {s.unit}
          </Text>
          <Text>
            {s.criterion === 'EQUITATIVO' ? 'Reparto equitativo' : 'Reparto por habitantes'} ·
            {s.active ? 'Activo' : 'Inactivo'}
          </Text>
          <AppButton
            title="Editar servicio del inmueble"
            variant="secondary"
            onPress={() => setEditing(s)}
          />
          {occupancy && (
            <AppButton title="Configurar participación con vigencia" onPress={() => setConfig(s)} />
          )}
          {configs.data
            ?.filter((c) => c.service_id === s.id)
            .map((c) => (
              <AppCard key={c.id}>
                <Text>
                  {c.mode} {c.mode === 'FIJO' ? money(c.fixed_cents) : ''} ·
                  {c.independent ? 'Independiente de la factura' : 'Vinculado a la factura'}
                </Text>
                <Text>
                  {dateLabel(c.effective_from)} —
                  {c.effective_to ? dateLabel(c.effective_to) : 'Sin fecha final'}
                </Text>
              </AppCard>
            ))}
        </AppCard>
      ))}
      {editing !== undefined && (
        <FormDialog
          title={editing ? 'Editar servicio' : 'Habilitar servicio'}
          onClose={() => setEditing(undefined)}
        >
          {!editing && (
            <SelectField
              label="Usar datos del catálogo"
              value=""
              onChange={(name) => {
                setEditing({
                  id: '',
                  property_id: propertyId,
                  name,
                  unit: name === 'Luz' ? 'kWh' : name === 'Agua' ? 'm³' : '',
                  supports_meter: ['Luz', 'Agua'].includes(name) ? 1 : 0,
                  uses_receipt: 1,
                  allows_independent: 1,
                  criterion: 'EQUITATIVO',
                  active: 1,
                });
              }}
              options={options(['Luz', 'Agua', 'Internet', 'Mantenimiento', 'Limpieza', 'Otros'])}
            />
          )}
          <RecordForm
            key={editing?.name ?? 'new'}
            fields={fields}
            initial={editing ?? {}}
            onSave={async (v) => {
              await repo.saveService({
                id: editing?.id || undefined,
                property_id: propertyId,
                name: v.name ?? '',
                unit: v.unit ?? '',
                supports_meter: Number(v.supports_meter),
                uses_receipt: Number(v.uses_receipt),
                allows_independent: Number(v.allows_independent),
                criterion: v.criterion as Criterion,
                active: Number(v.active ?? '1'),
              });
              refresh();
              setEditing(undefined);
            }}
          />
        </FormDialog>
      )}
      {config && (
        <FormDialog title={`Participación en ${config.name}`} onClose={() => setConfig(undefined)}>
          <Text>
            El propietario se configura con las mismas modalidades. Su participación será gasto
            propio. Los cambios futuros no alteran facturas confirmadas.
          </Text>
          <RecordForm
            fields={[
              {
                name: 'mode',
                label: 'Modalidad',
                defaultValue: 'NO_APLICA',
                options: options(['MEDIDOR', 'FIJO', 'PRORRATEO', 'NO_APLICA']),
              },
              {
                name: 'fixed',
                label: 'Importe fijo (S/)',
                type: 'money',
                defaultValue: '0.00',
                required: true,
              },
              {
                name: 'independent',
                label: 'Vinculación del importe fijo',
                defaultValue: '0',
                options: [
                  { label: 'Parte de la factura general', value: '0' },
                  { label: 'Cargo independiente (no descuenta la factura)', value: '1' },
                ],
              },
              {
                name: 'effective_from',
                label: 'Vigente desde',
                type: 'date',
                required: true,
                defaultValue: today(),
              },
              { name: 'effective_to', label: 'Vigente hasta (opcional)', type: 'date' },
            ]}
            onSave={async (v) => {
              await repo.saveConfig({
                occupancy_id: occupancy,
                service_id: config.id,
                mode: v.mode as Mode,
                fixed_cents: scaled(v.fixed ?? '0'),
                independent: Number(v.independent),
                effective_from: v.effective_from ?? '',
                effective_to: v.effective_to || null,
              });
              refresh();
              setConfig(undefined);
            }}
          />
        </FormDialog>
      )}
    </Screen>
  );
}
