import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditWriteInput {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget writer. Audit writes never block the caller's
   * critical path, and a failed audit insert never propagates an error
   * back to the user — but it does log so we can spot patterns.
   */
  async record(input: AuditWriteInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          payload: input.payload ?? {},
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit entry ${input.action}`, err as Error);
    }
  }

  async list(filter: {
    actorId?: string;
    resourceType?: string;
    resourceId?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    items: Array<{
      id: string;
      actorId: string | null;
      actorEmail: string | null;
      action: string;
      resourceType: string;
      resourceId: string | null;
      payload: unknown;
      at: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where = {
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
      ...(filter.resourceType ? { resourceType: filter.resourceType } : {}),
      ...(filter.resourceId ? { resourceId: filter.resourceId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { at: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Hydrate actor email in one extra query (no N+1).
    const actorIds = Array.from(
      new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x)),
    );
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailById = new Map(actors.map((a) => [a.id, a.email]));

    return {
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorEmail: r.actorId ? emailById.get(r.actorId) ?? null : null,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        payload: r.payload,
        at: r.at.toISOString(),
      })),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }
}
