import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function swaggerHabilitado(): boolean {
  if (process.env.SWAGGER_ENABLED === 'false') return false;
  if (process.env.SWAGGER_ENABLED === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

export function criarDocumentoOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Alar API')
    .setDescription(
      'API REST do Alar — gestão jurídica (clientes, casos, documentos, chat IA, busca global). Rotas de negócio em /v1. Health em /health.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT',
    )
    .addTag('Sistema', 'Health check e utilitários')
    .addTag('Auth', 'Login, registro e 2FA')
    .addTag('Clientes', 'Cadastro e LGPD')
    .addTag('Processos', 'Casos, timeline e comentários')
    .addTag('Documentos', 'Upload e URLs assinadas')
    .addTag('Chat', 'Conversas e mensagens com IA')
    .addTag('Busca', 'Busca global')
    .addTag('Dashboard', 'Resumo e métricas')
    .addTag('Equipe', 'Usuários e papéis')
    .addTag('Notificações', 'Inbox e preferências')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function configurarSwagger(app: INestApplication): void {
  if (!swaggerHabilitado()) return;

  const document = criarDocumentoOpenApi(app);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Alar API — Documentação',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
    },
  });
}
