import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  registerDeviceRequestSchema,
  type RegisterDeviceRequest,
} from '@map-app/shared';

import { DevicesService } from './devices.service.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerDeviceRequestSchema)) body: RegisterDeviceRequest,
  ): Promise<void> {
    await this.devices.register(user.id, body);
  }

  @Delete(':pushToken')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deregister(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pushToken') pushToken: string,
  ): Promise<void> {
    await this.devices.deregister(user.id, decodeURIComponent(pushToken));
  }
}
