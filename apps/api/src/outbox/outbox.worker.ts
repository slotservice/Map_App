import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { OutboxItem } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { TagAlertEmailHandler } from './handlers/tag-alert-email.handler.js';
import { PasswordResetEmailHandler } from './handlers/password-reset-email.handler.js';
import { ExpoPushHandler } from './handlers/expo-push.handler.js';

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 5;

interface OutboxHandler {
  readonly kind: string;
  process(item: OutboxItem): Promise<void>;
}

/**
 * Reliable async dispatcher. Producers (TagAlertsService etc.) insert
 * outbox_items rows in the same transaction as their domain writes; the
 * worker drains them with exponential backoff.
 *
 * We use Postgres advisory-style ordering rather than `FOR UPDATE SKIP
 * LOCKED` because we run a single worker instance — when we scale to
 * multiple replicas (Phase 3) this turns into the proper SKIP LOCKED
 * batch claim.
 */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private handlers: Map<string, OutboxHandler> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    tagAlertEmail: TagAlertEmailHandler,
    passwordResetEmail: PasswordResetEmailHandler,
    expoPush: ExpoPushHandler,
  ) {
    this.handlers.set(tagAlertEmail.kind, tagAlertEmail);
    this.handlers.set(passwordResetEmail.kind, passwordResetEmail);
    this.handlers.set(expoPush.kind, expoPush);
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // First tick on boot (helps tests + warm starts).
    setTimeout(() => void this.tick(), 1_000);
    this.logger.log(`Outbox worker started (poll every ${POLL_INTERVAL_MS}ms)`);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.outboxItem.findMany({
        where: { status: 'pending', scheduledAt: { lte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: BATCH_SIZE,
      });
      for (const item of due) {
        await this.processOne(item);
      }
    } catch (err) {
      this.logger.error('Outbox tick failed', err as Error);
    } finally {
      this.running = false;
    }
  }

  private async processOne(item: OutboxItem): Promise<void> {
    const handler = this.handlers.get(item.kind);

    // Claim the row.
    const claimed = await this.prisma.outboxItem.updateMany({
      where: { id: item.id, status: 'pending' },
      data: { status: 'processing', attempts: { increment: 1 } },
    });
    if (claimed.count === 0) return;

    if (!handler) {
      this.logger.warn(`No handler for outbox kind "${item.kind}" (id=${item.id})`);
      await this.prisma.outboxItem.update({
        where: { id: item.id },
        data: {
          status: 'failed',
          lastError: `Unknown kind: ${item.kind}`,
          processedAt: new Date(),
        },
      });
      return;
    }

    try {
      await handler.process(item);
      await this.prisma.outboxItem.update({
        where: { id: item.id },
        data: { status: 'done', processedAt: new Date(), lastError: null },
      });
    } catch (err) {
      const attempts = item.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Outbox ${item.kind}/${item.id} failed (attempt ${attempts}): ${message}`);

      if (attempts >= MAX_ATTEMPTS) {
        await this.prisma.outboxItem.update({
          where: { id: item.id },
          data: { status: 'failed', lastError: message, processedAt: new Date() },
        });
      } else {
        // Exponential backoff: 30s, 2m, 8m, 32m
        const backoffMs = 30_000 * Math.pow(4, attempts - 1);
        await this.prisma.outboxItem.update({
          where: { id: item.id },
          data: {
            status: 'pending',
            lastError: message,
            scheduledAt: new Date(Date.now() + backoffMs),
          },
        });
      }
    }
  }
}
