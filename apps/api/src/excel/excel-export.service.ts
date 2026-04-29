import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { formatInTimeZone } from './format-time.js';

/**
 * Build a "completed stores" workbook for a given map.
 *
 * General_Comments + count columns being populated is the fix for legacy
 * bugs L2 and L9. Date/time formatting is locale-aware in the device's
 * timezone (fixes L5: legacy hardcoded `H:i A` mixed 24-hour and AM/PM).
 */
@Injectable()
export class ExcelExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async buildCompletedWorkbook(mapId: string): Promise<{ buffer: Buffer; filename: string }> {
    const map = await this.prisma.map.findUnique({ where: { id: mapId } });
    if (!map) throw new NotFoundException('Map not found');

    const taskColumns = (map.taskColumns as string[]) ?? [];
    const countColumns = (map.countColumns as string[]) ?? [];

    const stores = await this.prisma.store.findMany({
      where: { mapId, deletedAt: null },
      include: {
        tasks: true,
        completions: {
          orderBy: { completedAt: 'desc' },
          take: 1,
          include: {
            completedBy: { select: { email: true, firstName: true, lastName: true } },
            counts: true,
            signaturePhoto: { select: { objectKey: true } },
            photos: { select: { id: true, kind: true, objectKey: true } },
          },
        },
      },
      orderBy: { storeNumber: 'asc' },
    });

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

    for (const s of stores) {
      const completion = s.completions[0];
      if (!completion) continue;

      const taskMap = new Map(s.tasks.map((t) => [t.taskName, t.currentStatus]));
      const countMap = new Map(completion.counts.map((c) => [c.countName, c.value]));

      const completedUtc = completion.completedAt.toISOString();
      const completedLocal = formatInTimeZone(completion.completedAt, completion.deviceTimezone);

      const beforeUrls = await Promise.all(
        completion.photos
          .filter((p) => p.kind === 'before')
          .map((p) => this.storage.presignRead(p.objectKey, 60 * 60 * 24 * 7)),
      );
      const afterUrls = await Promise.all(
        completion.photos
          .filter((p) => p.kind === 'after')
          .map((p) => this.storage.presignRead(p.objectKey, 60 * 60 * 24 * 7)),
      );
      const signatureUrl = completion.signaturePhoto
        ? await this.storage.presignRead(completion.signaturePhoto.objectKey, 60 * 60 * 24 * 7)
        : '';

      const row = [
        s.storeNumber,
        s.storeName,
        s.state ?? '',
        s.address ?? '',
        s.zip ?? '',
        Number(s.latitude.toString()),
        Number(s.longitude.toString()),
        ...taskColumns.map((t) => taskMap.get(t) ?? ''),
        ...countColumns.map((c) => countMap.get(c) ?? ''),
        completedUtc,
        completedLocal,
        `${completion.completedBy.firstName} ${completion.completedBy.lastName}`.trim(),
        completion.completedBy.email,
        completion.generalComments,
        signatureUrl,
        beforeUrls.join('; '),
        afterUrls.join('; '),
      ];
      sheet.addRow(row);
    }

    sheet.columns.forEach((col) => {
      col.width = Math.max(12, Math.min(40, (col.header?.toString().length ?? 12) + 2));
    });

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const safeName = map.name.replace(/[^a-z0-9_-]+/gi, '_');
    const date = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `${safeName}_completion_${date}.xlsx` };
  }
}

