import { AuditoriaService } from './auditoria.service';
import { PrismaService } from '../prisma.service';

describe('AuditoriaService', () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: AuditoriaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditoriaService(prisma as unknown as PrismaService);
  });

  it('grava log com dados do ator', async () => {
    prisma.auditLog.create.mockResolvedValue({});
    await service.registrar({
      acao: 'CRIAR',
      entidade: 'CLIENTE',
      entidadeId: 'c1',
      resumo: 'Cliente Ana',
      ator: { id: 'u1', nome: 'Admin', email: 'admin@alar.com.br' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'CRIAR',
        entidade: 'CLIENTE',
        entidadeId: 'c1',
        usuarioId: 'u1',
        usuarioEmail: 'admin@alar.com.br',
      }),
    });
  });

  it('não relança erro se o insert falhar', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    await expect(
      service.registrar({
        acao: 'EXCLUIR',
        entidade: 'PROCESSO',
        entidadeId: 'p1',
        resumo: 'Caso X',
      }),
    ).resolves.toBeUndefined();
  });

  it('lista com paginação', async () => {
    const items = [{ id: 'a1' }];
    prisma.$transaction.mockResolvedValue([items, 1]);
    const result = await service.listar({ page: 1, limit: 20 });
    expect(result).toEqual({ items, total: 1, page: 1, limit: 20 });
  });
});
