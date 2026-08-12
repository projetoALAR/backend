import { Module } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { ProcessosController } from './processos.controller';
import { ProcessosTimelineService } from './processos-timeline.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [ProcessosController],
  providers: [ProcessosService, ProcessosTimelineService, PrismaService],
})
export class ProcessosModule {}
