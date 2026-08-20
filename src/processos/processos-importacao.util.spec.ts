import {
  linhasDeCsvProcessos,
  MODELO_CSV_PROCESSOS,
  normalizarStatusProcesso,
  parsearTagsCsv,
} from './processos-importacao.util';

describe('processos-importacao.util', () => {
  it('mapeia o modelo oficial para linhas', () => {
    const linhas = linhasDeCsvProcessos(MODELO_CSV_PROCESSOS);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      linha: 2,
      numero: '1004521-38.2025.5.02.0001',
      status: 'Audiencia marcada',
      clienteCpf: '529.982.247-25',
    });
    expect(linhas[1]).toMatchObject({
      linha: 3,
      clienteCnpj: '45.218.903/0001-00',
      status: 'Em andamento',
    });
  });

  it('aceita aliases e ponto-e-vírgula', () => {
    const csv =
      'CNJ;Status;CPF Cliente\n0001234-56.2026.8.26.0100;Em análise;123.456.789-01\n';
    const linhas = linhasDeCsvProcessos(csv);
    expect(linhas[0]).toMatchObject({
      numero: '0001234-56.2026.8.26.0100',
      status: 'Em análise',
      clienteCpf: '123.456.789-01',
    });
  });

  it('rejeita CSV sem coluna numero', () => {
    expect(() =>
      linhasDeCsvProcessos('titulo,clienteCpf\nCaso,123\n'),
    ).toThrow(/n[uú]mero|processo/i);
  });

  it('rejeita CSV sem CPF/CNPJ do cliente', () => {
    expect(() =>
      linhasDeCsvProcessos('numero,titulo\n1,Caso\n'),
    ).toThrow(/CPF do cliente|CNPJ do cliente|clienteCpf|clienteCnpj/i);
  });

  it('normaliza status e tags', () => {
    expect(normalizarStatusProcesso(undefined)).toBe('Em andamento');
    expect(normalizarStatusProcesso('audiência marcada')).toBe(
      'Audiência marcada',
    );
    expect(normalizarStatusProcesso('Audiencia marcada')).toBe(
      'Audiência marcada',
    );
    expect(normalizarStatusProcesso('xyz')).toBeNull();
    expect(parsearTagsCsv('a|b;c,d')).toEqual(['a', 'b', 'c', 'd']);
  });
});
