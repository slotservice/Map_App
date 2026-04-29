import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof uuidSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });

export const isoDateTime = z.string().datetime({ offset: true });

/**
 * E.164-ish phone — keep loose at the API boundary, normalise on input.
 * The legacy data has free-form phones like "317-000-0000" that need to
 * round-trip during migration.
 */
export const phoneSchema = z.string().max(50);
