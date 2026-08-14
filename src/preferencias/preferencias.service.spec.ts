import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PreferenciasService } from './preferencias.service';
import { PrismaService } from '../prisma.service';
import { DocumentosService } from '../documentos/documentos.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

describe('PreferenciasService', () => {
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    preferencia: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    membroEquipe: {
      updateMany: jest.fn(),
    },
  };

  const documentos = {
    resolveSignedUrl: jest.fn((url: string) => `signed:${url}`),
  };

  let service: PreferenciasService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PreferenciasService(
      prisma as unknown as PrismaService,
      documentos as unknown as DocumentosService,
      {
        get: (k: string) =>
          k === 'SUPABASE_URL' ? 'https://x.supabase.co' : 'key',
      } as ConfigService,
    );
  });

  it('obter faz upsert e assina fotoUrl', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u1',
      nome: 'Ana',
      email: 'ana@alar.com.br',
      fotoUrl: 'avatars/u1/a.png',
    });
    prisma.preferencia.upsert.mockResolvedValue({
      usuarioId: 'u1',
      nome: 'Ana',
      fotoUrl: 'avatars/u1/a.png',
    });

    const pref = await service.obter('u1');
    expect(pref.fotoUrl).toBe('signed:avatars/u1/a.png');
    expect(prisma.preferencia.upsert).toHaveBeenCalled();
  });

  it('atualizar sincroniza usuário e membro de equipe', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', nome: 'Ana' });
    prisma.preferencia.upsert.mockResolvedValue({
      usuarioId: 'u1',
      nome: 'Ana',
      fotoUrl: null,
    });
    prisma.preferencia.update.mockResolvedValue({
      usuarioId: 'u1',
      nome: 'Ana Nova',
      email: 'ana@alar.com.br',
      fotoUrl: null,
    });
    prisma.usuario.update.mockResolvedValue({});
    prisma.membroEquipe.updateMany.mockResolvedValue({ count: 1 });

    await service.atualizar({ nome: 'Ana Nova' }, 'u1');

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { nome: 'Ana Nova' },
    });
    expect(prisma.membroEquipe.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1' },
      data: { nome: 'Ana Nova' },
    });
  });

  it('atualizarFoto rejeita sem arquivo', async () => {
    await expect(
      service.atualizarFoto(undefined as unknown as Express.Multer.File, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atualizarFoto rejeita mime inválido', async () => {
    await expect(
      service.atualizarFoto(
        {
          mimetype: 'application/pdf',
          originalname: 'x.pdf',
          buffer: Buffer.from('x'),
        } as Express.Multer.File,
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
