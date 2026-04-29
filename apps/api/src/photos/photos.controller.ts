import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  finalizePhotoRequestSchema,
  presignUploadRequestSchema,
  type FinalizePhotoRequest,
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

  @Post('photos/:id/finalize')
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(finalizePhotoRequestSchema)) body: FinalizePhotoRequest,
  ): Promise<void> {
    return this.photos.finalize(id, body);
  }
}
