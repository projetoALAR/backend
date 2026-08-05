import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class ProcessosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  async criar(dados: Prisma.ProcessoUncheckedCreateInput) {
    const processo = await this.prisma.processo.create({
      data: dados,
      include: {
        cliente: { select: { id: true, nome: true, email: true, telefone: true, cpf: true } },
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
        cliente: { select: { id: true, nome: true, email: true, telefone: true, cpf: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async listarTodos() {
    return this.prisma.processo.findMany({
      include: {
        cliente: { select: { id: true, nome: true, email: true, telefone: true, cpf: true } },
        _count: { select: { documentos: true, compromissos: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(id: string, dados: Prisma.ProcessoUncheckedUpdateInput) {
    return this.prisma.processo.update({
      where: { id },
      data: dados,
      include: {
        cliente: { select: { id: true, nome: true, email: true, telefone: true, cpf: true } },
      },
    });
  }

  async remover(id: string) {
    return this.prisma.processo.delete({
      where: { id },
    });
  }
}
