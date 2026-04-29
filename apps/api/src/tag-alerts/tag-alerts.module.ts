import { Body, Controller, Module, NotImplementedException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createTagAlertRequestSchema, type CreateTagAlertRequest } from '@map-app/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('tag-alerts')
@ApiBearerAuth()
@Controller()
class TagAlertsController {
  /** TODO(week-3): create TagAlert + outbox row → email worker delivers via Postmark. */
  @Post('stores/:storeId/tag-alerts')
  create(
    @Param('storeId', ParseUUIDPipe) _storeId: string,
    @Body(new ZodValidationPipe(createTagAlertRequestSchema)) _body: CreateTagAlertRequest,
  ): Promise<void> {
    throw new NotImplementedException('tag-alert endpoint — week 3');
  }
}

@Module({ controllers: [TagAlertsController] })
export class TagAlertsModule {}
