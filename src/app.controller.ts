import {
  Controller,
  Get,
  NotFoundException,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma.service';

@Controller({ version: VERSION_NEUTRAL })
@ApiTags('Sistema')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'alar-api',
        database: 'up',
        timestamp: new Date().toISOString(),
        sentry: Boolean(process.env.SENTRY_DSN?.trim()),
        smtp: Boolean(
          process.env.SMTP_HOST?.trim() &&
            process.env.SMTP_USER?.trim() &&
            process.env.SMTP_PASS?.trim(),
        ),
        appUrl: Boolean(process.env.APP_URL?.trim()),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        service: 'alar-api',
        database: 'down',
        timestamp: new Date().toISOString(),
        sentry: Boolean(process.env.SENTRY_DSN?.trim()),
      });
    }
  }

  /**
   * Dispara erro de teste no Sentry.
   * Só ativo com SENTRY_ENABLE_TEST_ENDPOINT=true (bloqueado em production).
   */
  @Public()
  @Get('debug/sentry')
  debugSentry() {
    if (process.env.SENTRY_ENABLE_TEST_ENDPOINT !== 'true') {
      throw new NotFoundException();
    }
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    const err = new Error('Alar API — erro de teste do Sentry');
    Sentry.captureException(err);
    throw err;
  }
}
