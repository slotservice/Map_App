import { Module } from '@nestjs/common';
import { TagAlertsController } from './tag-alerts.controller.js';
import { TagAlertsService } from './tag-alerts.service.js';

@Module({
  controllers: [TagAlertsController],
  providers: [TagAlertsService],
  exports: [TagAlertsService],
})
export class TagAlertsModule {}
