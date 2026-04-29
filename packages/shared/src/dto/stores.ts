import { z } from 'zod';
import { MarkerColor, TaskStatus } from '../enums.js';

/**
 * The "task state" of a single column on a single store.
 * Per-map task names are dynamic (e.g. "Outside_Paint_Task",
 * "Lawn_Task") so we keep them as a free-form string.
 */
export const storeTaskSchema = z.object({
  name: z.string(),
  initialStatus: z.nativeEnum(TaskStatus),
  currentStatus: z.nativeEnum(TaskStatus),
});
export type StoreTask = z.infer<typeof storeTaskSchema>;

export const storeSchema = z.object({
  id: z.string().uuid(),
  mapId: z.string().uuid(),
  storeNumber: z.string(),
  storeName: z.string(),
  state: z.string().nullable(),
  address: z.string().nullable(),
  /** Always serialised as text — preserves leading zeros. */
  zip: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  type: z.string().nullable(),
  manager: z.string().nullable(),
  regional: z.string().nullable(),
  notes: z.string().nullable(),
  /** R2 key for property-view image; null if not uploaded. */
  propertyImageUrl: z.string().nullable(),
  tasks: z.array(storeTaskSchema),
  /** Counts entered on the most recent completion (0 if none yet). */
  counts: z.record(z.string(), z.number().int().min(0)),
  /** Computed marker colour based on tasks + completion state. */
  markerColor: z.nativeEnum(MarkerColor),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Store = z.infer<typeof storeSchema>;

export const updateStoreRequestSchema = z.object({
  storeName: z.string().min(1).max(100).optional(),
  state: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  zip: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  type: z.string().max(50).optional(),
  manager: z.string().max(100).optional(),
  regional: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export type UpdateStoreRequest = z.infer<typeof updateStoreRequestSchema>;

export const createStoreRequestSchema = updateStoreRequestSchema.extend({
  storeNumber: z.string().min(1),
  storeName: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type CreateStoreRequest = z.infer<typeof createStoreRequestSchema>;
