import { Module } from '@nestjs/common';
import { BuscaController } from './busca.controller';
import { BuscaService } from './busca.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BuscaController],
  providers: [BuscaService, PrismaService],
})
export class BuscaModule {}
