import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import 'multer';

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
  private supabase;

  constructor(private prisma: PrismaService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || '',
    );
  }

  async obter(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    return this.prisma.preferencia.upsert({
      where: { usuarioId: userId },
      create: {
        usuarioId: userId,
        nome: usuario?.nome || '',
        email: usuario?.email || '',
        fotoUrl: usuario?.fotoUrl,
      },
      update: {},
    });
  }

  async atualizar(dados: PreferenciaUpdateBody, userId: string) {
    await this.obter(userId);

    const data: Prisma.PreferenciaUpdateInput = {};
    if (dados.nome !== undefined) data.nome = dados.nome;
    if (dados.email !== undefined) data.email = dados.email;
    if (dados.fotoUrl !== undefined) data.fotoUrl = dados.fotoUrl;
    if (dados.notificacoes !== undefined) data.notificacoes = dados.notificacoes;
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
    }

    return preferencia;
  }

  async atualizarFoto(arquivo: Express.Multer.File, userId: string) {
    if (!arquivo) {
      throw new BadRequestException('Arquivo de imagem é obrigatório');
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(arquivo.mimetype)) {
      throw new BadRequestException('Formato de imagem não suportado');
    }

    const nomeUnico = `avatars/${Date.now()}-${arquivo.originalname.replace(/\s+/g, '_')}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documentos')
      .upload(nomeUnico, arquivo.buffer, {
        contentType: arquivo.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new InternalServerErrorException('Erro ao enviar foto para a nuvem.');
    }

    const { data: publicUrlData } = this.supabase.storage
      .from('documentos')
      .getPublicUrl(nomeUnico);

    return this.atualizar({ fotoUrl: publicUrlData.publicUrl }, userId);
  }
}
