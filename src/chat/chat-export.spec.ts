import { exportarConversaJson, exportarConversaMarkdown } from './chat-export';

describe('chat-export', () => {
  const conversa = {
    id: 'c1',
    titulo: 'Prazos do caso Silva',
    processoId: 'p1',
    criadoEm: new Date('2026-08-12T10:00:00'),
    atualizadoEm: new Date('2026-08-12T11:00:00'),
    processo: { titulo: 'Silva vs Souza', numero: '0001234-56.2026.8.26.0100' },
    mensagens: [
      {
        id: 'm1',
        conteudo: 'Quais prazos tenho?',
        isUser: true,
        criadoEm: new Date('2026-08-12T10:05:00'),
      },
      {
        id: 'm2',
        conteudo: 'Há audiência em 15 dias.',
        isUser: false,
        criadoEm: new Date('2026-08-12T10:06:00'),
        fontes: [{ nome: 'peticao.pdf', documentoId: 'd1', tipo: 'pdf', trecho: null }],
        feedback: 'util',
        tokensUsados: 120,
      },
    ],
  };

  it('gera markdown com cabeçalho e mensagens', () => {
    const { conteudo, nomeArquivo } = exportarConversaMarkdown(conversa);
    expect(nomeArquivo).toMatch(/alar-chat-prazos-do-caso-silva\.md/);
    expect(conteudo).toContain('# Alar — Prazos do caso Silva');
    expect(conteudo).toContain('Chat do caso');
    expect(conteudo).toContain('Quais prazos tenho?');
    expect(conteudo).toContain('**Fontes consultadas:** peticao.pdf');
    expect(conteudo).toContain('_Avaliação: útil_');
  });

  it('gera json estruturado', () => {
    const { conteudo, nomeArquivo } = exportarConversaJson(conversa);
    expect(nomeArquivo).toMatch(/\.json$/);
    const parsed = JSON.parse(conteudo) as {
      conversa: { titulo: string };
      mensagens: { autor: string }[];
    };
    expect(parsed.conversa.titulo).toBe('Prazos do caso Silva');
    expect(parsed.mensagens).toHaveLength(2);
    expect(parsed.mensagens[1].autor).toBe('assistente');
  });
});
