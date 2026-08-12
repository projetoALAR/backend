import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('ChatController', () => {
  let controller: ChatController;
  const chatService = {
    listarConversas: jest.fn(),
    criarConversa: jest.fn(),
    obterOuCriarPorProcesso: jest.fn(),
    obterConversa: jest.fn(),
    enviarMensagem: jest.fn(),
    removerConversa: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: CasoAcessoService, useValue: { assertPodeVer: jest.fn() } },
      ],
    }).compile();
    controller = module.get(ChatController);
  });

  it('listarConversas usa userId', async () => {
    chatService.listarConversas.mockResolvedValue([]);
    await expect(controller.listarConversas({ id: 'u1' })).resolves.toEqual([]);
    expect(chatService.listarConversas).toHaveBeenCalledWith('u1');
  });

  it('criarConversa e obterConversa delegam', async () => {
    chatService.criarConversa.mockResolvedValue({ id: 'c1' });
    chatService.obterConversa.mockResolvedValue({ id: 'c1' });
    await expect(
      controller.criarConversa({ id: 'u1' }, { titulo: 'Geral' }),
    ).resolves.toEqual({ id: 'c1' });
    await expect(controller.obterConversa({ id: 'u1' }, 'c1')).resolves.toEqual(
      { id: 'c1' },
    );
  });

  it('porProcesso obtém ou cria conversa', async () => {
    chatService.obterOuCriarPorProcesso.mockResolvedValue({ id: 'c2' });
    await expect(
      controller.porProcesso({ id: 'u1', role: Role.ADMIN }, 'proc-1'),
    ).resolves.toEqual({ id: 'c2' });
    expect(chatService.obterOuCriarPorProcesso).toHaveBeenCalledWith(
      'proc-1',
      'u1',
    );
  });

  it('enviarMensagem e remover usam id da conversa', async () => {
    chatService.enviarMensagem.mockResolvedValue({ id: 'm1' });
    chatService.removerConversa.mockResolvedValue({ ok: true });
    await expect(
      controller.enviarMensagem({ id: 'u1' }, 'c1', {
        conteudo: 'Olá',
      }),
    ).resolves.toEqual({ id: 'm1' });
    await expect(controller.remover({ id: 'u1' }, 'c1')).resolves.toEqual({
      ok: true,
    });
  });
});
