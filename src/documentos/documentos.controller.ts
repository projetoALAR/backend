import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentosService } from './documentos.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { UploadDocumentoDto } from './documentos.dto';
import { DocumentoRespostaDto } from '../openapi/respostas.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { CasoAcessoUser } from '../casos-acesso/caso-acesso.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import 'multer';

@Controller('documentos')
@ApiTags('Documentos')
@ApiBearerAuth('JWT')
export class DocumentosController {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly auditoria: AuditoriaService,
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post('upload')
  @ApiCreatedResponse({ type: DocumentoRespostaDto })
  @UseInterceptors(FileInterceptor('arquivo'))
  async upload(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body() body: UploadDocumentoDto,
    @CurrentUser() ator: AuditActor & CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(ator, body.processoId);
    const doc = await this.documentosService.fazerUpload(
      body.processoId,
      arquivo,
    );
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'DOCUMENTO',
      entidadeId: doc.id,
      resumo: `Documento ${doc.nome}`,
      ator,
    });
    return doc;
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get('processo/:processoId')
  @ApiOkResponse({ type: DocumentoRespostaDto, isArray: true })
  async listarPorProcesso(
    @Param('processoId', ParseUUIDPipe) processoId: string,
    @CurrentUser() user: CasoAcessoUser,
  ) {
    await this.casoAcesso.assertPodeVer(user, processoId);
    return this.documentosService.listarPorProcesso(processoId);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  @ApiOkResponse({ type: DocumentoRespostaDto })
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() ator: AuditActor,
  ) {
    const doc = await this.documentosService.remover(id);
    await this.auditoria.registrar({
      acao: 'EXCLUIR',
      entidade: 'DOCUMENTO',
      entidadeId: doc.id,
      resumo: `Documento ${doc.nome}`,
      ator,
    });
    return doc;
  }
}
