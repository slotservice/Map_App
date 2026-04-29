import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createTagAlertRequestSchema,
  type CreateTagAlertRequest,
  type TagAlert,
} from '@map-app/shared';

import { TagAlertsService } from './tag-alerts.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('tag-alerts')
@ApiBearerAuth()
@Controller()
export class TagAlertsController {
  constructor(private readonly service: TagAlertsService) {}

  @Post('stores/:storeId/tag-alerts')
  create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTagAlertRequestSchema)) body: CreateTagAlertRequest,
  ): Promise<TagAlert> {
    return this.service.create({ user, storeId, body });
  }

  @Get('maps/:mapId/tag-alerts')
  listByMap(
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TagAlert[]> {
    return this.service.listByMap(user, mapId);
  }
}
