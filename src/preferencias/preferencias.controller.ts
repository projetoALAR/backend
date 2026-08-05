import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PreferenciasService } from './preferencias.service';
import { CurrentUser } from '../auth/current-user.decorator';

type PreferenciaUpdateBody = {
  nome?: string;
  email?: string;
  fotoUrl?: string | null;
  notificacoes?: Record<string, boolean>;
  notificacoesLidas?: string[];
  tema?: string;
};

@Controller('preferencias')
export class PreferenciasController {
  constructor(private readonly preferenciasService: PreferenciasService) {}

  @Get()
  async obter(@CurrentUser() user: { id: string }) {
    return this.preferenciasService.obter(user.id);
  }

  @Put()
  async atualizar(
    @Body() dados: PreferenciaUpdateBody,
    @CurrentUser() user: { id: string },
  ) {
    return this.preferenciasService.atualizar(dados, user.id);
  }

  @Post('foto')
  @UseInterceptors(FileInterceptor('file'))
  async atualizarFoto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string },
  ) {
    return this.preferenciasService.atualizarFoto(file, user.id);
  }
}
