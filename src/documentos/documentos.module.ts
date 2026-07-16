import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentosService } from './documentos.service';
import { DocumentosController } from './documentos.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    // Isso prepara o NestJS para processar arquivos em memória
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
    }),
  ],
  controllers: [DocumentosController],
  providers: [DocumentosService, PrismaService],
})
export class DocumentosModule {}