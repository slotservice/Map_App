import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@map-app/shared';

export const ROLES_KEY = 'roles';

/**
 * Restrict a controller / handler to one or more roles.
 * Use together with {@link RolesGuard} (registered globally inside AuthModule).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Mark an endpoint as fully public (skips JwtAuthGuard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
