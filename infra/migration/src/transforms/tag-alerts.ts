import type { Migrator } from '../types.js';
import { legacyQuery, type LegacyMissingTagRow } from '../lib/legacy-mysql.js';
import { getPrisma } from '../lib/target-prisma.js';

/**
 * Migrate legacy `missingtag` → new `tag_alerts` + `tag_alert_photos`.
 *
 *   - task_id        → resolve via stores.legacyTaskId.
 *   - comment        → description. Title: first 80 chars (or "Tag alert").
 *   - img0..img3     → look up `photos` by legacyPath; link via
 *                      tag_alert_photos. Update kind to 'tag_alert'.
 *   - emailStatus    → 'sent' (historical; we don't retroactively re-send).
 *   - emailSentAt    → legacy.created_at as best-known approximation.
 */
export const migrateTagAlerts: Migrator = async (ctx) => {
  const prisma = getPrisma();
  const rows = await legacyQuery<LegacyMissingTagRow>('SELECT * FROM missingtag');

  const stores = await prisma.store.findMany({
    where: { legacyTaskId: { not: null } },
    select: { id: true, legacyTaskId: true },
  });
  const storeByLegacyTaskId = new Map<number, string>();
  for (const s of stores) {
    if (s.legacyTaskId !== null) storeByLegacyTaskId.set(s.legacyTaskId, s.id);
  }

  const users = await prisma.user.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true },
  });
  const userByLegacyId = new Map<number, string>();
  for (const u of users) {
    if (u.legacyId !== null) userByLegacyId.set(u.legacyId, u.id);
  }

  let written = 0;
  const warnings: string[] = [];

  for (const row of rows) {
    const storeId = storeByLegacyTaskId.get(row.task_id);
    if (!storeId) {
      warnings.push(`MissingTag #${row.id}: legacy task #${row.task_id} not migrated`);
      continue;
    }
    const raisedById = row.worker_id ? userByLegacyId.get(row.worker_id) : null;
    if (!raisedById) {
      warnings.push(`MissingTag #${row.id}: legacy worker_id ${row.worker_id} not found`);
      continue;
    }

    const description = (row.comment ?? '').trim();
    const title = description.length > 80 ? description.slice(0, 80) + '…' : description || 'Tag alert';

    const imgPaths = [row.img0, row.img1, row.img2, row.img3]
      .filter((p): p is string => !!p && p.length > 0);

    if (ctx.dryRun) {
      written++;
      continue;
    }

    const photos = imgPaths.length
      ? await prisma.photo.findMany({ where: { legacyPath: { in: imgPaths } } })
      : [];

    const created = await prisma.tagAlert.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        storeId,
        raisedById,
        title,
        description,
        raisedAt: new Date(row.created_at),
        emailStatus: 'sent',
        emailSentAt: new Date(row.created_at),
      },
      update: {
        title,
        description,
        raisedAt: new Date(row.created_at),
      },
    });

    if (photos.length > 0) {
      await prisma.photo.updateMany({
        where: { id: { in: photos.map((p) => p.id) } },
        data: { kind: 'tag_alert' },
      });
      // Idempotent: clear & re-link.
      await prisma.tagAlertPhoto.deleteMany({ where: { tagAlertId: created.id } });
      await prisma.tagAlertPhoto.createMany({
        data: photos.map((p) => ({ tagAlertId: created.id, photoId: p.id })),
      });
    }

    written++;
  }

  return { read: rows.length, written, warnings };
};
