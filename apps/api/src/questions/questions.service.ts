import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateQuestionRequest,
  type Question,
  type UpdateQuestionRequest,
} from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { assertMapAccess } from '../common/access.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByMap(user: AuthenticatedUser, mapId: string): Promise<Question[]> {
    await assertMapAccess(this.prisma, user, mapId);
    const rows = await this.prisma.question.findMany({
      where: { mapId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    actorId: string,
    mapId: string,
    body: CreateQuestionRequest,
  ): Promise<Question> {
    const map = await this.prisma.map.findUnique({ where: { id: mapId } });
    if (!map || map.deletedAt) throw new NotFoundException('Map not found');

    const created = await this.prisma.question.create({
      data: { mapId, title: body.title },
    });
    await this.audit.record({
      actorId,
      action: 'question.create',
      resourceType: 'question',
      resourceId: created.id,
      payload: { mapId, title: body.title },
    });
    return this.toDto(created);
  }

  async update(
    actorId: string,
    id: string,
    body: UpdateQuestionRequest,
  ): Promise<Question> {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Question not found');

    const updated = await this.prisma.question.update({
      where: { id },
      data: { title: body.title },
    });
    await this.audit.record({
      actorId,
      action: 'question.update',
      resourceType: 'question',
      resourceId: id,
      payload: body as Record<string, unknown>,
    });
    return this.toDto(updated);
  }

  async softDelete(actorId: string, id: string): Promise<void> {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException('Question not found');

    await this.prisma.question.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      action: 'question.soft_delete',
      resourceType: 'question',
      resourceId: id,
    });
  }

  private toDto(q: {
    id: string;
    mapId: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }): Question {
    return {
      id: q.id,
      mapId: q.mapId,
      title: q.title,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    };
  }
}
