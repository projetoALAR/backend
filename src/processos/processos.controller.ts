import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { Prisma } from '@prisma/client';

@Controller('processos')
export class ProcessosController {
  constructor(private readonly processosService: ProcessosService) {}

  @Post()
  async criar(@Body() dados: Prisma.ProcessoUncheckedCreateInput) {
    return this.processosService.criar(dados);
  }

  // Rota para buscar todos os processos de um cliente específico
  @Get('cliente/:clienteId')
  async listarPorCliente(@Param('clienteId') clienteId: string) {
    return this.processosService.listarPorCliente(clienteId);
  }

  // Rota genérica para buscar todos os processos (Usada no dropdown da Agenda)
  @Get()
  async listarTodos() {
    return this.processosService.listarTodos();
  }
}