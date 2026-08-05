import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CreateMembroDto, UpdateMembroDto } from './equipe.dto';

@Injectable()
export class EquipeService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {}

  async criar(dados: CreateMembroDto) {
    const membro = await this.prisma.membroEquipe.create({
      data: {
        nome: dados.nome.trim(),
        email: dados.email.trim().toLowerCase(),
        cargo: dados.cargo.trim(),
        status: dados.status || 'active',
      },
    });
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

  async atualizar(id: string, dados: UpdateMembroDto) {
    return this.prisma.membroEquipe.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
        ...(dados.email !== undefined
          ? { email: dados.email.trim().toLowerCase() }
          : {}),
        ...(dados.cargo !== undefined ? { cargo: dados.cargo.trim() } : {}),
        ...(dados.status !== undefined ? { status: dados.status } : {}),
      },
    });
  }

  async remover(id: string) {
    return this.prisma.membroEquipe.delete({ where: { id } });
  }
}
