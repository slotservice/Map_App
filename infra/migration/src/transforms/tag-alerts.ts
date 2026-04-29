import type { Migrator } from '../types.js';

/**
 * Migrate legacy `missingtag` → new `tag_alerts` + `tag_alert_photos`.
 *
 *   - `task_id` → resolve via `stores.legacyTaskId` to `stores.id`.
 *   - `comment` → `description`. `title` legacy column doesn't exist;
 *     use the first 80 chars of comment as title, or "Tag alert" fallback.
 *   - `img0..img3` paths → look up matching `photos` rows (already
 *     migrated in the photos phase) → link via `tag_alert_photos`.
 *   - `emailStatus` is set to `done` (we can't know retroactively what
 *     was sent; better to mark them as historical sent than to retry).
 *   - Migrate `tagemails` separately to `maps.tag_alert_recipients`
 *     by grouping by `map_id`.
 */
export const migrateTagAlerts: Migrator = async (_ctx) => {
  // TODO(phase-3): implement.
  return { read: 0, written: 0, warnings: ['tag_alerts migration: TODO Phase 3 cutover'] };
};
