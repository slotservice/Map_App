import type { Migrator } from '../types.js';
import {
  legacyQuery,
  type LegacyMapRow,
  type LegacyTagEmailRow,
  type LegacyTaskRow,
} from '../lib/legacy-mysql.js';
import { getPrisma } from '../lib/target-prisma.js';

const FIXED_KEYS = new Set([
  'state',
  'address',
  'zip',
  'latitude',
  'longitude',
  'type',
  'manager',
  'regional',
  'notes',
]);

/**
 * Migrate legacy `maps` → new `maps`.
 *
 * Derives `task_columns` and `count_columns` per map by scanning the
 * union of `tasks.data` JSON keys for that map:
 *   - Empty key "" (the legacy bug) is dropped.
 *   - Known fixed keys (state, address, …) are surfaced as typed
 *     columns on `stores` later — not stored here.
 *   - Keys ending in "Task" (case-insensitive) → task column.
 *   - Everything else → count column.
 *
 * Also folds legacy `tagemails` rows into `maps.tag_alert_recipients`.
 */
export const migrateMaps: Migrator = async (ctx) => {
  const prisma = getPrisma();
  const maps = await legacyQuery<LegacyMapRow>(
    'SELECT * FROM maps WHERE del_flg = 0',
  );
  const tagEmails = await legacyQuery<LegacyTagEmailRow>('SELECT * FROM tagemails');
  const recipientsByMap = new Map<number, string[]>();
  for (const t of tagEmails) {
    if (t.map_id == null || !t.email) continue;
    const list = recipientsByMap.get(t.map_id) ?? [];
    if (!list.includes(t.email.toLowerCase())) list.push(t.email.toLowerCase());
    recipientsByMap.set(t.map_id, list);
  }

  let written = 0;
  const warnings: string[] = [];

  for (const map of maps) {
    const tasks = await legacyQuery<LegacyTaskRow>(
      'SELECT data FROM tasks WHERE map_id = ? AND del_flg = 0',
      [map.id],
    );

    const allKeys = new Set<string>();
    for (const t of tasks) {
      if (!t.data) continue;
      try {
        const parsed = JSON.parse(t.data) as Record<string, unknown>;
        for (const k of Object.keys(parsed)) {
          if (k.trim() === '') continue;
          allKeys.add(k);
        }
      } catch {
        warnings.push(`Map #${map.id}: task data not JSON, skipping`);
      }
    }

    const taskColumns: string[] = [];
    const countColumns: string[] = [];
    for (const k of allKeys) {
      const lower = k.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (FIXED_KEYS.has(lower)) continue;
      if (/task$/i.test(k)) taskColumns.push(k);
      else countColumns.push(k);
    }

    if (ctx.dryRun) {
      written++;
      continue;
    }

    await prisma.map.upsert({
      where: { legacyId: map.id },
      create: {
        legacyId: map.id,
        name: map.name,
        sourceFilename: null,
        taskColumns,
        countColumns,
        tagAlertRecipients: recipientsByMap.get(map.id) ?? [],
        createdAt: new Date(map.created_at),
        updatedAt: new Date(map.updated_at),
      },
      update: {
        name: map.name,
        taskColumns,
        countColumns,
        tagAlertRecipients: recipientsByMap.get(map.id) ?? [],
      },
    });
    written++;
  }

  return { read: maps.length, written, warnings };
};
