import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma.service';
import { AsaasClient } from './asaas.client';
import { Role } from '../auth/roles';
import { limitesDoPlano, valorDoPlano, isPlanoId } from './planos.config';

describe('planos.config limites', () => {
  it('reconhece planos e valores', () => {
    expect(isPlanoId('profissional')).toBe(true);
    expect(valorDoPlano('essencial', 'MONTHLY')).toBe(197);
    expect(limitesDoPlano('essencial')?.maxUsuarios).toBe(3);
    expect(limitesDoPlano('profissional')?.tokensDia).toBe(200_000);
  });
});

describe('BillingService assinatura do escritório', () => {
  const trialAte = new Date(Date.now() + 7 * 86400000);
  const assinaturaAdmin = {
    id: 'a1',
    usuarioId: 'admin-1',
    planoId: 'essencial',
    ciclo: 'MONTHLY',
    status: 'trial',
    valor: 197,
    invoiceUrl: null,
    trialAte,
    vigenteAte: null,
    atualizadoEm: new Date(),
  };

  const prisma = {
    assinatura: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    usuario: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    documento: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { tamanho: 0 } }),
    },
  };

  const config = {
    get: jest.fn((key: string) =>
      key === 'REQUIRE_SUBSCRIPTION' ? 'true' : undefined,
    ),
  } as unknown as ConfigService;

  const asaas = { habilitado: jest.fn().mockReturnValue(false) };

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(
      prisma as unknown as PrismaService,
      asaas as unknown as AsaasClient,
      config,
    );
  });

  it('membro herda acesso do ADMIN com trial', async () => {
    prisma.assinatura.findUnique.mockResolvedValue(null);
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'admin-1', assinatura: assinaturaAdmin },
    ]);

    await expect(service.usuarioTemAcesso('membro-1')).resolves.toBe(true);
    const minha = await service.minhaAssinatura('membro-1', Role.ASSISTENTE);
    expect(minha.temAcesso).toBe(true);
    expect(minha.compartilhada).toBe(true);
    expect(minha.podeCheckout).toBe(false);
    expect(minha.assinatura?.planoId).toBe('essencial');
  });

  it('bloqueia novo usuário no limite de assentos', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'admin-1', assinatura: assinaturaAdmin },
    ]);
    prisma.usuario.count.mockResolvedValue(3);

    await expect(service.assertPodeAdicionarUsuario()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('permite novo usuário abaixo do limite', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 'admin-1', assinatura: assinaturaAdmin },
    ]);
    prisma.usuario.count.mockResolvedValue(2);
    await expect(service.assertPodeAdicionarUsuario()).resolves.toBeUndefined();
  });
});
