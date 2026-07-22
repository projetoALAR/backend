import { Module } from '@nestjs/common';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PreferenciasController],
  providers: [PreferenciasService, PrismaService],
})
export class PreferenciasModule {}
