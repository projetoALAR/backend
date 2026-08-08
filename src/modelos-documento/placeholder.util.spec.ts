import { PLACEHOLDERS_DISPONIVEIS, preencherModelo } from './placeholder.util';

describe('preencherModelo', () => {
  const hojeFixo = new Date(2026, 7, 7); // 07/08/2026

  it('substitui um placeholder simples', () => {
    const texto = preencherModelo('Cliente: {{cliente.nome}}', {
      cliente: { nome: 'Maria Silva' },
      hoje: hojeFixo,
    });
    expect(texto).toBe('Cliente: Maria Silva');
  });

  it('substitui múltiplas ocorrências do mesmo placeholder', () => {
    const texto = preencherModelo(
      '{{processo.numero}} — ref. {{processo.numero}}',
      {
        processo: { numero: '1000123-45.2024.8.26.0100' },
        hoje: hojeFixo,
      },
    );
    expect(texto).toBe(
      '1000123-45.2024.8.26.0100 — ref. 1000123-45.2024.8.26.0100',
    );
  });

  it('marca dado ausente como PENDENTE', () => {
    const texto = preencherModelo(
      'Tel: {{cliente.telefone}} / E-mail: {{cliente.email}}',
      {
        cliente: { nome: 'João', telefone: null, email: '  ' },
        hoje: hojeFixo,
      },
    );
    expect(texto).toContain('[PENDENTE: cliente.telefone]');
    expect(texto).toContain('[PENDENTE: cliente.email]');
  });

  it('retorna texto intacto quando não há placeholders', () => {
    const original = 'Texto livre sem tokens.';
    expect(preencherModelo(original, { hoje: hojeFixo })).toBe(original);
  });

  it('preenche data.hoje em pt-BR', () => {
    const texto = preencherModelo('Data: {{data.hoje}}', { hoje: hojeFixo });
    expect(texto).toMatch(/Data: \d{2}\/\d{2}\/\d{4}/);
  });

  it('lista os placeholders documentados', () => {
    expect(PLACEHOLDERS_DISPONIVEIS).toContain('{{cliente.nome}}');
    expect(PLACEHOLDERS_DISPONIVEIS).toContain('{{data.hoje}}');
    expect(PLACEHOLDERS_DISPONIVEIS.length).toBeGreaterThanOrEqual(9);
  });
});
