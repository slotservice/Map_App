import { Module } from '@nestjs/common';
import { ExcelImportService } from './excel-import.service.js';
import { ExcelExportService } from './excel-export.service.js';
import { ExcelController } from './excel.controller.js';

@Module({
  controllers: [ExcelController],
  providers: [ExcelImportService, ExcelExportService],
  exports: [ExcelImportService, ExcelExportService],
})
export class ExcelModule {}
