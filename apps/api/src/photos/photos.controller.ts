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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  finalizePhotoRequestSchema,
  PhotoKind,
  presignUploadRequestSchema,
  type FinalizePhotoRequest,
  type Photo,
  type PresignUploadRequest,
  type PresignUploadResponse,
} from '@map-app/shared';

import { PhotosService } from './photos.service.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('photos')
@ApiBearerAuth()
@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post('stores/:storeId/photos')
  presignUpload(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(presignUploadRequestSchema)) body: PresignUploadRequest,
  ): Promise<PresignUploadResponse> {
    return this.photos.presignUpload(storeId, user.id, body);
  }

  @Get('stores/:storeId/photos')
  listByStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('kind') kind?: PhotoKind,
  ): Promise<Photo[]> {
    return this.photos.listByStore(storeId, kind);
  }

  @Post('photos/:id/finalize')
  @HttpCode(HttpStatus.NO_CONTENT)
  async finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(finalizePhotoRequestSchema)) body: FinalizePhotoRequest,
  ): Promise<void> {
    await this.photos.finalize(id, body);
  }

  @Delete('photos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.photos.delete(id, user.id);
  }
}
