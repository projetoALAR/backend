import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';
import {
  CreateClienteDto,
  UpdateClienteDto,
  type ClienteTipo,
} from './clientes.dto';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';
import {
  CAMPOS_ALVO_CLIENTES,
  linhasDeCsv,
  linhasDeTabelaClientes,
  MODELO_CSV_CLIENTES,
  sugerirColunaCliente,
  type LinhaImportacaoCliente,
} from './clientes-importacao.util';
import {
  ehArquivoCsv,
  ehArquivoPlanilha,
  lerPlanilhaComoTabela,
  montarModeloClientesXlsx,
} from '../importacao/planilha-importacao.util';
import {
  aplicarMapeamento,
  lerTabelaDeArquivo,
  montarPreview,
  type MapeamentoColunas,
  type PreviewImportacao,
  validarMapeamento,
} from '../importacao/importacao-mapeamento.util';
import { validarCnpj, validarCpf } from '../common/documento-br.util';
import {
  normalizarPaginacao,
  type PaginaResultado,
} from '../common/paginacao.dto';

export const NOME_TITULAR_ANONIMIZADO = 'Titular anonimizado';
export const MAX_LINHAS_IMPORTACAO_CLIENTES = 500;

export type ResultadoLinhaImportacao = {
  linha: number;
  status: 'criado' | 'duplicado' | 'erro';
  nome?: string;
  clienteId?: string;
  motivo?: string;
};

export type ResultadoImportacaoClientes = {
  total: number;
  criados: number;
  duplicados: number;
  erros: number;
  resultados: ResultadoLinhaImportacao[];
};

function soDigitos(valor?: string | null): string | null {
  if (valor == null) return null;
  const t = valor.trim();
  if (!t) return null;
  if (/^ANON/i.test(t)) return t;
  const d = t.replace(/\D/g, '');
  return d || null;
}

