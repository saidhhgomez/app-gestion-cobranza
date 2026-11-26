import { assertBase64, decodeEnvelope, safeAttachmentName } from '@/features/backup/validation';
const hash = 'a'.repeat(64);
const example = () => ({
  payload: {
    format: 'mi-inmueble-backup',
    version: 1,
    schemaVersion: 1,
    appVersion: '1.0.0',
    createdAt: '2026-11-25T12:00:00.000Z',
    mode: 'real',
    database: { size: 3, hash, base64: 'YWJj' },
    files: [],
  },
  hash,
});
test('formato portable válido', () => {
  expect(decodeEnvelope(JSON.stringify(example())).payload.mode).toBe('real');
  assertBase64('YWJj', 3);
});
test.each([
  '../a.pdf',
  '/a.pdf',
  'C:\\a.pdf',
  'https://example.com/a.pdf',
  'a.pdf',
  '00000000-0000-0000-0000-000000000000.exe',
])('rechaza rutas peligrosas %s', (path) => expect(safeAttachmentName.test(path)).toBe(false));
test('rechaza corrupción, versión, campos y duplicados', () => {
  expect(() => decodeEnvelope('{')).toThrow();
  expect(() => decodeEnvelope(JSON.stringify({ ...example(), surprise: true }))).toThrow();
  const value = example();
  value.payload.version = 2;
  expect(() => decodeEnvelope(JSON.stringify(value))).toThrow();
  expect(() => assertBase64('!!!!', 3)).toThrow();
  expect(() => assertBase64('YWJj', 2)).toThrow();
});
