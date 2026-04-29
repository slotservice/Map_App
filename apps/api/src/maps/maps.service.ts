import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type Map as MapDto,
  type MapSummary,
  type UpdateMapRequest,
  UserRole,
} from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the list of maps visible to the requester.
   * The vendor-sees-all-maps legacy bug (L1) is fixed by construction here:
   * non-admin roles ALWAYS go through the assignment join.
   */
  async listForUser(user: AuthenticatedUser): Promise<MapSummary[]> {
    const where =
      user.role === UserRole.ADMIN
        ? { deletedAt: null, archivedAt: null }
        : {
            deletedAt: null,
            archivedAt: null,
            assignments: { some: { userId: user.id } },
          };

    const maps = await this.prisma.map.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { stores: true, assignments: true } },
      },
    });

    return maps.map((m) => ({
      id: m.id,
      name: m.name,
      sourceFilename: m.sourceFilename,
      taskColumns: (m.taskColumns as string[]) ?? [],
      countColumns: (m.countColumns as string[]) ?? [],
      tagAlertRecipients: m.tagAlertRecipients,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      archivedAt: m.archivedAt?.toISOString() ?? null,
      storeCount: m._count.stores,
      completedStoreCount: 0, // TODO: subquery; deferred to week-2
      assignedUserCount: m._count.assignments,
    }));
  }

  async findById(user: AuthenticatedUser, id: string): Promise<MapDto> {
    const map = await this.prisma.map.findUnique({
      where: { id },
      include: { assignments: { where: { userId: user.id }, select: { userId: true } } },
    });
    if (!map || map.deletedAt) throw new NotFoundException('Map not found');

    if (user.role !== UserRole.ADMIN && map.assignments.length === 0) {
      throw new ForbiddenException('Map not assigned to you');
    }

    return {
      id: map.id,
      name: map.name,
      sourceFilename: map.sourceFilename,
      taskColumns: (map.taskColumns as string[]) ?? [],
      countColumns: (map.countColumns as string[]) ?? [],
      tagAlertRecipients: map.tagAlertRecipients,
      createdAt: map.createdAt.toISOString(),
      updatedAt: map.updatedAt.toISOString(),
      archivedAt: map.archivedAt?.toISOString() ?? null,
    };
  }

  async update(id: string, input: UpdateMapRequest): Promise<MapDto> {
    const updated = await this.prisma.map.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.tagAlertRecipients !== undefined && {
          tagAlertRecipients: input.tagAlertRecipients,
        }),
        ...(input.archived !== undefined && {
          archivedAt: input.archived ? new Date() : null,
        }),
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      sourceFilename: updated.sourceFilename,
      taskColumns: (updated.taskColumns as string[]) ?? [],
      countColumns: (updated.countColumns as string[]) ?? [],
      tagAlertRecipients: updated.tagAlertRecipients,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      archivedAt: updated.archivedAt?.toISOString() ?? null,
    };
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.map.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async assign(mapId: string, userId: string, role: UserRole): Promise<void> {
    await this.prisma.mapAssignment.upsert({
      where: { mapId_userId: { mapId, userId } },
      create: { mapId, userId, assignedRole: role },
      update: { assignedRole: role },
    });
  }

  async unassign(mapId: string, userId: string): Promise<void> {
    await this.prisma.mapAssignment.deleteMany({ where: { mapId, userId } });
  }
}