function textoOuNulo(valor?: string | null): string | null {
  if (valor == null) return null;
  const t = valor.trim();
  return t || null;
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

@Injectable()
export class ClientesService {
  constructor(
    private prisma: PrismaService,
    private documentos: DocumentosService,
    private casoAcesso: CasoAcessoService,
  ) {}

  async criar(dados: CreateClienteDto) {
    const payload = this.montarPayload(dados, 'PF');
    try {
      return await this.prisma.cliente.create({ data: payload });
    } catch (err) {
      this.rethrowDuplicado(err);
    }
  }

  modeloCsv(): string {
    return MODELO_CSV_CLIENTES;
  }

  async modeloXlsx(): Promise<Buffer> {
    return montarModeloClientesXlsx();
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
        [...CAMPOS_ALVO_CLIENTES],
        (h) => sugerirColunaCliente(h),
      );
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Arquivo inválido',
      );
    }
  }

  /**
   * Importa clientes a partir de CSV ou Excel (.xlsx).
   * Com `mapeamento`, usa as colunas escolhidas pelo usuário (planilha de qualquer sistema).
   */
  async importarArquivo(
    buffer: Buffer,
    nomeArquivo: string,
    mime?: string,
    mapeamento?: MapeamentoColunas | null,
  ): Promise<ResultadoImportacaoClientes> {
    let linhas: LinhaImportacaoCliente[];
    try {
      if (mapeamento && Object.keys(mapeamento).length > 0) {
        const erroMap = validarMapeamento(mapeamento, [...CAMPOS_ALVO_CLIENTES]);
        if (erroMap) throw new BadRequestException(erroMap);
        const usados = new Set(
          Object.values(mapeamento).filter((v): v is string => !!v),
        );
        if (!usados.has('nome')) {
          throw new BadRequestException('Mapeie a coluna Nome / Razão social.');
        }
        const tabela = await lerTabelaDeArquivo(buffer, nomeArquivo, mime);
        linhas = aplicarMapeamento<LinhaImportacaoCliente>(tabela, mapeamento, {
          documentoPara: { cpf: 'cpf', cnpj: 'cnpj' },
        });
      } else {
        const nome = (nomeArquivo || '').toLowerCase();
        if (
          nome.endsWith('.xlsx') ||
          (ehArquivoPlanilha(nomeArquivo, mime) && !nome.endsWith('.csv'))
        ) {
          const tabela = await lerPlanilhaComoTabela(buffer);
          linhas = linhasDeTabelaClientes(tabela);
        } else if (ehArquivoCsv(nomeArquivo, mime) || nome.endsWith('.csv')) {
          linhas = linhasDeCsv(buffer.toString('utf8'));
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
    return this.importarLinhas(linhas);
  }

  /** Mantido para testes com string CSV. */
  async importarCsv(texto: string): Promise<ResultadoImportacaoClientes> {
    let linhas: LinhaImportacaoCliente[];
    try {
      linhas = linhasDeCsv(texto);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'CSV inválido',
      );
    }
    return this.importarLinhas(linhas);
  }

  private async importarLinhas(
    linhas: LinhaImportacaoCliente[],
  ): Promise<ResultadoImportacaoClientes> {
    if (linhas.length === 0) {
      throw new BadRequestException(
        'Arquivo sem linhas de dados. Preencha a aba Dados do modelo.',
      );
    }
    if (linhas.length > MAX_LINHAS_IMPORTACAO_CLIENTES) {
      throw new BadRequestException(
        `Limite de ${MAX_LINHAS_IMPORTACAO_CLIENTES} clientes por importação.`,
      );
    }

    const resultados: ResultadoLinhaImportacao[] = [];
    let criados = 0;
    let duplicados = 0;
    let erros = 0;
    const vistosNoArquivo = new Set<string>();

    for (const linha of linhas) {
      const nome = linha.nome?.trim();
      if (!nome) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          motivo: 'Nome obrigatório',
        });
        continue;
      }

      const tipoRaw = (linha.tipo || 'PF').trim().toUpperCase();
      const tipo: ClienteTipo = tipoRaw === 'PJ' ? 'PJ' : 'PF';
      if (tipoRaw !== 'PF' && tipoRaw !== 'PJ') {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          nome,
          motivo: 'Tipo deve ser PF ou PJ',
        });
        continue;
      }

      const digitosDoc =
        tipo === 'PF' ? soDigitos(linha.cpf) : soDigitos(linha.cnpj);
      if (digitosDoc) {
        const chaveDoc = `${tipo}:${digitosDoc}`;
        if (vistosNoArquivo.has(chaveDoc)) {
          duplicados += 1;
          resultados.push({
            linha: linha.linha,
            status: 'duplicado',
            nome,
            motivo: 'Documento repetido neste arquivo',
          });
          continue;
        }
        vistosNoArquivo.add(chaveDoc);
      }

      try {
        const criado = await this.criar({
          nome,
          tipo,
          cpf: linha.cpf,
          cnpj: linha.cnpj,
          nomeFantasia: linha.nomeFantasia,
          rg: linha.rg,
          email: linha.email,
          telefone: linha.telefone,
          endereco: linha.endereco,
          cidade: linha.cidade,
          uf: linha.uf,
          cep: linha.cep,
          observacoes: linha.observacoes,
        });
        criados += 1;
        resultados.push({
          linha: linha.linha,
          status: 'criado',
          nome: criado.nome,
          clienteId: criado.id,
        });
      } catch (err) {
        if (err instanceof ConflictException) {
          duplicados += 1;
          resultados.push({
            linha: linha.linha,
            status: 'duplicado',
            nome,
            motivo: 'Já existe cliente com este CPF ou CNPJ',
          });
          continue;
        }
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          nome,
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

  async listarTodos(
    user: CasoAcessoUser,
    filtro?: { page?: number; limit?: number; q?: string },
  ) {
    const q = filtro?.q?.trim();
    const digitos = q ? q.replace(/\D/g, '') : '';
    const busca: Prisma.ClienteWhereInput | undefined = q
      ? {
          OR: [
            { nome: { contains: q, mode: 'insensitive' } },
            { nomeFantasia: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { cpf: { contains: q, mode: 'insensitive' } },
            { cnpj: { contains: q, mode: 'insensitive' } },
            { cidade: { contains: q, mode: 'insensitive' } },
            ...(digitos.length >= 3
              ? [
                  { cpf: { contains: digitos } },
                  { cnpj: { contains: digitos } },
                ]
              : []),
          ],
        }
      : undefined;

    const where: Prisma.ClienteWhereInput = {
      AND: [
        this.casoAcesso.visibilidadeCliente(user),
        ...(busca ? [busca] : []),
      ],
    };

    const include = {
      _count: { select: { processos: true } },
    } as const;
    const orderBy = { criadoEm: 'desc' as const };
    const { paginar, page, limit } = normalizarPaginacao(filtro);

    if (!paginar) {
      return this.prisma.cliente.findMany({ where, include, orderBy });
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return { items, total, page, limit } satisfies PaginaResultado<
      (typeof items)[number]
    >;
  }

  async buscarPorId(id: string, user: CasoAcessoUser) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, ...this.casoAcesso.visibilidadeCliente(user) },
      include: {
        _count: { select: { processos: true } },
      },
    });
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return cliente;
  }

  async atualizar(id: string, dados: UpdateClienteDto) {
    const atual = await this.prisma.cliente.findUnique({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Cliente não encontrado');
    }
    const payload = this.montarPayload(dados, atual.tipo as ClienteTipo, atual);
    try {
      return await this.prisma.cliente.update({
        where: { id },
        data: payload,
      });
    } catch (err) {
      this.rethrowDuplicado(err);
    }
  }

  async remover(id: string) {
    return this.prisma.cliente.delete({
      where: { id },
    });
  }

  async exportar(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        processos: {
          include: {
            compromissos: {
              select: {
                id: true,
                titulo: true,
                descricao: true,
                dataHora: true,
                criadoEm: true,
              },
            },
            documentos: {
              select: {
                id: true,
                nome: true,
                tamanho: true,
                criadoEm: true,
                urlArquivo: true,
              },
            },
            andamentos: {
              select: {
                id: true,
                data: true,
                descricao: true,
                codigoMovimento: true,
                criadoEm: true,
              },
            },
            tarefas: {
              select: {
                id: true,
                titulo: true,
                concluida: true,
                prazo: true,
                criadoEm: true,
              },
            },
            conversas: {
              select: {
                id: true,
                titulo: true,
                criadoEm: true,
                mensagens: {
                  select: {
                    id: true,
                    conteudo: true,
                    isUser: true,
                    criadoEm: true,
                  },
                  orderBy: { criadoEm: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return {
      exportadoEm: new Date().toISOString(),
      origem: 'Alar',
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        tipo: cliente.tipo,
        cpf: cliente.cpf,
        cnpj: cliente.cnpj,
        nomeFantasia: cliente.nomeFantasia,
        rg: cliente.rg,
        email: cliente.email,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
        cidade: cliente.cidade,
        uf: cliente.uf,
        cep: cliente.cep,
        observacoes: cliente.observacoes,
        criadoEm: cliente.criadoEm,
      },
      processos: cliente.processos,
    };
  }

  async anonimizar(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { processos: { select: { id: true } } },
    });
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (this.jaAnonimizado(cliente)) {
      throw new ConflictException('Este cliente já foi anonimizado');
    }

    const processoIds = cliente.processos.map((p) => p.id);
    if (processoIds.length > 0) {
      const docs = await this.prisma.documento.findMany({
        where: { processoId: { in: processoIds } },
        select: { id: true },
      });
      for (const doc of docs) {
        await this.documentos.remover(doc.id);
      }
      await this.prisma.conversacao.deleteMany({
        where: { processoId: { in: processoIds } },
      });
    }

    const cpfAnon = `ANON${id.replace(/-/g, '').slice(0, 11)}`;
    return this.prisma.cliente.update({
      where: { id },
      data: {
        nome: NOME_TITULAR_ANONIMIZADO,
        cpf: cpfAnon,
        cnpj: null,
        nomeFantasia: null,
        rg: null,
        email: null,
        telefone: null,
        endereco: null,
        cidade: null,
        uf: null,
        cep: null,
        observacoes: null,
      },
      include: {
        _count: { select: { processos: true } },
      },
    });
  }

  jaAnonimizado(cliente: { nome: string; cpf: string | null }) {
    return (
      cliente.nome === NOME_TITULAR_ANONIMIZADO ||
      Boolean(cliente.cpf?.toUpperCase().startsWith('ANON'))
    );
  }

  private montarPayload(
    dados: CreateClienteDto | UpdateClienteDto,
    tipoPadrao: ClienteTipo,
    atual?: {
      tipo: string;
      cpf: string | null;
      cnpj: string | null;
      nome: string;
      nomeFantasia: string | null;
      rg: string | null;
      email: string | null;
      telefone: string | null;
      endereco: string | null;
      cidade: string | null;
      uf: string | null;
      cep: string | null;
      observacoes: string | null;
    },
  ) {
    const tipo = (dados.tipo ?? atual?.tipo ?? tipoPadrao) as ClienteTipo;
    const cpf =
      dados.cpf !== undefined ? soDigitos(dados.cpf) : (atual?.cpf ?? null);
    const cnpj =
      dados.cnpj !== undefined ? soDigitos(dados.cnpj) : (atual?.cnpj ?? null);

    if (tipo === 'PF') {
      if (!cpf || (!/^ANON/i.test(cpf) && cpf.length !== 11)) {
        throw new BadRequestException('CPF deve ter 11 dígitos');
      }
      if (cpf && !/^ANON/i.test(cpf) && !validarCpf(cpf)) {
        throw new BadRequestException('CPF inválido (dígito verificador)');
      }
    } else if (!cnpj || cnpj.length !== 14) {
      throw new BadRequestException('CNPJ deve ter 14 dígitos');
    } else if (!validarCnpj(cnpj)) {
      throw new BadRequestException('CNPJ inválido (dígito verificador)');
    }

    const nome = dados.nome !== undefined ? dados.nome.trim() : atual?.nome;
    if (!nome) {
      throw new BadRequestException('Nome é obrigatório');
    }

    return {
      nome,
      tipo,
      cpf: tipo === 'PF' ? cpf : null,
      cnpj: tipo === 'PJ' ? cnpj : null,
      nomeFantasia:
        dados.nomeFantasia !== undefined
          ? textoOuNulo(dados.nomeFantasia)
          : (atual?.nomeFantasia ?? null),
      rg: dados.rg !== undefined ? textoOuNulo(dados.rg) : (atual?.rg ?? null),
      email:
        dados.email !== undefined
          ? textoOuNulo(dados.email)
          : (atual?.email ?? null),
      telefone:
        dados.telefone !== undefined
          ? textoOuNulo(dados.telefone)
          : (atual?.telefone ?? null),
      endereco:
        dados.endereco !== undefined
          ? textoOuNulo(dados.endereco)
          : (atual?.endereco ?? null),
      cidade:
        dados.cidade !== undefined
          ? textoOuNulo(dados.cidade)
          : (atual?.cidade ?? null),
      uf:
        dados.uf !== undefined
          ? (textoOuNulo(dados.uf)?.toUpperCase() ?? null)
          : (atual?.uf ?? null),
      cep:
        dados.cep !== undefined ? soDigitos(dados.cep) : (atual?.cep ?? null),
      observacoes:
        dados.observacoes !== undefined
          ? textoOuNulo(dados.observacoes)
          : (atual?.observacoes ?? null),
    };
  }

  private rethrowDuplicado(err: unknown): never {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ConflictException('Já existe cliente com este CPF ou CNPJ');
    }
    throw err;
  }
}
