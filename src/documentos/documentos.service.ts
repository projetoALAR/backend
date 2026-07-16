import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createClient } from '@supabase/supabase-js';
import 'multer';

@Injectable()
export class DocumentosService {
  private supabase;

  constructor(private prisma: PrismaService) {
    // Inicializa o cliente do Supabase usando as variáveis de ambiente que já temos
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }

  async fazerUpload(processoId: string, arquivo: Express.Multer.File) {
    // 1. Gera um nome único para não sobrescrever arquivos com o mesmo nome
    const nomeUnico = `${Date.now()}-${arquivo.originalname.replace(/\s+/g, '_')}`;

    // 2. Envia o arquivo físico para o bucket 'documentos'
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(nomeUnico, arquivo.buffer, {
        contentType: arquivo.mimetype,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new InternalServerErrorException('Erro ao enviar arquivo para a nuvem.');
    }

    // 3. Pega a URL pública gerada pelo Supabase
    const { data: publicUrlData } = this.supabase.storage
      .from('documentos')
      .getPublicUrl(nomeUnico);

    // 4. Salva a URL no nosso banco de dados relacional
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
}