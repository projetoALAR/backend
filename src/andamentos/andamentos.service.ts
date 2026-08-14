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
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';
import {
  ANDAMENTOS_PROVIDER,
  AndamentoProviderMovimento,
} from './andamentos-provider';
import type { AndamentosProvider } from './andamentos-provider';
import {
  formatarNumeroCnj,
  nomeTribunal,
  normalizarNumeroCnj,
  resolverTribunalSigla,
} from './datajud-tribunal.util';
import { explicarMovimento } from './movimento-glossario.util';
import { isAndamentoManual } from './andamento-origem.util';
import type { CreateAndamentoManualDto } from './andamentos.dto';

export type AndamentosConsultaSnapshot = {
  em: string;
  status: string;
  mensagem: string;
  tribunalSigla: string | null;
  tribunalNome: string | null;
  inseridos: number;
  jaExistentes: number;
  totalNaFonte: number;
  ultimoMovimento: { data: string; descricao: string } | null;
};

export type ResultadoSyncAndamentos = AndamentosConsultaSnapshot & {
  processoId: string;
  ok: boolean;
  motivo?: string;
};

export type MovimentoConsultaDto = {
  data: string;
  descricao: string;
  codigoMovimento: number | null;
  explicacao: string | null;
};

export type ResultadoConsultaPublica = {
  ok: boolean;
  numero: string | null;
  tribunalSigla: string | null;
  tribunalNome: string | null;
  motivo?: string;
  status: string;
  movimentos: MovimentoConsultaDto[];
  caso?: { id: string; titulo: string | null; numero: string } | null;
};

function mensagemConsulta(
  status: string,
  mensagem: string,
  sigla?: string | null,
) {
  const tribunal = nomeTribunal(sigla);
  switch (status) {
    case 'nao_encontrado':
      return tribunal
        ? `Processo não encontrado na base pública do CNJ (${tribunal}). Pode ser segredo de justiça, índice incompleto ou número com dígito errado.`
        : mensagem;
    case 'tribunal_nao_mapeado':
      return 'Este tribunal não tem índice público no DataJud (ex.: STF). Registre o andamento interno.';
    case 'sem_api_key':
      return 'Consulta ao CNJ não está configurada neste ambiente.';
    case 'cnj_invalido':
    case 'ok':
      return mensagem;
    default:
      return mensagem || 'Não foi possível consultar a base pública do CNJ.';
  }
}

@Injectable()
export class AndamentosService {
  private readonly logger = new Logger(AndamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ANDAMENTOS_PROVIDER)
    private readonly provider: AndamentosProvider,
    private readonly notificacoes: NotificacoesService,
    private readonly casoAcesso: CasoAcessoService,
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
        },
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
   * Consulta a base pública do CNJ sem gravar andamentos.
   * Uso não comercial (DataJud).
   */
  async consultarPublico(
    numeroInformado: string,
    user: CasoAcessoUser,
  ): Promise<ResultadoConsultaPublica> {
    const consulta = await this.provider.consultarPorNumero(numeroInformado);
    const digits = normalizarNumeroCnj(numeroInformado);
    const formatado = digits ? formatarNumeroCnj(digits) : null;
    const sigla =
      (consulta.ok ? consulta.tribunalSigla : null) ||
      (digits ? resolverTribunalSigla(digits) : null) ||
      null;
    const status = consulta.ok ? 'ok' : consulta.motivo;
    const mensagem = mensagemConsulta(
      status,
      consulta.ok
        ? `${consulta.movimentos.length} movimento(s) na base pública.`
        : consulta.mensagem,
      sigla,
    );

    const movimentos = consulta.ok
      ? [...consulta.movimentos]
          .sort((a, b) => b.data.getTime() - a.data.getTime())
          .slice(0, 30)
          .map((mov) => ({
            data: mov.data.toISOString(),
            descricao: mov.descricao,
            codigoMovimento: mov.codigoMovimento,
            explicacao: explicarMovimento(mov.codigoMovimento, mov.descricao),
          }))
      : [];

    return {
      ok: consulta.ok,
      numero: formatado,
      tribunalSigla: sigla,
      tribunalNome: nomeTribunal(sigla),
      status,
      motivo: consulta.ok ? undefined : mensagem,
      movimentos,
      caso: await this.encontrarCasoPorCnj(numeroInformado, user),
    };
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
      const snapshot = this.montarSnapshot({
        status: consulta.motivo,
        mensagem: consulta.mensagem,
        tribunalSigla: tribunalCache,
        inseridos: 0,
        jaExistentes: 0,
        totalNaFonte: 0,
        ultimo: null,
      });
      await this.salvarConsulta(processo.id, snapshot);
      return {
        processoId: processo.id,
        ok: false,
        motivo: snapshot.mensagem,
        ...snapshot,
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

    const ordenados = [...consulta.movimentos].sort(
      (a, b) => b.data.getTime() - a.data.getTime(),
    );
    const ultimo = ordenados[0] ?? null;
    const snapshot = this.montarSnapshot({
      status: 'ok',
      mensagem:
        inseridos > 0
          ? `${inseridos} andamento(s) novo(s) importado(s) da base pública.`
          : 'Nenhum andamento novo desde a última consulta.',
      tribunalSigla: siglaResolvida || tribunalCache,
      inseridos,
      jaExistentes: consulta.movimentos.length - inseridos,
      totalNaFonte: consulta.movimentos.length,
      ultimo,
    });
    await this.salvarConsulta(processo.id, snapshot);
    return { processoId: processo.id, ok: true, ...snapshot };
  }

  private montarSnapshot(params: {
    status: string;
    mensagem: string;
    tribunalSigla?: string | null;
    inseridos: number;
    jaExistentes: number;
    totalNaFonte: number;
    ultimo: AndamentoProviderMovimento | null;
  }): AndamentosConsultaSnapshot {
    const sigla = params.tribunalSigla ?? null;
    return {
      em: new Date().toISOString(),
      status: params.status,
      mensagem: mensagemConsulta(params.status, params.mensagem, sigla),
      tribunalSigla: sigla,
      tribunalNome: nomeTribunal(sigla),
      inseridos: params.inseridos,
      jaExistentes: params.jaExistentes,
      totalNaFonte: params.totalNaFonte,
      ultimoMovimento: params.ultimo
        ? {
            data: params.ultimo.data.toISOString(),
            descricao: params.ultimo.descricao,
          }
        : null,
    };
  }

  private async salvarConsulta(
    processoId: string,
    snapshot: AndamentosConsultaSnapshot,
  ) {
    await this.prisma.processo.update({
      where: { id: processoId },
      data: { andamentosConsulta: snapshot },
    });
  }

  private async encontrarCasoPorCnj(numero: string, user: CasoAcessoUser) {
    const digits = normalizarNumeroCnj(numero);
    if (!digits) return null;
    const formatado = formatarNumeroCnj(digits);
    const candidatos = [numero.trim(), digits, formatado].filter(
      (v): v is string => !!v,
    );
    const processo = await this.prisma.processo.findFirst({
      where: {
        AND: [
          this.casoAcesso.visibilidadeProcesso(user),
          { OR: candidatos.map((numero) => ({ numero })) },
        ],
      },
      select: { id: true, titulo: true, numero: true },
    });
    return processo;
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
