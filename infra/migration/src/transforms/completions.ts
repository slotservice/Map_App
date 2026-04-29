import type { Migrator } from '../types.js';

/**
 * Migrate legacy `completion` → new `completions` + `completion_counts`
 * + relink the photos.
 *
 * Notes:
 *   - Legacy may have multiple completion rows per task; we keep the
 *     most recent (`orderByDesc('updated_at')`) and discard older ones.
 *   - `comments` (varchar(255), silently truncated) → `general_comments` (text).
 *   - `images` (stringified JSON) → walk through, find each photo
 *     by `legacyPath`, link to this completion (kind=before/after).
 *   - Counts: walk the matching `tasks.data` keys that are numeric and
 *     present in the map's `count_columns` → insert into completion_counts.
 *   - `signature` legacy path → resolve to the matching `photos` row and
 *     set `completions.signaturePhotoId`.
 *   - `firstname` ('') / `lastname` (NULL) → coerce to ''.
 *   - `completedAt` = legacy `updated_at`. `deviceTimezone` defaults to
 *     'UTC' (we don't know what tz the worker was in retroactively).
 */
export const migrateCompletions: Migrator = async (_ctx) => {
  // TODO(phase-3): implement.
  return { read: 0, written: 0, warnings: ['completions migration: TODO Phase 3 cutover'] };
};
