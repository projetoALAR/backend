import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // <-- Importe o módulo
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientesModule } from './clientes/clientes.module';
import { ProcessosModule } from './processos/processos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CompromissosModule } from './compromissos/compromissos.module';
import { DocumentosModule } from './documentos/documentos.module';

@Module({
  imports: [
    // Carrega o .env e disponibiliza o process.env para todo o app
    ConfigModule.forRoot({ isGlobal: true }), 
    ClientesModule, ProcessosModule, DashboardModule, CompromissosModule, DocumentosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}