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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(role?: UserRole): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(role ? { role } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toUser);
  }

  async create(input: CreateUserRequest): Promise<{ user: User; initialPassword: string }> {
    const password = input.initialPassword ?? randomBytes(8).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        role: input.role,
        passwordHash,
      },
    });

    return { user: toUser(created), initialPassword: password };
  }

  async update(id: string, input: UpdateUserRequest): Promise<User> {
    await this.assertExists(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: input,
    });
    return toUser(updated);
  }

  async resetPassword(id: string, override?: string): Promise<{ newPassword: string }> {
    await this.assertExists(id);
    const newPassword = override ?? randomBytes(8).toString('base64url');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { newPassword };
  }

  async softDelete(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'blocked' },
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
