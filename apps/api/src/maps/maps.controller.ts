import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  mapAssignmentSchema,
  updateMapRequestSchema,
  UserRole,
  type Map as MapDto,
  type MapAssignment,
  type MapSummary,
  type UpdateMapRequest,
} from '@map-app/shared';

import { MapsService } from './maps.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('maps')
@ApiBearerAuth()
@Controller('maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<MapSummary[]> {
    return this.maps.listForUser(user);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MapDto> {
    return this.maps.findById(user, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMapRequestSchema)) body: UpdateMapRequest,
  ): Promise<MapDto> {
    return this.maps.update(id, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.maps.softDelete(id);
  }

  @Get(':id/assignments')
  @Roles(UserRole.ADMIN)
  listAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('role') role?: UserRole,
  ): Promise<Array<{ userId: string; email: string; firstName: string; lastName: string; role: UserRole }>> {
    return this.maps.listAssignments(id, role);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/assignments')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(mapAssignmentSchema)) body: MapAssignment,
  ): Promise<void> {
    await this.maps.assign(id, body.userId, body.role);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id/assignments/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.maps.unassign(id, userId);
  }
}
