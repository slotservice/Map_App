import { z } from 'zod';
import { PhotoKind } from '../enums.js';

export const photoSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  completionId: z.string().uuid().nullable(),
  kind: z.nativeEnum(PhotoKind),
  fieldName: z.string().nullable(),
  /** Short-lived signed URL the client can render directly. */
  url: z.string().url(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.string().datetime({ offset: true }),
});
export type Photo = z.infer<typeof photoSchema>;

/** Request for a presigned upload. Server replies with `presignedUploadResponseSchema`. */
export const presignUploadRequestSchema = z.object({
  kind: z.nativeEnum(PhotoKind),
  fieldName: z.string().max(100).optional(),
  contentType: z
    .string()
    .regex(/^image\/(png|jpeg|jpg|webp|heic)$/i, 'Unsupported image type'),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024, 'Photo too large (max 20MB)'),
});
export type PresignUploadRequest = z.infer<typeof presignUploadRequestSchema>;

export const presignUploadResponseSchema = z.object({
  photoId: z.string().uuid(),
  uploadUrl: z.string().url(),
  /** Headers the client must echo back on the PUT to make the signature valid. */
  headers: z.record(z.string(), z.string()),
  /** Seconds until the upload URL expires. */
  expiresIn: z.number().int().positive(),
});
export type PresignUploadResponse = z.infer<typeof presignUploadResponseSchema>;

export const finalizePhotoRequestSchema = z.object({
  /** SHA-256 hex of the bytes the client uploaded; server verifies. */
  sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid SHA-256'),
});
export type FinalizePhotoRequest = z.infer<typeof finalizePhotoRequestSchema>;
