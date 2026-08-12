import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { PrismaService } from '../prisma.service';
import { DocumentosModule } from '../documentos/documentos.module';

@Module({
  imports: [DocumentosModule],
  controllers: [ClientesController],
  providers: [ClientesService, PrismaService],
})
export class ClientesModule {}
