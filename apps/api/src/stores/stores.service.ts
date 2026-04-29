import { Injectable, NotFoundException } from '@nestjs/common';
import { MarkerColor, type Store, TaskStatus } from '@map-app/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listByMap(mapId: string): Promise<Store[]> {
    const stores = await this.prisma.store.findMany({
      where: { mapId, deletedAt: null },
      orderBy: { storeNumber: 'asc' },
      include: { tasks: true, completions: { take: 1, orderBy: { completedAt: 'desc' } } },
    });
    return stores.map((s) => this.toStore(s));
  }

  async findById(id: string): Promise<Store> {
    const s = await this.prisma.store.findUnique({
      where: { id },
      include: { tasks: true, completions: { take: 1, orderBy: { completedAt: 'desc' } } },
    });
    if (!s || s.deletedAt) throw new NotFoundException('Store not found');
    return this.toStore(s);
  }

  // Computed marker colour. See REBUILD_PLAN Appendix E.
  private computeMarker(
    tasks: Array<{ initialStatus: TaskStatus; currentStatus: TaskStatus }>,
    hasCompletion: boolean,
  ): MarkerColor {
    if (tasks.length === 0) return MarkerColor.BLUE;
    const allComplete = tasks.every((t) => t.currentStatus === TaskStatus.SCHEDULED_OR_COMPLETE);
    if (allComplete && hasCompletion) return MarkerColor.RED;

    const allInitiallyNeedsScheduled = tasks.every(
      (t) => t.initialStatus === TaskStatus.NEEDS_SCHEDULED,
    );
    if (allInitiallyNeedsScheduled) {
      const anyCompletedThisVisit = tasks.some(
        (t) =>
          t.currentStatus === TaskStatus.SCHEDULED_OR_COMPLETE &&
          t.initialStatus === TaskStatus.NEEDS_SCHEDULED,
      );
      return anyCompletedThisVisit ? MarkerColor.YELLOW : MarkerColor.BLUE;
    }
    return MarkerColor.ORANGE;
  }

  private toStore(s: {
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
    completions: Array<{ id: string }>;
    createdAt: Date;
    updatedAt: Date;
  }): Store {
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
      propertyImageUrl: s.propertyImageKey, // TODO: sign URL — week 1 hardening
      tasks: s.tasks.map((t) => ({
        name: t.taskName,
        initialStatus: t.initialStatus,
        currentStatus: t.currentStatus,
      })),
      counts: {}, // TODO: populate from latest completion in week 2
      markerColor: this.computeMarker(s.tasks, s.completions.length > 0),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
