import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { DOCUMENTO_MIME_ALLOWLIST } from './documentos.dto';
import 'multer';

const BUCKET = 'documentos';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL') || '',
      config.get<string>('SUPABASE_KEY') || '',
    );
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
    const path = this.extractStoragePath(urlOrPath);
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      this.logger.warn(`Falha ao assinar URL de ${path}: ${error?.message}`);
      return urlOrPath.includes('://') ? urlOrPath : '';
    }
    return data.signedUrl;
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
      ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'txt', 'csv', 'md', 'doc', 'docx'].includes(
        ext,
      );
    if (!mimeOk) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido (${mime || ext || 'desconhecido'}). Use PDF, imagens, TXT/CSV ou Word.`,
      );
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const safeName = arquivo.originalname.replace(/[^\w.-]+/g, '_');
    const storagePath = `${processoId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await this.supabase.storage
      .from(BUCKET)
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

  async listarPorProcesso(processoId: string) {
    const docs = await this.prisma.documento.findMany({
      where: { processoId },
      orderBy: { criadoEm: 'desc' },
    });
    return Promise.all(docs.map((d) => this.withSignedUrl(d)));
  }

  async remover(id: string) {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const storagePath = this.extractStoragePath(documento.urlArquivo);
    try {
      await this.supabase.storage.from(BUCKET).remove([storagePath]);
    } catch (err) {
      this.logger.warn(
        `Falha ao remover do Storage (${storagePath}): ${String(err)}`,
      );
    }

    return this.prisma.documento.delete({ where: { id } });
  }
}
