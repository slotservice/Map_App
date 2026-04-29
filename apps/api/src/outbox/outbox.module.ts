import { Module } from '@nestjs/common';
import { TagAlertsModule } from '../tag-alerts/tag-alerts.module.js';
import { OutboxWorker } from './outbox.worker.js';
import { TagAlertEmailHandler } from './handlers/tag-alert-email.handler.js';
import { PasswordResetEmailHandler } from './handlers/password-reset-email.handler.js';

@Module({
  imports: [TagAlertsModule],
  providers: [OutboxWorker, TagAlertEmailHandler, PasswordResetEmailHandler],
})
export class OutboxModule {}
