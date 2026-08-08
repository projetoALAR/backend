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

@Controller('modelos-documento')
export class ModelosDocumentoController {
  constructor(private readonly service: ModelosDocumentoService) {}

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
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('processoId', ParseUUIDPipe) processoId: string,
  ) {
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
