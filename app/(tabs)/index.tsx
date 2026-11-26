import { useApp } from '@/core/AppProvider';
import { colors } from '@/core/theme/tokens';
import { PeriodSelector, PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  ErrorState,
  LoadingState,
  MoneySummary,
  Screen,
  styles,
} from '@/shared/components/ui';
import { dateLabel, money } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
export default function Dashboard() {
  const { repo, propertyId, period, revision, demo } = useApp();
  const [now] = React.useState(() => Date.now());
  const { data, loading, error, reload } = useQuery(
    async () => ({
      summary: await repo.dashboard(propertyId || undefined, period),
      name: await repo.setting('administrator_name'),
      backup: await repo.setting('last_backup'),
    }),
    [repo, propertyId, period, revision],
  );
  return (
    <Screen
      title={`Hola${data?.name ? `, ${data.name}` : ''}`}
      subtitle={demo ? 'Estás explorando datos de demostración.' : 'Vamos a cuidar tus inmuebles.'}
    >
      <PropertySelector />
      <PeriodSelector />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <MoneySummary label="Cuánto falta cobrar" value={money(data.summary.pending_cents)} />
          <View style={{ gap: 10 }}>
            <MoneySummary
              label="Pagos recibidos en el mes"
              value={money(data.summary.collected_cents)}
            />
            <MoneySummary
              label="Deudas vencidas del periodo"
              value={money(data.summary.overdue_cents)}
            />
          </View>
          <AppCard>
            <Text style={styles.cardTitle}>Tu cobranza del periodo</Text>
            <View
              accessibilityLabel="Progreso de cobranza"
              style={{
                height: 12,
                backgroundColor: colors.soft,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 12,
                  backgroundColor: colors.primary,
                  width: `${data.summary.charged_cents ? Math.min(100, ((data.summary.charged_cents - data.summary.pending_cents) / data.summary.charged_cents) * 100) : 0}%`,
                }}
              />
            </View>
            <Text>
              {money(data.summary.charged_cents)} en cobros · {data.summary.pending_receipts}
              recibos por finalizar
            </Text>
          </AppCard>
          <AppCard>
            <Text style={styles.cardTitle}>Tus departamentos</Text>
            <Text>
              {data.summary.occupied_units} habitados · {data.summary.available_units} disponibles
            </Text>
            <Text>Facturas de servicios: {money(data.summary.supplier_cents)}</Text>
            <Text>Gastos del propietario: {money(data.summary.owner_cents)}</Text>
          </AppCard>
          <AppButton
            title="Registrar factura del inmueble"
            onPress={() => router.push('/receipt/new')}
          />
          <AppButton
            title="Registrar pago recibido"
            onPress={() => router.push('/(tabs)/charges')}
          />
          <AppButton
            title="Generar cobros del mes"
            variant="secondary"
            onPress={() => router.push('/monthly')}
          />
          <AppButton
            title="Registrar inquilino"
            variant="secondary"
            onPress={() => router.push('/people')}
          />
          <AppButton
            title="Ver departamentos"
            variant="secondary"
            onPress={() => router.push('/units')}
          />
          {data.summary.upcoming.map((c) => (
            <AppCard key={c.id}>
              <Text style={styles.cardTitle}>
                {c.unit_code} · {c.person_name}
              </Text>
              <Text>
                {c.concept} · {money(c.balance_cents)}
              </Text>
              <Text>Vence el {dateLabel(c.due_on)}</Text>
            </AppCard>
          ))}
          {(!data.backup || now - Date.parse(data.backup) > 7 * 86400000) && (
            <AppCard>
              <Text>
                Cuida tu información: realiza una copia de seguridad semanal y guárdala fuera de
                este dispositivo.
              </Text>
              <AppButton
                title="Crear copia de seguridad"
                variant="secondary"
                onPress={() => router.push('/backup')}
              />
            </AppCard>
          )}
        </>
      )}
    </Screen>
  );
}
