import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';

describe('LlmService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function buildService(env: Record<string, string | undefined>) {
    const config = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    return new LlmService(config);
  }

  it('sem chave e sem CHAT_ALLOW_MOCK lança ServiceUnavailable', async () => {
    const service = buildService({});
    await expect(service.gerarRespostaJuridica('olá')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('sem chave com CHAT_ALLOW_MOCK retorna demonstração explícita', async () => {
    const service = buildService({ CHAT_ALLOW_MOCK: 'true' });
    const resposta = await service.gerarRespostaJuridica('olá');
    expect(resposta.startsWith('[Modo demonstração]')).toBe(true);
  });

  it('falha HTTP retorna erro explícito (não mock silencioso)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'erro',
    });

    const service = buildService({ OPENAI_API_KEY: 'sk-test' });
    const resposta = await service.gerarRespostaJuridica('olá', [], {
      modo: 'workspace',
    });
    expect(resposta).toMatch(/Não consegui obter resposta da IA/);
    expect(resposta).not.toMatch(/\[Modo demonstração\]/);
  });
});
