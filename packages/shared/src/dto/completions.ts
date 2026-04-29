import { z } from 'zod';

export const completionSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  completedBy: z.string().uuid(),
  completedByName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  signatureUrl: z.string().url().nullable(),
  generalComments: z.string(),
  counts: z.record(z.string(), z.number().int().min(0)),
  completedAt: z.string().datetime({ offset: true }),
  deviceTimezone: z.string(),
  beforePhotoIds: z.array(z.string().uuid()),
  afterPhotoIds: z.array(z.string().uuid()),
});
export type Completion = z.infer<typeof completionSchema>;

export const completeStoreRequestSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  /** Photo id of the signature image, already uploaded via presign. */
  signaturePhotoId: z.string().uuid(),
  generalComments: z.string().max(4000).default(''),
  /** Per-count-column values. Server validates against `maps.countColumns`. */
  counts: z.record(z.string(), z.number().int().min(0)),
  /** Worker's local IANA tz, e.g. "America/Indiana/Indianapolis". */
  deviceTimezone: z.string().min(1).max(64),
  /** ISO instant the worker pressed Complete (client clock; server stores UTC). */
  completedAt: z.string().datetime({ offset: true }),
  /** Photo ids already uploaded; server links them to this completion. */
  beforePhotoIds: z.array(z.string().uuid()).max(50),
  afterPhotoIds: z.array(z.string().uuid()).max(50),
});
export type CompleteStoreRequest = z.infer<typeof completeStoreRequestSchema>;
