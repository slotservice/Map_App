/**
 * Legacy → new ETL.
 *
 * Phases:
 *   1. users     (legacy users → users)
 *   2. maps      (legacy maps → maps; derive task_columns / count_columns)
 *   3. stores    (legacy tasks → stores + store_tasks)
 *   4. photos    (filesystem → R2; sniff magic bytes to add extensions)
 *   5. completions (legacy completion → completions + completion_counts)
 *   6. tag_alerts (legacy missingtag → tag_alerts + tag_alert_photos)
 *   7. assignments (legacy assigns → map_assignments[role=worker])
 *   8. tagemails (legacy tagemails → maps.tag_alert_recipients)
 *
 * `--dry-run` (env DRY_RUN=true) reads, transforms, and reports — but
 * writes nothing to the new DB or to R2.
 *
 * Concrete logic for each phase lives in transforms/. This file is the
 * orchestrator: it reads env, opens connections, runs phases in order,
 * and writes a JSON summary.
 *
 * NOTE: This skeleton compiles and runs but each transform throws
 * "not implemented" until Phase 3 (cutover) — see REBUILD_PLAN §8.
 */

import { migrateUsers } from './transforms/users.js';
import { migrateMaps } from './transforms/maps.js';
import { migrateStores } from './transforms/stores.js';
import { migratePhotos } from './transforms/photos.js';
import { migrateCompletions } from './transforms/completions.js';
import { migrateTagAlerts } from './transforms/tag-alerts.js';
import { migrateAssignments } from './transforms/assignments.js';

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function main(): Promise<void> {
  const ctx = { dryRun: DRY_RUN, startedAt: new Date() };

  // eslint-disable-next-line no-console
  console.log(`▶ Starting migration (dryRun=${DRY_RUN})`);

  const phases = [
    ['users', migrateUsers],
    ['maps', migrateMaps],
    ['stores', migrateStores],
    ['photos', migratePhotos],
    ['completions', migrateCompletions],
    ['tag_alerts', migrateTagAlerts],
    ['assignments', migrateAssignments],
  ] as const;

  for (const [name, fn] of phases) {
    const phaseStart = Date.now();
    try {
      const result = await fn(ctx);
      // eslint-disable-next-line no-console
      console.log(`✔ ${name}: ${result.read} read, ${result.written} written, ${Date.now() - phaseStart}ms`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`✗ ${name} failed:`, err);
      process.exit(1);
    }
  }

  // eslint-disable-next-line no-console
  console.log('▶ Migration complete.');
}

main();
