import { useApp } from '@/core/AppProvider';
import { errorMessage } from '@/core/errors/AppError';
import {
  AppButton,
  AppCard,
  AppInput,
  CurrencyInput,
  DateField,
  ErrorState,
  LoadingState,
  Screen,
  SelectField,
  confirm,
} from '@/shared/components/ui';
import { money, scaled, sumCents, today, unscale } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';
export default function PaymentForm() {
  const { occupancy, property } = useLocalSearchParams<{ occupancy: string; property: string }>();
  const { repo, refresh } = useApp();
  const [id] = React.useState(() => Crypto.randomUUID());
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState(today());
  const [method, setMethod] = React.useState('Efectivo');
  const [operation, setOperation] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [assignments, setAssignments] = React.useState<Record<string, string>>({});
  const { data, loading, error, reload } = useQuery(async () => {
    const rows = await repo.charges(property);
    return rows
      .filter((c) => c.occupancy_id === occupancy && c.balance_cents > 0 && c.status !== 'ANULADO')
      .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id.localeCompare(b.id));
  }, [repo, occupancy, property]);
  const suggest = () => {
    try {
      let remaining = scaled(amount);
      const result: Record<string, string> = {};
      for (const c of data ?? []) {
        const part = Math.min(remaining, c.balance_cents);
        result[c.id] = unscale(part);
        remaining -= part;
      }
      if (remaining > 0) throw new Error('El pago supera la deuda seleccionada.');
      setAssignments(result);
    } catch (e) {
      Alert.alert('Revisa el importe', errorMessage(e));
    }
  };
  const save = async () => {
    const first = data?.[0];
    if (!first || busy) return;
    setBusy(true);
    try {
      const allocations = (data ?? [])
        .map((c) => ({ charge_id: c.id, amount_cents: scaled(assignments[c.id] || '0') }))
        .filter((a) => a.amount_cents > 0);
      await repo.recordPayment({
        id,
        property_id: property,
        occupancy_id: occupancy,
        person_id: first.person_id,
        paid_on: date,
        amount_cents: scaled(amount),
        method,
        operation_number: operation,
        notes,
        allocations,
      });
      refresh();
      Alert.alert('Pago recibido', 'El abono y los saldos quedaron guardados.');
      router.back();
    } catch (e) {
      Alert.alert('Revisa el pago', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Pago recibido"
      subtitle="Distribuye el pago y revisa los saldos antes de confirmar."
    >
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      <Text>
        {data?.[0]?.person_name} · Departamento {data?.[0]?.unit_code}
      </Text>
      <Text>Deuda total: {money(sumCents((data ?? []).map((c) => c.balance_cents)))}</Text>
      <CurrencyInput label="Pago recibido (S/)" value={amount} onChangeText={setAmount} />
      <DateField label="Fecha de pago" value={date} onChange={setDate} />
      <SelectField
        label="Método de pago"
        value={method}
        onChange={setMethod}
        options={['Efectivo', 'Yape', 'Plin', 'Transferencia bancaria', 'Otro'].map((v) => ({
          label: v,
          value: v,
        }))}
      />
      <AppInput
        label="Número de operación (opcional)"
        value={operation}
        onChangeText={setOperation}
      />
      <AppInput label="Observaciones" value={notes} onChangeText={setNotes} />
      <AppButton
        title="Sugerir reparto: deuda más antigua primero"
        variant="secondary"
        onPress={suggest}
      />
      {data?.map((c) => (
        <AppCard key={c.id}>
          <Text>
            {c.concept} · {c.period} · Saldo {money(c.balance_cents)}
          </Text>
          <CurrencyInput
            label="Aplicar a este cobro (S/)"
            value={assignments[c.id] ?? '0.00'}
            onChangeText={(v) => setAssignments((a) => ({ ...a, [c.id]: v }))}
          />
        </AppCard>
      ))}
      <AppButton
        title="Confirmar pago recibido"
        loading={busy}
        disabled={!data?.length}
        onPress={() =>
          confirm(
            'Registrar pago',
            'Confirma que recibiste este dinero y que la distribución es correcta.',
            save,
          )
        }
      />
    </Screen>
  );
}
