import { LockGate } from '@/core/security/LockGate';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState, TextInput, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
let mockConfigured = false;
const mockVerify = jest.fn().mockResolvedValue(undefined);
let mockListener: (state: AppStateStatus) => void = () => undefined;
const mockRepo = { setting: jest.fn().mockResolvedValue('0') };
const mockUnmount = jest.fn();
jest.mock('@/core/AppProvider', () => ({ useApp: () => ({ repo: mockRepo, revision: 0 }) }));
jest.mock('@/core/security/lock', () => ({
  lockStatus: jest.fn(async () => ({ configured: mockConfigured, biometric: false })),
  verifyPin: (pin: string) => mockVerify(pin),
  biometricUnlock: jest.fn(),
}));
function FormInProgress() {
  const [value, setValue] = React.useState('');
  React.useEffect(
    () => () => {
      mockUnmount();
    },
    [],
  );
  return (
    <TextInput accessibilityLabel="Borrador en memoria" value={value} onChangeText={setValue} />
  );
}
test('segundo plano, retorno de cámara y bloqueo conservan el formulario montado y oculto', async () => {
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      mockListener = callback;
      return { remove: jest.fn() };
    });
  const screen = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <LockGate>
        <FormInProgress />
      </LockGate>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Borrador en memoria')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Borrador en memoria'), 'Lectura sin perder');
  await act(async () => mockListener('background'));
  expect(screen.queryByLabelText('Borrador en memoria')).toBeNull();
  await act(async () => mockListener('active'));
  await waitFor(() => expect(screen.getByDisplayValue('Lectura sin perder')).toBeTruthy());
  mockConfigured = true;
  await act(async () => mockListener('background'));
  await act(async () => mockListener('active'));
  await waitFor(() => expect(screen.getByLabelText('PIN')).toBeTruthy());
  expect(mockUnmount).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Borrador en memoria')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('PIN'), '123456');
  await fireEvent.press(screen.getByText('Desbloquear'));
  await waitFor(() => expect(screen.getByDisplayValue('Lectura sin perder')).toBeTruthy());
  expect(mockVerify).toHaveBeenCalledWith('123456');
  expect(mockUnmount).not.toHaveBeenCalled();
  await screen.unmount();
  listener.mockRestore();
});
