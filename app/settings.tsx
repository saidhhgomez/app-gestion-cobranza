import { useApp } from '@/core/AppProvider';
import { brand } from '@/core/config/brand';
import { errorMessage } from '@/core/errors/AppError';
import { enableBiometrics, lockStatus, removePin, setPin } from '@/core/security/lock';
import { AppButton, AppCard, AppInput, Screen, SelectField, confirm } from '@/shared/components/ui';
import { useQuery } from '@/shared/hooks/useQuery';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Text } from 'react-native';
export default function Settings() {
  const { repo, revision, refresh, demo, switchDemo } = useApp();
  const [name, setName] = React.useState('');
  const [pin, setPinValue] = React.useState('');
  const [repeat, setRepeat] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const query = useQuery(
    async () => ({
      lock: await lockStatus(),
      name: await repo.setting('administrator_name').then((v) => {
        setName(v ?? '');
        return v;
      }),
      timeout: await repo.setting('lock_timeout'),
      largeText: await repo.setting('large_text'),
    }),
    [repo, revision],
  );
  const action = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
      setPinValue('');
      setRepeat('');
      refresh();
      Alert.alert('Cambios guardados');
    } catch (e) {
      Alert.alert('No se pudo guardar', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Configuración">
      <AppCard>
        <Text>
          {brand.name} · Versión {brand.version}
        </Text>
        <Text>Español · Soles (PEN) · America/Lima</Text>
        <Text>
          Preferencia visual: tema claro de alto contraste, adaptado al tamaño de letra del
          dispositivo.
        </Text>
      </AppCard>
      <SelectField
        label="Tamaño del texto en formularios"
        value={query.data?.largeText ?? '0'}
        onChange={(value) => {
          void action(() => repo.setSetting('large_text', value));
        }}
        options={[
          { label: 'Normal', value: '0' },
          { label: 'Ampliado', value: '1' },
        ]}
      />
      <AppInput label="Nombre de la persona administradora" value={name} onChangeText={setName} />
      <AppButton
        title="Guardar nombre"
        disabled={busy}
        onPress={() => {
          void action(() => repo.setSetting('administrator_name', name.trim()));
        }}
      />
      <AppCard>
        <Text>
          Bloqueo local {query.data?.lock.configured ? 'activado' : 'desactivado'}. El PIN protege
          el acceso a la aplicación. La base SQLite no está cifrada.
        </Text>
        <AppInput
          label={query.data?.lock.configured ? 'PIN actual' : 'Nuevo PIN (6 a 12 dígitos)'}
          value={pin}
          onChangeText={setPinValue}
          secureTextEntry
          keyboardType="number-pad"
        />
        {!query.data?.lock.configured && (
          <AppInput
            label="Repite el PIN"
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            keyboardType="number-pad"
          />
        )}
        {query.data?.lock.configured ? (
          <>
            <AppButton
              title="Desactivar PIN"
              variant="danger"
              disabled={busy}
              onPress={() =>
                confirm('Desactivar bloqueo', 'La aplicación podrá abrirse sin PIN.', () =>
                  action(() => removePin(pin)),
                )
              }
            />
            <AppButton
              title={query.data.lock.biometric ? 'Desactivar biometría' : 'Activar biometría'}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                void action(() => enableBiometrics(pin, !query.data!.lock.biometric));
              }}
            />
          </>
        ) : (
          <AppButton
            title="Activar bloqueo con PIN"
            disabled={busy}
            onPress={() => {
              void action(async () => {
                if (pin !== repeat) throw new Error('Los PIN no coinciden.');
                await setPin(pin);
              });
            }}
          />
        )}
        <SelectField
          label="Bloquear al volver después de"
          value={query.data?.timeout ?? '60'}
          onChange={(v) => {
            void action(() => repo.setSetting('lock_timeout', v));
          }}
          options={[
            { label: 'Inmediatamente', value: '0' },
            { label: '1 minuto', value: '60' },
            { label: '5 minutos', value: '300' },
          ]}
        />
        <Text>
          No olvides tu PIN. No existe recuperación remota. La biometría depende de la configuración
          del dispositivo; Face ID requiere una compilación propia en iOS.
        </Text>
      </AppCard>
      <AppButton
        title="Volver a consultar el tutorial"
        variant="secondary"
        onPress={() => router.push('/onboarding')}
      />
      <AppButton
        title="Copias de seguridad"
        variant="secondary"
        onPress={() => router.push('/backup')}
      />
      <AppButton
        title="Ayuda y privacidad"
        variant="secondary"
        onPress={() => router.push('/help')}
      />
      <AppButton
        title={demo ? 'Salir de demostración' : 'Explorar con datos de demostración'}
        variant="secondary"
        loading={busy}
        onPress={() =>
          confirm(
            demo ? 'Volver a mis datos' : 'Abrir demostración',
            'Los datos de demostración se guardan en una base separada. Tu información real se conserva.',
            () =>
              action(async () => {
                await switchDemo(!demo);
                router.replace('/(tabs)');
              }),
          )
        }
      />
    </Screen>
  );
}
