import { z } from 'zod';
export const receiptDraftSchema = z.object({
  input: z.object({
    id: z.string().optional(),
    property_id: z.string(),
    service_id: z.string(),
    period: z.string(),
    provider: z.string(),
    supply_number: z.string(),
    receipt_number: z.string(),
    total_cents: z.number(),
    total_consumption: z.number().nullable(),
    issued_on: z.string(),
    due_on: z.string(),
    consumption_start: z.string().nullable(),
    consumption_end: z.string().nullable(),
    notes: z.string(),
  }),
  amount: z.string(),
  consumption: z.string(),
  step: z.number().int().min(1).max(5),
  readings: z.record(z.string(), z.object({ previous: z.string(), current: z.string() })),
  participants: z.array(
    z.object({ id: z.string(), inhabitants: z.number(), excluded_reason: z.string().nullable() }),
  ),
});
export function parseReceiptDraft(raw: string | null) {
  if (!raw) return null;
  const result = receiptDraftSchema.safeParse(JSON.parse(raw) as unknown);
  if (!result.success)
    throw new Error('El borrador temporal no pudo recuperarse. Tus datos guardados se conservan.');
  return result.data;
}
