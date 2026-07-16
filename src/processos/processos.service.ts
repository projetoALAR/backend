import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProcessosService {
  constructor(private prisma: PrismaService) {}

  async criar(dados: Prisma.ProcessoUncheckedCreateInput) {
    return this.prisma.processo.create({
      data: dados,
    });
  }

  async listarPorCliente(clienteId: string) {
    return this.prisma.processo.findMany({
      where: { clienteId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async listarTodos() {
    return this.prisma.processo.findMany({
      // Dica de Performance: Trazemos apenas o ID e o Número para não sobrecarregar a rede
      select: { id: true, numero: true }, 
      orderBy: { criadoEm: 'desc' },
    });
  }
}