import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversas')
  async listarConversas() {
    return this.chatService.listarConversas();
  }

  @Post('conversas')
  async criarConversa(
    @Body() dados: { titulo?: string; processoId?: string },
  ) {
    return this.chatService.criarConversa(dados);
  }

  @Get('conversas/processo/:processoId')
  async porProcesso(@Param('processoId') processoId: string) {
    return this.chatService.obterOuCriarPorProcesso(processoId);
  }

  @Get('conversas/:id')
  async obterConversa(@Param('id') id: string) {
    return this.chatService.obterConversa(id);
  }

  @Post('conversas/:id/mensagens')
  async enviarMensagem(
    @Param('id') id: string,
    @Body() body: { conteudo: string },
  ) {
    return this.chatService.enviarMensagem(id, body.conteudo);
  }

  @Delete('conversas/:id')
  async remover(@Param('id') id: string) {
    return this.chatService.removerConversa(id);
  }
}
