import { Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import {
  type CreateUserRequest,
  type UpdateUserRequest,
  type User,
  UserRole,
} from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(role?: UserRole): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(role ? { role } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toUser);
  }

  async create(
    actorId: string,
    input: CreateUserRequest,
  ): Promise<{ user: User; initialPassword: string }> {
    const password = input.initialPassword ?? randomBytes(8).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        address: input.address ?? null,
        state: input.state ?? null,
        zip: input.zip ?? null,
        role: input.role,
        passwordHash,
      },
    });

    await this.audit.record({
      actorId,
      action: 'user.create',
      resourceType: 'user',
      resourceId: created.id,
      payload: { email: created.email, role: created.role },
    });

    return { user: toUser(created), initialPassword: password };
  }

  async update(actorId: string, id: string, input: UpdateUserRequest): Promise<User> {
    await this.assertExists(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: input,
    });
    await this.audit.record({
      actorId,
      action: 'user.update',
      resourceType: 'user',
      resourceId: id,
      payload: input as Record<string, unknown>,
    });
    return toUser(updated);
  }

  async resetPassword(
    actorId: string,
    id: string,
    override?: string,
  ): Promise<{ newPassword: string }> {
    await this.assertExists(id);
    const newPassword = override ?? randomBytes(8).toString('base64url');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      action: 'user.reset_password',
      resourceType: 'user',
      resourceId: id,
    });
    return { newPassword };
  }

  async softDelete(actorId: string, id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'blocked' },
    });
    await this.audit.record({
      actorId,
      action: 'user.soft_delete',
      resourceType: 'user',
      resourceId: id,
    });
  }

  private async assertExists(id: string): Promise<void> {
    const found = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('User not found');
  }
}

function toUser(row: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  state: string | null;
  zip: string | null;
  role: UserRole;
  status: 'active' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    address: row.address,
    state: row.state,
    zip: row.zip,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
