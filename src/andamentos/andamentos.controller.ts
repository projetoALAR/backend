import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { AndamentosService } from './andamentos.service';

@Controller('processos')
export class AndamentosController {
  constructor(private readonly andamentosService: AndamentosService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id/andamentos')
  async listarPorProcesso(@Param('id', ParseUUIDPipe) id: string) {
    return this.andamentosService.listarPorProcesso(id);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post(':id/andamentos/sync')
  async sincronizar(@Param('id', ParseUUIDPipe) id: string) {
    return this.andamentosService.sincronizarProcesso(id);
  }
}
