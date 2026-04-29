import type { Migrator } from '../types.js';

/**
 * Migrate legacy `maps` → new `maps`.
 *
 * Derive `task_columns` and `count_columns` per map by scanning the
 * union of `tasks.data` JSON keys for that map. Heuristic:
 *   - Keys ending in `Task` (case-insensitive) → task column.
 *   - Keys whose values are numeric strings everywhere they appear → count.
 *   - The stray empty-string key `""` (legacy bug) is dropped.
 *
 * Hard-deleted legacy maps are not reachable from this dump — the
 * AUTO_INCREMENT gap in the source DB just means lost ids; nothing to do.
 */
export const migrateMaps: Migrator = async (_ctx) => {
  // TODO(phase-3): implement.
  return { read: 0, written: 0, warnings: ['maps migration: TODO Phase 3 cutover'] };
};
