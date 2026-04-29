import type { Migrator } from '../types.js';

/**
 * Migrate legacy `assigns` → new `map_assignments`.
 *
 *   - All legacy assignments are workers (legacy never wired vendor
 *     assignment, which is why bug L1 happened) → set assignedRole='worker'.
 *   - Deduplicate (mapId, userId): keep earliest `created_at`.
 *   - Vendor and viewer assignments must be re-entered manually after
 *     cutover via the new admin UI.
 */
export const migrateAssignments: Migrator = async (_ctx) => {
  // TODO(phase-3): implement.
  return { read: 0, written: 0, warnings: ['assignments migration: TODO Phase 3 cutover'] };
};
