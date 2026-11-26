import { useApp } from '@/core/AppProvider';
import type { Property } from '@/core/contracts';
import { FormDialog, RecordForm, options, type Field } from '@/shared/components/RecordForm';
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
import { money } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import React from 'react';
import { Text } from 'react-native';
export const propertyFields: Field[] = [
  { name: 'name', label: 'Nombre del inmueble', required: true },
  { name: 'address', label: 'Dirección', required: true },
  { name: 'district', label: 'Distrito', required: true },
  { name: 'province', label: 'Provincia', required: true },
  { name: 'region', label: 'Departamento o región', required: true },
  {
    name: 'kind',
    label: 'Tipo de inmueble',
    defaultValue: 'Edificio',
    options: options(['Edificio', 'Casa', 'Quinta', 'Condominio', 'Otro']),
  },
  { name: 'description', label: 'Descripción (opcional)', type: 'multiline' },
];
export default function Properties() {
  const { repo, refresh, revision, setPropertyId } = useApp();
  const [editing, setEditing] = React.useState<Property | null | undefined>();
  const [search, setSearch] = React.useState('');
  const { data, loading, error, reload } = useQuery(() => repo.properties(), [repo, revision]);
  return (
    <Screen title="Mis inmuebles">
      <AppButton title="Registrar inmueble" onPress={() => setEditing(null)} />
      <SearchBar value={search} onChangeText={setSearch} />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.length === 0 && (
        <EmptyState
          title="Tu primer inmueble"
          description="Registra la propiedad que administras para comenzar."
        />
      )}
      {data
        ?.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(search.toLowerCase()))
        .map((p) => (
          <AppCard key={p.id}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Text>
              {p.address} · {p.district}
            </Text>
            <StatusBadge label={p.active ? 'ACTIVO' : 'ARCHIVADO'} />
            <PropertySummary id={p.id} />
            <AppButton
              title="Seleccionar este inmueble"
              disabled={!p.active}
              onPress={() => setPropertyId(p.id)}
            />
            <AppButton title="Editar inmueble" variant="secondary" onPress={() => setEditing(p)} />
            <AppButton
              title={p.active ? 'Archivar' : 'Reactivar'}
              variant="secondary"
              onPress={() =>
                confirm(
                  'Cambiar estado del inmueble',
                  'El historial se conservará. No se puede archivar si tiene ocupaciones vigentes u operaciones pendientes.',
                  async () => {
                    await repo.archiveProperty(p.id, !p.active);
                    refresh();
                  },
                )
              }
            />
          </AppCard>
        ))}
      {editing !== undefined && (
        <FormDialog
          title={editing ? 'Editar inmueble' : 'Registrar inmueble'}
          onClose={() => setEditing(undefined)}
        >
          <RecordForm
            fields={propertyFields}
            initial={editing ?? {}}
            onSave={async (v) => {
              const id = await repo.saveProperty({
                id: editing?.id,
                name: v.name ?? '',
                address: v.address ?? '',
                district: v.district ?? '',
                province: v.province ?? '',
                region: v.region ?? '',
                kind: v.kind ?? 'Edificio',
                description: v.description ?? '',
                active: editing?.active ?? 1,
              });
              setPropertyId(id);
              refresh();
              setEditing(undefined);
            }}
          />
        </FormDialog>
      )}
    </Screen>
  );
}
function PropertySummary({ id }: { id: string }) {
  const { repo, period, revision } = useApp();
  const { data } = useQuery(() => repo.dashboard(id, period), [repo, id, period, revision]);
  return data ? (
    <Text>
      {data.occupied_units + data.available_units} unidades · {data.occupied_units} habitadas ·
      {data.available_units} disponibles. Pendiente {money(data.pending_cents)} · Cobrado del mes{' '}
      {money(data.collected_cents)}
    </Text>
  ) : null;
}
