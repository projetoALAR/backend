import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Header,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
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
  @Get('importacao/modelo')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="modelo-equipe-alar.xlsx"',
  )
  async modeloImportacao() {
    const buffer = await this.equipeService.modeloXlsx();
    return new StreamableFile(buffer);
  }

  @Roles(Role.ADMIN)
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
    return this.equipeService.previewArquivo(
      arquivo.buffer,
      arquivo.originalname || 'arquivo.xlsx',
      arquivo.mimetype,
    );
  }

  @Roles(Role.ADMIN)
  @Post('importar')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async importar(
    @UploadedFile() arquivo: Express.Multer.File,
    @CurrentUser() ator: AuditActor,
    @Body('mapeamento') mapeamentoRaw?: string,
    @Body('senhaPadrao') senhaPadrao?: string,
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

    const resultado = await this.equipeService.importarArquivo(
      arquivo.buffer,
      arquivo.originalname || 'arquivo.xlsx',
      arquivo.mimetype,
      mapeamento,
      senhaPadrao,
    );
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'USUARIO',
      resumo: `Importação equipe: ${resultado.criados} criado(s), ${resultado.duplicados} duplicado(s), ${resultado.erros} erro(s) de ${resultado.total} linha(s)`,
      ator,
    });
    return resultado;
  }

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
