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
    expect(resposta.content.startsWith('[Modo demonstração]')).toBe(true);
  });

  it('falha HTTP retorna erro explícito (não mock silencioso)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('erro'),
    });

    const service = buildService({ OPENAI_API_KEY: 'sk-test' });
    const resposta = await service.gerarRespostaJuridica('olá', [], {
      modo: 'workspace',
    });
    expect(resposta.content).toMatch(/Não consegui obter resposta da IA/);
    expect(resposta.content).not.toMatch(/\[Modo demonstração\]/);
  });

  describe('gerarTextoDocumento', () => {
    it('sem chave e sem CHAT_ALLOW_MOCK lança ServiceUnavailable', async () => {
      const service = buildService({});
      await expect(
        service.gerarTextoDocumento('petição'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('sem chave com CHAT_ALLOW_MOCK retorna marca de conteúdo fictício', async () => {
      const service = buildService({ CHAT_ALLOW_MOCK: 'true' });
      const texto = await service.gerarTextoDocumento('gere uma petição');
      expect(texto).toMatch(/CONTEÚDO FICTÍCIO GERADO PARA TESTE/);
      expect(texto).toMatch(/\[Modo demonstração\]/);
    });

    it('com chave chama a API e devolve o conteúdo', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content:
                    '[CONTEÚDO FICTÍCIO GERADO PARA TESTE]\n\nPetição inicial simulada.',
                },
              },
            ],
            usage: { total_tokens: 250 },
          }),
      });

      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      const texto = await service.gerarTextoDocumento('gere uma petição');
      expect(texto).toMatch(/Petição inicial simulada/);
      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      ) as { messages: { role: string; content: string }[] };
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toMatch(/PLAUSÍVEIS e GENÉRICOS/);
    });

    it('proposito rascunho usa prompt anti-alucinação', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content:
                    'Rascunho ok\n\nRascunho gerado por IA — revise antes de usar. Não substitui a análise de um advogado habilitado.',
                },
              },
            ],
            usage: { total_tokens: 100 },
          }),
      });

      const service = buildService({ OPENAI_API_KEY: 'sk-test' });
      await service.gerarTextoDocumento('gere petição', {
        proposito: 'rascunho',
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      ) as { messages: { role: string; content: string }[] };
      expect(body.messages[0].content).toMatch(/NÃO invente jurisprudência/);
      expect(body.messages[0].content).toMatch(/revisão humana/);
    });
  });
});
