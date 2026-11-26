import { useApp } from '@/core/AppProvider';
import { errorMessage } from '@/core/errors/AppError';
import { pickPaymentAttachment, shareAttachment } from '@/core/storage/attachments';
import { exportPdf } from '@/features/reports/pdf';
import { PropertySelector } from '@/shared/components/Selectors';
import {
  AppButton,
  AppCard,
  AppInput,
  confirm,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  StatusBadge,
} from '@/shared/components/ui';
import { dateLabel, money } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import React from 'react';
import { Alert, Text } from 'react-native';
export default function Payments() {
  const { repo, propertyId, revision, refresh } = useApp();
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const { data, loading, error, reload } = useQuery(
    () => repo.payments(propertyId || undefined),
    [repo, propertyId, revision],
  );
  const reverse = async (id: string) => {
    if (!reason.trim()) {
      Alert.alert('Motivo necesario', 'Explica por qué se anula el pago.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await repo.reversePayment(id, reason);
      refresh();
    } catch (e) {
      Alert.alert('No se pudo anular', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Pagos recibidos">
      <PropertySelector />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!data?.length && !loading && (
        <EmptyState
          title="Todavía no hay pagos"
          description="Registra un abono desde el cobro de cada inquilino."
        />
      )}
      <AppInput
        label="Motivo si necesitas anular un pago"
        value={reason}
        onChangeText={setReason}
      />
      {data?.map((p) => (
        <AppCard key={p.id}>
          <Text>
            {p.unit_code} · {p.person_name}
          </Text>
          <Text>
            {money(p.amount_cents)} · {p.method} · {dateLabel(p.paid_on)}
          </Text>
          <Text>Operación: {p.operation_number || 'Sin número'}</Text>
          <StatusBadge label={p.reversed ? 'ANULADO' : 'RECIBIDO'} />
          <PaymentEvidence id={p.id} />
          <AppButton
            title="Compartir constancia PDF"
            variant="secondary"
            onPress={() => {
              void Promise.all([repo.paymentDetails(p.id), repo.properties()])
                .then(([rows, properties]) =>
                  exportPdf('Constancia de pago', rows, {
                    period: p.paid_on.slice(0, 7),
                    property: properties.find((property) => property.id === p.property_id)?.name,
                  }),
                )
                .catch((e) => Alert.alert('No se pudo generar', errorMessage(e)));
            }}
          />
          {!p.reversed && (
            <AppButton
              title="Anular pago"
              variant="danger"
              disabled={busy}
              onPress={() =>
                confirm(
                  'Anular pago',
                  'El pago se conservará en el historial y sus saldos se restablecerán.',
                  () => reverse(p.id),
                )
              }
            />
          )}
        </AppCard>
      ))}
    </Screen>
  );
}
function PaymentEvidence({ id }: { id: string }) {
  const { repo, demo, revision, refresh } = useApp();
  const [busy, setBusy] = React.useState(false);
  const { data } = useQuery(() => repo.paymentAttachments(id), [repo, id, revision]);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      refresh();
    } catch (e) {
      Alert.alert('No se pudo completar', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppButton
        title="Adjuntar evidencia del pago (opcional)"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          void run(() => pickPaymentAttachment(repo, id, demo));
        }}
      />
      {data?.map((a) => (
        <AppButton
          key={a.id}
          title={`Compartir evidencia: ${a.name}`}
          variant="secondary"
          disabled={busy}
          onPress={() => {
            void run(() => shareAttachment(a, demo));
          }}
        />
      ))}
    </>
  );
}
