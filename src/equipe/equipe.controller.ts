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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';

@Controller('equipe')
export class EquipeController {
  constructor(
    private readonly equipeService: EquipeService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Roles(Role.ADMIN)
  @Post()
  async criar(@Body() dados: CreateMembroDto, @CurrentUser() ator: AuditActor) {
    const membro = await this.equipeService.criar(dados);
    if (membro.usuarioId) {
      await this.auditoria.registrar({
        acao: 'CRIAR',
        entidade: 'USUARIO',
        entidadeId: membro.usuarioId,
        resumo: `Usuário ${membro.nome} (${membro.email}) via equipe`,
        ator,
      });
    }
    return membro;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  async listarTodos() {
    return this.equipeService.listarTodos();
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateMembroDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const membro = await this.equipeService.atualizar(id, dados);
    if (membro.usuarioId) {
      await this.auditoria.registrar({
        acao: 'EDITAR',
        entidade: 'USUARIO',
        entidadeId: membro.usuarioId,
        resumo: `Usuário ${membro.nome} (${membro.email}) via equipe`,
        ator,
      });
    }
    return membro;
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipeService.remover(id);
  }
}
