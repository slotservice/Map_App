import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus, type CompleteStoreRequest, type Completion } from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class CompletionService {
  private readonly logger = new Logger(CompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Finalise a store visit. Validates that:
   *  - The store exists, isn't soft-deleted, and the photos referenced
   *    are uploaded for THIS store (no cross-store linking).
   *  - The signature photo exists and is of kind 'signature'.
   *  - The count keys match the parent map's `countColumns`.
   *
   * On success:
   *  - Inserts Completion + CompletionCount rows.
   *  - Links every passed photoId to this completion (kind=before/after).
   *  - Marks every StoreTask as scheduled_or_complete.
   *
   * Idempotency: if a completion already exists for this store, we
   * return 409. Re-completion is rare in legacy and out of scope; admin
   * can always soft-delete + recreate via the new admin UI.
   */
  async complete(input: {
    storeId: string;
    userId: string;
    body: CompleteStoreRequest;
  }): Promise<Completion> {
    const store = await this.prisma.store.findUnique({
      where: { id: input.storeId },
      include: { map: true, tasks: true, completions: { take: 1 } },
    });
    if (!store || store.deletedAt) throw new NotFoundException('Store not found');
    if (store.completions.length > 0) {
      throw new BadRequestException('Store already has a completion record');
    }

    const expectedCounts = (store.map.countColumns as string[]) ?? [];
    for (const k of Object.keys(input.body.counts)) {
      if (!expectedCounts.includes(k)) {
        throw new BadRequestException(
          `Unknown count column "${k}" — map expects: ${expectedCounts.join(', ') || '(none)'}`,
        );
      }
    }

    const allPhotoIds = [
      input.body.signaturePhotoId,
      ...input.body.beforePhotoIds,
      ...input.body.afterPhotoIds,
    ];
    const photos = await this.prisma.photo.findMany({
      where: { id: { in: allPhotoIds } },
    });

    if (photos.length !== allPhotoIds.length) {
      throw new BadRequestException('One or more photoIds are invalid');
    }
    for (const p of photos) {
      if (p.storeId !== input.storeId) {
        throw new BadRequestException(`Photo ${p.id} belongs to a different store`);
      }
    }
    const sig = photos.find((p) => p.id === input.body.signaturePhotoId);
    if (!sig || sig.kind !== 'signature') {
      throw new BadRequestException('signaturePhotoId must be a photo of kind "signature"');
    }

    const beforeIds = new Set(input.body.beforePhotoIds);
    const afterIds = new Set(input.body.afterPhotoIds);
    for (const p of photos) {
      if (p.id === input.body.signaturePhotoId) continue;
      const expectedKind = beforeIds.has(p.id) ? 'before' : afterIds.has(p.id) ? 'after' : null;
      if (!expectedKind) {
        throw new BadRequestException(`Photo ${p.id} not classified as before or after`);
      }
      if (p.kind !== expectedKind) {
        throw new BadRequestException(
          `Photo ${p.id} was uploaded as ${p.kind} but is being submitted as ${expectedKind}`,
        );
      }
    }

    const completion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.completion.create({
        data: {
          storeId: input.storeId,
          completedById: input.userId,
          firstName: input.body.firstName,
          lastName: input.body.lastName,
          signaturePhotoId: input.body.signaturePhotoId,
          generalComments: input.body.generalComments,
          completedAt: new Date(input.body.completedAt),
          deviceTimezone: input.body.deviceTimezone,
        },
      });

      if (Object.keys(input.body.counts).length > 0) {
        await tx.completionCount.createMany({
          data: Object.entries(input.body.counts).map(([countName, value]) => ({
            completionId: created.id,
            countName,
            value,
          })),
        });
      }

      // Link the photos.
      await tx.photo.updateMany({
        where: { id: { in: [...beforeIds, ...afterIds] } },
        data: { completionId: created.id },
      });

      // Mark all tasks complete.
      await tx.storeTask.updateMany({
        where: { storeId: input.storeId },
        data: { currentStatus: TaskStatus.SCHEDULED_OR_COMPLETE },
      });

      return created;
    });

    this.logger.log(`Store ${input.storeId} completed by user ${input.userId}`);

    return this.toDto(completion.id);
  }

  /**
   * Read-back of an existing completion. Used by the worker app to
   * display its own completed stores read-only and by the vendor portal.
   */
  async readByStore(storeId: string): Promise<Completion | null> {
    const completion = await this.prisma.completion.findFirst({
      where: { storeId },
      orderBy: { completedAt: 'desc' },
    });
    if (!completion) return null;
    return this.toDto(completion.id);
  }

  private async toDto(completionId: string): Promise<Completion> {
    const c = await this.prisma.completion.findUniqueOrThrow({
      where: { id: completionId },
      include: {
        completedBy: true,
        signaturePhoto: true,
        counts: true,
        photos: true,
      },
    });

    const counts: Record<string, number> = {};
    for (const row of c.counts) counts[row.countName] = row.value;

    const before = c.photos.filter((p) => p.kind === 'before').map((p) => p.id);
    const after = c.photos.filter((p) => p.kind === 'after').map((p) => p.id);

    let signatureUrl: string | null = null;
    if (c.signaturePhoto) {
      signatureUrl = await this.storage.presignRead(c.signaturePhoto.objectKey);
    }

    return {
      id: c.id,
      storeId: c.storeId,
      completedBy: c.completedById,
      completedByName: `${c.completedBy.firstName} ${c.completedBy.lastName}`.trim(),
      firstName: c.firstName,
      lastName: c.lastName,
      signatureUrl,
      generalComments: c.generalComments,
      counts,
      completedAt: c.completedAt.toISOString(),
      deviceTimezone: c.deviceTimezone,
      beforePhotoIds: before,
      afterPhotoIds: after,
    };
  }
}
