import { useApp } from '@/core/AppProvider';
import type { Person } from '@/core/contracts';
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
import { dateLabel, money } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
const fields: Field[] = [
  { name: 'first_name', label: 'Nombres', required: true },
  { name: 'last_name', label: 'Apellidos', required: true },
  {
    name: 'document_type',
    label: 'Tipo de documento',
    defaultValue: 'DNI',
    options: options(['DNI', 'CE', 'Pasaporte', 'Otro']),
  },
  {
    name: 'document_number',
    label: 'Número de documento (opcional)',
    validate: (v, values) =>
      v && values.document_type === 'DNI' && !/^\d{8}$/.test(v)
        ? 'El DNI debe tener ocho dígitos.'
        : undefined,
  },
  { name: 'phone', label: 'Teléfono', type: 'phone' },
  { name: 'email', label: 'Correo electrónico (opcional)', type: 'email' },
  { name: 'notes', label: 'Observaciones', type: 'multiline' },
];
export default function People() {
  const { repo, revision, refresh } = useApp();
  const [editing, setEditing] = React.useState<Person | null | undefined>();
  const [selected, setSelected] = React.useState<Person>();
  const [search, setSearch] = React.useState('');
  const { data, loading, error, reload } = useQuery(
    () => repo.people(search),
    [repo, revision, search],
  );
  return (
    <Screen title="Inquilinos y propietarios">
      <AppButton title="Registrar persona" onPress={() => setEditing(null)} />
      <SearchBar value={search} onChangeText={setSearch} />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.length === 0 && (
        <EmptyState
          title="Sin personas registradas"
          description="Puedes registrar una persona aunque todavía no tenga un documento a mano."
        />
      )}
      {data?.map((p) => (
        <AppCard key={p.id}>
          <Text style={styles.cardTitle}>
            {p.first_name} {p.last_name}
          </Text>
          <Text>
            {p.document_type} {p.document_number || 'Sin documento'} · {p.phone}
          </Text>
          <StatusBadge label={p.active ? 'ACTIVO' : 'ARCHIVADO'} />
          <AppButton
            title="Ocupaciones, pagos y deudas"
            variant="secondary"
            onPress={() => setSelected(p)}
          />
          <AppButton
            title="Estado de cuenta PDF"
            variant="secondary"
            onPress={() => router.push({ pathname: '/reports', params: { person: p.id } })}
          />
          <AppButton title="Editar persona" variant="secondary" onPress={() => setEditing(p)} />
          <AppButton
            title={p.active ? 'Archivar persona' : 'Reactivar persona'}
            variant="secondary"
            onPress={() =>
              confirm(
                'Cambiar estado de la persona',
                'El historial financiero se conserva.',
                async () => {
                  await repo.savePerson({ ...p, active: p.active ? 0 : 1 });
                  refresh();
                },
              )
            }
          />
        </AppCard>
      ))}
      {editing !== undefined && (
        <FormDialog
          title={editing ? 'Editar persona' : 'Registrar persona'}
          onClose={() => setEditing(undefined)}
        >
          <RecordForm
            fields={fields}
            initial={editing ?? {}}
            onSave={async (v) => {
              const save = async () => {
                await repo.savePerson({
                  id: editing?.id,
                  first_name: v.first_name ?? '',
                  last_name: v.last_name ?? '',
                  document_type: v.document_type ?? 'DNI',
                  document_number: v.document_number ?? '',
                  phone: v.phone ?? '',
                  email: v.email ?? '',
                  notes: v.notes ?? '',
                  active: editing?.active ?? 1,
                });
                refresh();
                setEditing(undefined);
              };
              const possible = (await repo.people()).find(
                (p) =>
                  p.id !== editing?.id &&
                  `${p.first_name} ${p.last_name}`.trim().toLowerCase() ===
                    `${v.first_name} ${v.last_name}`.trim().toLowerCase(),
              );
              if (possible && !v.document_number) {
                confirm(
                  'Posible persona duplicada',
                  'Ya existe una persona con el mismo nombre. Confirma si deseas registrar otra.',
                  save,
                );
              } else await save();
            }}
          />
        </FormDialog>
      )}
      {selected && (
        <FormDialog
          title={`Historial de ${selected.first_name}`}
          onClose={() => setSelected(undefined)}
        >
          <PersonHistory id={selected.id} />
        </FormDialog>
      )}
    </Screen>
  );
}
function PersonHistory({ id }: { id: string }) {
  const { repo } = useApp();
  const { data, loading, error, reload } = useQuery(
    async () => ({
      occupancies: await repo.occupancies(undefined, id),
      charges: await repo.charges(undefined, undefined, id),
      payments: await repo.payments(undefined, id),
    }),
    [repo, id],
  );
  return (
    <>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.occupancies.map((o) => (
        <AppCard key={o.id}>
          <Text>
            {o.unit_code} · {dateLabel(o.start_date)} —
            {o.end_date ? dateLabel(o.end_date) : 'Vigente'}
          </Text>
        </AppCard>
      ))}
      {data?.charges.map((c) => (
        <AppCard key={c.id}>
          <Text>
            {c.period} · {c.concept} · {c.status}
          </Text>
          <Text>Saldo {money(c.balance_cents)}</Text>
        </AppCard>
      ))}
      {data?.payments.map((p) => (
        <AppCard key={p.id}>
          <Text>
            {dateLabel(p.paid_on)} · {money(p.amount_cents)} · {p.reversed ? 'Anulado' : p.method}
          </Text>
        </AppCard>
      ))}
    </>
  );
}
