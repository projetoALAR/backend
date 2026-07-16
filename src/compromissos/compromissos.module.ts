import { Module } from '@nestjs/common';
import { CompromissosService } from './compromissos.service';
import { CompromissosController } from './compromissos.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CompromissosController],
  providers: [CompromissosService, PrismaService],
})
export class CompromissosModule {}