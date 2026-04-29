import type { Migrator } from '../types.js';
import { legacyQuery, type LegacyTaskRow } from '../lib/legacy-mysql.js';
import { getPrisma } from '../lib/target-prisma.js';
import { TaskStatus } from '@map-app/shared';

const FIXED_KEY_LOOKUP: Record<string, string> = {
  state: 'state',
  address: 'address',
  zip: 'zip',
  latitude: 'latitude',
  longitude: 'longitude',
  type: 'type',
  manager: 'manager',
  regional: 'regional',
  notes: 'notes',
};

/**
 * Migrate legacy `tasks` → new `stores` + `store_tasks`.
 *
 * Per row:
 *   - storeNumber   = legacy.store_id (integer) coerced to text — preserves
 *                     the legacy zero-loss bug for any future zip-style
 *                     numeric data we might encounter.
 *   - storeName     = legacy.name (the legacy column was misnamed).
 *   - data JSON     → split into typed columns (state, address, zip, lat,
 *                     lon, type, manager, regional, notes) + StoreTask rows
 *                     for any *_Task key + raw passthrough for the rest.
 *   - Empty-string key "" dropped.
 *   - zip coerced to string (was sometimes stored as int in legacy).
 *   - latitude/longitude validated as finite numbers.
 *
 * Cross-reference: stamps `stores.legacyTaskId = legacy.tasks.id` so
 * later phases (photos, completions, tag-alerts) can resolve store ids.
 *
 * Maps must already be migrated (we look them up by legacyId).
 */
export const migrateStores: Migrator = async (ctx) => {
  const prisma = getPrisma();
  const tasks = await legacyQuery<LegacyTaskRow>(
    'SELECT * FROM tasks WHERE del_flg = 0',
  );

  const mapLookup = new Map<number, string>();
  const allMaps = await prisma.map.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true },
  });
  for (const m of allMaps) {
    if (m.legacyId !== null) mapLookup.set(m.legacyId, m.id);
  }

  let written = 0;
  const warnings: string[] = [];

  for (const t of tasks) {
    const newMapId = mapLookup.get(t.map_id);
    if (!newMapId) {
      warnings.push(`Task #${t.id}: parent map #${t.map_id} not migrated; skipping`);
      continue;
    }

    let data: Record<string, unknown> = {};
    try {
      data = t.data ? (JSON.parse(t.data) as Record<string, unknown>) : {};
    } catch {
      warnings.push(`Task #${t.id}: bad data JSON, treating as empty`);
    }
    delete data['']; // legacy empty-string key

    const fixed: Record<string, string | number | null> = {};
    const tasksMap: Record<string, string> = {};
    const raw: Record<string, unknown> = {};

    for (const [origKey, origVal] of Object.entries(data)) {
      const norm = origKey.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const fixedName = FIXED_KEY_LOOKUP[norm];
      if (fixedName) {
        fixed[fixedName] = coerceFixed(fixedName, origVal);
      } else if (/task$/i.test(origKey)) {
        tasksMap[origKey] = String(origVal ?? '').trim();
      }
      raw[origKey] = origVal;
    }

    const lat = Number(fixed.latitude);
    const lon = Number(fixed.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      warnings.push(`Task #${t.id}: invalid lat/lon, skipping store`);
      continue;
    }

    if (ctx.dryRun) {
      written++;
      continue;
    }

    const store = await prisma.store.upsert({
      where: { legacyTaskId: t.id },
      create: {
        legacyTaskId: t.id,
        mapId: newMapId,
        storeNumber: String(t.store_id),
        storeName: t.name,
        state: stringOrNull(fixed.state),
        address: stringOrNull(fixed.address),
        zip: stringOrNull(fixed.zip),
        latitude: lat,
        longitude: lon,
        type: stringOrNull(fixed.type),
        manager: stringOrNull(fixed.manager),
        regional: stringOrNull(fixed.regional),
        notes: stringOrNull(fixed.notes),
        raw,
        createdAt: new Date(t.created_at),
      },
      update: {
        storeNumber: String(t.store_id),
        storeName: t.name,
        state: stringOrNull(fixed.state),
        address: stringOrNull(fixed.address),
        zip: stringOrNull(fixed.zip),
        latitude: lat,
        longitude: lon,
        type: stringOrNull(fixed.type),
        manager: stringOrNull(fixed.manager),
        regional: stringOrNull(fixed.regional),
        notes: stringOrNull(fixed.notes),
        raw,
      },
    });

    // Replace task rows for this store from scratch — simpler than
    // diff-merging when migrations are repeatable.
    await prisma.storeTask.deleteMany({ where: { storeId: store.id } });
    if (Object.keys(tasksMap).length > 0) {
      const isComplete = t.status === 2;
      await prisma.storeTask.createMany({
        data: Object.entries(tasksMap).map(([taskName, value]) => {
          const initial =
            value.toLowerCase() === 'needs scheduled'
              ? TaskStatus.NEEDS_SCHEDULED
              : TaskStatus.SCHEDULED_OR_COMPLETE;
          // If the task had an active completion, the worker already moved
          // every task to scheduled_or_complete on submit.
          const current = isComplete ? TaskStatus.SCHEDULED_OR_COMPLETE : initial;
          return {
            storeId: store.id,
            taskName,
            initialStatus: initial,
            currentStatus: current,
          };
        }),
      });
    }

    written++;
  }

  return { read: tasks.length, written, warnings };
};

function coerceFixed(key: string, val: unknown): string | number | null {
  if (val == null || val === '') return null;
  if (key === 'latitude' || key === 'longitude') {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  // Zip especially: force to text to preserve leading zeros.
  return String(val);
}

function stringOrNull(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
