import { z } from 'zod';
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const newBidSchema = z.object({
  title: z.string().trim().min(3).max(180),
  reference: z.string().trim().min(3).max(100),
  buyer: z.string().trim().min(2).max(180),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
});
export const requirementSchema = z.object({
  clause: z.string().trim().min(8).max(3000),
  category: z.enum([
    'Eligibility',
    'Financial',
    'Technical',
    'Declarations',
    'Other',
  ]),
  source: z.string().trim().min(1).max(300),
  mandatory: z.boolean(),
});
export const reviewSchema = z.object({
  runId: z.string().uuid(),
  requirementId: z.string().uuid(),
  status: z.enum(['compliant', 'non_compliant', 'clarification']),
  note: z.string().trim().min(8).max(3000),
});
export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'Use application/json');
  const bytes = await readBody(request, 100_000);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
export async function readBody(request: Request, max: number) {
  if (Number(request.headers.get('content-length')) > max)
    throw new HttpError(413, 'Upload is too large');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, 'Upload is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return all;
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
