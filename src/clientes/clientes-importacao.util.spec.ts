import {
  linhasDeCsv,
  MODELO_CSV_CLIENTES,
  parsearCsv,
} from './clientes-importacao.util';

describe('clientes-importacao.util', () => {
  it('parseia CSV com aspas e vírgula interna', () => {
    const rows = parsearCsv('a,b\n"Rua X, 10",SP\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['Rua X, 10', 'SP'],
    ]);
  });

  it('mapeia o modelo oficial para linhas', () => {
    const linhas = linhasDeCsv(MODELO_CSV_CLIENTES);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      linha: 2,
      nome: 'Marina Souza Lima',
      tipo: 'PF',
      cpf: '529.982.247-25',
    });
    expect(linhas[1]).toMatchObject({
      linha: 3,
      nome: 'Horizonte Atacado Ltda',
      tipo: 'PJ',
      cnpj: '45.218.903/0001-00',
      nomeFantasia: 'Horizonte Atacado',
    });
  });

  it('modelo usa ponto-e-vírgula e BOM para Excel BR', () => {
    expect(MODELO_CSV_CLIENTES.startsWith('\uFEFF')).toBe(true);
    expect(MODELO_CSV_CLIENTES).toContain('nome;tipo;cpf');
  });

  it('aceita aliases e ponto-e-vírgula', () => {
    const csv =
      'Razão Social;Tipo Pessoa;CPF\nAna Clara;PF;123.456.789-01\n';
    const linhas = linhasDeCsv(csv);
    expect(linhas[0]).toMatchObject({
      nome: 'Ana Clara',
      tipo: 'PF',
      cpf: '123.456.789-01',
    });
  });

  it('rejeita CSV sem coluna nome', () => {
    expect(() => linhasDeCsv('cpf,email\n123,a@b.com\n')).toThrow(/nome/i);
  });
});
