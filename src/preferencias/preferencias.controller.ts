import { Controller, Get, Put, Body } from '@nestjs/common';
import { PreferenciasService } from './preferencias.service';
import { Prisma } from '@prisma/client';

@Controller('preferencias')
export class PreferenciasController {
  constructor(private readonly preferenciasService: PreferenciasService) {}

  @Get()
  async obter() {
    return this.preferenciasService.obter();
  }

  @Put()
  async atualizar(@Body() dados: Prisma.PreferenciaUpdateInput) {
    return this.preferenciasService.atualizar(dados);
  }
}
