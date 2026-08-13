import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import {
  ANDAMENTOS_PROVIDER,
  AndamentoProviderMovimento,
} from './andamentos-provider';
import type { AndamentosProvider } from './andamentos-provider';
import { resolverTribunalSigla } from './datajud-tribunal.util';
import { explicarMovimento } from './movimento-glossario.util';
import { isAndamentoManual } from './andamento-origem.util';
import type { CreateAndamentoManualDto } from './andamentos.dto';

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

    const andamentos = await this.prisma.andamento.findMany({
      where: { processoId },
      orderBy: { data: 'desc' },
    });

    return andamentos.map((a) => ({
      ...a,
      explicacao: explicarMovimento(a.codigoMovimento, a.descricao),
      manual: isAndamentoManual(a.origem),
    }));
  }

  async criarManual(
    processoId: string,
    dados: CreateAndamentoManualDto,
    atorId?: string,
  ) {
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: { id: true },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const descricao = dados.descricao.trim();
    if (!descricao) {
      throw new BadRequestException('Descrição obrigatória');
    }

    const criado = await this.prisma.andamento.create({
      data: {
        processoId,
        data: this.parseDataAndamento(dados.data),
        descricao,
        codigoMovimento: null,
        origem: {
          tipo: 'manual',
          usuarioId: atorId ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ...criado,
      explicacao: explicarMovimento(criado.codigoMovimento, criado.descricao),
      manual: true,
    };
  }

  async removerManual(processoId: string, andamentoId: string) {
    const andamento = await this.prisma.andamento.findFirst({
      where: { id: andamentoId, processoId },
    });
    if (!andamento) {
      throw new NotFoundException('Andamento não encontrado');
    }
    if (!isAndamentoManual(andamento.origem)) {
      throw new ForbiddenException(
        'Só é possível excluir andamentos lançados pela equipe',
      );
    }
    await this.prisma.andamento.delete({ where: { id: andamento.id } });
    return {
      ...andamento,
      explicacao: explicarMovimento(
        andamento.codigoMovimento,
        andamento.descricao,
      ),
      manual: true,
    };
  }

  private parseDataAndamento(valor?: string): Date {
    if (!valor?.trim()) return new Date();
    const s = valor.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(`${s}T12:00:00`);
    }
    const data = new Date(s);
    if (Number.isNaN(data.getTime())) {
      throw new BadRequestException('Data inválida');
    }
    return data;
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
        `/casos/${processo.id}`,
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
