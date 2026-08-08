import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { AndamentosController } from './andamentos.controller';
import { AndamentosService } from './andamentos.service';
import { AndamentosSyncScheduler } from './andamentos-sync.scheduler';
import { ANDAMENTOS_PROVIDER } from './andamentos-provider';
import { DatajudService } from './datajud.service';

@Module({
  imports: [NotificacoesModule],
  controllers: [AndamentosController],
  providers: [
    AndamentosService,
    DatajudService,
    {
      // Trocar o useClass aqui para migrar a Jusbrasil/Escavador/Judit.io
      provide: ANDAMENTOS_PROVIDER,
      useExisting: DatajudService,
    },
    AndamentosSyncScheduler,
    PrismaService,
  ],
  exports: [AndamentosService],
})
export class AndamentosModule implements OnModuleInit {
  private readonly logger = new Logger(AndamentosModule.name);

  onModuleInit() {
    this.logger.warn(
      'DataJud habilitado — uso restrito a fins não comerciais conforme Termo de Uso do CNJ. Substituir por provider comercial (Jusbrasil/Escavador/Judit.io) antes de qualquer lançamento comercial.',
    );
  }
}
