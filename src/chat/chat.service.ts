import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LlmService } from './llm.service';
import { ChatContextService } from './chat-context.service';
import { filtrarFontesCitadas, type ChatFonte } from './chat-fonte.types';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private chatContext: ChatContextService,
  ) {}

  private async assertDonoGeral(id: string, usuarioId: string) {
    const conversa = await this.prisma.conversacao.findUnique({
      where: { id },
    });
    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    if (conversa.processoId) {
      throw new ForbiddenException(
        'Esta conversa pertence a um caso e só pode ser acessada pelo chat do painel do processo.',
      );
    }
    if (conversa.usuarioId !== usuarioId) {
      throw new ForbiddenException('Você não tem acesso a esta conversa.');
    }
    return conversa;
  }

  private async assertAcessoMensagem(id: string, usuarioId: string) {
    const conversa = await this.prisma.conversacao.findUnique({
      where: { id },
      include: {
        mensagens: {
          orderBy: { criadoEm: 'asc' },
          take: 20,
        },
      },
    });
    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    if (conversa.usuarioId !== usuarioId) {
      throw new ForbiddenException('Você não tem acesso a esta conversa.');
    }
    return conversa;
  }

  /** Apenas conversas do chat geral do usuário logado. */
  async listarConversas(usuarioId: string) {
    return this.prisma.conversacao.findMany({
      where: { processoId: null, usuarioId },
      orderBy: { atualizadoEm: 'desc' },
      include: {
        mensagens: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
        },
        _count: { select: { mensagens: true } },
      },
    });
  }

  async obterConversa(id: string, usuarioId: string) {
    await this.assertDonoGeral(id, usuarioId);
    return this.prisma.conversacao.findUnique({
      where: { id },
      include: {
        mensagens: { orderBy: { criadoEm: 'asc' } },
      },
    });
  }

  async criarConversa(
    usuarioId: string,
    dados: { titulo?: string; processoId?: string },
  ) {
    const titulo = dados.titulo?.trim() || 'Nova conversa';
    return this.prisma.conversacao.create({
      data: {
        titulo,
        processoId: null,
        usuarioId,
      },
      include: { mensagens: true },
    });
  }

  /** Chat exclusivo do caso — uma thread por usuário por processo. */
  async obterOuCriarPorProcesso(processoId: string, usuarioId: string) {
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: { id: true, titulo: true, numero: true },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    const existente = await this.prisma.conversacao.findFirst({
      where: { processoId, usuarioId },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
      orderBy: { criadoEm: 'asc' },
    });
    if (existente) return existente;

    return this.prisma.conversacao.create({
      data: {
        titulo: `Caso: ${processo.titulo || processo.numero}`,
        processoId,
        usuarioId,
      },
      include: { mensagens: true },
    });
  }

  async enviarMensagem(
    conversacaoId: string,
    conteudo: string,
    usuarioId: string,
  ) {
    const conversa = await this.assertAcessoMensagem(conversacaoId, usuarioId);

    const mensagemUsuario = await this.prisma.mensagem.create({
      data: {
        conversacaoId,
        conteudo,
        isUser: true,
      },
    });

    const historico = conversa.mensagens.map((m) => ({
      role: (m.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.conteudo,
    }));

    let resposta: string;
    let fontesResposta: ChatFonte[] = [];
    try {
      if (conversa.processoId) {
        const caso = await this.chatContext.montarContextoCaso(
          conversa.processoId,
          conteudo,
        );
        const pedeArquivos = this.chatContext.perguntaPedeArquivos(conteudo);
        resposta = await this.llm.gerarRespostaJuridica(conteudo, historico, {
          modo: 'caso',
          contextoTexto: caso.textoContexto,
          imagensUrls: caso.imagensUrls,
          detalheImagem: pedeArquivos ? 'high' : 'auto',
        });
        fontesResposta = filtrarFontesCitadas(resposta, caso.fontes);
      } else {
        const contextoProjeto = await this.chatContext.montarContexto({
          pergunta: conteudo,
        });
        resposta = await this.llm.gerarRespostaJuridica(conteudo, historico, {
          modo: 'workspace',
          contextoTexto: contextoProjeto,
        });
      }
    } catch (error) {
      // Sem mock/chave: remove a mensagem do usuário para o front poder restaurar o input
      await this.prisma.mensagem.delete({ where: { id: mensagemUsuario.id } });
      throw error;
    }

    const mensagemIa = await this.prisma.mensagem.create({
      data: {
        conversacaoId,
        conteudo: resposta,
        isUser: false,
        fontes:
          fontesResposta.length > 0
            ? (fontesResposta as object[])
            : undefined,
      },
    });

    const tituloPadrao =
      conversa.titulo === 'Nova conversa' ||
      conversa.titulo.startsWith('Caso:') ||
      conversa.titulo === 'Assistente do processo';

    await this.prisma.conversacao.update({
      where: { id: conversacaoId },
      data: {
        atualizadoEm: new Date(),
        titulo:
          !conversa.processoId && tituloPadrao
            ? conteudo.slice(0, 60)
            : conversa.titulo,
      },
    });

    return { mensagemUsuario, mensagemIa };
  }

  async removerConversa(id: string, usuarioId: string) {
    await this.assertDonoGeral(id, usuarioId);
    return this.prisma.conversacao.delete({ where: { id } });
  }
}
