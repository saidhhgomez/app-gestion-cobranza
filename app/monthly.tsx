import { useApp } from '@/core/AppProvider';
import { errorMessage } from '@/core/errors/AppError';
import { PeriodSelector, PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  CurrencyInput,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  confirm,
} from '@/shared/components/ui';
import { money, scaled, sumCents, unscale } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import React from 'react';
import { Alert, Text } from 'react-native';
export default function Monthly() {
  const { repo, propertyId, period, revision, refresh } = useApp();
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const { data, loading, error, reload } = useQuery(
    () => (propertyId ? repo.monthlyPreview(propertyId, period) : Promise.resolve([])),
    [repo, propertyId, period, revision],
  );
  const items = data ?? [];
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await repo.generateMonthly(
        propertyId,
        period,
        items.map((i) => ({
          ...i,
          amount_cents: scaled(amounts[i.key] ?? unscale(i.amount_cents)),
        })),
      );
      refresh();
      Alert.alert('Cobros generados', 'Puedes registrar los pagos desde Cobros.');
    } catch (e) {
      Alert.alert('Revisa los cobros', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Cobros del mes"
      subtitle="Revisa alquileres y servicios fijos independientes antes de confirmar."
    >
      <PropertySelector allowAll={false} />
      <PeriodSelector />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {items.length === 0 && (
        <EmptyState
          title="No hay nuevos cobros"
          description="Selecciona un inmueble con ocupaciones aplicables. Los cobros ya generados no se duplican."
        />
      )}
      {items.map((i) => (
        <AppCard key={i.key}>
          <Text>
            {i.unit_code} · {i.person_name}
          </Text>
          <Text>{i.concept}</Text>
          {i.kind === 'PROPIETARIO' && (
            <Text>Este importe se registra como gasto del propietario.</Text>
          )}
          {i.partial_period && (
            <Text>
              Ingreso, salida o cambio de condiciones dentro del mes: revisa y confirma el importe
              acordado. No se divide automáticamente por días.
            </Text>
          )}
          <CurrencyInput
            label="Importe acordado (S/)"
            value={amounts[i.key] ?? unscale(i.amount_cents)}
            onChangeText={(v) => setAmounts((a) => ({ ...a, [i.key]: v }))}
          />
        </AppCard>
      ))}
      <Text>Total inicial: {money(sumCents(items.map((i) => i.amount_cents)))}</Text>
      <AppButton
        title="Confirmar cobros del mes"
        disabled={!propertyId || !items.length}
        loading={busy}
        onPress={() =>
          confirm(
            'Generar cobros',
            'Los importes confirmados quedan en el historial. ¿Revisaste los casos de ingreso o salida durante el mes?',
            save,
          )
        }
      />
    </Screen>
  );
}
