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
import { ClientesService } from './clientes.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post()
  async criar(@Body() dados: CreateClienteDto) {
    return this.clientesService.criar(dados);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  async listarTodos() {
    return this.clientesService.listarTodos();
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateClienteDto,
  ) {
    return this.clientesService.atualizar(id, dados);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientesService.remover(id);
  }
}
