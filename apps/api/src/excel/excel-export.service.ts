import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Build a "completed stores" workbook for a given map.
 *
 * Headers: Store #, Store Name, State, Address, Zip, Latitude, Longitude,
 * <task columns…>, <count columns…>, Completed_At_UTC, Completed_At_Local,
 * Completed_By, Completed_By_Email, General_Comments, Signature_URL,
 * Before_Photo_URLs, After_Photo_URLs.
 *
 * General_Comments and the count columns being present are the fixes for
 * legacy bugs L2 and L9 respectively.
 */
@Injectable()
export class ExcelExportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCompletedWorkbook(mapId: string): Promise<{ buffer: Buffer; filename: string }> {
    const map = await this.prisma.map.findUnique({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');

    const taskColumns = (map.taskColumns as string[]) ?? [];
    const countColumns = (map.countColumns as string[]) ?? [];

    // TODO(week-2): pull completed stores with completion + counts + photos.
    // For now just build the empty header row so the download works end-to-end.
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(map.name.slice(0, 31));
    const headers = [
      'Store_#',
      'Store_Name',
      'State',
      'Address',
      'Zip',
      'Latitude',
      'Longitude',
      ...taskColumns,
      ...countColumns,
      'Completed_At_UTC',
      'Completed_At_Local',
      'Completed_By',
      'Completed_By_Email',
      'General_Comments',
      'Signature_URL',
      'Before_Photo_URLs',
      'After_Photo_URLs',
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const safeName = map.name.replace(/[^a-z0-9_-]+/gi, '_');
    const date = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `${safeName}_completion_${date}.xlsx` };
  }
}
