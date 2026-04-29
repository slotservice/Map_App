/**
 * Post-migration sanity check. Compares legacy row counts to new row
 * counts and spot-checks a few rows for shape.
 *
 * Run AFTER `pnpm migrate` (with DRY_RUN=false) to confirm nothing went
 * sideways before flipping cutover DNS.
 */
import { closeLegacy, legacyQuery } from './lib/legacy-mysql.js';
import { closePrisma, getPrisma } from './lib/target-prisma.js';

interface Check {
  name: string;
  legacy: () => Promise<number>;
  target: () => Promise<number>;
  /**
   * Some legacy rows won't migrate (e.g. assigns where the map was
   * already hard-deleted). Tolerate up to N missing.
   */
  toleranceAbs?: number;
}

async function main(): Promise<void> {
  const prisma = getPrisma();
  let pass = 0;
  let fail = 0;

  const checks: Check[] = [
    {
      name: 'users',
      legacy: () => count('SELECT COUNT(*) AS c FROM users WHERE del_flg = 0'),
      target: () => prisma.user.count({ where: { deletedAt: null } }),
    },
    {
      name: 'maps',
      legacy: () => count('SELECT COUNT(*) AS c FROM maps WHERE del_flg = 0'),
      target: () => prisma.map.count({ where: { deletedAt: null } }),
    },
    {
      name: 'stores (vs legacy tasks)',
      legacy: () => count('SELECT COUNT(*) AS c FROM tasks WHERE del_flg = 0'),
      target: () => prisma.store.count({ where: { deletedAt: null } }),
      toleranceAbs: 5, // a few legacy rows might lack lat/lon
    },
    {
      name: 'completions (deduped by task)',
      legacy: () =>
        count('SELECT COUNT(DISTINCT task_id) AS c FROM completion'),
      target: () => prisma.completion.count(),
      toleranceAbs: 5,
    },
    {
      name: 'tag_alerts',
      legacy: () => count('SELECT COUNT(*) AS c FROM missingtag'),
      target: () => prisma.tagAlert.count(),
      toleranceAbs: 2,
    },
    {
      name: 'assignments',
      legacy: () =>
        count('SELECT COUNT(DISTINCT map_id, user_id) AS c FROM assigns WHERE map_id IS NOT NULL AND user_id IS NOT NULL'),
      target: () => prisma.mapAssignment.count(),
      toleranceAbs: 5,
    },
  ];

  // eslint-disable-next-line no-console
  console.log('Migration verification:');
  for (const check of checks) {
    const [l, t] = await Promise.all([check.legacy(), check.target()]);
    const tol = check.toleranceAbs ?? 0;
    const ok = Math.abs(l - t) <= tol;
    const symbol = ok ? '✔' : '✗';
    // eslint-disable-next-line no-console
    console.log(`  ${symbol} ${check.name.padEnd(30)} legacy=${l}  target=${t}`);
    if (ok) pass++;
    else fail++;
  }

  // Spot check: a random store should have lat/lon and at least one task
  // if its legacy peers had tasks.
  const sample = await prisma.store.findFirst({
    where: { latitude: { not: 0 } },
    include: { tasks: true, map: true },
  });
  if (sample) {
    // eslint-disable-next-line no-console
    console.log(
      `\nSpot check: store ${sample.storeNumber} ${sample.storeName} on map "${sample.map.name}" — ${sample.tasks.length} task(s), lat=${sample.latitude} lon=${sample.longitude}, propertyImage=${sample.propertyImageKey ? 'yes' : 'no'}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`\n${pass} pass, ${fail} fail`);
  await closeLegacy();
  await closePrisma();
  if (fail > 0) process.exit(1);
}

async function count(sql: string): Promise<number> {
  const rows = await legacyQuery<{ c: number } & import('mysql2').RowDataPacket>(sql);
  return Number(rows[0]?.c ?? 0);
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  await closeLegacy();
  await closePrisma();
  process.exit(1);
});
