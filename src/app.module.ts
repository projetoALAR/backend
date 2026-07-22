import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
  providers: [AppService],
})
export class AppModule {}
