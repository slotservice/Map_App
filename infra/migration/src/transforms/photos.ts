import type { Migrator } from '../types.js';

/**
 * Migrate legacy photos (`public_html/public/photos/*` etc.) → R2 +
 * `photos` rows.
 *
 * Algorithm:
 *   1. Walk `LEGACY_PHOTOS_DIR/photos/`, `signature/`, `missingtag/`.
 *   2. For each file:
 *      a) Sniff magic bytes → derive extension (PNG: 89 50 4E 47, JPEG: FF D8 FF).
 *      b) SHA-256 the bytes for dedup.
 *      c) Resolve `taskId` from the filename pattern `image-<taskId>-<i>-<slot>-<date>`.
 *      d) Look up the new `stores.id` via `legacyTaskId`.
 *      e) Object key: `{mapId}/{storeId}/{sha256}.{ext}`.
 *      f) Multipart upload via `@aws-sdk/client-s3` (concurrency from env).
 *      g) Insert/update `photos` row; record `legacyPath`.
 */
export const migratePhotos: Migrator = async (_ctx) => {
  // TODO(phase-3): implement.
  return { read: 0, written: 0, warnings: ['photos migration: TODO Phase 3 cutover'] };
};
