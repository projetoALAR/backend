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
import { DocumentosService } from './documentos.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';
import { UploadDocumentoDto } from './documentos.dto';
import 'multer';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post('upload')
  @UseInterceptors(FileInterceptor('arquivo'))
  async upload(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body() body: UploadDocumentoDto,
  ) {
    return this.documentosService.fazerUpload(body.processoId, arquivo);
  }

  @Get('processo/:processoId')
  async listarPorProcesso(
    @Param('processoId', ParseUUIDPipe) processoId: string,
  ) {
    return this.documentosService.listarPorProcesso(processoId);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentosService.remover(id);
  }
}
