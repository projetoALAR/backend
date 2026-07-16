import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async criar(dados: Prisma.ClienteCreateInput) {
    // Verifique se o nome aqui está exatamente igual ao seu schema.prisma
    return this.prisma.cliente.create({ 
      data: dados,
    });
  }

  async listarTodos() {
    return this.prisma.cliente.findMany();
  }

  async remover(id: string) {
  return this.prisma.cliente.delete({
    where: { id },
  });
}
}