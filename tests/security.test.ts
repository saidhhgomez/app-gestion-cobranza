import { lockStatus, removePin, setPin, verifyPin } from '@/core/security/lock';
import { nativeCrypto } from './support/nativeAdapters';
const mockSecrets = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device',
  getItemAsync: jest.fn(async (key: string) => mockSecrets.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecrets.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecrets.delete(key);
  }),
}));
jest.mock('expo-crypto', () => require('./support/nativeAdapters').nativeCrypto);
jest.mock('expo-local-authentication', () => ({}));
test('PIN derivado, verificación y límite persistente de intentos', async () => {
  void nativeCrypto;
  mockSecrets.clear();
  expect((await lockStatus()).configured).toBe(false);
  await setPin('123456');
  const serialized = [...mockSecrets.values()].join('');
  expect(serialized).not.toContain('123456');
  await verifyPin('123456');
  for (let i = 0; i < 5; i++) await expect(verifyPin('000000')).rejects.toThrow();
  await expect(verifyPin('123456')).rejects.toThrow(/Espera/);
  const time = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000000);
  await verifyPin('123456');
  await removePin('123456');
  time.mockRestore();
  expect((await lockStatus()).configured).toBe(false);
}, 30000);
