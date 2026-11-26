import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Onboarding from '../app/onboarding';
const mockSetting = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
jest.mock('@/core/AppProvider', () => ({
  useApp: () => ({ repo: { setSetting: mockSetting }, refresh: jest.fn() }),
}));
jest.mock('expo-router', () => ({ router: { replace: (value: string) => mockReplace(value) } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
test('tutorial de cuatro pantallas, nombre opcional y exploración sin inmueble', async () => {
  const screen = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <Onboarding />
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Organiza tus propiedades')).toBeTruthy();
  await fireEvent.press(screen.getByText('Siguiente'));
  expect(screen.getByText('Calcula tus recibos fácilmente')).toBeTruthy();
  await fireEvent.press(screen.getByText('Siguiente'));
  expect(screen.getByText('Controla tus cobros y pagos')).toBeTruthy();
  await fireEvent.press(screen.getByText('Siguiente'));
  expect(screen.getByText('Mantén tu información segura')).toBeTruthy();
  await fireEvent.press(screen.getByText('Comenzar'));
  await fireEvent.press(screen.getByText('Explorar la aplicación'));
  expect(mockSetting).toHaveBeenCalledWith('onboarding_complete', '1');
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
});
