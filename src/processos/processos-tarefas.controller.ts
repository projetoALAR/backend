import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';
import {
  CreateProcessoTarefaDto,
  UpdateProcessoTarefaDto,
} from './processos.dto';
import { ProcessoTarefaRespostaDto } from '../openapi/respostas.dto';
import { ProcessosTarefasService } from './processos-tarefas.service';

@Controller('processos')
@ApiTags('Processos')
@ApiBearerAuth('JWT')
export class ProcessosTarefasController {
  constructor(
    private readonly tarefas: ProcessosTarefasService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id/tarefas')
  @ApiOkResponse({ type: ProcessoTarefaRespostaDto, isArray: true })
  listar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.tarefas.listar(id, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post(':id/tarefas')
  @ApiCreatedResponse({ type: ProcessoTarefaRespostaDto })
  async criar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: CreateProcessoTarefaDto,
    @CurrentUser() user: CasoAcessoUser & AuditActor,
  ) {
    const tarefa = await this.tarefas.criar(id, user, dados);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'TAREFA',
      entidadeId: tarefa.id,
      resumo: `Tarefa "${tarefa.titulo}" no caso`,
      ator: user,
    });
    return tarefa;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Put(':id/tarefas/:tarefaId')
  @ApiOkResponse({ type: ProcessoTarefaRespostaDto })
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tarefaId', ParseUUIDPipe) tarefaId: string,
    @Body() dados: UpdateProcessoTarefaDto,
    @CurrentUser() user: CasoAcessoUser & AuditActor,
  ) {
    const tarefa = await this.tarefas.atualizar(id, tarefaId, user, dados);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'TAREFA',
      entidadeId: tarefa.id,
      resumo: tarefa.concluida
        ? `Concluiu "${tarefa.titulo}"`
        : `Atualizou "${tarefa.titulo}"`,
      ator: user,
    });
    return tarefa;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id/tarefas/:tarefaId')
  @ApiOkResponse({ type: ProcessoTarefaRespostaDto })
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tarefaId', ParseUUIDPipe) tarefaId: string,
    @CurrentUser() user: CasoAcessoUser & AuditActor,
  ) {
    const tarefa = await this.tarefas.remover(id, tarefaId, user);
    await this.auditoria.registrar({
      acao: 'EXCLUIR',
      entidade: 'TAREFA',
      entidadeId: tarefa.id,
      resumo: `Tarefa "${tarefa.titulo}"`,
      ator: user,
    });
    return tarefa;
  }
}
