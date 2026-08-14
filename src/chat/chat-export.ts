type MensagemExport = {
  id: string;
  conteudo: string;
  isUser: boolean;
  criadoEm: Date;
  fontes?: unknown;
  feedback?: string | null;
  tokensUsados?: number | null;
};

type ConversaExport = {
  id: string;
  titulo: string;
  processoId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  processo?: { titulo: string | null; numero: string } | null;
  mensagens: MensagemExport[];
};

export type ChatExportResult = {
  titulo: string;
  nomeArquivo: string;
  conteudo: string;
};

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .toLowerCase();
}

function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rotuloFontes(fontes: unknown): string | null {
  if (!Array.isArray(fontes) || fontes.length === 0) return null;
  const nomes = fontes
    .map((f) =>
      f && typeof f === 'object' && 'nome' in f
        ? String((f as { nome: string }).nome)
        : null,
    )
    .filter(Boolean);
  return nomes.length > 0 ? nomes.join(', ') : null;
}

export function exportarConversaJson(
  conversa: ConversaExport,
): ChatExportResult {
  const slug = slugify(conversa.titulo) || 'conversa';
  const payload = {
    exportadoEm: new Date().toISOString(),
    aviso:
      'Respostas geradas por IA não substituem parecer jurídico. Revise antes de usar.',
    conversa: {
      id: conversa.id,
      titulo: conversa.titulo,
      processoId: conversa.processoId,
      processo: conversa.processo,
      criadoEm: conversa.criadoEm.toISOString(),
      atualizadoEm: conversa.atualizadoEm.toISOString(),
    },
    mensagens: conversa.mensagens.map((m) => ({
      id: m.id,
      autor: m.isUser ? 'usuario' : 'assistente',
      conteudo: m.conteudo,
      criadoEm: m.criadoEm.toISOString(),
      fontes: m.fontes ?? null,
      feedback: m.feedback ?? null,
      tokensUsados: m.tokensUsados ?? null,
    })),
  };

  return {
    titulo: conversa.titulo,
    nomeArquivo: `alar-chat-${slug}.json`,
    conteudo: JSON.stringify(payload, null, 2),
  };
}

export function exportarConversaMarkdown(
  conversa: ConversaExport,
): ChatExportResult {
  const slug = slugify(conversa.titulo) || 'conversa';
  const linhas: string[] = [
    `# Alar — ${conversa.titulo}`,
    '',
    `- **Exportado em:** ${formatarDataHora(new Date())}`,
    `- **Tipo:** ${conversa.processoId ? 'Chat do caso' : 'Chat geral do workspace'}`,
  ];

  if (conversa.processo) {
    linhas.push(
      `- **Caso:** ${conversa.processo.titulo || conversa.processo.numero} (${conversa.processo.numero})`,
    );
  }

  linhas.push(
    '',
    '> **Aviso:** respostas geradas por IA não substituem parecer jurídico. Revise antes de usar.',
    '',
    '---',
    '',
  );

  for (const msg of conversa.mensagens) {
    const autor = msg.isUser ? 'Você' : 'Assistente Alar';
    linhas.push(
      `## ${formatarDataHora(msg.criadoEm)} — ${autor}`,
      '',
      msg.conteudo,
      '',
    );
    const fontes = rotuloFontes(msg.fontes);
    if (fontes) {
      linhas.push(`**Fontes consultadas:** ${fontes}`, '');
    }
    if (msg.feedback === 'util') {
      linhas.push('_Avaliação: útil_', '');
    } else if (msg.feedback === 'nao_util') {
      linhas.push('_Avaliação: não útil_', '');
    }
    linhas.push('---', '');
  }

  return {
    titulo: conversa.titulo,
    nomeArquivo: `alar-chat-${slug}.md`,
    conteudo: linhas.join('\n').trim() + '\n',
  };
}
