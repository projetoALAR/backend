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

export const NOME_TITULAR_ANONIMIZADO = 'Titular anonimizado';

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

  async listarTodos(user: CasoAcessoUser) {
    return this.prisma.cliente.findMany({
      where: this.casoAcesso.visibilidadeCliente(user),
      include: {
        _count: { select: { processos: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
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
    } else if (!cnpj || cnpj.length !== 14) {
      throw new BadRequestException('CNPJ deve ter 14 dígitos');
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
          ? textoOuNulo(dados.uf)?.toUpperCase() ?? null
          : (atual?.uf ?? null),
      cep: dados.cep !== undefined ? soDigitos(dados.cep) : (atual?.cep ?? null),
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
