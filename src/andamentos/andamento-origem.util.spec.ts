import { isAndamentoManual } from './andamento-origem.util';

describe('isAndamentoManual', () => {
  it('reconhece origem lançada pela equipe', () => {
    expect(isAndamentoManual({ tipo: 'manual', usuarioId: 'u1' })).toBe(true);
  });

  it('rejeita payload de tribunal e valores vazios', () => {
    expect(isAndamentoManual({ codigo: 26 })).toBe(false);
    expect(isAndamentoManual(null)).toBe(false);
    expect(isAndamentoManual('manual')).toBe(false);
  });
});
