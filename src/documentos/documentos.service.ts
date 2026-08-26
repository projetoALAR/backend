import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma.service';
import { BillingService } from '../billing/billing.service';
import { DOCUMENTO_MIME_ALLOWLIST } from './documentos.dto';
import 'multer';

const BUCKET = 'documentos';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

/** Helvetica do PDFKit não cobre acentuação PT — remove diacríticos só no PDF. */
function textoParaPdfLatin1(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
      if (code >= 0x20 && code <= 0x7e) return ch;
      return '';
    })
    .join('');
}

function renderizarPdfDeTexto(texto: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(textoParaPdfLatin1(texto), { align: 'justify', lineGap: 2 });
    doc.end();
  });
}

function criarClienteStorage(config: ConfigService): SupabaseClient | null {
  const url = (config.get<string>('SUPABASE_URL') || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/+$/, '');
  const key = (config.get<string>('SUPABASE_KEY') || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (!url || !key) return null;
  return createClient(url, key);
}

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);
  private readonly supabase: SupabaseClient | null;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
    private billing: BillingService,
  ) {
    this.supabase = criarClienteStorage(config);
    if (!this.supabase) {
      this.logger.warn(
        'SUPABASE_URL/KEY ausentes — upload e URLs assinadas ficam indisponíveis',
      );
    }
  }

  private exigirStorage(): SupabaseClient {
    if (!this.supabase) {
      throw new InternalServerErrorException(
        'Storage (Supabase) não configurado.',
      );
    }
    return this.supabase;
  }

  /** Extrai path no bucket a partir de path puro ou URL pública antiga. */
  extractStoragePath(urlOrPath: string): string {
    if (!urlOrPath.includes('://')) {
      return urlOrPath.replace(/^\/+/, '');
    }
    try {
      const url = new URL(urlOrPath);
      const marker = `/${BUCKET}/`;
      const idx = url.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(url.pathname.slice(idx + marker.length));
      }
    } catch {
      // fallback abaixo
    }
    return urlOrPath;
  }

  /** URL temporária assinada para download/visão (bucket privado). */
  async resolveSignedUrl(urlOrPath: string): Promise<string> {
    if (!this.supabase) {
      return urlOrPath.includes('://') ? urlOrPath : '';
    }
    const path = this.extractStoragePath(urlOrPath);
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      const cause =
        error && typeof error === 'object' && 'cause' in error
          ? String((error as { cause?: unknown }).cause)
          : '';
      this.logger.warn(
        `Falha ao assinar URL de ${path}: ${error?.message || 'sem signedUrl'}${
          cause ? ` (${cause})` : ''
        }`,
      );
      return urlOrPath.includes('://') ? urlOrPath : '';
    }
    return data.signedUrl;
  }

  /** Baixa o binário do Storage (proxy autenticado — evita abrir URL vazia no browser). */
  async baixarArquivo(id: string): Promise<{
    buffer: Buffer;
    nome: string;
    contentType: string;
  }> {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }
    const path = this.extractStoragePath(documento.urlArquivo);
    const { data, error } = await this.exigirStorage()
      .storage.from(BUCKET)
      .download(path);
    if (error || !data) {
      this.logger.warn(
        `Falha ao baixar ${path}: ${error?.message || 'sem data'}`,
      );
      throw new InternalServerErrorException(
        'Não foi possível baixar o arquivo do storage.',
      );
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = documento.nome.split('.').pop()?.toLowerCase() || '';
    const contentType =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'png'
          ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
              ? 'image/webp'
              : 'application/octet-stream';
    return { buffer, nome: documento.nome, contentType };
  }

  private async withSignedUrl<T extends { urlArquivo: string }>(doc: T) {
    return {
      ...doc,
      urlArquivo: await this.resolveSignedUrl(doc.urlArquivo),
    };
  }

  async fazerUpload(processoId: string, arquivo: Express.Multer.File) {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    if (!processoId) {
      throw new BadRequestException('processoId obrigatório');
    }

    const mime = (arquivo.mimetype || '').toLowerCase();
    const ext = arquivo.originalname.split('.').pop()?.toLowerCase() || '';
    const mimeOk =
      DOCUMENTO_MIME_ALLOWLIST.has(mime) ||
      [
        'pdf',
        'jpg',
        'jpeg',
        'png',
        'webp',
        'gif',
        'txt',
        'csv',
        'md',
        'doc',
        'docx',
      ].includes(ext);
    if (!mimeOk) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido (${mime || ext || 'desconhecido'}). Use PDF, imagens, TXT/CSV ou Word.`,
      );
    }

    await this.billing.assertPodeArmazenarBytes(arquivo.size);

    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const safeName = arquivo.originalname.replace(/[^\w.-]+/g, '_');
    const storagePath = `${processoId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await this.exigirStorage()
      .storage.from(BUCKET)
      .upload(storagePath, arquivo.buffer, {
        contentType: arquivo.mimetype,
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(uploadError.message);
      throw new InternalServerErrorException(
        'Erro ao enviar arquivo para a nuvem.',
      );
    }

    const documento = await this.prisma.documento.create({
      data: {
        nome: arquivo.originalname,
        // Guarda o path no bucket; a URL assinada é gerada na leitura
        urlArquivo: storagePath,
        tamanho: arquivo.size,
        processoId,
      },
    });

    return this.withSignedUrl(documento);
  }

  /**
   * Gera PDF a partir de texto, faz upload e cria o Documento do processo.
   * `revisao` registra quem confirmou a revisão humana e quando (auditoria/LGPD).
   */
  async criarDocumentoDeTexto(
    processoId: string,
    nomeArquivo: string,
    conteudoTexto: string,
    revisao?: { usuarioId: string; em: Date },
  ) {
    if (!processoId) {
      throw new BadRequestException('processoId obrigatório');
    }
    const nome = nomeArquivo.trim();
    if (!nome) {
      throw new BadRequestException('nomeArquivo obrigatório');
    }
    if (!conteudoTexto?.trim()) {
      throw new BadRequestException('conteudoTexto obrigatório');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const nomeComExt = nome.toLowerCase().endsWith('.pdf')
      ? nome
      : `${nome}.pdf`;
    const safeName = nomeComExt.replace(/[^\w.-]+/g, '_');
    const storagePath = `${processoId}/${Date.now()}-${safeName}`;
    const pdfBuffer = await renderizarPdfDeTexto(conteudoTexto);
    await this.billing.assertPodeArmazenarBytes(pdfBuffer.length);

    const { error: uploadError } = await this.exigirStorage()
      .storage.from(BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(uploadError.message);
      throw new InternalServerErrorException(
        'Erro ao enviar arquivo para a nuvem.',
      );
    }

    const documento = await this.prisma.documento.create({
      data: {
        nome: nomeComExt,
        urlArquivo: storagePath,
        tamanho: pdfBuffer.length,
        processoId,
        revisadoPorUsuarioId: revisao?.usuarioId ?? null,
        revisadoEm: revisao?.em ?? null,
      },
    });

    return this.withSignedUrl(documento);
  }

  async listarPorProcesso(processoId: string) {
    const docs = await this.prisma.documento.findMany({
      where: { processoId },
      orderBy: { criadoEm: 'desc' },
      include: { revisadoPorUsuario: { select: { nome: true } } },
    });
    return Promise.all(docs.map((d) => this.withSignedUrl(d)));
  }

  async buscarPorId(id: string) {
    const documento = await this.prisma.documento.findUnique({
      where: { id },
      include: { revisadoPorUsuario: { select: { nome: true } } },
    });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return this.withSignedUrl(documento);
  }

  async remover(id: string) {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const storagePath = this.extractStoragePath(documento.urlArquivo);
    try {
      if (this.supabase) {
        await this.supabase.storage.from(BUCKET).remove([storagePath]);
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao remover do Storage (${storagePath}): ${String(err)}`,
      );
    }

    return this.prisma.documento.delete({ where: { id } });
  }
}
