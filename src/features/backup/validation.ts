import { z } from 'zod';
export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
export const safeAttachmentName =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|jpeg|png|webp|heic|pdf)$/i;
const binary = z
  .object({
    size: z.number().int().min(0).max(MAX_BACKUP_BYTES),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    base64: z.string().max(MAX_BACKUP_BYTES * 1.4),
  })
  .strict();
export const payloadSchema = z
  .object({
    format: z.literal('mi-inmueble-backup'),
    version: z.literal(1),
    schemaVersion: z.literal(1),
    appVersion: z.string(),
    createdAt: z.iso.datetime(),
    mode: z.enum(['real', 'demo']),
    database: binary,
    files: z
      .array(binary.extend({ path: z.string().regex(safeAttachmentName) }).strict())
      .max(20000),
  })
  .strict()
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    let total = v.database.size;
    for (const f of v.files) {
      if (seen.has(f.path.toLowerCase()))
        ctx.addIssue({ code: 'custom', message: 'Archivo duplicado.' });
      seen.add(f.path.toLowerCase());
      total += f.size;
    }
    if (total > MAX_BACKUP_BYTES)
      ctx.addIssue({ code: 'custom', message: 'El respaldo supera 80 MB.' });
  });
export const envelopeSchema = z
  .object({ payload: payloadSchema, hash: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export type Payload = z.infer<typeof payloadSchema>;
export function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('El respaldo contiene un valor no compatible.');
}
export function decodeEnvelope(text: string) {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('El respaldo supera 80 MB.');
  const result = envelopeSchema.safeParse(JSON.parse(text) as unknown);
  if (!result.success)
    throw new Error(
      'El archivo no tiene un formato de respaldo válido o su versión no es compatible.',
    );
  return result.data;
}
export function assertBase64(value: string, size: number) {
  const padding = size % 3 === 0 ? 0 : 3 - (size % 3);
  let invalid = value.length !== 4 * Math.ceil(size / 3);
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (i >= value.length - padding) {
      if (c !== 61) invalid = true;
    } else if (!(
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      (c >= 48 && c <= 57) ||
      c === 43 ||
      c === 47
    ))
      invalid = true;
  }
  if (invalid) throw new Error('El contenido de un archivo está dañado.');
}
