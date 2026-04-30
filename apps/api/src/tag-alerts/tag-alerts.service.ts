import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type CreateTagAlertRequest, type TagAlert } from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { assertMapAccess, assertStoreAccess } from '../common/access.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

export interface TagAlertOutboxPayload {
  tagAlertId: string;
}

@Injectable()
export class TagAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(input: {
    user: AuthenticatedUser;
    storeId: string;
    body: CreateTagAlertRequest;
  }): Promise<TagAlert> {
    await assertStoreAccess(this.prisma, input.user, input.storeId);

    const store = await this.prisma.store.findUnique({
      where: { id: input.storeId },
      include: { map: true },
    });
    if (!store || store.deletedAt) throw new NotFoundException('Store not found');

    if (input.body.photoIds.length > 0) {
      const photos = await this.prisma.photo.findMany({
        where: { id: { in: input.body.photoIds } },
      });
      if (photos.length !== input.body.photoIds.length) {
        throw new BadRequestException('One or more photoIds are invalid');
      }
      for (const p of photos) {
        if (p.storeId !== input.storeId) {
          throw new BadRequestException(`Photo ${p.id} belongs to a different store`);
        }
        if (p.kind !== 'tag_alert') {
          throw new BadRequestException(`Photo ${p.id} is not a tag-alert photo`);
        }
      }
    }

    const tagAlert = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tagAlert.create({
        data: {
          storeId: input.storeId,
          raisedById: input.user.id,
          title: input.body.title,
          description: input.body.description,
          raisedAt: new Date(),
        },
      });

      if (input.body.photoIds.length > 0) {
        await tx.tagAlertPhoto.createMany({
          data: input.body.photoIds.map((photoId) => ({
            tagAlertId: created.id,
            photoId,
          })),
        });
      }

      // Enqueue email send. Worker picks it up out-of-band.
      const payload: TagAlertOutboxPayload = { tagAlertId: created.id };
      await tx.outboxItem.create({
        data: { kind: 'tag_alert_email', payload: payload as unknown as Prisma.InputJsonValue },
      });

      return created;
    });

    return this.toDto(tagAlert.id);
  }

  async listByMap(user: AuthenticatedUser, mapId: string): Promise<TagAlert[]> {
    await assertMapAccess(this.prisma, user, mapId);
    const alerts = await this.prisma.tagAlert.findMany({
      where: { store: { mapId } },
      orderBy: { raisedAt: 'desc' },
    });
    return Promise.all(alerts.map((a) => this.toDto(a.id)));
  }

  private async toDto(id: string): Promise<TagAlert> {
    const a = await this.prisma.tagAlert.findUniqueOrThrow({
      where: { id },
      include: {
        raisedBy: true,
        store: true,
        photos: { include: { photo: true } },
      },
    });
    return {
      id: a.id,
      storeId: a.storeId,
      mapId: a.store.mapId,
      raisedBy: a.raisedById,
      raisedByName: `${a.raisedBy.firstName} ${a.raisedBy.lastName}`.trim(),
      title: a.title,
      description: a.description,
      raisedAt: a.raisedAt.toISOString(),
      emailStatus: a.emailStatus,
      emailSentAt: a.emailSentAt?.toISOString() ?? null,
      photoIds: a.photos.map((p) => p.photoId),
    };
  }

  /** Full hydration for the email handler — includes signed photo URLs. */
  async loadForEmail(id: string): Promise<{
    alert: TagAlert;
    mapName: string;
    storeNumber: string;
    storeName: string;
    recipients: string[];
    photoUrls: string[];
  } | null> {
    const a = await this.prisma.tagAlert.findUnique({
      where: { id },
      include: {
        raisedBy: true,
        store: { include: { map: true } },
        photos: { include: { photo: true } },
      },
    });
    if (!a) return null;

    const photoUrls = await Promise.all(
      a.photos.map((tp) => this.storage.presignRead(tp.photo.objectKey, 60 * 60 * 24 * 7)),
    );

    return {
      alert: {
        id: a.id,
        storeId: a.storeId,
        mapId: a.store.mapId,
        raisedBy: a.raisedById,
        raisedByName: `${a.raisedBy.firstName} ${a.raisedBy.lastName}`.trim(),
        title: a.title,
        description: a.description,
        raisedAt: a.raisedAt.toISOString(),
        emailStatus: a.emailStatus,
        emailSentAt: a.emailSentAt?.toISOString() ?? null,
        photoIds: a.photos.map((p) => p.photoId),
      },
      mapName: a.store.map.name,
      storeNumber: a.store.storeNumber,
      storeName: a.store.storeName,
      recipients: a.store.map.tagAlertRecipients,
      photoUrls,
    };
  }

  async markEmailSent(id: string): Promise<void> {
    await this.prisma.tagAlert.update({
      where: { id },
      data: { emailStatus: 'sent', emailSentAt: new Date(), emailError: null },
    });
  }

  async markEmailFailed(id: string, error: string): Promise<void> {
    await this.prisma.tagAlert.update({
      where: { id },
      data: { emailStatus: 'failed', emailError: error },
    });
  }
}
