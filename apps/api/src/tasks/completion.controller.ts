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
  adminCompleteStoreRequestSchema,
  completeStoreRequestSchema,
  type AdminCompleteStoreRequest,
  type CompleteStoreRequest,
  type Completion,
  UserRole,
} from '@map-app/shared';

import { CompletionService } from './completion.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
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

  @Roles(UserRole.ADMIN)
  @Post(':id/admin-complete')
  @HttpCode(HttpStatus.CREATED)
  adminComplete(
    @Param('id', ParseUUIDPipe) storeId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(adminCompleteStoreRequestSchema))
    body: AdminCompleteStoreRequest,
  ): Promise<Completion> {
    return this.completion.adminComplete({ actor, storeId, body });
  }

  @Get(':id/completion')
  read(
    @Param('id', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Completion | null> {
    return this.completion.readByStore(user, storeId);
  }
}
