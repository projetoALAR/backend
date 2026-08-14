import { ConfigService } from '@nestjs/config';
import { DatajudService } from './datajud.service';

/** CNJ válido para TJSP (J=8, TR=26) com dígito verificador calculado pela regra do CNJ. */
const CNJ_VALIDO = '0000001-46.2024.8.26.0100';

function criarServico(config: Record<string, string> = {}) {
  return new DatajudService({
    get: (key: string) => config[key],
  } as ConfigService);
}

describe('DatajudService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('recusa consulta sem DATAJUD_API_KEY configurada', async () => {
    const service = criarServico({});
    const resultado = await service.consultarPorNumero(CNJ_VALIDO);
    expect(resultado).toEqual(
      expect.objectContaining({ ok: false, motivo: 'sem_api_key' }),
    );
  });

  it('rejeita número CNJ com tamanho inválido', async () => {
    const service = criarServico({ DATAJUD_API_KEY: 'chave' });
    const resultado = await service.consultarPorNumero('123');
    expect(resultado).toEqual(
      expect.objectContaining({ ok: false, motivo: 'erro' }),
    );
  });

  it('rejeita número CNJ com dígito verificador inválido', async () => {
    const service = criarServico({ DATAJUD_API_KEY: 'chave' });
    const resultado = await service.consultarPorNumero(
      '0000001-99.2024.8.26.0100',
    );
    expect(resultado).toEqual(
      expect.objectContaining({ ok: false, motivo: 'cnj_invalido' }),
    );
  });

  it('rejeita tribunal sem índice público no DataJud (STF)', async () => {
    const service = criarServico({ DATAJUD_API_KEY: 'chave' });
    // CNJ válido (dígito verificador correto) com J=1 (STF, sem índice público).
    const resultado = await service.consultarPorNumero(
      '0000001-84.2024.1.00.0000',
    );
    expect(resultado).toEqual(
      expect.objectContaining({ ok: false, motivo: 'tribunal_nao_mapeado' }),
    );
  });

  it('consulta a API pública e mapeia movimentos válidos', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          hits: {
            hits: [
              {
                _source: {
                  movimentos: [
                    {
                      codigo: 26,
                      nome: 'Distribuição',
                      dataHora: '2024-01-10T12:00:00.000Z',
                    },
                    // sem nome — deve ser filtrado
                    { codigo: 1, dataHora: '2024-01-11T12:00:00.000Z' },
                    // sem dataHora — deve ser filtrado
                    { codigo: 2, nome: 'Sem data' },
                    // dataHora inválida — deve ser filtrado
                    {
                      codigo: 3,
                      nome: 'Data inválida',
                      dataHora: 'não-é-uma-data',
                    },
                  ],
                },
              },
            ],
          },
        }),
    });
    const service = criarServico({ DATAJUD_API_KEY: 'chave' });

    const resultado = await service.consultarPorNumero(CNJ_VALIDO);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('esperava ok=true');
    expect(resultado.tribunalSigla).toBe('tjsp');
    expect(resultado.movimentos).toHaveLength(1);
    expect(resultado.movimentos[0]).toEqual(
      expect.objectContaining({
        descricao: 'Distribuição',
        codigoMovimento: 26,
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api_publica_tjsp'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'APIKey chave' }),
      }),
    );
  });

  it('retorna nao_encontrado quando a base não tem hits', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hits: { hits: [] } }),
    });
    const service = criarServico({ DATAJUD_API_KEY: 'chave' });

    const resultado = await service.consultarPorNumero(CNJ_VALIDO);
    expect(resultado).toEqual(
      expect.objectContaining({ ok: false, motivo: 'nao_encontrado' }),
    );
  });

  it('propaga erro HTTP não recuperável (sem retry)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('requisição inválida'),
    });
    const service = criarServico({ DATAJUD_API_KEY: 'chave' });

    const resultado = await service.consultarPorNumero(CNJ_VALIDO);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('esperava ok=false');
    expect(resultado.motivo).toBe('erro');
    expect(resultado.mensagem).toContain('HTTP 400');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('tenta novamente em 5xx/429 e desiste após esgotar tentativas', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('indisponível'),
    });
    const service = criarServico({ DATAJUD_API_KEY: 'chave' });

    const promise = service.consultarPorNumero(CNJ_VALIDO);
    await jest.runAllTimersAsync();
    const resultado = await promise;

    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('esperava ok=false');
    expect(resultado.motivo).toBe('erro');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
