import { z } from 'zod';
import { UserRole, UserStatus } from '../enums.js';

export const loginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const changePasswordRequestSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const loginResponseSchema = z.object({
  user: authUserSchema,
  tokens: tokenPairSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;
