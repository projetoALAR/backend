import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import {
  CreateProcessoDto,
  PROCESSO_STATUS,
  UpdateProcessoDto,
} from './processos.dto';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';
import {
  CAMPOS_ALVO_PROCESSOS,
  linhasDeCsvProcessos,
  linhasDeTabelaProcessos,
  MODELO_CSV_PROCESSOS,
  normalizarStatusProcesso,
  parsearTagsCsv,
  sugerirColunaProcesso,
  type LinhaImportacaoProcesso,
} from './processos-importacao.util';
import {
  ehArquivoCsv,
  ehArquivoPlanilha,
  lerPlanilhaComoTabela,
  montarModeloProcessosXlsx,
} from '../importacao/planilha-importacao.util';
import {
  aplicarMapeamento,
  lerTabelaDeArquivo,
  montarPreview,
  type MapeamentoColunas,
  type PreviewImportacao,
  validarMapeamento,
} from '../importacao/importacao-mapeamento.util';

export const MAX_LINHAS_IMPORTACAO_PROCESSOS = 500;

export type ResultadoLinhaImportacaoProcesso = {
  linha: number;
  status: 'criado' | 'duplicado' | 'erro';
  numero?: string;
  titulo?: string;
  processoId?: string;
  clienteNome?: string;
  motivo?: string;
};

export type ResultadoImportacaoProcessos = {
  total: number;
  criados: number;
  duplicados: number;
  erros: number;
  resultados: ResultadoLinhaImportacaoProcesso[];
};

function soDigitos(valor?: string | null): string | null {
  if (valor == null) return null;
  const d = valor.replace(/\D/g, '');
  return d || null;
}

