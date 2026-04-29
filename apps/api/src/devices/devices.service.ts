import { Injectable } from '@nestjs/common';
import type { RegisterDeviceRequest } from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Push-notification device registry. The mobile app registers its
 * expo-notifications token after login and deregisters on logout.
 *
 * If the same pushToken is already registered to a different user (the
 * common case is a shared phone where worker A logged out and worker B
 * logged in), we re-attach to the new user — pushTokens are unique on
 * the table.
 */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, input: RegisterDeviceRequest): Promise<{ id: string }> {
    const row = await this.prisma.deviceToken.upsert({
      where: { pushToken: input.pushToken },
      create: {
        userId,
        pushToken: input.pushToken,
        platform: input.platform,
        label: input.label ?? null,
      },
      update: {
        userId,
        platform: input.platform,
        label: input.label ?? null,
        lastSeenAt: new Date(),
      },
    });
    return { id: row.id };
  }

  async deregister(userId: string, pushToken: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, pushToken },
    });
  }

  /**
   * Tokens to push to for a given user. Used by the outbox handler.
   */
  async tokensForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { pushToken: true },
    });
    return rows.map((r) => r.pushToken);
  }
}
