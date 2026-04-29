import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type FinalizePhotoRequest,
  type Photo,
  type PhotoKind,
  type PresignUploadRequest,
  type PresignUploadResponse,
} from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { assertStoreAccess } from '../common/access.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async presignUpload(
    user: AuthenticatedUser,
    storeId: string,
    input: PresignUploadRequest,
  ): Promise<PresignUploadResponse> {
    await assertStoreAccess(this.prisma, user, storeId);
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.deletedAt) throw new NotFoundException('Store not found');

    const id = randomUUID();
    const ext = extFromContentType(input.contentType);
    const objectKey = `${store.mapId}/${storeId}/${id}.${ext}`;

    await this.prisma.photo.create({
      data: {
        id,
        storeId,
        kind: input.kind,
        fieldName: input.fieldName ?? null,
        objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        sha256: 'pending',
        uploadedById: user.id,
      },
    });

    const presigned = await this.storage.presignUpload(
      objectKey,
      input.contentType,
      input.sizeBytes,
    );

    return {
      photoId: id,
      uploadUrl: presigned.url,
      headers: presigned.headers,
      expiresIn: 900,
    };
  }

  async finalize(photoId: string, input: FinalizePhotoRequest): Promise<void> {
    await this.prisma.photo.update({
      where: { id: photoId },
      data: { sha256: input.sha256, finalizedAt: new Date() },
    });
  }

  async listByStore(
    user: AuthenticatedUser,
    storeId: string,
    kind?: PhotoKind,
  ): Promise<Photo[]> {
    await assertStoreAccess(this.prisma, user, storeId);
    const photos = await this.prisma.photo.findMany({
      where: {
        storeId,
        finalizedAt: { not: null },
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        storeId: p.storeId,
        completionId: p.completionId,
        kind: p.kind,
        fieldName: p.fieldName,
        url: await this.storage.presignRead(p.objectKey),
        contentType: p.contentType,
        sizeBytes: p.sizeBytes,
        uploadedBy: p.uploadedById,
        uploadedAt: p.createdAt.toISOString(),
      })),
    );
  }

  /**
   * Delete a photo. Allowed only if it isn't yet linked to a completion
   * (workers can rearrange before-photos before pressing Complete) and
   * the user uploaded it.
   */
  async delete(photoId: string, userId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.completionId) {
      throw new BadRequestException('Photo is already part of a completed visit');
    }
    if (photo.uploadedById !== userId) {
      throw new ForbiddenException("Cannot delete another user's photo");
    }
    await this.prisma.photo.delete({ where: { id: photoId } });
    // Object intentionally left in storage; lifecycle policy reaps orphans.
  }
}

function extFromContentType(ct: string): string {
  const m = ct.toLowerCase().match(/^image\/(png|jpe?g|webp|heic)$/);
  return m ? (m[1] === 'jpeg' ? 'jpg' : (m[1] ?? 'bin')) : 'bin';
}
