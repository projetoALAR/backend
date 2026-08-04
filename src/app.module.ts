import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ClientesModule } from './clientes/clientes.module';
import { ProcessosModule } from './processos/processos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CompromissosModule } from './compromissos/compromissos.module';
import { DocumentosModule } from './documentos/documentos.module';
import { EquipeModule } from './equipe/equipe.module';
import { PreferenciasModule } from './preferencias/preferencias.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ClientesModule,
    ProcessosModule,
    DashboardModule,
    CompromissosModule,
    DocumentosModule,
    EquipeModule,
    PreferenciasModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
