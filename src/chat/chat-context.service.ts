import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';
import {
  CasoAcessoService,
  type CasoAcessoUser,
} from '../casos-acesso/caso-acesso.service';
import { type ChatFonte, extrairTrechoRelevante } from './chat-fonte.types';

export type CasoLlmAnexo = {
  textoContexto: string;
  imagensUrls: string[];
  fontes: ChatFonte[];
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
    private readonly casoAcesso: CasoAcessoService,
  ) {}

  /**
   * Snapshot AGREGADO do workspace para o chat geral (/chat).
   * Privacidade: NÃO inclui descrição, cliente, documentos nem conteúdo dos casos.
   * Pode expor apenas totais + título/status dos processos.
   * Assistente: só vê/conta processos atribuídos a ele.
   */
  async montarContexto(opcoes?: {
    processoId?: string | null;
    pergunta?: string;
    user?: CasoAcessoUser;
  }): Promise<string> {
    void opcoes?.processoId;
    void opcoes?.pergunta;
    const agora = new Date();
    const visProc = opcoes?.user
      ? this.casoAcesso.visibilidadeProcesso(opcoes.user)
      : {};
    const visCli = opcoes?.user
      ? this.casoAcesso.visibilidadeCliente(opcoes.user)
      : {};

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
      this.prisma.cliente.count({ where: visCli }),
      this.prisma.processo.count({ where: visProc }),
      this.prisma.processo.count({
        where: { ...visProc, concluido: true },
      }),
      this.prisma.processo.count({
        where: { ...visProc, concluido: false },
      }),
      this.prisma.processo.groupBy({
        by: ['status'],
        where: visProc,
        _count: { status: true },
        orderBy: { _count: { status: 'desc' } },
      }),
      this.prisma.processo.groupBy({
        by: ['prioridade'],
        where: { ...visProc, concluido: false },
        _count: { prioridade: true },
      }),
      this.prisma.membroEquipe.count(),
      this.prisma.membroEquipe.count({ where: { status: 'active' } }),
      this.prisma.processo.findMany({
        where: { ...visProc, concluido: false },
        take: 50,
        orderBy: { atualizadoEm: 'desc' },
        select: {
          titulo: true,
          numero: true,
          status: true,
        },
      }),
      this.prisma.processo.findMany({
        where: { ...visProc, concluido: true },
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
      `- Tipo: ${processo.cliente.tipo || 'PF'}`,
      `- CPF: ${processo.cliente.cpf || '-'}`,
      `- CNPJ: ${processo.cliente.cnpj || '-'}`,
      `- Nome fantasia: ${processo.cliente.nomeFantasia || '-'}`,
      `- E-mail: ${processo.cliente.email || '-'}`,
      `- Telefone: ${processo.cliente.telefone || '-'}`,
      `- Endereço: ${[processo.cliente.endereco, processo.cliente.cidade, processo.cliente.uf, processo.cliente.cep].filter(Boolean).join(' / ') || '-'}`,
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

    const andamentos = await this.prisma.andamento.findMany({
      where: { processoId },
      orderBy: { data: 'desc' },
      take: 20,
      select: { data: true, descricao: true },
    });

    linhas.push('', '## Andamentos recentes');
    if (andamentos.length === 0) {
      linhas.push('- Nenhum andamento registrado.');
    } else {
      for (const a of andamentos) {
        linhas.push(`- ${a.data.toISOString().slice(0, 10)} | ${a.descricao}`);
      }
    }

    const tarefas = await this.prisma.processoTarefa.findMany({
      where: { processoId },
      orderBy: [{ concluida: 'asc' }, { ordem: 'asc' }],
      select: { titulo: true, concluida: true, prazo: true },
    });
    const pendentes = tarefas.filter((t) => !t.concluida).length;
    linhas.push(
      '',
      `## Checklist do caso (${pendentes} pendente(s) de ${tarefas.length})`,
    );
    if (tarefas.length === 0) {
      linhas.push('- Nenhuma tarefa cadastrada.');
    } else {
      for (const t of tarefas) {
        const marca = t.concluida ? 'x' : ' ';
        const prazo = t.prazo
          ? ` | prazo ${t.prazo.toISOString().slice(0, 10)}`
          : '';
        linhas.push(`- [${marca}] ${t.titulo}${prazo}`);
      }
    }

    linhas.push('', `## Arquivos do caso (${processo._count.documentos})`);

    const imagensUrls: string[] = [];
    const textosExtraidos: string[] = [];
    const fontes: ChatFonte[] = [];
    let textFilesUsed = 0;
    let pdfFilesUsed = 0;

    if (processo.documentos.length === 0) {
      linhas.push('- Nenhum arquivo anexado ainda.');
    } else {
      for (const doc of processo.documentos) {
        const ext = this.extensao(doc.nome);
        const tipo = this.classificarArquivo(ext);
        const tamanho = doc.tamanho != null ? `${doc.tamanho} bytes` : '?';
        const signedUrl = await this.documentos.resolveSignedUrl(
          doc.urlArquivo,
        );

        linhas.push(
          `- [${tipo}] ${doc.nome} | ${tamanho} | enviado: ${doc.criadoEm.toISOString().slice(0, 10)} | acesso: ${signedUrl ? 'URL assinada temporária' : 'falhou'}`,
        );

        if (tipo === 'imagem' && signedUrl && imagensUrls.length < MAX_IMAGES) {
          imagensUrls.push(signedUrl);
          fontes.push({
            documentoId: doc.id,
            nome: doc.nome,
            trecho: null,
            tipo: 'imagem',
          });
        }

        if (tipo === 'texto' && textFilesUsed < MAX_TEXT_FILES) {
          const texto = await this.obterTextoDocumento(
            doc.id,
            doc.nome,
            signedUrl,
          );
          if (texto) {
            textFilesUsed += 1;
            const trecho = extrairTrechoRelevante(texto, pergunta);
            fontes.push({
              documentoId: doc.id,
              nome: doc.nome,
              trecho: trecho || null,
              tipo: 'texto',
            });
            textosExtraidos.push(
              `### Conteúdo textual de "${doc.nome}"\n${texto}`,
            );
          }
        }

        if (tipo === 'pdf' && pdfFilesUsed < MAX_PDF_FILES) {
          const textoPdf = await this.obterPdfTextoDocumento(
            doc.id,
            doc.nome,
            signedUrl,
          );
          if (textoPdf) {
            pdfFilesUsed += 1;
            const trecho = extrairTrechoRelevante(textoPdf, pergunta);
            fontes.push({
              documentoId: doc.id,
              nome: doc.nome,
              trecho: trecho || null,
              tipo: 'pdf',
            });
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
      '- Ao usar informação de um arquivo, cite o nome exato entre colchetes, ex.: [peticao.pdf].',
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
      fontes,
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

  private async obterTextoDocumento(
    documentoId: string,
    nome: string,
    signedUrl: string,
  ): Promise<string | null> {
    if (signedUrl) {
      const viaUrl = await this.baixarTexto(signedUrl, nome);
      if (viaUrl) return viaUrl;
    }
    try {
      const file = await this.documentos.baixarArquivo(documentoId);
      const trimmed = file.buffer.toString('utf8').replace(/\0/g, '').trim();
      if (!trimmed) return null;
      if (trimmed.length <= MAX_TEXT_CHARS_PER_FILE) return trimmed;
      return `${trimmed.slice(0, MAX_TEXT_CHARS_PER_FILE)}\n\n[... truncado ...]`;
    } catch (error) {
      this.logger.warn(`Erro ao ler texto via storage ${nome}`, error as Error);
      return null;
    }
  }

  private async obterPdfTextoDocumento(
    documentoId: string,
    nome: string,
    signedUrl: string,
  ): Promise<string | null> {
    if (signedUrl) {
      const viaUrl = await this.baixarPdfTexto(signedUrl, nome);
      if (viaUrl) return viaUrl;
    }
    try {
      const file = await this.documentos.baixarArquivo(documentoId);
      return this.extrairTextoPdfBuffer(file.buffer, nome);
    } catch (error) {
      this.logger.warn(`Erro ao ler PDF via storage ${nome}`, error as Error);
      return null;
    }
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
      return this.extrairTextoPdfBuffer(buffer, nome);
    } catch (error) {
      this.logger.warn(`Erro ao extrair PDF ${nome}`, error as Error);
      return null;
    }
  }

  private async extrairTextoPdfBuffer(
    buffer: Buffer,
    nome: string,
  ): Promise<string | null> {
    try {
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
      this.logger.warn(`Erro ao parsear PDF ${nome}`, error as Error);
      return null;
    }
  }
}
