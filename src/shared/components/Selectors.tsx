import { useApp } from '@/core/AppProvider';
import { periodRange } from '@/shared/formatting';
import { useQuery } from '@/shared/hooks/useQuery';
import React from 'react';
import { Alert, Text } from 'react-native';
import { AppButton, AppCard, AppInput, SelectField } from './ui';
export function PropertySelector({ allowAll = true }: { allowAll?: boolean }) {
  const { repo, propertyId, setPropertyId, revision } = useApp();
  const { data } = useQuery(() => repo.properties(), [repo, revision]);
  return (
    <SelectField
      label="Inmueble"
      value={propertyId}
      onChange={setPropertyId}
      options={[
        ...(allowAll ? [{ label: 'Todos mis inmuebles', value: '' }] : []),
        ...(data ?? [])
          .filter((p) => p.active || p.id === propertyId)
          .map((p) => ({ label: p.name, value: p.id })),
      ]}
    />
  );
}
export function PeriodSelector() {
  const { period, setPeriod } = useApp();
  const [draft, setDraft] = React.useState({ source: period, value: period });
  const value = draft.source === period ? draft.value : period;
  const setValue = (value: string) => setDraft({ source: period, value });
  return (
    <AppCard>
      <AppInput
        label="Periodo (AAAA-MM)"
        value={value}
        onChangeText={setValue}
        keyboardType="numbers-and-punctuation"
      />
      <AppButton
        title="Consultar periodo"
        variant="secondary"
        onPress={() => {
          try {
            periodRange(value);
            setPeriod(value);
          } catch {
            Alert.alert('Revisa el periodo', 'Utiliza año y mes, por ejemplo 2026-11.');
          }
        }}
      />
      <Text>Los reportes e indicadores corresponden al periodo seleccionado.</Text>
    </AppCard>
  );
}
