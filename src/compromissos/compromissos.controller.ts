import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CompromissosService } from './compromissos.service';
import { Prisma } from '@prisma/client';

@Controller('compromissos')
export class CompromissosController {
  constructor(private readonly compromissosService: CompromissosService) {}

  @Post()
  async criar(@Body() dados: Prisma.CompromissoUncheckedCreateInput) {
    return this.compromissosService.criar(dados);
  }

  @Get()
  async listarTodos() {
    return this.compromissosService.listarTodos();
  }

  @Put(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dados: Prisma.CompromissoUncheckedUpdateInput,
  ) {
    return this.compromissosService.atualizar(id, dados);
  }

  @Delete(':id')
  async remover(@Param('id') id: string) {
    return this.compromissosService.remover(id);
  }
}