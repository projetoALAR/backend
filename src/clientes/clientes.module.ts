import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesExtracaoService } from './clientes-extracao.service';
import { ClientesController } from './clientes.controller';
import { PrismaService } from '../prisma.service';
import { DocumentosModule } from '../documentos/documentos.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [DocumentosModule, ChatModule],
  controllers: [ClientesController],
  providers: [ClientesService, ClientesExtracaoService, PrismaService],
})
export class ClientesModule {}
