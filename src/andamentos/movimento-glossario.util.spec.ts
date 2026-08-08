import {
  explicarMovimento,
  listarCodigosGlossario,
} from './movimento-glossario.util';

describe('explicarMovimento', () => {
  it('explica códigos mapeados comuns', () => {
    expect(explicarMovimento(26, 'Distribuição')).toMatch(/vara/i);
    expect(explicarMovimento(51, 'Conclusão')).toMatch(/juiz/i);
    expect(explicarMovimento(971, 'Sentença')).toMatch(/sentença/i);
    expect(explicarMovimento(1051, 'Trânsito em julgado')).toMatch(
      /transitou em julgado/i,
    );
  });

  it('retorna null para código desconhecido', () => {
    expect(explicarMovimento(999999, 'Movimento obscuro')).toBeNull();
  });

  it('retorna null quando código é nulo ou inválido', () => {
    expect(explicarMovimento(null, 'Qualquer')).toBeNull();
    expect(explicarMovimento(undefined, 'Qualquer')).toBeNull();
    expect(explicarMovimento(Number.NaN, 'Qualquer')).toBeNull();
  });

  it('glossário cobre pelo menos 20 códigos', () => {
    expect(listarCodigosGlossario().length).toBeGreaterThanOrEqual(20);
  });
});
