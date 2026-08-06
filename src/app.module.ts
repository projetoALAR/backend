import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ClientesModule } from './clientes/clientes.module';
import { ProcessosModule } from './processos/processos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CompromissosModule } from './compromissos/compromissos.module';
import { DocumentosModule } from './documentos/documentos.module';
import { EquipeModule } from './equipe/equipe.module';
import { PreferenciasModule } from './preferencias/preferencias.module';
import { ChatModule } from './chat/chat.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { PrismaService } from './prisma.service';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    AuthModule,
    ClientesModule,
    ProcessosModule,
    DashboardModule,
    CompromissosModule,
    DocumentosModule,
    EquipeModule,
    PreferenciasModule,
    ChatModule,
    NotificacoesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
