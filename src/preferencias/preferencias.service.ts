import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { DocumentosService } from '../documentos/documentos.service';
import 'multer';

const BUCKET = 'documentos';

type PreferenciaUpdateBody = {
  nome?: string;
  email?: string;
  fotoUrl?: string | null;
  notificacoes?: Prisma.InputJsonValue;
  notificacoesLidas?: Prisma.InputJsonValue;
  tema?: string;
};

@Injectable()
export class PreferenciasService {
  private readonly logger = new Logger(PreferenciasService.name);
  private readonly supabase: SupabaseClient | null;

  constructor(
    private prisma: PrismaService,
    private documentos: DocumentosService,
    config: ConfigService,
  ) {
    const url = (config.get<string>('SUPABASE_URL') || '').trim();
    const key = (config.get<string>('SUPABASE_KEY') || '').trim();
    this.supabase = url && key ? createClient(url, key) : null;
  }

  private async withSignedFoto<T extends { fotoUrl: string | null }>(
    preferencia: T,
  ): Promise<T> {
    if (!preferencia.fotoUrl) {
      return preferencia;
    }
    return {
      ...preferencia,
      fotoUrl: await this.documentos.resolveSignedUrl(preferencia.fotoUrl),
    };
  }

  async obter(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    const preferencia = await this.prisma.preferencia.upsert({
      where: { usuarioId: userId },
      create: {
        usuarioId: userId,
        nome: usuario?.nome || '',
        email: usuario?.email || '',
        fotoUrl: usuario?.fotoUrl,
      },
      update: {},
    });

    return this.withSignedFoto(preferencia);
  }

  async atualizar(dados: PreferenciaUpdateBody, userId: string) {
    await this.obter(userId);

    const data: Prisma.PreferenciaUpdateInput = {};
    if (dados.nome !== undefined) data.nome = dados.nome;
    if (dados.email !== undefined) data.email = dados.email;
    if (dados.fotoUrl !== undefined) data.fotoUrl = dados.fotoUrl;
    if (dados.notificacoes !== undefined)
      data.notificacoes = dados.notificacoes;
    if (dados.notificacoesLidas !== undefined) {
      data.notificacoesLidas = dados.notificacoesLidas;
    }
    if (dados.tema !== undefined) data.tema = dados.tema;

    const preferencia = await this.prisma.preferencia.update({
      where: { usuarioId: userId },
      data,
    });

    if (
      dados.nome !== undefined ||
      dados.email !== undefined ||
      dados.fotoUrl !== undefined
    ) {
      const userData: Prisma.UsuarioUpdateInput = {};
      if (dados.nome !== undefined) userData.nome = dados.nome;
      if (dados.email !== undefined) userData.email = dados.email;
      if (dados.fotoUrl !== undefined) userData.fotoUrl = dados.fotoUrl;
      await this.prisma.usuario.update({
        where: { id: userId },
        data: userData,
      });

      // Mantém o cartão da equipe alinhado ao perfil
      if (dados.nome !== undefined || dados.email !== undefined) {
        await this.prisma.membroEquipe.updateMany({
          where: { usuarioId: userId },
          data: {
            ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
            ...(dados.email !== undefined
              ? { email: dados.email.trim().toLowerCase() }
              : {}),
          },
        });
      }
    }

    return this.withSignedFoto(preferencia);
  }

  async atualizarFoto(arquivo: Express.Multer.File, userId: string) {
    if (!arquivo) {
      throw new BadRequestException('Arquivo de imagem é obrigatório');
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(arquivo.mimetype)) {
      throw new BadRequestException('Formato de imagem não suportado');
    }

    // Path no bucket privado; URL assinada só na leitura (como documentos)
    const safeName = arquivo.originalname.replace(/[^\w.-]+/g, '_');
    const storagePath = `avatars/${userId}/${Date.now()}-${safeName}`;

    if (!this.supabase) {
      throw new InternalServerErrorException(
        'Storage (Supabase) não configurado.',
      );
    }

    const { error: uploadError } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, arquivo.buffer, {
        contentType: arquivo.mimetype,
        upsert: true,
      });

    if (uploadError) {
      this.logger.error(uploadError.message);
      throw new InternalServerErrorException(
        'Erro ao enviar foto para a nuvem.',
      );
    }

    return this.atualizar({ fotoUrl: storagePath }, userId);
  }
}