function mensagemErroImportacao(err: unknown): string {
  if (err instanceof BadRequestException) {
    const res = err.getResponse();
    if (typeof res === 'string') return res;
    if (res && typeof res === 'object' && 'message' in res) {
      const msg = (res as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.join('; ');
      if (typeof msg === 'string') return msg;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Falha ao importar';
}

/** Aceita AAAA-MM-DD ou DD/MM/AAAA. */
function parsearPrazoCsv(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : t;
  }
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (br) {
    const iso = `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

const usuarioResumo = {
  select: { id: true, nome: true, email: true, role: true },
} as const;

const processoInclude = {
  cliente: {
    select: {
      id: true,
      nome: true,
      tipo: true,
      email: true,
      telefone: true,
      cpf: true,
      cnpj: true,
      nomeFantasia: true,
      endereco: true,
      cidade: true,
      uf: true,
      cep: true,
    },
  },
  responsavel: usuarioResumo,
  coResponsavel: usuarioResumo,
} satisfies Prisma.ProcessoInclude;

@Injectable()
export class ProcessosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private casoAcesso: CasoAcessoService,
  ) {}

  async criar(
    dados: CreateProcessoDto,
    atorId?: string,
    opcoes?: { silencioso?: boolean },
  ) {
    const { responsavelId, coResponsavelId } = await this.resolverEquipe(
      dados.responsavelId !== undefined
        ? dados.responsavelId
        : (atorId ?? null),
      dados.coResponsavelId ?? null,
    );

    const processo = await this.prisma.processo.create({
      data: {
        numero: dados.numero.trim(),
        status: dados.status,
        clienteId: dados.clienteId,
        titulo: dados.titulo,
        descricao: dados.descricao ?? null,
        prioridade: dados.prioridade,
        prazo: dados.prazo ? new Date(dados.prazo) : null,
        tags: dados.tags ?? undefined,
        concluido: dados.concluido ?? false,
        responsavelId,
        coResponsavelId,
      },
      include: processoInclude,
    });

    if (processo.prazo && !opcoes?.silencioso) {
      const quando = new Date(processo.prazo).toLocaleDateString('pt-BR');
      await this.notificacoes.notificarTodosUsuarios(
        'Novo caso com prazo',
        `${processo.titulo || processo.numero} — prazo ${quando}`,
        `/casos/${processo.id}`,
        'reminders',
      );
    }

    return processo;
  }

  modeloCsvImportacao(): string {
    return MODELO_CSV_PROCESSOS;
  }

  async modeloXlsxImportacao(): Promise<Buffer> {
    return montarModeloProcessosXlsx(PROCESSO_STATUS);
  }

  async previewArquivo(
    buffer: Buffer,
    nomeArquivo: string,
    mime?: string,
  ): Promise<PreviewImportacao> {
    try {
      const tabela = await lerTabelaDeArquivo(buffer, nomeArquivo, mime);
      return montarPreview(
        tabela,
        [...CAMPOS_ALVO_PROCESSOS],
        (h) => sugerirColunaProcesso(h),
      );
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Arquivo inválido',
      );
    }
  }

  /**
   * Importa casos via CSV ou Excel. Com mapeamento, aceita planilha de qualquer sistema.
   */
  async importarArquivo(
    buffer: Buffer,
    nomeArquivo: string,
    mime?: string,
    atorId?: string,
    mapeamento?: MapeamentoColunas | null,
  ): Promise<ResultadoImportacaoProcessos> {
    let linhas: LinhaImportacaoProcesso[];
    try {
      if (mapeamento && Object.keys(mapeamento).length > 0) {
        const erroMap = validarMapeamento(mapeamento, [...CAMPOS_ALVO_PROCESSOS], {
          exigirUmDe: [
            {
              chaves: ['clienteCpf', 'clienteCnpj', 'clienteDocumento'],
              rotulo: 'CPF, CNPJ ou Documento do cliente',
            },
          ],
        });
        if (erroMap) throw new BadRequestException(erroMap);
        const tabela = await lerTabelaDeArquivo(buffer, nomeArquivo, mime);
        linhas = aplicarMapeamento<LinhaImportacaoProcesso>(
          tabela,
          mapeamento,
          {
            documentoPara: { cpf: 'clienteCpf', cnpj: 'clienteCnpj' },
          },
        );
      } else {
        const nome = (nomeArquivo || '').toLowerCase();
        if (
          nome.endsWith('.xlsx') ||
          (ehArquivoPlanilha(nomeArquivo, mime) && !nome.endsWith('.csv'))
        ) {
          const tabela = await lerPlanilhaComoTabela(buffer);
          linhas = linhasDeTabelaProcessos(tabela);
        } else if (ehArquivoCsv(nomeArquivo, mime) || nome.endsWith('.csv')) {
          linhas = linhasDeCsvProcessos(buffer.toString('utf8'));
        } else {
          throw new BadRequestException(
            'Envie um arquivo .xlsx (Excel) ou .csv.',
          );
        }
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Arquivo inválido',
      );
    }
    return this.importarLinhas(linhas, atorId);
  }

  async importarCsv(
    texto: string,
    atorId?: string,
  ): Promise<ResultadoImportacaoProcessos> {
    let linhas: LinhaImportacaoProcesso[];
    try {
      linhas = linhasDeCsvProcessos(texto);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'CSV inválido',
      );
    }
    return this.importarLinhas(linhas, atorId);
  }

  private async importarLinhas(
    linhas: LinhaImportacaoProcesso[],
    atorId?: string,
  ): Promise<ResultadoImportacaoProcessos> {
    if (linhas.length === 0) {
      throw new BadRequestException(
        'Arquivo sem linhas de dados. Preencha a aba Dados do modelo.',
      );
    }
    if (linhas.length > MAX_LINHAS_IMPORTACAO_PROCESSOS) {
      throw new BadRequestException(
        `Limite de ${MAX_LINHAS_IMPORTACAO_PROCESSOS} casos por importação.`,
      );
    }

    const resultados: ResultadoLinhaImportacaoProcesso[] = [];
    let criados = 0;
    let duplicados = 0;
    let erros = 0;
    const numerosNoArquivo = new Set<string>();

    for (const linha of linhas) {
      const numero = linha.numero?.trim();
      if (!numero) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          motivo: 'Número do processo obrigatório',
        });
        continue;
      }

      const chaveNumero = numero.replace(/\s+/g, '').toLowerCase();
      if (numerosNoArquivo.has(chaveNumero)) {
        duplicados += 1;
        resultados.push({
          linha: linha.linha,
          status: 'duplicado',
          numero,
          motivo: 'Número repetido neste arquivo',
        });
        continue;
      }
      numerosNoArquivo.add(chaveNumero);

      const status = normalizarStatusProcesso(linha.status);
      if (!status) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          numero,
          motivo: `Status inválido. Use: ${PROCESSO_STATUS.join(', ')}`,
        });
        continue;
      }

      const cpf = soDigitos(linha.clienteCpf);
      const cnpj = soDigitos(linha.clienteCnpj);
      if (!cpf && !cnpj) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          numero,
          motivo: 'Informe clienteCpf ou clienteCnpj do cliente já importado',
        });
        continue;
      }

      const cliente = await this.prisma.cliente.findFirst({
        where: {
          OR: [
            ...(cpf ? [{ cpf }] : []),
            ...(cnpj ? [{ cnpj }] : []),
          ],
        },
        select: { id: true, nome: true },
      });
      if (!cliente) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          numero,
          motivo: cpf
            ? `Cliente com CPF ${cpf} não encontrado — importe os clientes antes`
            : `Cliente com CNPJ ${cnpj} não encontrado — importe os clientes antes`,
        });
        continue;
      }

      let prazoIso: string | undefined;
      if (linha.prazo?.trim()) {
        const p = parsearPrazoCsv(linha.prazo);
        if (!p) {
          erros += 1;
          resultados.push({
            linha: linha.linha,
            status: 'erro',
            numero,
            motivo: 'Prazo inválido (use AAAA-MM-DD ou DD/MM/AAAA)',
          });
          continue;
        }
        prazoIso = p;
      }

      const titulo = linha.titulo?.trim() || numero;
      const prioridade = linha.prioridade?.trim() || 'Média';
      const tags = parsearTagsCsv(linha.tags);
      const concluido =
        status === 'Concluído' || status === 'Arquivado' ? true : false;

      try {
        const criado = await this.criar(
          {
            numero,
            status,
            clienteId: cliente.id,
            titulo,
            descricao: linha.descricao?.trim() || null,
            prioridade,
            prazo: prazoIso,
            tags,
            concluido,
          },
          atorId,
          { silencioso: true },
        );
        criados += 1;
        resultados.push({
          linha: linha.linha,
          status: 'criado',
          numero: criado.numero,
          titulo: criado.titulo ?? titulo,
          processoId: criado.id,
          clienteNome: cliente.nome,
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          duplicados += 1;
          resultados.push({
            linha: linha.linha,
            status: 'duplicado',
            numero,
            motivo: 'Já existe caso com este número',
          });
          continue;
        }
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          numero,
          motivo: mensagemErroImportacao(err),
        });
      }
    }

    return {
      total: linhas.length,
      criados,
      duplicados,
      erros,
      resultados,
    };
  }

  async listarPorCliente(clienteId: string, user: CasoAcessoUser) {
    return this.prisma.processo.findMany({
      where: {
        clienteId,
        ...this.casoAcesso.visibilidadeProcesso(user),
      },
      include: processoInclude,
      orderBy: { criadoEm: 'desc' },
    });
  }

  async listarTodos(user: CasoAcessoUser) {
    return this.prisma.processo.findMany({
      where: this.casoAcesso.visibilidadeProcesso(user),
      include: {
        ...processoInclude,
        _count: { select: { documentos: true, compromissos: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async buscarPorId(id: string, user: CasoAcessoUser) {
    await this.casoAcesso.assertPodeVer(user, id);
    const processo = await this.prisma.processo.findUnique({
      where: { id },
      include: {
        ...processoInclude,
        _count: { select: { documentos: true, compromissos: true } },
      },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }
    return processo;
  }

  async atualizar(id: string, dados: UpdateProcessoDto) {
    const numeroNovo =
      dados.numero !== undefined ? dados.numero.trim() : undefined;

    const equipe =
      dados.responsavelId !== undefined || dados.coResponsavelId !== undefined
        ? await this.equipeParaUpdate(id, dados)
        : {};

    return this.prisma.processo.update({
      where: { id },
      data: {
        ...(numeroNovo !== undefined
          ? {
              numero: numeroNovo,
              tribunalSigla: null,
            }
          : {}),
        ...(dados.status !== undefined ? { status: dados.status } : {}),
        ...(dados.clienteId !== undefined
          ? { clienteId: dados.clienteId }
          : {}),
        ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
        ...(dados.descricao !== undefined
          ? { descricao: dados.descricao }
          : {}),
        ...(dados.prioridade !== undefined
          ? { prioridade: dados.prioridade }
          : {}),
        ...(dados.prazo !== undefined
          ? { prazo: dados.prazo ? new Date(dados.prazo) : null }
          : {}),
        ...(dados.tags !== undefined ? { tags: dados.tags } : {}),
        ...(dados.concluido !== undefined
          ? { concluido: dados.concluido }
          : {}),
        ...equipe,
      },
      include: processoInclude,
    });
  }

  async remover(id: string) {
    return this.prisma.processo.delete({
      where: { id },
    });
  }

  private async equipeParaUpdate(id: string, dados: UpdateProcessoDto) {
    const atual = await this.prisma.processo.findUnique({
      where: { id },
      select: { responsavelId: true, coResponsavelId: true },
    });
    const responsavelId =
      dados.responsavelId !== undefined
        ? dados.responsavelId
        : (atual?.responsavelId ?? null);
    const coResponsavelId =
      dados.coResponsavelId !== undefined
        ? dados.coResponsavelId
        : (atual?.coResponsavelId ?? null);
    return this.resolverEquipe(responsavelId, coResponsavelId);
  }

  private async resolverEquipe(
    responsavelId: string | null,
    coResponsavelId: string | null,
  ) {
    if (responsavelId && coResponsavelId && responsavelId === coResponsavelId) {
      throw new BadRequestException(
        'Responsável e co-responsável devem ser pessoas diferentes',
      );
    }
    await this.assertUsuario(responsavelId);
    await this.assertUsuario(coResponsavelId);
    return { responsavelId, coResponsavelId };
  }

  private async assertUsuario(id: string | null) {
    if (!id) return;
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!usuario) {
      throw new BadRequestException('Usuário da equipe não encontrado');
    }
  }
}
