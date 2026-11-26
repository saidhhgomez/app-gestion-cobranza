import { useApp } from '@/core/AppProvider';
import type { Unit } from '@/core/contracts';
import { FormDialog, RecordForm, options, type Field } from '@/shared/components/RecordForm';
import { PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SearchBar,
  StatusBadge,
  confirm,
  styles,
} from '@/shared/components/ui';
import { useQuery } from '@/shared/hooks/useQuery';
import React from 'react';
import { Text } from 'react-native';
const fields: Field[] = [
  { name: 'code', label: 'Código o número', required: true },
  { name: 'name', label: 'Nombre descriptivo', required: true },
  { name: 'floor', label: 'Piso' },
  {
    name: 'kind',
    label: 'Tipo de unidad',
    defaultValue: 'Departamento',
    options: options(['Departamento', 'Habitación', 'Local', 'Casa', 'Otro']),
  },
  { name: 'description', label: 'Descripción', type: 'multiline' },
  { name: 'notes', label: 'Observaciones', type: 'multiline' },
];
export default function Units() {
  const { repo, propertyId, revision, refresh } = useApp();
  const [editing, setEditing] = React.useState<Unit | null | undefined>();
  const [search, setSearch] = React.useState('');
  const { data, loading, error, reload } = useQuery(
    () => (propertyId ? repo.units(propertyId) : Promise.resolve([])),
    [repo, propertyId, revision],
  );
  return (
    <Screen title="Departamentos y unidades">
      <PropertySelector allowAll={false} />
      <AppButton title="Registrar unidad" disabled={!propertyId} onPress={() => setEditing(null)} />
      <SearchBar value={search} onChangeText={setSearch} />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.length === 0 && (
        <EmptyState
          title={propertyId ? 'Sin unidades registradas' : 'Selecciona un inmueble'}
          description="Puedes registrar departamentos, habitaciones u otras unidades."
        />
      )}
      {data
        ?.filter((u) => `${u.code} ${u.name}`.toLowerCase().includes(search.toLowerCase()))
        .map((u) => (
          <AppCard key={u.id}>
            <Text style={styles.cardTitle}>
              {u.code} · {u.name}
            </Text>
            <Text>
              {u.kind} · Piso {u.floor || 'Sin especificar'}
            </Text>
            <StatusBadge
              label={
                !u.active
                  ? 'INACTIVO'
                  : u.occupancy_type === 'INQUILINO'
                    ? 'HABITADO POR INQUILINO'
                    : u.occupancy_type === 'PROPIETARIO'
                      ? 'HABITADO POR PROPIETARIO'
                      : 'DISPONIBLE'
              }
            />
            <Text>{u.person_name}</Text>
            <AppButton title="Editar unidad" variant="secondary" onPress={() => setEditing(u)} />
            <AppButton
              title={u.active ? 'Desactivar' : 'Reactivar'}
              variant="secondary"
              onPress={() =>
                confirm(
                  'Cambiar estado',
                  'Se conservarán las ocupaciones y deudas anteriores.',
                  async () => {
                    await repo.saveUnit({ ...u, active: u.active ? 0 : 1 });
                    refresh();
                  },
                )
              }
            />
          </AppCard>
        ))}
      {editing !== undefined && (
        <FormDialog
          title={editing ? 'Editar unidad' : 'Registrar unidad'}
          onClose={() => setEditing(undefined)}
        >
          <RecordForm
            fields={fields}
            initial={editing ?? {}}
            onSave={async (v) => {
              await repo.saveUnit({
                id: editing?.id,
                property_id: propertyId,
                code: v.code ?? '',
                name: v.name ?? '',
                floor: v.floor ?? '',
                kind: v.kind ?? 'Departamento',
                description: v.description ?? '',
                notes: v.notes ?? '',
                active: editing?.active ?? 1,
              });
              refresh();
              setEditing(undefined);
            }}
          />
        </FormDialog>
      )}
    </Screen>
  );
}
