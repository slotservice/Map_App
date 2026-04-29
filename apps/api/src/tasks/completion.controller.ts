import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  completeStoreRequestSchema,
  type CompleteStoreRequest,
  type Completion,
} from '@map-app/shared';

import { CompletionService } from './completion.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('completion')
@ApiBearerAuth()
@Controller('stores')
export class CompletionController {
  constructor(private readonly completion: CompletionService) {}

  @Post(':id/complete')
  @HttpCode(HttpStatus.CREATED)
  complete(
    @Param('id', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(completeStoreRequestSchema)) body: CompleteStoreRequest,
  ): Promise<Completion> {
    return this.completion.complete({ user, storeId, body });
  }

  @Get(':id/completion')
  read(
    @Param('id', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Completion | null> {
    return this.completion.readByStore(user, storeId);
  }
}
