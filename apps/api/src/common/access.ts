import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@map-app/shared';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './decorators/current-user.decorator.js';

/**
 * Reusable guard helpers — call these inline at the top of any service
 * method that touches map-scoped data. Admins always pass; everyone
 * else must have a row in `map_assignments` for this map.
 *
 * The vendor side of these checks is the second half of the legacy L1
 * fix: the controller-level `policy.guard` enforces "must be authenticated";
 * these enforce "must be assigned to this resource".
 */
export async function assertMapAccess(
  prisma: PrismaService,
  user: AuthenticatedUser,
  mapId: string,
): Promise<void> {
  if (user.role === UserRole.ADMIN) return;
  const assigned = await prisma.mapAssignment.findUnique({
    where: { mapId_userId: { mapId, userId: user.id } },
    select: { userId: true },
  });
  if (!assigned) {
    throw new ForbiddenException('You are not assigned to this map');
  }
}

export async function assertStoreAccess(
  prisma: PrismaService,
  user: AuthenticatedUser,
  storeId: string,
): Promise<{ mapId: string }> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { mapId: true, deletedAt: true },
  });
  if (!store || store.deletedAt) throw new NotFoundException('Store not found');
  await assertMapAccess(prisma, user, store.mapId);
  return { mapId: store.mapId };
}
