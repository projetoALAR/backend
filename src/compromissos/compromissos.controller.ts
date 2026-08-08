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

@Controller('compromissos')
export class CompromissosController {
  constructor(private readonly compromissosService: CompromissosService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post()
  async criar(@Body() dados: CreateCompromissoDto) {
    return this.compromissosService.criar(dados);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  async listarTodos() {
    return this.compromissosService.listarTodos();
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateCompromissoDto,
  ) {
    return this.compromissosService.atualizar(id, dados);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.compromissosService.remover(id);
  }
}
