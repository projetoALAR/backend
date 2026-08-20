import { Module } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { ProcessosController } from './processos.controller';
import { ProcessosTimelineService } from './processos-timeline.service';
import { ProcessosCapaService } from './processos-capa.service';
import { ProcessosRelatorioPdfService } from './processos-relatorio-pdf.service';
import { ProcessosTarefasService } from './processos-tarefas.service';
import { ProcessosTarefasController } from './processos-tarefas.controller';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [ProcessosController, ProcessosTarefasController],
  providers: [
    ProcessosService,
    ProcessosTimelineService,
    ProcessosCapaService,
    ProcessosRelatorioPdfService,
    ProcessosTarefasService,
    PrismaService,
  ],
})
export class ProcessosModule {}
