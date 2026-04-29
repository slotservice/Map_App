import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  finalizePhotoRequestSchema,
  presignUploadRequestSchema,
  type FinalizePhotoRequest,
  type PresignUploadRequest,
  type PresignUploadResponse,
  type Store,
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
}
