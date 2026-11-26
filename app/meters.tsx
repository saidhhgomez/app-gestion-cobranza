import { useApp } from '@/core/AppProvider';
import type { Meter } from '@/core/contracts';
import { FormDialog, RecordForm } from '@/shared/components/RecordForm';
import { PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  StatusBadge,
  confirm,
} from '@/shared/components/ui';
import { dateLabel, scaled, today, unscale } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import React from 'react';
import { Text } from 'react-native';
export default function Meters() {
  const { repo, propertyId, revision, refresh } = useApp();
  const [editing, setEditing] = React.useState<Meter | null | undefined>();
  const { data, loading, error, reload } = useQuery(
    async () => ({
      meters: propertyId ? await repo.meters(propertyId) : [],
      services: propertyId ? await repo.services(propertyId) : [],
      units: propertyId ? await repo.units(propertyId) : [],
    }),
    [repo, propertyId, revision],
  );
  return (
    <Screen title="Medidores" subtitle="Conserva el medidor anterior cuando instales un reemplazo.">
      <PropertySelector allowAll={false} />
      <AppButton title="Instalar medidor" disabled={!propertyId} onPress={() => setEditing(null)} />
      <Text>
        Registra las lecturas del periodo desde el asistente de recibos. Consulta el historial de
        consumo en Reportes.
      </Text>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.meters.length === 0 && (
        <EmptyState
          title="Sin medidores registrados"
          description="Instala un medidor solo para los servicios que utilizarán lecturas."
        />
      )}
      {data?.meters.map((m) => (
        <AppCard key={m.id}>
          <Text>
            {data.units.find((u) => u.id === m.unit_id)?.code} ·
            {data.services.find((s) => s.id === m.service_id)?.name}
          </Text>
          <Text>
            Serie {m.serial || 'Sin especificar'} · Instalado {dateLabel(m.installed_on)}
          </Text>
          <Text>Lectura inicial: {m.initial_reading / 1000}</Text>
          <StatusBadge label={m.active ? 'ACTIVO' : 'REEMPLAZADO / INACTIVO'} />
          <AppButton
            title="Editar datos del medidor"
            variant="secondary"
            onPress={() => setEditing(m)}
          />
          {!!m.active && (
            <AppButton
              title="Desactivar para reemplazar"
              variant="danger"
              onPress={() =>
                confirm(
                  'Reemplazar medidor',
                  'Se conservarán sus lecturas. Después registra el nuevo medidor con su lectura inicial real.',
                  async () => {
                    await repo.saveMeter({ ...m, active: 0 });
                    refresh();
                  },
                )
              }
            />
          )}
        </AppCard>
      ))}
      {editing !== undefined && (
        <FormDialog
          title={editing ? 'Editar medidor' : 'Instalar medidor'}
          onClose={() => setEditing(undefined)}
        >
          <RecordForm
            initial={
              editing ? { ...editing, initial_reading: unscale(editing.initial_reading, 3) } : {}
            }
            fields={[
              {
                name: 'unit_id',
                label: 'Unidad',
                required: true,
                options: (data?.units ?? []).map((u) => ({ label: u.code, value: u.id })),
              },
              {
                name: 'service_id',
                label: 'Servicio',
                required: true,
                options: (data?.services ?? [])
                  .filter((s) => s.supports_meter)
                  .map((s) => ({ label: s.name, value: s.id })),
              },
              { name: 'serial', label: 'Número de serie (opcional)' },
              {
                name: 'installed_on',
                label: 'Fecha de instalación',
                type: 'date',
                required: true,
                defaultValue: today(),
              },
              {
                name: 'initial_reading',
                label: 'Lectura inicial real (hasta 3 decimales)',
                type: 'number',
                required: true,
              },
              { name: 'notes', label: 'Observaciones', type: 'multiline' },
            ]}
            onSave={async (v) => {
              await repo.saveMeter({
                id: editing?.id,
                unit_id: v.unit_id ?? '',
                service_id: v.service_id ?? '',
                serial: v.serial ?? '',
                installed_on: v.installed_on ?? '',
                initial_reading: scaled(v.initial_reading ?? '', 3),
                active: editing?.active ?? 1,
                notes: v.notes ?? '',
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
