import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EquipeService {
  constructor(private prisma: PrismaService) {}

  async criar(dados: Prisma.MembroEquipeCreateInput) {
    return this.prisma.membroEquipe.create({ data: dados });
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
