import { z } from 'zod';

export const tagAlertSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  mapId: z.string().uuid(),
  raisedBy: z.string().uuid(),
  raisedByName: z.string(),
  title: z.string(),
  description: z.string(),
  raisedAt: z.string().datetime({ offset: true }),
  emailStatus: z.enum(['pending', 'sent', 'failed']),
  emailSentAt: z.string().datetime({ offset: true }).nullable(),
  photoIds: z.array(z.string().uuid()),
});
export type TagAlert = z.infer<typeof tagAlertSchema>;

export const createTagAlertRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  photoIds: z.array(z.string().uuid()).max(8),
});
export type CreateTagAlertRequest = z.infer<typeof createTagAlertRequestSchema>;
