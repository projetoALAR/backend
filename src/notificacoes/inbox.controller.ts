import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificacoesService } from './notificacoes.service';
import { CreateContatoDto } from '../common/common.dto';

@Controller()
export class InboxController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  @Get('inbox')
  async listar(
    @CurrentUser() user: { id: string },
    @Query('apenasNaoLidas') apenasNaoLidas?: string,
  ) {
    return this.prisma.inboxItem.findMany({
      where: {
        usuarioId: user.id,
        ...(apenasNaoLidas === 'true' ? { lida: false } : {}),
      },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
  }

  @Put('inbox/:id/lida')
  async marcarLida(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.prisma.inboxItem.updateMany({
      where: { id, usuarioId: user.id },
      data: { lida: true },
    });
  }

  @Post('inbox/marcar-todas-lidas')
  async marcarTodas(@CurrentUser() user: { id: string }) {
    return this.prisma.inboxItem.updateMany({
      where: { usuarioId: user.id, lida: false },
      data: { lida: true },
    });
  }

  @Post('contatos')
  async registrarContato(
    @CurrentUser() user: { id: string },
    @Body() body: CreateContatoDto,
  ) {
    const log = await this.prisma.contatoLog.create({
      data: {
        usuarioId: user.id,
        alvoTipo: body.alvoTipo,
        alvoId: body.alvoId,
        alvoNome: body.alvoNome,
        canal: body.canal,
        observacao: body.observacao,
      },
    });

    await this.notificacoes.criarInbox({
      usuarioId: user.id,
      titulo: `Contato ${body.canal} — ${body.alvoNome}`,
      corpo:
        body.observacao ||
        `Você iniciou contato por ${body.canal}${body.destino ? ` (${body.destino})` : ''}.`,
      tipo: 'contato',
    });

    return log;
  }

  @Get('contatos')
  async listarContatos(@CurrentUser() user: { id: string }) {
    return this.prisma.contatoLog.findMany({
      where: { usuarioId: user.id },
      orderBy: { criadoEm: 'desc' },
      take: 30,
    });
  }
}
