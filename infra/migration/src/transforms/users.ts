import type { Migrator } from '../types.js';

/**
 * Map legacy `users` rows → new `users` + role string.
 *
 * Legacy `users.type`:
 *   1 → admin
 *   2 → vendor
 *   4 → worker
 *
 * Field translations:
 *   - `username` is split into firstName/lastName by ` ` (fallback firstName=username, lastName='').
 *   - `email_verified_at` is dropped.
 *   - `api_token` is dropped (replaced by JWT).
 *   - `password` (bcrypt hash) is preserved verbatim — bcrypt $2y/$2b are
 *     interchangeable; new logins re-hash on first success only if needed.
 *   - `del_flg=1` → `deletedAt = updatedAt`.
 *
 * Cross-reference: stamp `users.legacyId = legacy.id` for traceability.
 */
export const migrateUsers: Migrator = async (_ctx) => {
  // TODO(phase-3): implement against `mysql2` source + `@prisma/client` target.
  return { read: 0, written: 0, warnings: ['users migration: TODO Phase 3 cutover'] };
};
