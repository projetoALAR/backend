import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CreateProcessoDto, UpdateProcessoDto } from './processos.dto';

@Injectable()
export class ProcessosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  async criar(dados: CreateProcessoDto) {
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
      },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            cpf: true,
          },
        },
      },
    });

    if (processo.prazo) {
      const quando = new Date(processo.prazo).toLocaleDateString('pt-BR');
      await this.notificacoes.notificarTodosUsuarios(
        'Novo caso com prazo',
        `${processo.titulo || processo.numero} — prazo ${quando}`,
        `/tasks?caseId=${processo.id}`,
        'reminders',
      );
    }

    return processo;
  }

  async listarPorCliente(clienteId: string) {
    return this.prisma.processo.findMany({
      where: { clienteId },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            cpf: true,
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async listarTodos() {
    return this.prisma.processo.findMany({
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            cpf: true,
          },
        },
        _count: { select: { documentos: true, compromissos: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(id: string, dados: UpdateProcessoDto) {
    const numeroNovo =
      dados.numero !== undefined ? dados.numero.trim() : undefined;

    return this.prisma.processo.update({
      where: { id },
      data: {
        ...(numeroNovo !== undefined
          ? {
              numero: numeroNovo,
              // Recalcula o índice DataJud na próxima sincronização
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
      },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            cpf: true,
          },
        },
      },
    });
  }

  async remover(id: string) {
    return this.prisma.processo.delete({
      where: { id },
    });
  }
}
