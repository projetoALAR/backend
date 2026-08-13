import { montarEmailAlar } from './email-template';

describe('montarEmailAlar', () => {
  it('inclui título e corpo no HTML e texto plano', () => {
    const { html, text } = montarEmailAlar({
      titulo: 'Prazo amanhã',
      corpo: 'Audiência do caso Silva.',
      appUrl: 'https://app.alar.com.br',
    });

    expect(html).toContain('Prazo amanhã');
    expect(html).toContain('Audiência do caso Silva.');
    expect(html).toContain('Alar');
    expect(text).toContain('Prazo amanhã');
    expect(text).toContain('Audiência do caso Silva.');
  });

  it('monta link absoluto a partir de path relativo', () => {
    const { html } = montarEmailAlar({
      titulo: 'Novo andamento',
      corpo: 'Confira o processo.',
      link: '/casos/abc',
      appUrl: 'https://app.alar.com.br',
    });

    expect(html).toContain('https://app.alar.com.br/casos/abc');
  });

  it('escapa HTML no corpo', () => {
    const { html } = montarEmailAlar({
      titulo: 'Alerta',
      corpo: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
