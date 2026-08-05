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
import { EquipeService } from './equipe.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CreateMembroDto, UpdateMembroDto } from './equipe.dto';

@Controller('equipe')
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Roles(Role.ADMIN)
  @Post()
  async criar(@Body() dados: CreateMembroDto) {
    return this.equipeService.criar(dados);
  }

  @Get()
  async listarTodos() {
    return this.equipeService.listarTodos();
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateMembroDto,
  ) {
    return this.equipeService.atualizar(id, dados);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipeService.remover(id);
  }
}
