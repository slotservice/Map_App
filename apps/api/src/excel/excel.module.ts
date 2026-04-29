import { Controller, Get, Module, NotImplementedException, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@map-app/shared';

@ApiTags('excel')
@ApiBearerAuth()
@Controller('maps')
class ExcelController {
  /**
   * TODO(week-1): parse uploaded Excel → create Map + Stores + StoreTasks.
   * Header detection: column 0=store_number, 1=store_name, 2..=fixed
   * (state, address, zip, lat, lon, type, manager, regional, notes) +
   * task columns (suffix "Task") + count columns (numeric).
   */
  @Roles(UserRole.ADMIN)
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() _file: Express.Multer.File): Promise<{ mapId: string }> {
    throw new NotImplementedException('Excel import — week 1');
  }

  /**
   * TODO(week-2): assemble completed-stores workbook with all original
   * columns + completion metadata + general_comments (fixes legacy L2).
   */
  @Get(':id/excel')
  download(@Param('id', ParseUUIDPipe) _id: string): Promise<void> {
    throw new NotImplementedException('Excel download — week 2');
  }
}

@Module({ controllers: [ExcelController] })
export class ExcelModule {}
