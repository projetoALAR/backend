import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function swaggerHabilitado(): boolean {
  if (process.env.SWAGGER_ENABLED === 'false') return false;
  if (process.env.SWAGGER_ENABLED === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

export function configurarSwagger(app: INestApplication): void {
  if (!swaggerHabilitado()) return;

  const config = new DocumentBuilder()
    .setTitle('Alar API')
    .setDescription(
      'API REST do Alar — gestão jurídica (clientes, casos, documentos, chat IA, busca global).',
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Alar API — Documentação',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
    },
  });
}
