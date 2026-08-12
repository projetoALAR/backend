import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CreateCompromissoDto, UpdateCompromissoDto } from './compromissos.dto';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';

@Injectable()
export class CompromissosService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private casoAcesso: CasoAcessoService,
  ) {}

  async criar(dados: CreateCompromissoDto, user: CasoAcessoUser) {
    if (dados.processoId) {
      await this.casoAcesso.assertPodeVer(user, dados.processoId);
    } else if (this.casoAcesso.precisaFiltrar(user)) {
      throw new ForbiddenException(
        'Assistente só pode criar compromisso vinculado a um caso atribuído',
      );
    }
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

  async listarTodos(user: CasoAcessoUser) {
    return this.prisma.compromisso.findMany({
      where: this.casoAcesso.visibilidadeCompromisso(user),
      orderBy: { dataHora: 'asc' },
      include: {
        processo: {
          select: { numero: true },
        },
      },
    });
  }

  async atualizar(id: string, dados: UpdateCompromissoDto, user: CasoAcessoUser) {
    const atual = await this.prisma.compromisso.findUnique({ where: { id } });
    if (atual?.processoId) {
      await this.casoAcesso.assertPodeVer(user, atual.processoId);
    }
    if (dados.processoId) {
      await this.casoAcesso.assertPodeVer(user, dados.processoId);
    }
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
