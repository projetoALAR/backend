import { Controller, Post, Body, Get, Put, Delete, Param } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { Prisma as PrismaTypes } from '@prisma/client';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  async criar(@Body() dados: PrismaTypes.ClienteCreateInput) {
    return this.clientesService.criar(dados);
  }

  @Get()
  async listarTodos() {
    return this.clientesService.listarTodos();
  }

  @Put(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dados: PrismaTypes.ClienteUpdateInput,
  ) {
    return this.clientesService.atualizar(id, dados);
  }

  @Delete(':id')
  async remover(@Param('id') id: string) {
    return this.clientesService.remover(id);
  }
}
