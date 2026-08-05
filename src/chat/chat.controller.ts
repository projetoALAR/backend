import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { CreateConversaDto, EnviarMensagemDto } from '../common/common.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles';

type AuthUser = { id: string };

@Controller('chat')
@Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversas')
  async listarConversas(@CurrentUser() user: AuthUser) {
    return this.chatService.listarConversas(user.id);
  }

  @Post('conversas')
  async criarConversa(
    @CurrentUser() user: AuthUser,
    @Body() dados: CreateConversaDto,
  ) {
    return this.chatService.criarConversa(user.id, dados);
  }

  @Get('conversas/processo/:processoId')
  async porProcesso(
    @CurrentUser() user: AuthUser,
    @Param('processoId', ParseUUIDPipe) processoId: string,
  ) {
    return this.chatService.obterOuCriarPorProcesso(processoId, user.id);
  }

  @Get('conversas/:id')
  async obterConversa(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.obterConversa(id, user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('conversas/:id/mensagens')
  async enviarMensagem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EnviarMensagemDto,
  ) {
    return this.chatService.enviarMensagem(id, body.conteudo, user.id);
  }

  @Delete('conversas/:id')
  async remover(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.removerConversa(id, user.id);
  }
}
