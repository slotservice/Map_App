import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import {
  ErrorCode,
  type AuthUser,
  type LoginRequest,
  type LoginResponse,
  type TokenPair,
  type UserRole,
} from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(input: LoginRequest): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (user.status === 'blocked') {
      throw new UnauthorizedException(ErrorCode.ACCOUNT_BLOCKED);
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };

    return { user: authUser, tokens };
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    const tokenHash = sha256(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.user.deletedAt ||
      stored.user.status === 'blocked'
    ) {
      throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);
    }

    // Rotate: revoke the old, issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException(ErrorCode.OLD_PASSWORD_MISMATCH);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalidate all sessions on password change.
    await this.revokeAll(userId);
  }

  // ---- internal ------------------------------------------------------------

  private async issueTokens(userId: string, email: string, role: UserRole): Promise<TokenPair> {
    const accessTtl = this.config.getOrThrow<number>('JWT_ACCESS_TTL');
    const refreshTtl = this.config.getOrThrow<number>('JWT_REFRESH_TTL');

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      { expiresIn: `${accessTtl}s` },
    );

    const refreshRaw = randomBytes(48).toString('base64url');
    const refreshHash = sha256(refreshRaw);
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: refreshHash, expiresAt },
    });

    return { accessToken, refreshToken: refreshRaw, expiresIn: accessTtl };
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
