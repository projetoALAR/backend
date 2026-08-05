import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async criar(dados: CreateClienteDto) {
    return this.prisma.cliente.create({
      data: {
        nome: dados.nome.trim(),
        cpf: dados.cpf.trim(),
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
      },
    });
  }

  async listarTodos() {
    return this.prisma.cliente.findMany({
      include: {
        _count: { select: { processos: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(id: string, dados: UpdateClienteDto) {
    return this.prisma.cliente.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
        ...(dados.cpf !== undefined ? { cpf: dados.cpf.trim() } : {}),
        ...(dados.email !== undefined
          ? { email: dados.email?.trim() || null }
          : {}),
        ...(dados.telefone !== undefined
          ? { telefone: dados.telefone?.trim() || null }
          : {}),
      },
    });
  }

  async remover(id: string) {
    return this.prisma.cliente.delete({
      where: { id },
    });
  }
}
