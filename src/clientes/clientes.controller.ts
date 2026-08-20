import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Header,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import 'multer';
import { ClientesService } from './clientes.service';
import { ClientesExtracaoService } from './clientes-extracao.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { DadosClienteExtraidos } from './clientes-extracao.dto';
import { ClienteRespostaDto } from '../openapi/respostas.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';

@Controller('clientes')
@ApiTags('Clientes')
@ApiBearerAuth('JWT')
export class ClientesController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly clientesExtracao: ClientesExtracaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Preenchimento automático a partir de documento (RG, CNH, contrato social...).
   * O arquivo NUNCA é salvo — processado em memória e descartado após a extração.
   */
  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post('extrair-dados')
  @ApiCreatedResponse({ type: DadosClienteExtraidos })
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async extrairDados(
    @UploadedFile() arquivo: Express.Multer.File,
    @CurrentUser() ator: AuditActor & CasoAcessoUser,
  ) {
    return this.clientesExtracao.extrairDeArquivo(
      arquivo,
      ator.id,
      ator.role,
      ator,
    );
  }

  /** Modelo Excel (.xlsx) para migração / onboarding de escritório. */
  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Get('importacao/modelo')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="modelo-clientes-alar.xlsx"',
  )
  async modeloImportacao() {
    const buffer = await this.clientesService.modeloXlsx();
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
    return this.clientesService.previewArquivo(
      arquivo.buffer,
      arquivo.originalname || 'arquivo.xlsx',
      arquivo.mimetype,
    );
  }

  /**
   * Importa lote de clientes via Excel ou CSV (até 500 linhas).
   * Campo opcional `mapeamento` (JSON): { "0": "nome", "1": "cpf", ... }.
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

    const resultado = await this.clientesService.importarArquivo(
      arquivo.buffer,
      arquivo.originalname || 'arquivo.xlsx',
      arquivo.mimetype,
      mapeamento,
    );
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'CLIENTE',
      resumo: `Importação: ${resultado.criados} criado(s), ${resultado.duplicados} duplicado(s), ${resultado.erros} erro(s) de ${resultado.total} linha(s)`,
      ator,
    });
    return resultado;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Post()
  @ApiCreatedResponse({ type: ClienteRespostaDto })
  async criar(
    @Body() dados: CreateClienteDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.criar(dados);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Cliente ${cliente.nome}`,
      ator,
    });
    return cliente;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get()
  @ApiOkResponse({ type: ClienteRespostaDto, isArray: true })
  async listarTodos(@CurrentUser() user: CasoAcessoUser) {
    return this.clientesService.listarTodos(user);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Get(':id/export')
  async exportar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const payload = await this.clientesService.exportar(id);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'CLIENTE',
      entidadeId: id,
      resumo: `Exportação LGPD — ${payload.cliente.nome}`,
      ator,
    });
    return payload;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get(':id')
  @ApiOkResponse({ type: ClienteRespostaDto })
  async buscarPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    return this.clientesService.buscarPorId(id, user);
  }

  @Roles(Role.ADMIN)
  @Post(':id/anonimizar')
  @ApiOkResponse({ type: ClienteRespostaDto })
  async anonimizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.anonimizar(id);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Anonimização LGPD — ${cliente.nome}`,
      ator,
    });
    return cliente;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Put(':id')
  @ApiOkResponse({ type: ClienteRespostaDto })
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: UpdateClienteDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.atualizar(id, dados);
    await this.auditoria.registrar({
      acao: 'EDITAR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Cliente ${cliente.nome}`,
      ator,
    });
    return cliente;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  @ApiOkResponse({ type: ClienteRespostaDto })
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const cliente = await this.clientesService.remover(id);
    await this.auditoria.registrar({
      acao: 'EXCLUIR',
      entidade: 'CLIENTE',
      entidadeId: cliente.id,
      resumo: `Cliente ${cliente.nome}`,
      ator,
    });
    return cliente;
  }
}
