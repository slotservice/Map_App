import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Store } from '@map-app/shared';
import { StoresService } from './stores.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';

@ApiTags('stores')
@ApiBearerAuth()
@Controller()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('maps/:mapId/stores')
  list(
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Store[]> {
    return this.stores.listByMap(user, mapId);
  }

  @Get('stores/:id')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Store> {
    return this.stores.findById(user, id);
  }
}
