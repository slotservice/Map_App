import type { Migrator } from '../types.js';
import { legacyQuery, type LegacyAssignsRow } from '../lib/legacy-mysql.js';
import { getPrisma } from '../lib/target-prisma.js';

/**
 * Migrate legacy `assigns` → new `map_assignments`.
 *
 * All legacy assignments are workers — the legacy code path for vendor
 * assignment was never wired (which is why bug L1 happened in
 * production). Vendor + viewer assignments must be re-entered manually
 * after cutover via the new admin UI.
 *
 * Deduplicates on (mapId, userId): keeps the earliest created_at.
 */
export const migrateAssignments: Migrator = async (ctx) => {
  const prisma = getPrisma();
  const rows = await legacyQuery<LegacyAssignsRow>(
    'SELECT * FROM assigns ORDER BY created_at ASC',
  );

  const maps = await prisma.map.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true },
  });
  const mapByLegacyId = new Map<number, string>();
  for (const m of maps) {
    if (m.legacyId !== null) mapByLegacyId.set(m.legacyId, m.id);
  }

  const users = await prisma.user.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true, role: true },
  });
  const userByLegacyId = new Map<number, { id: string; role: string }>();
  for (const u of users) {
    if (u.legacyId !== null) userByLegacyId.set(u.legacyId, { id: u.id, role: u.role });
  }

  let written = 0;
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.map_id == null || row.user_id == null) continue;
    const newMapId = mapByLegacyId.get(row.map_id);
    const user = userByLegacyId.get(row.user_id);
    if (!newMapId) {
      warnings.push(`Assignment #${row.id}: map #${row.map_id} not migrated`);
      continue;
    }
    if (!user) {
      warnings.push(`Assignment #${row.id}: user #${row.user_id} not migrated`);
      continue;
    }

    const key = `${newMapId}::${user.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (ctx.dryRun) {
      written++;
      continue;
    }

    await prisma.mapAssignment.upsert({
      where: { mapId_userId: { mapId: newMapId, userId: user.id } },
      create: {
        mapId: newMapId,
        userId: user.id,
        // Legacy never wired non-worker assignment, so legacy `assigns`
        // rows are universally worker-role even when the user happens
        // to be admin. Use the user's actual role to be safe.
        assignedRole: user.role === 'worker' ? 'worker' : (user.role as 'admin' | 'vendor' | 'viewer' | 'worker'),
      },
      update: {},
    });
    written++;
  }

  return { read: rows.length, written, warnings };
};
