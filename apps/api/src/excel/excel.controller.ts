import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { UserRole } from '@map-app/shared';

import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ExcelImportService } from './excel-import.service.js';
import { ExcelExportService } from './excel-export.service.js';

const importBodySchema = z.object({ name: z.string().min(1).max(100) });

@ApiTags('excel')
@ApiBearerAuth()
@Controller('maps')
export class ExcelController {
  private readonly logger = new Logger(ExcelController.name);

  constructor(
    private readonly importer: ExcelImportService,
    private readonly exporter: ExcelExportService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['name', 'file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async importMap(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() raw: unknown,
  ): Promise<{ mapId: string; storeCount: number; taskColumns: string[]; countColumns: string[] }> {
    if (!file) throw new BadRequestException('Missing Excel file (multipart field "file")');
    const body = importBodySchema.parse(raw);

    try {
      return await this.importer.importMap({
        name: body.name,
        fileBuffer: file.buffer,
        fileName: file.originalname,
        createdById: user.id,
      });
    } catch (err) {
      // Surface import failures to server logs so we can diagnose without
      // having to ask the user to retry. The exception still propagates
      // and the filter returns it to the client unchanged.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Import "${body.name}" file="${file.originalname}" (${file.size}B) by ${user.email}: ${msg}`,
      );
      throw err;
    }
  }

  @Get(':id/excel')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async downloadCompleted(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.exporter.buildCompletedWorkbook(id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }
}
