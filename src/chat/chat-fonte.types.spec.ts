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
    expect(res).toHaveLength(1);
    expect(res[0]?.nome).toBe('peticao.pdf');
  });

  it('reconhece citação pelo nome sem extensão', () => {
    const fontes = [
      {
        documentoId: '1',
        nome: 'Peticao inicial - reclamacao trabalhista.pdf',
        trecho: 'Pedimos',
        tipo: 'pdf' as const,
      },
    ];
    const res = filtrarFontesCitadas(
      'Segundo a Peticao inicial - reclamacao trabalhista, o risco é...',
      fontes,
    );
    expect(res).toHaveLength(1);
  });
});
