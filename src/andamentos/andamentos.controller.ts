import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { AndamentosService } from './andamentos.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('processos')
export class AndamentosController {
  constructor(
    private readonly andamentosService: AndamentosService,
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id/andamentos')
  async listarPorProcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(user, id);
    return this.andamentosService.listarPorProcesso(id);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post(':id/andamentos/sync')
  async sincronizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(user, id);
    return this.andamentosService.sincronizarProcesso(id);
  }
}
