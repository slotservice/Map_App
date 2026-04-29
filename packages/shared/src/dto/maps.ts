import { z } from 'zod';
import { UserRole } from '../enums.js';

export const mapSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  sourceFilename: z.string().nullable(),
  taskColumns: z.array(z.string()),
  countColumns: z.array(z.string()),
  tagAlertRecipients: z.array(z.string().email()),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  archivedAt: z.string().datetime({ offset: true }).nullable(),
});
export type Map = z.infer<typeof mapSchema>;

export const mapSummarySchema = mapSchema.extend({
  storeCount: z.number().int().min(0),
  completedStoreCount: z.number().int().min(0),
  assignedUserCount: z.number().int().min(0),
});
export type MapSummary = z.infer<typeof mapSummarySchema>;

export const createMapRequestSchema = z.object({
  name: z.string().min(1).max(100),
  /** Excel file is uploaded as multipart; the JSON body just carries the name. */
});
export type CreateMapRequest = z.infer<typeof createMapRequestSchema>;

export const updateMapRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  tagAlertRecipients: z.array(z.string().email().max(254)).max(50).optional(),
  archived: z.boolean().optional(),
});
export type UpdateMapRequest = z.infer<typeof updateMapRequestSchema>;

export const mapAssignmentSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum([UserRole.WORKER, UserRole.VENDOR, UserRole.VIEWER]),
});
export type MapAssignment = z.infer<typeof mapAssignmentSchema>;
