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
  createQuestionRequestSchema,
  updateQuestionRequestSchema,
  UserRole,
  type CreateQuestionRequest,
  type Question,
  type UpdateQuestionRequest,
} from '@map-app/shared';

import { QuestionsService } from './questions.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('questions')
@ApiBearerAuth()
@Controller()
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get('maps/:mapId/questions')
  list(
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Question[]> {
    return this.questions.listByMap(user, mapId);
  }

  @Roles(UserRole.ADMIN)
  @Post('maps/:mapId/questions')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Body(new ZodValidationPipe(createQuestionRequestSchema)) body: CreateQuestionRequest,
  ): Promise<Question> {
    return this.questions.create(actor.id, mapId, body);
  }

  @Roles(UserRole.ADMIN)
  @Patch('questions/:id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateQuestionRequestSchema)) body: UpdateQuestionRequest,
  ): Promise<Question> {
    return this.questions.update(actor.id, id, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete('questions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.questions.softDelete(actor.id, id);
  }
}
