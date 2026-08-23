import { valorDoPlano, isPlanoId } from './planos.config';

describe('planos.config', () => {
  it('reconhece planos válidos', () => {
    expect(isPlanoId('profissional')).toBe(true);
    expect(isPlanoId('outro')).toBe(false);
  });

  it('calcula valor mensal e anual', () => {
    expect(valorDoPlano('essencial', 'MONTHLY')).toBe(197);
    expect(valorDoPlano('profissional', 'YEARLY')).toBe(3970);
  });
});
