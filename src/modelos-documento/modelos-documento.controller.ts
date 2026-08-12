import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import {
  CreateModeloDocumentoDto,
  UpdateModeloDocumentoDto,
} from './modelos-documento.dto';
import { ModelosDocumentoService } from './modelos-documento.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('modelos-documento')
export class ModelosDocumentoController {
  constructor(
    private readonly service: ModelosDocumentoService,
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post()
  criar(@Body() dados: CreateModeloDocumentoDto) {
    return this.service.criar(dados);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  listarTodos(@Query('categoria') categoria?: string) {
    return this.service.listarTodos(categoria);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id/preview/:processoId')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('processoId', ParseUUIDPipe) processoId: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    return this.service.previsualizar(id, processoId);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id')
  buscarPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.buscarPorId(id);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Put(':id')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateModeloDocumentoDto,
  ) {
    return this.service.atualizar(id, dados);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remover(id);
  }
}
