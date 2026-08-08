import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ModelosDocumentoController } from './modelos-documento.controller';
import { ModelosDocumentoService } from './modelos-documento.service';

@Module({
  controllers: [ModelosDocumentoController],
  providers: [ModelosDocumentoService, PrismaService],
  exports: [ModelosDocumentoService],
})
export class ModelosDocumentoModule {}
