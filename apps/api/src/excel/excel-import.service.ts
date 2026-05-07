import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { TaskStatus } from '@map-app/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Excel → Map + Stores + StoreTasks importer.
 *
 * Header layout (mirrors legacy convention so existing client spreadsheets work):
 *   col 0     "Store" or "Store #"  → store_number (text, preserves leading zeros)
 *   col 1     "Store Name"          → store_name
 *   col 2..N  free-form headers; each is classified into one of:
 *     • Known fixed columns (case-insensitive): state, address, zip,
 *       latitude, longitude, type, manager, regional, notes
 *     • Task columns: header ends with "Task" → StoreTask row.
 *       Value "Needs Scheduled" maps to needs_scheduled, anything else
 *       to scheduled_or_complete (initialStatus = currentStatus on import).
 *     • Count columns: everything else; recorded in Map.countColumns
 *       and surfaced on the worker's store-detail screen.
 *
 * Latitude + Longitude are required (we need them to render the map).
 * Empty columns (header missing) are skipped.
 *
 * The full original row is stashed in Store.raw so nothing is ever lost.
 */
@Injectable()
export class ExcelImportService {
  private readonly logger = new Logger(ExcelImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async importMap(input: {
    name: string;
    fileBuffer: Buffer;
    fileName: string;
    createdById: string;
  }): Promise<{ mapId: string; storeCount: number; taskColumns: string[]; countColumns: string[] }> {
    const wb = new ExcelJS.Workbook();
    try {
      // exceljs typings predate the generic Buffer<T> in @types/node ≥ 22,
      // so a structural cast won't satisfy them. Pass through `any`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(input.fileBuffer as any);
    } catch (err) {
      throw new BadRequestException(
        `Could not read Excel file: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    const sheet = wb.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new BadRequestException('Excel file has no data rows');
    }

    const headers = readHeaders(sheet);
    const layout = classifyHeaders(headers);
    if (layout.errors.length > 0) {
      throw new BadRequestException(layout.errors.join('; '));
    }

    const rows: ParsedRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, idx) => {
      if (idx === 1) return;
      const parsed = parseRow(row, headers, layout, idx);
      if (parsed) rows.push(parsed);
    });

    if (rows.length === 0) {
      throw new BadRequestException('Excel file has no usable rows');
    }

    // Default Prisma interactive-transaction timeout is 5s. Importing
    // hundreds of stores (each row = 1 store insert + N storeTask inserts)
    // can exceed that easily under concurrent load (e.g. tests running in
    // parallel). Bump explicitly so a 1000-row import has headroom.
    const map = await this.prisma.$transaction(
      async (tx) => {
      const created = await tx.map.create({
        data: {
          name: input.name,
          sourceFilename: input.fileName,
          taskColumns: layout.taskColumns,
          countColumns: layout.countColumns,
          createdById: input.createdById,
        },
      });

      for (const row of rows) {
        const store = await tx.store.create({
          data: {
            mapId: created.id,
            storeNumber: row.storeNumber,
            storeName: row.storeName,
            state: row.fixed.state ?? null,
            address: row.fixed.address ?? null,
            zip: row.fixed.zip ?? null,
            latitude: row.fixed.latitude!, // validated in parseRow
            longitude: row.fixed.longitude!,
            type: row.fixed.type ?? null,
            manager: row.fixed.manager ?? null,
            regional: row.fixed.regional ?? null,
            notes: row.fixed.notes ?? null,
            raw: row.raw as Prisma.InputJsonValue,
          },
        });

        if (layout.taskColumns.length > 0) {
          await tx.storeTask.createMany({
            data: layout.taskColumns.map((taskName) => {
              const value = (row.tasks[taskName] ?? '').trim();
              const status =
                value.toLowerCase() === 'needs scheduled'
                  ? TaskStatus.NEEDS_SCHEDULED
                  : TaskStatus.SCHEDULED_OR_COMPLETE;
              return {
                storeId: store.id,
                taskName,
                initialStatus: status,
                currentStatus: status,
              };
            }),
          });
        }
      }

      return created;
      },
      // 60s ceiling, 30s soft timeout — enough for ~thousands of rows
      // and well clear of the realistic 161-row case under load.
      { timeout: 60_000, maxWait: 30_000 },
    );

    this.logger.log(
      `Imported map "${input.name}" (${map.id}): ${rows.length} stores, ` +
        `${layout.taskColumns.length} task col(s), ${layout.countColumns.length} count col(s)`,
    );

    await this.audit.record({
      actorId: input.createdById,
      action: 'map.create',
      resourceType: 'map',
      resourceId: map.id,
      payload: {
        name: input.name,
        sourceFilename: input.fileName,
        storeCount: rows.length,
        taskColumns: layout.taskColumns,
        countColumns: layout.countColumns,
      },
    });

    return {
      mapId: map.id,
      storeCount: rows.length,
      taskColumns: layout.taskColumns,
      countColumns: layout.countColumns,
    };
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit testing
// ---------------------------------------------------------------------------

interface HeaderLayout {
  taskColumns: string[];
  countColumns: string[];
  fixedColumnIndex: Partial<Record<FixedKey, number>>;
  taskColumnIndex: Record<string, number>;
  countColumnIndex: Record<string, number>;
  errors: string[];
}

type FixedKey =
  | 'state'
  | 'address'
  | 'zip'
  | 'latitude'
  | 'longitude'
  | 'type'
  | 'manager'
  | 'regional'
  | 'notes';

const FIXED_KEYS: Record<string, FixedKey> = {
  state: 'state',
  address: 'address',
  zip: 'zip',
  latitude: 'latitude',
  longitude: 'longitude',
  type: 'type',
  manager: 'manager',
  regional: 'regional',
  notes: 'notes',
};

interface ParsedRow {
  storeNumber: string;
  storeName: string;
  fixed: {
    state?: string;
    address?: string;
    zip?: string;
    type?: string;
    manager?: string;
    regional?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
  };
  tasks: Record<string, string>;
  raw: Record<string, unknown>;
}

export function readHeaders(sheet: ExcelJS.Worksheet): string[] {
  const row = sheet.getRow(1);
  const headers: string[] = [];
  const cellCount = Math.max(row.cellCount, row.actualCellCount);
  for (let c = 1; c <= cellCount; c++) {
    const cell = row.getCell(c);
    headers.push(cellTextValue(cell).trim());
  }
  return headers;
}

export function classifyHeaders(headers: string[]): HeaderLayout {
  const errors: string[] = [];
  const layout: HeaderLayout = {
    taskColumns: [],
    countColumns: [],
    fixedColumnIndex: {},
    taskColumnIndex: {},
    countColumnIndex: {},
    errors,
  };

  if (headers.length < 2) {
    errors.push('Excel needs at least Store + Store Name columns');
    return layout;
  }

  const col0 = headers[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  const col1 = headers[1]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  if (col0 !== 'store' && col0 !== 'storeid' && col0 !== 'storenumber') {
    errors.push(`Column A must be "Store" or "Store #" (got "${headers[0] ?? ''}")`);
  }
  // Accept either "Store Name" or just "Name" — Matt's real client
  // sheets ("Caseys Test 2.xlsx", "Week 1 2026.xlsx") use plain "Name"
  // while the older "C Dilbeck Stores.xlsx" uses "Store Name".
  if (col1 !== 'storename' && col1 !== 'name') {
    errors.push(`Column B must be "Store Name" or "Name" (got "${headers[1] ?? ''}")`);
  }

  for (let i = 2; i < headers.length; i++) {
    const original = headers[i];
    if (!original || original.trim() === '') continue;
    const normalised = original.trim();
    const lower = normalised.toLowerCase();
    const fixed = FIXED_KEYS[lower];
    if (fixed) {
      layout.fixedColumnIndex[fixed] = i;
      continue;
    }
    if (/task$/i.test(lower)) {
      const key = normalised.replace(/\s+/g, '_');
      layout.taskColumns.push(key);
      layout.taskColumnIndex[key] = i;
    } else {
      const key = normalised.replace(/\s+/g, '_');
      layout.countColumns.push(key);
      layout.countColumnIndex[key] = i;
    }
  }

  if (layout.fixedColumnIndex.latitude === undefined) {
    errors.push('Latitude column is required');
  }
  if (layout.fixedColumnIndex.longitude === undefined) {
    errors.push('Longitude column is required');
  }

  return layout;
}

function parseRow(
  row: ExcelJS.Row,
  headers: string[],
  layout: HeaderLayout,
  rowNumber: number,
): ParsedRow | null {
  const storeNumberCell = row.getCell(1);
  const storeNameCell = row.getCell(2);

  const storeNumber = cellTextValue(storeNumberCell).trim();
  const storeName = cellTextValue(storeNameCell).trim();
  if (!storeNumber && !storeName) return null;
  if (!storeNumber) {
    throw new BadRequestException(`Row ${rowNumber}: missing Store #`);
  }
  if (!storeName) {
    throw new BadRequestException(`Row ${rowNumber}: missing Store Name`);
  }

  const fixed: ParsedRow['fixed'] = {};
  for (const [k, idx] of Object.entries(layout.fixedColumnIndex)) {
    const cell = row.getCell(idx! + 1);
    const text = cellTextValue(cell).trim();
    if (k === 'latitude' || k === 'longitude') {
      const num = Number(text);
      if (!Number.isFinite(num)) {
        throw new BadRequestException(`Row ${rowNumber}: ${k} must be a number (got "${text}")`);
      }
      fixed[k] = num;
    } else if (k === 'zip') {
      fixed.zip = text || undefined;
    } else {
      (fixed as Record<string, string | undefined>)[k] = text || undefined;
    }
  }

  const tasks: Record<string, string> = {};
  for (const [taskName, idx] of Object.entries(layout.taskColumnIndex)) {
    tasks[taskName] = cellTextValue(row.getCell(idx + 1)).trim();
  }

  const raw: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.trim();
    if (!h) continue;
    const cell = row.getCell(i + 1);
    raw[h.replace(/\s+/g, '_')] = cellRawValue(cell);
  }

  return { storeNumber, storeName, fixed, tasks, raw };
}

function cellTextValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text ?? '');
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as { result?: unknown }).result;
    return r === undefined || r === null ? '' : String(r);
  }
  if (typeof v === 'object' && 'richText' in v) {
    const rt = (v as { richText: Array<{ text: string }> }).richText;
    return rt.map((part) => part.text).join('');
  }
  return String(v);
}

function cellRawValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'richText' in v) {
    return (v as { richText: Array<{ text: string }> }).richText.map((p) => p.text).join('');
  }
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text ?? '');
  if (typeof v === 'object' && 'result' in v) {
    return (v as { result?: unknown }).result ?? null;
  }
  return v;
}
