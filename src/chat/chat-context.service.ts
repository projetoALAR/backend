import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';

export type CasoLlmAnexo = {
  textoContexto: string;
  imagensUrls: string[];
};

const IMAGE_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'tif',
  'tiff',
]);
const TEXT_EXT = new Set([
  'txt',
  'md',
  'csv',
  'json',
  'xml',
  'html',
  'htm',
  'log',
  'rtf',
]);
const VIDEO_EXT = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv']);
const MAX_IMAGES = 8;
const MAX_TEXT_CHARS_PER_FILE = 12_000;
const MAX_TEXT_FILES = 10;
const MAX_PDF_FILES = 5;
const MAX_PDF_CHARS_PER_FILE = 15_000;

@Injectable()
export class ChatContextService {
  private readonly logger = new Logger(ChatContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentosService,
  ) {}

  /**
   * Snapshot AGREGADO do workspace para o chat geral (/chat).
   * Privacidade: NÃO inclui descrição, cliente, documentos nem conteúdo dos casos.
   * Pode expor apenas totais + título/status dos processos.
   */
  async montarContexto(opcoes?: {
    processoId?: string | null;
    pergunta?: string;
  }): Promise<string> {
    void opcoes;
    const agora = new Date();

    const [
      totalClientes,
      totalProcessos,
      processosConcluidos,
      processosAtivos,
      processosPorStatus,
      porPrioridade,
      totalMembros,
      membrosAtivos,
      ativosResumo,
      concluidosResumo,
    ] = await Promise.all([
      this.prisma.cliente.count(),
      this.prisma.processo.count(),
      this.prisma.processo.count({ where: { concluido: true } }),
      this.prisma.processo.count({ where: { concluido: false } }),
      this.prisma.processo.groupBy({
        by: ['status'],
        _count: { status: true },
        orderBy: { _count: { status: 'desc' } },
      }),
      this.prisma.processo.groupBy({
        by: ['prioridade'],
        where: { concluido: false },
        _count: { prioridade: true },
      }),
      this.prisma.membroEquipe.count(),
      this.prisma.membroEquipe.count({ where: { status: 'active' } }),
      this.prisma.processo.findMany({
        where: { concluido: false },
        take: 50,
        orderBy: { atualizadoEm: 'desc' },
        select: {
          titulo: true,
          numero: true,
          status: true,
        },
      }),
      this.prisma.processo.findMany({
        where: { concluido: true },
        take: 20,
        orderBy: { atualizadoEm: 'desc' },
        select: {
          titulo: true,
          numero: true,
          status: true,
        },
      }),
    ]);

    const linhas: string[] = [
      '=== DADOS AGREGADOS DO WORKSPACE (chat geral — sem detalhes sensíveis de casos) ===',
      `Gerado em: ${agora.toISOString()}`,
      '',
      '## Totais',
      `- Clientes cadastrados (quantidade): ${totalClientes}`,
      `- Processos/casos totais: ${totalProcessos}`,
      `- Casos ATIVOS: ${processosAtivos}`,
      `- Casos concluídos: ${processosConcluidos}`,
      `- Membros da equipe: ${totalMembros} (${membrosAtivos} ativos)`,
      '',
      '## Quantidade por status',
    ];

    if (processosPorStatus.length === 0) {
      linhas.push('- (nenhum)');
    } else {
      for (const row of processosPorStatus) {
        linhas.push(`- ${row.status || 'Sem status'}: ${row._count.status}`);
      }
    }

    linhas.push('', '## Quantidade de ativos por prioridade');
    if (porPrioridade.length === 0) {
      linhas.push('- (nenhum)');
    } else {
      for (const row of porPrioridade) {
        linhas.push(
          `- ${row.prioridade || 'Sem prioridade'}: ${row._count.prioridade}`,
        );
      }
    }

    linhas.push(
      '',
      '## Casos ativos (somente número + título + status — SEM detalhes internos)',
    );
    if (ativosResumo.length === 0) {
      linhas.push('- Nenhum caso ativo.');
    } else {
      for (const p of ativosResumo) {
        linhas.push(
          `- ${p.numero} | ${p.titulo || '(sem título)'} | status: ${p.status}`,
        );
      }
    }

    if (concluidosResumo.length > 0) {
      linhas.push(
        '',
        '## Casos concluídos recentes (somente número + título + status)',
      );
      for (const p of concluidosResumo) {
        linhas.push(
          `- ${p.numero} | ${p.titulo || '(sem título)'} | status: ${p.status}`,
        );
      }
    }

    linhas.push(
      '',
      '## PRIVACIDADE — OBRIGATÓRIO',
      '- Você NÃO tem acesso a: descrição do caso, cliente (nome/CPF/contato), documentos, imagens, vídeos, conteúdo de arquivos, tags detalhadas, compromissos internos nem histórico do chat do caso.',
      '- Se pedirem resumo, análise, documentos ou dados internos de um caso específico, recuse e oriente a abrir o chat DENTRO do painel daquele caso.',
      '- Pode informar quantidade de casos e listar títulos/números/status públicos acima.',
      '- Não invente detalhes sobre o interior de nenhum caso.',
    );

    return linhas.join('\n');
  }

