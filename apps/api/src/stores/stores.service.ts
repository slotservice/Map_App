import { Injectable, NotFoundException } from '@nestjs/common';
import {
  computeMarkerColor,
  type FinalizePhotoRequest,
  type PresignUploadRequest,
  type PresignUploadResponse,
  type Store,
  TaskStatus,
} from '@map-app/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { assertMapAccess, assertStoreAccess } from '../common/access.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listByMap(user: AuthenticatedUser, mapId: string): Promise<Store[]> {
    await assertMapAccess(this.prisma, user, mapId);
    const stores = await this.prisma.store.findMany({
      where: { mapId, deletedAt: null },
      orderBy: { storeNumber: 'asc' },
      include: {
        tasks: true,
        completions: {
          take: 1,
          orderBy: { completedAt: 'desc' },
          include: { counts: true },
        },
      },
    });
    return Promise.all(stores.map((s) => this.toStore(s)));
  }

  async findById(user: AuthenticatedUser, id: string): Promise<Store> {
    await assertStoreAccess(this.prisma, user, id);
    const s = await this.prisma.store.findUnique({
      where: { id },
      include: {
        tasks: true,
        completions: {
          take: 1,
          orderBy: { completedAt: 'desc' },
          include: { counts: true },
        },
      },
    });
    if (!s || s.deletedAt) throw new NotFoundException('Store not found');
    return this.toStore(s);
  }

  /**
   * Presign an admin-only upload of the per-store property-view image.
   * Replaces (and resigns) any existing key. The actual switch happens
   * in `finalizePropertyImage` once the client confirms the PUT succeeded.
   */
  async presignPropertyImageUpload(
    user: AuthenticatedUser,
    storeId: string,
    input: PresignUploadRequest,
  ): Promise<PresignUploadResponse> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.deletedAt) throw new NotFoundException('Store not found');

    const id = randomUUID();
    const ext = extFromContentType(input.contentType);
    const objectKey = `${store.mapId}/${storeId}/property-${id}.${ext}`;
    const presigned = await this.storage.presignUpload(
      objectKey,
      input.contentType,
      input.sizeBytes,
    );

    // Track the staged upload as a Photo row so the rest of the pipeline
    // (finalize, signed-URL minting, lifecycle cleanup) works the same way
    // as worker-uploaded photos. completionId stays null — property images
    // are not tied to a single visit.
    await this.prisma.photo.create({
      data: {
        id,
        storeId,
        kind: 'property_view',
        objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        sha256: 'pending',
        uploadedById: user.id,
      },
    });

    return {
      photoId: id,
      uploadUrl: presigned.url,
      headers: presigned.headers,
      expiresIn: 900,
    };
  }

  async finalizePropertyImage(
    storeId: string,
    photoId: string,
    body: FinalizePhotoRequest,
  ): Promise<void> {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || photo.storeId !== storeId || photo.kind !== 'property_view') {
      throw new NotFoundException('Property image upload not found');
    }
    await this.prisma.$transaction([
      this.prisma.photo.update({
        where: { id: photoId },
        data: { sha256: body.sha256, finalizedAt: new Date() },
      }),
      this.prisma.store.update({
        where: { id: storeId },
        data: { propertyImageKey: photo.objectKey },
      }),
    ]);
  }

  async clearPropertyImage(storeId: string): Promise<void> {
    await this.prisma.store.update({
      where: { id: storeId },
      data: { propertyImageKey: null },
    });
    // Object intentionally retained in storage; lifecycle reaps orphans.
  }

  // Marker colour delegates to the shared pure function so the API and
  // any future client renderer agree on the state machine. See
  // REBUILD_PLAN Appendix E.

  private async toStore(s: {
    id: string;
    mapId: string;
    storeNumber: string;
    storeName: string;
    state: string | null;
    address: string | null;
    zip: string | null;
    latitude: { toString(): string };
    longitude: { toString(): string };
    type: string | null;
    manager: string | null;
    regional: string | null;
    notes: string | null;
    propertyImageKey: string | null;
    tasks: Array<{
      taskName: string;
      initialStatus: TaskStatus;
      currentStatus: TaskStatus;
    }>;
    completions: Array<{ id: string; counts: Array<{ countName: string; value: number }> }>;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<Store> {
    const counts: Record<string, number> = {};
    if (s.completions[0]) {
      for (const c of s.completions[0].counts) counts[c.countName] = c.value;
    }
    const propertyImageUrl = s.propertyImageKey
      ? await this.storage.presignRead(s.propertyImageKey, 60 * 60)
      : null;

    return {
      id: s.id,
      mapId: s.mapId,
      storeNumber: s.storeNumber,
      storeName: s.storeName,
      state: s.state,
      address: s.address,
      zip: s.zip,
      latitude: Number(s.latitude.toString()),
      longitude: Number(s.longitude.toString()),
      type: s.type,
      manager: s.manager,
      regional: s.regional,
      notes: s.notes,
      propertyImageUrl,
      tasks: s.tasks.map((t) => ({
        name: t.taskName,
        initialStatus: t.initialStatus,
        currentStatus: t.currentStatus,
      })),
      counts,
      markerColor: computeMarkerColor({
        tasks: s.tasks,
        hasCompletion: s.completions.length > 0,
      }),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}

function extFromContentType(ct: string): string {
  const m = ct.toLowerCase().match(/^image\/(png|jpe?g|webp|heic)$/);
  return m ? (m[1] === 'jpeg' ? 'jpg' : (m[1] ?? 'bin')) : 'bin';
}
