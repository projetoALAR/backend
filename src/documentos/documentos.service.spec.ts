import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';

const upload = jest.fn();
const createSignedUrl = jest.fn();
const remove = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload, createSignedUrl, remove }),
    },
  }),
}));

function arquivo(
  partial: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'arquivo',
    originalname: 'peticao.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 4,
    buffer: Buffer.from('%PDF'),
    stream: undefined as unknown as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
    ...partial,
  };
}

describe('DocumentosService', () => {
  const prisma = {
    processo: { findUnique: jest.fn() },
    documento: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  function criarServico(
    config: Record<string, string> = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_KEY: 'test-key',
    },
  ) {
    return new DocumentosService(
      prisma as unknown as PrismaService,
      { get: (key: string) => config[key] } as ConfigService,
      { assertPodeArmazenarBytes: jest.fn() } as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extrai path relativo e de URL do bucket', () => {
    const service = criarServico();
    expect(service.extractStoragePath('/foo/bar.pdf')).toBe('foo/bar.pdf');
    expect(
      service.extractStoragePath(
        'https://x.supabase.co/storage/v1/object/public/documentos/p1/a.pdf',
      ),
    ).toBe('p1/a.pdf');
    expect(service.extractStoragePath('https://exemplo.com/outro')).toBe(
      'https://exemplo.com/outro',
    );
  });

  it('sem storage devolve URL absoluta e string vazia no path', async () => {
    const service = criarServico({ SUPABASE_URL: '', SUPABASE_KEY: '' });
    await expect(service.resolveSignedUrl('https://x.com/a.pdf')).resolves.toBe(
      'https://x.com/a.pdf',
    );
    await expect(service.resolveSignedUrl('p1/a.pdf')).resolves.toBe('');
  });

  it('assina URL e cai no fallback se o storage falhar', async () => {
    const service = criarServico();
    createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://signed' },
      error: null,
    });
    await expect(service.resolveSignedUrl('p1/a.pdf')).resolves.toBe(
      'https://signed',
    );

    createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    });
    await expect(service.resolveSignedUrl('https://x.com/a.pdf')).resolves.toBe(
      'https://x.com/a.pdf',
    );
  });

  it('rejeita upload sem arquivo, processo ou tipo inválido', async () => {
    const service = criarServico();
    await expect(
      service.fazerUpload('p1', arquivo({ buffer: Buffer.alloc(0) })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.fazerUpload('', arquivo())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.fazerUpload(
        'p1',
        arquivo({
          originalname: 'x.exe',
          mimetype: 'application/x-msdownload',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita upload se o processo não existe', async () => {
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(
      criarServico().fazerUpload('p1', arquivo()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('faz upload e devolve URL assinada', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'p1' });
    upload.mockResolvedValue({ error: null });
    prisma.documento.create.mockResolvedValue({
      id: 'd1',
      nome: 'peticao.pdf',
      urlArquivo: 'p1/file.pdf',
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed' },
      error: null,
    });

    await expect(criarServico().fazerUpload('p1', arquivo())).resolves.toEqual(
      expect.objectContaining({ id: 'd1', urlArquivo: 'https://signed' }),
    );
  });

  it('falha o upload quando o storage retorna erro', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'p1' });
    upload.mockResolvedValue({ error: { message: 'quota' } });
    await expect(
      criarServico().fazerUpload('p1', arquivo()),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejeita criar PDF sem dados e sem processo', async () => {
    const service = criarServico();
    await expect(
      service.criarDocumentoDeTexto('', 'a', 'texto'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.criarDocumentoDeTexto('p1', '  ', 'texto'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.criarDocumentoDeTexto('p1', 'a', '  '),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(
      service.criarDocumentoDeTexto('p1', 'peticao', 'conteudo'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gera PDF, envia ao storage e cria o documento', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'p1' });
    upload.mockResolvedValue({ error: null });
    prisma.documento.create.mockResolvedValue({
      id: 'd2',
      nome: 'peticao.pdf',
      urlArquivo: 'p1/peticao.pdf',
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed' },
      error: null,
    });

    await expect(
      criarServico().criarDocumentoDeTexto('p1', 'peticao', 'Olá, processo.'),
    ).resolves.toEqual(
      expect.objectContaining({ id: 'd2', urlArquivo: 'https://signed' }),
    );
    expect(upload).toHaveBeenCalled();
  });

  it('persiste quem revisou e quando, quando informado', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'p1' });
    upload.mockResolvedValue({ error: null });
    const revisadoEm = new Date('2026-08-14T18:00:00.000Z');
    prisma.documento.create.mockResolvedValue({
      id: 'd3',
      nome: 'peticao.pdf',
      urlArquivo: 'p1/peticao.pdf',
      revisadoPorUsuarioId: 'u1',
      revisadoEm,
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed' },
      error: null,
    });

    await expect(
      criarServico().criarDocumentoDeTexto('p1', 'peticao', 'Olá, processo.', {
        usuarioId: 'u1',
        em: revisadoEm,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'd3',
        revisadoPorUsuarioId: 'u1',
        revisadoEm,
      }),
    );
    expect(prisma.documento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revisadoPorUsuarioId: 'u1',
        revisadoEm,
      }),
    });
  });

  it('sem revisão informada, grava os campos como null', async () => {
    prisma.processo.findUnique.mockResolvedValue({ id: 'p1' });
    upload.mockResolvedValue({ error: null });
    prisma.documento.create.mockResolvedValue({
      id: 'd4',
      nome: 'peticao.pdf',
      urlArquivo: 'p1/peticao.pdf',
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed' },
      error: null,
    });

    await criarServico().criarDocumentoDeTexto('p1', 'peticao', 'Texto.');
    expect(prisma.documento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        revisadoPorUsuarioId: null,
        revisadoEm: null,
      }),
    });
  });

  it('lista documentos do processo com URL assinada', async () => {
    prisma.documento.findMany.mockResolvedValue([
      { id: 'd1', urlArquivo: 'p1/a.pdf' },
    ]);
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed' },
      error: null,
    });
    await expect(criarServico().listarPorProcesso('p1')).resolves.toEqual([
      { id: 'd1', urlArquivo: 'https://signed' },
    ]);
  });

  it('remove documento mesmo sem storage', async () => {
    prisma.documento.findUnique.mockResolvedValue({
      id: 'd1',
      urlArquivo: 'p1/a.pdf',
    });
    prisma.documento.delete.mockResolvedValue({ id: 'd1' });
    await expect(criarServico({}).remover('d1')).resolves.toEqual({ id: 'd1' });
    expect(remove).not.toHaveBeenCalled();
  });

  it('remove do storage e do banco', async () => {
    prisma.documento.findUnique.mockResolvedValue({
      id: 'd1',
      urlArquivo: 'p1/a.pdf',
    });
    remove.mockResolvedValue({});
    prisma.documento.delete.mockResolvedValue({ id: 'd1' });
    await expect(criarServico().remover('d1')).resolves.toEqual({ id: 'd1' });
    expect(remove).toHaveBeenCalled();
  });

  it('404 se o documento não existe', async () => {
    prisma.documento.findUnique.mockResolvedValue(null);
    await expect(criarServico().remover('d1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
