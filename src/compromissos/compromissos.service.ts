import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class CompromissosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  async criar(dados: Prisma.CompromissoUncheckedCreateInput) {
    const compromisso = await this.prisma.compromisso.create({
      data: dados,
    });

    const quando = new Date(compromisso.dataHora).toLocaleString('pt-BR');
    await this.notificacoes.notificarTodosUsuarios(
      'Novo compromisso',
      `${compromisso.titulo} em ${quando}`,
      '/calendar',
      'reminders',
    );

    return compromisso;
  }

  async listarTodos() {
    return this.prisma.compromisso.findMany({
      orderBy: { dataHora: 'asc' },
      include: {
        processo: {
          select: { numero: true },
        },
      },
    });
  }

  async atualizar(id: string, dados: Prisma.CompromissoUncheckedUpdateInput) {
    return this.prisma.compromisso.update({
      where: { id },
      data: dados,
    });
  }

  async remover(id: string) {
    return this.prisma.compromisso.delete({
      where: { id },
    });
  }
}
