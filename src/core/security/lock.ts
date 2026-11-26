import { brand } from '@/core/config/brand';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
const KEY = 'mi-inmueble.lock.v1';
const BIO_KEY = 'mi-inmueble.biometric.v1';
const ITERATIONS = 210000;
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
interface LockRecord {
  version: 1;
  salt: string;
  hash: string;
  failures: number;
  blockedUntil: number;
  biometric: boolean;
}
let pending: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>) {
  const next = pending.then(operation, operation);
  pending = next.catch(() => undefined);
  return next;
}
async function read(): Promise<LockRecord | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as LockRecord;
  if (
    value.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(value.salt) ||
    !/^[a-f0-9]{64}$/.test(value.hash) ||
    !Number.isSafeInteger(value.failures) ||
    value.failures < 0 ||
    !Number.isFinite(value.blockedUntil) ||
    typeof value.biometric !== 'boolean'
  )
    throw new Error('No se pudo leer la configuración de seguridad.');
  return value;
}
async function write(record: LockRecord) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(record), options);
}
const derive = async (pin: string, salt: string) =>
  bytesToHex(
    await pbkdf2Async(sha256, pin, hexToBytes(salt), { c: ITERATIONS, dkLen: 32, asyncTick: 10 }),
  );
function constantEquals(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function verify(pin: string): Promise<LockRecord> {
  const record = await read();
  if (!record) throw new Error('No hay un PIN configurado.');
  if (record.blockedUntil > Date.now())
    throw new Error(
      `Espera ${Math.ceil((record.blockedUntil - Date.now()) / 1000)} segundos antes de volver a intentar.`,
    );
  if (!/^\d{6,12}$/.test(pin) || !constantEquals(await derive(pin, record.salt), record.hash)) {
    const failures = record.failures + 1;
    await write({
      ...record,
      failures,
      blockedUntil:
        failures >= 5 ? Date.now() + Math.min(900000, 30000 * 2 ** Math.min(failures - 5, 5)) : 0,
    });
    throw new Error(
      failures >= 5 ? 'Demasiados intentos. Espera antes de volver a intentar.' : 'PIN incorrecto.',
    );
  }
  const clean = { ...record, failures: 0, blockedUntil: 0 };
  await write(clean);
  return clean;
}
export async function lockStatus() {
  const value = await read();
  return { configured: !!value, biometric: value?.biometric ?? false };
}
export function setPin(pin: string) {
  return serial(async () => {
    if (await read()) throw new Error('Desactiva el PIN actual antes de configurar otro.');
    if (!/^\d{6,12}$/.test(pin)) throw new Error('El PIN debe tener entre 6 y 12 dígitos.');
    const salt = bytesToHex(await Crypto.getRandomBytesAsync(32));
    await write({
      version: 1,
      salt,
      hash: await derive(pin, salt),
      failures: 0,
      blockedUntil: 0,
      biometric: false,
    });
  });
}
export function verifyPin(pin: string) {
  return serial(async () => {
    await verify(pin);
  });
}
export function removePin(pin: string) {
  return serial(async () => {
    await verify(pin);
    await SecureStore.deleteItemAsync(BIO_KEY);
    await SecureStore.deleteItemAsync(KEY);
  });
}
export function enableBiometrics(pin: string, enabled: boolean) {
  return serial(async () => {
    const r = await verify(pin);
    if (enabled) {
      if (
        !(await LocalAuthentication.hasHardwareAsync()) ||
        !(await LocalAuthentication.isEnrolledAsync())
      )
        throw new Error('El dispositivo no tiene biometría configurada.');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Activar biometría',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: true,
      });
      if (!result.success) throw new Error('No se confirmó la biometría.');
      await SecureStore.setItemAsync(BIO_KEY, bytesToHex(await Crypto.getRandomBytesAsync(32)), {
        ...options,
        requireAuthentication: true,
        authenticationPrompt: 'Activar biometría',
      });
    } else await SecureStore.deleteItemAsync(BIO_KEY);
    await write({ ...r, biometric: enabled });
  });
}
export function biometricUnlock() {
  return serial(async () => {
    const r = await read();
    if (!r?.biometric) throw new Error('Utiliza tu PIN para desbloquear.');
    const proof = await SecureStore.getItemAsync(BIO_KEY, {
      ...options,
      requireAuthentication: true,
      authenticationPrompt: `Desbloquear ${brand.name}`,
    });
    if (!proof) throw new Error('No se confirmó tu identidad. Usa el PIN.');
    await write({ ...r, failures: 0, blockedUntil: 0 });
  });
}
