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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import 'multer';
import { ProcessosService } from './processos.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import {
  CreateProcessoDto,
  UpdateProcessoDto,
  CreateProcessoComentarioDto,
  GerarRelatorioPdfDto,
  splitCsv,
} from './processos.dto';
import { ProcessoRespostaDto } from '../openapi/respostas.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ProcessosTimelineService } from './processos-timeline.service';
import { ProcessosCapaService } from './processos-capa.service';
import { ProcessosRelatorioPdfService } from './processos-relatorio-pdf.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';
import {
  parseQueryInt,
  parseQueryString,
} from '../common/paginacao.dto';

@Controller('processos')
@ApiTags('Processos')
@ApiBearerAuth('JWT')
export class ProcessosController {
  constructor(
    private readonly processosService: ProcessosService,
    private readonly auditoria: AuditoriaService,
    private readonly timeline: ProcessosTimelineService,
    private readonly capa: ProcessosCapaService,
    private readonly relatorioPdf: ProcessosRelatorioPdfService,
  ) {}

  /** Modelo Excel (.xlsx) para migração de casos — vincular por CPF/CNPJ do cliente. */
  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Get('importacao/modelo')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="modelo-casos-alar.xlsx"',
  )
  async modeloImportacao() {
    const buffer = await this.processosService.modeloXlsxImportacao();
    return new StreamableFile(buffer);
  }

  /**
   * Lê cabeçalhos da planilha e sugere mapeamento para os campos Alar.
   */
  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post('importar/preview')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async previewImportacao(@UploadedFile() arquivo: Express.Multer.File) {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException(
        'Envie um arquivo Excel (.xlsx) ou CSV no campo "arquivo".',
      );
    }
    return this.processosService.previewArquivo(
      arquivo.buffer,
      arquivo.originalname || 'arquivo.xlsx',
      arquivo.mimetype,
    );
  }

  /**
   * Importa lote de casos via Excel ou CSV (até 500 linhas).
   * Campo opcional `mapeamento` (JSON): { "0": "numero", "1": "clienteCpf", ... }.
   */
  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post('importar')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async importar(
    @UploadedFile() arquivo: Express.Multer.File,
    @CurrentUser() ator: AuditActor,
    @Body('mapeamento') mapeamentoRaw?: string,
  ) {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException(
        'Envie um arquivo Excel (.xlsx) ou CSV no campo "arquivo".',
      );
    }
    const nome = (arquivo.originalname || '').toLowerCase();
    const mime = (arquivo.mimetype || '').toLowerCase();
    const ok =
      nome.endsWith('.xlsx') ||
      nome.endsWith('.csv') ||
      mime.includes('spreadsheet') ||
      mime.includes('csv') ||
      mime === 'text/plain' ||
      mime === 'application/vnd.ms-excel';
    if (!ok) {
      throw new BadRequestException('Envie um arquivo .xlsx ou .csv.');
    }

    let mapeamento: Record<string, string | null> | undefined;
    if (mapeamentoRaw?.trim()) {
      try {
        mapeamento = JSON.parse(mapeamentoRaw) as Record<
          string,
          string | null
        >;
      } catch {
        throw new BadRequestException('mapeamento JSON inválido.');
      }
    }

    const resultado = await this.processosService.importarArquivo(
      arquivo.buffer,
      arquivo.originalname || 'arquivo.xlsx',
      arquivo.mimetype,
      ator?.id,
      mapeamento,
    );
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'PROCESSO',
      resumo: `Importação: ${resultado.criados} criado(s), ${resultado.duplicados} duplicado(s), ${resultado.erros} erro(s) de ${resultado.total} linha(s)`,
      ator,
    });
    return resultado;
  }

  /**
   * PDF do relatório de casos — admin envia o recorte já filtrado no front.
   */
  @Roles(Role.ADMIN)
  @Post('relatorio/pdf')
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  async baixarRelatorioPdf(@Body() body: GerarRelatorioPdfDto) {
    const { buffer, filename } = await this.relatorioPdf.gerar(body);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

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
  async listarTodos(
    @CurrentUser() user: CasoAcessoUser,
    // Query por nome: ValidationPipe+whitelist pode esvaziar o DTO em prod.
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('situacao') situacao?: string,
    @Query('status') status?: string | string[],
    @Query('prioridade') prioridade?: string | string[],
    @Query('prazoDe') prazoDe?: string,
    @Query('prazoAte') prazoAte?: string,
  ) {
    const situacaoOk =
      situacao === 'ativos' || situacao === 'concluidos'
        ? situacao
        : undefined;
    return this.processosService.listarTodos(user, {
      page: parseQueryInt(page),
      limit: parseQueryInt(limit),
      q: parseQueryString(q),
      situacao: situacaoOk,
      status: splitCsv(status),
      prioridade: splitCsv(prioridade),
      prazoDe: parseQueryString(prazoDe),
      prazoAte: parseQueryString(prazoAte),
    });
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
