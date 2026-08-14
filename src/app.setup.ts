import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';

/** Versão URI padrão: rotas passam a /v1/... */
export const API_DEFAULT_VERSION = '1';

export function configurarHttpApp(app: INestApplication) {
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_DEFAULT_VERSION,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
