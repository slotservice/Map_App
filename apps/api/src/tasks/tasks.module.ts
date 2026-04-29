import { Module, NotImplementedException } from '@nestjs/common';
import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { completeStoreRequestSchema, type CompleteStoreRequest } from '@map-app/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller()
class TasksController {
  /** TODO(week-2): assemble Completion + CompletionCount + link photos. */
  @Post('stores/:storeId/complete')
  complete(
    @Param('storeId', ParseUUIDPipe) _storeId: string,
    @Body(new ZodValidationPipe(completeStoreRequestSchema)) _body: CompleteStoreRequest,
  ): Promise<void> {
    throw new NotImplementedException('completion endpoint — week 2');
  }
}

@Module({ controllers: [TasksController] })
export class TasksModule {}
