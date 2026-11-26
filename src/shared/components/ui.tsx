import { useVisualPreferences } from '@/core/theme/Preferences';
import { colors } from '@/core/theme/tokens';
import { dateLabel, validDate } from '@/shared/formatting';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === 'secondary' && s.secondary,
        variant === 'danger' && s.danger,
        (disabled || loading || pressed) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : 'white'} />
      ) : (
        <Text style={[s.buttonText, variant === 'secondary' && { color: colors.primary }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export interface InputProps extends Omit<TextInputProps, 'onChange'> {
  label: string;
  error?: string;
}
export function AppInput({ label, error, ...props }: InputProps) {
  const { largeText } = useVisualPreferences();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          largeText && { fontSize: 22 },
          props.multiline && { minHeight: 100, textAlignVertical: 'top' },
          props.style,
          error && { borderColor: colors.danger },
        ]}
      />
      {error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function CurrencyInput(props: InputProps) {
  return <AppInput keyboardType="decimal-pad" {...props} />;
}
export function DecimalInput(props: InputProps) {
  return <AppInput keyboardType="decimal-pad" {...props} />;
}
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const text = validDate(value) ? dateLabel(value) : value;
  return (
    <AppInput
      label={`${label} (DD/MM/AAAA)`}
      value={text}
      placeholder="25/11/2026"
      keyboardType="numbers-and-punctuation"
      onChangeText={(v) => {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
        onChange(m ? `${m[3]}-${m[2]}-${m[1]}` : v);
      }}
    />
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.choices}>
        {options.map((o) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: o.value === value }}
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.choice, o.value === value && s.selected]}
          >
            <Text
              style={{
                color: o.value === value ? colors.primary : colors.text,
                fontWeight: o.value === value ? '700' : '400',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {options.length === 0 && <Text style={s.subtitle}>Todavía no hay opciones disponibles.</Text>}
    </View>
  );
}
export function AppCard({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}
export function StatusBadge({ label }: { label: string }) {
  return (
    <View style={s.badge}>
      <Text style={{ color: colors.primary, fontWeight: '600' }}>{label.replaceAll('_', ' ')}</Text>
    </View>
  );
}
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <AppCard>
      <Text style={s.cardTitle}>{title}</Text>
      {description && <Text style={s.subtitle}>{description}</Text>}
    </AppCard>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <AppCard>
      <Text accessibilityRole="alert" style={s.error}>
        {message}
      </Text>
      {onRetry && <AppButton title="Volver a intentar" onPress={onRetry} />}
    </AppCard>
  );
}
export function LoadingState() {
  return (
    <ActivityIndicator
      accessibilityLabel="Cargando información"
      size="large"
      color={colors.primary}
      style={{ padding: 30 }}
    />
  );
}
export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <Text accessibilityLabel={`Paso ${current} de ${total}`} style={s.subtitle}>
      Paso {current} de {total}
      {Array.from({ length: total }, (_, i) => (i < current ? '●' : '○')).join(' ')}
    </Text>
  );
}
export function SearchBar({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <AppInput
      label="Buscar"
      value={value}
      onChangeText={onChangeText}
      placeholder="Escribe para buscar"
    />
  );
}
export function MoneySummary({ label, value }: { label: string; value: string }) {
  return (
    <AppCard>
      <Text style={s.subtitle}>{label}</Text>
      <Text style={s.amount}>{value}</Text>
    </AppCard>
  );
}
export function confirm(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
): void {
  Alert.alert(title, message, [
    { text: 'Volver', style: 'cancel' },
    {
      text: 'Confirmar',
      onPress: () => {
        void Promise.resolve()
          .then(onConfirm)
          .catch((e) =>
            Alert.alert(
              'No se pudo completar',
              e instanceof Error ? e.message : 'Inténtalo nuevamente.',
            ),
          );
      },
    },
  ]);
}
export const ConfirmDialog = confirm;
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 16, color: colors.muted, lineHeight: 24 },
  card: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 19, fontWeight: '600', color: colors.text },
  amount: { fontSize: 28, fontWeight: '700', color: colors.primary },
  button: {
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  secondary: { backgroundColor: colors.soft },
  danger: { backgroundColor: colors.danger },
  buttonText: { fontSize: 16, fontWeight: '700', color: 'white' },
  field: { gap: 7 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 13,
    fontSize: 17,
    color: colors.text,
    backgroundColor: 'white',
  },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  selected: { backgroundColor: colors.soft, borderColor: colors.primary },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.soft,
  },
});

const s = styles;
