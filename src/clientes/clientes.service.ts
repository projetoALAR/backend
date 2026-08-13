import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';

export const NOME_TITULAR_ANONIMIZADO = 'Titular anonimizado';

@Injectable()
export class ClientesService {
  constructor(
    private prisma: PrismaService,
    private documentos: DocumentosService,
    private casoAcesso: CasoAcessoService,
  ) {}

  async criar(dados: CreateClienteDto) {
    return this.prisma.cliente.create({
      data: {
        nome: dados.nome.trim(),
        cpf: dados.cpf.trim(),
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
      },
    });
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

  async atualizar(id: string, dados: UpdateClienteDto) {
    return this.prisma.cliente.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
        ...(dados.cpf !== undefined ? { cpf: dados.cpf.trim() } : {}),
        ...(dados.email !== undefined
          ? { email: dados.email?.trim() || null }
          : {}),
        ...(dados.telefone !== undefined
          ? { telefone: dados.telefone?.trim() || null }
          : {}),
      },
    });
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
        cpf: cliente.cpf,
        email: cliente.email,
        telefone: cliente.telefone,
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
        email: null,
        telefone: null,
      },
      include: {
        _count: { select: { processos: true } },
      },
    });
  }

  jaAnonimizado(cliente: { nome: string; cpf: string }) {
    return (
      cliente.nome === NOME_TITULAR_ANONIMIZADO ||
      cliente.cpf.toUpperCase().startsWith('ANON')
    );
  }
}
