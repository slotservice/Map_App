import type { Migrator } from '../types.js';
import {
  legacyQuery,
  type LegacyCompletionRow,
  type LegacyTaskRow,
} from '../lib/legacy-mysql.js';
import { getPrisma } from '../lib/target-prisma.js';

interface ImageEntry {
  field: string;
  before?: string;
  after?: string;
}

/**
 * Migrate legacy `completion` → new `completions` + `completion_counts` +
 * relink before/after photos and signature.
 *
 * Notes:
 *  - Legacy may have multiple completion rows per task; we keep the most
 *    recent (`updated_at desc`) and skip the rest.
 *  - `comments` (legacy varchar(255), silently truncated for years) →
 *    `general_comments` (text, no truncation).
 *  - Counts come from `tasks.data` keys that are present in the parent
 *    map's `count_columns`. Empty / non-numeric values default to 0.
 *  - `images` legacy stringified JSON array contains relative legacy
 *    paths — resolve via Photo.legacyPath and update kind=before/after,
 *    completionId=this.
 *  - `signature` legacy path → resolve in `photos` table, link via
 *    completion.signaturePhotoId.
 *  - deviceTimezone defaults to 'UTC' since legacy didn't record it.
 */
export const migrateCompletions: Migrator = async (ctx) => {
  const prisma = getPrisma();
  const completions = await legacyQuery<LegacyCompletionRow>(
    'SELECT * FROM completion ORDER BY task_id, updated_at DESC',
  );
  const tasksById = await fetchTasksById();

  const stores = await prisma.store.findMany({
    where: { legacyTaskId: { not: null } },
    include: {
      map: { select: { countColumns: true } },
    },
  });
  const storeByLegacyTaskId = new Map<number, (typeof stores)[number]>();
  for (const s of stores) {
    if (s.legacyTaskId !== null) storeByLegacyTaskId.set(s.legacyTaskId, s);
  }

  const users = await prisma.user.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true },
  });
  const userByLegacyId = new Map<number, string>();
  for (const u of users) {
    if (u.legacyId !== null) userByLegacyId.set(u.legacyId, u.id);
  }

  let read = 0;
  let written = 0;
  const warnings: string[] = [];
  const seenTaskIds = new Set<number>();

  for (const c of completions) {
    read++;
    if (seenTaskIds.has(c.task_id)) continue; // dupe — keep most recent only
    seenTaskIds.add(c.task_id);

    const store = storeByLegacyTaskId.get(c.task_id);
    if (!store) {
      warnings.push(`Completion #${c.id}: store for legacy task #${c.task_id} not migrated`);
      continue;
    }

    const workerId = c.worker_id ? userByLegacyId.get(c.worker_id) : null;
    if (!workerId) {
      warnings.push(`Completion #${c.id}: legacy worker_id ${c.worker_id} not found`);
      continue;
    }

    const taskRow = tasksById.get(c.task_id);
    const taskData = parseJson<Record<string, unknown>>(taskRow?.data) ?? {};
    const countColumns = (store.map.countColumns as string[]) ?? [];
    const counts: Array<{ name: string; value: number }> = [];
    for (const col of countColumns) {
      const raw = taskData[col];
      const n = Number(raw);
      counts.push({ name: col, value: Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0 });
    }

    const images = parseJson<ImageEntry[]>(c.images) ?? [];

    if (ctx.dryRun) {
      written++;
      continue;
    }

    // Find matching photos (already uploaded in the photos phase).
    const beforePaths = images.filter((i) => i.before).map((i) => `photos/${i.before!}`);
    const afterPaths = images.filter((i) => i.after).map((i) => `photos/${i.after!}`);
    const sigPath = c.signature ? c.signature : null;

    const beforePhotos = beforePaths.length
      ? await prisma.photo.findMany({ where: { legacyPath: { in: beforePaths } } })
      : [];
    const afterPhotos = afterPaths.length
      ? await prisma.photo.findMany({ where: { legacyPath: { in: afterPaths } } })
      : [];
    const sigPhoto = sigPath
      ? await prisma.photo.findFirst({ where: { legacyPath: sigPath } })
      : null;

    const created = await prisma.completion.upsert({
      where: { legacyId: c.id },
      create: {
        legacyId: c.id,
        storeId: store.id,
        completedById: workerId,
        firstName: c.firstname || '',
        lastName: c.lastname || '',
        signaturePhotoId: sigPhoto?.id ?? null,
        generalComments: c.comments ?? '',
        completedAt: new Date(c.updated_at),
        deviceTimezone: 'UTC',
      },
      update: {
        firstName: c.firstname || '',
        lastName: c.lastname || '',
        signaturePhotoId: sigPhoto?.id ?? null,
        generalComments: c.comments ?? '',
        completedAt: new Date(c.updated_at),
      },
    });

    // Replace counts for this completion.
    await prisma.completionCount.deleteMany({ where: { completionId: created.id } });
    if (counts.length > 0) {
      await prisma.completionCount.createMany({
        data: counts.map((c2) => ({
          completionId: created.id,
          countName: c2.name,
          value: c2.value,
        })),
      });
    }

    // Re-link before/after photos.
    if (beforePhotos.length > 0) {
      await prisma.photo.updateMany({
        where: { id: { in: beforePhotos.map((p) => p.id) } },
        data: { completionId: created.id, kind: 'before' },
      });
    }
    if (afterPhotos.length > 0) {
      await prisma.photo.updateMany({
        where: { id: { in: afterPhotos.map((p) => p.id) } },
        data: { completionId: created.id, kind: 'after' },
      });
    }
    if (sigPhoto) {
      await prisma.photo.update({
        where: { id: sigPhoto.id },
        data: { kind: 'signature' },
      });
    }

    written++;
  }

  return { read, written, warnings };
};

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fetchTasksById(): Promise<Map<number, LegacyTaskRow>> {
  const rows = await legacyQuery<LegacyTaskRow>('SELECT * FROM tasks');
  const m = new Map<number, LegacyTaskRow>();
  for (const r of rows) m.set(r.id, r);
  return m;
}
