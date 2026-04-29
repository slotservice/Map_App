import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('healthz')
  healthz(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }

  @Public()
  @Get('readyz')
  async readyz(): Promise<{ status: 'ready' | 'unready'; db: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: true };
    } catch {
      return { status: 'unready', db: false };
    }
  }
}
