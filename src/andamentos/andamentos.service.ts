import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import {
  ANDAMENTOS_PROVIDER,
  AndamentoProviderMovimento,
} from './andamentos-provider';
import type { AndamentosProvider } from './andamentos-provider';
import { resolverTribunalSigla } from './datajud-tribunal.util';

export type ResultadoSyncAndamentos = {
  processoId: string;
  inseridos: number;
  motivo?: string;
};

@Injectable()
export class AndamentosService {
  private readonly logger = new Logger(AndamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ANDAMENTOS_PROVIDER)
    private readonly provider: AndamentosProvider,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listarPorProcesso(processoId: string) {
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: { id: true },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    return this.prisma.andamento.findMany({
      where: { processoId },
      orderBy: { data: 'desc' },
    });
  }

  /**
   * Busca andamentos no provider injetado e persiste os novos.
   * Trocar o provider (DataJud → comercial) não exige mudar schema nem este fluxo.
   */
  async sincronizarProcesso(
    processoId: string,
  ): Promise<ResultadoSyncAndamentos> {
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const tribunalCache =
      processo.tribunalSigla || resolverTribunalSigla(processo.numero);

    const consulta = await this.provider.consultarPorNumero(
      processo.numero,
      processo.tribunalSigla,
    );

    if (!consulta.ok) {
      this.logger.warn(
        `Sync andamentos ${processo.id}: ${consulta.motivo} — ${consulta.mensagem}`,
      );
      return {
        processoId: processo.id,
        inseridos: 0,
        motivo: consulta.mensagem,
      };
    }

    const siglaResolvida = consulta.tribunalSigla?.trim().toLowerCase();
    if (siglaResolvida && siglaResolvida !== processo.tribunalSigla) {
      await this.prisma.processo.update({
        where: { id: processo.id },
        data: { tribunalSigla: siglaResolvida },
      });
    } else if (!processo.tribunalSigla && tribunalCache) {
      await this.prisma.processo.update({
        where: { id: processo.id },
        data: { tribunalSigla: tribunalCache },
      });
    }

    const existentes = await this.prisma.andamento.findMany({
      where: { processoId: processo.id },
      select: { data: true, descricao: true, codigoMovimento: true },
    });
    const chaves = new Set(existentes.map((a) => this.chaveAndamento(a)));

    let inseridos = 0;
    for (const mov of consulta.movimentos) {
      const chave = this.chaveAndamento(mov);
      if (chaves.has(chave)) continue;

      await this.prisma.andamento.create({
        data: {
          processoId: processo.id,
          data: mov.data,
          descricao: mov.descricao,
          codigoMovimento: mov.codigoMovimento,
          origem: mov.origem as Prisma.InputJsonValue,
        },
      });
      chaves.add(chave);
      inseridos += 1;

      const quando = mov.data.toLocaleDateString('pt-BR');
      await this.notificacoes.notificarTodosUsuarios(
        'Novo andamento processual',
        `${processo.titulo || processo.numero}: ${mov.descricao} (${quando})`,
        `/tasks?caseId=${processo.id}`,
        'reminders',
        'andamento',
      );
    }

    return { processoId: processo.id, inseridos };
  }

  private chaveAndamento(
    a: Pick<
      AndamentoProviderMovimento,
      'data' | 'descricao' | 'codigoMovimento'
    >,
  ): string {
    const iso = a.data.toISOString();
    if (a.codigoMovimento != null) {
      return `${iso}|c:${a.codigoMovimento}|${a.descricao}`;
    }
    return `${iso}|${a.descricao}`;
  }
}
