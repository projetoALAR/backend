import { Module } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { ProcessosController } from './processos.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProcessosController],
  providers: [ProcessosService, PrismaService], // Injetamos o PrismaService aqui!
})
export class ProcessosModule {}