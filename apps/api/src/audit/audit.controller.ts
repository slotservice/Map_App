import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@map-app/shared';
import { AuditService } from './audit.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.audit.list({
      actorId,
      resourceType,
      resourceId,
      from: parseDateOrUndefined(from),
      to: parseDateOrUndefined(to),
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(200, Math.max(1, Number(pageSize) || 50)),
    });
  }
}

function parseDateOrUndefined(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
