import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CompromissosService } from './compromissos.service';
import { CreateCompromissoDto, UpdateCompromissoDto } from './compromissos.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('compromissos')
export class CompromissosController {
  constructor(private readonly compromissosService: CompromissosService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post()
  async criar(
    @Body() dados: CreateCompromissoDto,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.compromissosService.criar(dados, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  async listarTodos(@CurrentUser() user: CasoAcessoUser) {
    return this.compromissosService.listarTodos(user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get('processo/:processoId')
  async listarPorProcesso(
    @Param('processoId', ParseUUIDPipe) processoId: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.compromissosService.listarPorProcesso(processoId, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateCompromissoDto,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.compromissosService.atualizar(id, dados, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.compromissosService.remover(id);
  }
}
