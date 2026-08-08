import { ServiceUnavailableException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma.service';
import { LlmService } from './llm.service';
import { ChatContextService } from './chat-context.service';

describe('ChatService.enviarMensagem', () => {
  const usuarioId = 'user-1';
  const conversacaoId = 'conv-1';

  const prisma = {
    conversacao: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mensagem: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const llm = {
    gerarRespostaJuridica: jest.fn(),
  };

  const chatContext = {
    montarContexto: jest.fn(),
    montarContextoCaso: jest.fn(),
    perguntaPedeArquivos: jest.fn(),
  };

  let service: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(
      prisma as unknown as PrismaService,
      llm as unknown as LlmService,
      chatContext as unknown as ChatContextService,
    );

    prisma.conversacao.findUnique.mockResolvedValue({
      id: conversacaoId,
      usuarioId,
      processoId: null,
      titulo: 'Nova conversa',
      mensagens: [],
    });
    prisma.mensagem.create.mockResolvedValueOnce({
      id: 'msg-user',
      conteudo: 'olá',
      isUser: true,
    });
  });

  it('remove mensagem do usuário se a IA estiver indisponível', async () => {
    llm.gerarRespostaJuridica.mockRejectedValue(
      new ServiceUnavailableException('sem chave'),
    );
    chatContext.montarContexto.mockResolvedValue('ctx');

    await expect(
      service.enviarMensagem(conversacaoId, 'olá', usuarioId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.mensagem.delete).toHaveBeenCalledWith({
      where: { id: 'msg-user' },
    });
  });

  it('persiste resposta da IA em conversa de workspace', async () => {
    chatContext.montarContexto.mockResolvedValue('ctx');
    llm.gerarRespostaJuridica.mockResolvedValue('resposta jurídica');
    prisma.mensagem.create.mockResolvedValueOnce({
      id: 'msg-ia',
      conteudo: 'resposta jurídica',
      isUser: false,
    });
    prisma.conversacao.update.mockResolvedValue({});

    const result = await service.enviarMensagem(
      conversacaoId,
      'olá',
      usuarioId,
    );

    expect(result.mensagemIa.conteudo).toBe('resposta jurídica');
    expect(llm.gerarRespostaJuridica).toHaveBeenCalledWith(
      'olá',
      [],
      expect.objectContaining({ modo: 'workspace' }),
    );
  });
});
