import { useApp } from '@/core/AppProvider';
import { PeriodSelector, PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
  StatusBadge,
  styles,
} from '@/shared/components/ui';
import { dateLabel, money } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
export default function Charges() {
  const { repo, propertyId, period, revision } = useApp();
  const [filter, setFilter] = React.useState('');
  const { data, loading, error, reload } = useQuery(
    () => repo.charges(propertyId || undefined, period),
    [repo, propertyId, period, revision],
  );
  const filtered = data?.filter(
    (c) =>
      !filter ||
      (filter === 'DEUDA' ? c.balance_cents > 0 && c.status !== 'ANULADO' : c.status === filter),
  );
  return (
    <Screen title="Cobros y pagos" subtitle="Cada pago queda vinculado a su persona responsable.">
      <PropertySelector />
      <PeriodSelector />
      <AppButton title="Generar cobros del mes" onPress={() => router.push('/monthly')} />
      <AppButton
        title="Ver pagos recibidos"
        variant="secondary"
        onPress={() => router.push('/payments')}
      />
      <SelectField
        label="Mostrar"
        value={filter}
        onChange={setFilter}
        options={[
          { label: 'Todos', value: '' },
          { label: 'Deudas', value: 'DEUDA' },
          { label: 'Pagados', value: 'PAGADO' },
          { label: 'Vencidos', value: 'VENCIDO' },
        ]}
      />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {filtered?.length === 0 && (
        <EmptyState
          title="Sin cobros para este periodo"
          description="Genera los alquileres o finaliza una factura de servicios."
        />
      )}
      {filtered?.map((c) => (
        <AppCard key={c.id}>
          <Text style={styles.cardTitle}>
            {c.unit_code} · {c.person_name}
          </Text>
          <Text>
            {c.concept} · {c.period}
          </Text>
          <StatusBadge label={c.status} />
          <Text>
            Importe {money(c.amount_cents)} · Abonado {money(c.paid_cents)}
          </Text>
          <Text style={styles.amount}>Falta {money(c.balance_cents)}</Text>
          <Text>Vence {dateLabel(c.due_on)}</Text>
          {c.balance_cents > 0 && c.status !== 'ANULADO' && (
            <AppButton
              title="Registrar pago"
              onPress={() =>
                router.push({
                  pathname: '/payment',
                  params: { occupancy: c.occupancy_id, property: c.property_id },
                })
              }
            />
          )}
        </AppCard>
      ))}
    </Screen>
  );
}