  /**
   * Contexto EXCLUSIVO de um caso/processo + anexos (chat do painel do caso).
   * Não inclui dados de outros processos.
   */
  async montarContextoCaso(
    processoId: string,
    pergunta = '',
  ): Promise<CasoLlmAnexo> {
    void pergunta;
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      include: {
        cliente: true,
        compromissos: { orderBy: { dataHora: 'asc' } },
        documentos: { orderBy: { criadoEm: 'desc' } },
        _count: { select: { documentos: true, compromissos: true } },
      },
    });

    if (!processo) {
      throw new NotFoundException(
        'Processo não encontrado para o chat do caso.',
      );
    }

    const linhas: string[] = [
      '=== CONTEXTO COMPLETO DESTE CASO ===',
      `Atualizado em: ${new Date().toISOString()}`,
      '',
      '## Processo',
      `- Número: ${processo.numero}`,
      `- Título: ${processo.titulo || '(sem título)'}`,
      `- Status: ${processo.status}`,
      `- Concluído: ${processo.concluido ? 'sim' : 'não (ativo)'}`,
      `- Prioridade: ${processo.prioridade || '-'}`,
      `- Prazo: ${processo.prazo?.toISOString().slice(0, 10) || '-'}`,
      `- Descrição / objeto: ${processo.descricao || '-'}`,
      `- Tags: ${this.formatTags(processo.tags)}`,
      `- Criado em: ${processo.criadoEm.toISOString().slice(0, 10)}`,
      `- Atualizado em: ${processo.atualizadoEm.toISOString().slice(0, 10)}`,
      '',
      '## Cliente',
      `- Nome: ${processo.cliente.nome}`,
      `- CPF: ${processo.cliente.cpf}`,
      `- E-mail: ${processo.cliente.email || '-'}`,
      `- Telefone: ${processo.cliente.telefone || '-'}`,
      '',
      `## Compromissos / agenda (${processo._count.compromissos})`,
    ];

    if (processo.compromissos.length === 0) {
      linhas.push('- Nenhum compromisso vinculado.');
    } else {
      for (const c of processo.compromissos) {
        linhas.push(
          `- ${c.dataHora.toISOString()} | ${c.titulo}${c.descricao ? ` | ${c.descricao}` : ''}`,
        );
      }
    }

    linhas.push('', `## Arquivos do caso (${processo._count.documentos})`);

    const imagensUrls: string[] = [];
    const textosExtraidos: string[] = [];
    let textFilesUsed = 0;
    let pdfFilesUsed = 0;

    if (processo.documentos.length === 0) {
      linhas.push('- Nenhum arquivo anexado ainda.');
    } else {
      for (const doc of processo.documentos) {
        const ext = this.extensao(doc.nome);
        const tipo = this.classificarArquivo(ext);
        const tamanho = doc.tamanho != null ? `${doc.tamanho} bytes` : '?';
        const signedUrl = await this.documentos.resolveSignedUrl(doc.urlArquivo);

        linhas.push(
          `- [${tipo}] ${doc.nome} | ${tamanho} | enviado: ${doc.criadoEm.toISOString().slice(0, 10)} | acesso: ${signedUrl ? 'URL assinada temporária' : 'falhou'}`,
        );

        if (tipo === 'imagem' && signedUrl && imagensUrls.length < MAX_IMAGES) {
          imagensUrls.push(signedUrl);
        }

        if (tipo === 'texto' && signedUrl && textFilesUsed < MAX_TEXT_FILES) {
          const texto = await this.baixarTexto(signedUrl, doc.nome);
          if (texto) {
            textFilesUsed += 1;
            textosExtraidos.push(
              `### Conteúdo textual de "${doc.nome}"\n${texto}`,
            );
          }
        }

        if (tipo === 'pdf' && signedUrl && pdfFilesUsed < MAX_PDF_FILES) {
          const textoPdf = await this.baixarPdfTexto(signedUrl, doc.nome);
          if (textoPdf) {
            pdfFilesUsed += 1;
            textosExtraidos.push(
              `### Conteúdo extraído do PDF "${doc.nome}"\n${textoPdf}`,
            );
          } else {
            linhas.push(
              `  → PDF "${doc.nome}" listado, mas não foi possível extrair texto (pode ser imagem/escaneado).`,
            );
          }
        }
      }
    }

    // Inventário obrigatório para o modelo não "esquecer" anexos
    linhas.push(
      '',
      '## INVENTÁRIO OBRIGATÓRIO DE ANEXOS',
      `- Total de arquivos: ${processo.documentos.length}`,
      ...processo.documentos.map(
        (d, i) =>
          `${i + 1}. ${d.nome} (${this.classificarArquivo(this.extensao(d.nome))})`,
      ),
      '- Em QUALQUER resumo do caso, liste TODOS esses arquivos pelo nome. Não omita nenhum.',
    );

    if (textosExtraidos.length > 0) {
      linhas.push('', '## Conteúdo extraído de arquivos de texto');
      linhas.push(...textosExtraidos);
    }

    if (imagensUrls.length > 0) {
      linhas.push(
        '',
        `## Imagens disponíveis para análise visual (${imagensUrls.length})`,
        '- As imagens deste caso estão disponíveis para você inspecionar quando forem úteis à pergunta.',
      );
    }

    const videos = processo.documentos.filter((d) =>
      VIDEO_EXT.has(this.extensao(d.nome)),
    );
    if (videos.length > 0) {
      linhas.push('', '## Vídeos');
      for (const v of videos) {
        linhas.push(`- ${v.nome} (vídeo anexado — metadados apenas)`);
      }
      linhas.push(
        '- Vídeos: use metadados/nome; peça frame ou descrição se precisar do conteúdo visual.',
      );
    }

    return {
      textoContexto: linhas.join('\n'),
      imagensUrls,
    };
  }

  /** Detecta se a pergunta pede foco em anexos (para detalhe visual alto). */
  perguntaPedeArquivos(pergunta: string): boolean {
    const p = pergunta.toLowerCase();
    if (!p.trim()) return false;
    return /arquivo|anexo|documento|doc\b|imagem|foto|print|pdf|v[ií]deo|evid[eê]ncia|laudo|analis|anális|descrev|resumo|o que (tem|h[aá]|mostra|aparece)|olha|veja|mostrar|mostra|conte[uú]do|m[ií]dia|situa[cç][aã]o|atual|at[eé] agora/.test(
      p,
    );
  }

  private formatTags(tags: unknown): string {
    if (Array.isArray(tags)) return tags.map(String).join(', ') || '-';
    if (typeof tags === 'string') return tags || '-';
    return '-';
  }

  private extensao(nome: string): string {
    const i = nome.lastIndexOf('.');
    if (i < 0) return '';
    return nome.slice(i + 1).toLowerCase();
  }

  private classificarArquivo(
    ext: string,
  ): 'imagem' | 'texto' | 'video' | 'pdf' | 'outro' {
    if (IMAGE_EXT.has(ext)) return 'imagem';
    if (TEXT_EXT.has(ext)) return 'texto';
    if (VIDEO_EXT.has(ext)) return 'video';
    if (ext === 'pdf') return 'pdf';
    return 'outro';
  }

  private async baixarTexto(url: string, nome: string): Promise<string | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) {
        this.logger.warn(`Falha ao baixar texto ${nome}: HTTP ${res.status}`);
        return null;
      }
      const raw = await res.text();
      const trimmed = raw.replace(/\0/g, '').trim();
      if (!trimmed) return null;
      if (trimmed.length <= MAX_TEXT_CHARS_PER_FILE) return trimmed;
      return `${trimmed.slice(0, MAX_TEXT_CHARS_PER_FILE)}\n\n[... truncado ...]`;
    } catch (error) {
      this.logger.warn(`Erro ao ler arquivo texto ${nome}`, error as Error);
      return null;
    }
  }

  private async baixarPdfTexto(
    url: string,
    nome: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        this.logger.warn(`Falha ao baixar PDF ${nome}: HTTP ${res.status}`);
        return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      // pdf-parse v2+: classe PDFParse (não mais função default)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require('pdf-parse') as {
        PDFParse: new (opts: { data: Buffer }) => {
          getText: () => Promise<{ text?: string }>;
          destroy: () => Promise<void>;
        };
      };
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        const trimmed = (parsed.text || '').replace(/\0/g, '').trim();
        if (!trimmed) return null;
        if (trimmed.length <= MAX_PDF_CHARS_PER_FILE) return trimmed;
        return `${trimmed.slice(0, MAX_PDF_CHARS_PER_FILE)}\n\n[... PDF truncado ...]`;
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (error) {
      this.logger.warn(`Erro ao extrair PDF ${nome}`, error as Error);
      return null;
    }
  }
}
