import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CreateProcessoDto, UpdateProcessoDto } from './processos.dto';

@Controller('processos')
export class ProcessosController {
  constructor(private readonly processosService: ProcessosService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post()
  async criar(@Body() dados: CreateProcessoDto) {
    return this.processosService.criar(dados);
  }

  @Get('cliente/:clienteId')
  async listarPorCliente(@Param('clienteId', ParseUUIDPipe) clienteId: string) {
    return this.processosService.listarPorCliente(clienteId);
  }

  @Get()
  async listarTodos() {
    return this.processosService.listarTodos();
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateProcessoDto,
  ) {
    return this.processosService.atualizar(id, dados);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.processosService.remover(id);
  }
}
