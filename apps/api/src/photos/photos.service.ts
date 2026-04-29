import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type FinalizePhotoRequest,
  type PresignUploadRequest,
  type PresignUploadResponse,
} from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async presignUpload(
    storeId: string,
    userId: string,
    input: PresignUploadRequest,
  ): Promise<PresignUploadResponse> {
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
        sha256: 'pending', // overwritten by finalize
        uploadedById: userId,
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
}

function extFromContentType(ct: string): string {
  const m = ct.toLowerCase().match(/^image\/(png|jpe?g|webp|heic)$/);
  return m ? (m[1] === 'jpeg' ? 'jpg' : (m[1] ?? 'bin')) : 'bin';
}
