import { Body, Controller, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  passwordResetConfirmRequestSchema,
  refreshTokenRequestSchema,
  updateProfileRequestSchema,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  type LoginResponse,
  type PasswordResetConfirmRequest,
  type RefreshTokenRequest,
  type TokenPair,
  type UpdateProfileRequest,
  type User,
} from '@map-app/shared';

import { AuthService } from './auth.service.js';
import { Public } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema)) body: RefreshTokenRequest,
  ): Promise<TokenPair> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.revokeAll(user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
  ): Promise<void> {
    await this.auth.changePassword(user.id, body.oldPassword, body.newPassword);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<User> {
    return this.auth.updateProfile(user.id, body);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema)) body: ForgotPasswordRequest,
  ): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(passwordResetConfirmRequestSchema))
    body: PasswordResetConfirmRequest,
  ): Promise<void> {
    await this.auth.confirmPasswordReset(body.token, body.newPassword);
  }
}
