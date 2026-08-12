import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrazosReminderService } from './prazos-reminder.service';

@Injectable()
export class PrazosReminderScheduler {
  private readonly logger = new Logger(PrazosReminderScheduler.name);
  private emExecucao = false;

  constructor(private readonly prazos: PrazosReminderService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async executarDiario() {
    if (this.emExecucao) {
      this.logger.warn('Lembretes de prazo já em execução — ignorando disparo');
      return;
    }
    this.emExecucao = true;
    try {
      const res = await this.prazos.executar();
      this.logger.log(
        `Lembretes de prazo: ${res.enviados} enviados, ${res.ignorados} ignorados (dedup)`,
      );
    } catch (error) {
      this.logger.error(
        'Falha no job de lembretes de prazo',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.emExecucao = false;
    }
  }
}
