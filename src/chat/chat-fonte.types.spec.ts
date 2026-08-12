import {
  extrairTrechoRelevante,
  filtrarFontesCitadas,
} from './chat-fonte.types';

describe('chat-fonte', () => {
  it('extrai trecho curto quando texto cabe', () => {
    expect(extrairTrechoRelevante('abc', 'pergunta')).toBe('abc');
  });

  it('filtra fontes mencionadas na resposta', () => {
    const fontes = [
      {
        documentoId: '1',
        nome: 'peticao.pdf',
        trecho: 'Pedimos a condenação',
        tipo: 'pdf' as const,
      },
      {
        documentoId: '2',
        nome: 'outro.txt',
        trecho: 'irrelevante',
        tipo: 'texto' as const,
      },
    ];
    const res = filtrarFontesCitadas(
      'Conforme peticao.pdf, o pedido é...',
      fontes,
    );
    expect(res.some((f) => f.nome === 'peticao.pdf')).toBe(true);
  });
});
