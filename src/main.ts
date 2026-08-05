import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

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

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const origins = parseCorsOrigins();
  if (origins === false) {
    logger.warn(
      'CORS desabilitado: defina CORS_ORIGINS em produção (ex.: https://app.alar.com.br)',
    );
  }
  app.enableCors({
    origin: origins === false ? false : origins,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`API Alar ouvindo na porta ${port}`);
}
void bootstrap();
