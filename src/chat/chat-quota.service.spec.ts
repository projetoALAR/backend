import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatQuotaService } from './chat-quota.service';
import { PrismaService } from '../prisma.service';
import { Role } from '../auth/roles';

describe('ChatQuotaService', () => {
  const prisma = {
    mensagem: {
      aggregate: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'CHAT_DAILY_TOKEN_LIMIT') return '1000';
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: ChatQuotaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatQuotaService(
      prisma as unknown as PrismaService,
      config,
    );
  });

  it('bloqueia quando uso + estimativa excede limite', async () => {
    prisma.mensagem.aggregate.mockResolvedValue({
      _sum: { tokensUsados: 900 },
    });

    await expect(
      service.assertPodeUsar('u1', Role.ADVOGADO, 200),
    ).rejects.toBeInstanceOf(HttpException);

    await expect(
      service.assertPodeUsar('u1', Role.ADVOGADO, 200),
    ).rejects.toMatchObject({ getStatus: expect.any(Function) });
  });

  it('permite uso dentro do limite', async () => {
    prisma.mensagem.aggregate.mockResolvedValue({
      _sum: { tokensUsados: 100 },
    });

    await expect(
      service.assertPodeUsar('u1', Role.ADVOGADO, 200),
    ).resolves.toBeUndefined();
  });

  it('admin tem limite maior por padrão', () => {
    expect(service.limiteDiario(Role.ADMIN)).toBe(500_000);
    expect(service.limiteDiario(Role.ADVOGADO)).toBe(1000);
  });

  it('registra feedback util', async () => {
    prisma.mensagem.findUnique.mockResolvedValue({
      id: 'm1',
      isUser: false,
      conversacao: { usuarioId: 'u1' },
    });
    prisma.mensagem.update.mockResolvedValue({ id: 'm1', feedback: 'util' });

    await service.registrarFeedback('m1', 'u1', true);

    expect(prisma.mensagem.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { feedback: 'util' },
    });
  });
});
