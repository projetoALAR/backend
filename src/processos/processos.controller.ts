import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  Header,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ProcessosService } from './processos.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import {
  CreateProcessoDto,
  UpdateProcessoDto,
  CreateProcessoComentarioDto,
} from './processos.dto';
import { ProcessoRespostaDto } from '../openapi/respostas.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ProcessosTimelineService } from './processos-timeline.service';
import { ProcessosCapaService } from './processos-capa.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('processos')
@ApiTags('Processos')
@ApiBearerAuth('JWT')
export class ProcessosController {
  constructor(
    private readonly processosService: ProcessosService,
    private readonly auditoria: AuditoriaService,
    private readonly timeline: ProcessosTimelineService,
    private readonly capa: ProcessosCapaService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post()
  @ApiCreatedResponse({ type: ProcessoRespostaDto })
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
  @ApiOkResponse({ type: ProcessoRespostaDto, isArray: true })
  async listarPorCliente(
    @Param('clienteId', ParseUUIDPipe) clienteId: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.processosService.listarPorCliente(clienteId, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  @ApiOkResponse({ type: ProcessoRespostaDto, isArray: true })
  async listarTodos(@CurrentUser() user: CasoAcessoUser) {
    return this.processosService.listarTodos(user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id')
  @ApiOkResponse({ type: ProcessoRespostaDto })
  async buscarPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.processosService.buscarPorId(id, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id/capa')
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  async baixarCapa(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    const { buffer, filename } = await this.capa.gerar(id, user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id/timeline')
  async timelineDoProcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.timeline.listar(id, user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post(':id/comentarios')
  async comentarProcesso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: CreateProcessoComentarioDto,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.timeline.comentar(id, user, dados.texto);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Put(':id')
  @ApiOkResponse({ type: ProcessoRespostaDto })
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
  @ApiOkResponse({ type: ProcessoRespostaDto })
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
