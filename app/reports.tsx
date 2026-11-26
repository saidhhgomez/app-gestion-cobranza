import { useApp } from '@/core/AppProvider';
import { errorMessage } from '@/core/errors/AppError';
import { exportPdf } from '@/features/reports/pdf';
import { PeriodSelector, PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
} from '@/shared/components/ui';
import { useQuery } from '@/shared/hooks/useQuery';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';
const reports = [
  ['monthly', 'Resumen mensual de cobranzas'],
  ['debts', 'Deudas pendientes'],
  ['payments', 'Pagos recibidos'],
  ['receipts', 'Facturas de servicios'],
  ['distribution', 'Reparto de servicios'],
  ['consumption', 'Historial de consumo'],
  ['account', 'Estado de cuenta por inquilino'],
  ['owner', 'Gastos del propietario'],
  ['occupancy', 'Resumen de ocupación'],
];
export default function Reports() {
  const { person } = useLocalSearchParams<{ person?: string }>();
  const { repo, propertyId, period, revision } = useApp();
  const [kind, setKind] = React.useState(person ? 'account' : 'monthly');
  const [selectedPerson, setSelectedPerson] = React.useState(person ?? '');
  const [busy, setBusy] = React.useState(false);
  const people = useQuery(() => repo.people(), [repo, revision]);
  const { data, loading, error, reload } = useQuery(
    () => repo.report(kind, propertyId || undefined, period, selectedPerson || undefined),
    [repo, kind, propertyId, period, selectedPerson, revision],
  );
  return (
    <Screen title="Reportes" subtitle="Revisa tu información y compártela en PDF.">
      <PropertySelector />
      <PeriodSelector />
      <SelectField
        label="Reporte"
        value={kind}
        onChange={setKind}
        options={reports.map(([value, label]) => ({ value: value!, label: label! }))}
      />
      {kind === 'account' && (
        <SelectField
          label="Persona responsable"
          value={selectedPerson}
          onChange={setSelectedPerson}
          options={[
            { label: 'Todas las personas', value: '' },
            ...(people.data ?? []).map((p) => ({
              label: `${p.first_name} ${p.last_name}`,
              value: p.id,
            })),
          ]}
        />
      )}
      <AppButton
        title="Generar y compartir PDF"
        loading={busy}
        disabled={loading || !!error}
        onPress={() => {
          setBusy(true);
          void Promise.all([repo.properties(), Promise.resolve(data ?? [])])
            .then(([properties, rows]) =>
              exportPdf(reports.find((r) => r[0] === kind)?.[1] ?? 'Reporte', rows, {
                period,
                property: properties.find((p) => p.id === propertyId)?.name,
              }),
            )
            .catch((e) => Alert.alert('No se pudo generar', errorMessage(e)))
            .finally(() => setBusy(false));
        }}
      />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data?.length === 0 && (
        <EmptyState
          title="Sin movimientos"
          description="Prueba otro periodo o registra operaciones en tus inmuebles."
        />
      )}
      {data?.map((row, i) => (
        <AppCard key={i}>
          {Object.entries(row).map(([label, value]) => (
            <Text key={label}>
              {label}: {value ?? '—'}
            </Text>
          ))}
        </AppCard>
      ))}
    </Screen>
  );
}
