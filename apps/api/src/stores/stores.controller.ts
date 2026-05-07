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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createStoreRequestSchema,
  finalizePhotoRequestSchema,
  presignUploadRequestSchema,
  updateStoreRequestSchema,
  type CreateStoreRequest,
  type FinalizePhotoRequest,
  type PresignUploadRequest,
  type PresignUploadResponse,
  type Store,
  type UpdateStoreRequest,
  UserRole,
} from '@map-app/shared';
import { StoresService } from './stores.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

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

  @Roles(UserRole.ADMIN)
  @Post('stores/:id/property-image')
  presignPropertyImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(presignUploadRequestSchema)) body: PresignUploadRequest,
  ): Promise<PresignUploadResponse> {
    // `kind` in the shared DTO is informational here — the service
    // always stamps `property_view` so admins can't, eg, sneak a
    // 'before' photo onto an unrelated store.
    return this.stores.presignPropertyImageUpload(user, id, body);
  }

  @Roles(UserRole.ADMIN)
  @Post('stores/:id/property-image/:photoId/finalize')
  @HttpCode(HttpStatus.NO_CONTENT)
  finalizePropertyImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body(new ZodValidationPipe(finalizePhotoRequestSchema)) body: FinalizePhotoRequest,
  ): Promise<void> {
    return this.stores.finalizePropertyImage(id, photoId, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete('stores/:id/property-image')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearPropertyImage(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.stores.clearPropertyImage(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('maps/:mapId/stores')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Body(new ZodValidationPipe(createStoreRequestSchema)) body: CreateStoreRequest,
  ): Promise<Store> {
    return this.stores.create(actor.id, mapId, body);
  }

  @Roles(UserRole.ADMIN)
  @Patch('stores/:id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateStoreRequestSchema)) body: UpdateStoreRequest,
  ): Promise<Store> {
    return this.stores.update(actor.id, id, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete('stores/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.stores.softDelete(actor.id, id);
  }
}
