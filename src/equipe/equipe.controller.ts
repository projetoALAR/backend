import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { EquipeService } from './equipe.service';
import { Prisma } from '@prisma/client';

@Controller('equipe')
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Post()
  async criar(@Body() dados: Prisma.MembroEquipeCreateInput) {
    return this.equipeService.criar(dados);
  }

  @Get()
  async listarTodos() {
    return this.equipeService.listarTodos();
  }

  @Put(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dados: Prisma.MembroEquipeUpdateInput,
  ) {
    return this.equipeService.atualizar(id, dados);
  }

  @Delete(':id')
  async remover(@Param('id') id: string) {
    return this.equipeService.remover(id);
  }
}
