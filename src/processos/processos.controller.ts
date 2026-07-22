import { Controller, Post, Body, Get, Put, Delete, Param } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { Prisma } from '@prisma/client';

@Controller('processos')
export class ProcessosController {
  constructor(private readonly processosService: ProcessosService) {}

  @Post()
  async criar(@Body() dados: Prisma.ProcessoUncheckedCreateInput) {
    return this.processosService.criar(dados);
  }

  @Get('cliente/:clienteId')
  async listarPorCliente(@Param('clienteId') clienteId: string) {
    return this.processosService.listarPorCliente(clienteId);
  }

  @Get()
  async listarTodos() {
    return this.processosService.listarTodos();
  }

  @Put(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dados: Prisma.ProcessoUncheckedUpdateInput,
  ) {
    return this.processosService.atualizar(id, dados);
  }

  @Delete(':id')
  async remover(@Param('id') id: string) {
    return this.processosService.remover(id);
  }
}
