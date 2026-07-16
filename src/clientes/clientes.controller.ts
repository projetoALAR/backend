import { Controller, Post, Body, Get, Delete, Param } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { Prisma as PrismaTypes } from '@prisma/client';

@Controller('clientes')
export class ClientesController {
// Injeção de Dependência: Conectando o Garçom à Cozinha
  constructor(private readonly clientesService: ClientesService) {}

// Rota para RECEBER os dados do Front-end e CADASTRAR
  @Post()
  async criar(@Body() dados: PrismaTypes.ClienteCreateInput) {
    return this.clientesService.criar(dados);
  }

// Rota para DEVOLVER a lista de clientes para o Front-end
  @Get()
  async listarTodos() {
    return this.clientesService.listarTodos();
  }

  @Delete(':id')
  async remover(@Param('id') id: string) {
    return this.clientesService.remover(id);
  }  
}
