import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller.js';
import { MapsService } from './maps.service.js';

@Module({
  controllers: [MapsController],
  providers: [MapsService],
  exports: [MapsService],
})
export class MapsModule {}
