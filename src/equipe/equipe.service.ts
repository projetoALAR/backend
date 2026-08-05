import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class EquipeService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  async criar(dados: Prisma.MembroEquipeCreateInput) {
    const membro = await this.prisma.membroEquipe.create({ data: dados });
    await this.notificacoes.notificarTodosUsuarios(
      'Novo membro na equipe',
      `${membro.nome} (${membro.cargo}) foi adicionado à equipe.`,
      '/team',
      'teamUpdates',
    );
    return membro;
  }

  async listarTodos() {
    return this.prisma.membroEquipe.findMany({
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(id: string, dados: Prisma.MembroEquipeUpdateInput) {
    return this.prisma.membroEquipe.update({
      where: { id },
      data: dados,
    });
  }

  async remover(id: string) {
    return this.prisma.membroEquipe.delete({ where: { id } });
  }
}
