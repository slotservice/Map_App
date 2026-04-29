import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { z } from 'zod';

import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { MapsModule } from './maps/maps.module.js';
import { StoresModule } from './stores/stores.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { PhotosModule } from './photos/photos.module.js';
import { TagAlertsModule } from './tag-alerts/tag-alerts.module.js';
import { ExcelModule } from './excel/excel.module.js';
import { HealthModule } from './health/health.module.js';
import { StorageModule } from './storage/storage.module.js';
import { EmailModule } from './email/email.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { AuditModule } from './audit/audit.module.js';
import { DevicesModule } from './devices/devices.module.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_PUBLIC_URL: z.string().url(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().min(1),
  CORS_ORIGINS: z.string().default(''),
  ADMIN_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    StorageModule,
    EmailModule,
    AuditModule,
    AuthModule,
    UsersModule,
    MapsModule,
    StoresModule,
    TasksModule,
    PhotosModule,
    TagAlertsModule,
    ExcelModule,
    HealthModule,
    OutboxModule,
    AuditModule,
    DevicesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
