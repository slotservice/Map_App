import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Migrator } from '../types.js';
import { getPrisma } from '../lib/target-prisma.js';
import { contentTypeFor, detectImageFormat, sha256Hex } from '../lib/photo-utils.js';
import { uploadIfMissing, uploadLimit } from '../lib/r2-uploader.js';

/**
 * Migrate legacy photo files → R2 + photos table.
 *
 *  Walks LEGACY_PHOTOS_DIR for sub-folders:
 *     photos/        before/after photos
 *     missingtag/    tag-alert photos
 *     signature/     signatures
 *
 *  For each file:
 *   1. Read bytes.
 *   2. Sniff format (legacy stored without extension).
 *   3. SHA-256 the bytes for dedup.
 *   4. Resolve the new store via legacyTaskId from filename pattern
 *      (image-<taskId>-<i>-<slot>-<date>, sign-<completionId>-<date>.png,
 *       tag-<taskId>-<i>-<date>.png).
 *   5. Object key: `{mapId}/{storeId}/{sha256}.{ext}`.
 *   6. Upload to R2 (concurrency-limited) with HEAD-then-PUT to dedupe.
 *   7. Insert/upsert a Photo row with `legacyPath` set.
 *
 *  Completions phase later resolves before/after photos by `legacyPath`
 *  and sets `completionId` + `kind`. We just stage them here as
 *  finalized photos.
 */
export const migratePhotos: Migrator = async (ctx) => {
  const dir = process.env.LEGACY_PHOTOS_DIR;
  if (!dir) {
    return { read: 0, written: 0, warnings: ['LEGACY_PHOTOS_DIR not set; skipping'] };
  }

  const prisma = getPrisma();

  // Build legacyTaskId → store + map lookup
  const stores = await prisma.store.findMany({
    where: { legacyTaskId: { not: null } },
    select: { id: true, mapId: true, legacyTaskId: true },
  });
  const storeByLegacyTaskId = new Map<number, { id: string; mapId: string }>();
  for (const s of stores) {
    if (s.legacyTaskId !== null) {
      storeByLegacyTaskId.set(s.legacyTaskId, { id: s.id, mapId: s.mapId });
    }
  }

  let read = 0;
  let written = 0;
  const warnings: string[] = [];

  type Job = {
    folder: 'photos' | 'missingtag' | 'signature';
    filename: string;
  };

  async function listFolder(folder: Job['folder']): Promise<string[]> {
    const full = path.join(dir!, folder);
    try {
      return (await fs.readdir(full)).filter((f) => !f.startsWith('.'));
    } catch {
      return [];
    }
  }

  const photoFiles = (await listFolder('photos')).map((filename) => ({
    folder: 'photos' as const,
    filename,
  }));
  const missingFiles = (await listFolder('missingtag')).map((filename) => ({
    folder: 'missingtag' as const,
    filename,
  }));
  const sigFiles = (await listFolder('signature')).map((filename) => ({
    folder: 'signature' as const,
    filename,
  }));

  const allJobs: Job[] = [...photoFiles, ...missingFiles, ...sigFiles];
  read = allJobs.length;

  await Promise.all(
    allJobs.map((job) =>
      uploadLimit(async () => {
        const fullPath = path.join(dir!, job.folder, job.filename);
        const buffer = await fs.readFile(fullPath);
        const format = detectImageFormat(buffer);
        if (format === 'unknown') {
          warnings.push(`Unrecognised file format: ${job.folder}/${job.filename}`);
          return;
        }
        const ext = format === 'jpg' ? 'jpg' : format;
        const sha = sha256Hex(buffer);
        const contentType = contentTypeFor(format);

        const taskId = parseTaskIdFromFilename(job);
        if (taskId == null) {
          warnings.push(`Could not parse task id from ${job.folder}/${job.filename}`);
          return;
        }
        const store = storeByLegacyTaskId.get(taskId);
        if (!store) {
          // Legacy task got hard-deleted before migration — nothing to attach to.
          warnings.push(
            `Photo ${job.folder}/${job.filename} references missing legacy task #${taskId}`,
          );
          return;
        }

        const objectKey = `${store.mapId}/${store.id}/${sha}.${ext}`;
        const legacyPath = `${job.folder}/${job.filename}`;

        if (ctx.dryRun) {
          written++;
          return;
        }

        await uploadIfMissing(objectKey, buffer, contentType);

        const kind =
          job.folder === 'signature'
            ? 'signature'
            : job.folder === 'missingtag'
              ? 'tag_alert'
              : 'before'; // before/after split happens in completions phase
        await prisma.photo.upsert({
          where: { id: deterministicPhotoId(legacyPath) },
          create: {
            id: deterministicPhotoId(legacyPath),
            storeId: store.id,
            kind,
            objectKey,
            contentType,
            sizeBytes: buffer.length,
            sha256: sha,
            uploadedById: await getSystemUserId(),
            finalizedAt: new Date(),
            legacyPath,
          },
          update: {
            objectKey,
            sha256: sha,
            sizeBytes: buffer.length,
            contentType,
          },
        });
        written++;
      }),
    ),
  );

  return { read, written, warnings };
};

function parseTaskIdFromFilename(job: { folder: string; filename: string }): number | null {
  // image-<taskId>-<i>-<slot>-<date>
  // sign-<completionId>-<date>.png  ← signature is by completion, not task; resolved in completions phase
  // tag-<taskId>-<i>-<date>.png
  if (job.folder === 'photos') {
    const m = job.filename.match(/^image-(\d+)-/);
    return m && m[1] ? Number(m[1]) : null;
  }
  if (job.folder === 'missingtag') {
    const m = job.filename.match(/^tag-(\d+)-/);
    return m && m[1] ? Number(m[1]) : null;
  }
  if (job.folder === 'signature') {
    // Signature is keyed by completion id, not task id. We can't resolve
    // it to a store without the legacy completion table. The completions
    // phase handles re-linking these.
    return -1;
  }
  return null;
}

let cachedSystemUserId: string | null = null;
async function getSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;
  // Re-use the first migrated admin as the historical "uploader".
  const admin = await getPrisma().user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!admin) {
    throw new Error('No admin user found — migrate users phase first.');
  }
  cachedSystemUserId = admin.id;
  return admin.id;
}

/**
 * Stable Photo.id derived from the legacy path. Lets the migration be
 * re-run idempotently without creating duplicate rows.
 */
function deterministicPhotoId(legacyPath: string): string {
  // Use SHA-256 of the path, format as a UUID-shaped string by inserting
  // dashes at positions 8/12/16/20.
  const h = sha256Hex(Buffer.from(legacyPath));
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
