import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const RESPOSTAS_MOCK = [
  'Com base nos dados do processo, recomendo revisar os prazos processuais e a documentação anexada.',
  'Esse ponto geralmente exige análise da jurisprudência recente. Posso ajudar a organizar os próximos passos.',
  'Sugiro validar as partes, o objeto e a forma do ato jurídico antes de avançar com a petição.',
  'Para esse cenário, um checklist de documentos e um cronograma de audiências costuma reduzir riscos.',
  'Entendi. Vamos priorizar os prazos mais próximos e alinhar as tarefas da equipe.',
];

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async listarConversas() {
    return this.prisma.conversacao.findMany({
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
    return conversa;
  }

  async criarConversa(dados: { titulo?: string; processoId?: string }) {
    const titulo = dados.titulo?.trim() || 'Nova conversa';
    return this.prisma.conversacao.create({
      data: {
        titulo,
        processoId: dados.processoId,
      },
      include: { mensagens: true },
    });
  }

  async obterOuCriarPorProcesso(processoId: string) {
    const existente = await this.prisma.conversacao.findFirst({
      where: { processoId },
      include: { mensagens: { orderBy: { criadoEm: 'asc' } } },
      orderBy: { criadoEm: 'asc' },
    });
    if (existente) return existente;

    return this.prisma.conversacao.create({
      data: {
        titulo: 'Assistente do processo',
        processoId,
      },
      include: { mensagens: true },
    });
  }

  async enviarMensagem(conversacaoId: string, conteudo: string) {
    const conversa = await this.prisma.conversacao.findUnique({
      where: { id: conversacaoId },
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

    const resposta =
      RESPOSTAS_MOCK[Math.floor(Math.random() * RESPOSTAS_MOCK.length)];

    const mensagemIa = await this.prisma.mensagem.create({
      data: {
        conversacaoId,
        conteudo: resposta,
        isUser: false,
      },
    });

    await this.prisma.conversacao.update({
      where: { id: conversacaoId },
      data: {
        atualizadoEm: new Date(),
        titulo:
          conversa.titulo === 'Nova conversa' ||
          conversa.titulo === 'Assistente do processo'
            ? conteudo.slice(0, 60)
            : conversa.titulo,
      },
    });

    return { mensagemUsuario, mensagemIa };
  }

  async removerConversa(id: string) {
    return this.prisma.conversacao.delete({ where: { id } });
  }
}
