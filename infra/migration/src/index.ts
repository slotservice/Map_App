/**
 * Legacy → new ETL orchestrator.
 *
 * Phases (must run in this order — later phases reference cross-IDs
 * stamped by earlier phases):
 *   1. users         legacy users → users
 *   2. maps          legacy maps → maps; derive task_columns + count_columns;
 *                    fold tagemails → tag_alert_recipients
 *   3. stores        legacy tasks → stores + store_tasks
 *   4. photos        filesystem → R2; finalize Photo rows w/ legacyPath
 *   5. completions   legacy completion → completions + completion_counts;
 *                    re-link before/after photos via Photo.legacyPath
 *   6. tag_alerts    legacy missingtag → tag_alerts + tag_alert_photos
 *   7. assignments   legacy assigns → map_assignments
 *
 * `DRY_RUN=true` (default) reads, transforms, and reports — but never
 * writes to the new DB or to R2. Run once dry, eyeball output, then
 * re-run with DRY_RUN=false.
 *
 * Re-runnable: every transform uses upsert keyed on legacyId so a
 * second run is a no-op for already-migrated rows.
 */

import { migrateUsers } from './transforms/users.js';
import { migrateMaps } from './transforms/maps.js';
import { migrateStores } from './transforms/stores.js';
import { migratePhotos } from './transforms/photos.js';
import { migrateCompletions } from './transforms/completions.js';
import { migrateTagAlerts } from './transforms/tag-alerts.js';
import { migrateAssignments } from './transforms/assignments.js';
import { closeLegacy } from './lib/legacy-mysql.js';
import { closePrisma } from './lib/target-prisma.js';
import type { MigrationContext, Migrator } from './types.js';

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function main(): Promise<void> {
  const ctx: MigrationContext = { dryRun: DRY_RUN, startedAt: new Date() };

  // eslint-disable-next-line no-console
  console.log(`▶ Starting migration (dryRun=${DRY_RUN})`);

  const phases: Array<[string, Migrator]> = [
    ['users', migrateUsers],
    ['maps', migrateMaps],
    ['stores', migrateStores],
    ['photos', migratePhotos],
    ['completions', migrateCompletions],
    ['tag_alerts', migrateTagAlerts],
    ['assignments', migrateAssignments],
  ];

  let totalWarnings = 0;
  for (const [name, fn] of phases) {
    const phaseStart = Date.now();
    try {
      const result = await fn(ctx);
      const elapsed = Date.now() - phaseStart;
      // eslint-disable-next-line no-console
      console.log(
        `✔ ${name.padEnd(12)} read=${result.read} written=${result.written} (${elapsed}ms)`,
      );
      if (result.warnings && result.warnings.length > 0) {
        totalWarnings += result.warnings.length;
        for (const w of result.warnings.slice(0, 5)) {
          // eslint-disable-next-line no-console
          console.warn(`    ⚠ ${w}`);
        }
        if (result.warnings.length > 5) {
          // eslint-disable-next-line no-console
          console.warn(`    … and ${result.warnings.length - 5} more`);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`✗ ${name} failed:`, err);
      await cleanup();
      process.exit(1);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `▶ Migration complete${totalWarnings > 0 ? ` (${totalWarnings} warning(s))` : ''}.`,
  );
  if (DRY_RUN) {
    // eslint-disable-next-line no-console
    console.log('   (dry run — re-run with DRY_RUN=false to actually write)');
  } else {
    // eslint-disable-next-line no-console
    console.log("   Run 'pnpm migrate:verify' next to compare row counts.");
  }
  await cleanup();
}

async function cleanup(): Promise<void> {
  try {
    await closeLegacy();
  } catch {
    /* ignore */
  }
  try {
    await closePrisma();
  } catch {
    /* ignore */
  }
}

main();
