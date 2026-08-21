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

  it('não anexa fontes só porque têm trecho, se o modelo não citou o nome', () => {
    const fontes = [
      {
        documentoId: '1',
        nome: 'contrato.pdf',
        trecho: 'Cláusula 1',
        tipo: 'pdf' as const,
      },
    ];
    expect(
      filtrarFontesCitadas('Resumo genérico sem citar arquivo.', fontes),
    ).toEqual([]);
  });
});
