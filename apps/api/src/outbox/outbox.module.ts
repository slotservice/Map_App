import { Module } from '@nestjs/common';
import { TagAlertsModule } from '../tag-alerts/tag-alerts.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { OutboxWorker } from './outbox.worker.js';
import { TagAlertEmailHandler } from './handlers/tag-alert-email.handler.js';
import { PasswordResetEmailHandler } from './handlers/password-reset-email.handler.js';
import { ExpoPushHandler } from './handlers/expo-push.handler.js';

@Module({
  imports: [TagAlertsModule, DevicesModule],
  providers: [OutboxWorker, TagAlertEmailHandler, PasswordResetEmailHandler, ExpoPushHandler],
})
export class OutboxModule {}
