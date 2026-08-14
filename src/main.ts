import './instrument';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configurarHttpApp } from './app.setup';
import { configurarSwagger, swaggerHabilitado } from './swagger';

function parseCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw || raw === '*') {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return true;
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet(swaggerHabilitado() ? { contentSecurityPolicy: false } : undefined),
  );
  configurarHttpApp(app);

  const origins = parseCorsOrigins();
  if (origins === false) {
    logger.warn(
      'CORS desabilitado: defina CORS_ORIGINS em produção (ex.: https://app.alar.com.br)',
    );
  }
  app.enableCors({
    origin: origins === false ? false : origins,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  configurarSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`API Alar ouvindo na porta ${port}`);
  if (swaggerHabilitado()) {
    logger.log(`Swagger disponível em http://localhost:${port}/docs`);
  }
  if (process.env.SENTRY_DSN?.trim()) {
    logger.log('Sentry habilitado');
  } else {
    logger.log('Sentry desligado (defina SENTRY_DSN para ativar)');
  }
}
void bootstrap();
