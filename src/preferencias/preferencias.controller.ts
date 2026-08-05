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
import { UpdatePreferenciasDto } from '../common/common.dto';

@Controller('preferencias')
export class PreferenciasController {
  constructor(private readonly preferenciasService: PreferenciasService) {}

  @Get()
  async obter(@CurrentUser() user: { id: string }) {
    return this.preferenciasService.obter(user.id);
  }

  @Put()
  async atualizar(
    @Body() dados: UpdatePreferenciasDto,
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
