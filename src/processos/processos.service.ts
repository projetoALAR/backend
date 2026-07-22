import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProcessosService {
  constructor(private prisma: PrismaService) {}

  async criar(dados: Prisma.ProcessoUncheckedCreateInput) {
    return this.prisma.processo.create({
      data: dados,
      include: {
        cliente: { select: { id: true, nome: true, email: true, telefone: true, cpf: true } },
      },
    });
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
