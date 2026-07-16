import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentosService } from './documentos.service';
import 'multer';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('arquivo')) // Intercepta o campo 'arquivo' do formulário
  async upload(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('processoId') processoId: string,
  ) {
    return this.documentosService.fazerUpload(processoId, arquivo);
  }

  @Get('processo/:processoId')
  async listarPorProcesso(@Param('processoId') processoId: string) {
    return this.documentosService.listarPorProcesso(processoId);
  }
}