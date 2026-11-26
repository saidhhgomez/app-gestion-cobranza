import { useApp } from '@/core/AppProvider';
import { brand } from '@/core/config/brand';
import { errorMessage } from '@/core/errors/AppError';
import { AppButton, AppInput, ErrorState, LoadingState, Screen } from '@/shared/components/ui';
import React from 'react';
import { AppState, View } from 'react-native';
import { biometricUnlock, lockStatus, verifyPin } from './lock';
export function LockGate({ children }: { children: React.ReactNode }) {
  const { repo, revision } = useApp();
  const [ready, setReady] = React.useState(false);
  const [locked, setLocked] = React.useState(true);
  const [hidden, setHidden] = React.useState(false);
  const [bio, setBio] = React.useState(false);
  const [pin, setPinValue] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const background = React.useRef<number | null>(null);
  const timeout = React.useRef(60);
  const authenticating = React.useRef(false);
  React.useEffect(() => {
    void lockStatus()
      .then((s) => {
        setLocked(s.configured);
        setBio(s.biometric);
        setReady(true);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setReady(true);
      });
  }, []);
  React.useEffect(() => {
    void repo
      .setting('lock_timeout')
      .then((v) => {
        timeout.current = Number(v ?? 60);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [repo, revision]);
  React.useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (authenticating.current) return;
      if (state !== 'active') {
        background.current ??= Date.now();
        setHidden(true);
      } else {
        const elapsed = background.current === null ? 0 : Date.now() - background.current;
        background.current = null;
        void lockStatus()
          .then((s) => {
            setBio(s.biometric);
            if (s.configured && elapsed >= timeout.current * 1000) setLocked(true);
            setHidden(false);
          })
          .catch((e) => {
            setLocked(true);
            setError(errorMessage(e));
            setHidden(false);
          });
      }
    });
    return () => listener.remove();
  }, []);
  const unlock = async (biometric: boolean) => {
    if (busy) return;
    authenticating.current = true;
    setBusy(true);
    setError('');
    try {
      if (biometric) await biometricUnlock();
      else await verifyPin(pin);
      setPinValue('');
      setLocked(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  };
  if (!ready) return <LoadingState />;
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7F6' }}>
      <View
        style={{ flex: 1, display: locked || hidden ? 'none' : 'flex' }}
        pointerEvents={locked || hidden ? 'none' : 'auto'}
        accessibilityElementsHidden={locked || hidden}
        importantForAccessibility={locked || hidden ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {!hidden && locked && (
        <Screen
          title="Tu información está protegida"
          subtitle={`Ingresa tu PIN para abrir ${brand.name}.`}
        >
          <AppInput
            label="PIN"
            value={pin}
            onChangeText={setPinValue}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={12}
          />
          {!!error && <ErrorState message={error} />}
          <AppButton
            title="Desbloquear"
            loading={busy}
            onPress={() => {
              void unlock(false);
            }}
          />
          {bio && (
            <AppButton
              title="Usar biometría"
              disabled={busy}
              variant="secondary"
              onPress={() => {
                void unlock(true);
              }}
            />
          )}
        </Screen>
      )}
    </View>
  );
}
