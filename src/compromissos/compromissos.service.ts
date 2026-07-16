import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompromissosService {
  constructor(private prisma: PrismaService) {}

  async criar(dados: Prisma.CompromissoUncheckedCreateInput) {
    return this.prisma.compromisso.create({
      data: dados,
    });
  }

  async listarTodos() {
    return this.prisma.compromisso.findMany({
      orderBy: { dataHora: 'asc' }, // Ordena do mais próximo para o mais distante
      include: {
        processo: {
          select: { numero: true }, // Traz apenas o número do processo para não pesar a query
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