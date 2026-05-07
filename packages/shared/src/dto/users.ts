import { z } from 'zod';
import { UserRole, UserStatus } from '../enums.js';
import { phoneSchema } from './common.js';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: phoneSchema.nullable(),
  address: z.string().nullable(),
  state: z.string().max(20).nullable(),
  zip: z.string().max(20).nullable(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type User = z.infer<typeof userSchema>;

export const createUserRequestSchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: phoneSchema.optional(),
  address: z.string().max(255).optional(),
  state: z.string().max(20).optional(),
  zip: z.string().max(20).optional(),
  role: z.nativeEnum(UserRole),
  /**
   * Optional initial password. If omitted, a random one is generated and
   * returned in the response so admin can hand it to the user.
   */
  initialPassword: z.string().min(8).max(128).optional(),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: phoneSchema.optional(),
  address: z.string().max(255).optional(),
  state: z.string().max(20).optional(),
  zip: z.string().max(20).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

/**
 * Self-update of own profile. Subset of UpdateUserRequest — users
 * cannot rename themselves or flip their own status; admins do that
 * via the admin user endpoints.
 */
export const updateProfileRequestSchema = z.object({
  phone: phoneSchema.optional(),
  address: z.string().max(255).optional(),
  state: z.string().max(20).optional(),
  zip: z.string().max(20).optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  /** If omitted the API generates a random password. */
  newPassword: z.string().min(8).max(128).optional(),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
