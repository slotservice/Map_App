import type { Migrator } from '../types.js';

/**
 * Migrate legacy `tasks` → new `stores` + `store_tasks`.
 *
 * Per row:
 *   - `tasks.store_id` (integer) → `stores.storeNumber` (text — preserves
 *     leading zeros that legacy lost when MySQL stored as int).
 *   - `tasks.name`     → `stores.storeName`.
 *   - `tasks.data` JSON is parsed and split:
 *       * Latitude/Longitude → numeric columns (validated by Zod before insert).
 *       * Zip → forced to text.
 *       * Each *_Task key → store_tasks row (initialStatus + currentStatus
 *         derived from value: "Needs Scheduled" → needs_scheduled,
 *         everything else → scheduled_or_complete).
 *       * Other keys → `stores.raw` JSONB pass-through (notes, type, manager, regional…).
 *   - The empty-string key `""` and any whitespace-only keys are dropped.
 *
 * Cross-reference: stamp `stores.legacyTaskId = legacy.tasks.id`.
 */
export const migrateStores: Migrator = async (_ctx) => {
  // TODO(phase-3): implement.
  return { read: 0, written: 0, warnings: ['stores migration: TODO Phase 3 cutover'] };
};
