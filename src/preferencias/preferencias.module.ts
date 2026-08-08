import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';
import { PrismaService } from '../prisma.service';
import { DocumentosModule } from '../documentos/documentos.module';

@Module({
  imports: [
    DocumentosModule,
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [PreferenciasController],
  providers: [PreferenciasService, PrismaService],
  exports: [PreferenciasService],
})
export class PreferenciasModule {}
