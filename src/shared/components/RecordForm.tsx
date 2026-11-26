import { errorMessage } from '@/core/errors/AppError';
import { validDate } from '@/shared/formatting';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { AppButton, AppInput, DateField, SelectField, styles } from './ui';
export interface Field {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  type?: 'date' | 'money' | 'number' | 'email' | 'phone' | 'multiline';
  options?: { label: string; value: string }[];
  validate?: (value: string, values: Record<string, string>) => string | undefined;
}
export function RecordForm({
  fields,
  initial = {},
  onSave,
  onDirty,
}: {
  fields: Field[];
  initial?: object;
  onSave: (values: Record<string, string>) => Promise<void>;
  onDirty?: (dirty: boolean) => void;
}) {
  const schema = z.record(z.string(), z.string()).superRefine((values, ctx) => {
    for (const f of fields) {
      const v = (values[f.name] ?? '').trim();
      let error = f.required && !v ? 'Este campo es obligatorio.' : undefined;
      if (v && f.type === 'email' && !z.email().safeParse(v).success)
        error = 'Ingresa un correo válido.';
      if (v && f.type === 'date' && !validDate(v)) error = 'Ingresa una fecha válida.';
      if (v && (f.type === 'money' || f.type === 'number') && !/^\d+(?:[.,]\d{1,3})?$/.test(v))
        error = 'Ingresa un número mayor o igual a cero.';
      error ??= f.validate?.(v, values);
      if (error) ctx.addIssue({ code: 'custom', path: [f.name], message: error });
    }
  });
  const { control, handleSubmit, formState } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.name,
        String(new Map(Object.entries(initial)).get(f.name) ?? f.defaultValue ?? ''),
      ]),
    ),
  });
  const [error, setError] = React.useState('');
  React.useEffect(() => onDirty?.(formState.isDirty), [formState.isDirty, onDirty]);
  const save = handleSubmit(async (v) => {
    setError('');
    try {
      await onSave(v);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <View style={{ gap: 14 }}>
      {fields.map((f) => (
        <Controller
          key={f.name}
          control={control}
          name={f.name}
          render={({ field, fieldState }) => (
            <View style={{ gap: 5 }}>
              {f.options ? (
                <SelectField
                  label={f.label}
                  value={field.value}
                  onChange={field.onChange}
                  options={f.options}
                />
              ) : f.type === 'date' ? (
                <DateField label={f.label} value={field.value} onChange={field.onChange} />
              ) : (
                <AppInput
                  label={f.label}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  multiline={f.type === 'multiline'}
                  keyboardType={
                    f.type === 'money' || f.type === 'number'
                      ? 'decimal-pad'
                      : f.type === 'email'
                        ? 'email-address'
                        : f.type === 'phone'
                          ? 'phone-pad'
                          : 'default'
                  }
                />
              )}
              {(f.options || f.type === 'date') && fieldState.error && (
                <Text style={styles.error}>{fieldState.error.message}</Text>
              )}
            </View>
          )}
        />
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <AppButton
        title="Guardar"
        onPress={() => {
          void save();
        }}
        loading={formState.isSubmitting}
      />
    </View>
  );
}
export function FormDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() =>
        Alert.alert('Cerrar formulario', 'Si hay cambios sin guardar, se descartarán.', [
          { text: 'Seguir editando', style: 'cancel' },
          { text: 'Descartar y cerrar', style: 'destructive', onPress: onClose },
        ])
      }
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        >
          <Text style={styles.title}>{title}</Text>
          {children}
          <AppButton
            title="Cerrar formulario"
            variant="secondary"
            onPress={() =>
              Alert.alert('Cerrar formulario', 'Si hay cambios sin guardar, se descartarán.', [
                { text: 'Seguir editando', style: 'cancel' },
                { text: 'Descartar y cerrar', style: 'destructive', onPress: onClose },
              ])
            }
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
export const options = (labels: string[]) => labels.map((value) => ({ label: value, value }));
