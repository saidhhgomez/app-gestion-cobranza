import { useApp } from '@/core/AppProvider';
import { brand } from '@/core/config/brand';
import { errorMessage } from '@/core/errors/AppError';
import { colors } from '@/core/theme/tokens';
import {
  AppButton,
  AppCard,
  AppInput,
  Screen,
  StepIndicator,
  styles,
} from '@/shared/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Text, View } from 'react-native';
const slides = [
  {
    icon: 'home-outline',
    title: 'Organiza tus propiedades',
    description: 'Reúne tus inmuebles, departamentos e inquilinos en un solo lugar.',
  },
  {
    icon: 'calculator-outline',
    title: 'Calcula tus recibos fácilmente',
    description:
      'Registra las lecturas y reparte los servicios con importes claros para cada departamento.',
  },
  {
    icon: 'wallet-outline',
    title: 'Controla tus cobros y pagos',
    description:
      'Consulta cuánto te han pagado y cuánto falta cobrar, incluso cuando recibas abonos parciales.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Mantén tu información segura',
    description:
      'Tus datos se guardan en este dispositivo. Activa un PIN y crea copias de seguridad para cuidarlos.',
  },
] as const;
export default function Onboarding() {
  const { repo, refresh } = useApp();
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const finish = async (property: boolean) => {
    setBusy(true);
    try {
      await repo.setSetting('administrator_name', name.trim());
      await repo.setSetting('onboarding_complete', '1');
      refresh();
      router.replace(property ? '/properties' : '/(tabs)');
    } catch (e) {
      Alert.alert('No se pudo guardar', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const slide = slides[step];
  return (
    <Screen title={brand.name} subtitle="Tu gestión, más tranquila.">
      {slide ? (
        <>
          <StepIndicator current={step + 1} total={4} />
          <AppCard>
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 25 }}>
              <Ionicons name={slide.icon} size={100} color={colors.primary} />
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.description}</Text>
            </View>
          </AppCard>
          <AppButton
            title={step === 3 ? 'Comenzar' : 'Siguiente'}
            onPress={() => setStep((v) => v + 1)}
          />
          {step > 0 && (
            <AppButton title="Atrás" variant="secondary" onPress={() => setStep((v) => v - 1)} />
          )}
          <AppButton title="Omitir tutorial" variant="secondary" onPress={() => setStep(4)} />
        </>
      ) : (
        <>
          <Text style={styles.cardTitle}>¿Cómo te llamas?</Text>
          <AppInput
            label="Nombre de la persona administradora (opcional)"
            value={name}
            onChangeText={setName}
          />
          <AppButton
            title="Registrar mi primer inmueble"
            loading={busy}
            onPress={() => {
              void finish(true);
            }}
          />
          <AppButton
            title="Explorar la aplicación"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              void finish(false);
            }}
          />
        </>
      )}
    </Screen>
  );
}
