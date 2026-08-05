import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CreateCompromissoDto, UpdateCompromissoDto } from './compromissos.dto';

@Injectable()
export class CompromissosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  async criar(dados: CreateCompromissoDto) {
    const compromisso = await this.prisma.compromisso.create({
      data: {
        titulo: dados.titulo.trim(),
        descricao: dados.descricao,
        dataHora: new Date(dados.dataHora),
        processoId: dados.processoId ?? null,
      },
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

  async atualizar(id: string, dados: UpdateCompromissoDto) {
    return this.prisma.compromisso.update({
      where: { id },
      data: {
        ...(dados.titulo !== undefined ? { titulo: dados.titulo.trim() } : {}),
        ...(dados.descricao !== undefined
          ? { descricao: dados.descricao }
          : {}),
        ...(dados.dataHora !== undefined
          ? { dataHora: new Date(dados.dataHora) }
          : {}),
        ...(dados.processoId !== undefined
          ? { processoId: dados.processoId }
          : {}),
      },
    });
  }

  async remover(id: string) {
    return this.prisma.compromisso.delete({
      where: { id },
    });
  }
}
