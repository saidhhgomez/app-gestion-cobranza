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
import { money, sumCents } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
export default function Receipts() {
  const { repo, propertyId, period, revision } = useApp();
  const [status, setStatus] = React.useState('');
  const { data, loading, error, reload } = useQuery(
    () => repo.receipts(propertyId || undefined, period),
    [repo, propertyId, period, revision],
  );
  const filtered = data?.filter((r) => !status || r.status === status);
  return (
    <Screen title="Facturas del inmueble" subtitle="Registra el recibo y revisa cómo se reparte.">
      <PropertySelector />
      <PeriodSelector />
      <AppButton title="Registrar recibo" onPress={() => router.push('/receipt/new')} />
      <SelectField
        label="Estado"
        value={status}
        onChange={setStatus}
        options={[
          '',
          'BORRADOR',
          'PENDIENTE_LECTURAS',
          'LISTO_PARA_CONFIRMAR',
          'FINALIZADO',
          'ANULADO',
        ].map((s) => ({ label: s.replaceAll('_', ' ') || 'Todos', value: s }))}
      />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <AppCard>
          <Text>
            {data.length} recibos ·
            {money(sumCents(data.filter((r) => r.status !== 'ANULADO').map((r) => r.total_cents)))}
          </Text>
          <Text>
            {data.filter((r) => r.status === 'FINALIZADO').length} finalizados ·
            {data.filter((r) => !['FINALIZADO', 'ANULADO'].includes(r.status)).length} pendientes
          </Text>
        </AppCard>
      )}
      {filtered?.length === 0 && (
        <EmptyState
          title="Todavía no hay recibos"
          description="Registra la primera factura para repartirla entre los departamentos que participan."
        />
      )}
      {filtered?.map((r) => (
        <AppCard key={r.id}>
          <Text style={styles.cardTitle}>
            {r.service_name} · {r.period}
          </Text>
          <Text style={styles.amount}>{money(r.total_cents)}</Text>
          <StatusBadge label={r.status} />
          <AppButton
            title={r.status === 'FINALIZADO' ? 'Ver distribución' : 'Continuar recibo'}
            variant="secondary"
            onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
          />
        </AppCard>
      ))}
    </Screen>
  );
}
