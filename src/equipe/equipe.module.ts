import { Module } from '@nestjs/common';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EquipeController],
  providers: [EquipeService, PrismaService],
})
export class EquipeModule {}
