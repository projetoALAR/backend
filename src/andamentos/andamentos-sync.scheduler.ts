import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { AndamentosService } from './andamentos.service';

@Injectable()
export class AndamentosSyncScheduler {
  private readonly logger = new Logger(AndamentosSyncScheduler.name);
  private emExecucao = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly andamentos: AndamentosService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async sincronizarProcessosAbertos() {
    if (this.emExecucao) {
      this.logger.warn('Sync DataJud já em execução — ignorando disparo');
      return;
    }
    this.emExecucao = true;
    this.logger.log('Iniciando sync diário de andamentos (DataJud)');

    try {
      const processos = await this.prisma.processo.findMany({
        where: { concluido: false },
        select: { id: true, numero: true },
      });

      let ok = 0;
      let falhas = 0;
      let inseridos = 0;

      for (const processo of processos) {
        try {
          const resultado = await this.andamentos.sincronizarProcesso(
            processo.id,
          );
          ok += 1;
          inseridos += resultado.inseridos;
        } catch (error) {
          falhas += 1;
          this.logger.error(
            `Falha ao sincronizar processo ${processo.id} (${processo.numero})`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      this.logger.log(
        `Sync DataJud concluído: ${ok} ok, ${falhas} falhas, ${inseridos} andamentos novos`,
      );
    } finally {
      this.emExecucao = false;
    }
  }
}
