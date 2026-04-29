import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type Map as MapDto,
  type MapSummary,
  type UpdateMapRequest,
  UserRole,
} from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class MapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
        stores: { select: { _count: { select: { completions: true } } } },
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
      completedStoreCount: m.stores.filter((s) => s._count.completions > 0).length,
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

    return this.toDto(map);
  }

  async update(actorId: string, id: string, input: UpdateMapRequest): Promise<MapDto> {
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
    await this.audit.record({
      actorId,
      action: 'map.update',
      resourceType: 'map',
      resourceId: id,
      payload: input as Record<string, unknown>,
    });
    return this.toDto(updated);
  }

  async softDelete(actorId: string, id: string): Promise<void> {
    await this.prisma.map.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      action: 'map.soft_delete',
      resourceType: 'map',
      resourceId: id,
    });
  }

  async assign(actorId: string, mapId: string, userId: string, role: UserRole): Promise<void> {
    const map = await this.prisma.map.findUnique({
      where: { id: mapId },
      select: { name: true },
    });

    await this.prisma.mapAssignment.upsert({
      where: { mapId_userId: { mapId, userId } },
      create: { mapId, userId, assignedRole: role },
      update: { assignedRole: role },
    });
    await this.audit.record({
      actorId,
      action: 'map.assign',
      resourceType: 'map',
      resourceId: mapId,
      payload: { userId, role },
    });

    // Push notification: only fires for workers (vendors/viewers don't
    // use the mobile app). Best-effort — if the user has no devices
    // registered, the handler logs and returns successfully.
    if (role === UserRole.WORKER && map) {
      await this.prisma.outboxItem.create({
        data: {
          kind: 'push_notification',
          payload: {
            userId,
            title: 'New map assigned',
            body: `You've been assigned to "${map.name}".`,
            data: { mapId, deepLink: `mapapp://maps/${mapId}` },
          },
        },
      });
    }
  }

  async unassign(actorId: string, mapId: string, userId: string): Promise<void> {
    await this.prisma.mapAssignment.deleteMany({ where: { mapId, userId } });
    await this.audit.record({
      actorId,
      action: 'map.unassign',
      resourceType: 'map',
      resourceId: mapId,
      payload: { userId },
    });
  }

  async listAssignments(
    mapId: string,
    role?: UserRole,
  ): Promise<Array<{ userId: string; email: string; firstName: string; lastName: string; role: UserRole }>> {
    const rows = await this.prisma.mapAssignment.findMany({
      where: { mapId, ...(role ? { assignedRole: role } : {}) },
      include: { user: true },
    });
    return rows.map((r) => ({
      userId: r.user.id,
      email: r.user.email,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      role: r.assignedRole,
    }));
  }

  private toDto(map: {
    id: string;
    name: string;
    sourceFilename: string | null;
    taskColumns: unknown;
    countColumns: unknown;
    tagAlertRecipients: string[];
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }): MapDto {
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
}
