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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('processos')
export class ProcessosController {
  constructor(
    private readonly processosService: ProcessosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post()
  async criar(
    @Body() dados: CreateProcessoDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const processo = await this.processosService.criar(dados, ator?.id);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'PROCESSO',
      entidadeId: processo.id,
      resumo: `Caso ${processo.titulo || processo.numero}`,
      ator,
    });
    return processo;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get('cliente/:clienteId')
  async listarPorCliente(
    @Param('clienteId', ParseUUIDPipe) clienteId: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.processosService.listarPorCliente(clienteId, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  async listarTodos(@CurrentUser() user: CasoAcessoUser) {
    return this.processosService.listarTodos(user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Put(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateProcessoDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const processo = await this.processosService.atualizar(id, dados);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'PROCESSO',
      entidadeId: processo.id,
      resumo: `Caso ${processo.titulo || processo.numero}`,
      ator,
    });
    return processo;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const processo = await this.processosService.remover(id);
    await this.auditoria.registrar({
      acao: 'EXCLUIR',
      entidade: 'PROCESSO',
      entidadeId: processo.id,
      resumo: `Caso ${processo.titulo || processo.numero}`,
      ator,
    });
    return processo;
  }
}
