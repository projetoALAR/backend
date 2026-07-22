import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createClient } from '@supabase/supabase-js';
import 'multer';

@Injectable()
export class DocumentosService {
  private supabase;

  constructor(private prisma: PrismaService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || '',
    );
  }

  async fazerUpload(processoId: string, arquivo: Express.Multer.File) {
    const nomeUnico = `${Date.now()}-${arquivo.originalname.replace(/\s+/g, '_')}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(nomeUnico, arquivo.buffer, {
        contentType: arquivo.mimetype,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new InternalServerErrorException('Erro ao enviar arquivo para a nuvem.');
    }

    const { data: publicUrlData } = this.supabase.storage
      .from('documentos')
      .getPublicUrl(nomeUnico);

    return this.prisma.documento.create({
      data: {
        nome: arquivo.originalname,
        urlArquivo: publicUrlData.publicUrl,
        tamanho: arquivo.size,
        processoId: processoId,
      },
    });
  }

  async listarPorProcesso(processoId: string) {
    return this.prisma.documento.findMany({
      where: { processoId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async remover(id: string) {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }

    // Best-effort: remove do Storage se o path for reconhecível
    try {
      const url = new URL(documento.urlArquivo);
      const parts = url.pathname.split('/documentos/');
      const storagePath = parts[1] ? decodeURIComponent(parts[1]) : null;
      if (storagePath) {
        await this.supabase.storage.from('documentos').remove([storagePath]);
      }
    } catch {
      // Ignora falha no Storage; ainda remove o registro
    }

    return this.prisma.documento.delete({ where: { id } });
  }
}
