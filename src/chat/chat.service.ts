import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LlmService } from './llm.service';
import { ChatContextService } from './chat-context.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private chatContext: ChatContextService,
  ) {}

  /** Apenas conversas do chat geral (sem vínculo com processo). */
  async listarConversas() {
    return this.prisma.conversacao.findMany({
      where: { processoId: null },
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

  /**
   * Abre conversa do chat geral.
   * Conversas de caso (processoId preenchido) são bloqueadas aqui.
   */
  async obterConversa(id: string) {
    const conversa = await this.prisma.conversacao.findUnique({
      where: { id },
      include: {
        mensagens: { orderBy: { criadoEm: 'asc' } },
      },
    });
    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    if (conversa.processoId) {
      throw new ForbiddenException(
        'Esta conversa pertence a um caso e só pode ser acessada pelo chat do painel do processo.',
      );
    }
    return conversa;
  }

  async criarConversa(dados: { titulo?: string; processoId?: string }) {
    // Chat geral nunca aceita processoId por esta rota pública de criação “livre”
    const titulo = dados.titulo?.trim() || 'Nova conversa';
    return this.prisma.conversacao.create({
      data: {
        titulo,
        processoId: null,
      },
      include: { mensagens: true },
    });
  }

  /** Chat exclusivo do caso — isolado do chat geral. */
  async obterOuCriarPorProcesso(processoId: string) {
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: { id: true, titulo: true, numero: true },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    const existente = await this.prisma.conversacao.findFirst({
      where: { processoId },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
      orderBy: { criadoEm: 'asc' },
    });
    if (existente) return existente;

    return this.prisma.conversacao.create({
      data: {
        titulo: `Caso: ${processo.titulo || processo.numero}`,
        processoId,
      },
      include: { mensagens: true },
    });
  }

  async enviarMensagem(conversacaoId: string, conteudo: string) {
    const conversa = await this.prisma.conversacao.findUnique({
      where: { id: conversacaoId },
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
    } else {
      const contextoProjeto = await this.chatContext.montarContexto({
        pergunta: conteudo,
      });
      resposta = await this.llm.gerarRespostaJuridica(conteudo, historico, {
        modo: 'workspace',
        contextoTexto: contextoProjeto,
      });
    }

    const mensagemIa = await this.prisma.mensagem.create({
      data: {
        conversacaoId,
        conteudo: resposta,
        isUser: false,
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

  async removerConversa(id: string) {
    const conversa = await this.prisma.conversacao.findUnique({
      where: { id },
    });
    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada.');
    }
    if (conversa.processoId) {
      throw new ForbiddenException(
        'Conversas de caso não podem ser removidas pelo chat geral.',
      );
    }
    return this.prisma.conversacao.delete({ where: { id } });
  }
}
