import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { AndamentosService } from './andamentos.service';
import { CreateAndamentoManualDto } from './andamentos.dto';
import { AndamentoRespostaDto } from '../openapi/respostas.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';

@Controller('processos')
@ApiTags('Andamentos')
@ApiBearerAuth('JWT')
export class AndamentosController {
  constructor(
    private readonly andamentosService: AndamentosService,
    private readonly casoAcesso: CasoAcessoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id/andamentos')
  @ApiOkResponse({ type: AndamentoRespostaDto, isArray: true })
  async listarPorProcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(user, id);
    return this.andamentosService.listarPorProcesso(id);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post(':id/andamentos')
  @ApiCreatedResponse({ type: AndamentoRespostaDto })
  async criarManual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: CreateAndamentoManualDto,
    @CurrentUser() user: CasoAcessoUser & AuditActor,
  ) {
    await this.casoAcesso.assertPodeVer(user, id);
    const andamento = await this.andamentosService.criarManual(
      id,
      dados,
      user.id,
    );
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'ANDAMENTO',
      entidadeId: andamento.id,
      resumo: `Andamento interno: ${andamento.descricao.slice(0, 80)}`,
      ator: user,
    });
    return andamento;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post(':id/andamentos/sync')
  async sincronizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(user, id);
    return this.andamentosService.sincronizarProcesso(id);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id/andamentos/:andamentoId')
  @ApiOkResponse({ type: AndamentoRespostaDto })
  async removerManual(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('andamentoId', ParseUUIDPipe) andamentoId: string,
    @CurrentUser() user: CasoAcessoUser & AuditActor,
  ) {
    await this.casoAcesso.assertPodeVer(user, id);
    const andamento = await this.andamentosService.removerManual(
      id,
      andamentoId,
    );
    await this.auditoria.registrar({
      acao: 'EXCLUIR',
      entidade: 'ANDAMENTO',
      entidadeId: andamento.id,
      resumo: `Andamento interno: ${andamento.descricao.slice(0, 80)}`,
      ator: user,
    });
    return andamento;
  }
}
